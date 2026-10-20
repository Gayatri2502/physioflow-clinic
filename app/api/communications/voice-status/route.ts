import {z} from 'zod';
import {getFirestore} from '../../../../lib/firebase-admin';
import {actor,ClinicError,fail} from '../../../../services/server';
import {allowedContactRole} from '../../../../lib/communications/core.mjs';
import {validOrigin} from '../../../../services/auth/policy';
export const runtime='nodejs';
export async function POST(req:Request){try{
 if(!validOrigin(req))throw new ClinicError('Invalid request origin.',403);
 const user=await actor();if(!allowedContactRole(user.role))throw new ClinicError('Your role cannot review calls.',403);
 const input=z.object({requestId:z.string().min(1).max(512).regex(/^[A-Za-z0-9_-]+$/)}).safeParse(await req.json());if(!input.success)throw new ClinicError('Select a call request.');
 const ref=getFirestore().collection('clinics').doc(user.owner).collection('contactRequests').doc(input.data.requestId);
 const request=(await ref.get()).data();if(request?.channel!=='voice'||!request.providerId)throw new ClinicError('Call request not found.',404);
 if(!process.env.VAPI_PRIVATE_KEY)throw new ClinicError('Vapi credentials are not configured.',503);
 const response=await fetch('https://api.vapi.ai/call/'+encodeURIComponent(request.providerId),{headers:{Authorization:'Bearer '+process.env.VAPI_PRIVATE_KEY},signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new ClinicError('Vapi call status is unavailable.',502);
 const call=await response.json();
 if(call.id!==request.providerId||call.assistantId!==process.env.VAPI_ASSISTANT_ID||call.phoneNumberId!==process.env.VAPI_PHONE_NUMBER_ID)throw new ClinicError('Call result does not match the configured clinic.',502);
 if(!['queued','scheduled','ringing','in-progress','forwarding','ended'].includes(call.status))throw new ClinicError('Unknown call state.',502);
 const patch={callStatus:call.status,endedReason:typeof call.endedReason==='string'?call.endedReason.slice(0,150):'',updated:new Date().toISOString()};
 // Keep only outcome metadata; do not persist recordings, transcripts, summaries or customer fields.
 await ref.update(patch);return Response.json(patch,{headers:{'Cache-Control':'private, no-store'}});
}catch(error){return fail(error)}}
