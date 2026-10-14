export function validContactDate(value) {
 const date = new Date(String(value) + 'T00:00:00Z');
 return /^\d{4}-\d{2}-\d{2}$/.test(value || '') && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function clinicDate(now = Date.now()) { return new Date(now + 330 * 60000).toISOString().slice(0, 10); }
export function e164(phone) {
 const n = String(phone || '').replace(/[\s()-]/g, '');
 if (!/^\+[1-9]\d{7,14}$/.test(n)) throw new Error('Patient phone must include country code in international format.');
 return n;
}
export function contactConsent(patient, channel, now = Date.now()) {
 const date = patient?.data?.['Consent Date'];
 return patient?.kind === 'Patients' && patient.data[channel === 'voice' ? 'Voice Call Consent' : 'WhatsApp Consent'] === 'Yes'
  && validContactDate(date) && date <= clinicDate(now) && Boolean(patient.data['Consent Evidence']?.trim());
}
export function allowedContactRole(role) { return ['Super Admin', 'Clinic Admin', 'Receptionist'].includes(role); }
export function appointmentTime(appointment) {
 const d = appointment?.data;
 if (!d || !validContactDate(d.Date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(d.Time || '')) throw new Error('Appointment date or time is invalid.');
 return new Date(d.Date + 'T' + d.Time + ':00+05:30').getTime();
}
export function assertContactAppointment(appointment, now = Date.now()) {
 if (!appointment || appointment.kind !== 'Appointments' || !['Scheduled', 'Confirmed'].includes(appointment.data?.Status)) throw new Error('Only scheduled or confirmed appointments can receive reminders.');
 if (appointmentTime(appointment) <= now) throw new Error('Appointment is in the past.');
}
export function reminderDue(appointment, now, leadHours, windowMinutes) {
 try {
  assertContactAppointment(appointment, now);
  const due = appointmentTime(appointment) - leadHours * 3600000;
  return due <= now && now < due + windowMinutes * 60000;
 } catch { return false; }
}
// Stronger delivery evidence wins even when Meta delivers events out of order.
export function nextDeliveryStatus(current, incoming, previousTime = 0, eventTime = 0) {
 const rank = {preparing: 0, requesting: 0, needs_review: 0, accepted: 1, sent: 2, failed: 3, delivered: 4, read: 5};
 if (!['sent', 'failed', 'delivered', 'read'].includes(incoming)) return current;
 if (incoming === 'failed' && eventTime < previousTime) return current;
 return (rank[incoming] ?? -1) > (rank[current] ?? -1) ? incoming : current;
}
export function contactPayload(channel, appointment, number, config) {
 const d = appointment.data;
 if (channel === 'voice') return {assistantId: config.assistantId, phoneNumberId: config.phoneNumberId, customer: {number}, assistantOverrides: {variableValues: {appointmentDate: d.Date, appointmentTime: d.Time}}};
 return {messaging_product: 'whatsapp', to: number.replace(/^\+/, ''), type: 'template', template: {name: config.template, language: {code: config.language}, components: [{type: 'body', parameters: [{type: 'text', text: d.Date}, {type: 'text', text: d.Time}]}]}};
}
