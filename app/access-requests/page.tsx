import {actor,readAll} from '../../services/server';
import {listSignupRequests} from '../../services/auth/signup';
import SignupReview from '../../components/erp/signup-review';
import {requireFirebaseUser} from '../firebase-auth';
export const dynamic='force-dynamic';
export default async function Page(){await requireFirebaseUser('/access-requests');const a=await actor();if(a.role!=='Super Admin')return <main><h1>Clinic owner access required</h1></main>;const [requests,records]=await Promise.all([listSignupRequests(),readAll(a.owner)]);return <SignupReview requests={requests} records={records.filter(x=>['Patients','Doctors'].includes(x.kind)).map(x=>({id:x.id,kind:x.kind,name:x.data.Name}))}/>}
