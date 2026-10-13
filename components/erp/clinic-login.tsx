 'use client';
import {useState} from 'react';
import {Activity,ShieldCheck} from 'lucide-react';
import {ThemeControl} from './appearance';
import {GoogleSignIn} from './google-sign-in';
import {clinicRoles} from '../../services/auth/roles';
export default function ClinicLogin({returnTo}:{returnTo?:string}){const [role,setRole]=useState('receptionist');return <main className="login-page"><header className="login-header"><a className="brand" href="/"><span className="brand-icon"><Activity/></span><span>physio<span className="brand-light">flow</span></span></a><ThemeControl/></header><section className="panel login-card"><ShieldCheck size={24}/><h1>Sign in to your clinic</h1><p>Use your Google account. Your clinic administrator must assign access before you can open clinic records.</p><label className="clinic-role-label">Clinic role<select value={role} onChange={e=>setRole(e.target.value)}>{clinicRoles.map(x=><option key={x.key} value={x.key}>{x.role}</option>)}</select></label><GoogleSignIn returnTo={returnTo||'/role-entry?role='+role}/><p className="login-disclaimer">Your assigned role is verified on the server.</p></section></main>;}
