import { describe, expect, it } from "vitest";
import { approvalBodySchema, eventIdSchema, eventStreamQuerySchema } from "./workflow.js";

const artifactId = "00000000-0000-4000-8000-000000000001";

describe("approvalBodySchema", () => {
  it("thiếu decision là lỗi, không có default", () => {
    const parsed = approvalBodySchema.safeParse({ gate: "script", artifactId });
    expect(parsed.success).toBe(false);
  });

  it("approved cho phép note rỗng hoặc thiếu", () => {
    expect(
      approvalBodySchema.safeParse({ gate: "script", decision: "approved", artifactId, variantIndex: 1 }).success,
    ).toBe(true);
    expect(
      approvalBodySchema.safeParse({ gate: "final", decision: "approved", artifactId, note: "" }).success,
    ).toBe(true);
  });

  it("changes_requested và rejected bắt buộc note 1–2000", () => {
    for (const decision of ["changes_requested", "rejected"]) {
      expect(approvalBodySchema.safeParse({ gate: "script", decision, artifactId }).success).toBe(false);
      expect(
        approvalBodySchema.safeParse({ gate: "script", decision, artifactId, note: "" }).success,
      ).toBe(false);
      expect(
        approvalBodySchema.safeParse({ gate: "script", decision, artifactId, note: "Sửa cảnh 2" }).success,
      ).toBe(true);
      expect(
        approvalBodySchema.safeParse({ gate: "script", decision, artifactId, note: "x".repeat(2001) })
          .success,
      ).toBe(false);
    }
  });

  it("variantIndex (quyết định 6): bắt buộc 1|2 khi duyệt script, cấm ở decision và gate khác", () => {
    const base = { gate: "script", decision: "approved", artifactId };
    expect(approvalBodySchema.safeParse(base).success).toBe(false);
    expect(approvalBodySchema.safeParse({ ...base, variantIndex: 2 }).success).toBe(true);
    for (const bad of [0, 3, "1", 1.5]) {
      expect(approvalBodySchema.safeParse({ ...base, variantIndex: bad }).success, String(bad)).toBe(false);
    }
    expect(
      approvalBodySchema.safeParse({ gate: "script", decision: "rejected", artifactId, note: "x", variantIndex: 1 })
        .success,
    ).toBe(false);
    expect(
      approvalBodySchema.safeParse({ gate: "final", decision: "approved", artifactId, variantIndex: 1 }).success,
    ).toBe(false);
  });

  it("gate và decision ngoài enum bị từ chối", () => {
    expect(approvalBodySchema.safeParse({ gate: "preview", decision: "approved", artifactId }).success).toBe(
      false,
    );
    expect(approvalBodySchema.safeParse({ gate: "script", decision: "auto", artifactId }).success).toBe(false);
    expect(approvalBodySchema.safeParse({ gate: "script", decision: "approved", artifactId: "x" }).success).toBe(
      false,
    );
  });
});

describe("eventIdSchema (P3-07)", () => {
  it("nhận số nguyên không âm tới giới hạn bigint", () => {
    for (const value of ["0", "1", "124", "9223372036854775807"]) {
      expect(eventIdSchema.safeParse(value).success, value).toBe(true);
    }
  });

  it("từ chối chuỗi lạ, số âm, thập phân, số 0 đứng đầu, vượt bigint mà không ném lỗi", () => {
    for (const value of ["", "abc", "-1", "1.5", "01", " 1", "9223372036854775808", "99999999999999999999"]) {
      expect(eventIdSchema.safeParse(value).success, value).toBe(false);
    }
  });

  it("afterId là tùy chọn", () => {
    expect(eventStreamQuerySchema.parse({})).toEqual({});
    expect(eventStreamQuerySchema.parse({ afterId: "5" })).toEqual({ afterId: "5" });
  });
});
