import { describe, expect, it } from "vitest";
import { expressionFor, ROLE_STYLE } from "./robot";
import { AGENT_ROLES, AGENT_STATUSES, buildStations } from "./studio-model";
import { faceCameraYaw } from "./studio-scene";

describe("robot vai trò (P4-05)", () => {
  it("mỗi vai trò có màu và phụ kiện riêng", () => {
    const styles = AGENT_ROLES.map((role) => ROLE_STYLE[role]);
    expect(new Set(styles.map((style) => style.accent)).size).toBe(AGENT_ROLES.length);
    expect(new Set(styles.map((style) => style.accessory)).size).toBe(AGENT_ROLES.length);
  });

  it("biểu cảm lấy từ trạng thái đã lưu; trạng thái khác nhau cho mặt khác nhau", () => {
    expect(expressionFor("running")).toBe("focus");
    expect(expressionFor("waiting_approval")).toBe("wait");
    expect(expressionFor("completed")).toBe("happy");
    expect(expressionFor("failed")).toBe("dead");
    const faces = new Set(AGENT_STATUSES.map(expressionFor));
    expect(faces.size).toBeGreaterThanOrEqual(6);
  });

  it("robot ở mọi bàn quay cùng về phía camera", () => {
    for (const station of buildStations().slice(1)) {
      const yaw = faceCameraYaw(station.rotationY);
      expect(yaw).toBeGreaterThan(-Math.PI - 1e-9);
      expect(yaw).toBeLessThanOrEqual(Math.PI + 1e-9);
      // Hướng thế giới = hướng bàn + hướng cục bộ = hướng camera (π/4 với camera [10, 10, 10]).
      const world = station.rotationY + yaw;
      expect(Math.cos(world)).toBeCloseTo(Math.cos(Math.PI / 4), 6);
      expect(Math.sin(world)).toBeCloseTo(Math.sin(Math.PI / 4), 6);
    }
  });
});
