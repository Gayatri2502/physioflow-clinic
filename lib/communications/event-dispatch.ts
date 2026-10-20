import {derive} from '../../services/domain/workflows';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {getFirestore} from '../firebase-admin';
import {clinicId} from '../../db/schema';
import {ClinicError} from '../../services/server';
import {communicationsConfig,whatsappTrackingEnabled,recordWhatsAppStatus} from './server';
import {eventFingerprint,eventParameters} from './events.mjs';
import {templatePayload} from './templates.mjs';
import {contactConsent,e164} from './core.mjs';
export async function dispatchClinicMessages(){
 if(process.env.WHATSAPP_EVENT_MESSAGES_ENABLED!=='true')return {enabled:false,accepted:0,skipped:0,needsReview:0};
 const config=communicationsConfig().whatsapp;
 if(!config.enabled||!whatsappTrackingEnabled())throw new ClinicError('Configure WhatsApp sending and signed webhooks first.',503);
 let registry:any;try{registry=JSON.parse(readFileSync(join(process.cwd(),'integrations/whatsapp-templates.json'),'utf8'));}catch{throw new ClinicError('Sync approved templates first.',503);}
 const db=getFirestore(),clinic=db.collection('clinics').doc(clinicId());
 const pending=await clinic.collection('messageOutbox').where('status','==','pending').limit(5).get();
 const summary={enabled:true,accepted:0,skipped:0,needsReview:0};
 for(const item of pending.docs){
 const reservation=await db.runTransaction(async tx=>{
 const state=await tx.get(item.ref),root=await tx.get(clinic);
 if(root.data()?.migrationState==='importing')throw new ClinicError('Clinic migration in progress.',503);
 if(state.data()?.status!=='pending')return null;
 const event=state.data()!;
 const snapshot=await tx.get(clinic.collection('records'));
 const records=snapshot.docs.map(x=>({...x.data(),id:x.id})) as any[];
 const record=records.find(x=>x.id===event.recordId),patient=records.find(x=>x.id===event.patientId&&x.kind==='Patients');
 let payload:any;
 try{
 if(!event.expiresAt||event.expiresAt<=new Date().toISOString()||!record||record.data.patientId!==event.patientId||eventFingerprint(record)!==event.fingerprint||!contactConsent(patient,'whatsapp'))throw Error('Record changed or consent unavailable');
 const number=e164(patient.data.Phone);
 payload=templatePayload(event.event,number,eventParameters(event.event,derive(records).find(x=>x.id===record.id),derive(records)),registry.events[event.event]);
 }catch{tx.update(item.ref,{status:'skipped',updated:new Date().toISOString()});return null;}
 const requestKey='event_'+item.id,request=clinic.collection('contactRequests').doc(requestKey);
 tx.create(request,{channel:'whatsapp',event:event.event,recordId:event.recordId,patientId:event.patientId,status:'requesting',source:'clinic-event',created:new Date().toISOString(),phoneNumberId:config.phoneNumberId,recipientHash:createHash('sha256').update(payload.to).digest('hex')});
 tx.update(item.ref,{status:'requesting',updated:new Date().toISOString()});return {payload,request,recordId:event.recordId,patientId:event.patientId,fingerprint:event.fingerprint};
 });
 if(!reservation){summary.skipped++;continue;}
 // A second transaction catches edits and revoked consent after reservation.
 const ready=await db.runTransaction(async tx=>{
 const [root,record,patient,request]=await Promise.all([tx.get(clinic),tx.get(clinic.collection('records').doc(reservation.recordId)),tx.get(clinic.collection('records').doc(reservation.patientId)),tx.get(reservation.request)]);
 let eligible=false;try{eligible=root.data()?.migrationState!=='importing'&&request.data()?.status==='requesting'&&eventFingerprint({...record.data(),id:record.id})===reservation.fingerprint&&contactConsent(patient.data(),'whatsapp')&&e164(patient.data()?.data.Phone).slice(1)===reservation.payload.to;}catch{}
 if(!eligible){tx.update(reservation.request,{status:'cancelled',updated:new Date().toISOString()});tx.update(item.ref,{status:'skipped',updated:new Date().toISOString()});}return eligible;
 });
 if(!ready){summary.skipped++;continue;}
 try{
 const response=await fetch(`https://graph.facebook.com/${config.version}/${config.phoneNumberId}/messages`,{method:'POST',headers:{Authorization:'Bearer '+config.key,'Content-Type':'application/json'},body:JSON.stringify(reservation.payload),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('Provider rejected request');const data=await response.json();const id=data.messages?.[0]?.id;
 if(typeof id!=='string'||!id||id.length>512)throw Error('Invalid provider response');
 let recipient=reservation.payload.to;
 if(data.contacts!==undefined){const contact=Array.isArray(data.contacts)&&data.contacts.find((x:any)=>String(x.input).replace(/^\+/, '')===recipient);if(!contact||!/^\d{8,15}$/.test(contact.wa_id))throw Error('Recipient mismatch');recipient=contact.wa_id;}
 await db.runTransaction(async tx=>{tx.update(reservation.request,{status:'accepted',providerId:id,recipientHash:createHash('sha256').update(recipient).digest('hex'),updated:new Date().toISOString()});tx.create(clinic.collection('contactMessages').doc(createHash('sha256').update(id).digest('hex')),{requestKey:reservation.request.id});tx.update(item.ref,{status:'accepted',updated:new Date().toISOString()});});const receipt=(await clinic.collection('contactReceipts').doc(createHash('sha256').update(id).digest('hex')).get()).data();
 if(receipt&&receipt.expiresAt>new Date().toISOString())await recordWhatsAppStatus({id,status:receipt.status,recipient_id:recipient,timestamp:String(receipt.eventTime/1000)},config.phoneNumberId);
 summary.accepted++;
 }catch{
 await db.runTransaction(async tx=>{const current=await tx.get(reservation.request);if(current.data()?.status==='requesting')tx.update(reservation.request,{status:'needs_review',updated:new Date().toISOString()});tx.update(item.ref,{status:'needs_review',updated:new Date().toISOString()});});summary.needsReview++;
 }
 }
 return summary;
}
