import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {templatePayload} from './templates.mjs';
export function appointmentTemplate(number:string,date:string,time:string) {
 let registry:any;
 try {registry=JSON.parse(readFileSync(join(process.cwd(),'integrations/whatsapp-templates.json'),'utf8'));}
 catch {throw new Error('Sync approved WhatsApp templates before enabling reminders.');}
 // Reminders remain operational utility messages. Do not send a reclassified marketing template automatically.
 const definition=registry.events?.appointment_reminder;
 if(definition?.category!=='UTILITY')throw new Error('Appointment reminder must be approved as a utility template.');
 return templatePayload('appointment_reminder',number,[date,time],definition);
}
