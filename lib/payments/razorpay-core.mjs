import {createHmac,timingSafeEqual} from 'node:crypto';
export function validSignature(message,signature,secret){
  if(typeof signature!=='string'||!/^([a-f\d]{64})$/i.test(signature)||!secret)return false;
  return timingSafeEqual(Buffer.from(createHmac('sha256',secret).update(message).digest('hex'),'hex'),Buffer.from(signature,'hex'));
}
export function assertCapturedPayment(payment,order){
  if(payment?.id!==order.paymentId||payment.order_id!==order.id||payment.status!=='captured'||payment.captured!==true||payment.currency!=='INR'||payment.amount!==order.amount||!Number.isSafeInteger(payment.amount)||payment.amount<=0)throw new Error('Payment is not captured or does not match the clinic order.');
}
export function amountPaise(balance){const value=Math.round(Number(balance)*100);if(!Number.isSafeInteger(value)||value<100)throw new Error('Invoice balance must be at least ₹1 to pay online.');return value;}
export function paymentDate(timestamp){if(!Number.isFinite(timestamp)||timestamp<=0)throw new Error('Invalid payment capture timestamp.');return new Date(timestamp*1000).toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});}
