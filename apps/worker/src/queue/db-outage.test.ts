import { isDatabaseUnavailableError, type StudioDb } from "@studio/db";
import { describe, expect, it } from "vitest";
import { type ConsumerDeps, type JobOutcome, processJobSurvivingDbOutage } from "./consumer.js";

/** PostgreSQL sập vì thiếu RAM rồi recovery: job đợi DB rồi chạy tiếp, không tốn lượt retry. */

const drizzleWrap = (cause: unknown) =>
  Object.assign(new Error('Failed query: select "jobs"."id" from "jobs"'), { cause });

const recovery = drizzleWrap(
  Object.assign(new Error("the database system is in recovery mode"), { code: "57P03" }),
);
const terminated = drizzleWrap(
  Object.assign(new Error("terminating connection because of crash of another server process"), {
    code: "57P02",
  }),
);
const closed = drizzleWrap(
  Object.assign(new Error("write CONNECTION_CLOSED"), { code: "CONNECTION_CLOSED" }),
);
const ok: JobOutcome = { role: "voice", status: "completed" };
const deps = { db: {} as StudioDb, dataDir: "." } as ConsumerDeps;

describe("PostgreSQL tạm sập (thiếu RAM, recovery)", () => {
  it("nhận ra lỗi DB không phục vụ qua chuỗi cause; lỗi thường thì không", () => {
    expect(isDatabaseUnavailableError(recovery)).toBe(true);
    expect(isDatabaseUnavailableError(terminated)).toBe(true);
    expect(isDatabaseUnavailableError(closed)).toBe(true);
    expect(
      isDatabaseUnavailableError(new Error("the database system is not yet accepting connections")),
    ).toBe(true);
    expect(isDatabaseUnavailableError(new Error("TTS align lỗi 503"))).toBe(false);
    expect(isDatabaseUnavailableError(drizzleWrap({ code: "23505" }))).toBe(false);
    expect(isDatabaseUnavailableError(null)).toBe(false);
  });

  it("DB sập hai lần: đợi rồi chạy lại cùng job, cuối cùng hoàn tất", async () => {
    const errors = [recovery, terminated];
    let runs = 0;
    let waits = 0;
    const outages: number[] = [];
    const outcome = await processJobSurvivingDbOutage(deps, "job-1", {
      run: async () => {
        runs += 1;
        const next = errors.shift();
        if (next !== undefined) throw next;
        return ok;
      },
      wait: async () => {
        waits += 1;
        return true;
      },
      onOutage: (_id, n) => outages.push(n),
    });
    expect(outcome).toEqual(ok);
    expect(runs).toBe(3);
    expect(waits).toBe(2);
    expect(outages).toEqual([1, 2]);
  });

  it("lỗi khác ném ra ngay để BullMQ retry như cũ", async () => {
    let runs = 0;
    await expect(
      processJobSurvivingDbOutage(deps, "job-2", {
        run: async () => {
          runs += 1;
          throw new Error("TTS align lỗi 503");
        },
        wait: async () => true,
      }),
    ).rejects.toThrow("503");
    expect(runs).toBe(1);
  });

  it("DB không sống lại trong thời gian chờ, hoặc sập quá số lần cho phép: ném lỗi", async () => {
    await expect(
      processJobSurvivingDbOutage(deps, "job-3", {
        run: async () => {
          throw recovery;
        },
        wait: async () => false,
      }),
    ).rejects.toBe(recovery);
    let runs = 0;
    await expect(
      processJobSurvivingDbOutage(deps, "job-4", {
        maxOutages: 2,
        run: async () => {
          runs += 1;
          throw recovery;
        },
        wait: async () => true,
      }),
    ).rejects.toBe(recovery);
    expect(runs).toBe(3);
  });
});
