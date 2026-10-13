import ClinicLogin from '../../components/erp/clinic-login';
export default async function Page({searchParams}:{searchParams:Promise<{return_to?:string}>}){const {return_to}=await searchParams;return <ClinicLogin returnTo={return_to}/>;}
