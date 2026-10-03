import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
export const records = sqliteTable("records", { id: text("id").primaryKey(), owner: text("owner").notNull(), kind: text("kind").notNull(), data: text("data").notNull(), created: text("created").notNull() }, (t)=>[index("idx_records_owner_created").on(t.owner,t.created)]);
export const audits = sqliteTable("audits", { id: text("id").primaryKey(), owner: text("owner").notNull(), action: text("action").notNull(), recordId: text("record_id").notNull(), created: text("created").notNull() });
