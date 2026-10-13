import {z} from 'zod';
import {fail,ClinicError} from '../../../services/server';
import {initiateContact} from '../../../lib/communications/server';
export const runtime='nodejs';
export async function POST(req:Request){try{const input=z.object({appointmentId:z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/),channel:z.enum(['voice','whatsapp']),confirmed:z.literal(true)}).safeParse(await req.json());if(!input.success)throw new ClinicError('Select an appointment and confirm the contact request.');return Response.json(await initiateContact(input.data));}catch(e){return fail(e);}}
