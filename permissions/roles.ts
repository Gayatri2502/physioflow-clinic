export const roles=['Super Admin','Clinic Admin','Doctor / Physiotherapist','Receptionist','Accountant'];
const all=['Patients','Appointments','Doctors','Departments','Consultation','Treatments','Plans','Packages','Schemes','Billing','Payments','Records','Settings','Staff'];
export const readable:Record<string,string[]>={
'Super Admin':[...all,'Audit'],
'Clinic Admin':[...all.filter(x=>x!=='Staff'),'Audit'],
'Doctor / Physiotherapist':['Patients','Appointments','Doctors','Departments','Consultation','Treatments','Plans','Packages','Records'],
'Receptionist':['Patients','Appointments','Doctors','Departments','Packages','Billing','Payments'],
'Accountant':['Patients','Doctors','Departments','Packages','Schemes','Billing','Payments']};
export const writable:Record<string,string[]>={
'Super Admin':all,'Clinic Admin':all.filter(x=>x!=='Staff'),
'Doctor / Physiotherapist':['Appointments','Consultation','Treatments','Plans','Records'],
'Receptionist':['Patients','Appointments','Billing','Payments'],
'Accountant':['Billing','Payments','Schemes','Packages']};
export const canRead=(role:string,kind:string)=>(readable[role]||[]).includes(kind);
export const canWrite=(role:string,kind:string)=>(writable[role]||[]).includes(kind);
