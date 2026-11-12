export const LOCAL_SIGNALING_URL = "ws://localhost:8080/ws";
export type ServiceSelection = {
  url: string;
  urlSource?: "explicit" | "default";
};
export function selectService<T extends ServiceSelection>(
  state: T,
  official: string,
): T {
  // Existing 1.0.1 files lack provenance. Preserve them rather than guessing
  // whether a localhost URL was entered deliberately by the operator.
  if (state.urlSource !== "default" || !official) return state;
  return { ...state, url: official };
}
