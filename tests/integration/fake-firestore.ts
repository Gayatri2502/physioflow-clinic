import {randomUUID} from 'node:crypto';
const clone=(value:any)=>value===undefined?undefined:structuredClone(value);
export class FakeFirestore {
 store=new Map<string,any>(); private tail:Promise<any>=Promise.resolve();
 collection(path:string){return new Collection(this,path)}
 async runTransaction<T>(callback:(tx:Transaction)=>Promise<T>):Promise<T>{
  const run=this.tail.then(async()=>{const before=new Map([...this.store].map(([k,v])=>[k,clone(v)]));try{return await callback(new Transaction(this))}catch(e){this.store=before;throw e}});
  this.tail=run.catch(()=>{});return run;
 }
}
class Snapshot { constructor(public ref:Document,private value:any){} get id(){return this.ref.id} get exists(){return this.value!==undefined} data(){return clone(this.value)} }
class Query {
 constructor(public db:FakeFirestore,public path:string,private filters:any[]=[],private sort?:[string,string],private count?:number){}
 where(field:string,op:string,value:any){if(!['==','<='].includes(op))throw Error('Unsupported test query');return new Query(this.db,this.path,[...this.filters,[field,value,op]],this.sort,this.count)}
 orderBy(field:string,direction='asc'){return new Query(this.db,this.path,this.filters,[field,direction],this.count)}
 limit(count:number){return new Query(this.db,this.path,this.filters,this.sort,count)}
 async get(){const prefix=this.path+'/';let docs=[...this.db.store].filter(([path,value])=>path.startsWith(prefix)&&!path.slice(prefix.length).includes('/')&&this.filters.every(([field,expected,op])=>{const actual=field.split('.').reduce((v:any,key:string)=>v?.[key],value);return op==='=='?actual===expected:actual!==undefined&&actual<=expected})).map(([path,value])=>new Snapshot(new Document(this.db,path),value));if(this.sort){const [field,dir]=this.sort;docs.sort((a,b)=>String(a.data()[field]).localeCompare(String(b.data()[field]))*(dir==='desc'?-1:1));}if(this.count!==undefined)docs=docs.slice(0,this.count);return {docs,empty:docs.length===0,size:docs.length};}
}
class Collection extends Query {doc(id=randomUUID()){return new Document(this.db,this.path+'/'+id)} async add(value:any){const doc=this.doc();await doc.create(value);return doc}}
class Document {
 constructor(public db:FakeFirestore,public path:string){} get id(){return this.path.split('/').pop()!} collection(name:string){return new Collection(this.db,this.path+'/'+name)}
 async get(){return new Snapshot(this,this.db.store.get(this.path))}
 async create(value:any){if(this.db.store.has(this.path))throw Error('Document exists');this.db.store.set(this.path,clone(value))}
 async set(value:any,options?:{merge:boolean}){this.db.store.set(this.path,options?.merge?{...this.db.store.get(this.path),...clone(value)}:clone(value))}
 async update(value:any){if(!this.db.store.has(this.path))throw Error('Document missing');await this.set(value,{merge:true})}
 async delete(){this.db.store.delete(this.path)}
}
class Transaction {private wrote=false;constructor(private db:FakeFirestore){}async get(target:Document|Query){if(this.wrote)throw Error('Firestore reads must precede writes');return target.get()}create(ref:Document,value:any){this.wrote=true;if(this.db.store.has(ref.path))throw Error('Document exists');this.db.store.set(ref.path,clone(value));return this}set(ref:Document,value:any,options?:{merge:boolean}){this.wrote=true;this.db.store.set(ref.path,options?.merge?{...this.db.store.get(ref.path),...clone(value)}:clone(value));return this}update(ref:Document,value:any){if(!this.db.store.has(ref.path))throw Error('Document missing');return this.set(ref,value,{merge:true})}delete(ref:Document){this.wrote=true;this.db.store.delete(ref.path);return this}}
export function fakeBucket(){const files=new Map<string,any>();return {file(key:string){return {async save(content:any,options:any){files.set(key,{content:Buffer.from(content),metadata:options.metadata})},async exists(){return [files.has(key)]},async getMetadata(){const f=files.get(key);return [{...f.metadata,size:f.content.length}]},async download(){return [files.get(key).content]}}}}}
