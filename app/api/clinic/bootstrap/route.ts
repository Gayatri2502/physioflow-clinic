import {z} from 'zod';
import {actor,readAll,fail,ClinicError,revision,atomicBatch,putRecord,deleteRecord,auditRecord} from '../../../../services/server';
import {protectDelete} from '../../../../services/domain/workflows';
/** Owner-only maintenance of explicitly marked legacy samples. No sample creation. */
export async function POST(req:Request){try{
 const a=await actor();if(a.role!=='Super Admin')throw new ClinicError('Only the owner can clear sample clinic data.',403);
 const input=z.object({action:z.literal('empty')}).safeParse(await req.json());if(!input.success)throw new ClinicError('Sample creation is disabled.');
 const version=await revision(a.owner),records=await readAll(a.owner),sample=records.filter(x=>x.data.sample===true),ids=new Set(sample.map(x=>x.id)),retained=records.filter(x=>!ids.has(x.id));
 for(const row of sample)try{protectDelete(row,retained)}catch(e){throw new ClinicError((e as Error).message,409)}
 const settings=records.find(x=>x.kind==='Settings');
 await atomicBatch(a.owner,version,[...sample.map(x=>deleteRecord(x.id)),...(settings?[putRecord({...settings,data:{...settings.data,Sample:false}})]:[]),auditRecord(a.email+' cleared marked sample records','')]);
 return Response.json({ok:true,removed:sample.length});
}catch(e){return fail(e)}}
