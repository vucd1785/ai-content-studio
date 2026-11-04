import type { CameraMove } from "../../../stage/types.js";

/** Máy đứng yên. */
export const camStatic: CameraMove = () => ({ zoom: 1, dx: 0, dy: 0 });
