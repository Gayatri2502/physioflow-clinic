import {validOrigin} from '../../../services/auth/policy';
import {z} from 'zod';
import {fail,ClinicError} from '../../../services/server';
import {initiateContact,contactHistory} from '../../../lib/communications/server';
export const runtime='nodejs';
export async function GET(req:Request){try{const id=z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/).safeParse(new URL(req.url).searchParams.get('appointmentId'));if(!id.success)throw new ClinicError('Select a valid appointment.');return Response.json({requests:await contactHistory(id.data)},{headers:{'Cache-Control':'private, no-store'}});}catch(e){return fail(e);}}
export async function POST(req:Request){try{if(!validOrigin(req))throw new ClinicError('Invalid request origin.',403);const input=z.object({appointmentId:z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/),channel:z.enum(['voice','whatsapp']),confirmed:z.literal(true)}).safeParse(await req.json());if(!input.success)throw new ClinicError('Select an appointment and confirm the contact request.');return Response.json(await initiateContact(input.data));}catch(e){return fail(e);}}
