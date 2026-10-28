import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildRedisEduVerticalFixtureProps } from "../fixtures/redis-edu-props";
import { hashEduVerticalRenderProps } from "../render-props/content-hash";
import {
  type RenderMediaFn,
  renderEduVerticalWithCache,
  resolveCachedMp4Path,
} from "./cached-render";

describe("renderEduVerticalWithCache", () => {
  const audioSha = "deadbeef".repeat(8);
  const acceptAnyMp4 = () => true;

  it("lần hai cùng hash không gọi renderMedia và trả path cũ", async () => {
    const cacheRoot = mkdtempSync(join(tmpdir(), "studio-video-cache-"));
    const props = buildRedisEduVerticalFixtureProps();
    const contentHash = hashEduVerticalRenderProps(props, { audioContentSha256: audioSha });
    let calls = 0;
    const renderMedia: RenderMediaFn = async ({ outputLocation, crf }) => {
      calls += 1;
      writeFileSync(outputLocation, `fake;crf=${crf}`);
    };

    try {
      const first = await renderEduVerticalWithCache({
        purpose: "preview",
        props,
        cacheRoot,
        serveUrl: "http://local.test",
        composition: {},
        audioContentSha256: audioSha,
        validateCachedMp4: acceptAnyMp4,
        renderMedia,
      });
      expect(first.cacheHit).toBe(false);
      expect(calls).toBe(1);

      const second = await renderEduVerticalWithCache({
        purpose: "preview",
        props,
        cacheRoot,
        serveUrl: "http://local.test",
        composition: {},
        audioContentSha256: audioSha,
        validateCachedMp4: acceptAnyMp4,
        renderMedia,
      });
      expect(second.cacheHit).toBe(true);
      expect(second.outputLocation).toBe(first.outputLocation);
      expect(calls).toBe(1);
      expect(readFileSync(first.outputLocation, "utf8")).toContain("crf=28");
    } finally {
      rmSync(cacheRoot, { recursive: true, force: true });
    }

    expect(contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("preview và export cùng hash vẫn render hai file khác CRF", async () => {
    const cacheRoot = mkdtempSync(join(tmpdir(), "studio-video-cache-"));
    const props = buildRedisEduVerticalFixtureProps();
    let calls = 0;
    const renderMedia: RenderMediaFn = async ({ outputLocation, crf }) => {
      calls += 1;
      writeFileSync(outputLocation, `crf=${crf}`);
    };

    try {
      await renderEduVerticalWithCache({
        purpose: "preview",
        props,
        cacheRoot,
        serveUrl: "http://local.test",
        composition: {},
        audioContentSha256: audioSha,
        validateCachedMp4: acceptAnyMp4,
        renderMedia,
      });
      await renderEduVerticalWithCache({
        purpose: "export",
        props,
        cacheRoot,
        serveUrl: "http://local.test",
        composition: {},
        audioContentSha256: audioSha,
        validateCachedMp4: acceptAnyMp4,
        renderMedia,
      });
      expect(calls).toBe(2);

      const previewPath = resolveCachedMp4Path(cacheRoot, {
        templateId: props.templateId,
        templateVersion: props.templateVersion,
        purpose: "preview",
        contentHash: hashEduVerticalRenderProps(props, { audioContentSha256: audioSha }),
      });
      const exportPath = resolveCachedMp4Path(cacheRoot, {
        templateId: props.templateId,
        templateVersion: props.templateVersion,
        purpose: "export",
        contentHash: hashEduVerticalRenderProps(props, { audioContentSha256: audioSha }),
      });
      expect(previewPath).not.toBe(exportPath);
    } finally {
      rmSync(cacheRoot, { recursive: true, force: true });
    }
  });

  it("file cache có sẵn không gọi renderMedia dù chưa render trong phiên", async () => {
    const cacheRoot = mkdtempSync(join(tmpdir(), "studio-video-cache-"));
    const props = buildRedisEduVerticalFixtureProps();
    const contentHash = hashEduVerticalRenderProps(props, { audioContentSha256: audioSha });
    const existing = resolveCachedMp4Path(cacheRoot, {
      templateId: props.templateId,
      templateVersion: props.templateVersion,
      purpose: "preview",
      contentHash,
    });
    mkdirSync(dirname(existing), { recursive: true });
    writeFileSync(existing, "preexisting");
    let calls = 0;

    try {
      const result = await renderEduVerticalWithCache({
        purpose: "preview",
        props,
        cacheRoot,
        serveUrl: "http://local.test",
        composition: {},
        audioContentSha256: audioSha,
        validateCachedMp4: acceptAnyMp4,
        renderMedia: async () => {
          calls += 1;
        },
      });
      expect(result.cacheHit).toBe(true);
      expect(result.outputLocation).toBe(existing);
      expect(calls).toBe(0);
    } finally {
      rmSync(cacheRoot, { recursive: true, force: true });
    }
  });

  it("file cache hỏng bị bỏ qua và render lại", async () => {
    const cacheRoot = mkdtempSync(join(tmpdir(), "studio-video-cache-"));
    const props = buildRedisEduVerticalFixtureProps();
    const contentHash = hashEduVerticalRenderProps(props, { audioContentSha256: audioSha });
    const existing = resolveCachedMp4Path(cacheRoot, {
      templateId: props.templateId,
      templateVersion: props.templateVersion,
      purpose: "preview",
      contentHash,
    });
    mkdirSync(dirname(existing), { recursive: true });
    writeFileSync(existing, "corrupt-not-mp4");
    let calls = 0;

    try {
      await renderEduVerticalWithCache({
        purpose: "preview",
        props,
        cacheRoot,
        serveUrl: "http://local.test",
        composition: {},
        audioContentSha256: audioSha,
        validateCachedMp4: (path) => readFileSync(path, "utf8") !== "corrupt-not-mp4",
        renderMedia: async ({ outputLocation, crf }) => {
          calls += 1;
          writeFileSync(outputLocation, `fake;crf=${crf}`);
        },
      });
      expect(calls).toBe(1);
    } finally {
      rmSync(cacheRoot, { recursive: true, force: true });
    }
  });
});
