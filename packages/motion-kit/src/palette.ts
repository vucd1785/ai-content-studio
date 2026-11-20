/**
 * Bảng màu của kit, lấy từ bản phác `docs/design/characters/sheet.html` và kênh mặc định (P6-07).
 * Tài sản mới dùng màu ở đây, không đặt mã màu mới.
 */
export const PALETTE = {
  ink: "#1f2a44",
  outline: "#0b0d12",
  paper: "#f4efe6",
  accent: "#f26b3a",
  screen: "#8fe9ff",
  leaf: "#6cc04a",
  // Tí
  tiSkin: "#fffaf2",
  // Bit
  bitShell: "#e9e4da",
  bitScreen: "#0b1220",
  bitJoint: "#3a4157",
  bitLight: "#d85a30",
  // Đậu
  dauInk: "#173b37",
  dauBody: "#2bb3a3",
  dauBelly: "#8fe0d4",
  dauStem: "#2f7a2a",
  // Bối cảnh
  wood: "#8b5e3c",
  woodDark: "#6b4a2e",
  wallInk: "#2a2420",
  // Đồ vật (P6-19)
  metal: "#9aa3b5",
  metalDark: "#4a5266",
  ok: "#4cd07d",
  alert: "#e5484d",
  warn: "#f5b83d",
  shield: "#4f81bd",
  shieldLight: "#a9c8f0",
  smoke: "#8a8f99",
} as const;
