import {z} from 'zod';
import {actor,fail,ClinicError} from '../../../../../services/server';
import {createPaymentOrder} from '../../../../../lib/payments/razorpay';
export const runtime='nodejs';
export async function POST(req:Request){try{const a=await actor();const input=z.object({invoiceId:z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/)}).safeParse(await req.json());if(!input.success)throw new ClinicError('Select a valid invoice.');return Response.json(await createPaymentOrder(a,input.data.invoiceId));}catch(e){return fail(e);}}
