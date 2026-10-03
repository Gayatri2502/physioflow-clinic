'use client';
import {useEffect,useState} from 'react';
import {demoAccounts} from '../../config/demo';
import {DemoNavigationContext} from './demo-navigation';
import Workspace from './workspace';
export default function DemoWorkspace({module}:{module:string}){
 const [role,setRole]=useState('');
 useEffect(()=>{let active=true;fetch('/api/demo-login',{cache:'no-store'}).then(async response=>{const result:any=await response.json();if(!response.ok||!demoAccounts.some(x=>x.key===result.role)){window.location.replace('/login');return;}if(active)setRole(result.role);}).catch(()=>window.location.replace('/login'));return()=>{active=false;};},[]);
 if(!role)return <div className="empty">Opening your demo workspace…</div>;
 return <DemoNavigationContext.Provider value={true}><Workspace module={module} demoRole={role}/></DemoNavigationContext.Provider>;
}
