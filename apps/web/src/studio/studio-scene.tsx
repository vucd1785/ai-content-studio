import { OrbitControls, OrthographicCamera } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { studioCanvasFlags, usePrefersReducedMotion } from "./canvas-flags";
import {
  type AgentRole,
  type AgentStatus,
  buildStations,
  CAMERA_LIMITS,
  type StationModel,
  type StudioSelection,
} from "./studio-model";
import { studioLabels } from "./studio-labels";
import type { RenderProgress } from "./studio-store";

export type StudioSceneProps = {
  /** Trạng thái đã lưu của từng vai trò. Thiếu thì `idle`. */
  statuses?: Partial<Record<AgentRole, AgentStatus>>;
  /** Thanh render trên bàn video; chỉ có khi event `job.progress` mang số frame (P4-02). */
  renderProgress?: RenderProgress | null;
  /** Ghi đè `prefers-reduced-motion` của trình duyệt (P4-03). Bỏ trống thì đọc media query. */
  reducedMotion?: boolean;
  /** Chế độ hiệu năng thấp: `dpr` 1, tắt shadow. */
  lowPower?: boolean;
  /** Bàn đang chọn (P4-04): vẽ sáng hơn. */
  selected?: StudioSelection | null;
  /** Click avatar/bàn: chọn vai trò để mở bảng 2D. */
  onSelect?: (id: StudioSelection) => void;
};

/**
 * Canvas low-poly (ADR-009, 06-3D-UI-DESIGN). Chỉ vẽ props; không timer, không vòng lặp khung hình,
 * không gọi API. Hình học dựng bằng code, không asset ngoài.
 */
export function StudioScene({
  statuses,
  renderProgress = null,
  reducedMotion,
  lowPower,
  selected = null,
  onSelect,
}: StudioSceneProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const flags = studioCanvasFlags({ reducedMotion: reducedMotion ?? prefersReducedMotion, lowPower });
  const stations = buildStations(statuses);
  const summary = stations
    .filter((station) => station.id !== "director")
    .map((station) => `${studioLabels.roles[station.id as AgentRole]}: ${studioLabels.statuses[station.status]}`)
    .join(", ");
  const progressLabel =
    renderProgress === null
      ? ""
      : `. ${studioLabels.renderProgress}: ${Math.round(renderProgress.progress * 100)}%, ${renderProgress.renderedFrames} frame`;

  return (
    <div className="h-full w-full" role="img" aria-label={`${studioLabels.canvas}. ${summary}${progressLabel}`}>
      <Canvas shadows={flags.shadows} dpr={flags.dpr} frameloop={flags.frameloop}>
        <color attach="background" args={["#0b0b0f"]} />
        <OrthographicCamera makeDefault position={CAMERA_LIMITS.position} zoom={CAMERA_LIMITS.zoom} />
        <OrbitControls
          enablePan={false}
          minZoom={CAMERA_LIMITS.minZoom}
          maxZoom={CAMERA_LIMITS.maxZoom}
          minPolarAngle={CAMERA_LIMITS.minPolarAngle}
          maxPolarAngle={CAMERA_LIMITS.maxPolarAngle}
        />
        <ambientLight intensity={0.5} />
        <directionalLight position={[6, 10, 4]} intensity={1.1} castShadow={flags.shadows} />
        <Floor />
        {stations.map((station) => (
          <Station
            key={station.id}
            station={station}
            renderProgress={station.id === "video" ? renderProgress : null}
            selected={station.id === selected}
            {...(onSelect === undefined ? {} : { onSelect })}
          />
        ))}
      </Canvas>
    </div>
  );
}

function Floor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
      <circleGeometry args={[7, 8]} />
      <meshStandardMaterial color="#1c1c22" flatShading />
    </mesh>
  );
}

export function Station({
  station,
  renderProgress,
  selected = false,
  onSelect,
}: {
  station: StationModel;
  renderProgress: RenderProgress | null;
  selected?: boolean;
  onSelect?: (id: StudioSelection) => void;
}) {
  const isDirector = station.id === "director";
  const deskColor = selected ? "#a1a1aa" : isDirector ? "#52525b" : "#3f3f46";
  const { lightColor, lightIntensity, approvalSign } = station.visual;

  return (
    <group
      name={station.id}
      position={station.position}
      rotation={[0, station.rotationY, 0]}
      onClick={(event) => {
        // Chỉ bàn gần nhất nhận click; không lan sang sàn hay bàn phía sau.
        event.stopPropagation();
        onSelect?.(station.id);
      }}
    >
      {/* Bàn */}
      <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
        <boxGeometry args={[isDirector ? 1.8 : 1.4, 0.12, 0.8]} />
        <meshStandardMaterial color={deskColor} flatShading />
      </mesh>
      {/* Màn hình */}
      <mesh position={[0, 0.75, -0.25]} castShadow>
        <boxGeometry args={[0.8, 0.5, 0.06]} />
        <meshStandardMaterial
          color="#18181b"
          emissive={lightColor}
          emissiveIntensity={lightIntensity * 0.25}
          flatShading
        />
      </mesh>
      {/* Robot: thân và đầu low-poly */}
      <mesh position={[0, 0.45, 0.65]} castShadow>
        <cylinderGeometry args={[0.22, 0.28, 0.9, 6]} />
        <meshStandardMaterial color={isDirector ? "#d4d4d8" : "#a1a1aa"} flatShading />
      </mesh>
      <mesh position={[0, 1.08, 0.65]} castShadow>
        <icosahedronGeometry args={[0.22, 0]} />
        <meshStandardMaterial color="#e4e4e7" flatShading />
      </mesh>
      {/* Đèn trạng thái */}
      {isDirector ? null : (
        <mesh position={[0.55, 0.62, 0.2]}>
          <octahedronGeometry args={[0.1, 0]} />
          <meshStandardMaterial color={lightColor} emissive={lightColor} emissiveIntensity={lightIntensity} />
        </mesh>
      )}
      {/* Biển chờ duyệt */}
      {approvalSign ? (
        <mesh position={[0, 1.55, 0.65]}>
          <boxGeometry args={[0.5, 0.3, 0.04]} />
          <meshStandardMaterial color={lightColor} emissive={lightColor} emissiveIntensity={0.8} />
        </mesh>
      ) : null}
      {/* Thanh render: nền và phần đã xong theo `progress` của Remotion */}
      {renderProgress === null ? null : (
        <group position={[0, 1.55, 0.65]}>
          <mesh>
            <boxGeometry args={[1.2, 0.12, 0.04]} />
            <meshStandardMaterial color="#27272a" />
          </mesh>
          <mesh position={[-0.6 + (1.2 * renderProgress.progress) / 2, 0, 0.03]}>
            <boxGeometry args={[Math.max(1.2 * renderProgress.progress, 0.001), 0.12, 0.04]} />
            <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={0.8} />
          </mesh>
        </group>
      )}
    </group>
  );
}
