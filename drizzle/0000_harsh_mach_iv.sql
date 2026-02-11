CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" varchar(10) NOT NULL,
	"entity" varchar(50) NOT NULL,
	"entity_id" uuid NOT NULL,
	"old_values" jsonb,
	"new_values" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"cpf_cnpj" varchar(18) NOT NULL,
	"phone" varchar(50),
	"status" varchar(20) DEFAULT 'ativo' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "clients_cpf_cnpj_unique" UNIQUE("cpf_cnpj")
);
--> statement-breakpoint
CREATE TABLE "import_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"filename" varchar(255) NOT NULL,
	"rows_total" integer NOT NULL,
	"rows_imported" integer DEFAULT 0 NOT NULL,
	"rows_errors" integer DEFAULT 0 NOT NULL,
	"errors_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"name" varchar(255),
	"role" varchar(20) DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_history" ADD CONSTRAINT "import_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_check" CHECK (role IN ('admin', 'user', 'viewer'));
--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_status_check" CHECK (status IN ('ativo', 'inativo'));
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_action_check" CHECK (action IN ('create', 'update', 'delete'));
--> statement-breakpoint
CREATE INDEX "idx_clients_email" ON "clients" ("email");
--> statement-breakpoint
CREATE INDEX "idx_clients_status" ON "clients" ("status");
--> statement-breakpoint
CREATE INDEX "idx_clients_deleted_at" ON "clients" ("deleted_at") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX "idx_clients_name" ON "clients" (LOWER("name"));
--> statement-breakpoint
CREATE INDEX "idx_audit_entity" ON "audit_log" ("entity", "entity_id");
--> statement-breakpoint
CREATE INDEX "idx_audit_user" ON "audit_log" ("user_id");
--> statement-breakpoint
CREATE INDEX "idx_audit_created" ON "audit_log" ("created_at");
--> statement-breakpoint
CREATE INDEX "idx_import_user" ON "import_history" ("user_id");
--> statement-breakpoint
CREATE INDEX "idx_import_created" ON "import_history" ("created_at");