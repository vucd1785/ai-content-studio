import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  Actor,
  aliveOffset,
  backgroundScale,
  blinkAt,
  boardThemeFor,
  CharacterFigure,
  CLOSE_FACE_Y,
  characterGeometry,
  END_CARD_SHARE,
  elbowHeadClearance,
  FRAME_HEIGHT,
  FRAME_WIDTH,
  framing,
  getBackground,
  getCamera,
  getExpression,
  getMotion,
  getProp,
  getSkin,
  handHeadClearance,
  illustrationBox,
  impactShake,
  KIT_ASSETS,
  listKitAssets,
  MOODS,
  MOTION_KIT_VERSION,
  mouthOpenAt,
  OUTFIT_KINDS,
  PARALLAX,
  POSE_REST,
  parallaxOffset,
  reserveShift,
  type ShotSize,
  type SlotName,
  StageShot,
  type StageShotProps,
  sampleAction,
  scaledBounds,
  shotFraming,
  shotReserve,
  VERTICAL_FRAME,
  viewHalfExtents,
  WIDE_FRAME,
} from "./index.js";

const srcDir = dirname(fileURLToPath(import.meta.url));
const pkgDir = dirname(srcDir);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const SKINS = Object.keys(KIT_ASSETS.character_skin);
const EXPRESSIONS = Object.keys(KIT_ASSETS.expression);
const MOTIONS = [...Object.keys(KIT_ASSETS.pose), ...Object.keys(KIT_ASSETS.action)];
const FRAMES = [0, 1, 4, 9, 13, 17, 25, 37, 60, 89, 150];

const shotProps = (frame: number, overrides: Partial<StageShotProps> = {}): StageShotProps => ({
  frame,
  startFrame: 0,
  durationInFrames: 90,
  background: "bg_room",
  shotSize: "medium",
  camera: "cam_push_in",
  focus: 0,
  actors: [
    {
      skin: "skin_ti",
      action: "action_wave",
      expression: "expr_happy",
      slot: "left",
      seed: 1,
      speakingRanges: [{ from: 10, to: 50 }],
    },
    { skin: "skin_bit", action: "action_talk", expression: "expr_doubt", slot: "right", seed: 2 },
  ],
  ambience: ["vignette", "dust", "foreground_blur"],
  lightShaft: true,
  ...overrides,
});

describe("hàm thuần của frame", () => {
  it("mọi nhân vật × biểu cảm × hành động: cùng frame ra cùng SVG", () => {
    for (const skin of SKINS) {
      for (const motion of MOTIONS) {
        for (const expression of EXPRESSIONS) {
          for (const frame of [0, 13, 61]) {
            const el = (
              <Actor
                skin={getSkin(skin)}
                action={getMotion(motion)}
                expression={getExpression(expression)}
                frame={frame}
                startFrame={0}
                speakingRanges={[{ from: 0, to: 40 }]}
                seed={3}
                facing={1}
              />
            );
            expect(renderToStaticMarkup(el)).toBe(renderToStaticMarkup(el));
          }
        }
      }
    }
  });

  it("mọi bối cảnh, camera, cỡ cảnh, không khí: cùng frame ra cùng SVG", async () => {
    // Mọi bối cảnh với một camera, và mọi camera với một bối cảnh: đủ phủ mà không nhân tổ hợp (kho tự lớn dần).
    const combos = [
      ...Object.keys(KIT_ASSETS.background).map((background) => ({
        background,
        camera: "cam_push_in",
      })),
      ...Object.keys(KIT_ASSETS.camera).map((camera) => ({ background: "bg_room", camera })),
    ];
    for (const { background, camera } of combos) {
      // Nhả tiến trình giữa các tổ hợp: test chạy lâu, vitest cần gửi tiến độ về tiến trình chính.
      await new Promise((resolve) => setImmediate(resolve));
      for (const shotSize of ["wide", "medium", "close", "high"] as const) {
        for (const frame of FRAMES) {
          const props = shotProps(frame, { background, camera, shotSize });
          const a = renderToStaticMarkup(<StageShot {...props} />);
          const b = renderToStaticMarkup(<StageShot {...props} />);
          expect(a).toBe(b);
          expect(a).toContain(`viewBox="0 0 ${FRAME_WIDTH} ${FRAME_HEIGHT}"`);
        }
      }
    }
    // Kho bối cảnh tự tạo lớn dần (ADR-017): thời gian test tăng theo, nên trần rộng hơn mặc định.
  }, 180_000);

  it("minh họa trong cảnh (bổ sung 2026-11-12 (3)): không khung đám mây, vẽ sau nhân vật, hiện dần", () => {
    const base = shotProps(24, { shotSize: "wide", ambience: [] });
    const items = ["prop_laptop"];
    const scene = renderToStaticMarkup(
      <StageShot {...base} illustration={{ style: "scene", items, owner: 0 }} />,
    );
    const bubble = renderToStaticMarkup(
      <StageShot {...base} illustration={{ style: "bubble", items, owner: 0 }} />,
    );
    const board = renderToStaticMarkup(
      <StageShot {...base} illustration={{ style: "board", items, owner: 0 }} />,
    );
    const plain = renderToStaticMarkup(<StageShot {...base} />);
    // `bubble` cũ vẽ y như `scene` (không còn khung mây, chuỗi chấm).
    expect(bubble).toBe(scene);
    expect(scene).not.toBe(plain);
    // ADR-029: bảng là thẻ kem viền mực (bối cảnh không phải lớp học), không còn tấm trắng.
    expect(board).toContain("#fff6e6");
    expect(board).not.toContain("#fbfaf5");
    // Frame đầu shot chưa hiện (độ mờ 0).
    const first = renderToStaticMarkup(
      <StageShot {...base} frame={0} illustration={{ style: "scene", items, owner: 0 }} />,
    );
    expect(first).toContain('opacity="0"');
  });

  it("khung ngang 16:9 (ADR-022): SVG 1920×1080, bối cảnh dọc được phóng cho đủ khung, khung dọc không đổi", () => {
    const base = shotProps(24, { shotSize: "wide", ambience: [] });
    const vertical = renderToStaticMarkup(<StageShot {...base} />);
    expect(renderToStaticMarkup(<StageShot {...base} frameSize={VERTICAL_FRAME} />)).toBe(vertical);
    const stage = getBackground("bg_room").stage;
    expect(backgroundScale(stage, VERTICAL_FRAME)).toBe(1);
    const k = backgroundScale(stage, WIDE_FRAME);
    expect(k).toBeGreaterThan(1.7);
    const wide = renderToStaticMarkup(<StageShot {...base} frameSize={WIDE_FRAME} />);
    expect(wide).toContain('viewBox="0 0 1920 1080"');
    expect(wide).toContain(`scale(${k.toFixed(4)})`);
  });

  it("lớp chiều sâu (ADR-023): lớp xa và tiền cảnh trượt lệch theo camera, lớp xa luôn phủ kín khung", () => {
    const bg = getBackground("bg_meadow");
    expect(bg.Far).toBeDefined();
    expect(bg.Near).toBeDefined();
    const stage = bg.stage;
    const mid = (stage.bounds.x0 + stage.bounds.x1) / 2;
    // Camera đứng giữa, cỡ rộng khung dọc: các lớp nằm đúng chỗ đã vẽ.
    expect(parallaxOffset(stage, { cx: mid, cy: stage.groundY - 430 }, PARALLAX.far)).toEqual({
      dx: 0,
      dy: 0,
    });
    // Camera sang phải: lớp xa đi theo camera (trượt chậm), tiền cảnh đi ngược (trượt nhanh).
    const right = { cx: mid + 200, cy: stage.groundY - 430 };
    expect(parallaxOffset(stage, right, PARALLAX.far).dx).toBeCloseTo(60);
    expect(parallaxOffset(stage, right, PARALLAX.near).dx).toBeCloseTo(-90);
    const focus = { x: stage.slots.right, height: 600, face: 500 };
    for (const frameSize of [VERTICAL_FRAME, WIDE_FRAME]) {
      for (const size of ["wide", "high", "medium", "close"] as const) {
        for (const camera of Object.keys(KIT_ASSETS.camera)) {
          for (const t of [0, 0.5, 1]) {
            const v = framing(stage, size, focus, getCamera(camera), t, frameSize);
            const off = parallaxOffset(stage, v, PARALLAX.far);
            const { halfW, halfH } = viewHalfExtents(frameSize, v.zoom, v.rotate);
            const b = scaledBounds(stage, backgroundScale(stage, frameSize));
            // Vùng nhìn tính trong hệ của lớp xa vẫn nằm trong vùng lớp đó đã vẽ.
            expect(v.cx - off.dx - halfW).toBeGreaterThanOrEqual(b.x0 - 0.01);
            expect(v.cx - off.dx + halfW).toBeLessThanOrEqual(b.x1 + 0.01);
            expect(v.cy - off.dy - halfH).toBeGreaterThanOrEqual(b.y0 - 0.01);
            expect(v.cy - off.dy + halfH).toBeLessThanOrEqual(b.y1 + 0.01);
          }
        }
      }
    }
    const svg = renderToStaticMarkup(
      <StageShot
        {...shotProps(24, { background: "bg_meadow", camera: "cam_pan", ambience: [] })}
      />,
    );
    expect(svg).toContain("mk-near-blur");
    // Bối cảnh một lớp không có lớp mờ tiền cảnh.
    expect(renderToStaticMarkup(<StageShot {...shotProps(24, { ambience: [] })} />)).not.toContain(
      "mk-near-blur",
    );
  });

  it("tông ánh sáng (ADR-023): không có tông thì vẽ như trước; có tông thì phủ màu bối cảnh, nhân vật và thêm quầng sáng", () => {
    const base = shotProps(24, { ambience: [] });
    const plain = renderToStaticMarkup(<StageShot {...base} />);
    expect(plain).not.toContain("mk-mood-");
    for (const mood of Object.keys(MOODS) as (keyof typeof MOODS)[]) {
      const svg = renderToStaticMarkup(<StageShot {...base} mood={mood} />);
      expect(svg).toBe(renderToStaticMarkup(<StageShot {...base} mood={mood} />));
      expect(svg).toContain(`mk-mood-${mood}-glow`);
      expect(svg).toContain("mix-blend-mode:screen");
      // Lớp phủ trên nhân vật luôn nhạt hơn trên bối cảnh, để nhân vật còn nổi.
      expect(MOODS[mood].actors).toBeLessThan(MOODS[mood].scene);
    }
    const night = renderToStaticMarkup(<StageShot {...base} mood="night" />);
    expect(night.match(/mix-blend-mode:multiply/g)).toHaveLength(2);
    expect(night).toContain("mk-mood-night-veil");
    // Cảnh nguy hiểm có nhịp đập: quầng sáng đổi theo frame.
    expect(renderToStaticMarkup(<StageShot {...base} mood="danger" />)).not.toBe(
      renderToStaticMarkup(<StageShot {...shotProps(33, { ambience: [] })} mood="danger" />),
    );
  });

  it("trang phục (ADR-032): ba nhân vật mặc được mọi bộ, tất định, khác lúc không mặc, không chữ", () => {
    const skins = ["skin_ti", "skin_dau", "skin_bit"];
    for (const skin of skins) {
      const dressed = (outfit?: (typeof OUTFIT_KINDS)[number]) =>
        renderToStaticMarkup(
          <StageShot
            {...shotProps(24, {
              ambience: [],
              actors: [
                {
                  skin,
                  action: "action_wave",
                  expression: "expr_happy",
                  slot: "center",
                  seed: 1,
                  ...(outfit === undefined ? {} : { outfit }),
                },
              ],
            })}
          />,
        );
      const plain = dressed();
      for (const outfit of OUTFIT_KINDS) {
        const svg = dressed(outfit);
        expect(svg, `${skin} ${outfit}`).toBe(dressed(outfit));
        expect(svg, `${skin} ${outfit}`).not.toBe(plain);
        expect(svg, `${skin} ${outfit}`).not.toContain("<text");
      }
    }
  });

  it("hiệu ứng (ADR-025): không có thì vẽ như trước; mỗi hiệu ứng tất định, hiệu ứng đầu shot tắt sau vài frame", () => {
    const base = shotProps(24, { ambience: [], startFrame: 20 });
    const plain = renderToStaticMarkup(<StageShot {...base} />);
    expect(renderToStaticMarkup(<StageShot {...base} effects={[]} />)).toBe(plain);
    for (const fx of [
      "flash",
      "impact",
      "speed_lines",
      "sparkle",
      "idea",
      "confetti",
      "question",
    ] as const) {
      const at = (frame: number) =>
        renderToStaticMarkup(
          <StageShot {...shotProps(frame, { ambience: [], startFrame: 20 })} effects={[fx]} />,
        );
      expect(at(24), fx).toBe(at(24));
      expect(at(24), fx).not.toBe(
        renderToStaticMarkup(<StageShot {...shotProps(24, { ambience: [], startFrame: 20 })} />),
      );
    }
    // Chớp trắng và vòng va chạm chỉ ở đầu shot.
    const late = (fx: "flash" | "impact") =>
      renderToStaticMarkup(
        <StageShot {...shotProps(60, { ambience: [], startFrame: 20 })} effects={[fx]} />,
      );
    const none = renderToStaticMarkup(
      <StageShot {...shotProps(60, { ambience: [], startFrame: 20 })} />,
    );
    // Hết hiệu ứng thì chỉ còn nhóm rỗng bao ngoài, không còn hình nào.
    expect(late("flash")).toBe(late("impact"));
    expect(late("flash").length - none.length).toBeLessThan(20);
    // Rung khung nhỏ, giảm dần, hết sau vài frame.
    const amp = (f: number) => {
      const s = impactShake(f, VERTICAL_FRAME);
      return Math.hypot(s.dx, s.dy);
    };
    expect(amp(1)).toBeLessThan(VERTICAL_FRAME.width * 0.03);
    expect(amp(20)).toBe(0);
  });

  it("góc máy mới (ADR-025): góc thấp nhìn cao hơn, góc nghiêng xoay khung, lia gắt đứng lại cuối shot", () => {
    const stage = getBackground("bg_room").stage;
    const focus = { x: stage.slots.center, height: 600, face: 500 };
    const still = framing(stage, "wide", focus, getCamera("cam_static"), 0.5);
    const low = framing(stage, "wide", focus, getCamera("cam_low_angle"), 0.5);
    expect(low.cy).toBeLessThan(still.cy);
    const dutch = framing(stage, "medium", focus, getCamera("cam_dutch"), 1);
    expect(Math.abs(dutch.rotate ?? 0)).toBeGreaterThan(4);
    expect(
      renderToStaticMarkup(<StageShot {...shotProps(80, { camera: "cam_dutch", ambience: [] })} />),
    ).toContain("rotate(");
    const whipStart = framing(stage, "medium", focus, getCamera("cam_whip"), 0);
    const whipEnd = framing(stage, "medium", focus, getCamera("cam_whip"), 1);
    const settled = framing(stage, "medium", focus, getCamera("cam_static"), 1);
    expect(whipStart.cx).not.toBeCloseTo(whipEnd.cx, 0);
    expect(whipEnd.cy).toBeCloseTo(settled.cy, 0);
  });

  it("khung ngang: camera giữ bối cảnh trong khung, mặt đất ở khoảng 3/4 khung, minh họa sang bên trống", () => {
    const stage = getBackground("bg_room").stage;
    const still = getCamera("cam_static");
    const focus = { x: stage.slots.left, height: 600, face: 500 };
    for (const size of ["wide", "high", "medium", "close"] as const) {
      const v = framing(stage, size, focus, still, 0, WIDE_FRAME);
      const halfW = WIDE_FRAME.width / 2 / v.zoom;
      const halfH = WIDE_FRAME.height / 2 / v.zoom;
      // Khung luôn nằm trong bối cảnh đã phóng: không dải đen ở mép.
      const b = scaledBounds(stage, backgroundScale(stage, WIDE_FRAME));
      expect(v.cx - halfW).toBeGreaterThanOrEqual(b.x0 - 0.01);
      expect(v.cx + halfW).toBeLessThanOrEqual(b.x1 + 0.01);
      expect(v.cy - halfH).toBeGreaterThanOrEqual(b.y0 - 0.01);
      expect(v.cy + halfH).toBeLessThanOrEqual(b.y1 + 0.01);
    }
    const wide = framing(stage, "wide", focus, still, 0, WIDE_FRAME);
    const groundY = WIDE_FRAME.height / 2 + (stage.groundY - wide.cy) * wide.zoom;
    expect(groundY / WIDE_FRAME.height).toBeCloseTo(0.75, 2);
    // Nhân vật lệch phải: minh họa sang bên trái, không đè lên nhân vật, nằm trong khung.
    const box = illustrationBox("scene", 1300, 300, WIDE_FRAME, { x0: 1100, x1: 1500 });
    expect(box.x + box.width).toBeLessThanOrEqual(1100);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThan(WIDE_FRAME.height);
  });

  it("hành động thật sự đổi theo frame (không đứng yên)", () => {
    for (const id of Object.keys(KIT_ASSETS.action)) {
      const clip = getMotion(id);
      const a = JSON.stringify(sampleAction(clip, 0));
      const later = [5, 10, 15, 20, 30, 40].map((f) => JSON.stringify(sampleAction(clip, f)));
      expect(
        later.some((p) => p !== a),
        id,
      ).toBe(true);
    }
  });

  it("tư thế bắt đầu từ tư thế của shot trước", () => {
    const from = { ...POSE_REST, lean: 9 };
    expect(sampleAction(getMotion("action_wave"), 0, from)).toEqual(from);
  });

  it("chớp mắt và miệng tất định; ngoài khoảng nói miệng theo biểu cảm", () => {
    for (let f = 0; f < 300; f++) {
      expect(blinkAt(f, 5)).toBe(blinkAt(f, 5));
    }
    const blinksA = Array.from({ length: 300 }, (_, f) => blinkAt(f, 1));
    const blinksB = Array.from({ length: 300 }, (_, f) => blinkAt(f, 2));
    expect(blinksA).not.toEqual(blinksB);
    expect(blinksA.filter(Boolean).length).toBeGreaterThan(0);
    const ranges = [{ from: 10, to: 20 }];
    expect(mouthOpenAt(9, ranges, 1)).toBeNull();
    expect(mouthOpenAt(20, ranges, 1)).toBeNull();
    const open = mouthOpenAt(12, ranges, 1);
    expect(open).not.toBeNull();
    expect(open).toBeGreaterThanOrEqual(0);
    expect(open).toBeLessThanOrEqual(1);
  });
});

describe("tay không bị đầu che", () => {
  // P6-03: tay vẫy của Tí nằm sát mép đầu, trông như gãi đầu. Khoảng hở tối thiểu 4 px (hệ hình).
  const MIN_CLEARANCE = 4;

  it("mọi nhân vật, mọi tư thế và hành động, mọi frame 0–120", () => {
    const worst: { skin: string; motion: string; frame: number; clearance: number }[] = [];
    for (const skin of SKINS) {
      for (const motion of MOTIONS) {
        for (let frame = 0; frame <= 120; frame++) {
          const clearance = handHeadClearance(
            getSkin(skin),
            sampleAction(getMotion(motion), frame),
          );
          if (clearance < MIN_CLEARANCE) {
            worst.push({ skin, motion, frame, clearance: Number(clearance.toFixed(1)) });
          }
        }
      }
    }
    expect(worst).toEqual([]);
  });

  it("khuỷu tay không cắt qua đầu ở mọi tư thế và hành động", () => {
    const bad: string[] = [];
    for (const skin of SKINS) {
      for (const motion of MOTIONS) {
        for (let frame = 0; frame <= 120; frame++) {
          const c = elbowHeadClearance(getSkin(skin), sampleAction(getMotion(motion), frame));
          if (c < 0) {
            bad.push(`${skin}/${motion}/f${frame}: ${c.toFixed(1)}`);
          }
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("diễn xuất tự động (gật đầu, nghiêng khi nói) vẫn giữ luật tay ở mọi frame 0–240", () => {
    const bad: string[] = [];
    for (const skin of SKINS) {
      for (const motion of MOTIONS) {
        const clip = getMotion(motion);
        for (const speaking of [false, true]) {
          for (let frame = 0; frame <= 240; frame += 2) {
            const base = sampleAction(clip, frame);
            const alive = aliveOffset(clip, frame, frame, 3.7, speaking);
            const posed = { ...base, tilt: base.tilt + alive.tilt, lean: base.lean + alive.lean };
            const hand = handHeadClearance(getSkin(skin), posed);
            const elbow = elbowHeadClearance(getSkin(skin), posed);
            if (hand < MIN_CLEARANCE || elbow < 0) {
              bad.push(
                `${skin}/${motion}/f${frame}/${speaking}: ${hand.toFixed(1)} ${elbow.toFixed(1)}`,
              );
            }
          }
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("diễn xuất tự động chỉ cộng khi tư thế đã đứng, không cộng vào hành động lặp", () => {
    expect(aliveOffset(getMotion("pose_stand"), 0, 0, 1, false)).toEqual({ tilt: 0, lean: 0 });
    expect(aliveOffset(getMotion("action_talk"), 200, 200, 1, true)).toEqual({ tilt: 0, lean: 0 });
    const moving = Array.from(
      { length: 120 },
      (_, f) => aliveOffset(getMotion("pose_stand"), 60 + f, 60 + f, 1, false).tilt,
    );
    expect(Math.max(...moving)).toBeGreaterThan(3);
  });

  it("bàn tay vẫy của Tí ở trên vai, ngoài vùng đầu", () => {
    const skin = getSkin("skin_ti");
    for (let frame = 13; frame <= 60; frame++) {
      const clearance = handHeadClearance(skin, sampleAction(getMotion("action_wave"), frame));
      expect(clearance).toBeGreaterThanOrEqual(MIN_CLEARANCE);
    }
  });

  it("hình học đo được khớp với hình vẽ: bàn tay nằm ở đầu cánh tay đã vẽ", () => {
    const skin = getSkin("skin_ti");
    const p = sampleAction(getMotion("action_wave"), 20);
    const svg = renderToStaticMarkup(
      <svg>
        <title>Tí</title>
        <CharacterFigure
          skin={skin}
          pose={p}
          expression={getExpression("expr_happy")}
          blink={false}
          mouthOpen={null}
          breathe={0}
          facing={1}
        />
      </svg>,
    );
    const arm = /<path d="M ([^"]+)"[^>]*stroke-width="13"/g;
    const ends = [...svg.matchAll(arm)].map((m) => (m[1] ?? "").split(" L ").at(-1));
    const hands = [...svg.matchAll(/<circle cx="([-\d.]+)" cy="([-\d.]+)" r="12"/g)].map(
      (m) => `${m[1]} ${m[2]}`,
    );
    expect(ends).toHaveLength(2);
    expect(hands).toEqual(ends);
  });
});

describe("hai nhân vật ở left và right", () => {
  it("bàn tay vươn xa nhất của một nhân vật không chạm thân nhân vật kia", () => {
    for (const id of Object.keys(KIT_ASSETS.background)) {
      const stage = getBackground(id).stage;
      // Hai bên nhìn vào nhau: tay phía phải (armB) của người bên trái hướng vào giữa, người bên phải lật ngang.
      const gap = (stage.slots.right - stage.slots.left) / stage.actorScale;
      const reach = (skin: string) => {
        const s = getSkin(skin);
        let max = 0;
        for (const motion of MOTIONS) {
          for (let frame = 0; frame <= 120; frame += 2) {
            const g = characterGeometry(s, sampleAction(getMotion(motion), frame));
            for (const arm of g.arms) {
              max = Math.max(max, arm.end.x + s.handRadius);
            }
          }
        }
        return max;
      };
      for (const a of SKINS) {
        for (const b of SKINS) {
          expect(reach(a) + getSkin(b).bodyHalfWidth, `${id}: ${a} → ${b}`).toBeLessThan(gap);
        }
      }
    }
  });
});

describe("camera", () => {
  const slots: SlotName[] = ["left", "center", "right"];
  const sizes: ShotSize[] = ["wide", "medium", "close", "high"];

  it("khung không nhìn ra ngoài vùng đã vẽ của bối cảnh", () => {
    for (const id of Object.keys(KIT_ASSETS.background)) {
      const stage = getBackground(id).stage;
      for (const cam of Object.keys(KIT_ASSETS.camera)) {
        for (const size of sizes) {
          for (const slot of slots) {
            for (const skin of SKINS) {
              const s = getSkin(skin);
              for (const t of [0, 0.5, 1]) {
                const v = framing(
                  stage,
                  size,
                  {
                    x: stage.slots[slot],
                    height: s.height * stage.actorScale,
                    face: -s.headAnchor.y * stage.actorScale,
                  },
                  getCamera(cam),
                  t,
                );
                // Khung nghiêng (ADR-025) nhìn thấy cả hình bao của khung đã xoay.
                const { halfW, halfH } = viewHalfExtents(VERTICAL_FRAME, v.zoom, v.rotate);
                expect(v.cx - halfW).toBeGreaterThanOrEqual(stage.bounds.x0 - 1e-6);
                expect(v.cx + halfW).toBeLessThanOrEqual(stage.bounds.x1 + 1e-6);
                expect(v.cy - halfH).toBeGreaterThanOrEqual(stage.bounds.y0 - 1e-6);
                expect(v.cy + halfH).toBeLessThanOrEqual(stage.bounds.y1 + 1e-6);
              }
            }
          }
        }
      }
    }
  });

  it("cỡ cận đặt mặt nhân vật được lấy nét ở khoảng 42% chiều cao khung, trên vùng phụ đề", () => {
    const stage = getBackground("bg_room").stage;
    for (const skin of SKINS) {
      const s = getSkin(skin);
      const face = -s.headAnchor.y * stage.actorScale;
      const v = framing(
        stage,
        "close",
        { x: stage.slots.left, height: s.height * stage.actorScale, face },
        getCamera("cam_static"),
        0,
      );
      const screenY = FRAME_HEIGHT / 2 + (stage.groundY - face - v.cy) * v.zoom;
      expect(Math.abs(screenY - FRAME_HEIGHT * CLOSE_FACE_Y)).toBeLessThan(40);
    }
  });
});

describe("kho tài sản", () => {
  const assetsDir = join(srcDir, "assets");
  const manifests = walk(assetsDir)
    .filter((p) => p.endsWith("asset.json"))
    .map((p) => ({
      path: p,
      data: JSON.parse(readFileSync(p, "utf8")) as Record<string, unknown>,
    }));

  it("mỗi tài sản trong danh mục có đúng một thư mục và asset.json khớp id, kind", () => {
    const listed = listKitAssets()
      .map((a) => `${a.kind}/${a.id}`)
      .sort();
    const onDisk = manifests
      .map((m) => relative(assetsDir, dirname(m.path)).replaceAll("\\", "/"))
      .sort();
    expect(onDisk).toEqual(listed);
    for (const m of manifests) {
      const rel = relative(assetsDir, dirname(m.path)).replaceAll("\\", "/");
      expect(`${m.data.kind}/${m.data.id}`).toBe(rel);
    }
  });

  it("asset.json đúng hình dạng của ADR-016", () => {
    for (const { path, data } of manifests) {
      expect(Object.keys(data).sort(), path).toEqual(
        [
          "brandProfile",
          "createdBy",
          "description",
          "id",
          "kind",
          "licenses",
          "requestKey",
          "status",
          "tags",
          "version",
        ].sort(),
      );
      expect(data.id).toMatch(/^[a-z0-9_]{1,64}$/);
      expect(data.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(["director", "claude-code"]).toContain(data.createdBy);
      expect(["candidate", "approved"]).toContain(data.status);
      expect(Array.isArray(data.tags)).toBe(true);
      expect(Array.isArray(data.licenses)).toBe(true);
      expect(typeof data.description).toBe("string");
    }
  });

  it("có đủ phạm vi P6-05: 6 biểu cảm, 3 nhân vật, 2 bối cảnh, 7 tư thế và hành động cơ bản", () => {
    expect(EXPRESSIONS).toHaveLength(6);
    expect(SKINS.sort()).toEqual(["skin_bit", "skin_dau", "skin_ti"]);
    // ADR-017: bối cảnh tự tạo được thêm vào; hai bối cảnh làm tay luôn có.
    expect(Object.keys(KIT_ASSETS.background)).toEqual(
      expect.arrayContaining(["bg_room", "bg_classroom", "bg_meadow"]),
    );
    // ADR-025: hành động mới làm tay.
    for (const id of [
      "action_run",
      "action_think",
      "action_listen",
      "action_shrug",
      "action_present",
      "action_look_up",
      "action_follow",
      "pose_stand",
      "action_wave",
      "action_point",
      "action_celebrate",
      "action_panic",
      "action_walk",
      "action_talk",
    ]) {
      expect(() => getMotion(id)).not.toThrow();
    }
  });

  it("lớp da trùng `skin_asset_id` và `character_key` của seed kênh mặc định", () => {
    expect(getSkin("skin_ti").characterKey).toBe("ti");
    expect(getSkin("skin_bit").characterKey).toBe("bit");
    expect(getSkin("skin_dau").characterKey).toBe("dau");
  });

  it("id lạ bị từ chối", () => {
    expect(() => getSkin("skin_khong_co")).toThrow();
    expect(() => getMotion("toString")).toThrow();
  });

  it("version của kit khớp package.json", () => {
    const pkg = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8")) as {
      version: string;
    };
    expect(MOTION_KIT_VERSION).toBe(pkg.version);
  });
});

describe("ràng buộc code", () => {
  it("không Math.random, mạng, eval, import động, Date, process, R3F trong code kit", () => {
    const files = [...walk(srcDir), ...walk(join(pkgDir, "preview"))].filter(
      (p) => /\.(ts|tsx)$/.test(p) && !/\.test\.tsx?$/.test(p),
    );
    expect(files.length).toBeGreaterThan(10);
    const forbidden = [
      /Math\.random/,
      /\bfetch\s*\(/,
      /\beval\s*\(/,
      /new\s+Function/,
      /\bimport\s*\(/,
      /\bDate\b/,
      /\bprocess\./,
      /@react-three/,
      /from\s+"node:/,
    ];
    const hits = files.flatMap((f) => {
      const text = readFileSync(f, "utf8");
      return forbidden.filter((re) => re.test(text)).map((re) => `${relative(pkgDir, f)}: ${re}`);
    });
    expect(hits).toEqual([]);
  });
});

describe("khung ngang có minh họa, thẻ kết, cờ (ADR-029)", () => {
  const stage = getBackground("bg_meadow").stage;
  const actors = (["left", "center", "right"] as const).map((slot, i) => ({
    skin: getSkin(SKINS[i] as string),
    slot,
  }));
  const groupCenterX = (view: { cx: number; zoom: number }) =>
    WIDE_FRAME.width / 2 + (stage.slots.center - view.cx) * view.zoom;

  it("có minh họa thì nhóm nhân vật dồn sang nửa trái, minh họa có bên phải rộng; khung dọc không đổi", () => {
    const plain = shotFraming(stage, "wide", actors, 1, getCamera("cam_static"), 0, [], WIDE_FRAME);
    const reserved = shotFraming(
      stage,
      "wide",
      actors,
      1,
      getCamera("cam_static"),
      0,
      [],
      WIDE_FRAME,
      {
        reserveIllustration: true,
      },
    );
    expect(groupCenterX(reserved)).toBeLessThan(groupCenterX(plain));
    // Máy bị kẹp ở mép bối cảnh thì lớp nhân vật tự dời: tâm nhóm vào giữa nửa trái.
    const reserve = shotReserve({
      frame: WIDE_FRAME,
      camera: "cam_static",
      shotSize: "wide",
      hasIllustration: true,
    });
    const g = { x0: stage.slots.left - 200, x1: stage.slots.right + 200 };
    const shift = reserveShift(reserved, WIDE_FRAME, g, reserve);
    const center = WIDE_FRAME.width / 2 + ((g.x0 + g.x1) / 2 + shift - reserved.cx) * reserved.zoom;
    expect(center).toBeCloseTo(WIDE_FRAME.width / 4, 0);
    expect(
      shotReserve({
        frame: VERTICAL_FRAME,
        camera: "cam_static",
        shotSize: "wide",
        hasIllustration: true,
      }),
    ).toBeUndefined();
    expect(
      shotReserve({
        frame: WIDE_FRAME,
        camera: "cam_static",
        shotSize: "close",
        hasIllustration: true,
      }),
    ).toBeUndefined();
    expect(
      shotReserve({
        frame: WIDE_FRAME,
        camera: "cam_end_card",
        shotSize: "wide",
        hasIllustration: false,
      })?.side,
    ).toBe("left");
    const box = illustrationBox("board", 300, 400, WIDE_FRAME, { x0: 200, x1: 900 });
    expect(box.width).toBeGreaterThan(800);
    expect(box.height).toBeGreaterThan(WIDE_FRAME.height * 0.6);
    // Khung dọc bỏ qua tùy chọn.
    expect(
      shotFraming(stage, "wide", actors, 1, getCamera("cam_static"), 0, [], VERTICAL_FRAME, {
        reserveIllustration: true,
      }),
    ).toEqual(
      shotFraming(stage, "wide", actors, 1, getCamera("cam_static"), 0, [], VERTICAL_FRAME),
    );
    // Kiểu bảng theo bối cảnh: lớp học là bảng phấn.
    expect(boardThemeFor("bg_classroom")).toBe("chalk");
    expect(boardThemeFor("bg_lop_hoc_ab12")).toBe("chalk");
    expect(boardThemeFor("bg_meadow")).toBe("card");
  });

  it("khung kết ngang: nhân vật dồn sang phải (thẻ hồ sơ kênh bên trái), quay mặt sang trái", () => {
    const props = shotProps(30, {
      background: "bg_meadow",
      camera: "cam_end_card",
      shotSize: "wide",
      frameSize: WIDE_FRAME,
    });
    const svg = renderToStaticMarkup(<StageShot {...props} />);
    expect(svg).toBe(renderToStaticMarkup(<StageShot {...props} />));
    expect(END_CARD_SHARE).toBeGreaterThan(0.3);
  });

  it("cờ quốc gia từ nguồn có sẵn: đủ nước, đúng tên tiếng Việt, ảnh gốc nhúng trong SVG, tất định", () => {
    const flags = Object.keys(KIT_ASSETS.prop).filter((id) => id.startsWith("flag_"));
    expect(flags.length).toBeGreaterThan(240);
    for (const id of ["flag_vn", "flag_cl", "flag_ru", "flag_us", "flag_br"]) {
      expect(flags).toContain(id);
    }
    const manifest = JSON.parse(
      readFileSync(join(srcDir, "assets", "prop", "flag_vn", "asset.json"), "utf8"),
    ) as { tags: string[]; licenses: { name: string }[]; createdBy: string };
    expect(manifest.tags).toContain("cờ Việt Nam");
    expect(manifest.licenses[0]?.name).toBe("MIT");
    expect(manifest.createdBy).toBe("director");
    const flag = getProp("flag_cl");
    if (flag.placement !== "floor") {
      throw new Error("cờ phải là đồ vật đứng trên đất");
    }
    const Flag = flag.Component;
    const a = renderToStaticMarkup(
      <g>
        <Flag frame={12} t={0.5} seed={1} />
      </g>,
    );
    expect(a).toContain("data:image/svg+xml");
    expect(a).toBe(
      renderToStaticMarkup(
        <g>
          <Flag frame={12} t={0.5} seed={1} />
        </g>,
      ),
    );
    // Cờ bay: frame khác thì dải cờ lệch khác.
    expect(a).not.toBe(
      renderToStaticMarkup(
        <g>
          <Flag frame={20} t={0.5} seed={1} />
        </g>,
      ),
    );
  });
});
