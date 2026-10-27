import { z } from "zod/v4";

const sceneIdSchema = z.string().regex(/^[a-z0-9-]{1,40}$/);

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

const sceneBaseSchema = z.object({
  id: sceneIdSchema,
  narration: z.string().min(1).max(600),
  onScreenText: z.string().min(1).max(120),
  visualIntent: z.string().min(1).max(400),
});

const titleSceneSchema = sceneBaseSchema
  .extend({
    templateSlot: z.literal("title"),
  })
  .strict();

const explainSceneSchema = sceneBaseSchema
  .extend({
    templateSlot: z.literal("explain"),
  })
  .strict();

const codeSceneSchema = sceneBaseSchema
  .extend({
    templateSlot: z.literal("code"),
    codeSnippet: codeSnippetSchema,
  })
  .strict();

const diagramSceneSchema = sceneBaseSchema
  .extend({
    templateSlot: z.literal("diagram"),
    diagram: diagramSchema,
  })
  .strict();

const ctaSceneSchema = sceneBaseSchema
  .extend({
    templateSlot: z.literal("cta"),
  })
  .strict();

export const sceneSchema = z.discriminatedUnion("templateSlot", [
  titleSceneSchema,
  explainSceneSchema,
  codeSceneSchema,
  diagramSceneSchema,
  ctaSceneSchema,
]);

export const scriptSourceSchema = z
  .object({
    id: z.string().min(1).max(40),
    title: z.string().min(1).max(200),
    url: z.url().optional(),
  })
  .strict();

export const scriptSchema = z
  .object({
    schemaVersion: z.literal(1),
    language: z.literal("vi"),
    title: z.string().min(1).max(80),
    hook: z.string().min(1).max(400),
    scenes: z.array(sceneSchema).min(3).max(8),
    cta: z.string().min(1).max(240),
    sources: z.array(scriptSourceSchema),
  })
  .strict()
  .superRefine((data, ctx) => {
    const first = data.scenes[0];
    if (first?.templateSlot !== "title") {
      ctx.addIssue({
        code: "custom",
        message: "Scene đầu phải có templateSlot title",
        path: ["scenes", 0, "templateSlot"],
      });
    }

    const lastIndex = data.scenes.length - 1;
    const last = data.scenes[lastIndex];
    if (last?.templateSlot !== "cta") {
      ctx.addIssue({
        code: "custom",
        message: "Scene cuối phải có templateSlot cta",
        path: ["scenes", lastIndex, "templateSlot"],
      });
    }

    const seen = new Set<string>();
    for (let i = 0; i < data.scenes.length; i++) {
      const id = data.scenes[i]?.id;
      if (id === undefined) {
        continue;
      }
      if (seen.has(id)) {
        ctx.addIssue({
          code: "custom",
          message: `Scene id trùng: ${id}`,
          path: ["scenes", i, "id"],
        });
      }
      seen.add(id);
    }
  });

export type Script = z.infer<typeof scriptSchema>;
export type Scene = z.infer<typeof sceneSchema>;
export type ScriptSource = z.infer<typeof scriptSourceSchema>;
export type CodeSnippet = z.infer<typeof codeSnippetSchema>;
export type Diagram = z.infer<typeof diagramSchema>;

export function parseScript(input: unknown): Script {
  return scriptSchema.parse(input);
}

export function safeParseScript(input: unknown) {
  return scriptSchema.safeParse(input);
}
