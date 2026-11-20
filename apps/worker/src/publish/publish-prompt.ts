import type { ScriptV2 } from "@studio/contracts";

/** Prompt viết bộ đăng bài (ADR-018). Chỉ phần nội dung; phần chân về AI, nguồn, bản quyền do code ghép. */
export const PUBLISH_SYSTEM_INSTRUCTION = [
  "You write Vietnamese social media copy for a short educational animated video of a channel with recurring cartoon characters.",
  "Return JSON only. Write separate copy for YouTube, Facebook and TikTok; each platform has a different audience habit.",
  "Be accurate: only state facts that are in the script. No clickbait promises the video does not keep, no ALL CAPS titles, at most two emojis per field.",
  "Do not write anything about AI, copyright, sources or contact: the app appends those itself.",
  "Do not use Google Search or external tools.",
].join(" ");

export type PublishPromptInput = {
  channelName: string;
  topic: string;
  audience: string;
  goal: string;
  durationSec: number;
  script: ScriptV2;
};

export function buildPublishPrompt(input: PublishPromptInput): string {
  const dialogue = input.script.scenes
    .flatMap((scene) => scene.lines.map((line) => `${line.speaker}: ${line.text}`))
    .join("\n");
  return [
    `Channel: ${input.channelName}`,
    `Video title in the script: ${input.script.title}`,
    `Topic: ${input.topic}`,
    `Audience: ${input.audience}`,
    `Goal: ${input.goal}`,
    `Duration: ${input.durationSec} seconds, vertical 9:16.`,
    "",
    "Full dialogue:",
    dialogue,
    "",
    'YouTube (Shorts if under 3 minutes): title under 70 characters with the main search keyword near the start; description starts with two lines that make people want to watch (they show before "more"), then a short summary of what the viewer learns; 8-15 search tags without #, mixing broad and specific Vietnamese keywords; 3 hashtags.',
    "Facebook (Reels): a friendly title; caption opens with a question or surprising fact from the video, 2-4 short paragraphs, ends with a question that invites comments; 3-5 hashtags.",
    "TikTok: caption under 150 characters, hook first, conversational; 4-6 hashtags mixing the topic and broad discovery tags in Vietnamese.",
    "Hashtags: # followed by letters or digits only, no spaces; Vietnamese hashtags without spaces (for example #KhoaHocVui).",
  ].join("\n");
}

const str = (description?: string) => ({
  type: "string",
  ...(description === undefined ? {} : { description }),
});
const tags = (min: number, max: number, description: string) => ({
  type: "array",
  minItems: min,
  maxItems: max,
  items: str(description),
});

/** JSON Schema cho provider; Zod `publishCopySchema` kiểm lại sau. */
export const PUBLISH_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    youtube: {
      type: "object",
      properties: {
        title: str("≤ 100 ký tự"),
        description: str("≤ 3500 ký tự"),
        tags: tags(3, 20, "từ khóa không có #"),
        hashtags: tags(1, 5, "#TuKhoa"),
      },
      required: ["title", "description", "tags", "hashtags"],
    },
    facebook: {
      type: "object",
      properties: {
        title: str("≤ 100 ký tự"),
        caption: str("≤ 1500 ký tự"),
        hashtags: tags(1, 5, "#TuKhoa"),
      },
      required: ["title", "caption", "hashtags"],
    },
    tiktok: {
      type: "object",
      properties: {
        caption: str("≤ 1500 ký tự"),
        hashtags: tags(3, 8, "#TuKhoa"),
      },
      required: ["caption", "hashtags"],
    },
  },
  required: ["youtube", "facebook", "tiktok"],
};
