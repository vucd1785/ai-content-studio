import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { REDUCED_MOTION_QUERY, studioCanvasFlags } from "./canvas-flags";
import { StudioScene } from "./studio-scene";

// Canvas thật cần WebGL; thay bằng bản ghi lại props để kiểm cờ truyền vào (P4-03).
const canvasProps = vi.hoisted(() => [] as Record<string, unknown>[]);
vi.mock("@react-three/fiber", () => ({
  Canvas: (props: Record<string, unknown>) => {
    canvasProps.push(props);
    return null;
  },
}));
vi.mock("@react-three/drei", () => ({ OrbitControls: () => null, OrthographicCamera: () => null }));

type Listener = () => void;

function mockMatchMedia(initial: boolean) {
  const listeners = new Set<Listener>();
  const query = {
    matches: initial,
    media: REDUCED_MOTION_QUERY,
    addEventListener: (_: string, listener: Listener) => listeners.add(listener),
    removeEventListener: (_: string, listener: Listener) => listeners.delete(listener),
  };
  const matchMedia = vi.fn((media: string) => {
    expect(media).toBe(REDUCED_MOTION_QUERY);
    return query;
  });
  vi.stubGlobal("matchMedia", matchMedia);
  return {
    listeners,
    set(matches: boolean) {
      query.matches = matches;
      for (const listener of listeners) {
        listener();
      }
    },
  };
}

function lastCanvas() {
  const props = canvasProps.at(-1);
  return { dpr: props?.dpr, shadows: props?.shadows, frameloop: props?.frameloop };
}

afterEach(() => {
  canvasProps.length = 0;
  vi.unstubAllGlobals();
});

describe("cờ canvas studio (P4-03)", () => {
  it("hàm thuần: reduced motion → dpr 1, tắt shadow, tắt vòng lặp", () => {
    expect(studioCanvasFlags({ reducedMotion: true })).toEqual({ dpr: 1, shadows: false, frameloop: "demand" });
    expect(studioCanvasFlags({ reducedMotion: true, lowPower: false })).toEqual({
      dpr: 1,
      shadows: false,
      frameloop: "demand",
    });
    expect(studioCanvasFlags({ reducedMotion: false, lowPower: true })).toEqual({
      dpr: 1,
      shadows: false,
      frameloop: "always",
    });
    expect(studioCanvasFlags({ reducedMotion: false })).toEqual({ dpr: [1, 2], shadows: true, frameloop: "always" });
  });

  it("prefers-reduced-motion bật thì canvas nhận dpr 1, shadows false, frameloop demand", () => {
    mockMatchMedia(true);
    render(<StudioScene />);
    expect(lastCanvas()).toEqual({ dpr: 1, shadows: false, frameloop: "demand" });
  });

  it("không bật thì giữ mặc định; đổi media query lúc đang mở thì canvas đổi theo", () => {
    const media = mockMatchMedia(false);
    const { unmount } = render(<StudioScene />);
    expect(lastCanvas()).toEqual({ dpr: [1, 2], shadows: true, frameloop: "always" });
    act(() => media.set(true));
    expect(lastCanvas()).toEqual({ dpr: 1, shadows: false, frameloop: "demand" });
    unmount();
    expect(media.listeners.size).toBe(0);
  });

  it("prop ghi đè media query; lowPower chỉ hạ dpr và shadow", () => {
    mockMatchMedia(false);
    const { rerender } = render(<StudioScene reducedMotion />);
    expect(lastCanvas()).toEqual({ dpr: 1, shadows: false, frameloop: "demand" });
    rerender(<StudioScene reducedMotion={false} lowPower />);
    expect(lastCanvas()).toEqual({ dpr: 1, shadows: false, frameloop: "always" });
  });

  it("không có matchMedia (môi trường cũ) thì coi như không giảm chuyển động", () => {
    vi.stubGlobal("matchMedia", undefined);
    render(<StudioScene />);
    expect(lastCanvas()).toEqual({ dpr: [1, 2], shadows: true, frameloop: "always" });
  });
});
