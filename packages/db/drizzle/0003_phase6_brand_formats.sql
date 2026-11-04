CREATE TABLE "brand_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"display_name" text NOT NULL,
	"palette" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"fonts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"intro_asset_id" text,
	"outro_asset_id" text,
	"sonic_logo_asset_id" text,
	"tone_rules" text DEFAULT '' NOT NULL,
	"narrator_voice_id" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brand_profiles_slug_format" CHECK ("brand_profiles"."slug" ~ '^[a-z0-9-]{1,40}$')
);
--> statement-breakpoint
CREATE TABLE "brand_characters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_profile_id" uuid NOT NULL,
	"character_key" text NOT NULL,
	"display_name" text NOT NULL,
	"role" text NOT NULL,
	"skin_asset_id" text NOT NULL,
	"personality" text DEFAULT '' NOT NULL,
	"catchphrases" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"signature_action_id" text,
	"speaks" boolean NOT NULL,
	"voice_id" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brand_characters_key_format" CHECK ("brand_characters"."character_key" ~ '^[a-z][a-z0-9_]{0,31}$' AND "brand_characters"."character_key" <> 'narrator'),
	CONSTRAINT "brand_characters_role_valid" CHECK ("brand_characters"."role" IN ('protagonist', 'explainer', 'companion')),
	CONSTRAINT "brand_characters_voice_only_if_speaks" CHECK ("brand_characters"."speaks" OR "brand_characters"."voice_id" IS NULL)
);
--> statement-breakpoint
ALTER TABLE "brand_characters" ADD CONSTRAINT "brand_characters_brand_profile_id_brand_profiles_id_fk" FOREIGN KEY ("brand_profile_id") REFERENCES "public"."brand_profiles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "brand_profiles_slug_unique" ON "brand_profiles" USING btree ("slug");
--> statement-breakpoint
CREATE UNIQUE INDEX "brand_profiles_single_default" ON "brand_profiles" USING btree ("is_default") WHERE "brand_profiles"."is_default";
--> statement-breakpoint
CREATE UNIQUE INDEX "brand_characters_key_unique" ON "brand_characters" USING btree ("brand_profile_id","character_key");
--> statement-breakpoint
-- P6-07: kênh mặc định cho project (ADR-013). Project cũ nhận kênh này khi thêm cột.
CREATE OR REPLACE FUNCTION studio_default_brand_profile_id() RETURNS uuid
LANGUAGE sql STABLE AS $$ SELECT "id" FROM "brand_profiles" WHERE "is_default" LIMIT 1 $$;
--> statement-breakpoint
-- Seed kênh mặc định. Không chứa tên giọng: `narrator_voice_id`, `voice_id` để null cho Director chọn.
INSERT INTO "brand_profiles" ("slug", "display_name", "palette", "fonts", "tone_rules", "is_default")
VALUES (
	'kenh-mac-dinh',
	'Kênh mặc định',
	'{"ink": "#1f2a44", "paper": "#f4efe6", "accent": "#f26b3a", "screen": "#8fe9ff", "leaf": "#6cc04a"}'::jsonb,
	'{"heading": "system-ui", "body": "system-ui"}'::jsonb,
	'Giọng thân thiện, câu ngắn, tiếng Việt tự nhiên. Câu khẳng định sự thật phải có nguồn trong research.',
	true
)
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "brand_characters" (
	"brand_profile_id", "character_key", "display_name", "role", "skin_asset_id", "personality", "speaks", "sort_order"
)
SELECT bp."id", c."character_key", c."display_name", c."role", c."skin_asset_id", c."personality", c."speaks", c."sort_order"
FROM "brand_profiles" bp
CROSS JOIN (VALUES
	('ti', 'Tí', 'protagonist', 'skin_ti', 'Nhân vật chính, tò mò, hay hỏi và hay gặp rắc rối.', true, 1),
	('bit', 'Bit', 'explainer', 'skin_bit', 'Robot linh vật, bình tĩnh, giải thích và đưa dữ kiện có nguồn.', true, 2),
	('dau', 'Đậu', 'companion', 'skin_dau', 'Bạn đồng hành không thoại, phản ứng bằng biểu cảm và âm thanh.', false, 3)
) AS c("character_key", "display_name", "role", "skin_asset_id", "personality", "speaks", "sort_order")
WHERE bp."slug" = 'kenh-mac-dinh'
ON CONFLICT DO NOTHING;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "brand_profile_id" uuid DEFAULT studio_default_brand_profile_id() NOT NULL;
--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_brand_profile_id_brand_profiles_id_fk" FOREIGN KEY ("brand_profile_id") REFERENCES "public"."brand_profiles"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE "motion_asset_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_run_id" uuid NOT NULL,
	"script_artifact_id" uuid NOT NULL,
	"variant_index" integer NOT NULL,
	"scene_id" text NOT NULL,
	"request_key" text NOT NULL,
	"kind" text NOT NULL,
	"description" text NOT NULL,
	"fallback_asset_id" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"fulfilled_asset_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "motion_asset_requests_variant_valid" CHECK ("motion_asset_requests"."variant_index" IN (1, 2)),
	CONSTRAINT "motion_asset_requests_kind_valid" CHECK ("motion_asset_requests"."kind" IN ('character_skin', 'expression', 'pose', 'action', 'background', 'prop', 'camera', 'sfx', 'brand_card')),
	CONSTRAINT "motion_asset_requests_status_valid" CHECK ("motion_asset_requests"."status" IN ('open', 'fulfilled', 'dismissed')),
	CONSTRAINT "motion_asset_requests_fulfilled" CHECK (("motion_asset_requests"."status" = 'fulfilled') = ("motion_asset_requests"."fulfilled_asset_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "motion_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" text NOT NULL,
	"kind" text NOT NULL,
	"version" text NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"brand_profile_id" uuid,
	"created_by" text NOT NULL,
	"status" text NOT NULL,
	"source_path" text NOT NULL,
	"preview_storage_key" text,
	"manifest_hash" text NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "motion_assets_asset_id_format" CHECK ("motion_assets"."asset_id" ~ '^[a-z0-9_]{1,64}$'),
	CONSTRAINT "motion_assets_kind_valid" CHECK ("motion_assets"."kind" IN ('character_skin', 'expression', 'pose', 'action', 'background', 'prop', 'camera', 'sfx', 'brand_card')),
	CONSTRAINT "motion_assets_created_by_valid" CHECK ("motion_assets"."created_by" IN ('director', 'claude-code')),
	CONSTRAINT "motion_assets_status_valid" CHECK ("motion_assets"."status" IN ('candidate', 'approved')),
	CONSTRAINT "motion_assets_paths_safe" CHECK ("motion_assets"."source_path" NOT LIKE '%..%' AND "motion_assets"."source_path" NOT LIKE '/%' AND ("motion_assets"."preview_storage_key" IS NULL OR ("motion_assets"."preview_storage_key" NOT LIKE '%..%' AND "motion_assets"."preview_storage_key" NOT LIKE '/%')))
);
--> statement-breakpoint
ALTER TABLE "briefs" DROP CONSTRAINT "briefs_duration_sec_range";
--> statement-breakpoint
ALTER TABLE "briefs" ADD COLUMN "format_id" text DEFAULT 'explainer' NOT NULL;
--> statement-breakpoint
ALTER TABLE "briefs" ADD COLUMN "format_version" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD COLUMN "creative_mode" text DEFAULT 'standard' NOT NULL;
--> statement-breakpoint
ALTER TABLE "motion_asset_requests" ADD CONSTRAINT "motion_asset_requests_workflow_run_id_workflow_runs_id_fk" FOREIGN KEY ("workflow_run_id") REFERENCES "public"."workflow_runs"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "motion_asset_requests" ADD CONSTRAINT "motion_asset_requests_script_artifact_id_artifacts_id_fk" FOREIGN KEY ("script_artifact_id") REFERENCES "public"."artifacts"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "motion_assets" ADD CONSTRAINT "motion_assets_brand_profile_id_brand_profiles_id_fk" FOREIGN KEY ("brand_profile_id") REFERENCES "public"."brand_profiles"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "motion_asset_requests_key_unique" ON "motion_asset_requests" USING btree ("script_artifact_id","variant_index","request_key");
--> statement-breakpoint
CREATE INDEX "motion_asset_requests_run_idx" ON "motion_asset_requests" USING btree ("workflow_run_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "motion_assets_asset_id_unique" ON "motion_assets" USING btree ("asset_id");
--> statement-breakpoint
ALTER TABLE "briefs" ADD CONSTRAINT "briefs_duration_sec_range" CHECK ("briefs"."duration_sec" >= 10 AND "briefs"."duration_sec" <= 600);
--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_creative_mode_valid" CHECK ("workflow_runs"."creative_mode" IN ('standard', 'creative'));
