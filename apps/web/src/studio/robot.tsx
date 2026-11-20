import { Outlines } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { AgentRole, AgentStatus } from "./studio-model";

/**
 * Robot chibi của từng vai trò (P4-05, 06-3D-UI-DESIGN mục Robot của từng vai trò). Dựng hoàn toàn bằng code:
 * khớp vai và cổ là nhóm lồng nhau, mặt là màn hình vẽ bằng `CanvasTexture`, vật liệu toon có viền.
 * Chỉ vẽ trạng thái đã lưu; `animate` false (reduced motion, studio rảnh) thì đứng yên ở tư thế của trạng thái.
 */

const BODY = "#e9e4da";
const JOINT = "#3a4157";

type Accessory =
  | "clipboard"
  | "magnifier"
  | "brush"
  | "palette"
  | "microphone"
  | "camera"
  | "checklist"
  | "megaphone";

export const ROLE_STYLE: Readonly<Record<AgentRole, { accent: string; accessory: Accessory }>> = {
  producer: { accent: "#5f6b85", accessory: "clipboard" },
  research: { accent: "#1f9a8c", accessory: "magnifier" },
  script: { accent: "#7f77dd", accessory: "brush" },
  visual: { accent: "#d85a30", accessory: "palette" },
  voice: { accent: "#d4537e", accessory: "microphone" },
  video: { accent: "#378add", accessory: "camera" },
  qa: { accent: "#639922", accessory: "checklist" },
  publish: { accent: "#e0a020", accessory: "megaphone" },
};

export type Expression = "smile" | "look" | "focus" | "wait" | "happy" | "dead" | "off";

/** Biểu cảm màn mặt theo trạng thái (06 mục Biểu cảm theo trạng thái). */
export function expressionFor(status: AgentStatus): Expression {
  switch (status) {
    case "queued":
      return "look";
    case "running":
      return "focus";
    case "waiting_approval":
      return "wait";
    case "completed":
      return "happy";
    case "failed":
      return "dead";
    case "cancelled":
      return "off";
    default:
      return "smile";
  }
}

/** Gradient 3 bậc cho `MeshToonMaterial`: ra chất hoạt hình. */
function useToonGradient() {
  return useMemo(() => {
    const texture = new THREE.DataTexture(new Uint8Array([90, 170, 255]), 3, 1, THREE.RedFormat);
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.needsUpdate = true;
    return texture;
  }, []);
}

const faceCache = new Map<string, THREE.CanvasTexture | null>();

/** Vẽ mặt (mắt, miệng phát sáng) một lần cho mỗi biểu cảm; không có canvas 2D (jsdom) thì trả null. */
export function faceTexture(expression: Expression, blink: boolean): THREE.CanvasTexture | null {
  const key = `${expression}:${blink}`;
  if (faceCache.has(key)) {
    return faceCache.get(key) ?? null;
  }
  const canvas = typeof document === "undefined" ? null : document.createElement("canvas");
  const ctx = canvas?.getContext("2d") ?? null;
  if (canvas === null || ctx === null) {
    faceCache.set(key, null);
    return null;
  }
  canvas.width = 128;
  canvas.height = 96;
  ctx.fillStyle = expression === "off" ? "#15171c" : "#0b1220";
  ctx.fillRect(0, 0, 128, 96);
  const glow = expression === "dead" ? "#ff6b6b" : expression === "wait" ? "#f0bd6a" : "#8fe9ff";
  ctx.strokeStyle = glow;
  ctx.fillStyle = glow;
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  const eye = (x: number) => {
    if (expression === "off") {
      return;
    }
    ctx.beginPath();
    if (expression === "dead") {
      ctx.moveTo(x - 9, 30);
      ctx.lineTo(x + 9, 48);
      ctx.moveTo(x + 9, 30);
      ctx.lineTo(x - 9, 48);
    } else if (blink) {
      ctx.moveTo(x - 10, 40);
      ctx.lineTo(x + 10, 40);
    } else if (expression === "happy") {
      ctx.arc(x, 44, 10, Math.PI * 1.1, Math.PI * 1.9);
    } else if (expression === "focus") {
      ctx.arc(x, 36, 10, Math.PI * 0.1, Math.PI * 0.9);
    } else {
      ctx.ellipse(x + (expression === "look" ? 6 : 0), 38, 8, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    ctx.stroke();
  };
  eye(42);
  eye(86);
  if (expression !== "off") {
    ctx.beginPath();
    if (expression === "happy") {
      ctx.arc(64, 60, 14, Math.PI * 0.15, Math.PI * 0.85);
    } else if (expression === "dead") {
      ctx.arc(64, 78, 12, Math.PI * 1.15, Math.PI * 1.85);
    } else if (expression === "focus" || expression === "wait") {
      ctx.moveTo(54, 70);
      ctx.lineTo(74, 70);
    } else {
      ctx.arc(64, 62, 10, Math.PI * 0.2, Math.PI * 0.8);
    }
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  faceCache.set(key, texture);
  return texture;
}

type Pose = {
  bob: number;
  breathe: number;
  headX: number;
  headY: number;
  leftArm: number;
  rightArm: number;
};

/** Tư thế mục tiêu theo trạng thái và thời gian; khi không animate thì dùng `t = 0`. */
function poseFor(status: AgentStatus, t: number, sinceChange: number): Pose {
  const still = { bob: 0, breathe: 0, headX: 0, headY: 0, leftArm: 0.1, rightArm: -0.1 };
  switch (status) {
    case "running":
      return {
        bob: 0.025 * Math.abs(Math.sin(t * 6)),
        breathe: 0,
        headX: 0.12,
        headY: 0.1 * Math.sin(t * 1.3),
        leftArm: -0.5,
        rightArm: -1.0 + 0.35 * Math.sin(t * 8),
      };
    case "queued":
      return { ...still, headY: 0.35 * Math.sin(t * 1.5), breathe: 0.015 * Math.sin(t * 2) };
    case "waiting_approval":
      return { ...still, headY: 0.45, rightArm: -2.4 };
    case "completed":
      // Giơ tay một lần khi vừa xong rồi về đứng yên.
      return sinceChange < 1.4
        ? {
            ...still,
            rightArm: -2.6,
            leftArm: -2.6,
            bob: 0.06 * Math.sin(Math.min(sinceChange, 1) * Math.PI),
          }
        : still;
    case "failed":
      return { ...still, headX: 0.45, leftArm: 0.25, rightArm: -0.25 };
    case "cancelled":
      return still;
    default:
      return { ...still, breathe: 0.02 * Math.sin(t * 2) };
  }
}

export function Robot({
  role,
  status,
  animate,
}: {
  role: AgentRole;
  status: AgentStatus;
  animate: boolean;
}) {
  const { accent, accessory } = ROLE_STYLE[role];
  const gradient = useToonGradient();
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const face = useRef<THREE.MeshBasicMaterial>(null);
  const changedAt = useRef<{ status: AgentStatus; at: number }>({ status, at: -10 });
  const phase = useMemo(() => role.length * 1.7, [role]);
  const expression = expressionFor(status);
  const initial = poseFor(status, 0, 10);
  const dim = status === "cancelled" || status === "idle";

  useFrame((state, delta) => {
    if (!animate) {
      return;
    }
    const t = state.clock.elapsedTime + phase;
    if (changedAt.current.status !== status) {
      changedAt.current = { status, at: state.clock.elapsedTime };
    }
    const target = poseFor(status, t, state.clock.elapsedTime - changedAt.current.at);
    // Pha trộn khoảng 250 ms giữa hai tư thế, không giật.
    const k = 1 - Math.exp(-delta * 12);
    if (root.current) root.current.position.y += (target.bob - root.current.position.y) * k;
    if (body.current) body.current.scale.y = 1 + target.breathe;
    if (head.current) {
      head.current.rotation.x += (target.headX - head.current.rotation.x) * k;
      head.current.rotation.y += (target.headY - head.current.rotation.y) * k;
    }
    if (leftArm.current)
      leftArm.current.rotation.x += (target.leftArm - leftArm.current.rotation.x) * k;
    if (rightArm.current)
      rightArm.current.rotation.x += (target.rightArm - rightArm.current.rotation.x) * k;
    // Chớp mắt 3–6 s một lần khi rảnh hoặc đang chạy.
    if (face.current && (expression === "smile" || expression === "focus")) {
      const blink = t % (3 + (phase % 3)) < 0.12;
      const map = faceTexture(expression, blink);
      if (map !== null && face.current.map !== map) {
        face.current.map = map;
        face.current.needsUpdate = true;
      }
    }
  });

  const toon = (color: string) => <meshToonMaterial color={color} gradientMap={gradient} />;
  const outline = <Outlines thickness={0.012} color="#0b0d12" />;

  return (
    <group ref={root} position={[0, initial.bob, 0]}>
      {/* Chân */}
      {[-0.1, 0.1].map((x) => (
        <mesh key={x} position={[x, 0.12, 0]} castShadow>
          <capsuleGeometry args={[0.07, 0.12, 4, 10]} />
          {toon(JOINT)}
        </mesh>
      ))}
      <group ref={body} position={[0, 0.42, 0]}>
        <mesh castShadow>
          <capsuleGeometry args={[0.2, 0.18, 6, 14]} />
          {toon(dim ? "#a9a49b" : BODY)}
          {outline}
        </mesh>
        {/* Huy hiệu màu vai trò trên ngực */}
        <mesh position={[0, 0.02, 0.2]}>
          <circleGeometry args={[0.06, 16]} />
          <meshBasicMaterial color={accent} />
        </mesh>
      </group>
      {/* Tay: khớp vai xoay được, tay phải cầm phụ kiện */}
      <group ref={leftArm} position={[-0.27, 0.56, 0]} rotation={[initial.leftArm, 0, 0.12]}>
        <mesh position={[0, -0.13, 0]} castShadow>
          <capsuleGeometry args={[0.055, 0.16, 4, 10]} />
          {toon(accent)}
        </mesh>
      </group>
      <group ref={rightArm} position={[0.27, 0.56, 0]} rotation={[initial.rightArm, 0, -0.12]}>
        <mesh position={[0, -0.13, 0]} castShadow>
          <capsuleGeometry args={[0.055, 0.16, 4, 10]} />
          {toon(accent)}
        </mesh>
        <group position={[0, -0.26, 0.04]}>
          <AccessoryMesh kind={accessory} accent={accent} />
        </group>
      </group>
      {/* Đầu to kiểu chibi, mặt là màn hình */}
      <group ref={head} position={[0, 0.92, 0]} rotation={[initial.headX, initial.headY, 0]}>
        <mesh castShadow scale={[1.12, 0.95, 1]}>
          <sphereGeometry args={[0.3, 24, 18]} />
          {toon(dim ? "#a9a49b" : BODY)}
          {outline}
        </mesh>
        <mesh position={[0, -0.01, 0.27]}>
          <planeGeometry args={[0.38, 0.27]} />
          <meshBasicMaterial
            ref={face}
            map={faceTexture(expression, false)}
            color={faceTexture(expression, false) ? "#ffffff" : "#0b1220"}
            toneMapped={false}
          />
        </mesh>
        {/* Tai nghe hai bên và ăng-ten: màu vai trò để nhận ra từ xa */}
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 0.33, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.085, 0.085, 0.07, 18]} />
            {toon(accent)}
          </mesh>
        ))}
        <mesh position={[0, 0.33, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.12, 6]} />
          {toon(JOINT)}
        </mesh>
        <mesh position={[0, 0.41, 0]}>
          <sphereGeometry args={[0.045, 12, 10]} />
          <meshBasicMaterial color={accent} />
        </mesh>
      </group>
    </group>
  );
}

function AccessoryMesh({ kind, accent }: { kind: Accessory; accent: string }) {
  const mat = <meshStandardMaterial color={accent} roughness={0.6} />;
  switch (kind) {
    case "megaphone":
      // Loa cầm tay của vai Đăng bài (ADR-018): nón cụt nằm ngang.
      return (
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.05, 0.11, 0.2, 16, 1, true]} />
          {mat}
        </mesh>
      );
    case "clipboard":
      return (
        <mesh rotation={[-0.4, 0, 0]}>
          <boxGeometry args={[0.16, 0.2, 0.02]} />
          {mat}
        </mesh>
      );
    case "magnifier":
      return (
        <group rotation={[-0.6, 0, 0]}>
          <mesh position={[0, 0.08, 0]}>
            <torusGeometry args={[0.06, 0.015, 8, 20]} />
            {mat}
          </mesh>
          <mesh position={[0, -0.02, 0]}>
            <cylinderGeometry args={[0.015, 0.015, 0.1, 8]} />
            <meshStandardMaterial color="#3a4157" />
          </mesh>
        </group>
      );
    case "brush":
      return (
        <group rotation={[-0.9, 0, 0]}>
          <mesh>
            <cylinderGeometry args={[0.015, 0.015, 0.18, 8]} />
            {mat}
          </mesh>
          <mesh position={[0, 0.11, 0]}>
            <coneGeometry args={[0.025, 0.05, 8]} />
            <meshStandardMaterial color="#1d2440" />
          </mesh>
        </group>
      );
    case "palette":
      return (
        <mesh rotation={[-1.2, 0, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 0.015, 16]} />
          {mat}
        </mesh>
      );
    case "microphone":
      return (
        <group>
          <mesh position={[0, 0.08, 0]}>
            <sphereGeometry args={[0.045, 12, 10]} />
            {mat}
          </mesh>
          <mesh>
            <cylinderGeometry args={[0.015, 0.015, 0.12, 8]} />
            <meshStandardMaterial color="#3a4157" />
          </mesh>
        </group>
      );
    case "camera":
      return (
        <group>
          <mesh>
            <boxGeometry args={[0.14, 0.09, 0.08]} />
            {mat}
          </mesh>
          <mesh position={[0, 0, 0.06]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.03, 0.035, 0.05, 12]} />
            <meshStandardMaterial color="#1d2440" />
          </mesh>
        </group>
      );
    default:
      return (
        <mesh rotation={[-0.4, 0, 0]}>
          <boxGeometry args={[0.14, 0.18, 0.015]} />
          {mat}
        </mesh>
      );
  }
}

/** Bàn Director: ghế đạo diễn và loa cầm tay, không có robot (06 mục Robot). */
export function DirectorChair({ waiting }: { waiting: boolean }) {
  const gradient = useToonGradient();
  const gold = waiting ? "#f0bd6a" : "#c9a45e";
  return (
    <group position={[0, 0, 0.85]}>
      <mesh position={[0, 0.32, 0]} castShadow>
        <boxGeometry args={[0.5, 0.06, 0.45]} />
        <meshToonMaterial color="#2a2f45" gradientMap={gradient} />
      </mesh>
      <mesh position={[0, 0.62, 0.2]} castShadow>
        <boxGeometry args={[0.5, 0.38, 0.05]} />
        <meshToonMaterial color={gold} gradientMap={gradient} />
        <Outlines thickness={0.012} color="#0b0d12" />
      </mesh>
      {[-0.22, 0.22].map((x) => (
        <mesh key={x} position={[x, 0.16, 0]}>
          <boxGeometry args={[0.04, 0.32, 0.4]} />
          <meshStandardMaterial color="#3a4157" />
        </mesh>
      ))}
      <mesh position={[0.6, 0.5, -0.4]} rotation={[0, 0, Math.PI / 2]}>
        <coneGeometry args={[0.07, 0.18, 12, 1, true]} />
        <meshStandardMaterial color={gold} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
