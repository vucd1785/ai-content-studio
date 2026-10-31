import { vi } from "@/i18n/vi";
import type { AgentRole, AgentStatus } from "./studio-model";

/** Nhãn tiếng Việt của studio. Nguồn là `vi.studio` để mọi nhãn nút nằm trong từ điển (P2-05). */
export const studioLabels = vi.studio;

// Từ điển phải phủ đủ vai trò và trạng thái.
studioLabels.roles satisfies Record<AgentRole, string>;
studioLabels.statuses satisfies Record<AgentStatus, string>;
