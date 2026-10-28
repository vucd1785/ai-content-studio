import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { describe, expect, it } from "vitest";
import { EDU_VERTICAL_COMPOSITION_ID, parseEduVerticalRenderProps } from "../render-props/schema";
import { renderEduVerticalWithCache } from "./cached-render";
import { PREVIEW_CRF, RENDER_CODEC } from "./config";

const propsPath = join(
  fileURLToPath(import.meta.url),
  "..",
  "..",
  "..",
  "fixtures",
  "edu-vertical-redis-props.json",
);

describe("renderEduVerticalWithCache integration", () => {
  it("render preview ngắn 30 frame và cache hit lần hai", async () => {
    const cacheRoot = mkdtempSync(join(tmpdir(), "studio-p1-05-render-"));
    try {
      const baseProps = JSON.parse(readFileSync(propsPath, "utf8")) as unknown;
      const inputProps = parseEduVerticalRenderProps({
        ...(baseProps as Record<string, unknown>),
        audio: {
          ...(baseProps as { audio: Record<string, unknown> }).audio,
          storageKey: "render/P1-05-silence.wav",
        },
      });

      const entryPoint = join(fileURLToPath(import.meta.url), "..", "..", "index.ts");
      const bundleStart = performance.now();
      const serveUrl = await bundle({
        entryPoint,
        webpackOverride: (config) => {
          config.resolve = config.resolve ?? {};
          config.resolve.extensionAlias = {
            ".js": [".ts", ".tsx", ".js"],
          };
          return config;
        },
      });
      const bundleMs = performance.now() - bundleStart;

      const composition = await selectComposition({
        serveUrl,
        id: EDU_VERTICAL_COMPOSITION_ID,
        inputProps,
      });

      let renderMediaCalls = 0;

      const first = await renderEduVerticalWithCache({
        purpose: "preview",
        props: inputProps,
        cacheRoot,
        serveUrl,
        composition,
        frameRange: [0, 29],
        renderMedia: async (opts) => {
          renderMediaCalls += 1;
          await renderMedia({
            codec: opts.codec,
            composition: opts.composition as typeof composition,
            serveUrl: opts.serveUrl,
            outputLocation: opts.outputLocation,
            inputProps: opts.inputProps,
            crf: opts.crf,
            frameRange: opts.frameRange ?? [0, 29],
          });
        },
      });

      expect(first.cacheHit).toBe(false);
      expect(renderMediaCalls).toBe(1);
      expect(first.crf).toBe(PREVIEW_CRF);

      const second = await renderEduVerticalWithCache({
        purpose: "preview",
        props: inputProps,
        cacheRoot,
        serveUrl,
        composition,
        frameRange: [0, 29],
        renderMedia: async () => {
          renderMediaCalls += 1;
        },
      });

      expect(second.cacheHit).toBe(true);
      expect(second.outputLocation).toBe(first.outputLocation);
      expect(renderMediaCalls).toBe(1);

      console.info(
        JSON.stringify({
          task: "P1-05",
          outputLocation: first.outputLocation,
          contentHash: first.contentHash,
          bundleSeconds: Number((bundleMs / 1000).toFixed(2)),
          codec: RENDER_CODEC,
        }),
      );
    } finally {
      rmSync(cacheRoot, { recursive: true, force: true });
    }
  }, 180_000);
});
