/**
 * Spike P6-01: Gemini structured output có nhận schema shot list lồng nhau không.
 *
 *   node --env-file-if-exists=../../.env --import tsx src/spikes/p6-01/run-spike.ts --offline
 *   node --env-file-if-exists=../../.env --import tsx src/spikes/p6-01/run-spike.ts --live
 *
 * Live gọi đúng một lần cho mỗi cách mã hóa (3 lần), bằng model và thinking level của `.env`
 * (`readGeminiEnv`), qua client của adapter hiện hành. Đầu ra: data/spikes/p6-01/.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { readGeminiEnv } from "@studio/config/gemini";
import { createGeminiStructuredClient } from "../../llm/gemini-client.js";
import {
  sanitizeJsonSchemaForGemini,
  summarizeGeminiJsonSchema,
} from "../../llm/gemini-json-schema.js";
import {
  ACTIONS,
  BACKGROUNDS,
  BEATS,
  CHARACTERS,
  decodePayload,
  type Encoding,
  EXPRESSIONS,
  generationSchema,
  POSITIONS,
  payloadSchema,
  SHOT_SIZES,
  SPEAKERS,
  semanticCheck,
} from "./shot-list-schema.js";

const OUT = join(import.meta.dirname, "..", "..", "..", "..", "..", "data", "spikes", "p6-01");
const ALL: Encoding[] = ["nested", "shotsJson", "variantJson", "flat", "flatShotsJson"];
const only = process.argv
  .find((a) => a.startsWith("--only="))
  ?.slice("--only=".length)
  .split(",") as Encoding[] | undefined;
const ENCODINGS: Encoding[] = only ?? ALL;
const RESULT_FILE = only ? `results-${only.join("+")}.json` : "results.json";

const SYSTEM = `Bạn viết kịch bản video dọc ngắn tiếng Việt cho kênh hoạt hình có ba nhân vật vẽ bằng code:
- ti: Tí, nhân vật chính, tò mò, hay tự tin quá đà. Có nói.
- bit: Bit, robot thông minh hơi khô khan, đưa ra dữ kiện thật. Có nói.
- dau: Đậu, bạn nhỏ của Tí. KHÔNG BAO GIỜ nói, chỉ phản ứng bằng biểu cảm và hành động.
Thể loại "Nếu như…?": các nhịp theo thứ tự cold_open, premise, fun, fact, twist. Nhịp fact phải dựa trên một sự thật có nguồn, ghi nguồn vào factSource.
Mỗi phương án: 4–6 cảnh, mỗi cảnh là một nhịp, có câu thoại (lines) và danh sách shot (shots).
Mỗi shot: lineId là id câu thoại mà cú cắt neo vào; cutOnWord là MỘT từ có thật trong câu đó; background thuộc ${BACKGROUNDS.join(", ")}; shotSize thuộc ${SHOT_SIZES.join(", ")}; focus là nhân vật được nhìn; actors có 1–2 nhân vật, mỗi actor gồm character (${CHARACTERS.join(", ")}), action (${ACTIONS.join(", ")}), expression (${EXPRESSIONS.join(", ")}), position (${POSITIONS.join(", ")}); onScreenText tùy chọn, ngắn.
Nhịp hình: khoảng 20–27 cú cắt mỗi phút, hai shot liền nhau không cùng shotSize, không cảnh tĩnh quá 3 giây.
Câu thoại: speaker thuộc ${SPEAKERS.join(", ")}, emotion thuộc ${EXPRESSIONS.join(", ")}, id dạng l1, l2… duy nhất trong phương án.
Nếu schema yêu cầu trường dạng chuỗi JSON (shotsJson hoặc json) thì chuỗi đó phải là JSON hợp lệ đúng cấu trúc trên.
Nếu schema đặt lines và shots ở cấp phương án thì mỗi phần tử ghi sceneId của cảnh chứa nó; khi đó hai nhân vật của shot là actor1 và actor2 (actor2 có thể bỏ), hoặc actors trong chuỗi shotsJson.
Trả về đúng hai phương án khác nhau về cách kể.`;

const USER = `Brief: "Nếu như con người không cần ngủ?" Thời lượng 30–45 giây. Khán giả: người trẻ thích khoa học vui. Giọng điệu hài hước, có một sự thật bất ngờ.`;

const FIXTURE = {
  variants: [0, 1].map((n) => ({
    title: `Phương án ${n + 1}`,
    factSource: "Nguồn mẫu",
    scenes: BEATS.slice(0, 3).map((beat, i) => ({
      id: `c${i + 1}`,
      beat,
      lines: [
        { id: `l${i + 1}`, speaker: "ti", text: "Nếu mình không cần ngủ thì sao?", emotion: "vui" },
      ],
      shots: [
        {
          lineId: `l${i + 1}`,
          cutOnWord: "ngủ",
          background: "room_study",
          shotSize: (["wide", "close", "medium"] as const)[i],
          focus: "ti",
          actors: [{ character: "ti", action: "talk", expression: "vui", position: "left" }],
        },
      ],
    })),
  })),
};

function offline(): void {
  for (const encoding of ENCODINGS) {
    const schema = sanitizeJsonSchemaForGemini(generationSchema(encoding));
    console.log(
      encoding,
      JSON.stringify(summarizeGeminiJsonSchema(schema as Record<string, unknown>)),
    );
  }
  const parsed = payloadSchema.safeParse(FIXTURE);
  console.log("fixture zod", parsed.success);
  if (parsed.success) {
    console.log(
      "fixture semantic",
      JSON.stringify(semanticCheck(parsed.data.variants[0] as never)),
    );
  }
  // Mã hóa chuỗi phải giải về đúng dạng lồng nhau.
  const asShotsJson = {
    variants: FIXTURE.variants.map((v) => ({
      ...v,
      scenes: v.scenes.map(({ shots, ...s }) => ({ ...s, shotsJson: JSON.stringify(shots) })),
    })),
  };
  const asVariantJson = { variants: FIXTURE.variants.map((v) => ({ json: JSON.stringify(v) })) };
  console.log(
    "decode shotsJson",
    payloadSchema.safeParse(decodePayload("shotsJson", asShotsJson)).success,
  );
  console.log(
    "decode variantJson",
    payloadSchema.safeParse(decodePayload("variantJson", asVariantJson)).success,
  );
}

async function live(): Promise<number> {
  const config = readGeminiEnv(process.env);
  if (!config.apiKey) {
    console.error(JSON.stringify({ status: "blocked", reason: "Missing GEMINI_API_KEY" }));
    return 2;
  }
  const client = createGeminiStructuredClient(config);
  const rows: Array<Record<string, unknown>> = [];
  for (const encoding of ENCODINGS) {
    const started = performance.now();
    const row: Record<string, unknown> = {
      encoding,
      model: config.modelScript,
      thinkingLevel: config.thinkingLevelScript,
    };
    try {
      const res = await client.generateStructured({
        systemInstruction: SYSTEM,
        userPrompt: USER,
        responseJsonSchema: generationSchema(encoding),
        model: config.modelScript,
        thinkingLevel: config.thinkingLevelScript,
      });
      row.accepted = true;
      row.latencyMs = Math.round(performance.now() - started);
      row.usage = res.usage;
      writeFileSync(join(OUT, `${encoding}.raw.json`), res.jsonText);
      let decoded: unknown;
      try {
        decoded = decodePayload(encoding, JSON.parse(res.jsonText));
        row.decodeOk = true;
      } catch (error) {
        row.decodeOk = false;
        row.decodeError = error instanceof Error ? error.message : String(error);
      }
      if (row.decodeOk) {
        const parsed = payloadSchema.safeParse(decoded);
        row.zodOk = parsed.success;
        if (parsed.success) {
          row.semantic = parsed.data.variants.map((v) => semanticCheck(v));
        } else {
          row.zodIssues = parsed.error.issues
            .slice(0, 8)
            .map((i) => `${i.path.join(".")}: ${i.message}`);
        }
      }
    } catch (error) {
      row.accepted = false;
      row.latencyMs = Math.round(performance.now() - started);
      // Thông điệp lỗi của SDK không chứa key; vẫn cắt ngắn để log gọn.
      row.error = (error instanceof Error ? error.message : String(error)).slice(0, 600);
    }
    rows.push(row);
    console.log(JSON.stringify(row));
  }
  writeFileSync(join(OUT, RESULT_FILE), `${JSON.stringify(rows, null, 2)}\n`);
  return 0;
}

mkdirSync(OUT, { recursive: true });
if (process.argv.includes("--live")) {
  process.exitCode = await live();
} else {
  offline();
}
