/**
 * Các bước của một lượt chạy và ước tính thời gian (P2-11). Hàm thuần: chỉ đọc trạng thái đã lưu và mốc thật
 * của agent. Không có phần trăm tiến độ (ADR-009): bước đang chạy hiện thời gian đã chạy thật cùng khoảng ước tính.
 */

/**
 * Tốc độ đo trên máy dev hiện tại (i3-4005U, không GPU), ngày 2026-10-31:
 * - Gemini: research khoảng 5 s, script khoảng 10 s (lần chạy thật P3-10); lấy dư cho mạng.
 * - TTS VieNeu CPU: RTF khoảng 9 (đo lại sau sự cố voice, P3-11 mục 6).
 * - Alignment Whisper CPU: RTF khoảng 1,2 (P0-04), cộng chi phí cố định mỗi cảnh.
 * - Remotion: bundle 10–25 s, khoảng 5,5 s máy cho mỗi giây video (P1-04); export CRF thấp chậm hơn preview.
 * Máy khác thì sửa ở đây; giá trị chỉ dùng để ước tính.
 */
export const MACHINE_SPEED = {
  researchSec: 15,
  scriptSec: 25,
  ttsRealTimeFactor: 9,
  alignRealTimeFactor: 1.2,
  perSceneOverheadSec: 10,
  scenes: 5,
  renderBundleSec: 25,
  renderSecPerVideoSec: 5.5,
  exportSlowdown: 1.3,
  qaSec: 10,
} as const;

/** Bước máy làm có biên trên rộng hơn: TTS trên CPU dao động mạnh khi máy bận. */
const UPPER_FACTOR = { llm: 1.5, media: 2 } as const;

export type StepId =
  | "research"
  | "script"
  | "scriptGate"
  | "assets"
  | "render"
  | "finalGate"
  | "export";

export type StepState = "done" | "active" | "waiting_you" | "failed" | "todo" | "stopped";

export type RunStep = {
  id: StepId;
  /** Bước chờ Director quyết định: không có ước tính. */
  gate: boolean;
  state: StepState;
  /** Khoảng ước tính [thấp, cao] tính bằng giây; null với bước chờ Director. */
  estimateSec: [number, number] | null;
  /** Thời gian đã chạy thật của bước đang chạy, từ `startedAt` của agent. */
  elapsedSec: number | null;
  /** Tiến độ thật của job media đang chạy (P3-17): đếm bước cảnh hoặc frame, không phải ước tính. */
  progress: StepProgress | null;
  /** Lỗi đã lưu của bước lỗi (P3-17). */
  error: StepError | null;
};

type ProgressPhase = "synthesize" | "align" | "assets" | "stills";

export type StepProgress = {
  percent: number;
  done: number;
  total: number;
  unit: "scene_step" | "frame" | "image";
  /** Voice: cảnh và câu đang làm, do worker ghi (không tự suy từ `done`). */
  sceneIndex: number | null;
  sceneCount: number | null;
  lineIndex: number | null;
  lineCount: number | null;
  phase: ProgressPhase | null;
};

export type StepError = { role: string | null; code: string; message: string | null };

type AgentProgressInput = {
  done: number;
  total: number;
  unit: "scene_step" | "frame" | "image";
  sceneIndex?: number | null;
  sceneCount?: number | null;
  lineIndex?: number | null;
  lineCount?: number | null;
  phase?: ProgressPhase | null;
} | null;

/**
 * Phần trăm và việc đang làm từ số đếm đã lưu (P3-17). Cảnh, câu và pha lấy đúng giá trị worker ghi:
 * story v2 đọc từng câu nên một cảnh có nhiều bước, không suy được từ `done` (lỗi "cảnh 15/8").
 */
export function stepProgress(progress: AgentProgressInput): StepProgress | null {
  if (progress === null || progress.total <= 0) {
    return null;
  }
  const done = Math.min(Math.max(progress.done, 0), progress.total);
  const finished = done >= progress.total;
  const sceneCount = progress.sceneCount ?? null;
  const sceneIndex =
    progress.sceneIndex == null || finished
      ? null
      : sceneCount === null
        ? progress.sceneIndex
        : Math.min(progress.sceneIndex, sceneCount);
  return {
    percent: Math.floor((done / progress.total) * 100),
    done,
    total: progress.total,
    unit: progress.unit,
    sceneIndex,
    sceneCount,
    lineIndex: finished ? null : (progress.lineIndex ?? null),
    lineCount: finished ? null : (progress.lineCount ?? null),
    phase: finished && progress.unit !== "image" ? null : (progress.phase ?? null),
  };
}

const ORDER: StepId[] = [
  "research",
  "script",
  "scriptGate",
  "assets",
  "render",
  "finalGate",
  "export",
];

/** Bước đang ở theo `workflow_runs.status` (04-AGENT-ORCHESTRATION). */
const STATUS_STEP: Record<string, StepId> = {
  idea_submitted: "research",
  researching: "research",
  research_ready: "script",
  scripting: "script",
  // Storyboard (P6-10) thuộc bước viết kịch bản: Director chưa có gì để duyệt.
  storyboarding: "script",
  waiting_script_approval: "scriptGate",
  producing_assets: "assets",
  preview_rendering: "render",
  qa: "render",
  waiting_final_approval: "finalGate",
  exporting: "export",
};

/** Bước tương ứng `resume_from` khi run lỗi. */
const RESUME_STEP: Record<string, StepId> = {
  researching: "research",
  scripting: "script",
  producing_assets: "assets",
  preview_rendering: "render",
  qa: "render",
  exporting: "export",
};

/** Role agent của từng bước máy làm (để lấy thời gian đã chạy thật). */
const STEP_ROLES: Partial<Record<StepId, string[]>> = {
  research: ["research"],
  // Storyboard (vai `visual`) chạy trong bước viết kịch bản: tạo hình mới rồi chụp ảnh từng cảnh.
  script: ["script", "visual"],
  assets: ["visual", "voice"],
  render: ["video", "qa"],
  export: ["video"],
};

function range(seconds: number, upper: number): [number, number] {
  return [Math.round(seconds), Math.round(seconds * upper)];
}

/** Ước tính từng bước máy làm cho video dài `durationSec` giây (độ dài mục tiêu trong brief). */
export function estimateStepSeconds(durationSec: number): Record<StepId, [number, number] | null> {
  const s = MACHINE_SPEED;
  const voice =
    durationSec * (s.ttsRealTimeFactor + s.alignRealTimeFactor) + s.scenes * s.perSceneOverheadSec;
  const render = s.renderBundleSec + durationSec * s.renderSecPerVideoSec + s.qaSec;
  const exportRender = s.renderBundleSec + durationSec * s.renderSecPerVideoSec * s.exportSlowdown;
  return {
    research: range(s.researchSec, UPPER_FACTOR.llm),
    script: range(s.scriptSec, UPPER_FACTOR.llm),
    scriptGate: null,
    assets: range(voice, UPPER_FACTOR.media),
    render: range(render, UPPER_FACTOR.media),
    finalGate: null,
    export: range(exportRender, UPPER_FACTOR.media),
  };
}

export type RunStepsInput = {
  /** `null` khi project chưa có lượt chạy. */
  status: string | null;
  resumeFrom: string | null;
  durationSec: number;
  agentRuns: {
    role: string;
    status: string;
    startedAt: string | null;
    errorCode?: string | null;
    errorMessage?: string | null;
    progress?: AgentProgressInput;
  }[];
  /** Lỗi ghi ở run khi không tìm được agent lỗi. */
  failureCode?: string | null;
  failureMessage?: string | null;
  now: number;
};

export function buildRunSteps(input: RunStepsInput): RunStep[] {
  const estimates = estimateStepSeconds(input.durationSec);
  const failedAt = input.status === "failed" ? (RESUME_STEP[input.resumeFrom ?? ""] ?? null) : null;
  const current =
    input.status === null
      ? null
      : input.status === "exported"
        ? "done-all"
        : (failedAt ?? STATUS_STEP[input.status] ?? null);
  const currentIndex =
    current === "done-all" ? ORDER.length : current === null ? -1 : ORDER.indexOf(current);
  return ORDER.map((id, index) => {
    const gate = id === "scriptGate" || id === "finalGate";
    let state: StepState = "todo";
    if (index < currentIndex) {
      state = "done";
    } else if (index === currentIndex) {
      state =
        input.status === "cancelled"
          ? "stopped"
          : failedAt !== null
            ? "failed"
            : gate
              ? "waiting_you"
              : "active";
    }
    let elapsedSec: number | null = null;
    let progress: StepProgress | null = null;
    let error: StepError | null = null;
    const agents = input.agentRuns.filter((agent) => STEP_ROLES[id]?.includes(agent.role));
    if (state === "failed") {
      const failed = agents.find((agent) => agent.status === "failed" && agent.errorCode);
      const code = failed?.errorCode ?? input.failureCode ?? null;
      if (code !== null) {
        error = {
          role: failed?.role ?? null,
          code,
          message: failed?.errorMessage ?? input.failureMessage ?? null,
        };
      }
    }
    if (state === "active") {
      // Voice có nhiều bước nhất trong "Giọng và hình"; render và export là frame của video.
      const withProgress = agents
        .filter((agent) => agent.status === "running" && agent.progress)
        .sort((a, b) => (b.progress?.total ?? 0) - (a.progress?.total ?? 0))[0];
      progress = stepProgress(withProgress?.progress ?? null);
      const starts = input.agentRuns
        .filter(
          (agent) =>
            STEP_ROLES[id]?.includes(agent.role) && agent.status === "running" && agent.startedAt,
        )
        .map((agent) => Date.parse(agent.startedAt ?? ""));
      if (starts.length > 0) {
        elapsedSec = Math.max(0, Math.round((input.now - Math.min(...starts)) / 1000));
      }
    }
    return { id, gate, state, estimateSec: estimates[id], elapsedSec, progress, error };
  });
}

/**
 * Thời gian máy còn phải chạy tới khi cần Director lần tới (hoặc tới khi xong). Bước đang chạy trừ đi phần đã chạy
 * (không âm). `null` khi không có bước máy nào phía trước.
 */
export function remainingUntilNextGate(steps: RunStep[]): [number, number] | null {
  // Bước đầu tiên chưa xong là cổng Director, lỗi hoặc đã dừng thì máy không tự chạy tiếp: không ước tính.
  const start = steps.findIndex((step) => step.state !== "done");
  const first = steps[start];
  if (first === undefined || first.gate || first.state === "failed" || first.state === "stopped") {
    return null;
  }
  let low = 0;
  let high = 0;
  for (const step of steps.slice(start)) {
    if (step.gate) {
      break;
    }
    const [stepLow, stepHigh] = step.estimateSec ?? [0, 0];
    const spent = step.elapsedSec ?? 0;
    low += Math.max(0, stepLow - spent);
    high += Math.max(0, stepHigh - spent);
  }
  return [low, high];
}

/** Tổng ước tính phần máy làm của cả lượt chạy (không tính thời gian Director duyệt). */
export function totalMachineEstimate(durationSec: number): [number, number] {
  return Object.values(estimateStepSeconds(durationSec)).reduce<[number, number]>(
    (sum, value) => (value === null ? sum : [sum[0] + value[0], sum[1] + value[1]]),
    [0, 0],
  );
}

/** "~40 giây", "~3 phút", "3–6 phút". */
export function formatDurationRange([low, high]: [number, number]): string {
  const minutes = (seconds: number) => Math.max(1, Math.round(seconds / 60));
  if (high < 60) {
    return `~${Math.max(low, 1)} giây`;
  }
  const lowMin = minutes(low);
  const highMin = minutes(high);
  return lowMin === highMin ? `~${lowMin} phút` : `${lowMin}–${highMin} phút`;
}
