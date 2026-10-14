import {z} from 'zod';
import {validOrigin} from '../../../../services/auth/policy';
import {signupStatus,requestSignup,listSignupRequests,reviewSignup} from '../../../../services/auth/signup';
import {fail,ClinicError} from '../../../../services/server';
export const runtime='nodejs';
export async function GET(req:Request){try{return Response.json(new URL(req.url).searchParams.get('review')==='true'?{requests:await listSignupRequests()}:await signupStatus(),{headers:{'Cache-Control':'private, no-store'}})}catch(e){return fail(e)}}
export async function POST(req:Request){try{if(!validOrigin(req))throw new ClinicError('Invalid request origin.',403);const p=z.object({role:z.string().max(40)}).safeParse(await req.json());if(!p.success)throw new ClinicError('Choose a clinic role.');return Response.json(await requestSignup(p.data.role));}catch(e){return fail(e)}}
export async function PATCH(req:Request){try{if(!validOrigin(req))throw new ClinicError('Invalid request origin.',403);const p=z.object({uid:z.string().max(128),decision:z.enum(['approve','reject']),linkedId:z.string().max(128).optional()}).safeParse(await req.json());if(!p.success)throw new ClinicError('Invalid signup review.');return Response.json(await reviewSignup(p.data.uid,p.data.decision,p.data.linkedId));}catch(e){return fail(e)}}
