export const SESSION_COOKIE='physioflow_session';
export const CSRF_COOKIE='physioflow_auth_csrf';
export const SESSION_SECONDS=8*60*60;
export function safeReturnPath(value:string){
 try{const url=new URL(value,'https://clinic.local');if(!value.startsWith('/')||url.origin!=='https://clinic.local'||['/sign-out','/api/auth/session'].includes(url.pathname))return '/';return url.pathname+url.search+url.hash;}catch{return '/';}
}
export function isGoogleIdentity(token:{email?:string;email_verified?:boolean;firebase?:{sign_in_provider?:string}}){return Boolean(token.email&&token.email_verified&&token.firebase?.sign_in_provider==='google.com');}
export function isRecentSignIn(authTime:number,now=Math.floor(Date.now()/1000)){return Number.isFinite(authTime)&&authTime<=now+30&&now-authTime<=5*60;}
export function validOrigin(request:Request){const origin=request.headers.get('origin');return origin===new URL(request.url).origin;}
export function validCsrf(cookie:string|undefined,submitted:unknown){return Boolean(cookie&&typeof submitted==='string'&&cookie.length>=32&&cookie===submitted);}
