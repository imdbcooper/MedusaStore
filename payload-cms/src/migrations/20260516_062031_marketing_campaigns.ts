import { sql } from '@payloadcms/db-postgres'
import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_marketing_campaigns_channel" AS ENUM('email');
  CREATE TYPE "public"."enum_marketing_campaigns_audience_type" AS ENUM('all', 'email_consent', 'manual');
  CREATE TYPE "public"."enum_marketing_campaigns_status" AS ENUM('draft', 'launching', 'completed', 'failed');
  CREATE TABLE "marketing_campaigns_audience_customer_ids" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "marketing_campaigns" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"subject" varchar NOT NULL,
  	"channel" "enum_marketing_campaigns_channel" DEFAULT 'email' NOT NULL,
  	"html_content" varchar NOT NULL,
  	"plain_text" varchar,
  	"audience_type" "enum_marketing_campaigns_audience_type" DEFAULT 'email_consent' NOT NULL,
  	"frequency_cap_hours" numeric,
  	"frequency_cap_count" numeric,
  	"status" "enum_marketing_campaigns_status" DEFAULT 'draft' NOT NULL,
  	"medusa_campaign_id" varchar,
  	"medusa_status" varchar,
  	"total_selected" numeric,
  	"total_sent" numeric,
  	"total_skipped" numeric,
  	"total_failed" numeric,
  	"launched_at" timestamp(3) with time zone,
  	"completed_at" timestamp(3) with time zone,
  	"last_error" varchar,
  	"launch_result" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "marketing_campaigns_id" integer;
  ALTER TABLE "marketing_campaigns_audience_customer_ids" ADD CONSTRAINT "marketing_campaigns_audience_customer_ids_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "marketing_campaigns_audience_customer_ids_order_idx" ON "marketing_campaigns_audience_customer_ids" USING btree ("_order");
  CREATE INDEX "marketing_campaigns_audience_customer_ids_parent_id_idx" ON "marketing_campaigns_audience_customer_ids" USING btree ("_parent_id");
  CREATE INDEX "marketing_campaigns_updated_at_idx" ON "marketing_campaigns" USING btree ("updated_at");
  CREATE INDEX "marketing_campaigns_created_at_idx" ON "marketing_campaigns" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_marketing_campaigns_fk" FOREIGN KEY ("marketing_campaigns_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_marketing_campaigns_id_idx" ON "payload_locked_documents_rels" USING btree ("marketing_campaigns_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "marketing_campaigns_audience_customer_ids" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "marketing_campaigns" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "marketing_campaigns_audience_customer_ids" CASCADE;
  DROP TABLE "marketing_campaigns" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_marketing_campaigns_fk";
  
  DROP INDEX "payload_locked_documents_rels_marketing_campaigns_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "marketing_campaigns_id";
  DROP TYPE "public"."enum_marketing_campaigns_channel";
  DROP TYPE "public"."enum_marketing_campaigns_audience_type";
  DROP TYPE "public"."enum_marketing_campaigns_status";`)
}
