import {z} from 'zod';
import {roles} from '../permissions/roles';
const text=z.string().trim().min(1,'is required');const number=z.coerce.number().finite().min(0);
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/,'Use a valid date').refine(x=>!isNaN(new Date(x).getTime()),'Invalid date');
const common=z.object({Patient:text}).passthrough();
export const schemas:Record<string,z.ZodTypeAny>={
Settings:z.object({Name:text,Address:z.string().optional(),Phone:z.string().optional()}).passthrough(),
Staff:z.object({Name:text,Email:z.string().email(),Role:z.string().refine(x=>roles.includes(x),'Choose a valid role'),Status:z.enum(['Active','Inactive'])}).passthrough(),
Patients:z.object({Name:text,Phone:z.string().regex(/^[+\d\s()-]{7,20}$/,'Enter a valid phone number'),DOB:z.union([date,z.literal('')]).optional()}).passthrough(),
Appointments:common.extend({Date:date,Time:z.string().regex(/^\d{2}:\d{2}$/),Therapist:text,Duration:number.min(5).max(240),Status:z.enum(['Scheduled','Confirmed','Checked-In','In Treatment','Completed','Cancelled','No Show'])}),
Consultation:common.extend({Therapist:text,Date:date,'Pain Score':number.max(10),Diagnosis:text}),
Plans:common.extend({Therapist:text,Diagnosis:text,'Sessions Recommended':number.int().min(1),Status:z.enum(['Active','Completed','Paused','Cancelled'])}),
Treatments:common.extend({Therapist:text,Date:date,'Session Number':number.int().min(1),'Pain Score':number.max(10),Diagnosis:text,Duration:number.min(1)}),
Billing:common.extend({Service:text,Quantity:number.min(1),Rate:number,Discount:number.default(0),Tax:number.max(100).default(0),'Amount Paid':number.default(0),Items:z.array(z.object({Service:text,Quantity:number.min(1),Rate:number})).optional()}).refine(d=>d.Discount<=d.Quantity*d.Rate+(d.Items||[]).reduce((s,x)=>s+x.Quantity*x.Rate,0),'Discount cannot exceed service total'),
Payments:common.extend({Invoice:text,Amount:number.min(0.01),'Payment Method':text,Date:date,Status:z.enum(['Paid','Partially Paid','Pending','Overdue','Refunded'])}),
Packages:common.extend({Package:text,'Sessions Purchased':number.int().min(1),'Sessions Completed':number.int().default(0),Amount:number,'Amount Paid':number.default(0),Validity:date}).refine(d=>d['Sessions Completed']<=d['Sessions Purchased'],'Completed sessions exceed package capacity'),
Schemes:common.extend({Organization:text,'Approved Sessions':number.int().min(1),'Approved Amount':number,'Amount Claimed':number.default(0),'Amount Received':number.default(0),'Claim Status':z.enum(['Draft','Submitted','Under Review','Approved','Partially Approved','Rejected','Paid'])}).refine(d=>d['Amount Received']<=d['Amount Claimed']&&d['Amount Claimed']<=d['Approved Amount'],'Claim/received amounts exceed authorization'),
Doctors:z.object({Name:text,Department:text,Availability:z.enum(['Available','In session','On leave'])}).passthrough(),Departments:z.object({Name:text}).passthrough(),Records:common.extend({'Document Type':text,Title:text})};
