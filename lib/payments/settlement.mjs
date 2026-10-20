import {queueChangedMessages} from '../communications/event-queue.mjs';
import {assertCapturedPayment} from './razorpay-core.mjs';
function reject(message,status=409){const e=new Error(message);e.status=status;throw e;}
/** Every ledger, order and revision mutation is committed in one Firestore transaction. */
export async function postCapturedPayment({refs:r,payment,orderId,owner,date,now,derive}){
 const orderRef=r.orders.doc(orderId),paymentRef=r.records.doc('razorpay_'+payment.id);
 return r.db.runTransaction(async tx=>{
  const [clinicSnapshot,orderSnapshot,existing,snapshot]=await Promise.all([tx.get(r.clinic),tx.get(orderRef),tx.get(paymentRef),tx.get(r.records)]);
  const order=orderSnapshot.data();if(!order)reject('Payment order not found.',404);
  if(existing.exists){if(existing.data()?.data?.razorpayOrderId!==orderId)reject('Payment binding mismatch.');return {ok:true,alreadyPosted:true};}
  if(order.status==='posted')reject('This order has already been paid.');
  try{assertCapturedPayment(payment,{...order,paymentId:payment.id});}catch{reject('Payment details do not match this order.');}
  const records=derive(snapshot.docs.map(x=>({...x.data(),id:x.id}))),invoice=records.find(x=>x.id===order.invoiceId&&x.kind==='Billing');
  if(records.some(x=>x.kind==='CashClosing'&&x.data.Date===date&&x.data.Status==='Closed'))reject('This accounting day is closed. An administrator must reopen it before posting the payment.');
  if(!invoice||invoice.data.patientId!==order.patientId||Math.round(Number(invoice.data.Balance)*100)<payment.amount)reject('Invoice changed after checkout. The captured payment requires clinic reconciliation.');
  const record={id:paymentRef.id,kind:'Payments',created:now,data:{Patient:invoice.data.Patient,patientId:order.patientId,Invoice:order.invoiceId,invoiceId:order.invoiceId,Amount:payment.amount/100,Date:date,'Payment Method':'Online / Razorpay',Status:'Paid',Notes:'Verified Razorpay captured payment',razorpayPaymentId:payment.id,razorpayOrderId:orderId}};
  queueChangedMessages(tx,r.clinic,records,[{type:'put',record}],Number(clinicSnapshot.data()?.version||0)+1);
  tx.create(paymentRef,record);tx.update(orderRef,{status:'posted',paymentId:payment.id,postedAt:now});tx.set(r.clinic,{version:Number(clinicSnapshot.data()?.version||0)+1},{merge:true});
  tx.create(r.audits.doc(),{owner,action:'Razorpay captured payment posted',record_id:paymentRef.id,created:now});return {ok:true,alreadyPosted:false};
 });
}
