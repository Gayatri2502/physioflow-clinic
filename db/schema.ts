import {sql} from 'drizzle-orm';
import { sqliteTable, text, integer, index, check } from "drizzle-orm/sqlite-core";
export const records = sqliteTable("records", { id: text("id").primaryKey(), owner: text("owner").notNull(), kind: text("kind").notNull(), data: text("data").notNull(), created: text("created").notNull() }, (t)=>[index("idx_records_owner_created").on(t.owner,t.created)]);
export const audits = sqliteTable("audits", { id: text("id").primaryKey(), owner: text("owner").notNull(), action: text("action").notNull(), recordId: text("record_id").notNull(), created: text("created").notNull() });
export const clinic = sqliteTable('clinic', {id:text('id').primaryKey(),owner:text('owner').notNull(),email:text('email').notNull()});
export const links = sqliteTable('record_links', {id:text('id').primaryKey(),owner:text('owner').notNull(),source:text('source').notNull().references(()=>records.id,{onDelete:'cascade'}),target:text('target').notNull().references(()=>records.id,{onDelete:'restrict'}),relation:text('relation').notNull()},t=>[index('idx_record_links_target').on(t.target),index('idx_record_links_source').on(t.source)]);

export const revisions=sqliteTable('clinic_revisions',{owner:text('owner').primaryKey(),version:integer('version').notNull().default(0)});
export const guards=sqliteTable('mutation_guards',{id:text('id').primaryKey(),passed:integer('passed').notNull()},t=>[check('mutation_requires_current_revision',sql`${t.passed}=1`)]);
