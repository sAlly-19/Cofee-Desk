export interface Permissions {
  control: boolean;
  clipboard: boolean;
  files: boolean;
}
export function validPermissions(p: unknown): p is Permissions {
  return (
    !!p &&
    typeof p === "object" &&
    Object.keys(p).length === 3 &&
    ["control", "clipboard", "files"].every(
      (k) => typeof (p as Record<string, unknown>)[k] === "boolean",
    )
  );
}
export const PERMISSION_CAPABILITY = "session-permissions-v1";
