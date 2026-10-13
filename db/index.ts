import { getFirestore } from '../lib/firebase-admin';
import { assertDocumentId } from './schema';
export const getDb = getFirestore;
export function clinicRef(owner: string) {
  assertDocumentId(owner);
  return getFirestore().collection('clinics').doc(owner);
}
