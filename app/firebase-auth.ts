import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {getAdminAuth} from '../lib/firebase-admin';
import {SESSION_COOKIE,isGoogleIdentity,safeReturnPath} from '../services/auth/policy';
export type FirebaseUser={userId:string;displayName:string;email:string;fullName:string|null};
export async function getFirebaseUser():Promise<FirebaseUser|null>{
 const session=(await cookies()).get(SESSION_COOKIE)?.value;if(!session)return null;
 try{const user=await getAdminAuth().verifySessionCookie(session,true);if(!isGoogleIdentity(user))return null;return {userId:user.uid,email:user.email!,displayName:user.name||user.email!,fullName:user.name||null};}catch{return null;}
}
export async function requireFirebaseUser(returnTo:string){const user=await getFirebaseUser();if(user)return user;redirect('/login?return_to='+encodeURIComponent(safeReturnPath(returnTo)));}
