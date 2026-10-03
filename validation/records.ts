import {z} from 'zod';
const text=z.string().trim().min(1,'This field is required');
const number=z.coerce.number().min(0);
const common=z.object({Patient:text}).passthrough();
export const schemas:Record<string,z.ZodTypeAny>={
Settings:z.object({Name:text}).passthrough(),
Patients:z.object({Name:text,Phone:z.string().regex(/^[+\d\s()-]{7,20}$/,'Enter a valid phone number'),DOB:z.string().optional()}).passthrough(),
Appointments:common.extend({Date:text,Time:text,Therapist:text,Status:z.enum(['Scheduled','Confirmed','Checked-In','In Treatment','Completed','Cancelled','No Show'])}),
Consultation:common.extend({Therapist:text,Date:text,'Pain Score':number.max(10)}),
Treatments:common.extend({Therapist:text,Date:text,'Session Number':number.int().min(1),'Pain Score':number.max(10)}),
Billing:common.extend({Service:text,Quantity:number.min(1),Rate:number,Discount:number,Tax:number.max(100),'Amount Paid':number}),
Payments:common.extend({Invoice:text,Amount:number.min(0.01),'Payment Method':text,Status:z.enum(['Paid','Partially Paid','Pending','Overdue','Refunded'])}),
Packages:common.extend({Package:text,'Sessions Purchased':number.int().min(1),'Sessions Completed':number.int(),Amount:number,'Amount Paid':number,Validity:text}).refine(d=>d['Sessions Completed']<=d['Sessions Purchased'],'Completed sessions cannot exceed purchased sessions'),
Schemes:common.extend({Organization:text,'Approved Sessions':number.int(),'Approved Amount':number,'Amount Claimed':number,'Amount Received':number}),
Doctors:z.object({Name:text,Department:text}).passthrough(),Departments:z.object({Name:text}).passthrough(),Records:common.extend({'Document Type':text,Title:text})};
