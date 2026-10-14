export const DOCUMENT_MAX_BYTES=10*1024*1024;
export function validDocumentKey(key:string,clinic:string){
 return key.startsWith(clinic+'/')&&new RegExp('^[a-zA-Z0-9_-]+/[a-f0-9-]{36}/[a-zA-Z0-9._-]{1,180}$').test(key)&&!key.split('/').some(x=>x==='.'||x==='..');
}
export function documentTypeMatches(bytes:Uint8Array,type:string){
 const hex=Buffer.from(bytes.subarray(0,12)).toString('hex');
 if(type==='application/pdf')return Buffer.from(bytes.subarray(0,5)).toString()==='%PDF-';
 if(type==='image/png')return hex.startsWith('89504e470d0a1a0a');
 if(type==='image/jpeg')return hex.startsWith('ffd8ff');
 if(type==='image/webp')return Buffer.from(bytes.subarray(0,4)).toString()==='RIFF'&&Buffer.from(bytes.subarray(8,12)).toString()==='WEBP';
 return false;
}
export function documentFilename(name:string){return name.replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,180)||'document';}
