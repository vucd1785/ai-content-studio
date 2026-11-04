/**
 * Mô hình thuần của studio 3D (06-3D-UI-DESIGN). Không timer, không fetch:
 * trạng thái chỉ đến từ props (sau này từ store cập nhật bằng SSE, P4-02).
 */

/** Bảy vai trò theo 04-AGENT-ORCHESTRATION (enum `agent_run_role`). */
export const AGENT_ROLES = [
  "producer",
  "research",
  "script",
  "visual",
  "voice",
  "video",
  "qa",
] as const;
export type AgentRole = (typeof AGENT_ROLES)[number];

/** Enum `agent_run_status`. */
export const AGENT_STATUSES = [
  "idle",
  "queued",
  "running",
  "waiting_approval",
  "completed",
  "failed",
  "cancelled",
] as const;
export type AgentStatus = (typeof AGENT_STATUSES)[number];

export type StatusVisual = {
  /** Màu đèn trạng thái. */
  lightColor: string;
  /** Cường độ phát sáng: 0 = đèn tắt. */
  lightIntensity: number;
  /** Có biển "chờ duyệt" trên bàn. */
  approvalSign: boolean;
};

/** Bảng "Ánh xạ trạng thái" trong 06-3D-UI-DESIGN.md, màu theo token thiết kế (cùng màu với 2D). */
export const STATUS_VISUALS: Readonly<Record<AgentStatus, StatusVisual>> = {
  idle: { lightColor: "#4a4f5a", lightIntensity: 0, approvalSign: false },
  queued: { lightColor: "#e7a33e", lightIntensity: 0.5, approvalSign: false },
  running: { lightColor: "#5b78ff", lightIntensity: 1.6, approvalSign: false },
  waiting_approval: { lightColor: "#e7a33e", lightIntensity: 1.2, approvalSign: true },
  completed: { lightColor: "#3fb27f", lightIntensity: 0.9, approvalSign: false },
  failed: { lightColor: "#e5534b", lightIntensity: 1.4, approvalSign: false },
  cancelled: { lightColor: "#4a4f5a", lightIntensity: 0, approvalSign: false },
};

/** Thứ chọn được trong studio: bàn Director hoặc một vai trò (P4-04). */
export type StudioSelection = AgentRole | "director";

export type StationModel = {
  id: StudioSelection;
  position: readonly [number, number, number];
  /** Hướng bàn quay về tâm (radian quanh trục Y). */
  rotationY: number;
  status: AgentStatus;
  visual: StatusVisual;
};

const RING_RADIUS = 4.2;

/**
 * Tám vị trí: bảy bàn vai trò quanh vòng tròn, bàn Director ở giữa.
 * Vai trò không có trong `statuses` mặc định `idle`. Bàn Director không có trạng thái agent.
 */
export function buildStations(
  statuses: Partial<Record<AgentRole, AgentStatus>> = {},
): StationModel[] {
  const roleStations = AGENT_ROLES.map((role, index): StationModel => {
    const angle = (index / AGENT_ROLES.length) * Math.PI * 2;
    const x = Math.sin(angle) * RING_RADIUS;
    const z = Math.cos(angle) * RING_RADIUS;
    const status = statuses[role] ?? "idle";
    return {
      id: role,
      position: [round(x), 0, round(z)],
      rotationY: angle + Math.PI,
      status,
      visual: STATUS_VISUALS[status],
    };
  });
  const director: StationModel = {
    id: "director",
    position: [0, 0, 0],
    rotationY: 0,
    status: "idle",
    visual: STATUS_VISUALS.idle,
  };
  return [director, ...roleStations];
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** Giới hạn camera: isometric, chỉ orbit trong khoảng nghiêng hẹp, không pan. */
export const CAMERA_LIMITS = {
  position: [10, 10, 10] as const,
  zoom: 55,
  minZoom: 35,
  maxZoom: 90,
  minPolarAngle: Math.PI / 5,
  maxPolarAngle: Math.PI / 3,
} as const;
