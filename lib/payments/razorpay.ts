import {postCapturedPayment} from './settlement.mjs';
import {getFirestore} from '../firebase-admin';
import {ClinicError} from '../../services/server';
import {derive} from '../../services/domain/workflows';
import {canWrite} from '../../permissions/roles';
import type {Actor,ClinicRecord} from '../../types/clinic';
import {validSignature,assertCapturedPayment,amountPaise} from './razorpay-core.mjs';

export function paymentConfig(){return {enabled:process.env.RAZORPAY_ENABLED==='true'&&Boolean(process.env.RAZORPAY_KEY_ID&&process.env.RAZORPAY_KEY_SECRET&&process.env.RAZORPAY_WEBHOOK_SECRET),keyId:process.env.RAZORPAY_KEY_ID||'',secret:process.env.RAZORPAY_KEY_SECRET||'',webhookSecret:process.env.RAZORPAY_WEBHOOK_SECRET||''};}
function configured(){const c=paymentConfig();if(!c.enabled)throw new ClinicError('Online payments are not configured. Please contact the clinic for payment options.',503);return c;}
export function paymentAccess(a:Actor,invoice:ClinicRecord){if(invoice.kind!=='Billing'||!(canWrite(a.role,'Payments')||(a.role==='Patient'&&a.patientId===invoice.data.patientId)))throw new ClinicError('You cannot pay this invoice.',403);}
async function razorpay(path:string,body?:object):Promise<any>{const c=configured();const result=await fetch('https://api.razorpay.com/v1/'+path,{method:body?'POST':'GET',headers:{Authorization:'Basic '+Buffer.from(c.keyId+':'+c.secret).toString('base64'),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000),cache:'no-store'});if(!result.ok)throw new ClinicError('Payment provider is unavailable. Retry later or contact the clinic.',502);return result.json();}
function refs(owner:string){const db=getFirestore(),clinic=db.collection('clinics').doc(owner);return {db,clinic,records:clinic.collection('records'),orders:clinic.collection('paymentOrders'),audits:clinic.collection('audits')};}
function requireOpen(records:ClinicRecord[],date:string){if(records.some(x=>x.kind==='CashClosing'&&x.data.Date===date&&x.data.Status==='Closed'))throw new ClinicError('This accounting day is closed. An administrator must reopen it before posting the payment.',409);}
function snapshotRows(snapshot:any):ClinicRecord[]{return snapshot.docs.map((x:any)=>({...x.data(),id:x.id}));}
export async function createPaymentOrder(a:Actor,invoiceId:string){
  const c=configured(),r=refs(a.owner),snapshot=await r.records.get(),records=derive(snapshotRows(snapshot));
  const invoice=records.find(x=>x.id===invoiceId);if(!invoice)throw new ClinicError('Invoice not found.',404);paymentAccess(a,invoice);requireOpen(records,new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'}));
  const amount=amountPaise(invoice.data.Balance);const created=await razorpay('orders',{amount,currency:'INR',receipt:crypto.randomUUID(),partial_payment:false});
  if(!/^order_[a-zA-Z0-9]+$/.test(created.id)||created.amount!==amount||created.currency!=='INR')throw new ClinicError('Payment provider returned an invalid order.',502);
  // Record the clinic binding before exposing checkout. No amount/owner/patient comes from the browser.
  await r.orders.doc(created.id).create({id:created.id,owner:a.owner,invoiceId,patientId:invoice.data.patientId,amount,currency:'INR',status:'created',createdBy:a.email,created:new Date().toISOString()});
  return {orderId:created.id,amount,currency:'INR',keyId:c.keyId};
}
export async function settlePayment(owner:string,orderId:string,paymentId:string){
  const r=refs(owner),orderRef=r.orders.doc(orderId),initial=await orderRef.get();if(!initial.exists)throw new ClinicError('Payment order not found.',404);
  const payment=await razorpay('payments/'+encodeURIComponent(paymentId));
  try{assertCapturedPayment(payment,{...initial.data(),paymentId});}catch{throw new ClinicError('Payment capture is pending or payment details do not match. Please contact the clinic if your account was debited.',409);}
  // Post to today's clinic accounting day; provider creation time is not the capture date.
  const date=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'}),now=new Date().toISOString();
  try{return await postCapturedPayment({refs:r,payment,orderId,owner,date,now,derive});}catch(e:any){await r.db.runTransaction(async tx=>{const current=await tx.get(orderRef);if(current.exists&&current.data()?.status!=='posted')tx.update(orderRef,{status:'needs_reconciliation',paymentId,reviewReason:e.message,updated:now});});throw new ClinicError(e.message,e.status||503);}

}
export async function verifyCheckout(a:Actor,p:{orderId:string;paymentId:string;signature:string}){
  const r=refs(a.owner),order=await r.orders.doc(p.orderId).get();if(!order.exists)throw new ClinicError('Payment order not found.',404);
  const invoice=await r.records.doc(order.data()!.invoiceId).get();if(!invoice.exists)throw new ClinicError('Invoice not found.',404);paymentAccess(a,{...invoice.data(),id:invoice.id} as ClinicRecord);
  if(!validSignature(p.orderId+'|'+p.paymentId,p.signature,configured().secret))throw new ClinicError('Invalid payment signature.',400);
  return settlePayment(a.owner,p.orderId,p.paymentId);
}
export async function processWebhook(raw:string,signature:string|null){
  if(!validSignature(raw,signature,configured().webhookSecret))throw new ClinicError('Invalid webhook signature.',400);
  let event:any;try{event=JSON.parse(raw);}catch{throw new ClinicError('Invalid webhook body.',400);}
  if(event.event!=='payment.captured')return {ok:true,ignored:true};const payment=event.payload?.payment?.entity;
  if(!/^pay_[a-zA-Z0-9]+$/.test(payment?.id)||!/^order_[a-zA-Z0-9]+$/.test(payment?.order_id))throw new ClinicError('Invalid webhook payment.',400);
  // Dedicated deployment has one configured clinic; provider data cannot select another tenant.
  const {CLINIC_KEY}=await import('../../config/clinic');const owner=process.env.FIREBASE_CLINIC_ID||CLINIC_KEY;
  return settlePayment(owner,payment.order_id,payment.id);
}
