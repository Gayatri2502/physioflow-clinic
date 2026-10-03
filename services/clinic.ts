async function request(url:string,init?:RequestInit){const r=await fetch(url,init);const result:any=await r.json();if(!r.ok)throw new Error(result.error||'Request failed. Please retry.');return result;}
export const loadClinic=()=>request('/api/clinic');
export async function loadRecords(){return (await loadClinic()).records;}
export const saveRecord=(kind:string,data:any,id?:string)=>request('/api/clinic',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind,data,id})});
export const removeRecord=(id:string)=>request('/api/clinic',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});
export const initialize=(action:string)=>request('/api/clinic/bootstrap',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action})});
export const accountingAction=(data:any)=>request('/api/accounting',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
