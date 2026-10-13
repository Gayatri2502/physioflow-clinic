import type { ClinicRecord } from '../types/clinic';

/** Native Firestore: clinics/{stableClinicId}, with records and audits subcollections.
 * Record references live in data.*Id and are validated by domain workflows.
 * Browser access is denied; every request uses the server's clinic-role boundary.
 */
export type ClinicDocument = { owner: string; email: string; version: number; created: string };
export type AuditDocument = { id: string; owner: string; action: string; record_id: string; created: string };
export type StoredRecord = ClinicRecord;
export type Mutation =
  | { type: 'put'; record: ClinicRecord }
  | { type: 'delete'; id: string }
  | { type: 'counter'; field: 'patientSequence' | 'invoiceSequence'; value: number }
  | { type: 'audit'; audit: Omit<AuditDocument, 'owner'> };

export const putRecord = (record: ClinicRecord): Mutation => ({ type: 'put', record });
export const deleteRecord = (id: string): Mutation => ({ type: 'delete', id });
export const auditRecord = (action: string, recordId: string, created = new Date().toISOString()): Mutation => ({
  type: 'audit', audit: { id: crypto.randomUUID(), action, record_id: recordId, created },
});
export function clinicId() {
  const id = process.env.FIREBASE_CLINIC_ID || 'physioflow';
  assertDocumentId(id);
  return id;
}
export function assertDocumentId(id: string) {
  if (!id || id.includes('/') || id === '.' || id === '..' || /^__.*__$/.test(id)) throw new Error('Invalid document identifier.');
}
