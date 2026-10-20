import test from 'node:test';import assert from 'node:assert/strict';
import {eventParameters,changedMessageEvents,eventFingerprint} from '../lib/communications/events.mjs';
import {templatePayload} from '../lib/communications/templates.mjs';
import {readFileSync} from 'node:fs';
const registry=JSON.parse(readFileSync('integrations/whatsapp-templates.json','utf8'));
const appointment={id:'a',kind:'Appointments',data:{Date:'2030-01-01',Time:'10:00',Status:'Confirmed'}};
test('actual approved reminder, booking and cancellation parameter contracts',()=>{for(const event of ['appointment_reminder','booking_confirmation','appointment_rescheduled','appointment_cancelled','missed_appointment','service_disruption'])assert.equal(templatePayload(event,'+919999999999',eventParameters(event,appointment),registry.events[event]).template.components[0].parameters.length,2);});
test('invoice amounts include additional items, discounts and percentage tax',()=>{const invoice={id:'i',kind:'Billing',data:{'Invoice Number':'INV1',Rate:100,Quantity:2,Items:[{Rate:50,Quantity:2}],Discount:20,Tax:10}};assert.deepEqual(eventParameters('invoice_ready',invoice),['INV1','308.00']);});
test('transitions produce one appropriate event; unrelated edits do not notify',()=>{assert.deepEqual(changedMessageEvents(null,appointment),['booking_confirmation']);assert.deepEqual(changedMessageEvents(appointment,{...appointment,data:{...appointment.data,Time:'11:00'}}),['appointment_rescheduled']);assert.deepEqual(changedMessageEvents(appointment,appointment),[]);assert.deepEqual(changedMessageEvents(appointment,{...appointment,data:{...appointment.data,Status:'Cancelled'}}),['appointment_cancelled']);});
test('private documents and unposted payment must not notify',()=>{assert.deepEqual(changedMessageEvents(null,{kind:'Records',data:{documentKey:'x'}}),[]);assert.throws(()=>eventParameters('documents_ready',{kind:'Records',data:{documentKey:'x'}}));assert.throws(()=>eventParameters('payment_receipt',{kind:'Payments',data:{Status:'Pending'}}));});
test('fingerprints do not depend on Firestore key ordering',()=>assert.equal(eventFingerprint({id:'a',data:{x:1,y:2}}),eventFingerprint({data:{y:2,x:1},id:'a'})));

test('booking notices reject past or inactive appointments',()=>{assert.throws(()=>eventParameters('booking_confirmation',{...appointment,data:{...appointment.data,Date:'2020-01-01'}}));assert.throws(()=>eventParameters('booking_confirmation',{...appointment,data:{...appointment.data,Status:'Cancelled'}}));});
