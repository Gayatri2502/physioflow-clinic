import {actor,fail} from '../../../services/server';
import {communicationsConfig} from '../../../lib/communications/server';
import {paymentConfig} from '../../../lib/payments/razorpay';
export async function GET(){try{await actor();return Response.json({razorpay:{enabled:paymentConfig().enabled},whatsapp:{enabled:communicationsConfig().whatsapp.enabled,calling:false},vapi:{enabled:communicationsConfig().voice.enabled}});}catch(e){return fail(e);}}
