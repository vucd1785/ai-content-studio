import type { FC } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GENERATED_ASSETS } from "./assets/generated.js";
import {
  type AirPropProps,
  actorSlotX,
  FRAME_WIDTH,
  getBackground,
  getCamera,
  getProp,
  getSkin,
  KIT_ASSETS,
  layoutProps,
  PALETTE,
  type PropAsset,
  type ShotSize,
  type SlotName,
  StageShot,
  type StageShotProps,
  shotFraming,
} from "./index.js";

// Cờ quốc gia (ADR-029) dùng chung một thành phần `flagProp`: kiểm hai mẫu thay vì cả 249 cờ (luật khung bên
// dưới lặp mọi tổ hợp chỗ đứng nên kiểm cả bộ mất cả tiếng).
const FLAG_SAMPLES = ["flag_vn", "flag_cl"];
const PROPS = Object.keys(KIT_ASSETS.prop).filter(
  (id) => !id.startsWith("flag_") || FLAG_SAMPLES.includes(id),
);
const FLOOR = PROPS.filter((id) => getProp(id).placement === "floor");
const AIR = PROPS.filter((id) => getProp(id).placement === "air");

function renderProp(id: string, frame: number, t = 0.5): string {
  const asset = getProp(id);
  if (asset.placement === "air") {
    const Air = asset.Component;
    return renderToStaticMarkup(
      <svg>
        <title>{id}</title>
        <Air
          frame={frame}
          t={t}
          seed={3}
          from={{ x: 0, y: 1200 }}
          to={{ x: 900, y: 1300 }}
          scale={1.7}
        />
      </svg>,
    );
  }
  const Floor = asset.Component;
  return renderToStaticMarkup(
    <svg>
      <title>{id}</title>
      <Floor frame={frame} t={t} seed={3} />
    </svg>,
  );
}

const NoAir: FC<AirPropProps> = () => null;

const shot = (overrides: Partial<StageShotProps>): StageShotProps => ({
  frame: 30,
  startFrame: 0,
  durationInFrames: 90,
  background: "bg_room",
  shotSize: "wide",
  focus: 0,
  actors: [
    { skin: "skin_ti", action: "action_talk", expression: "expr_happy", slot: "left", seed: 1 },
  ],
  ...overrides,
});

describe("đồ vật là hàm thuần của frame (P6-19)", () => {
  it("cùng frame ra cùng SVG, và có chuyển động theo frame", () => {
    for (const id of PROPS) {
      const frames = [0, 7, 20, 45, 89];
      const svgs = frames.map((f) => renderProp(id, f, f / 89));
      frames.forEach((f, i) => {
        expect(renderProp(id, f, f / 89), `${id} f${f}`).toBe(svgs[i]);
      });
      expect(new Set(svgs).size, `${id} đứng yên`).toBeGreaterThan(1);
    }
  });

  it("không vẽ chữ: phụ đề là chữ duy nhất trong khung", () => {
    for (const id of PROPS) {
      expect(renderProp(id, 10)).not.toMatch(/<text|<tspan/);
    }
  });

  it("bộ đầu đủ 8 đồ vật, đúng một đồ vật bay", () => {
    // Đồ vật worker tự tạo (ADR-017) nằm ngoài bộ đầu; luật khung bên dưới vẫn kiểm cả chúng.
    const handMade = PROPS.filter(
      (id) => !Object.hasOwn(GENERATED_ASSETS.prop, id) && !id.startsWith("flag_"),
    );
    expect(handMade.sort()).toEqual(
      [
        "prop_laptop",
        "prop_load_meter",
        "prop_packets",
        "prop_queue_crowd",
        "prop_router_infected",
        "prop_server",
        "prop_server_overload",
        "prop_shield",
      ].sort(),
    );
    expect(AIR).toEqual(["prop_packets"]);
  });
});

describe("đặt đồ vật", () => {
  it("đồ vật `floor` lấy vị trí trống: giữa trước rồi hai bên", () => {
    expect(layoutProps(["prop_server"], ["left", "right"], "wide", getProp).floor).toEqual([
      { id: "prop_server", slot: "center" },
    ]);
    expect(layoutProps(["prop_server", "prop_shield"], ["left"], "high", getProp).floor).toEqual([
      { id: "prop_server", slot: "center" },
      { id: "prop_shield", slot: "right" },
    ]);
  });

  it("người cộng đồ vật `floor` không vượt số chỗ của cỡ khung; cỡ cận không có đồ vật", () => {
    const medium = layoutProps(["prop_server", "prop_shield"], ["left"], "medium", getProp);
    expect(medium.floor.map((p) => p.id)).toEqual(["prop_server"]);
    expect(medium.dropped).toEqual(["prop_shield"]);
    expect(layoutProps(["prop_server"], ["left", "right"], "medium", getProp).dropped).toEqual([
      "prop_server",
    ]);
    expect(
      layoutProps(["prop_server"], ["left", "right", "center"], "wide", getProp).dropped,
    ).toEqual(["prop_server"]);
    const close = layoutProps(["prop_server", "prop_packets"], ["left"], "close", getProp);
    expect(close.floor).toEqual([]);
    expect(close.air).toEqual([]);
    expect(close.dropped).toEqual(["prop_server", "prop_packets"]);
  });

  it("đồ vật `air` không chiếm chỗ, tối đa một; id trùng bị bỏ", () => {
    const fake: Record<string, PropAsset> = {
      air_a: { placement: "air", Component: NoAir },
      air_b: { placement: "air", Component: NoAir },
    };
    const get = (id: string) => fake[id] ?? getProp(id);
    const out = layoutProps(
      ["air_a", "prop_server", "air_b", "prop_server"],
      ["left", "right"],
      "wide",
      get,
    );
    expect(out.air).toEqual(["air_a"]);
    expect(out.floor).toEqual([{ id: "prop_server", slot: "center" }]);
    expect(out.dropped).toEqual(["air_b", "prop_server"]);
  });

  it("StageShot vẽ đồ vật đã đặt, bỏ đồ vật ở cỡ cận", () => {
    const wide = renderToStaticMarkup(
      <StageShot {...shot({ props: ["prop_shield", "prop_packets"] })} />,
    );
    expect(wide).toContain(PALETTE.shieldLight);
    expect(wide).toContain(PALETTE.paper);
    const close = renderToStaticMarkup(
      <StageShot {...shot({ shotSize: "close", props: ["prop_shield"] })} />,
    );
    expect(close).not.toContain(PALETTE.shieldLight);
  });

  it("StageShot có đồ vật: cùng frame ra cùng SVG", () => {
    const p = shot({ props: ["prop_server_overload", "prop_load_meter", "prop_packets"] });
    expect(renderToStaticMarkup(<StageShot {...p} />)).toBe(
      renderToStaticMarkup(<StageShot {...p} />),
    );
  });
});

describe("khung có đồ vật", () => {
  const SIZES: ShotSize[] = ["wide", "high", "medium"];
  const ACTOR_SETS: SlotName[][] = [["left"], ["center"], ["left", "right"], ["right"]];
  const SKIN_BY_SLOT: Record<SlotName, string> = {
    left: "skin_bit",
    center: "skin_dau",
    right: "skin_ti",
  };

  it("mọi người và đồ vật nằm trọn chiều ngang khung, không chồng nhau", async () => {
    for (const bg of Object.keys(KIT_ASSETS.background)) {
      // Nhả tiến trình giữa các bối cảnh: test lặp mọi tổ hợp nên chạy lâu, vitest cần gửi tiến độ.
      await new Promise((resolve) => setImmediate(resolve));
      const stage = getBackground(bg).stage;
      for (const size of SIZES) {
        for (const actorSlots of ACTOR_SETS) {
          for (const a of FLOOR) {
            for (const b of FLOOR) {
              const layout = layoutProps([a, b], actorSlots, size, getProp);
              const actors = actorSlots.map((slot) => ({
                skin: getSkin(SKIN_BY_SLOT[slot]),
                slot,
              }));
              const props = layout.floor.map((p) => {
                const asset = getProp(p.id);
                return {
                  slot: p.slot,
                  halfWidth: asset.placement === "floor" ? asset.halfWidth : 0,
                };
              });
              const shotSlots = [...actorSlots, ...props.map((p) => p.slot)];
              const v = shotFraming(stage, size, actors, 0, getCamera("cam_static"), 0, props);
              const boxes = [
                ...actors.map((x) => ({ slot: x.slot, half: x.skin.bodyHalfWidth })),
                ...props.map((x) => ({ slot: x.slot, half: x.halfWidth })),
              ]
                .map((o) => {
                  const cx = actorSlotX(stage, o.slot, shotSlots);
                  const half = o.half * stage.actorScale;
                  return { x0: cx - half, x1: cx + half };
                })
                .sort((p, q) => p.x0 - q.x0);
              const label = `${bg} ${size} [${actorSlots}] ${a}+${b}`;
              for (const box of boxes) {
                const s0 = FRAME_WIDTH / 2 + (box.x0 - v.cx) * v.zoom;
                const s1 = FRAME_WIDTH / 2 + (box.x1 - v.cx) * v.zoom;
                expect(s0, label).toBeGreaterThanOrEqual(-1e-6);
                expect(s1, label).toBeLessThanOrEqual(FRAME_WIDTH + 1e-6);
              }
              for (let i = 1; i < boxes.length; i++) {
                expect(boxes[i]?.x0 ?? 0, label).toBeGreaterThanOrEqual(boxes[i - 1]?.x1 ?? 0);
              }
            }
          }
        }
      }
    }
    // Kho bối cảnh và đồ vật tự tạo lớn dần (ADR-017): trần thời gian rộng hơn mặc định.
  }, 300_000);
});
