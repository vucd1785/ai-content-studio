import { describe, expect, it } from "vitest";
import { formatRoute, parseRoute } from "./hash-route";

const ID = "00000000-0000-4000-8000-0000000000aa";

describe("định tuyến hash (P7-04)", () => {
  it("đọc và ghi đủ các màn", () => {
    for (const hash of [
      "#/",
      `#/projects/${ID}`,
      `#/projects/${ID}/script`,
      "#/usage",
      "#/library",
      "#/brand",
      "#/publish-guide",
    ]) {
      expect(formatRoute(parseRoute(hash))).toBe(hash);
    }
  });

  it("hash lạ hoặc tab lạ về màn an toàn", () => {
    expect(parseRoute("")).toEqual({ page: "home" });
    expect(parseRoute("#/khong-co")).toEqual({ page: "home" });
    expect(parseRoute("#/projects/<script>")).toEqual({ page: "home" });
    expect(parseRoute(`#/projects/${ID}/lung-tung`)).toEqual({
      page: "project",
      projectId: ID,
      tab: null,
    });
  });
});
