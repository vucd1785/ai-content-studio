import { cn } from "@/lib/utils";

/** Nhân vật kênh trên giao diện (minh họa ui-kit, không phải tài sản video). */
export const CHARACTER_POSES = {
  ti: ["idle", "wave", "think", "celebrate"],
  bit: ["idle", "work", "success", "error"],
  dau: ["idle", "idea", "wait", "celebrate"],
} as const;

export type CharacterKey = keyof typeof CHARACTER_POSES;

export function isCharacterKey(value: string): value is CharacterKey {
  return Object.hasOwn(CHARACTER_POSES, value);
}

export function CharacterAvatar({
  character,
  pose = "idle",
  size = 40,
  className,
}: {
  character: CharacterKey;
  pose?: string;
  size?: number;
  className?: string;
}) {
  const poses = CHARACTER_POSES[character] as readonly string[];
  const name = poses.includes(pose) ? pose : "idle";
  return (
    <img
      src={`/assets/characters/${character}_${name}.svg`}
      alt=""
      width={size}
      height={size}
      className={cn("shrink-0 object-contain", className)}
    />
  );
}
