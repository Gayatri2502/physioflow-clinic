export const roles=['Super Admin','Clinic Admin','Doctor / Physiotherapist','Receptionist','Accountant','Patient'];
const all=['Patients','Appointments','Doctors','Departments','Consultation','Treatments','Plans','Packages','Schemes','Billing','Payments','Records','Settings','Staff'];
export const readable:Record<string,string[]>={
'Super Admin':[...all,'Audit','Reports'],
'Clinic Admin':[...all.filter(x=>x!=='Staff'),'Audit','Reports'],
'Doctor / Physiotherapist':['Patients','Appointments','Doctors','Departments','Consultation','Treatments','Plans','Packages','Records'],
'Receptionist':['Patients','Appointments','Doctors','Departments','Packages','Billing','Payments'],
'Accountant':['Patients','Doctors','Departments','Packages','Schemes','Billing','Payments','Reports'],
'Patient':['Patients','Appointments','Doctors','Departments','Plans','Treatments','Packages','Billing','Payments','Records']};
export const writable:Record<string,string[]>={
'Super Admin':all,'Clinic Admin':all.filter(x=>x!=='Staff'),
'Doctor / Physiotherapist':['Consultation','Treatments','Plans','Records'],
'Receptionist':['Patients','Appointments','Billing','Payments'],
'Accountant':['Billing','Payments','Schemes','Packages'],Patient:[]};
export const canRead=(role:string,kind:string)=>Boolean(readable[role])&&(kind==='Settings'||kind==='Dashboard'||(['Accounting','Advances','CreditAllocations','RefundRequests','CashClosing'].includes(kind)&&(readable[role]||[]).includes('Payments')&&role!=='Patient')||(readable[role]||[]).includes(kind));
export const canWrite=(role:string,kind:string)=>(writable[role]||[]).includes(kind);
export const registrationFields=['Name','DOB','Gender','Phone','Address','Emergency Contact','Referral Doctor','Department','Therapist','Scheme','patientId','doctorId','departmentId'];
export const roleHome=(role:string)=>role==='Patient'?'My care':role==='Receptionist'?'Reception desk':role==='Doctor / Physiotherapist'?'My clinical workspace':role==='Accountant'?'Accounts desk':'Clinic overview';
