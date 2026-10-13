 'use client';
import {useState} from 'react';
import {GoogleAuthProvider,inMemoryPersistence,setPersistence,signInWithPopup,signOut} from 'firebase/auth';
import {firebaseAuth} from '../../lib/firebase-client';
import {safeReturnPath} from '../../services/auth/policy';
export function GoogleSignIn({returnTo}:{returnTo:string}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function login(){setBusy(true);setError('');let auth;try{
 auth=firebaseAuth();await setPersistence(auth,inMemoryPersistence);const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});
 const result=await signInWithPopup(auth,provider);const csrf=await fetch('/api/auth/session',{cache:'no-store'});if(!csrf.ok)throw new Error('Unable to start a secure sign-in.');const {csrfToken}=await csrf.json() as {csrfToken:string};
 const response=await fetch('/api/auth/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:await result.user.getIdToken(),csrfToken})});const data=await response.json() as {error?:string};if(!response.ok)throw new Error(data.error||'Sign-in failed.');await signOut(auth);window.location.assign(safeReturnPath(returnTo));
 }catch(e){if(auth)await signOut(auth).catch(()=>{});setError(e instanceof Error?e.message:'Google sign-in failed.');setBusy(false);}}
 return <><button type="button" className="button primary" disabled={busy} onClick={login}>{busy?'Signing in…':'Continue with Google'}</button>{error&&<p className="error" role="alert">{error}</p>}</>;
}
