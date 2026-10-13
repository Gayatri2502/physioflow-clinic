import ProtectedWorkspace from '../protected-workspace';
import {notFound} from 'next/navigation';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{module:string}>}){const {module}=await params;if(!['Dashboard','Accounting','Appointments','Billing','Consultation','Departments','Doctors','Packages','Patients','Payments','Plans','Records','Reports','Schemes','Settings','Treatments'].includes(module))notFound();return <ProtectedWorkspace module={module}/>;}
