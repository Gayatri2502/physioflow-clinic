import {queueChangedMessages} from '../lib/communications/event-queue.mjs';
import { getFirebaseUser } from '../app/firebase-auth';
import { OWNER_EMAIL } from '../config/clinic';
import { visibleRecords } from './domain/access';
import { clinicRef, getDb } from '../db';
import { clinicId, assertDocumentId, type Mutation } from '../db/schema';
import type { Actor, ClinicRecord } from '../types/clinic';
export { putRecord, deleteRecord, auditRecord } from '../db/schema';
export class ClinicError extends Error { constructor(message: string, public status = 400) { super(message); } }
export const database = getDb;
export async function actor(): Promise<Actor> {
  const u = await getFirebaseUser();
  if (!u) throw new ClinicError('Please sign in to your clinic.', 401);
  const owner = clinicId();
  const ref = clinicRef(owner);
  const clinic = await ref.get();
  if (clinic.data()?.migrationState === 'importing') throw new ClinicError('Clinic data migration is in progress. Please retry later.', 503);
  const ownerEmail = (process.env.CLINIC_OWNER_EMAIL || OWNER_EMAIL).toLowerCase();
  if (u.email.toLowerCase() === ownerEmail) {
    await database().runTransaction(async tx => {
      const current = await tx.get(ref);
      if (current.data()?.migrationState === 'importing') throw new ClinicError('Clinic migration is in progress.', 503);
      if (!current.exists) tx.create(ref, { owner, email: ownerEmail, version: 0, created: new Date().toISOString() });
    });
    return { ...u, name: u.displayName, owner, role: 'Super Admin', therapist: '' };
  }
  if (!clinic.exists) throw new ClinicError('Clinic access has not been configured.', 403);
  if (clinic.data()?.migrationState === 'importing') throw new ClinicError('Clinic migration is in progress.', 503);
  // Admin SDK runs server-side; clinic subcollection bounds prevent cross-clinic reads.
  const staff = await ref.collection('records').where('kind', '==', 'Staff').get();
  const member = staff.docs.map(x => x.data().data).find(x => x.Email?.toLowerCase() === u.email.toLowerCase() && x.Status === 'Active');
  if (!member) throw new ClinicError('You do not have access to this clinic.', 403);
  return { ...u, name: u.displayName, owner, role: member.Role, therapist: member.Therapist || '', patientId: member.patientId || '' };
}
export async function readAll(owner:string):Promise<ClinicRecord[]>{const snapshot=await clinicRef(owner).collection('records').orderBy('created','desc').get();const records:ClinicRecord[]=snapshot.docs.map(x=>({...x.data(),id:x.id}) as ClinicRecord);return records.map(x=>{const d={...x.data};if(x.kind==='Billing'&&d.openingPaid===undefined)d.openingPaid=Number(d['Amount Paid']||0);if(x.kind==='Packages'&&d.openingSessions===undefined)d.openingSessions=Number(d['Sessions Completed']||0);for(const [label,kind,key]of [['Patient','Patients','patientId'],['Therapist','Doctors','doctorId'],['Department','Departments','departmentId'],['Invoice','Billing','invoiceId']]){if(!d[key]&&d[label]){const linked=records.find(r=>r.kind===kind&&(r.data.Name===d[label]||r.id===d[label]));if(linked)d[key]=linked.id;}}return {...x,data:d}});}

export const visible = visibleRecords;
export function fail(e: unknown) {
  return Response.json({ error: e instanceof ClinicError ? e.message : 'Clinic service is unavailable. Please retry.' }, { status: e instanceof ClinicError ? e.status : 503, headers:{'Cache-Control':'private, no-store'} });
}
export async function readAudits(owner: string) {
  const snapshot = await clinicRef(owner).collection('audits').orderBy('created', 'desc').limit(200).get();
  return snapshot.docs.map(doc => doc.data());
}
export async function revision(owner: string) {
  return Number((await clinicRef(owner).get()).data()?.version || 0);
}
/** Clinic-wide optimistic revision keeps cross-record business checks atomic.
 * All reads precede all writes, and every mutation (including webhooks) increments version.
 * Atomic operations use native read/write transactions instead of analytical pipelines.
 */
export async function atomicBatch(owner: string, version: number, mutations: Mutation[]) {
  if (mutations.length > 450) throw new ClinicError('Too many records changed at once. Split the operation into smaller groups.', 400);
  const ref = clinicRef(owner);
  for (const mutation of mutations.filter(x=>x.type!=='counter')) assertDocumentId(mutation.type === 'put' ? mutation.record.id : mutation.type === 'delete' ? mutation.id : mutation.type==='audit' ? mutation.audit.id : 'counter');
  return database().runTransaction(async tx => {
    const current = await tx.get(ref);
    if (!current.exists) throw new ClinicError('Clinic access has not been configured.', 403);
    if (current.data()?.migrationState === 'importing') throw new ClinicError('Clinic data migration is in progress. Please retry later.', 503);
    if (Number(current.data()?.version || 0) !== version) throw new ClinicError('Another staff member changed clinic records. Reload and try again.', 409);
    const previousRecords=await tx.get(ref.collection('records'));
    const before=previousRecords.docs.map(x=>({...x.data(),id:x.id}));
    queueChangedMessages(tx,ref,before,mutations,version+1);
    const counters:Record<string,number>={};
    for (const mutation of mutations) {
      if (mutation.type === 'put') tx.set(ref.collection('records').doc(mutation.record.id), JSON.parse(JSON.stringify(mutation.record)));
      else if (mutation.type === 'delete') tx.delete(ref.collection('records').doc(mutation.id));
      else if(mutation.type==='counter'){if(!Number.isSafeInteger(mutation.value)||mutation.value<=Number(current.data()?.[mutation.field]||0))throw new ClinicError('Identifier allocation changed. Retry.',409);counters[mutation.field]=mutation.value;}
      else tx.create(ref.collection('audits').doc(mutation.audit.id), { ...mutation.audit, owner });
    }
    tx.update(ref, { version: version + 1, ...counters });
  });
}

export async function nextIdentifier(owner:string,kind:'Patients'|'Billing',records:ClinicRecord[]){
 const field:'patientSequence'|'invoiceSequence'=kind==='Patients'?'patientSequence':'invoiceSequence',prefix=kind==='Patients'?'PT':'INV',year=new Date().getFullYear();
 const current=Number((await clinicRef(owner).get()).data()?.[field]||0);
 const previous=records.filter(x=>x.kind===kind).map(x=>String(x.data[kind==='Patients'?'UHID':'Invoice Number']||'')).filter(x=>new RegExp('^'+prefix+'-\\d{4}-\\d+$').test(x)).map(x=>Number(x.split('-').pop()));
 const value=Math.max(current,0,...previous)+1;
 return {label:prefix+'-'+year+'-'+String(value).padStart(5,'0'),mutation:{type:'counter' as const,field,value}};
}
