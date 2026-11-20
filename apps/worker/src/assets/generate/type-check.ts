import { dirname, join, resolve } from "node:path";
import ts from "typescript";

/** Kiểu mà `export const asset` phải khai báo, theo kind (ADR-017 mục 2.4). */
export const ASSET_TYPE_BY_KIND = {
  prop: "PropAsset",
  background: "BackgroundAsset",
  action: "ActionClip",
  pose: "ActionClip",
} as const;
export type GeneratableKind = keyof typeof ASSET_TYPE_BY_KIND;

/**
 * Typecheck một file tài sản trong `packages/motion-kit` bằng compiler API (không chạy code, không bundle).
 * Chỉ trả lỗi của chính file đó; lỗi ở file khác của kit không phải do tài sản mới.
 */
export function typecheckAssetFile(
  motionKitDir: string,
  file: string,
  kind: GeneratableKind,
): string[] {
  const configPath = join(motionKitDir, "tsconfig.json");
  const read = ts.readConfigFile(configPath, (p) => ts.sys.readFile(p));
  if (read.error !== undefined) {
    return [
      `không đọc được tsconfig: ${ts.flattenDiagnosticMessageText(read.error.messageText, "\n")}`,
    ];
  }
  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, dirname(configPath));
  const program = ts.createProgram({
    rootNames: [file],
    options: { ...parsed.options, noEmit: true },
  });
  const target = resolve(file);
  const sf = program.getSourceFile(file);
  if (sf === undefined) {
    return ["không nạp được file tài sản"];
  }
  const errors = ts
    .getPreEmitDiagnostics(program, sf)
    .filter((d) => d.file === undefined || resolve(d.file.fileName) === target)
    .map((d) => {
      const pos =
        d.file !== undefined && d.start !== undefined
          ? `dòng ${d.file.getLineAndCharacterOfPosition(d.start).line + 1}: `
          : "";
      return `${pos}${ts.flattenDiagnosticMessageText(d.messageText, " ")}`;
    });

  const expected = ASSET_TYPE_BY_KIND[kind];
  let annotated = false;
  ts.forEachChild(sf, (node) => {
    if (!ts.isVariableStatement(node)) {
      return;
    }
    for (const decl of node.declarationList.declarations) {
      if (ts.isIdentifier(decl.name) && decl.name.text === "asset") {
        annotated = decl.type?.getText(sf) === expected;
      }
    }
  });
  if (!annotated) {
    errors.push(`\`asset\` phải khai báo kiểu ${expected}`);
  }
  return errors;
}
