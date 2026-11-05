import {list as listBlobs} from '@vercel/blob';
import { timingSafeEqual } from 'node:crypto';
import { getAdminAuth, getFirestore } from '../../../lib/firebase-admin';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
 const expected=process.env.DEPLOYMENT_HEALTH_SECRET;
 const supplied=request.headers.get('authorization')?.replace(/^Bearer /,'') || '';
 const authorized=Boolean(expected&&supplied.length===expected.length&&timingSafeEqual(Buffer.from(supplied),Buffer.from(expected)));
 if(!authorized)return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}});
 try {
  await getAdminAuth().getUserByEmail(process.env.CLINIC_OWNER_EMAIL!);
  await getFirestore().collection('clinics').doc(process.env.FIREBASE_CLINIC_ID || 'physioflow').get();
  if(process.env.BLOB_READ_WRITE_TOKEN)await listBlobs({limit:1});
  return Response.json({ok:true,checks:{firebaseAuth:true,firestore:true,privateDocuments:Boolean(process.env.BLOB_READ_WRITE_TOKEN)}},{headers:{'Cache-Control':'no-store'}});
 } catch(error) {
  const code=error&&typeof error==='object'&&'code' in error?String(error.code):'backend-unavailable';
  console.error('Deployment backend readiness failed',{code});
  return Response.json({ok:false,code},{status:503,headers:{'Cache-Control':'no-store'}});
 }
}
