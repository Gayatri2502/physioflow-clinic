import {z} from 'zod';
import {createHash} from 'node:crypto';
import {actor,ClinicError,fail,visible} from '../../../../services/server';
import {getFirestore} from '../../../../lib/firebase-admin';
import {eventParameters,eventFingerprint} from '../../../../lib/communications/events.mjs';
import {derive} from '../../../../services/domain/workflows';
import {validOrigin} from '../../../../services/auth/policy';
import {allowedContactRole,contactConsent} from '../../../../lib/communications/core.mjs';
const input=z.object({event:z.enum(['payment_due','package_balance','visit_feedback','service_disruption','requested_plan_reminder']),recordId:z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),confirmed:z.literal(true)});
export const runtime='nodejs';
export async function POST(req:Request){try{
 if(!validOrigin(req))throw new ClinicError('Invalid request origin.',403);
 const user=await actor();if(!allowedContactRole(user.role))throw new ClinicError('Your role cannot request clinic messages.',403);
 const parsed=input.safeParse(await req.json());if(!parsed.success)throw new ClinicError('Select a supported clinic event and record.');
 const {event,recordId}=parsed.data,db=getFirestore(),clinic=db.collection('clinics').doc(user.owner);
 const result=await db.runTransaction(async tx=>{
 const root=await tx.get(clinic),snapshot=await tx.get(clinic.collection('records'));
 if(root.data()?.migrationState==='importing')throw new ClinicError('Clinic migration in progress.',503);
 const records=snapshot.docs.map(x=>({...x.data(),id:x.id})) as any[];
 const record=records.find(x=>x.id===recordId);
 if(!record||!visible(records,user).some(x=>x.id===recordId))throw new ClinicError('Record not found.',404);
 const patient=records.find(x=>x.id===record.data.patientId&&x.kind==='Patients');
 if(!contactConsent(patient,'whatsapp'))throw new ClinicError('Patient WhatsApp consent is required.',403);
 try{eventParameters(event,derive(records).find(x=>x.id===recordId),derive(records));}catch(e){throw new ClinicError((e as Error).message);}
 const fingerprint=eventFingerprint(record),key=createHash('sha256').update([recordId,event,fingerprint].join('|')).digest('hex');
 const ref=clinic.collection('messageOutbox').doc(key),existing=await tx.get(ref);
 if(existing.exists)return {ok:true,status:existing.data()!.status};
 tx.create(ref,{event,recordId,patientId:record.data.patientId,fingerprint,status:'pending',created:new Date().toISOString(),expiresAt:new Date(Date.now()+86400000).toISOString(),requestedBy:user.email});return {ok:true,status:'pending'};
 });return Response.json(result,{headers:{'Cache-Control':'no-store'}});
}catch(error){return fail(error)}}
