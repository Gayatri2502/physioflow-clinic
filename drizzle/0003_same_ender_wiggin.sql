CREATE TABLE `mutation_guards` (
	`id` text PRIMARY KEY NOT NULL,
	`passed` integer NOT NULL,
	CONSTRAINT "mutation_requires_current_revision" CHECK("mutation_guards"."passed"=1)
);
--> statement-breakpoint
CREATE TABLE `clinic_revisions` (
	`owner` text PRIMARY KEY NOT NULL,
	`version` integer DEFAULT 0 NOT NULL
);
