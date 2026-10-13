import Workspace from '../components/erp/workspace';
import {requireFirebaseUser} from './firebase-auth';
export default async function ProtectedWorkspace({module}:{module:string}){await requireFirebaseUser(module==='Dashboard'?'/':'/'+encodeURIComponent(module));return <Workspace module={module}/>;}
