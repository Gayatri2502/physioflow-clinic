import { applicationDefault, cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore as adminFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { Firestore } from '@google-cloud/firestore';
import { Storage } from '@google-cloud/storage';
import { IdentityPoolClient } from 'google-auth-library';
import { getVercelOidcToken } from '@vercel/oidc';

let federatedClient: IdentityPoolClient | undefined;
let federatedDatabase: Firestore | undefined;
let federatedStorage: Storage | undefined;
function workloadIdentity() {
  const audience = process.env.GCP_WORKLOAD_IDENTITY_AUDIENCE;
  const email = process.env.GCP_SERVICE_ACCOUNT_EMAIL;
  if (!audience || !email) return undefined;
  if (!federatedClient) federatedClient = new IdentityPoolClient({
    audience,
    subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
    token_url: 'https://sts.googleapis.com/v1/token',
    service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${email}:generateAccessToken`,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    subject_token_supplier: { getSubjectToken: () => getVercelOidcToken() },
  });
  return federatedClient;
}

/** Vercel uses scoped, short-lived federation. Local/Google runtimes retain ADC. */
export function firebaseAdminApp(): App {
  const existing = getApps().find(app => app.name === '[DEFAULT]');
  if (existing) return existing;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error('FIREBASE_PROJECT_ID is required.');
  const credentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const identity = workloadIdentity();
  return initializeApp({
    projectId,
    credential: identity ? { async getAccessToken() {
      const token = await identity.getAccessToken();
      if (!token.token) throw new Error('Production workload identity did not return an access token.');
      return { access_token: token.token, expires_in: Math.max(1, Math.floor(((identity.credentials.expiry_date || Date.now() + 300000) - Date.now()) / 1000)) };
    } } : credentials ? cert(JSON.parse(credentials)) : applicationDefault(),
    ...(process.env.FIREBASE_STORAGE_BUCKET ? { storageBucket: process.env.FIREBASE_STORAGE_BUCKET } : {}),
  });
}
export const getAdminAuth = () => getAuth(firebaseAdminApp());
export function getFirestore() {
  const identity = workloadIdentity();
  if (!identity) return adminFirestore(firebaseAdminApp(), process.env.FIREBASE_DATABASE_ID || '(default)');
  // Firestore Admin's wrapper only accepts ADC/cert; pass the refreshing external
  // account client directly to the underlying Google client for federation.
  return federatedDatabase ||= new Firestore({ projectId: process.env.FIREBASE_PROJECT_ID, databaseId: process.env.FIREBASE_DATABASE_ID || '(default)', authClient: identity });
}
export function getStorageBucket() {
  const bucket = process.env.FIREBASE_STORAGE_BUCKET;
  if (!bucket) throw new Error('FIREBASE_STORAGE_BUCKET is required for document uploads.');
  const identity = workloadIdentity();
  if (!identity) return getStorage(firebaseAdminApp()).bucket(bucket);
  federatedStorage ||= new Storage({ projectId: process.env.FIREBASE_PROJECT_ID, authClient: identity });
  return federatedStorage.bucket(bucket);
}
