import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  Actor,
  blinkAt,
  CharacterFigure,
  CLOSE_FACE_Y,
  characterGeometry,
  elbowHeadClearance,
  FRAME_HEIGHT,
  FRAME_WIDTH,
  framing,
  getBackground,
  getCamera,
  getExpression,
  getMotion,
  getSkin,
  handHeadClearance,
  KIT_ASSETS,
  listKitAssets,
  MOTION_KIT_VERSION,
  mouthOpenAt,
  POSE_REST,
  type ShotSize,
  type SlotName,
  StageShot,
  type StageShotProps,
  sampleAction,
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

  it("mọi bối cảnh, camera, cỡ cảnh, không khí: cùng frame ra cùng SVG", () => {
    for (const background of Object.keys(KIT_ASSETS.background)) {
      for (const camera of Object.keys(KIT_ASSETS.camera)) {
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
    }
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
                const halfW = FRAME_WIDTH / 2 / v.zoom;
                const halfH = FRAME_HEIGHT / 2 / v.zoom;
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
    expect(Object.keys(KIT_ASSETS.background)).toHaveLength(2);
    for (const id of [
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
