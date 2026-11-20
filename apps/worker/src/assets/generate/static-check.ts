import { posix } from "node:path";
import ts from "typescript";

/**
 * Kiểm tĩnh code tài sản do Claude sinh (ADR-017 mục 2.4) trước khi ghi vào kho hay bundle.
 * Đây là danh sách cấm trên AST, không phải sandbox: mọi thứ không chắc an toàn đều bị chặn.
 */

/** Module được import: React, Remotion và vài module thuần của motion kit (đường dẫn từ `assets/<kind>/<id>/`). */
export const ALLOWED_IMPORTS = new Set([
  "react",
  "remotion",
  "../../../palette.js",
  "../../../rig/math.js",
  "../../../rig/pose.js",
  "../../../stage/types.js",
  "../../../stage/generated-stage.js",
  "../../prop/prop_server/index.js",
]);

/**
 * Import tương đối được so theo file nó trỏ tới, không theo chữ: tài sản prop viết `../prop_server/index.js`
 * cũng là `../../prop/prop_server/index.js`. Biết `kind` thì mới resolve được; không biết thì chỉ nhận đúng chữ.
 */
export function isAllowedImport(spec: string, kind: string | null): boolean {
  if (ALLOWED_IMPORTS.has(spec)) return true;
  if (kind === null || !spec.startsWith(".")) return false;
  const base = `/src/assets/${kind}/__asset__`;
  const target = posix.resolve(base, spec);
  for (const allowed of ALLOWED_IMPORTS) {
    if (allowed.startsWith(".") && posix.resolve(base, allowed) === target) return true;
  }
  return false;
}

/** Định danh không được xuất hiện ở bất kỳ đâu (truy cập mạng, hệ thống, thời gian, ngẫu nhiên, thực thi động). */
const FORBIDDEN_IDENTIFIERS = new Set([
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "EventSource",
  "eval",
  "Function",
  "require",
  "process",
  "globalThis",
  "global",
  "window",
  "self",
  "document",
  "navigator",
  "location",
  "localStorage",
  "sessionStorage",
  "indexedDB",
  "importScripts",
  "Date",
  "performance",
  "setTimeout",
  "setInterval",
  "queueMicrotask",
  "Reflect",
  "Proxy",
  "constructor",
  "prototype",
  "__proto__",
  "dangerouslySetInnerHTML",
  "useEffect",
  "useLayoutEffect",
  "useState",
  "useRef",
  "delayRender",
  "continueRender",
  "staticFile",
]);

/** Phần tử SVG/HTML không được dùng: chữ (ADR-014), nội dung ngoài, script. */
const FORBIDDEN_ELEMENTS = new Set([
  "text",
  "tspan",
  "textPath",
  "foreignObject",
  "image",
  "script",
  "iframe",
  "img",
  "use",
  "a",
  "style",
]);

export type StaticIssue = { message: string; line: number };

/**
 * Kích thước đồ vật `floor` phải nằm trong khoảng của bộ đầu (P6-19): rộng nhất 90 (khiên, hàng người) giữ được
 * luật khung "không chồng nhau, không bị mép cắt" ở mọi cỡ cảnh và vị trí.
 */
export const PROP_LIMITS = { halfWidth: { min: 40, max: 90 }, height: { max: 320 } } as const;

function propDimensionIssues(sf: ts.SourceFile): StaticIssue[] {
  const issues: StaticIssue[] = [];
  let found = false;
  const at = (node: ts.Node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "asset" &&
      node.initializer !== undefined &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      found = true;
      const prop = (name: string) =>
        node.initializer !== undefined && ts.isObjectLiteralExpression(node.initializer)
          ? node.initializer.properties.find(
              (p): p is ts.PropertyAssignment =>
                ts.isPropertyAssignment(p) && p.name.getText(sf) === name,
            )
          : undefined;
      const placement = prop("placement");
      if (
        placement === undefined ||
        !ts.isStringLiteral(placement.initializer) ||
        placement.initializer.text !== "floor"
      ) {
        issues.push({ message: 'placement phải là "floor"', line: at(node) });
      }
      const half = prop("halfWidth");
      const width =
        half !== undefined && ts.isNumericLiteral(half.initializer)
          ? Number(half.initializer.text)
          : null;
      if (
        width === null ||
        width < PROP_LIMITS.halfWidth.min ||
        width > PROP_LIMITS.halfWidth.max
      ) {
        issues.push({
          message: `halfWidth phải là số từ ${PROP_LIMITS.halfWidth.min} đến ${PROP_LIMITS.halfWidth.max}; vẽ thu gọn trong khoảng đó`,
          line: at(half ?? node),
        });
      }
      const height = prop("height");
      const h =
        height !== undefined && ts.isNumericLiteral(height.initializer)
          ? Number(height.initializer.text)
          : null;
      if (h === null || h <= 0 || h > PROP_LIMITS.height.max) {
        issues.push({
          message: `height phải là số từ 1 đến ${PROP_LIMITS.height.max}`,
          line: at(height ?? node),
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found ? issues : [];
}

export function checkGeneratedSource(
  source: string,
  fileName = "index.tsx",
  kind: "prop" | "background" | "action" | "pose" | null = null,
): StaticIssue[] {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
  const issues: StaticIssue[] = [];
  const add = (node: ts.Node, message: string) =>
    issues.push({ message, line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1 });
  let exportsAsset = false;

  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node)) {
      const spec = (node.moduleSpecifier as ts.StringLiteral).text;
      if (!isAllowedImport(spec, kind)) {
        add(node, `import không được phép: ${spec}`);
      }
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier !== undefined) {
      add(node, "không được re-export từ module khác");
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      add(node, "không được import() động");
    } else if (ts.isIdentifier(node) && FORBIDDEN_IDENTIFIERS.has(node.text)) {
      add(node, `định danh bị cấm: ${node.text}`);
    } else if (ts.isPrivateIdentifier(node)) {
      add(node, "không dùng thành viên private");
    } else if (
      ts.isPropertyAccessExpression(node) &&
      node.name.text === "random" &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "Math"
    ) {
      add(node, "không dùng Math.random; dùng rnd/wobble của motion kit");
    } else if (ts.isElementAccessExpression(node)) {
      // `obj["x"]` hay `obj[a + b]` có thể dựng ra tên bị cấm; chỉ cho chỉ số là số hoặc định danh.
      const arg = node.argumentExpression;
      if (!ts.isNumericLiteral(arg) && !ts.isIdentifier(arg)) {
        add(node, "truy cập phần tử chỉ được dùng số hoặc biến");
      }
    } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (/:\/\/|^data:|javascript:/i.test(node.text)) {
        add(node, "không được có URL trong chuỗi");
      }
    } else if (ts.isTaggedTemplateExpression(node)) {
      add(node, "không dùng tagged template");
    } else if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(sf);
      if (FORBIDDEN_ELEMENTS.has(tag)) {
        add(node, `phần tử bị cấm: <${tag}>`);
      }
    } else if (ts.isJsxAttribute(node)) {
      const name = node.name.getText(sf);
      if (/^on[A-Z]/.test(name) || name === "href" || name === "xlinkHref") {
        add(node, `thuộc tính bị cấm: ${name}`);
      }
    } else if (ts.isVariableStatement(node)) {
      const exported = node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
      if (exported) {
        for (const decl of node.declarationList.declarations) {
          if (ts.isIdentifier(decl.name) && decl.name.text === "asset") {
            exportsAsset = true;
          }
        }
      }
    } else if (
      ts.isClassDeclaration(node) ||
      ts.isClassExpression(node) ||
      ts.isWithStatement(node) ||
      ts.isDebuggerStatement(node) ||
      ts.isDeleteExpression(node)
    ) {
      add(node, "cú pháp bị cấm (class, with, debugger, delete)");
    } else if (ts.isExportAssignment(node)) {
      add(node, "không dùng export default; xuất `export const asset`");
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  if (!exportsAsset) {
    issues.push({ message: "thiếu `export const asset`", line: 1 });
  }
  if (kind === "prop") {
    issues.push(...propDimensionIssues(sf));
  }
  return issues;
}
