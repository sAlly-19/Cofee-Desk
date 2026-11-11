import type { ServerStatus } from "../../types/app";
export function StatusIndicator({
  status,
  connectedLabel = "Disponível",
  className = "",
}: {
  status: ServerStatus;
  connectedLabel?: string;
  className?: string;
}) {
  return (
    <span
      className={["status-indicator", "status-" + status, className].join(" ")}
      role="status"
    >
      <span className="status-dot" />
      {status === "connected"
        ? connectedLabel
        : status === "connecting"
          ? "Conectando…"
          : "Indisponível"}
    </span>
  );
}
