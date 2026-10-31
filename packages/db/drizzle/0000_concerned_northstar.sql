CREATE TYPE "public"."agent_run_role" AS ENUM('producer', 'research', 'script', 'visual', 'voice', 'video', 'qa');--> statement-breakpoint
CREATE TYPE "public"."agent_run_status" AS ENUM('idle', 'queued', 'running', 'waiting_approval', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."approval_decision" AS ENUM('approved', 'rejected', 'changes_requested');--> statement-breakpoint
CREATE TYPE "public"."approval_gate" AS ENUM('script', 'final');--> statement-breakpoint
CREATE TYPE "public"."artifact_type" AS ENUM('fetch_log', 'research', 'script', 'storyboard', 'audio', 'alignment', 'captions', 'caption_override', 'render_props', 'preview', 'qa_report', 'export');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('workflow.transition', 'agent.status', 'job.progress', 'job.completed', 'job.failed', 'approval.recorded');--> statement-breakpoint
CREATE TYPE "public"."job_queue" AS ENUM('llm', 'media', 'render');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('queued', 'running', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."reference_kind" AS ENUM('user_file', 'user_url', 'fetched_url');--> statement-breakpoint
CREATE TYPE "public"."voice_profile_kind" AS ENUM('preset', 'clone');--> statement-breakpoint
CREATE TYPE "public"."workflow_resume_from" AS ENUM('researching', 'scripting', 'producing_assets', 'preview_rendering', 'qa', 'exporting');--> statement-breakpoint
CREATE TYPE "public"."workflow_run_status" AS ENUM('idea_submitted', 'researching', 'research_ready', 'scripting', 'waiting_script_approval', 'producing_assets', 'preview_rendering', 'qa', 'waiting_final_approval', 'exporting', 'exported', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "agent_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_run_id" uuid NOT NULL,
	"role" "agent_run_role" NOT NULL,
	"status" "agent_run_status" NOT NULL,
	"attempt" integer DEFAULT 0 NOT NULL,
	"input_hash" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"error_code" text,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_run_id" uuid NOT NULL,
	"gate" "approval_gate" NOT NULL,
	"decision" "approval_decision" NOT NULL,
	"artifact_id" uuid NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "artifact_dependencies" (
	"artifact_id" uuid NOT NULL,
	"parent_artifact_id" uuid NOT NULL,
	CONSTRAINT "artifact_dependencies_artifact_id_parent_artifact_id_pk" PRIMARY KEY("artifact_id","parent_artifact_id"),
	CONSTRAINT "artifact_dependencies_no_self" CHECK ("artifact_dependencies"."artifact_id" <> "artifact_dependencies"."parent_artifact_id")
);
--> statement-breakpoint
CREATE TABLE "artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"workflow_run_id" uuid NOT NULL,
	"type" "artifact_type" NOT NULL,
	"version" integer NOT NULL,
	"schema_version" text NOT NULL,
	"content_hash" text NOT NULL,
	"storage_key" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "artifacts_storage_key_safe" CHECK ("artifacts"."storage_key" NOT LIKE '%..%' AND "artifacts"."storage_key" NOT LIKE '/%')
);
--> statement-breakpoint
CREATE TABLE "briefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"topic" text NOT NULL,
	"audience" text NOT NULL,
	"goal" text NOT NULL,
	"duration_sec" integer NOT NULL,
	"language" text NOT NULL,
	"tone" text NOT NULL,
	"visual_style" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "briefs_duration_sec_range" CHECK ("briefs"."duration_sec" >= 30 AND "briefs"."duration_sec" <= 90)
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"workflow_run_id" uuid NOT NULL,
	"agent_run_id" uuid,
	"job_id" uuid,
	"type" "event_type" NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_run_id" uuid NOT NULL,
	"queue" "job_queue" NOT NULL,
	"idempotency_key" text NOT NULL,
	"bullmq_job_id" text,
	"status" "job_status" NOT NULL,
	"attempt" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 2 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "references" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"kind" "reference_kind" NOT NULL,
	"uri" text NOT NULL,
	"title" text,
	"media_type" text,
	"byte_size" integer,
	"content_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_run_id" uuid NOT NULL,
	"agent_run_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"thinking_tokens" integer DEFAULT 0 NOT NULL,
	"estimated_cost_usd" numeric(12, 6) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voice_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"provider_voice_id" text NOT NULL,
	"display_name" text NOT NULL,
	"kind" "voice_profile_kind" NOT NULL,
	"consent_recorded_at" timestamp with time zone,
	"enabled" boolean DEFAULT false NOT NULL,
	CONSTRAINT "voice_profiles_clone_requires_consent" CHECK (("voice_profiles"."kind" <> 'clone') OR ("voice_profiles"."consent_recorded_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "workflow_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"brief_id" uuid NOT NULL,
	"status" "workflow_run_status" NOT NULL,
	"resume_from" "workflow_resume_from",
	"failure_code" text,
	"failure_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_workflow_run_id_workflow_runs_id_fk" FOREIGN KEY ("workflow_run_id") REFERENCES "public"."workflow_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_workflow_run_id_workflow_runs_id_fk" FOREIGN KEY ("workflow_run_id") REFERENCES "public"."workflow_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_artifact_id_artifacts_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "public"."artifacts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifact_dependencies" ADD CONSTRAINT "artifact_dependencies_artifact_id_artifacts_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "public"."artifacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifact_dependencies" ADD CONSTRAINT "artifact_dependencies_parent_artifact_id_artifacts_id_fk" FOREIGN KEY ("parent_artifact_id") REFERENCES "public"."artifacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_workflow_run_id_workflow_runs_id_fk" FOREIGN KEY ("workflow_run_id") REFERENCES "public"."workflow_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "briefs" ADD CONSTRAINT "briefs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_workflow_run_id_workflow_runs_id_fk" FOREIGN KEY ("workflow_run_id") REFERENCES "public"."workflow_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_agent_run_id_agent_runs_id_fk" FOREIGN KEY ("agent_run_id") REFERENCES "public"."agent_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_agent_run_id_agent_runs_id_fk" FOREIGN KEY ("agent_run_id") REFERENCES "public"."agent_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "references" ADD CONSTRAINT "references_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_workflow_run_id_workflow_runs_id_fk" FOREIGN KEY ("workflow_run_id") REFERENCES "public"."workflow_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_agent_run_id_agent_runs_id_fk" FOREIGN KEY ("agent_run_id") REFERENCES "public"."agent_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_brief_id_briefs_id_fk" FOREIGN KEY ("brief_id") REFERENCES "public"."briefs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_workflow_run_id_id_idx" ON "events" USING btree ("workflow_run_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_idempotency_key_unique" ON "jobs" USING btree ("idempotency_key");