import { useState } from "react";
import type { ConnectionDiagnostic } from "../../../shared/session";
import { APP_VERSION } from "../../branding";
import {
  DIAGNOSTIC_LABELS as labels,
  sanitizedDiagnostic,
} from "../../../shared/diagnostics";
export const diagnosticReport = (input: ConnectionDiagnostic) =>
  sanitizedDiagnostic(input, APP_VERSION);
export function ConnectionDetails({
  diagnostic,
}: {
  diagnostic: ConnectionDiagnostic;
}) {
  const [feedback, setFeedback] = useState("");
  return (
    <details className="connection-details">
      <summary>Detalhes da conexão</summary>
      <p>
        {labels[diagnostic.stage]} ·{" "}
        {diagnostic.state === "ready"
          ? "Pronto"
          : diagnostic.state === "failed"
            ? "Falha"
            : "Aguardando"}
      </p>
      <code>{diagnosticReport(diagnostic).code}</code>
      <dl>
        {Object.entries(diagnosticReport(diagnostic).stats).map(
          ([key, value]) => (
            <div key={key}>
              <dt>
                {
                  {
                    latencyMs: "Latência (ms)",
                    framesPerSecond: "Quadros/s",
                    bitrateKbps: "Taxa (kbps)",
                    packetsLost: "Pacotes perdidos",
                  }[key]
                }
              </dt>
              <dd>{value}</dd>
            </div>
          ),
        )}
      </dl>
      <button
        className="text-button"
        onClick={() =>
          void navigator.clipboard
            .writeText(JSON.stringify(diagnosticReport(diagnostic), null, 2))
            .then(() => setFeedback("Diagnóstico copiado."))
            .catch(() => setFeedback("Não foi possível copiar o diagnóstico."))
        }
      >
        Copiar diagnóstico
      </button>
      <span role="status">{feedback}</span>
    </details>
  );
}
