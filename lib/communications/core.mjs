export function e164(phone){const n=String(phone||'').replace(/[\s()-]/g,'');if(!/^\+[1-9]\d{7,14}$/.test(n))throw new Error('Patient phone must include country code in international format.');return n;}
export function contactConsent(patient,channel){return patient?.data?.[channel==='voice'?'Voice Call Consent':'WhatsApp Consent']==='Yes'&&/^\d{4}-\d{2}-\d{2}$/.test(patient?.data?.['Consent Date']||'')&&Boolean(patient?.data?.['Consent Evidence']?.trim());}
export function allowedContactRole(role){return ['Super Admin','Clinic Admin','Receptionist'].includes(role);}
export function assertContactAppointment(appointment){if(!appointment||appointment.kind!=='Appointments'||!['Scheduled','Confirmed'].includes(appointment.data.Status))throw new Error('Only scheduled or confirmed appointments can receive reminders.');if(!/^\d{4}-\d{2}-\d{2}$/.test(appointment.data.Date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(appointment.data.Time))throw new Error('Appointment date or time is invalid.');const time=new Date(appointment.data.Date+'T'+appointment.data.Time+':00+05:30').getTime();if(!Number.isFinite(time)||time<=Date.now())throw new Error('Appointment is in the past.');}
export function contactPayload(channel,appointment,number,config){
 const d=appointment.data;
 if(channel==='voice')return {assistantId:config.assistantId,phoneNumberId:config.phoneNumberId,customer:{number},assistantOverrides:{variableValues:{appointmentDate:d.Date,appointmentTime:d.Time}}};
 return {messaging_product:'whatsapp',to:number.replace(/^\+/,''),type:'template',template:{name:config.template,language:{code:config.language},components:[{type:'body',parameters:[{type:'text',text:d.Date},{type:'text',text:d.Time}]}]}};
}
