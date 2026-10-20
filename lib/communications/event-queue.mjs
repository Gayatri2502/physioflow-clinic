import {createHash} from 'node:crypto';
import {eventFingerprint,changedMessageEvents} from './events.mjs';
/** Runs in the same transaction as the clinical write. Sending is a separate operation. */
export function queueChangedMessages(tx,clinic,before,mutations,version){
 for(const mutation of mutations){
 if(mutation.type!=='put')continue;
 const record=mutation.record,previous=before.find(x=>x.id===record.id);
 for(const event of changedMessageEvents(previous,record)){
 const key=createHash('sha256').update([record.id,event,version].join('|')).digest('hex');
 tx.create(clinic.collection('messageOutbox').doc(key),{event,recordId:record.id,patientId:record.data.patientId||'',fingerprint:eventFingerprint(record),status:'pending',created:new Date().toISOString(),expiresAt:new Date(Date.now()+86400000).toISOString()});
 }
 }
}
