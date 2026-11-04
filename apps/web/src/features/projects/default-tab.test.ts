import { describe, expect, it } from "vitest";
import { defaultTab } from "./project-detail";

describe("màn mở sẵn theo trạng thái run (P2-11)", () => {
  it("đúng màn theo 06 mục Năm màn hình", () => {
    expect(defaultTab(null)).toBe("brief");
    expect(defaultTab("cancelled")).toBe("brief");
    expect(defaultTab("researching")).toBe("running");
    expect(defaultTab("producing_assets")).toBe("running");
    expect(defaultTab("failed")).toBe("running");
    expect(defaultTab("waiting_script_approval")).toBe("script");
    expect(defaultTab("waiting_final_approval")).toBe("final");
    expect(defaultTab("exporting")).toBe("final");
    expect(defaultTab("exported")).toBe("final");
  });
});
