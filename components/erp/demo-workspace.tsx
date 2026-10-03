'use client';
import {useEffect,useState} from 'react';
import {demoAccounts,DEMO_SESSION_KEY} from '../../config/demo';
import {DemoNavigationContext} from './demo-navigation';
import Workspace from './workspace';
export default function DemoWorkspace({module}:{module:string}){
 const [role,setRole]=useState('');
 useEffect(()=>{const key=sessionStorage.getItem(DEMO_SESSION_KEY);if(!demoAccounts.some(x=>x.key===key)){window.location.replace('/login');return;}setRole(key!);},[]);
 if(!role)return <div className="empty">Opening your demo workspace…</div>;
 return <DemoNavigationContext.Provider value={true}><Workspace module={module} demoRole={role}/></DemoNavigationContext.Provider>;
}
