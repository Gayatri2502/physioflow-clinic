import {createHash} from 'node:crypto';
const money=value=>{const n=Number(value);if(!Number.isFinite(n)||n<0)throw Error('Invalid message amount.');return n.toFixed(2)};
const text=value=>{if(typeof value!=='string'||!value.trim())throw Error('Missing message reference.');return value};
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
export const eventFingerprint=record=>createHash('sha256').update(JSON.stringify(canonical(record))).digest('hex');
/** Values come only from persisted clinic records, never arbitrary client template parameters. */
export function eventParameters(event,record,records=[]){
 const d=record.data||{};
 if(['appointment_reminder','booking_confirmation','appointment_rescheduled','appointment_cancelled','missed_appointment','service_disruption'].includes(event)){
 if(record.kind!=='Appointments')throw Error('Appointment required.');
 if(event==='service_disruption'&&!['Scheduled','Confirmed'].includes(d.Status))throw Error('Active appointment required.');
 return [text(d.Date),text(d.Time)];
 }
 if(event==='invoice_ready'||event==='payment_due'){
 if(record.kind!=='Billing')throw Error('Invoice required.');
 if(event==='payment_due'&&!(Number(d.Balance)>0))throw Error('Invoice has no outstanding balance.');
 return event==='invoice_ready'?[text(d['Invoice Number']),money(Math.max(0,Number(d.Quantity||1)*Number(d.Rate||0)+(d.Items||[]).reduce((sum,item)=>sum+Number(item.Quantity||1)*Number(item.Rate||0),0)-Number(d.Discount||0))*(1+Number(d.Tax||0)/100))]:[money(d.Balance),text(d['Invoice Number']),text(d['Due Date'])];
 }
 if(['payment_receipt','refund_processed'].includes(event)){
 if(record.kind!=='Payments'||!['Paid','Partially Paid','Refunded'].includes(d.Status))throw Error('Posted payment required.');
 if((event==='refund_processed')!==(d.Status==='Refunded'))throw Error('Payment status does not match message.');
 const invoice=records.find(x=>x.id===d.invoiceId&&x.kind==='Billing');
 return [money(d.Amount),text(invoice?.data['Invoice Number']||d.Reference||record.id)];
 }
 if(event==='package_balance'){if(record.kind!=='Packages')throw Error('Package required.');return [String(Math.max(0,Number(d['Sessions Purchased'])-Number(d['Sessions Completed']||0))),text(d.Validity)];}
 if(event==='visit_feedback'){if(record.kind!=='Appointments'||d.Status!=='Completed')throw Error('Completed visit required.');return [text(d.Date)];}
 if(event==='documents_ready'){if(record.kind!=='Records'||d['Shared With Patient']!=='Yes'||!d.documentKey)throw Error('Shared document required.');return [];}
 if(event==='requested_plan_reminder'){if(record.kind!=='Plans'||d['Reminder Requested']!=='Yes')throw Error('Patient-requested plan reminder required.');return [];}
 if(['clinic_updates','rebooking_invitation'].includes(event)){if(record.kind!=='Patients'||d['Marketing Consent']!=='Yes')throw Error('Separate marketing consent required.');return [];}
 throw Error('Unknown clinic event.');
}
export function changedMessageEvents(before,after){
 const d=after.data||{},old=before?.data||{};
 if(after.kind==='Appointments'){
 if(d.Status==='Cancelled'&&old.Status!=='Cancelled')return ['appointment_cancelled'];
 if(d.Status==='No Show'&&old.Status!=='No Show')return ['missed_appointment'];
 if(before&&['Scheduled','Confirmed'].includes(d.Status)&&(old.Date!==d.Date||old.Time!==d.Time))return ['appointment_rescheduled'];
 if(d.Status==='Confirmed'&&(!before||old.Status!=='Confirmed'))return ['booking_confirmation'];

 }
 if(after.kind==='Billing'&&!before)return ['invoice_ready'];
 if(after.kind==='Payments'&&(!before||d.Status==='Refunded'&&old.Status!=='Refunded')&&['Paid','Partially Paid','Refunded'].includes(d.Status))return [d.Status==='Refunded'?'refund_processed':'payment_receipt'];
 if(after.kind==='Records'&&d['Shared With Patient']==='Yes'&&d.documentKey&&(!before||old.documentKey!==d.documentKey||old['Shared With Patient']!=='Yes'))return ['documents_ready'];
 return [];
}
