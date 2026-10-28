import { type RemotionCaption, remotionCaptionSchema, type sceneSchema } from "@studio/contracts";
import { z } from "zod/v4";

export const EDU_VERTICAL_TEMPLATE_ID = "EduVertical" as const;
export const EDU_VERTICAL_TEMPLATE_VERSION = "1.0.0";
export const EDU_VERTICAL_COMPOSITION_ID = "EduVertical";

export const MVP_WIDTH = 1080;
export const MVP_HEIGHT = 1920;
export const MVP_FPS = 30;

const renderSceneBaseSchema = z.object({
  sceneId: z.string().regex(/^[a-z0-9-]{1,40}$/),
  fromMs: z.number().int().nonnegative(),
  durationMs: z.number().int().positive(),
  onScreenText: z.string().min(1).max(120),
  visualIntent: z.string().min(1).max(400),
});

const codeLanguageSchema = z.enum(["ts", "sql", "json", "bash", "text"]);

const codeSnippetSchema = z
  .object({
    language: codeLanguageSchema,
    code: z.string().min(1).max(800),
  })
  .strict();

const diagramNodeSchema = z
  .object({
    id: z.string().min(1).max(40),
    label: z.string().min(1).max(120),
  })
  .strict();

const diagramEdgeSchema = z
  .object({
    from: z.string().min(1).max(40),
    to: z.string().min(1).max(40),
    label: z.string().min(1).max(120).optional(),
  })
  .strict();

const diagramSchema = z
  .object({
    nodes: z.array(diagramNodeSchema).max(6),
    edges: z.array(diagramEdgeSchema).max(8),
  })
  .strict();

const titleRenderSceneSchema = renderSceneBaseSchema
  .extend({
    templateSlot: z.literal("title"),
    headline: z.string().min(1).max(80),
    hook: z.string().min(1).max(400).optional(),
  })
  .strict();

const explainRenderSceneSchema = renderSceneBaseSchema
  .extend({
    templateSlot: z.literal("explain"),
  })
  .strict();

const codeRenderSceneSchema = renderSceneBaseSchema
  .extend({
    templateSlot: z.literal("code"),
    codeSnippet: codeSnippetSchema,
  })
  .strict();

const diagramRenderSceneSchema = renderSceneBaseSchema
  .extend({
    templateSlot: z.literal("diagram"),
    diagram: diagramSchema,
  })
  .strict();

const ctaRenderSceneSchema = renderSceneBaseSchema
  .extend({
    templateSlot: z.literal("cta"),
    ctaText: z.string().min(1).max(240),
  })
  .strict();

export const eduVerticalRenderSceneSchema = z.discriminatedUnion("templateSlot", [
  titleRenderSceneSchema,
  explainRenderSceneSchema,
  codeRenderSceneSchema,
  diagramRenderSceneSchema,
  ctaRenderSceneSchema,
]);

export type EduVerticalRenderScene = z.infer<typeof eduVerticalRenderSceneSchema>;

const audioSchema = z
  .object({
    storageKey: z.string().min(1),
    durationMs: z.number().int().positive(),
    /** Absolute path or URL injected by render CLI; optional in stored artifact. */
    src: z.string().min(1).optional(),
  })
  .strict();

export const eduVerticalRenderPropsSchema = z
  .object({
    templateId: z.literal(EDU_VERTICAL_TEMPLATE_ID),
    templateVersion: z.string().min(1),
    fps: z.literal(MVP_FPS),
    width: z.literal(MVP_WIDTH),
    height: z.literal(MVP_HEIGHT),
    audio: audioSchema,
    scenes: z.array(eduVerticalRenderSceneSchema).min(1).max(8),
    captions: z.array(remotionCaptionSchema),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.scenes[0]?.templateSlot !== "title") {
      ctx.addIssue({
        code: "custom",
        message: "First scene must use templateSlot title",
        path: ["scenes", 0, "templateSlot"],
      });
    }
    const lastIndex = value.scenes.length - 1;
    if (value.scenes[lastIndex]?.templateSlot !== "cta") {
      ctx.addIssue({
        code: "custom",
        message: "Last scene must use templateSlot cta",
        path: ["scenes", lastIndex, "templateSlot"],
      });
    }

    for (let index = 0; index < value.scenes.length; index += 1) {
      const scene = value.scenes[index];
      if (!scene) {
        continue;
      }
      const expectedFrom =
        index === 0
          ? 0
          : (value.scenes[index - 1]?.fromMs ?? 0) + (value.scenes[index - 1]?.durationMs ?? 0);
      if (scene.fromMs !== expectedFrom) {
        ctx.addIssue({
          code: "custom",
          message: `Scene ${scene.sceneId} fromMs must be ${expectedFrom}`,
          path: ["scenes", index, "fromMs"],
        });
      }
    }

    for (const caption of value.captions) {
      if (caption.endMs <= caption.startMs) {
        ctx.addIssue({
          code: "custom",
          message: "Caption endMs must be after startMs",
          path: ["captions"],
        });
        break;
      }
    }
  });

export type EduVerticalRenderProps = z.infer<typeof eduVerticalRenderPropsSchema>;

export class RenderPropsError extends Error {
  readonly code = "render_props_invalid" as const;

  constructor(message: string) {
    super(message);
    this.name = "RenderPropsError";
  }
}

export function parseEduVerticalRenderProps(input: unknown): EduVerticalRenderProps {
  const parsed = eduVerticalRenderPropsSchema.safeParse(input);
  if (!parsed.success) {
    throw new RenderPropsError(parsed.error.message);
  }
  return parsed.data;
}

/** Ensures storyboard scene ids match script slots (structural check for fixtures). */
export function assertSceneSlotsMatchScript(
  scenes: EduVerticalRenderScene[],
  scriptScenes: z.infer<typeof sceneSchema>[],
): void {
  if (scenes.length !== scriptScenes.length) {
    throw new RenderPropsError("Scene count mismatch between render props and script");
  }
  for (let index = 0; index < scenes.length; index += 1) {
    const renderScene = scenes[index];
    const scriptScene = scriptScenes[index];
    if (!renderScene || !scriptScene) {
      throw new RenderPropsError("Missing scene at index");
    }
    if (renderScene.sceneId !== scriptScene.id) {
      throw new RenderPropsError(`sceneId mismatch at index ${index}`);
    }
    if (renderScene.templateSlot !== scriptScene.templateSlot) {
      throw new RenderPropsError(`templateSlot mismatch at ${renderScene.sceneId}`);
    }
  }
}

export type { RemotionCaption };
