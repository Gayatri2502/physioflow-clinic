import {validateDemoLogin,demoSessionRole} from '../../../services/domain/demo-login';
const headers={'Cache-Control':'no-store'};
export async function POST(req:Request){
 const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)return Response.json({error:'Please sign in from the clinic login page.'},{status:403,headers});
 let input:unknown;try{input=await req.json();}catch{return Response.json({error:'Enter your role, email and password.'},{status:400,headers});}
 const account=validateDemoLogin(input);if(!account)return Response.json({error:'The email or password does not match the selected role. Check the demo credentials below.'},{status:401,headers});
 return Response.json({role:account.key,redirect:'/demo/Dashboard'},{headers:{...headers,'Set-Cookie':`physioflow_demo=${encodeURIComponent(account.key+'|'+(Date.now()+8*60*60*1000))}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`}});
}
export async function GET(req:Request){const role=demoSessionRole(req.headers.get('cookie')||'');return role?Response.json({role},{headers}):Response.json({error:'Select a role and sign in to the demo.'},{status:401,headers});}
export async function DELETE(){return Response.json({ok:true},{headers:{...headers,'Set-Cookie':'physioflow_demo=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'}});}
