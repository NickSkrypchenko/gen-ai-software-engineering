CREATE TYPE "public"."ticket_category" AS ENUM('account_access', 'technical_issue', 'billing_question', 'feature_request', 'bug_report', 'other');--> statement-breakpoint
CREATE TYPE "public"."ticket_priority" AS ENUM('urgent', 'high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('new', 'in_progress', 'waiting_customer', 'resolved', 'closed');--> statement-breakpoint
CREATE TABLE "classifications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"ticket_id" uuid NOT NULL,
	"category" "ticket_category" NOT NULL,
	"priority" "ticket_priority" NOT NULL,
	"confidence" real NOT NULL,
	"reasoning" text NOT NULL,
	"matched_keywords" text[] DEFAULT '{}' NOT NULL,
	"source" varchar(32) NOT NULL,
	"classified_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "confidence_range" CHECK ("classifications"."confidence" BETWEEN 0 AND 1)
);
--> statement-breakpoint
CREATE TABLE "ticket_transitions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"ticket_id" uuid NOT NULL,
	"from_status" "ticket_status",
	"to_status" "ticket_status" NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"changed_by" varchar(200),
	"reason" text
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"customer_id" varchar(64) NOT NULL,
	"customer_email" varchar(255) NOT NULL,
	"customer_name" varchar(200) NOT NULL,
	"subject" varchar(200) NOT NULL,
	"description" text NOT NULL,
	"category" "ticket_category" DEFAULT 'other' NOT NULL,
	"priority" "ticket_priority" DEFAULT 'medium' NOT NULL,
	"status" "ticket_status" DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"assigned_to" varchar(200),
	"tags" text[] DEFAULT '{}' NOT NULL,
	"metadata" jsonb DEFAULT '{"source":"api"}'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "subject_len" CHECK (char_length("tickets"."subject")     BETWEEN 1 AND 200),
	CONSTRAINT "description_len" CHECK (char_length("tickets"."description") BETWEEN 10 AND 2000),
	CONSTRAINT "email_format" CHECK ("tickets"."customer_email" ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);
--> statement-breakpoint
ALTER TABLE "classifications" ADD CONSTRAINT "classifications_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_transitions" ADD CONSTRAINT "ticket_transitions_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_classifications_ticket" ON "classifications" USING btree ("ticket_id","classified_at");--> statement-breakpoint
CREATE INDEX "ix_transitions_ticket" ON "ticket_transitions" USING btree ("ticket_id","changed_at");--> statement-breakpoint
CREATE INDEX "ix_tickets_customer_email" ON "tickets" USING btree ("customer_email");--> statement-breakpoint
CREATE INDEX "ix_tickets_status_priority" ON "tickets" USING btree ("status","priority");--> statement-breakpoint
CREATE INDEX "ix_tickets_created_at" ON "tickets" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ix_tickets_category" ON "tickets" USING btree ("category");