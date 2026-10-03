import DemoWorkspace from '../../../components/erp/demo-workspace';
export default async function Page({params}:{params:Promise<{module:string}>}){const {module}=await params;return <DemoWorkspace module={decodeURIComponent(module)}/>;}
