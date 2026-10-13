import type {ClinicRecord} from '../../types/clinic';
export function validDate(value:string){const date=new Date(value+'T00:00:00Z');return /^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;}
export function assertSlotAvailable(records:ClinicRecord[],data:Record<string,any>,id?:string){
 if(['Cancelled','No Show'].includes(data.Status))return;
 const minutes=(time:string)=>Number(time.slice(0,2))*60+Number(time.slice(3));
 const start=minutes(data.Time),duration=Number(data.Duration||45);
 if(!validDate(data.Date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(data.Time)||!Number.isFinite(duration)||duration<5||start+duration>24*60)throw Error('Choose a valid appointment date, time and duration.');
 if(records.some(x=>x.kind==='Appointments'&&x.id!==id&&x.data.Date===data.Date&&x.data.Therapist===data.Therapist&&!['Cancelled','No Show'].includes(x.data.Status)&&start<minutes(x.data.Time)+Number(x.data.Duration||45)&&minutes(x.data.Time)<start+duration))throw Error('This therapist already has an appointment during that time.');
}
