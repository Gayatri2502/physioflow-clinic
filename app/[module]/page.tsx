import Workspace from '../../components/erp/workspace';
export default async function Page({params}:{params:Promise<{module:string}>}){const {module}=await params;return <Workspace module={decodeURIComponent(module)}/>;}
