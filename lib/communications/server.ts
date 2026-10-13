import {getFirestore} from '../firebase-admin';
import {actor,ClinicError} from '../../services/server';
import {e164,contactConsent,allowedContactRole,assertContactAppointment,contactPayload} from './core.mjs';
export function communicationsConfig(){return {voice:{enabled:process.env.VAPI_ENABLED==='true'&&Boolean(process.env.VAPI_PRIVATE_KEY&&process.env.VAPI_ASSISTANT_ID&&process.env.VAPI_PHONE_NUMBER_ID),key:process.env.VAPI_PRIVATE_KEY||'',assistantId:process.env.VAPI_ASSISTANT_ID||'',phoneNumberId:process.env.VAPI_PHONE_NUMBER_ID||''},whatsapp:{enabled:process.env.WHATSAPP_ENABLED==='true'&&Boolean(process.env.WHATSAPP_ACCESS_TOKEN&&process.env.WHATSAPP_PHONE_NUMBER_ID&&process.env.WHATSAPP_REMINDER_TEMPLATE&&process.env.WHATSAPP_GRAPH_VERSION),key:process.env.WHATSAPP_ACCESS_TOKEN||'',phoneNumberId:process.env.WHATSAPP_PHONE_NUMBER_ID||'',template:process.env.WHATSAPP_REMINDER_TEMPLATE||'',language:process.env.WHATSAPP_TEMPLATE_LANGUAGE||'en',version:process.env.WHATSAPP_GRAPH_VERSION||''}};}
export async function initiateContact(p:{appointmentId:string;channel:'voice'|'whatsapp';confirmed:true}){
 const a=await actor();if(!allowedContactRole(a.role))throw new ClinicError('Your role cannot contact patients.',403);
 const config=communicationsConfig()[p.channel];if(!config.enabled)throw new ClinicError(p.channel==='voice'?'Voice calls need Vapi configuration.':'WhatsApp reminders need an approved Meta template and account configuration.',503);
 const db=getFirestore(),clinic=db.collection('clinics').doc(a.owner),records=clinic.collection('records');const aptDoc=await records.doc(p.appointmentId).get(),appointment=aptDoc.exists?{...aptDoc.data(),id:aptDoc.id}:null;
 try{assertContactAppointment(appointment);}catch(e){throw new ClinicError((e as Error).message);}
 const apt=appointment as any;if(!apt.data.patientId)throw new ClinicError('Appointment must link a patient.');const patientDoc=await records.doc(apt.data.patientId).get(),patient=patientDoc.exists?patientDoc.data():null;
 if(!contactConsent(patient,p.channel))throw new ClinicError('Record the patient’s consent for this contact channel before contacting them.',403);
 let number:string;try{number=e164(patient?.data?.Phone);}catch(e){throw new ClinicError((e as Error).message);}
 const requestKey=Buffer.from([p.channel,apt.id,apt.data.Date,apt.data.Time].join('|')).toString('base64url'),requestRef=clinic.collection('contactRequests').doc(requestKey),now=new Date().toISOString();
 // One deliberate reminder per channel/appointment slot. An uncertain provider request is never retried automatically.
 await db.runTransaction(async tx=>{const previous=await tx.get(requestRef);if(previous.exists)throw new ClinicError('A contact request already exists for this appointment slot. Review its status before contacting the patient again.',409);tx.create(requestRef,{appointmentId:apt.id,patientId:apt.data.patientId,channel:p.channel,status:'requesting',created:now,requestedBy:a.email});});
 try{
  const url=p.channel==='voice'?'https://api.vapi.ai/call':`https://graph.facebook.com/${communicationsConfig().whatsapp.version}/${encodeURIComponent(config.phoneNumberId)}/messages`;
  if(p.channel==='whatsapp'&&!/^v\d+\.\d+$/.test(communicationsConfig().whatsapp.version))throw new Error('Invalid configured Meta Graph API version.');
  const response=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+config.key,'Content-Type':'application/json'},body:JSON.stringify(contactPayload(p.channel,apt,number,config)),signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error('Provider rejected or could not complete the contact request.');const result:any=await response.json();const providerId=p.channel==='voice'?result.id:result.messages?.[0]?.id;if(!providerId)throw new Error('Provider response did not contain a request identifier.');
  await requestRef.update({status:'accepted',providerId,updated:new Date().toISOString()});await clinic.collection('audits').add({owner:a.owner,action:a.email+' requested '+p.channel+' appointment reminder',record_id:apt.id,created:now});
  return {ok:true,status:'accepted',message:p.channel==='voice'?'Vapi accepted the call request.':'Meta accepted the message request. Delivery is not yet confirmed.'};
 }catch{await requestRef.update({status:'needs_review',updated:new Date().toISOString()});throw new ClinicError('Contact request could not be confirmed. Review the provider dashboard before retrying to avoid contacting the patient twice.',502);}
}
