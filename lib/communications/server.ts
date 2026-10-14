import {appointmentTemplate} from './template-registry';
import {createHash} from 'node:crypto';
import {getFirestore} from '../firebase-admin';
import {actor, ClinicError} from '../../services/server';
import {clinicId, assertDocumentId} from '../../db/schema';
import {e164, contactConsent, allowedContactRole, assertContactAppointment, contactPayload, reminderDue, clinicDate, nextDeliveryStatus} from './core.mjs';

type Channel = 'voice' | 'whatsapp';
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export function communicationsConfig() {
 return {
  voice: {enabled: process.env.VAPI_ENABLED === 'true' && Boolean(process.env.VAPI_PRIVATE_KEY && process.env.VAPI_ASSISTANT_ID && process.env.VAPI_PHONE_NUMBER_ID), key: process.env.VAPI_PRIVATE_KEY || '', assistantId: process.env.VAPI_ASSISTANT_ID || '', phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID || ''},
  whatsapp: {enabled: process.env.WHATSAPP_ENABLED === 'true' && Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && /^v\d+\.\d+$/.test(process.env.WHATSAPP_GRAPH_VERSION || '')), key: process.env.WHATSAPP_ACCESS_TOKEN || '', phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '', template: 'physioflow_appointment_reminder_v1', language: process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'en', version: process.env.WHATSAPP_GRAPH_VERSION || '', businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || ''},
 };
}
export function whatsappTrackingEnabled() {
 return Boolean(process.env.WHATSAPP_APP_SECRET && process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_BUSINESS_ACCOUNT_ID);
}
export function reminderSettings() {
 const integer = (name: string, fallback: number, min: number, max: number) => {
  const value = Number(process.env[name] || fallback);
  if (!Number.isInteger(value) || value < min || value > max) throw new ClinicError('Invalid automatic reminder configuration.', 503);
  return value;
 };
 return {enabled: process.env.WHATSAPP_AUTOMATIC_REMINDERS_ENABLED === 'true', leadHours: integer('WHATSAPP_REMINDER_LEAD_HOURS', 24, 1, 168), windowMinutes: integer('WHATSAPP_REMINDER_WINDOW_MINUTES', 60, 15, 180), batchSize: integer('WHATSAPP_REMINDER_BATCH_SIZE', 5, 1, 10)};
}
function eligible(appointment: any, patient: any, channel: Channel, now: number) {
 try { assertContactAppointment(appointment, now); } catch (e) { throw new ClinicError((e as Error).message); }
 if (!contactConsent(patient, channel, now)) throw new ClinicError('Record the patient’s consent for this contact channel before contacting them.', 403);
 try { return e164(patient.data.Phone); } catch (e) { throw new ClinicError((e as Error).message); }
}
function ensureClinic(snapshot: any) {
 if (!snapshot.exists) throw new ClinicError('Clinic access has not been configured.', 503);
 if (snapshot.data()?.migrationState === 'importing') throw new ClinicError('Clinic data migration is in progress.', 503);
}

async function sendContact(owner: string, appointmentId: string, channel: Channel, requestedBy: string, automatic = false) {
 assertDocumentId(appointmentId);
 const config = communicationsConfig()[channel];
 if (!config.enabled) throw new ClinicError(channel === 'voice' ? 'Voice calls need Vapi configuration.' : 'WhatsApp reminders need an approved Meta template and account configuration.', 503);
 const db = getFirestore(), clinic = db.collection('clinics').doc(owner), records = clinic.collection('records');
 if(channel==='whatsapp'){try{appointmentTemplate('+919999999999','2030-01-01','10:00');}catch(e){throw new ClinicError((e as Error).message,503);}}
 const reservation = await db.runTransaction(async tx => {
  ensureClinic(await tx.get(clinic));
  const appointmentDoc = await tx.get(records.doc(appointmentId));
  const appointment: any = appointmentDoc.exists ? {...appointmentDoc.data(), id: appointmentDoc.id} : null;
  try { assertContactAppointment(appointment); } catch (e) { throw new ClinicError((e as Error).message); }
  if (!appointment.data.patientId) throw new ClinicError('Appointment must link a patient.');
  assertDocumentId(appointment.data.patientId);
  const patient = (await tx.get(records.doc(appointment.data.patientId))).data();
  const now = Date.now(), number = eligible(appointment, patient, channel, now);
  const settings = automatic ? reminderSettings() : null;
  if (settings && (!settings.enabled || !reminderDue(appointment, now, settings.leadHours, settings.windowMinutes))) throw new ClinicError('Appointment is outside the reminder window.', 409);
  const key = Buffer.from([channel, appointmentId, appointment.data.Date, appointment.data.Time].join('|')).toString('base64url');
  const ref = clinic.collection('contactRequests').doc(key);
  const previous = await tx.get(ref);
  if (previous.exists && previous.data()?.status !== 'cancelled') throw new ClinicError('A contact request already exists for this appointment slot. Review its status before contacting the patient again.', 409);
  const created = new Date(now).toISOString();
  const request = {appointmentId, patientId: appointment.data.patientId, appointmentDate: appointment.data.Date, appointmentTime: appointment.data.Time, recipientHash: digest(number.slice(1)), phoneNumberId: config.phoneNumberId, channel, status: 'preparing', source: automatic ? 'automatic' : 'manual', created, requestedBy, attempts: Number(previous.data()?.attempts || 0) + 1};
  // Only a proven stop before provider dispatch can be attempted again.
  if (previous.exists) tx.set(ref, request); else tx.create(ref, request);
  tx.create(clinic.collection('audits').doc(), {owner, action: requestedBy + ' requested ' + channel + ' appointment reminder', record_id: appointmentId, created});
  return {ref, appointment, number};
 });
 // Recheck after reservation so cancellation, rescheduling and revoked consent stop a pending send.
 try {
  await db.runTransaction(async tx => {
   ensureClinic(await tx.get(clinic));
   const current = (await tx.get(records.doc(appointmentId))).data();
   const patient = (await tx.get(records.doc(reservation.appointment.data.patientId))).data();
   const request = await tx.get(reservation.ref);
   const now = Date.now(), number = eligible(current, patient, channel, now), previous = reservation.appointment.data;
   if (current?.data?.patientId !== previous.patientId || current?.data?.Date !== previous.Date || current?.data?.Time !== previous.Time || number !== reservation.number) throw new ClinicError('Appointment or contact details changed. Review the reminder.', 409);
   const settings = automatic ? reminderSettings() : null;
   if (settings && (!settings.enabled || !reminderDue(current, now, settings.leadHours, settings.windowMinutes))) throw new ClinicError('Automatic reminder is no longer due.', 409);
   if (request.data()?.status !== 'preparing') throw new ClinicError('Contact request is already being processed.', 409);
   tx.update(reservation.ref, {status: 'requesting', updated: new Date(now).toISOString()});
  });
 } catch (e) {
  await reservation.ref.update({status: 'cancelled', updated: new Date().toISOString()});
  throw e;
 }
 try {
  const url = channel === 'voice' ? 'https://api.vapi.ai/call' : `https://graph.facebook.com/${communicationsConfig().whatsapp.version}/${encodeURIComponent(config.phoneNumberId)}/messages`;
  const response = await fetch(url, {method: 'POST', headers: {Authorization: 'Bearer ' + config.key, 'Content-Type': 'application/json'}, body: JSON.stringify(channel==='whatsapp'?appointmentTemplate(reservation.number,reservation.appointment.data.Date,reservation.appointment.data.Time):contactPayload(channel, reservation.appointment, reservation.number, config)), signal: AbortSignal.timeout(15000)});
  if (!response.ok) throw new Error('Provider rejected the request.');
  const result: any = await response.json(), providerId = channel === 'voice' ? result.id : result.messages?.[0]?.id;
  if (typeof providerId !== 'string' || !providerId || providerId.length > 512) throw new Error('Missing provider identifier.');
  let recipientHash = digest(reservation.number.slice(1));
  if (channel === 'whatsapp' && result.contacts !== undefined) {
   const contact = Array.isArray(result.contacts) && result.contacts.find((x: any) => typeof x.input === 'string' && /^\+?[1-9]\d{7,14}$/.test(x.input) && x.input.replace(/^\+/, '') === reservation.number.slice(1));
   if (!contact || typeof contact.wa_id !== 'string' || !/^[1-9]\d{7,14}$/.test(contact.wa_id)) throw new Error('Provider recipient does not match the request.');
   recipientHash = digest(contact.wa_id);
  }
  const status = await db.runTransaction(async tx => {
   const request = await tx.get(reservation.ref), data = request.data()!;
   const messageRef = clinic.collection('contactMessages').doc(digest(providerId));
   const existing = channel === 'whatsapp' ? await tx.get(messageRef) : null;
   const receipt = channel === 'whatsapp' ? (await tx.get(clinic.collection('contactReceipts').doc(digest(providerId)))).data() : null;
   if (existing?.exists && existing.data()?.requestKey !== reservation.ref.id) throw new Error('Provider identifier reused.');
   let status = ['preparing', 'requesting', 'needs_review'].includes(data.status) ? 'accepted' : data.status;
   const patch: any = {providerId, recipientHash, status, updated: new Date().toISOString()};
   if (receipt && receipt.recipientHash === recipientHash && receipt.phoneNumberId === data.phoneNumberId && receipt.expiresAt > patch.updated && receipt.eventTime >= Date.parse(data.created) - 300000) {
    status = nextDeliveryStatus(status, receipt.status, data.deliveryTime || 0, receipt.eventTime);
    Object.assign(patch, {status, deliveryTime: receipt.eventTime, deliveryUpdated: new Date(receipt.eventTime).toISOString(), errorCodes: status === 'failed' ? receipt.errorCodes : []});
   }
   if (channel === 'whatsapp') tx.set(messageRef, {requestKey: reservation.ref.id});
   tx.update(reservation.ref, patch);
   return status;
  });
  return {ok: true, status, message: channel === 'voice' ? 'Vapi accepted the call request. Check its dashboard for the call result.' : status === 'accepted' ? 'Meta accepted the message request. Delivery is not yet confirmed.' : 'WhatsApp reminder status: ' + status + '.'};
 } catch {
  // A timeout can still mean the provider sent the message. Never retry automatically.
  await db.runTransaction(async tx => {
   const request = await tx.get(reservation.ref);
   if (request.data()?.status === 'requesting') tx.update(reservation.ref, {status: 'needs_review', updated: new Date().toISOString()});
  });
  throw new ClinicError('Contact request could not be confirmed. Review the provider dashboard before retrying to avoid contacting the patient twice.', 502);
 }
}
export async function initiateContact(p: {appointmentId: string; channel: Channel; confirmed: true}) {
 const a = await actor();
 if (!allowedContactRole(a.role)) throw new ClinicError('Your role cannot contact patients.', 403);
 return sendContact(a.owner, p.appointmentId, p.channel, a.email);
}
export async function contactHistory(appointmentId: string) {
 assertDocumentId(appointmentId);
 const a = await actor();
 if (!allowedContactRole(a.role)) throw new ClinicError('Your role cannot view contact requests.', 403);
 const clinic = getFirestore().collection('clinics').doc(a.owner);
 if ((await clinic.collection('records').doc(appointmentId).get()).data()?.kind !== 'Appointments') throw new ClinicError('Appointment was not found.', 404);
 const result = await clinic.collection('contactRequests').where('appointmentId', '==', appointmentId).get();
 return result.docs.map(doc => {
  const d = doc.data();
  return {id: doc.id, channel: d.channel, status: d.status, source: d.source || 'manual', appointmentDate: d.appointmentDate || '', appointmentTime: d.appointmentTime || '', created: d.created, updated: d.updated || d.created, deliveryUpdated: d.deliveryUpdated || '', errorCodes: d.errorCodes || []};
 }).sort((a, b) => b.created.localeCompare(a.created)).slice(0, 20);
}

export async function pruneExpiredReceipts() {
 const db = getFirestore(), clinic = db.collection('clinics').doc(clinicId());
 const expired = await clinic.collection('contactReceipts').where('expiresAt', '<=', new Date().toISOString()).limit(100).get();
 let removed = 0;
 for (const receipt of expired.docs) {
  const deleted = await db.runTransaction(async tx => {
   const current = await tx.get(receipt.ref);
   if (current.data()?.expiresAt <= new Date().toISOString()) {tx.delete(receipt.ref); return true;}
   return false;
  });
  if (deleted) removed++;
 }
 return removed;
}
export async function runAutomaticReminders() {
 const settings = reminderSettings(), db = getFirestore(), clinic = db.collection('clinics').doc(clinicId());
 // Receipt expiry cleanup runs even while automatic sends are paused.
 const summary = {enabled: settings.enabled, accepted: 0, needsReview: 0, skipped: 0, remaining: 0, receiptsRemoved: await pruneExpiredReceipts()};
 if (!settings.enabled) return summary;
 if (!communicationsConfig().whatsapp.enabled || !whatsappTrackingEnabled()) throw new ClinicError('Configure WhatsApp sending and signed delivery webhooks before enabling automatic reminders.', 503);
 ensureClinic(await clinic.get());
 const now = Date.now(), last = now + settings.leadHours * 3600000, first = last - settings.windowMinutes * 60000;
 const days = [...new Set([clinicDate(first), clinicDate(last)])];
 const candidates: any[] = [];
 for (const day of days) {
  const result = await clinic.collection('records').where('kind', '==', 'Appointments').where('data.Date', '==', day).limit(501).get();
  if (result.size > 500) throw new ClinicError('Reminder scan exceeds 500 appointments on one day. Split the schedule before enabling automation.', 503);
  candidates.push(...result.docs.map(doc => ({...doc.data(), id: doc.id})).filter(x => reminderDue(x, now, settings.leadHours, settings.windowMinutes)));
 }
 candidates.sort((a, b) => (a.data.Date + a.data.Time).localeCompare(b.data.Date + b.data.Time));
 let attempts = 0;
 for (const appointment of candidates) {
  // Invalid consent and existing requests do not consume the send budget.
  if (attempts >= settings.batchSize) { summary.remaining++; continue; }
  try { await sendContact(clinic.id, appointment.id, 'whatsapp', 'automatic-reminder-job', true); summary.accepted++; attempts++; }
  catch (e) {
   if (e instanceof ClinicError && [400, 403, 409].includes(e.status)) summary.skipped++;
   else if (e instanceof ClinicError && e.status === 502) { summary.needsReview++; attempts++; }
   else throw e;
  }
 }
 return summary;
}

export type WhatsAppStatus = {id: string; status: string; recipient_id: string; timestamp: string; errors?: {code: number}[]};
export async function recordWhatsAppStatus(event: WhatsAppStatus, phoneNumberId: string) {
 const eventTime = Number(event.timestamp) * 1000, now = Date.now();
 if (!Number.isSafeInteger(eventTime) || eventTime < 0 || eventTime > now + 300000) throw new ClinicError('Invalid delivery timestamp.');
 if (!['sent', 'delivered', 'read', 'failed'].includes(event.status)) return;
 const db = getFirestore(), clinic = db.collection('clinics').doc(clinicId());
 const receiptRef = clinic.collection('contactReceipts').doc(digest(event.id)), messageRef = clinic.collection('contactMessages').doc(digest(event.id));
 await db.runTransaction(async tx => {
  const [receipt, mapping] = await Promise.all([tx.get(receiptRef), tx.get(messageRef)]);
  const requestRef = mapping.exists ? clinic.collection('contactRequests').doc(mapping.data()!.requestKey) : null;
  const request = requestRef ? await tx.get(requestRef) : null;
  const data = request?.data();
  const recipientHash = digest(event.recipient_id), previous = receipt.data();
  if (data && (data.channel !== 'whatsapp' || data.providerId !== event.id || data.recipientHash !== recipientHash || data.phoneNumberId !== phoneNumberId || eventTime < Date.parse(data.created) - 300000)) return;
  if (previous && (previous.recipientHash !== recipientHash || previous.phoneNumberId !== phoneNumberId)) return;
  const status = nextDeliveryStatus(previous?.status || 'accepted', event.status, previous?.eventTime || 0, eventTime);
  const errorCodes = event.errors?.map(x => x.code).slice(0, 5) || [];
  if (!previous || status !== previous.status) tx.set(receiptRef, {status, recipientHash, phoneNumberId, eventTime, errorCodes: status === 'failed' ? errorCodes : [], expiresAt: new Date(now + 7 * 86400000).toISOString()});
  if (!data || !requestRef) return;
  const next = nextDeliveryStatus(data.status, event.status, data.deliveryTime || 0, eventTime);
  if (next !== data.status) tx.update(requestRef, {status: next, deliveryTime: eventTime, deliveryUpdated: new Date(eventTime).toISOString(), updated: new Date(now).toISOString(), errorCodes: next === 'failed' ? errorCodes : []});
 });
}
