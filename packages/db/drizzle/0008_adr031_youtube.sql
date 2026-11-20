ALTER TYPE "public"."artifact_type" ADD VALUE 'youtube_upload';--> statement-breakpoint
ALTER TYPE "public"."job_queue" ADD VALUE 'upload';--> statement-breakpoint
CREATE TABLE "youtube_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_profile_id" uuid NOT NULL,
	"channel_id" text NOT NULL,
	"channel_title" text NOT NULL,
	"channel_thumbnail" text,
	"refresh_token_enc" text NOT NULL,
	"scopes" text NOT NULL,
	"last_error" text,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "youtube_connections_brand_unique" UNIQUE("brand_profile_id")
);
--> statement-breakpoint
CREATE TABLE "youtube_uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"workflow_run_id" uuid NOT NULL,
	"export_artifact_id" uuid NOT NULL,
	"brand_profile_id" uuid NOT NULL,
	"request" jsonb NOT NULL,
	"session_uri" text,
	"video_id" text,
	"thumbnail" text DEFAULT 'pending' NOT NULL,
	"thumbnail_reason" text,
	"result_artifact_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "youtube_uploads_job_unique" UNIQUE("job_id"),
	CONSTRAINT "youtube_uploads_thumbnail_valid" CHECK ("youtube_uploads"."thumbnail" IN ('pending', 'set', 'failed', 'skipped'))
);
--> statement-breakpoint
ALTER TABLE "youtube_connections" ADD CONSTRAINT "youtube_connections_brand_profile_id_brand_profiles_id_fk" FOREIGN KEY ("brand_profile_id") REFERENCES "public"."brand_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "youtube_uploads" ADD CONSTRAINT "youtube_uploads_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "youtube_uploads" ADD CONSTRAINT "youtube_uploads_workflow_run_id_workflow_runs_id_fk" FOREIGN KEY ("workflow_run_id") REFERENCES "public"."workflow_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "youtube_uploads" ADD CONSTRAINT "youtube_uploads_export_artifact_id_artifacts_id_fk" FOREIGN KEY ("export_artifact_id") REFERENCES "public"."artifacts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "youtube_uploads" ADD CONSTRAINT "youtube_uploads_brand_profile_id_brand_profiles_id_fk" FOREIGN KEY ("brand_profile_id") REFERENCES "public"."brand_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "youtube_uploads" ADD CONSTRAINT "youtube_uploads_result_artifact_id_artifacts_id_fk" FOREIGN KEY ("result_artifact_id") REFERENCES "public"."artifacts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "youtube_uploads_export_idx" ON "youtube_uploads" USING btree ("export_artifact_id");