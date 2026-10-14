/** Clinic event → submitted Meta template. Exact components are synced from Meta. */
export const clinicTemplates = Object.freeze(Object.fromEntries([
 ['appointment_reminder','UTILITY'],['booking_confirmation','UTILITY'],['appointment_rescheduled','UTILITY'],['appointment_cancelled','UTILITY'],['missed_appointment','UTILITY'],
 ['invoice_ready','UTILITY'],['payment_receipt','UTILITY'],['payment_due','UTILITY'],['refund_processed','UTILITY'],['package_balance','UTILITY'],
 ['requested_plan_reminder','UTILITY'],['documents_ready','UTILITY'],['visit_feedback','UTILITY'],['service_disruption','UTILITY'],
 ['clinic_updates','MARKETING'],['rebooking_invitation','MARKETING'],
].map(([event,category])=>[event,Object.freeze({name:'physioflow_'+event+'_v1',language:'en',category})])));

export function templatePayload(event, number, values, definition, {marketingConsent=false}={}) {
 const mapping=clinicTemplates[event];
 if(!mapping)throw new Error('Unknown clinic message event.');
 if(!definition||definition.name!==mapping.name||definition.language!==mapping.language||definition.status!=='APPROVED')throw new Error('Sync an approved Meta template before sending this event.');
 if(definition.category==='MARKETING'&&!marketingConsent)throw new Error('Marketing messages require separate marketing consent.');
 if(!['UTILITY','MARKETING'].includes(definition.category))throw new Error('Unsupported clinic template category.');
 const parts=definition.components||[];
 if(parts.some(x=>!['BODY','FOOTER'].includes(x.type)))throw new Error('This template contains unsupported headers or buttons. Review its mapping.');
 const body=parts.find(x=>x.type==='BODY');
 if(!body)throw new Error('Template body is missing.');
 const indices=[...new Set([...body.text.matchAll(/\{\{(\d+)\}\}/g)].map(x=>Number(x[1])))].sort((a,b)=>a-b);
 if(indices.some((x,i)=>x!==i+1)||/\{\{[^\d][^}]*\}\}/.test(body.text))throw new Error('Unsupported template parameter format.');
 if(!Array.isArray(values)||values.length!==indices.length||values.some(x=>typeof x!=='string'||!x.trim()||x.length>1024||/[\r\n\t]/.test(x)))throw new Error('Template parameter count or text is invalid.');
 if(!/^\+[1-9]\d{7,14}$/.test(number))throw new Error('Use an international recipient number.');
 return {messaging_product:'whatsapp',to:number.slice(1),type:'template',template:{name:mapping.name,language:{code:mapping.language},...(values.length?{components:[{type:'body',parameters:values.map(text=>({type:'text',text}))}]}:{})}};
}
