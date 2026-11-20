ALTER TYPE "public"."agent_run_role" ADD VALUE 'publish';--> statement-breakpoint
ALTER TYPE "public"."artifact_type" ADD VALUE 'publish_kit';--> statement-breakpoint
ALTER TABLE "brand_profiles" ADD COLUMN "copyright_contact" text;