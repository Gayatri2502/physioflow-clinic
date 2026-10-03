import {demoAccounts} from '../../config/demo';
export function validateDemoLogin(input:unknown){
 if(!input||typeof input!=='object')return null;
 const {role,email,password}=input as Record<string,unknown>;
 if(typeof role!=='string'||typeof email!=='string'||typeof password!=='string')return null;
 return demoAccounts.find(account=>account.key===role&&account.email===email.trim().toLowerCase()&&account.password===password)||null;
}
// This cookie selects only public sample data. It is never accepted by clinic authentication.
export function demoSessionRole(cookie:string){
 const value=cookie.split(';').map(x=>x.trim()).find(x=>x.startsWith('physioflow_demo='))?.slice('physioflow_demo='.length);
 if(!value)return null;try{const [key,expiry]=decodeURIComponent(value).split('|');return Number(expiry)>Date.now()&&demoAccounts.some(x=>x.key===key)?key:null;}catch{return null;}
}
export function roleMatchesAccount(selectedKey:string,assignedRole:string){return demoAccounts.find(x=>x.key===selectedKey)?.role===assignedRole;}
