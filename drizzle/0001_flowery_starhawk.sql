ALTER TABLE "audit_log" ADD COLUMN IF NOT EXISTS "actor" varchar(100);--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN IF NOT EXISTS "ip" varchar(64);--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN IF NOT EXISTS "user_agent" text;--> statement-breakpoint
ALTER TABLE "import_history" ADD COLUMN IF NOT EXISTS "actor" varchar(100);--> statement-breakpoint
ALTER TABLE "import_history" ADD COLUMN IF NOT EXISTS "ip" varchar(64);--> statement-breakpoint
ALTER TABLE "import_history" ADD COLUMN IF NOT EXISTS "user_agent" text;