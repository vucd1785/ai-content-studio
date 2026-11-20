import { MUSIC_MOODS, MUSIC_TRACKS } from "@studio/audio-kit";
import {
  AMBIENCE_KINDS,
  type CastMember,
  type CatalogAsset,
  type CreativeMode,
  EFFECT_KINDS,
  type FormatPack,
  ILLUSTRATION_REQUEST_IDS,
  ILLUSTRATION_STYLES,
  MAX_ACTORS_BY_SHOT_SIZE,
  MAX_ASSET_REQUESTS,
  MOOD_KINDS,
  NARRATOR,
  OUTFIT_KINDS,
  OUTRO_BEAT,
  REQUESTABLE_ASSET_KINDS,
  SHOT_SIZES,
  shotsNeededForDuration,
  TITLE_BEAT,
} from "@studio/contracts";
import type { BriefInput } from "./types.js";

/**
 * Prompt và schema sinh của script `2` (P6-10; 04 mục Job và retry; 05 mục Script JSON v2).
 * Gửi LLM dạng `flat` của spike P6-01: `lines[]`, `shots[]` cùng cấp trong một phương án, gắn `sceneId`;
 * nhân vật của shot là `actor1`, `actor2`, `actor3` (bổ sung ADR-013 2026-11-03: người thứ ba chỉ ở cỡ `wide`, `high`). Adapter đổi về dạng lồng nhau rồi mới chạy Zod.
 */

/** Nhân vật của kênh như prompt cần: tên, tính cách, có nói không, câu cửa miệng. */
export type CastProfile = CastMember & {
  displayName: string;
  role: string;
  personality: string;
  catchphrases: string[];
};

export type CatalogEntry = CatalogAsset & {
  description: string;
  tags: string[];
  /** Tài sản tự tạo (ADR-017); khi hòa điểm, tài sản gốc của kit được ưu tiên. */
  generated?: boolean;
};

export type ScriptV2GenerationInput = {
  brief: Omit<BriefInput, "durationSec"> & { durationSec: number };
  format: FormatPack;
  cast: readonly CastProfile[];
  /** Tài sản được phép dùng: `approved` của kho, chung hoặc của kênh. */
  assetCatalog: readonly CatalogEntry[];
  mode: CreativeMode;
  /** Quy tắc giọng điệu của kênh (`brand_profiles.tone_rules`). */
  toneRules: string;
  researchSummary?: string;
  /** Nguồn research đánh id để nhịp cần nguồn trỏ vào. */
  researchSources?: readonly { id: string; title: string; url?: string }[];
  directorNote?: string;
  /** ADR-030: tài sản ảnh thật Director tải lên cho video này; prompt dặn dùng chúng. */
  directorImageIds?: readonly string[];
};

const SYSTEM_INSTRUCTION = [
  "You write Vietnamese short-form animated video scripts for a channel with recurring cartoon characters.",
  "Return JSON only, no markdown fences. Produce exactly two distinct variants in field variants.",
  "Each variant is a dialogue between the channel characters, cut into scenes that follow the format beats in order.",
  "Lines and shots are flat arrays at variant level, each tagged with sceneId. Every scene needs at least one line and one shot.",
  "Use only the asset ids, character keys and enums given in the schema. Never invent ids.",
  "The video is animation only: no on-screen text, no code boxes, no diagrams. Show ideas with actions, expressions, props, backgrounds and picture-only illustrations that appear in the scene itself or on a whiteboard.",
  "Do not use Google Search or external tools.",
].join(" ");

export function scriptV2SystemInstruction(): string {
  return SYSTEM_INSTRUCTION;
}

function catalogLines(catalog: readonly CatalogEntry[]): string[] {
  const kinds = [...new Set(catalog.map((a) => a.kind))];
  return kinds.flatMap((kind) => [
    `${kind}:`,
    ...catalog
      .filter((a) => a.kind === kind)
      .map(
        (a) => `  - ${a.id}: ${a.description}${a.tags.length > 0 ? ` [${a.tags.join(", ")}]` : ""}`,
      ),
  ]);
}

/**
 * Luật mở và kết. Gói có nhịp `title`/`outro` (ADR-026): mở bằng câu đọc tiêu đề trên hình tượng trưng, kết bằng
 * cảnh mời theo dõi mà code dựng hình. Gói cũ giữ luật kết của ADR-020.
 */
function openingAndEndingRules(format: FormatPack): string[] {
  const beats = new Set(format.beats.map((b) => b.id));
  const out: string[] = [];
  if (beats.has(TITLE_BEAT)) {
    out.push(
      `Opening (beat ${TITLE_BEAT}): exactly one short scene before the story, 1-2 shots, about 3 seconds. Its only line is the variant title read aloud as is (the same words as the title field), spoken by one character. The shots show one picture that symbolises the topic: the character beside a prop or illustration of the main subject, mood wonder, effects sparkle, a wide or medium shot. The story (the next beat) starts right after with its own hook. The opening and ending scenes count toward the limit of 8 scenes.`,
    );
  }
  if (beats.has(OUTRO_BEAT)) {
    out.push(
      `Ending (beat ${OUTRO_BEAT}): exactly one last scene with exactly one line and one shot. The line invites viewers to follow the characters to learn more fun facts, spoken as the characters themselves ("chúng mình"), warm and short (under 80 characters), for example "Follow chúng mình để biết thêm nhiều kiến thức thú vị nhé!". This line and the opening title line are shown as large white text cards instead of captions. Code draws this shot itself (all characters together pointing at the follow button), so any actors, background and shotSize you give it are only a draft. The scene before it (the payoff) ends with a question for viewers to answer in the comments.`,
    );
  } else {
    out.push(
      "Ending: the last scene ends with one short spoken line that invites viewers to follow the channel or asks them a question to answer in the comments. It is spoken by a character; never on-screen text.",
    );
  }
  return out;
}

/** Prompt người dùng: brief, gói thể loại, dàn nhân vật, giọng điệu kênh, kho tài sản, luật nhịp. */
export function buildScriptV2Prompt(input: ScriptV2GenerationInput): string {
  const { brief, format } = input;
  const shots = shotsNeededForDuration(format, brief.durationSec);
  const speakers = input.cast.filter((c) => c.speaks).map((c) => c.characterKey);
  const lines = [
    "Write two script variants for this brief.",
    `topic: ${brief.topic}`,
    `audience: ${brief.audience}`,
    `goal: ${brief.goal}`,
    `durationSec: ${brief.durationSec}`,
    `tone: ${brief.tone}`,
    `visualStyle: ${brief.visualStyle}`,
  ];
  if (brief.notes?.trim()) {
    lines.push(`notes: ${brief.notes.trim()}`);
  }
  lines.push(
    "",
    `Format: ${format.id} v${format.version} (${format.displayName}). Beats in this exact order, each used by at least one scene:`,
    ...format.beats.map(
      (b) =>
        `  - ${b.id}: ${b.label}${b.requiresSource ? " (must cite at least one source id in sourceIds)" : ""}`,
    ),
    `Pacing: ${format.pacing.cutsPerMinute.min}-${format.pacing.cutsPerMinute.max} shots per minute, about ${shots.min}-${shots.max} shots for this duration; no shot longer than ${format.pacing.maxStaticSec} seconds of speech; two consecutive shots (also across scenes) never share the same shotSize.`,
    // ADR-024: luật dựng hình, khớp `reviewScriptV2` (few_shot_sizes, no_reaction_shot, repeated_action).
    "Editing, like a professional animated short: (1) open each scene with a wide or high shot that shows where we are, then move closer (medium, then close for the strongest emotion or the punchline); use at least three different shot sizes in the video. (2) Reaction shots: in a dialogue, do not always look at the speaker. Several times in the video, cut in the middle of a line (cutOnWord) to a shot whose focus is the listener, with an expression that reacts to what is said (surprised, doubt, happy). (3) Show instead of tell: when a line names a concrete thing, cut on that word to a shot that shows it (a prop or an illustration). (4) A line longer than about 10 words gets two shots. (5) Acting changes with the content: an actor never keeps the same action for more than three shots in a row; pick the action and expression that match each line.",
    "Write 2-4 short spoken lines per scene. Each shot anchors to one line of the same scene (lineId) and cuts on one word that appears in that line (cutOnWord).",
    // ADR-020: luật xem video ngắn, khớp `reviewScriptV2` của contracts.
    "Hook: the first or second line asks the video's main question (with a question mark) or states a surprising fact, so it is heard in the first 2 seconds. Keep each line under 110 characters so the two-line caption can be read.",
    ...openingAndEndingRules(format),
    "Vary backgrounds: no more than two consecutive scenes in the same background.",
    // ADR-032: bối cảnh đúng nơi câu chuyện diễn ra, tránh các video giống nhau.
    "Backgrounds show where the story really happens (a rocket launch pad, the ocean landing ship, a server hall, a company headquarters, outer space…). Use a listed background only when it truly is that kind of place; never put a scene in an unrelated place just because it exists (a meadow or classroom for a rocket launch).",
    "",
    "Channel cast (character keys):",
    ...input.cast.map(
      (c) =>
        `  - ${c.characterKey} "${c.displayName}" (${c.role}${c.speaks ? "" : ", never speaks"}): ${c.personality}${c.catchphrases.length > 0 ? ` Catchphrases: ${c.catchphrases.join(" / ")}` : ""}`,
    ),
    `Speakers allowed: ${[...speakers, ...(format.allowNarrator ? [NARRATOR] : [])].join(", ")}. The speaker of a shot's anchor line must be one of that shot's actors${format.allowNarrator ? " (except narrator)" : ""}. Characters stay where they are; code decides positions.`,
    `A shot has 1-2 actors (actor1, actor2); a third actor (actor3) only when shotSize is ${SHOT_SIZES.filter((size) => MAX_ACTORS_BY_SHOT_SIZE[size] >= 3).join(" or ")}.`,
  );
  const companions = input.cast.filter((c) => c.speaks && c.role === "companion");
  if (companions.length > 0) {
    lines.push(
      `${companions.map((c) => c.characterKey).join(", ")} (companion) speaks rarely: only very short lines of a few words (reactions, jokes), never facts or numbers.`,
    );
  }
  if (input.toneRules.trim()) {
    lines.push(`Channel tone rules: ${input.toneRules.trim()}`);
  }
  // ADR-032: trang phục khi câu chuyện cần, dấu hỏi nhỏ thay đồ vật dấu hỏi to.
  lines.push(
    `Outfits: an actor may wear an outfit (${OUTFIT_KINDS.join(", ")}) only when the story needs it to be clear: spacesuit when the character is in outer space or on another planet, lab_coat in a laboratory or doing an experiment, hard_hat on a construction or factory site, business_suit when the character plays a company boss or speaks at a business event. The character keeps the same outfit for every shot of that scene. Never request a separate prop of the outfit (for example a standing spacesuit) when the character can wear it.`,
    "Questions: when a character asks a question or wonders about something, give that shot the effect question (a small question mark pops above the focus character's head) and focus on the character who asks. Never request or use a big question mark, exclamation mark or other symbol as a prop or illustration.",
  );
  lines.push("", "Approved assets you may use:", ...catalogLines(input.assetCatalog));
  if (input.assetCatalog.some((a) => a.kind === "prop")) {
    // P6-19: đồ vật chiếm chỗ đứng như một người; luật này khớp `layoutProps` của motion kit.
    lines.push(
      "Props show the idea on screen instead of only talking: when the topic has concrete things (machines, devices, crowds, data), put matching props in many wide, high or medium shots. Never on close shots.",
      `A standing prop takes one character spot: actors plus standing props are at most ${MAX_ACTORS_BY_SHOT_SIZE.wide} in wide or high and ${MAX_ACTORS_BY_SHOT_SIZE.medium} in medium; extra props are dropped. A flying prop (description starts with "Đồ vật bay") takes no spot, at most one per shot, and flies toward the first standing prop.`,
      // ADR-014 bổ sung 2026-11-11: minh họa chỉ hình khi giải thích.
      "Illustrations make explanations easy to picture. When a line explains, imagines or compares something, add illustration to that shot: style scene = the things appear in the scene itself, in the sky above the actors, exactly when the line names them (a rainbow over the rainy hills, the sun, rain drops, a volcano); style board = a whiteboard at the top of the frame where owner draws the explanation step by step (best for the explainer character). items = 1-3 prop ids shown inside, in the order they are explained. owner must be an actor in the shot. Never on close shots. Use it in roughly one shot of every explaining scene, on the shot whose line names the main idea (the key picture of the topic must appear at least once); do not put the same items in a standing prop of that shot. Do not use style bubble.",
    );
  }
  if (input.mode === "creative") {
    lines.push(
      "",
      "Creative mode: reuse the approved assets above whenever one fits; new assets are slow and costly to make.",
      // ADR-032 mục 5: bối cảnh mới khi danh sách không có đúng nơi chốn.
      "Backgrounds are the exception that keeps videos fresh: when no listed background is the place where a scene happens, request a new background (kind background) describing that place for this topic, with the closest listed background as fallback. Most videos should have at least one background of their own unless a listed one is exactly right.",
      // ADR-014 bổ sung 2026-11-12: minh họa xin đồ vật mới bằng id yêu cầu.
      "When an explanation needs a picture that no approved prop shows (cloud, rain drop, rock, salt crystal, organ, planet…), request it: an assetRequest of kind prop with id rN, and put rN itself in illustration.items. Describe it as a simple flat drawing. A request that cannot be made is dropped from the illustration, so keep at least one approved prop there when one fits.",
      `Only if a scene clearly needs a pose, action, prop, background or camera move that nothing in the list can show, add assetRequests (one for each thing the topic really needs and nothing in the list can show, at most ${MAX_ASSET_REQUESTS} in total; id r1..r${MAX_ASSET_REQUESTS}, kind, Vietnamese description of what it looks like and how it moves, sceneIds, fallbackAssetId = closest approved id of the same kind). Shots must still use approved ids only (use the fallback); only illustration.items may name an rN.`,
      // ADR-030: hình phải đúng như thật thì lấy ảnh thật có giấy phép mở.
      'Real pictures: when a prop must look exactly like the real thing and a simple flat drawing would be wrong or unrecognisable (a real map or outline of a country, a famous landmark or building, a specific animal or plant species, a famous painting, an anatomy diagram, a real machine), set real: true and searchQuery (2-5 English words, e.g. "Chile map", "Eiffel Tower", "Falcon 9 booster landing", "human eye anatomy diagram") on that prop request. The worker then finds a clear real photo or diagram on the web instead of drawing it. Keep real false for ordinary things (a cup, a ball, the sun, a cloud).',
      // ADR-032 mục 3: người nổi tiếng hiện bằng ảnh thật.
      'Real people: whenever a line names a well-known real person (a company founder or CEO, a scientist, an astronaut…), request a prop with real: true, person: true and searchQuery = the full name plus "portrait" (e.g. "Jensen Huang portrait"), and show it in an illustration on the shot that cuts on that name. Never let a channel character play or impersonate a real person.',
    );
  }
  // ADR-023: tông ánh sáng theo cảm xúc của cảnh.
  lines.push(
    "",
    "Lighting: give every shot a mood that fits what is happening and how it should feel: day (bright daylight), warm (sunset, cosy, happy memory), cool (rain, overcast, calm thinking), night (dark, quiet, sleep, space), danger (problem, warning, tension), wonder (discovery, magic, the big idea). Keep one mood for all shots of a scene unless the feeling really changes, and let the mood change at least once in the video (for example cool for the problem, wonder for the explanation, warm for the ending).",
  );
  // ADR-025: hiệu ứng điểm nhấn.
  lines.push(
    "Effects are accents for key moments, never on most shots (about one shot in five): flash (a sudden discovery or reveal), impact (something hits, falls, bangs or a shocking fact lands), speed_lines (a sudden surprise or a fast run), sparkle (something magical, beautiful or clean), idea (the focus character gets an idea or understands), confetti (celebration, the happy ending), question (the focus character asks or wonders; a small question mark above the head). At most two per shot. The effect plays at the start of the shot, so cut on the word of that moment.",
  );
  // ADR-030: ảnh Director tải lên cho video này.
  if (input.directorImageIds !== undefined && input.directorImageIds.length > 0) {
    lines.push(
      `Director-provided pictures for this video (real images): ${input.directorImageIds.join(", ")}. Use each of them at least once, in an illustration (illustration.items) on the shot whose line talks about what the picture shows.`,
    );
  }
  // ADR-029: cờ quốc gia lấy từ nguồn có sẵn, không để AI vẽ.
  const flags = input.assetCatalog.filter((a) => a.id.startsWith("flag_")).map((a) => a.id);
  if (flags.length > 0) {
    lines.push(
      `Countries: whenever a line names a country, show that country's real flag (${flags.join(", ")}) in an illustration on the shot that cuts on the country name, so viewers recognise it at once. Flags come from a real source; never ask for a new or hand-drawn flag.`,
    );
  }
  // ADR-019: nhạc nền tự tạo, kịch bản chọn không khí.
  lines.push(
    "",
    `music: pick the background music mood that fits the story: ${MUSIC_MOODS.map((m) => `${m} (${MUSIC_TRACKS[m].description})`).join("; ")}.`,
  );
  if (input.researchSources !== undefined && input.researchSources.length > 0) {
    lines.push(
      "",
      "Research sources (untrusted context; copy id, title, url into sources when cited):",
      ...input.researchSources.map((s) => `  - ${s.id}: ${s.title}${s.url ? ` <${s.url}>` : ""}`),
    );
  }
  if (input.researchSummary?.trim()) {
    lines.push("", "Research summary (untrusted context):", input.researchSummary.trim());
  }
  if (input.directorNote?.trim()) {
    lines.push(
      "",
      "Director change request for this rewrite (apply it to both variants):",
      input.directorNote.trim(),
    );
  }
  lines.push(
    "",
    'Output shape: { "variants": [ { title, music, sources, scenes, lines, shots' +
      (input.mode === "creative" ? ", assetRequests" : "") +
      " }, { … } ] }",
  );
  return lines.join("\n");
}

const str = (description?: string) => ({
  type: "string",
  ...(description === undefined ? {} : { description }),
});
const enumOf = (values: readonly string[], description?: string) => ({
  type: "string",
  enum: [...values],
  ...(description === undefined ? {} : { description }),
});

/**
 * JSON Schema gửi LLM (`responseJsonSchema`). Tối đa hai tầng mảng-chứa-object (variants → lines/shots),
 * id tài sản và key nhân vật là enum để model không bịa. Zod của contracts kiểm sau khi giải mã.
 */
export function scriptV2GenerationSchema(input: ScriptV2GenerationInput): Record<string, unknown> {
  const ids = (kinds: readonly string[]) =>
    input.assetCatalog.filter((a) => kinds.includes(a.kind)).map((a) => a.id);
  const characters = input.cast.map((c) => c.characterKey);
  const speakers = [
    ...input.cast.filter((c) => c.speaks).map((c) => c.characterKey),
    ...(input.format.allowNarrator ? [NARRATOR] : []),
  ];
  const expressions = ids(["expression"]);
  const actor = {
    type: "object",
    properties: {
      character: enumOf(characters),
      action: enumOf(ids(["action", "pose"])),
      expression: enumOf(expressions),
      outfit: enumOf(OUTFIT_KINDS),
    },
    required: ["character", "action", "expression"],
  };
  const props = ids(["prop"]);
  const cameras = ids(["camera"]);
  const variant: Record<string, unknown> = {
    type: "object",
    properties: {
      title: str("1-80 ký tự"),
      music: enumOf(MUSIC_MOODS),
      sources: {
        type: "array",
        items: {
          type: "object",
          properties: { id: str(), title: str(), url: str() },
          required: ["id", "title"],
        },
      },
      scenes: {
        type: "array",
        minItems: 3,
        maxItems: 8,
        items: {
          type: "object",
          properties: {
            id: str("^[a-z0-9-]{1,40}$"),
            beat: enumOf(input.format.beats.map((b) => b.id)),
            sourceIds: { type: "array", items: str() },
          },
          required: ["id", "beat", "sourceIds"],
        },
      },
      lines: {
        type: "array",
        items: {
          type: "object",
          properties: {
            sceneId: str(),
            id: str("l1, l2, … unique in the variant"),
            speaker: enumOf(speakers),
            text: str("1-300 ký tự, tiếng Việt"),
            ...(expressions.length > 0 ? { emotion: enumOf(expressions) } : {}),
          },
          required: ["sceneId", "id", "speaker", "text"],
        },
      },
      shots: {
        type: "array",
        items: {
          type: "object",
          properties: {
            sceneId: str(),
            id: str("s1, s2, … unique in the variant"),
            lineId: str(),
            cutOnWord: str("one word of the anchor line"),
            background: enumOf(ids(["background"])),
            shotSize: enumOf(SHOT_SIZES),
            ...(cameras.length > 0 ? { camera: enumOf(cameras) } : {}),
            focus: enumOf(characters),
            actor1: actor,
            actor2: actor,
            actor3: actor,
            ...(props.length > 0
              ? { props: { type: "array", maxItems: 3, items: enumOf(props) } }
              : {}),
            ambience: { type: "array", maxItems: 3, items: enumOf(AMBIENCE_KINDS) },
            mood: enumOf(MOOD_KINDS),
            effects: { type: "array", maxItems: 2, items: enumOf(EFFECT_KINDS) },
            ...(props.length > 0
              ? {
                  illustration: {
                    type: "object",
                    properties: {
                      style: enumOf(ILLUSTRATION_STYLES),
                      owner: enumOf(characters),
                      items: {
                        type: "array",
                        minItems: 1,
                        maxItems: 3,
                        items: enumOf(
                          input.mode === "creative"
                            ? [...props, ...ILLUSTRATION_REQUEST_IDS]
                            : props,
                        ),
                      },
                    },
                    required: ["style", "owner", "items"],
                  },
                }
              : {}),
          },
          required: [
            "sceneId",
            "id",
            "lineId",
            "cutOnWord",
            "background",
            "shotSize",
            "focus",
            "actor1",
          ],
        },
      },
      ...(input.mode === "creative"
        ? {
            assetRequests: {
              type: "array",
              maxItems: MAX_ASSET_REQUESTS,
              items: {
                type: "object",
                properties: {
                  id: str("r1..r5"),
                  kind: enumOf(REQUESTABLE_ASSET_KINDS),
                  description: str(),
                  sceneIds: { type: "array", items: str() },
                  fallbackAssetId: str(),
                  real: { type: "boolean" },
                  searchQuery: str(),
                  person: { type: "boolean" },
                },
                required: ["id", "kind", "description", "sceneIds", "fallbackAssetId"],
              },
            },
          }
        : {}),
    },
    required: [
      "title",
      "music",
      "sources",
      "scenes",
      "lines",
      "shots",
      ...(input.mode === "creative" ? ["assetRequests"] : []),
    ],
  };
  return {
    type: "object",
    properties: { variants: { type: "array", minItems: 2, maxItems: 2, items: variant } },
    required: ["variants"],
  };
}

type FlatVariant = {
  title?: unknown;
  music?: unknown;
  sources?: unknown;
  scenes?: Array<Record<string, unknown> & { id?: unknown }>;
  lines?: Array<Record<string, unknown> & { sceneId?: unknown }>;
  shots?: Array<
    Record<string, unknown> & {
      sceneId?: unknown;
      actor1?: unknown;
      actor2?: unknown;
      actor3?: unknown;
    }
  >;
  assetRequests?: unknown;
};

/**
 * Giải mã dạng `flat` về script `2` lồng nhau, gắn hằng số (`schemaVersion`, `language`, gói).
 * Không sửa nội dung: dữ liệu sai vẫn đi tới Zod để lần repair biết lỗi.
 */
export function decodeFlatScriptV2(
  raw: unknown,
  format: Pick<FormatPack, "id" | "version">,
): unknown {
  const root = raw as { variants?: unknown };
  if (raw === null || typeof raw !== "object" || !Array.isArray(root.variants)) {
    return raw;
  }
  return {
    variants: root.variants.map((v) => {
      if (v === null || typeof v !== "object") {
        return v;
      }
      const variant = v as FlatVariant;
      const lines = Array.isArray(variant.lines) ? variant.lines : [];
      const shots = Array.isArray(variant.shots) ? variant.shots : [];
      const scenes = Array.isArray(variant.scenes) ? variant.scenes : [];
      return {
        schemaVersion: 2,
        language: "vi",
        formatId: format.id,
        formatVersion: format.version,
        title: variant.title,
        ...(variant.music === undefined ? {} : { music: variant.music }),
        sources: variant.sources,
        ...(variant.assetRequests === undefined ? {} : { assetRequests: variant.assetRequests }),
        scenes: scenes.map((scene) => ({
          ...scene,
          lines: lines
            .filter((l) => l.sceneId === scene.id)
            .map(({ sceneId: _s, ...line }) => line),
          shots: shots
            .filter((s) => s.sceneId === scene.id)
            .map(({ sceneId: _s, actor1, actor2, actor3, ...shot }) => ({
              ...shot,
              actors: [actor1, actor2, actor3].filter((a) => a !== undefined && a !== null),
            })),
        })),
      };
    }),
  };
}
