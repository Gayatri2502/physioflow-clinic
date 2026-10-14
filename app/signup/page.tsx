import {requireFirebaseUser} from '../firebase-auth';
import {signupStatus} from '../../services/auth/signup';
import ClinicSignup from '../../components/erp/clinic-signup';
export const dynamic='force-dynamic';
export default async function Page(){await requireFirebaseUser('/signup');const d=await signupStatus();return <ClinicSignup email={d.email} request={d.request}/>}
