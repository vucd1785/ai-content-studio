import type { ExpressionSpec } from "../../../rig/face.js";

/** Biểu cảm "Buồn". */
export const exprSad: ExpressionSpec = {
  eyes: "oval",
  brows: [-16, 16, -24],
  mouth: "frown",
  look: [0, 4],
  tear: true,
};
