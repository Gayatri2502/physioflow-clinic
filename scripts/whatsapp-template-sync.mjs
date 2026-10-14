import {writeFileSync} from 'node:fs';
import {clinicTemplates} from '../lib/communications/templates.mjs';
const {WHATSAPP_ACCESS_TOKEN:token,WHATSAPP_BUSINESS_ACCOUNT_ID:account,WHATSAPP_GRAPH_VERSION:version}=process.env;
if(!token||!/^\d+$/.test(account||'')||!/^v\d+\.\d+$/.test(version||''))throw new Error('Configure the WhatsApp token, business account ID and Graph version.');
const definitions=[];let after;
do{
 const url=new URL(`https://graph.facebook.com/${version}/${account}/message_templates`);
 url.searchParams.set('fields','name,status,category,language,components');url.searchParams.set('limit','100');if(after)url.searchParams.set('after',after);
 const r=await fetch(url,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(15000)});
 const data=await r.json();if(!r.ok)throw new Error(`Meta template sync failed (HTTP ${r.status}, code ${data.error?.code||'unknown'}). Refresh the token if expired.`);
 if(!Array.isArray(data.data))throw new Error('Invalid Meta template response.');
 definitions.push(...data.data);after=data.paging?.next?data.paging?.cursors?.after:undefined;
}while(after);
const events=Object.fromEntries(Object.entries(clinicTemplates).map(([event,mapping])=>{
 const match=definitions.find(x=>x.name===mapping.name&&x.language===mapping.language);
 // Persist template text/status only; synthetic example values and provider IDs are unnecessary.
 return [event,match?{name:match.name,language:match.language,category:match.category,status:match.status,components:match.components.map(({type,text})=>({type,...(text?{text}:{})}))}:{...mapping,status:'MISSING'}];
}));
writeFileSync('integrations/whatsapp-templates.json',JSON.stringify({syncedAt:new Date().toISOString(),events},null,2)+'\n');
for(const [event,template]of Object.entries(events))console.log(event+': '+template.status);
