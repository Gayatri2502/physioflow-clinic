#!/usr/bin/env node
/** Offline-first clinic transfer. Validation is the default; --apply is explicit. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const [command, ...args] = process.argv.slice(2);
function option(name, fallback) { const i = args.indexOf('--' + name); return i < 0 ? fallback : args[i + 1]; }
function documentId(value) { return typeof value === 'string' && !!value && !value.includes('/') && value !== '.' && value !== '..' && !/^__.*__$/.test(value); }
function requireValue(value, label) { if (!value) throw new Error(label + ' is required.'); return value; }
const clinic = option('clinic', process.env.FIREBASE_CLINIC_ID || 'physioflow');
if (!documentId(clinic)) throw new Error('Invalid clinic identifier.');
async function sdk() {
  const { applicationDefault, cert, initializeApp } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  const { getStorage } = await import('firebase-admin/storage');
  const projectId = requireValue(process.env.FIREBASE_PROJECT_ID, 'FIREBASE_PROJECT_ID');
  const app = initializeApp({ projectId, credential: process.env.FIREBASE_SERVICE_ACCOUNT_JSON ? cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)) : applicationDefault(), storageBucket: process.env.FIREBASE_STORAGE_BUCKET });
  return { db: getFirestore(app, process.env.FIREBASE_DATABASE_ID || '(default)'), bucket: process.env.FIREBASE_STORAGE_BUCKET ? getStorage(app).bucket() : null, projectId };
}
function validate(raw) {
  if (!Array.isArray(raw.records) || !Array.isArray(raw.audits || [])) throw new Error('Snapshot must contain records and optional audits arrays.');
  const ids = new Set();
  const records = raw.records.map(row => {
    if (!documentId(row.id) || ids.has(row.id) || typeof row.kind !== 'string' || typeof row.created !== 'string' || !Number.isFinite(Date.parse(row.created))) throw new Error('Invalid or duplicate record identity/date.');
    ids.add(row.id);
    const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid record data.');
    if (data.documentKey) {
      if (typeof data.documentKey !== 'string' || !data.documentKey.includes('/')) throw new Error('Invalid document key.');
      data.documentKey = clinic + data.documentKey.slice(data.documentKey.indexOf('/'));
    }
    const record = { id: row.id, kind: row.kind, data, created: row.created };
    if (Buffer.byteLength(JSON.stringify(record)) > 900000) throw new Error('Record exceeds safe Firestore document size.');
    return record;
  });
  const auditIds = new Set();
  const audits = (raw.audits || []).map(row => {
    if (!documentId(row.id) || auditIds.has(row.id) || typeof row.action !== 'string' || typeof row.created !== 'string' || !Number.isFinite(Date.parse(row.created)) || typeof row.record_id !== 'string') throw new Error('Invalid or duplicate audit.');
    auditIds.add(row.id);
    return { id: row.id, owner: clinic, action: row.action, record_id: row.record_id, created: row.created };
  });
  // Upgrade legacy display-name references using the same rules as the clinic reader.
  for (const record of records) {
    for (const [label, kind, key] of [['Patient', 'Patients', 'patientId'], ['Therapist', 'Doctors', 'doctorId'], ['Department', 'Departments', 'departmentId'], ['Invoice', 'Billing', 'invoiceId']]) {
      if (!record.data[key] && record.data[label]) {
        const linked = records.find(r => r.kind === kind && (r.id === record.data[label] || r.data.Name === record.data[label]));
        if (linked) record.data[key] = linked.id;
      }
    }
    if (record.kind === 'Billing' && record.data.openingPaid === undefined) record.data.openingPaid = Number(record.data['Amount Paid'] || 0);
    if (record.kind === 'Packages' && record.data.openingSessions === undefined) record.data.openingSessions = Number(record.data['Sessions Completed'] || 0);
  }
  const documents = raw.documents || [];
  if (!Array.isArray(documents)) throw new Error('Documents must be an array.');
  const requiredKeys = new Set(records.filter(r => r.data.documentKey).map(r => r.data.documentKey));
  const documentKeys = new Set();
  for (const doc of documents) {
    if (typeof doc.key !== 'string' || typeof doc.path !== 'string' || doc.key.includes('/../') || !doc.key.includes('/')) throw new Error('Invalid document manifest.');
    doc.key = clinic + doc.key.slice(doc.key.indexOf('/'));
    if (documentKeys.has(doc.key)) throw new Error('Duplicate document manifest key.');
    documentKeys.add(doc.key);
  }
  for (const key of requiredKeys) if (!documentKeys.has(key)) throw new Error('Every linked clinical document needs a local file in the document manifest.');
  return { records, audits, documents };
}
async function main() {
  if (command === 'from-sqlite') {
    const { DatabaseSync } = await import('node:sqlite');
    const input = requireValue(option('input'), '--input SQLite database');
    const sourceOwner = requireValue(option('source-owner'), '--source-owner');
    const output = requireValue(option('output'), '--output');
    const db = new DatabaseSync(input, { readOnly: true });
    const records = db.prepare('SELECT id,kind,data,created FROM records WHERE owner=? ORDER BY created DESC').all(sourceOwner);
    const audits = db.prepare('SELECT id,action,record_id,created FROM audits WHERE owner=? ORDER BY created DESC').all(sourceOwner);
    db.close();
    const snapshot = { format: 'physioflow-snapshot-v1', records, audits, documents: [], sourceOwner };
    await fs.writeFile(output, JSON.stringify(snapshot, null, 2), { mode: 0o600, flag: 'wx' });
    console.log(`Exported ${records.length} records and ${audits.length} audits locally. Add document manifest before importing linked documents.`);
    return;
  }
  if (command === 'export') {
    const output = requireValue(option('output'), '--output');
    const { db, bucket } = await sdk(), ref = db.collection('clinics').doc(clinic);
    const snapshot = await db.runTransaction(async tx => {
      const [meta, records, audits] = await Promise.all([tx.get(ref), tx.get(ref.collection('records')), tx.get(ref.collection('audits'))]);
      if (!meta.exists || meta.data().migrationState === 'importing') throw new Error('Clinic is unavailable or being imported.');
      return { format: 'physioflow-snapshot-v1', clinic, version: meta.data().version, records: records.docs.map(d => d.data()), audits: audits.docs.map(d => d.data()), documents: [] };
    });
    const documentsDir = option('documents-dir');
    if (documentsDir) {
      if (!bucket) throw new Error('FIREBASE_STORAGE_BUCKET is required to export documents.');
      await fs.mkdir(documentsDir, { recursive: true });
      for (const key of new Set(snapshot.records.filter(r => r.data.documentKey).map(r => r.data.documentKey))) {
        const filename = createHash('sha256').update(key).digest('hex');
        const destination = path.resolve(documentsDir, filename);
        const [contents] = await bucket.file(key).download();
        await fs.writeFile(destination, contents, { mode: 0o600, flag: 'wx' });
        snapshot.documents.push({ key, path: path.relative(path.dirname(path.resolve(output)), destination) });
      }
    }
    await fs.writeFile(output, JSON.stringify(snapshot, null, 2), { mode: 0o600, flag: 'wx' });
    console.log(`Exported ${snapshot.records.length} records and ${snapshot.audits.length} audits.`);
    return;
  }
  if (command !== 'import') throw new Error('Usage: node scripts/firebase-data.mjs from-sqlite|export|import --input file --output file [--apply --confirm-project project-id]');
  const input = path.resolve(requireValue(option('input'), '--input'));
  const snapshot = validate(JSON.parse(await fs.readFile(input, 'utf8')));
  const documents = [];
  for (const doc of snapshot.documents) {
    const absolute = path.resolve(path.dirname(input), doc.path), content = await fs.readFile(absolute);
    if (content.length > 10 * 1024 * 1024) throw new Error('Document exceeds clinic size limit.');
    documents.push({ ...doc, content });
  }
  console.log(`Validated ${snapshot.records.length} records, ${snapshot.audits.length} audits, ${documents.length} documents.`);
  if (!args.includes('--apply')) { console.log('Dry run only. No Firebase access or writes occurred.'); return; }
  const { db, bucket, projectId } = await sdk();
  if (option('confirm-project') !== projectId) throw new Error('--confirm-project must exactly match FIREBASE_PROJECT_ID.');
  if (documents.length && !bucket) throw new Error('FIREBASE_STORAGE_BUCKET is required to transfer linked documents.');
  const ref = db.collection('clinics').doc(clinic);
  const fingerprint = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
  await db.runTransaction(async tx => {
    const [current, records, audits] = await Promise.all([tx.get(ref), tx.get(ref.collection('records').limit(1)), tx.get(ref.collection('audits').limit(1))]);
    if (current.data()?.migrationState === 'importing' && current.data()?.migrationFingerprint === fingerprint) return;
    if (!records.empty || !audits.empty) throw new Error('Import requires an empty clinic. Existing data will never be overwritten.');
    if (current.data()?.migrationState === 'importing') throw new Error('A different migration is pending.');
    tx.set(ref, { owner: clinic, email: requireValue(process.env.CLINIC_OWNER_EMAIL, 'CLINIC_OWNER_EMAIL'), version: current.data()?.version || 0, created: current.data()?.created || new Date().toISOString(), migrationState: 'importing', migrationFingerprint: fingerprint });
  });
  // A retry of the same snapshot is idempotent. Failed imports keep the clinic locked.
  const writes = [...snapshot.records.map(row => [ref.collection('records').doc(row.id), row]), ...snapshot.audits.map(row => [ref.collection('audits').doc(row.id), row])];
  for (let i = 0; i < writes.length; i += 400) {
    const batch = db.batch();
    for (const [target, row] of writes.slice(i, i + 400)) batch.set(target, row);
    await batch.commit();
  }
  for (const doc of documents) await bucket.file(doc.key).save(doc.content, { resumable: false, metadata: { contentType: doc.contentType || 'application/octet-stream', cacheControl: 'private, no-store' } });
  const [records, audits] = await Promise.all([ref.collection('records').get(), ref.collection('audits').get()]);
  if (records.size !== snapshot.records.length || audits.size !== snapshot.audits.length) throw new Error('Import count verification failed. Clinic remains locked.');
  await db.runTransaction(async tx => {
    const current = await tx.get(ref);
    if (current.data()?.migrationFingerprint !== fingerprint) throw new Error('Migration lock changed.');
    tx.update(ref, { migrationState: 'ready', version: Number(current.data().version || 0) + 1, migratedAt: new Date().toISOString() });
  });
  console.log('Import complete; clinic unlocked after count verification.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
