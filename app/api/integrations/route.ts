import {actor,fail} from '../../../services/server';
import {communicationsConfig,whatsappTrackingEnabled,reminderSettings} from '../../../lib/communications/server';
import {paymentConfig} from '../../../lib/payments/razorpay';
export async function GET(){try{await actor();return Response.json({razorpay:{enabled:paymentConfig().enabled},whatsapp:{enabled:communicationsConfig().whatsapp.enabled,calling:false,deliveryTracking:whatsappTrackingEnabled(),automaticReminders:reminderSettings().enabled},vapi:{enabled:communicationsConfig().voice.enabled}},{headers:{'Cache-Control':'private, no-store'}});}catch(e){return fail(e);}}
