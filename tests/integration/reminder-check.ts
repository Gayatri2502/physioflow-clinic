import {dispatchClinicMessages} from '../../lib/communications/event-dispatch';
import {queueChangedMessages} from '../../lib/communications/event-queue.mjs';
import {POST as voiceStatusPOST} from '../../app/api/communications/voice-status/route';
import assert from 'node:assert/strict';
import {createHmac, createHash} from 'node:crypto';
import {FakeFirestore} from './fake-firestore';
import {initiateContact, contactHistory, runAutomaticReminders} from '../../lib/communications/server';
import {GET as historyGET, POST as contactPOST} from '../../app/api/communications/route';
import {GET as verifyGET, POST as webhookPOST} from '../../app/api/communications/whatsapp/webhook/route';
import {POST as jobPOST} from '../../app/api/communications/reminders/route';
import {reminderDue, contactConsent, assertContactAppointment} from '../../lib/communications/core.mjs';

const fixedNow = Date.parse('2030-01-01T04:30:00Z'); // 10:00 India
Date.now = () => fixedNow;
const originalDate = Date;
// new Date() timestamps and Date.now must share the same deterministic clock.
(globalThis as any).Date = class extends originalDate {constructor(...args: any[]) {super(...(args.length ? args : [fixedNow]) as [any]);} static now() {return fixedNow;}};
let db: FakeFirestore, sends = 0, count = 0;
function reset() {
 db = new FakeFirestore(); (globalThis as any).__firestore = db;
 (globalThis as any).__actor = {owner: 'physioflow', email: 'owner@example.test', role: 'Super Admin'};
 Object.assign(process.env, {FIREBASE_CLINIC_ID: 'physioflow', WHATSAPP_ENABLED: 'true', WHATSAPP_ACCESS_TOKEN: 'mock-token', WHATSAPP_PHONE_NUMBER_ID: 'sender-1', WHATSAPP_GRAPH_VERSION: 'v99.0', WHATSAPP_REMINDER_TEMPLATE: 'test_reminder', WHATSAPP_TEMPLATE_LANGUAGE: 'en', WHATSAPP_BUSINESS_ACCOUNT_ID: 'business-1', WHATSAPP_APP_SECRET: 'mock-app-secret', WHATSAPP_WEBHOOK_VERIFY_TOKEN: 'mock-verification-token', REMINDER_JOB_SECRET: 'mock-job-secret-with-at-least-32-characters', WHATSAPP_EVENT_MESSAGES_ENABLED:'false', WHATSAPP_AUTOMATIC_REMINDERS_ENABLED: 'true', WHATSAPP_REMINDER_LEAD_HOURS: '24', WHATSAPP_REMINDER_WINDOW_MINUTES: '60', WHATSAPP_REMINDER_BATCH_SIZE: '5'});
 db.store.set('clinics/physioflow', {version: 0});
 patient(); appointment('a1'); sends = 0;
 globalThis.fetch = async () => {sends++; return Response.json({messages: [{id: 'wamid.' + sends}]});};
}
function patient(patch: any = {}) {db.store.set('clinics/physioflow/records/p1', {kind: 'Patients', data: {Phone: '+919999999999', 'WhatsApp Consent': 'Yes', 'Consent Date': '2029-12-31', 'Consent Evidence': 'Signed appointment contact consent', ...patch}});}
function appointment(id: string, patch: any = {}) {db.store.set('clinics/physioflow/records/' + id, {kind: 'Appointments', data: {patientId: 'p1', Date: '2030-01-02', Time: '09:30', Status: 'Scheduled', ...patch}});}
function requests() {return [...db.store.entries()].filter(([key]) => key.includes('/contactRequests/')).map(([, data]) => data);}
const send = (id = 'a1') => initiateContact({appointmentId: id, channel: 'whatsapp', confirmed: true});
const event = (status = 'delivered', id = 'wamid.1', recipient = '919999999999', time = fixedNow) => ({id, status, recipient_id: recipient, timestamp: String(Math.floor(time / 1000))});
function payload(status: any = event(), phone = 'sender-1', business = 'business-1') {
 return {object: 'whatsapp_business_account', entry: [{id: business, changes: [{field: 'messages', value: {messaging_product: 'whatsapp', metadata: {phone_number_id: phone}, statuses: [status]}}]}]};
}
async function webhook(body: any, signature?: string) {
 const raw = typeof body === 'string' ? body : JSON.stringify(body);
 const sig = signature ?? 'sha256=' + createHmac('sha256', 'mock-app-secret').update(raw).digest('hex');
 return webhookPOST(new Request('https://clinic.test/api/communications/whatsapp/webhook', {method: 'POST', headers: {'x-hub-signature-256': sig}, body: raw}));
}
async function check(name: string, action: () => Promise<any> | void) {reset(); await action(); console.log('PASS ' + name); count++;}
async function main() {
 await check('due policy uses India time and bounded 24-hour window', () => {
  const a: any = db.store.get('clinics/physioflow/records/a1');
  assert.equal(reminderDue(a, fixedNow, 24, 60), true);
  assert.equal(reminderDue(a, fixedNow - 3600000, 24, 60), false);
  assert.equal(reminderDue(a, fixedNow + 3600000, 24, 60), false);
  assert.throws(() => assertContactAppointment({kind: 'Appointments', data: {Date: '2030-02-31', Time: '10:00', Status: 'Scheduled'}}, fixedNow));
  for (const date of ['2030-02-31', '2030-01-02']) assert.equal(contactConsent({kind: 'Patients', data: {'WhatsApp Consent': 'Yes', 'Consent Date': date, 'Consent Evidence': 'yes'}}, 'whatsapp', fixedNow), false);
 });
 await check('cron requires its own secret and ignores caller-selected clinic/time', async () => {
  assert.equal((await jobPOST(new Request('https://clinic.test/api/communications/reminders', {method: 'POST'}))).status, 401);
  assert.equal(sends, 0);
  const r = await jobPOST(new Request('https://clinic.test/api/communications/reminders', {method: 'POST', headers: {Authorization: 'Bearer ' + process.env.REMINDER_JOB_SECRET}, body: JSON.stringify({clinic: 'other', now: '2040-01-01'})}));
  assert.equal(r.status, 200); assert.equal((await r.json()).accepted, 1); assert.equal(requests()[0].source, 'automatic');
 });
 await check('automatic sends are off by default', async () => {
  delete process.env.WHATSAPP_AUTOMATIC_REMINDERS_ENABLED;
  assert.equal((await runAutomaticReminders()).enabled, false); assert.equal(sends, 0);
 });
 await check('scheduler requires sending and tracking configuration', async () => {
  delete process.env.WHATSAPP_APP_SECRET;
  await assert.rejects(runAutomaticReminders(), (e: any) => e.status === 503); assert.equal(sends, 0);
 });
 await check('repeated cron and manual sends share duplicate suppression', async () => {
  assert.equal((await runAutomaticReminders()).accepted, 1);
  assert.equal((await runAutomaticReminders()).accepted, 0);
  await assert.rejects(send(), (e: any) => e.status === 409); assert.equal(sends, 1);
 });
 await check('concurrent manual and cron reserve only one request', async () => {
  await Promise.allSettled([send(), runAutomaticReminders(), send()]);
  assert.equal(sends, 1); assert.equal(requests().length, 1);
 });
 await check('revoked consent, wrong patient kind and invalid phone block sends', async () => {
  patient({'WhatsApp Consent': 'No'}); await assert.rejects(send(), (e: any) => e.status === 403);
  patient(); db.store.get('clinics/physioflow/records/p1').kind = 'Staff'; await assert.rejects(send(), (e: any) => e.status === 403);
  patient({Phone: '9999999999'}); await assert.rejects(send()); assert.equal(sends, 0);
 });
 await check('cancelled and past appointments are skipped by scheduler', async () => {
  appointment('a1', {Status: 'Cancelled'}); appointment('old', {Date: '2029-01-01'});
  assert.equal((await runAutomaticReminders()).accepted, 0); assert.equal(sends, 0);
 });
 for (const change of ['consent', 'cancel', 'reschedule', 'phone']) await check('change after reservation stops send: ' + change, async () => {
  const original = db.runTransaction.bind(db); let runs = 0;
  db.runTransaction = async (callback: any) => {const result = await original(callback); if (++runs === 1) {
   if (change === 'consent') patient({'WhatsApp Consent': 'No'});
   if (change === 'cancel') appointment('a1', {Status: 'Cancelled'});
   if (change === 'reschedule') appointment('a1', {Time: '11:00'});
   if (change === 'phone') patient({Phone: '+918888888888'});
  } return result as any;};
  await assert.rejects(send()); assert.equal(sends, 0); assert.equal(requests()[0].status, 'cancelled');
 });
 await check('migration lock blocks manual and automatic requests', async () => {
  db.store.get('clinics/physioflow').migrationState = 'importing';
  await assert.rejects(send(), (e: any) => e.status === 503);
  await assert.rejects(runAutomaticReminders(), (e: any) => e.status === 503); assert.equal(sends, 0);
 });
 await check('timeout is held for review and is never retried', async () => {
  globalThis.fetch = async () => {sends++; throw new Error('timeout');};
  await assert.rejects(send(), (e: any) => e.status === 502);
  assert.equal(requests()[0].status, 'needs_review');
  await runAutomaticReminders(); assert.equal(sends, 1);
 });
 await check('batch skips historical and existing rows so later due appointments progress', async () => {
  process.env.WHATSAPP_REMINDER_BATCH_SIZE = '1';
  for (let n = 0; n < 600; n++) appointment('old' + n, {Date: '2029-01-01'});
  appointment('a2'); await send();
  assert.equal((await runAutomaticReminders()).accepted, 1); assert.equal(sends, 2);
 });
 await check('webhook verification requires exact token and returns plain challenge', async () => {
  const ok = await verifyGET(new Request('https://clinic.test/?hub.mode=subscribe&hub.verify_token=mock-verification-token&hub.challenge=123'));
  assert.equal(ok.status, 200); assert.equal(await ok.text(), '123');
  assert.equal((await verifyGET(new Request('https://clinic.test/?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=123'))).status, 403);
 });
 await check('tampered/missing signatures and oversized bodies are rejected', async () => {
  assert.equal((await webhook(payload(), 'sha256=' + '0'.repeat(64))).status, 401);
  assert.equal((await webhookPOST(new Request('https://clinic.test/', {method: 'POST', body: '{}'}))).status, 401);
  assert.equal((await webhook('x'.repeat(256 * 1024 + 1))).status, 413); assert.equal(db.store.size, 3);
 });
 await check('sender and business account binding discard unrelated signed events', async () => {
  await send(); await webhook(payload(event(), 'wrong')); await webhook(payload(event(), 'sender-1', 'wrong'));
  assert.equal(requests()[0].status, 'accepted');
 });
 await check('recipient binding ignores wrong-recipient callback without poisoning later receipt', async () => {
  await send(); await webhook(payload(event('read', 'wamid.1', '918888888888')));
  assert.equal(requests()[0].status, 'accepted'); await webhook(payload()); assert.equal(requests()[0].status, 'delivered');
 });
 await check('early receipt is reconciled after send response persists', async () => {
  globalThis.fetch = async () => {sends++; assert.equal((await webhook(payload(event('read')))).status, 200); return Response.json({messages: [{id: 'wamid.1'}]});};
  assert.equal((await send()).status, 'read'); assert.equal(requests()[0].status, 'read');
 });
 await check('duplicate and out-of-order callbacks cannot regress read/delivered', async () => {
  await send(); await webhook(payload(event('read'))); await webhook(payload(event('sent'))); await webhook(payload(event('failed'))); await webhook(payload(event('read')));
  assert.equal(requests()[0].status, 'read');
 });
 await check('failure stores only numeric codes; stronger delivered evidence clears failure', async () => {
  await send(); await webhook(payload({...event('failed'), errors: [{code: 131000, message: 'private provider error'}]}));
  assert.equal(requests()[0].status, 'failed'); assert.deepEqual(requests()[0].errorCodes, [131000]);
  assert.equal(JSON.stringify([...db.store.values()]).includes('private provider error'), false);
  await webhook(payload(event('delivered'))); assert.equal(requests()[0].status, 'delivered'); assert.deepEqual(requests()[0].errorCodes, []);
 });
 await check('pre-send stop can retry after consent is corrected', async () => {
  const original = db.runTransaction.bind(db); let runs = 0;
  db.runTransaction = async (callback: any) => {const result = await original(callback); if (++runs === 1) patient({'WhatsApp Consent': 'No'}); return result as any;};
  await assert.rejects(send()); assert.equal(requests()[0].status, 'cancelled');
  db.runTransaction = original; patient(); await send();
  assert.equal(sends, 1); assert.equal(requests()[0].attempts, 2);
 });
 await check('provider-normalized WhatsApp ID binds early receipt to the submitted recipient', async () => {
  globalThis.fetch = async () => {sends++; await webhook(payload(event('delivered', 'wamid.1', '919999999990'))); return Response.json({messages: [{id: 'wamid.1'}], contacts: [{input: '919999999999', wa_id: '919999999990'}]});};
  assert.equal((await send()).status, 'delivered');
  await webhook(payload(event('read', 'wamid.1', '919999999990'))); assert.equal(requests()[0].status, 'read');
 });
 await check('mismatched provider contact response cannot bind a different recipient', async () => {
  globalThis.fetch = async () => {sends++; return Response.json({messages: [{id: 'wamid.1'}], contacts: [{input: '918888888888', wa_id: '918888888888'}]});};
  await assert.rejects(send(), (e: any) => e.status === 502); assert.equal(requests()[0].status, 'needs_review');
 });
 await check('signed webhook cleans expired receipts without a configured job', async () => {
  const key = 'clinics/physioflow/contactReceipts/expired';
  db.store.set(key, {expiresAt: new Date(fixedNow - 1000).toISOString()});
  delete process.env.REMINDER_JOB_SECRET;
  await webhook(payload()); assert.equal(db.store.has(key), false);
 });
 await check('inbound patient message text is discarded', async () => {
  const p: any = payload(); delete p.entry[0].changes[0].value.statuses; p.entry[0].changes[0].value.messages = [{text: {body: 'private diagnosis'}}];
  assert.equal((await webhook(p)).status, 200); assert.equal(db.store.size, 3);
 });
 await check('receipt metadata is cleaned after seven days even with automatic sends disabled', async () => {
  const old = {...event('sent', 'old-wamid'), timestamp: String((fixedNow - 8 * 86400000) / 1000)};
  await webhook(payload(old));
  const key = 'clinics/physioflow/contactReceipts/' + createHash('sha256').update('old-wamid').digest('hex');
  db.store.get(key).expiresAt = new Date(fixedNow - 1000).toISOString();
  process.env.WHATSAPP_AUTOMATIC_REMINDERS_ENABLED = 'false';
  assert.equal((await runAutomaticReminders()).receiptsRemoved, 1); assert.equal(db.store.has(key), false); assert.equal(sends, 0);
 });
 await check('history and sending require operational staff role', async () => {
  await send(); const history = await contactHistory('a1'); assert.equal(history[0].status, 'accepted'); assert.equal(JSON.stringify(history).includes('919999999999'), false);
  (globalThis as any).__actor.role = 'Patient';
  assert.equal((await historyGET(new Request('https://clinic.test/?appointmentId=a1'))).status, 403);
  assert.equal((await contactPOST(new Request('https://clinic.test/', {method: 'POST', body: JSON.stringify({appointmentId: 'a1', channel: 'whatsapp', confirmed: true})}))).status, 403);
  (globalThis as any).__actor = null; assert.equal((await historyGET(new Request('https://clinic.test/?appointmentId=a1'))).status, 401);
 });
 await check('clinic events reserve once and deliver with exact approved bindings',async()=>{
 process.env.WHATSAPP_EVENT_MESSAGES_ENABLED='true';
 const record={...db.store.get('clinics/physioflow/records/a1'),id:'a1',data:{...db.store.get('clinics/physioflow/records/a1').data,Status:'Confirmed'}};
 db.store.set('clinics/physioflow/records/a1',record);
 await db.runTransaction(async tx=>queueChangedMessages(tx,db.collection('clinics').doc('physioflow'),[],[{type:'put',record}],1));
 let parameters:any;globalThis.fetch=async(_url,options)=>{sends++;parameters=JSON.parse(String(options?.body));return Response.json({messages:[{id:'event-message'}]});};
 const results=await Promise.all([dispatchClinicMessages(),dispatchClinicMessages()]);assert.equal(results.reduce((n,r)=>n+r.accepted,0),1);assert.equal(sends,1);assert.equal(parameters.template.name,'physioflow_booking_confirmation_v1');assert.equal(parameters.template.components[0].parameters[0].text,'2030-01-02');
 });
 await check('clinic events stop after consent withdrawal or a changed record',async()=>{
 process.env.WHATSAPP_EVENT_MESSAGES_ENABLED='true';const record={...db.store.get('clinics/physioflow/records/a1'),id:'a1',data:{...db.store.get('clinics/physioflow/records/a1').data,Status:'Confirmed'}};
 db.store.set('clinics/physioflow/records/a1',record);await db.runTransaction(async tx=>queueChangedMessages(tx,db.collection('clinics').doc('physioflow'),[],[{type:'put',record}],1));patient({'WhatsApp Consent':'No'});assert.equal((await dispatchClinicMessages()).skipped,1);assert.equal(sends,0);
 });
 await check('clinic event uncertain outcomes are not retried',async()=>{
 process.env.WHATSAPP_EVENT_MESSAGES_ENABLED='true';const record={...db.store.get('clinics/physioflow/records/a1'),id:'a1',data:{...db.store.get('clinics/physioflow/records/a1').data,Status:'Confirmed'}};
 db.store.set('clinics/physioflow/records/a1',record);await db.runTransaction(async tx=>queueChangedMessages(tx,db.collection('clinics').doc('physioflow'),[],[{type:'put',record}],1));globalThis.fetch=async()=>{sends++;throw Error('Timeout')};assert.equal((await dispatchClinicMessages()).needsReview,1);await dispatchClinicMessages();assert.equal(sends,1);
 });
 await check('Vapi result review verifies clinic binding and stores only outcome metadata',async()=>{
 Object.assign(process.env,{VAPI_PRIVATE_KEY:'mock',VAPI_ASSISTANT_ID:'assistant',VAPI_PHONE_NUMBER_ID:'caller'});
 db.store.set('clinics/physioflow/contactRequests/voice1',{channel:'voice',providerId:'call1'});
 globalThis.fetch=async()=>Response.json({id:'call1',assistantId:'assistant',phoneNumberId:'caller',status:'ended',endedReason:'customer-ended-call',transcript:'private transcript'});
 const request=()=>new Request('https://clinic.test/api/communications/voice-status',{method:'POST',headers:{origin:'https://clinic.test','Content-Type':'application/json'},body:JSON.stringify({requestId:'voice1'})});
 assert.equal((await voiceStatusPOST(request())).status,200);assert.equal(db.store.get('clinics/physioflow/contactRequests/voice1').callStatus,'ended');assert.equal(JSON.stringify(db.store.get('clinics/physioflow/contactRequests/voice1')).includes('private transcript'),false);
 (globalThis as any).__actor.role='Patient';assert.equal((await voiceStatusPOST(request())).status,403);
 });
 console.log(count + ' mocked reminder checks passed; no external requests performed.');
}
main().catch(e => {console.error(e); process.exitCode = 1;});
