export type UpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "not-available"
  | "downloading"
  | "downloaded"
  | "installing"
  | "error";
export interface UpdateProgress {
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
}
export interface AppUpdateInfo {
  version: string;
  currentVersion: string;
  releaseNotes: string;
  releaseDate?: string;
  releaseUrl: string;
}
export interface UpdaterState {
  status: UpdateStatus;
  updateInfo: AppUpdateInfo | null;
  progress: UpdateProgress | null;
  errorMessage: string | null;
  isDev: boolean;
  isPortable: boolean;
  installBlocked: boolean;
}
