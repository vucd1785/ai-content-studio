import { describe, expect, it } from "vitest";
import { crfForPurpose, EXPORT_CRF, PREVIEW_CRF } from "./config";

describe("render config CRF", () => {
  it("preview và export là hai mức CRF hằng số", () => {
    expect(PREVIEW_CRF).toBeGreaterThan(EXPORT_CRF);
    expect(crfForPurpose("preview")).toBe(PREVIEW_CRF);
    expect(crfForPurpose("export")).toBe(EXPORT_CRF);
  });
});
