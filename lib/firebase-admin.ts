import { applicationDefault, cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore as adminFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

/** Server-only SDK. App Hosting uses its runtime service account; never ship credentials to browsers. */
export function firebaseAdminApp(): App {
  const existing = getApps().find(app => app.name === '[DEFAULT]');
  if (existing) return existing;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error('FIREBASE_PROJECT_ID is required.');
  const credentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  return initializeApp({
    projectId,
    credential: credentials ? cert(JSON.parse(credentials)) : applicationDefault(),
    ...(process.env.FIREBASE_STORAGE_BUCKET ? { storageBucket: process.env.FIREBASE_STORAGE_BUCKET } : {}),
  });
}
export const getAdminAuth = () => getAuth(firebaseAdminApp());
export function getFirestore() {
  return adminFirestore(firebaseAdminApp(), process.env.FIREBASE_DATABASE_ID || '(default)');
}
export function getStorageBucket() {
  const bucket = process.env.FIREBASE_STORAGE_BUCKET;
  if (!bucket) throw new Error('FIREBASE_STORAGE_BUCKET is required for document uploads.');
  return getStorage(firebaseAdminApp()).bucket(bucket);
}
