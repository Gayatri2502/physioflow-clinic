import {z} from 'zod';
import {actor,fail,ClinicError} from '../../../../../services/server';
import {verifyCheckout} from '../../../../../lib/payments/razorpay';
export const runtime='nodejs';
export async function POST(req:Request){try{const a=await actor();const input=z.object({orderId:z.string().regex(/^order_[a-zA-Z0-9]+$/),paymentId:z.string().regex(/^pay_[a-zA-Z0-9]+$/),signature:z.string().regex(/^[a-f\d]{64}$/i)}).safeParse(await req.json());if(!input.success)throw new ClinicError('Invalid payment verification.');return Response.json(await verifyCheckout(a,input.data));}catch(e){return fail(e);}}
