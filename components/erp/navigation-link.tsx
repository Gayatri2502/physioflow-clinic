'use client';
import {useDemoNavigation,demoHref} from './demo-navigation';
import type {AnchorHTMLAttributes} from 'react';
export default function NavigationLink(props:AnchorHTMLAttributes<HTMLAnchorElement>){const demo=useDemoNavigation();return <a {...props} href={demo&&props.href?demoHref(props.href):props.href} target="_self"/>;}
