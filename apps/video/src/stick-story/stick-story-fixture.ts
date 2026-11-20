import type { RemotionCaption } from "@studio/contracts";
import {
  parseStickStoryRenderProps,
  STICK_STORY_MOTION_KIT_VERSION,
  STICK_STORY_TEMPLATE_ID,
  type StickStoryRenderProps,
  stickStoryTemplateVersion,
} from "./stick-story-props";

/**
 * Fixture hai nhân vật (Tí và Bit, Đậu xuất hiện một shot) cho P6-09: 3 cảnh, 9 shot, không audio.
 * Phụ đề chia đều thời gian câu; đủ để soát hình, cú cắt, màu phụ đề và miệng của người nói.
 */
const FPS = 30;
const PAD_MS = 200;

type LineSpec = { speaker: string; text: string; fromMs: number; toMs: number };
type SceneSpec = {
  sceneId: string;
  durationMs: number;
  lines: LineSpec[];
  shots: Omit<StickStoryRenderProps["shots"][number], "sceneId" | "durationInFrames">[];
};

const SPEC: SceneSpec[] = [
  {
    sceneId: "mo-dau",
    durationMs: 4400,
    lines: [
      { speaker: "ti", text: "Bit ơi, nếu mình không cần ngủ thì sao?", fromMs: 0, toMs: 2200 },
      { speaker: "bit", text: "Nghe hấp dẫn đấy.", fromMs: 2600, toMs: 4000 },
    ],
    shots: [
      {
        shotId: "s1",
        fromFrame: 0,
        background: "bg_room",
        shotSize: "wide",
        camera: "cam_push_in",
        focus: "ti",
        props: ["prop_server", "prop_packets"],
        ambience: [],
        actors: [
          {
            character: "ti",
            skin: "skin_ti",
            action: "action_wave",
            expression: "expr_happy",
            slot: "left",
            speakingRanges: [],
          },
          {
            character: "bit",
            skin: "skin_bit",
            action: "pose_stand",
            expression: "expr_happy",
            slot: "right",
            speakingRanges: [],
          },
        ],
      },
      {
        shotId: "s2",
        fromFrame: 82,
        background: "bg_room",
        shotSize: "close",
        camera: "cam_static",
        focus: "bit",
        props: [],
        ambience: [],
        actors: [
          {
            character: "bit",
            skin: "skin_bit",
            action: "action_talk",
            expression: "expr_doubt",
            slot: "right",
            speakingRanges: [],
          },
        ],
      },
    ],
  },
  {
    sceneId: "su-that",
    durationMs: 5200,
    lines: [
      { speaker: "bit", text: "Thức 24 giờ, phản xạ chậm như người say.", fromMs: 0, toMs: 2600 },
      { speaker: "ti", text: "Thật à?", fromMs: 3000, toMs: 3700 },
      { speaker: "bit", text: "Đã có nghiên cứu đo.", fromMs: 3950, toMs: 4800 },
    ],
    shots: [
      {
        shotId: "s3",
        fromFrame: 0,
        background: "bg_classroom",
        shotSize: "medium",
        camera: "cam_push_in",
        focus: "bit",
        props: [],
        ambience: [],
        actors: [
          {
            character: "bit",
            skin: "skin_bit",
            action: "action_point",
            expression: "expr_doubt",
            slot: "right",
            speakingRanges: [],
          },
          {
            character: "ti",
            skin: "skin_ti",
            action: "pose_stand",
            expression: "expr_surprised",
            slot: "left",
            speakingRanges: [],
          },
        ],
      },
      {
        shotId: "s4",
        fromFrame: 0,
        background: "bg_classroom",
        shotSize: "close",
        camera: "cam_static",
        focus: "ti",
        props: [],
        ambience: [],
        actors: [
          {
            character: "ti",
            skin: "skin_ti",
            action: "action_panic",
            expression: "expr_panic",
            slot: "left",
            speakingRanges: [],
          },
        ],
      },
      {
        shotId: "s5",
        fromFrame: 0,
        background: "bg_classroom",
        shotSize: "wide",
        camera: "cam_static",
        focus: "bit",
        props: ["prop_shield"],
        ambience: [],
        actors: [
          {
            character: "ti",
            skin: "skin_ti",
            action: "pose_stand",
            expression: "expr_surprised",
            slot: "left",
            speakingRanges: [],
          },
          {
            character: "bit",
            skin: "skin_bit",
            action: "action_talk",
            expression: "expr_smug",
            slot: "right",
            speakingRanges: [],
          },
        ],
      },
    ],
  },
  {
    sceneId: "twist",
    durationMs: 4000,
    lines: [
      { speaker: "ti", text: "Thôi, mình đi ngủ đây!", fromMs: 0, toMs: 1600 },
      { speaker: "bit", text: "Ngủ ngon nhé.", fromMs: 2000, toMs: 3200 },
    ],
    shots: [
      {
        shotId: "s6",
        fromFrame: 0,
        background: "bg_room",
        shotSize: "high",
        camera: "cam_push_in",
        focus: "ti",
        props: ["prop_server_overload", "prop_packets"],
        ambience: ["dust"],
        actors: [
          {
            character: "ti",
            skin: "skin_ti",
            action: "action_celebrate",
            expression: "expr_happy",
            slot: "left",
            speakingRanges: [],
          },
          {
            character: "dau",
            skin: "skin_dau",
            action: "action_celebrate",
            expression: "expr_happy",
            slot: "right",
            speakingRanges: [],
          },
        ],
      },
      {
        shotId: "s7",
        fromFrame: 0,
        background: "bg_room",
        shotSize: "close",
        camera: "cam_static",
        focus: "bit",
        props: [],
        ambience: ["vignette"],
        actors: [
          {
            character: "bit",
            skin: "skin_bit",
            action: "action_wave",
            expression: "expr_happy",
            slot: "right",
            speakingRanges: [],
          },
        ],
      },
    ],
  },
];

/** Shot thứ k của cảnh bắt đầu ở câu thứ k (trừ shot đầu), sớm 2 frame trước từ đầu câu. */
function buildFixture(): StickStoryRenderProps {
  const captions: RemotionCaption[] = [];
  const shots: StickStoryRenderProps["shots"] = [];
  const scenes: StickStoryRenderProps["scenes"] = [];
  let fromMs = 0;
  let startFrame = 0;
  for (const spec of SPEC) {
    const frames = Math.round((spec.durationMs * FPS) / 1000);
    const toFrame = (ms: number) => startFrame + Math.round(((PAD_MS + ms) * FPS) / 1000);
    const speaking = new Map<string, { from: number; to: number }[]>();
    for (const line of spec.lines) {
      speaking.set(line.speaker, [
        ...(speaking.get(line.speaker) ?? []),
        { from: toFrame(line.fromMs), to: toFrame(line.toMs) },
      ]);
      const words = line.text.split(" ");
      const step = (line.toMs - line.fromMs) / words.length;
      words.forEach((word, i) => {
        const startMs = Math.round(fromMs + PAD_MS + line.fromMs + i * step);
        const endMs = Math.round(startMs + step - 30);
        captions.push({
          text: captions.length === 0 ? word : ` ${word}`,
          startMs,
          endMs,
          timestampMs: startMs,
          confidence: null,
          speaker: line.speaker,
        });
      });
    }
    const starts = spec.shots.map((_, k) =>
      k === 0 ? startFrame : toFrame(spec.lines[k]?.fromMs ?? 0) - 2,
    );
    spec.shots.forEach((shot, k) => {
      const from = starts[k] as number;
      const to = starts[k + 1] ?? startFrame + frames;
      shots.push({
        ...shot,
        sceneId: spec.sceneId,
        fromFrame: from,
        durationInFrames: to - from,
        actors: shot.actors.map((a) => ({ ...a, speakingRanges: speaking.get(a.character) ?? [] })),
      });
    });
    scenes.push({
      sceneId: spec.sceneId,
      fromMs,
      durationMs: spec.durationMs,
    });
    fromMs += spec.durationMs;
    startFrame += frames;
  }
  return parseStickStoryRenderProps({
    templateId: STICK_STORY_TEMPLATE_ID,
    templateVersion: stickStoryTemplateVersion(),
    motionKitVersion: STICK_STORY_MOTION_KIT_VERSION,
    fps: FPS,
    width: 1080,
    height: 1920,
    audio: { storageKey: "fixtures/stick-story-silent.wav", durationMs: fromMs },
    brand: {
      fontFamily: "system-ui, 'Segoe UI', sans-serif",
      textColor: "#ffffff",
      captionBackground: "rgba(11,13,18,0.82)",
      speakerColors: { ti: "#ffb08a", bit: "#8fe9ff" },
      introAssetId: null,
      outroAssetId: null,
    },
    scenes,
    shots,
    captions,
    cards: {
      intro: { title: "Vì sao nước biển mặn?" },
      outro: { channel: "Tí Bit Khám Phá", cta: "Theo dõi để xem tiếp nhé!" },
    },
    sfx: [],
  });
}

export const STICK_STORY_FIXTURE_PROPS: StickStoryRenderProps = buildFixture();
