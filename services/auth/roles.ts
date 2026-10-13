export const clinicRoles=[{key:'super-admin',role:'Super Admin'},{key:'clinic-admin',role:'Clinic Admin'},{key:'doctor',role:'Doctor / Physiotherapist'},{key:'receptionist',role:'Receptionist'},{key:'accountant',role:'Accountant'},{key:'patient',role:'Patient'}];
export function roleMatchesAccount(key:string,role:string){return clinicRoles.some(x=>x.key===key&&x.role===role);}
