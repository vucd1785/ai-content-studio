# P1-07 — diagramJson intermediate representation

## A. Root-cause evidence and chosen workaround

**Evidence:** Gemini structured output accepts `diagram.nodes` (**DN**) and `diagram.edges` (**DE**) in isolation, but rejects the combined nested object (**DG**, **DL**) with HTTP 400 on both gemini-3.6-flash and gemini-3.8-flash. Removing optional `edge.label` (**DL**) did not fix the combined shape.

**Workaround:** Generation schema exposes optional scene field **`diagramJson: string`**. Adapter parses JSON and maps to authoritative **`diagram`** before Zod. Application Script JSON and `@studio/contracts` unchanged.

## B. Files changed

| File | Change |
|---|---|
| `apps/worker/src/llm/gemini-generation-schema.ts` | `diagram` → `diagramJson` string on scene |
| `apps/worker/src/llm/gemini-diagram-transform.ts` | **new** — map + test helper |
| `apps/worker/src/llm/gemini-diagram-transform.test.ts` | **new** — transform + repair tests |
| `apps/worker/src/llm/structured-output.ts` | `mapParsedJson` + `repairNotes`; transform errors in repair loop |
| `apps/worker/src/llm/gemini-adapter.ts` | Wire map + repair notes |
| `apps/worker/src/llm/script-prompt.ts` | System instruction for diagramJson |
| `apps/worker/src/llm/gemini-adapter.test.ts` | Gemini-shaped payloads via encoder |
| `apps/worker/src/llm/gemini-generation-schema.test.ts` | Assert diagramJson, no nested diagram |
| `data/pipeline/p1-07-incremental-schemas.ts` | `ISOLATION_NESTED_DIAGRAM_OBJECT` for historical DG/DN/DE/DL |
| `data/pipeline/p1-07-isolation-offline-checks.ts` | Use isolation nested diagram constant |

Production adapter path only; no TTS/Whisper/Remotion/Redis/Zod contract edits.

## C. New Gemini generation schema summary

Scene optional field: **`diagramJson: { type: "string" }`**. No nested `diagram`, `nodes`, or `edges` in generation schema. All other production fields unchanged (variants×2, metadata, scenes, codeSnippet, sources, five templateSlot values).

## D. Transformation behavior

`mapGeminiScriptVariantsResponse`:

- No `diagramJson` → scene unchanged (non-diagram scenes).
- Present `diagramJson` → must be string → `JSON.parse` → non-null object, not array → assign **`diagram`**, remove **`diagramJson`**.
- Malformed JSON, empty string, array/null/primitive → **`LlmError` `schema_invalid`** (no silent empty graph).

## E. Validation and repair integration

Order: parse outer JSON → **`mapParsedJson`** → **`scriptVariantsPayloadSchema` / `llmScriptSchema`**.

Single repair (ADR-007): transform failures and Zod failures share one repair prompt; **`repairNotes`** remind model to use **`diagramJson`**, not nested **`diagram`**. Usage array includes both calls when repair runs.

## F. Test results and typecheck

| Command | Result |
|---|---|
| `pnpm --filter @studio/worker test` | **46 passed** |
| `pnpm --filter @studio/worker typecheck` | **pass** |
| `p1-07-isolation-offline-checks.ts` | **pass** |

New coverage: valid/malformed diagramJson, labels preserved, two variants, repair + usage count, generation schema has no nested diagram arrays.

## G. Known risks or limitations

- Model may emit markdown inside **`diagramJson`** → parse/repair failure (one repair only).
- Edge **`from`/`to`** not validated against node ids in Zod (unchanged); bad refs may render poorly.
- Isolation variants **DG/DL** still use frozen nested diagram for historical comparison, not production export.

## H. Director live production smoke (one call, after approval)

```powershell
fnm --fnm-dir "E:\NodeVersions" exec --using=24 -- cmd /c "cd /d E:\Docker\ai-content-studio && corepack pnpm --filter @studio/worker llm:external"
```

Requires `GEMINI_API_KEY`, `REDIS_URL`, brief in `studio:llm:brief`. Expect exit 0, two Zod-valid variants, diagram scene with **`diagram`** (not **`diagramJson`**) in parsed output.

Optional schema byte check (offline): generation schema should be smaller than pre-IR ~1482 B F-era nested diagram.

## I. Acceptance checklist

- [ ] `llm:external` **PASS** once with configured production model
- [ ] Response validates **`scriptVariantsPayloadSchema`**
- [ ] Diagram scene(s) have **`nodes`** and **`edges`** with optional edge **`label`**
- [ ] No HTTP 400 on generation schema
- [ ] **`repairCount` ≤ 1** in normal smoke
- [ ] P1-07 task status / phase approval updated only after Director sign-off

**Stop:** Offline implementation complete. No Gemini calls from Agent. Await Director approval for live smoke.
