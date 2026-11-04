import { pgEnum } from "drizzle-orm/pg-core";

/** docs/04-AGENT-ORCHESTRATION.md workflow diagram + cancelled/exported/failed */
export const workflowRunStatusEnum = pgEnum("workflow_run_status", [
  "idea_submitted",
  "researching",
  "research_ready",
  "scripting",
  // Phase 6 (P6-10): dựng storyboard ảnh tĩnh của script `2` trước cổng script (ADR-014).
  "storyboarding",
  "waiting_script_approval",
  "producing_assets",
  "preview_rendering",
  "qa",
  "waiting_final_approval",
  "exporting",
  "exported",
  "failed",
  "cancelled",
]);

export const workflowResumeFromEnum = pgEnum("workflow_resume_from", [
  "researching",
  "scripting",
  "producing_assets",
  "preview_rendering",
  "qa",
  "exporting",
]);

export const agentRunRoleEnum = pgEnum("agent_run_role", [
  "producer",
  "research",
  "script",
  "visual",
  "voice",
  "video",
  "qa",
]);

export const agentRunStatusEnum = pgEnum("agent_run_status", [
  "idle",
  "queued",
  "running",
  "waiting_approval",
  "completed",
  "failed",
  "cancelled",
]);

export const jobQueueEnum = pgEnum("job_queue", ["llm", "media", "render"]);

/** Values cited in docs/02-SYSTEM-ARCHITECTURE.md and docs/04-AGENT-ORCHESTRATION.md */
export const jobStatusEnum = pgEnum("job_status", [
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
]);

export const artifactTypeEnum = pgEnum("artifact_type", [
  "fetch_log",
  "research",
  "script",
  "storyboard",
  "audio",
  "alignment",
  "captions",
  "caption_override",
  "render_props",
  "preview",
  "qa_report",
  "export",
]);

export const approvalGateEnum = pgEnum("approval_gate", ["script", "final"]);

export const approvalDecisionEnum = pgEnum("approval_decision", [
  "approved",
  "rejected",
  "changes_requested",
]);

export const eventTypeEnum = pgEnum("event_type", [
  "workflow.transition",
  "agent.status",
  "job.progress",
  "job.completed",
  "job.failed",
  "approval.recorded",
]);

export const referenceKindEnum = pgEnum("reference_kind", [
  "user_file",
  "user_url",
  "fetched_url",
]);

export const voiceProfileKindEnum = pgEnum("voice_profile_kind", ["preset", "clone"]);
