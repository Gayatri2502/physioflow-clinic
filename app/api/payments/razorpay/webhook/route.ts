import {fail,ClinicError} from '../../../../../services/server';
import {processWebhook} from '../../../../../lib/payments/razorpay';
export const runtime='nodejs';
export async function POST(req:Request){try{const raw=await req.text();if(raw.length>262144)throw new ClinicError('Webhook too large.',413);return Response.json(await processWebhook(raw,req.headers.get('x-razorpay-signature')));}catch(e){return fail(e);}}
