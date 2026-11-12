import { useEffect, useState } from "react";
import type { DesktopSource } from "../../../shared/types";
export function SourcePicker({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (id: string, kind: "screen" | "window") => void;
  disabled?: boolean;
}) {
  const [sources, setSources] = useState<DesktopSource[]>([]),
    [error, setError] = useState("");
  const refresh = () => {
    setError("");
    void window.electronAPI
      .getDesktopSources()
      .then((s: DesktopSource[]) => {
        setSources(s);
        if (!s.some((x) => x.id === value)) {
          const first =
            s.find((x) => x.isPrimary) ||
            s.find((x) => x.id.startsWith("screen:"));
          if (first)
            onChange(
              first.id,
              first.id.startsWith("screen:") ? "screen" : "window",
            );
        }
      })
      .catch(() => setError("Não foi possível listar telas e janelas."));
  };
  useEffect(refresh, []);
  return (
    <div className="source-picker">
      <label>
        O que compartilhar
        <select
          aria-label="Tela ou janela para compartilhar"
          value={value}
          disabled={disabled}
          onChange={(e) =>
            onChange(
              e.target.value,
              e.target.value.startsWith("screen:") ? "screen" : "window",
            )
          }
        >
          <option value="">Selecione uma tela ou janela</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.id.startsWith("screen:") ? "Monitor: " : "Janela: "}
              {s.name}
            </option>
          ))}
        </select>
      </label>
      {sources.find((s) => s.id === value)?.thumbnail && (
        <img
          alt="Prévia da fonte selecionada"
          src={sources.find((s) => s.id === value)!.thumbnail}
        />
      )}
      <button
        className="text-button"
        type="button"
        disabled={disabled}
        onClick={refresh}
      >
        Atualizar fontes
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
