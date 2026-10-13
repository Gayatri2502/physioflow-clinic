 'use client';
import {useState} from 'react';
import {signOut} from 'firebase/auth';
import {firebaseAuth} from '../../lib/firebase-client';
export default function SignOut(){const [busy,setBusy]=useState(false),[error,setError]=useState('');async function logout(){setBusy(true);try{const response=await fetch('/api/auth/session',{method:'DELETE'});if(!response.ok)throw new Error('Could not sign out. Please retry.');try{await signOut(firebaseAuth());}catch{}window.location.assign('/login');}catch(e){setError(e instanceof Error?e.message:'Could not sign out.');setBusy(false);}}return <main className="login-page"><section className="panel login-card"><h1>Sign out of PhysioFlow</h1><p>This also ends your other active clinic sessions.</p><button className="button primary" disabled={busy} onClick={logout}>{busy?'Signing out…':'Sign out'}</button><a className="button secondary" href="/">Back to clinic</a>{error&&<p role="alert">{error}</p>}</section></main>;}
