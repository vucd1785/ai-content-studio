import { describe, expect, it } from "vitest";
import { studioLabels } from "./studio-labels";
import {
  AGENT_ROLES,
  AGENT_STATUSES,
  buildStations,
  CAMERA_LIMITS,
  STATUS_VISUALS,
} from "./studio-model";

/** Source mọi file studio (trừ test), đọc qua Vite `?raw` để quét tĩnh. */
const RAW_SOURCES = import.meta.glob<string>(
  ["./*.ts", "./*.tsx", "!./*.test.ts", "!./*.test.tsx"],
  {
    query: "?raw",
    import: "default",
    eager: true,
  },
);

function studioSources(): { file: string; source: string }[] {
  return Object.entries(RAW_SOURCES).map(([file, source]) => ({ file, source }));
}

describe("studio model (P4-01)", () => {
  it("chín vị trí: Director ở giữa và tám vai trò (thêm Đăng bài, ADR-018)", () => {
    const stations = buildStations();
    expect(stations).toHaveLength(9);
    expect(stations[0]).toMatchObject({ id: "director", position: [0, 0, 0] });
    expect(stations.slice(1).map((s) => s.id)).toEqual([...AGENT_ROLES]);
    const distances = stations.slice(1).map((s) => Math.hypot(s.position[0], s.position[2]));
    for (const d of distances) expect(d).toBeCloseTo(4.2, 2);
  });

  it("mặc định mọi vai trò idle", () => {
    for (const station of buildStations()) {
      expect(station.status).toBe("idle");
      expect(station.visual).toEqual(STATUS_VISUALS.idle);
    }
  });

  it("phản ánh đúng props; vai trò thiếu vẫn idle", () => {
    const stations = buildStations({ script: "waiting_approval", voice: "running", qa: "failed" });
    const byId = Object.fromEntries(stations.map((s) => [s.id, s]));
    expect(byId.script?.status).toBe("waiting_approval");
    expect(byId.script?.visual.approvalSign).toBe(true);
    expect(byId.voice?.status).toBe("running");
    expect(byId.qa?.visual).toEqual(STATUS_VISUALS.failed);
    expect(byId.research?.status).toBe("idle");
  });

  it("bảng hình theo 06-3D-UI-DESIGN: đèn tắt cho idle/cancelled, biển chỉ khi waiting_approval", () => {
    for (const status of AGENT_STATUSES) {
      const visual = STATUS_VISUALS[status];
      expect(visual.approvalSign).toBe(status === "waiting_approval");
      expect(visual.lightIntensity === 0).toBe(status === "idle" || status === "cancelled");
      expect(studioLabels.statuses[status]).toBeTruthy();
    }
  });

  it("gọi lại với cùng props cho kết quả giống hệt (không phụ thuộc thời gian)", () => {
    const props = { video: "queued", producer: "completed" } as const;
    expect(buildStations(props)).toEqual(buildStations(props));
  });

  it("camera orthographic giới hạn góc nghiêng và zoom", () => {
    expect(CAMERA_LIMITS.minPolarAngle).toBeGreaterThan(0);
    expect(CAMERA_LIMITS.maxPolarAngle).toBeLessThan(Math.PI / 2);
    expect(CAMERA_LIMITS.minZoom).toBeLessThan(CAMERA_LIMITS.maxZoom);
    const scene = RAW_SOURCES["./studio-scene.tsx"] ?? "";
    expect(scene).toMatch(/<OrthographicCamera\s+makeDefault/);
    expect(scene).toMatch(/enablePan=\{false\}/);
  });

  it("không có interval/timer/useFrame tự đổi trạng thái trong studio", () => {
    expect(Object.keys(RAW_SOURCES).sort()).toEqual([
      "./canvas-flags.ts",
      "./robot.tsx",
      "./role-inspector.tsx",
      "./studio-labels.ts",
      "./studio-live.tsx",
      "./studio-model.ts",
      "./studio-scene.tsx",
      "./studio-store.ts",
      "./studio-workspace.tsx",
      "./use-studio-run.ts",
    ]);
    for (const { file, source } of studioSources()) {
      // robot.tsx được dùng useFrame cho chuyển động tư thế (P4-05), nhưng chỉ đọc prop `status`, không ghi state.
      const forbidden =
        file === "./robot.tsx"
          ? /setInterval|setTimeout|requestAnimationFrame|Date\.now|useState|useStudioStore/
          : /setInterval|setTimeout|requestAnimationFrame|useFrame|Date\.now/;
      expect(source, file).not.toMatch(forbidden);
    }
  });

  it("không import code từ apps/video; chỉ subscriber SSE được gọi API", () => {
    for (const { file, source } of studioSources()) {
      expect(source, file).not.toMatch(/@studio\/video|apps\/video|remotion/);
      if (file === "./use-studio-run.ts") {
        continue;
      }
      // Canvas, model, store đọc snapshot, không gọi API (06-3D-UI-DESIGN mục Hiệu năng).
      expect(source, file).not.toMatch(/\bfetch\(|apiRequest|useQuery|EventSource\(/);
    }
  });
});
