'use client';
import {createContext,useContext} from 'react';
export const DemoNavigationContext=createContext(false);
export const useDemoNavigation=()=>useContext(DemoNavigationContext);
export function demoHref(href:string){if(!href.startsWith('/')||href.startsWith('/api/')||href.startsWith('/demo')||href.startsWith('/login')||href.startsWith('/signin')||href.startsWith('/signout'))return href;const [path,query]=href.split('?');return '/demo/'+(path==='/'?'Dashboard':path.slice(1))+(query?'?'+query:'');}
