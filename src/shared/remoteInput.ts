import type { KeyboardEventData, MouseEventData } from "./types";
export function validRemoteKeyboard(
  value: unknown,
): value is KeyboardEventData {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    ["down", "up", "press", "release", "text"].includes(v.type as string) &&
    typeof v.code === "string" &&
    v.code.length <= 64 &&
    typeof v.key === "string" &&
    v.key.length <= 64 &&
    (v.text === undefined ||
      (typeof v.text === "string" && v.text.length <= 4096)) &&
    (v.type !== "text" || typeof v.text === "string")
  );
}
export function validRemoteMouse(value: unknown): value is MouseEventData {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    ["move", "click", "scroll", "drag", "down", "up", "double"].includes(
      v.type as string,
    ) &&
    typeof v.normX === "number" &&
    Number.isFinite(v.normX) &&
    v.normX >= 0 &&
    v.normX <= 1 &&
    typeof v.normY === "number" &&
    Number.isFinite(v.normY) &&
    v.normY >= 0 &&
    v.normY <= 1 &&
    (v.button === undefined ||
      ["left", "middle", "right"].includes(v.button as string))
  );
}
