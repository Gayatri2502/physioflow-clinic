import {redirect} from 'next/navigation';
import {requireFirebaseUser} from '../firebase-auth';
import {actor} from '../../services/server';
import {roleMatchesAccount} from '../../services/auth/roles';
export const dynamic='force-dynamic';
async function RoleEntry({role}:{role:string}){
 await requireFirebaseUser('/role-entry?role='+encodeURIComponent(role));
 let assigned;try{assigned=await actor();}catch{return <main className="login-page"><section className="panel login-card"><h1>Clinic access is not assigned</h1><p>Ask your clinic administrator to activate your account and assign a role.</p><a className="button primary" href="/signup">Request clinic access</a></section></main>;}
 if(!roleMatchesAccount(role,assigned.role))return <main className="login-page"><section className="panel login-card"><h1>Role does not match your account</h1><p>This signed-in account is assigned to <strong>{assigned.role}</strong>. Choose the matching role or sign in with the correct account.</p><div className="role-quick-actions"><a className="button primary" href="/login">Choose another role</a><a className="button secondary" href="/sign-out" target="_top">Use another account</a></div></section></main>;
 redirect('/');
}
export default async function Page({searchParams}:{searchParams:Promise<{role?:string}>}){const {role}=await searchParams;return <RoleEntry role={role||''}/>;}
