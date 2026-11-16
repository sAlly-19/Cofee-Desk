import { useEffect, useRef, useState } from "react";
import { Monitor, AppWindow, RefreshCw, Check } from "lucide-react";
import type { DesktopSource } from "../../../shared/types";
export function SourcePicker({
  value,
  onChange,
  disabled = false,
  onValidityChange,
}: {
  value: string;
  onChange: (id: string, kind: "screen" | "window") => void;
  disabled?: boolean;
  onValidityChange?: (valid: boolean) => void;
}) {
  const [sources, setSources] = useState<DesktopSource[]>([]),
    [category, setCategory] = useState<"screen" | "window">(
      value.startsWith("window:") ? "window" : "screen",
    ),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const current = useRef(value),
    change = useRef(onChange),
    first = useRef(true),
    running = useRef(false);
  current.current = value;
  change.current = onChange;
  const refreshRef = useRef<() => void>(() => {});
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      if (running.current) return;
      running.current = true;
      try {
        const next: DesktopSource[] =
          await window.electronAPI.getDesktopSources();
        if (!active) return;
        setSources(next);
        setError("");
        const id = current.current;
        if (id && !next.some((s) => s.id === id)) {
          change.current("", id.startsWith("window:") ? "window" : "screen");
          setError(
            "A fonte selecionada não está mais disponível. Escolha outra.",
          );
        } else if (first.current && !id) {
          const primary =
            next.find((s) => s.isPrimary) ||
            next.find((s) => s.id.startsWith("screen:"));
          if (primary) change.current(primary.id, "screen");
        }
        first.current = false;
      } catch {
        if (active) {
          setError(
            "Não foi possível listar telas e aplicativos. Tente atualizar.",
          );
          change.current(
            "",
            current.current.startsWith("window:") ? "window" : "screen",
          );
        }
      } finally {
        running.current = false;
        if (active) setLoading(false);
      }
    };
    refreshRef.current = () => {
      setLoading(true);
      void refresh();
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    if (value) setCategory(value.startsWith("window:") ? "window" : "screen");
  }, [value]);
  useEffect(() => {
    onValidityChange?.(!loading && sources.some((s) => s.id === value));
  }, [loading, sources, value, onValidityChange]);
  const filtered = sources.filter((s) =>
    s.id.startsWith(category === "screen" ? "screen:" : "window:"),
  );
  return (
    <section className="source-picker" aria-label="O que compartilhar">
      <div className="source-heading">
        <strong>O que compartilhar</strong>
        <button
          type="button"
          className="text-button"
          disabled={disabled || loading}
          onClick={() => refreshRef.current()}
          title="Atualizar fontes"
        >
          <RefreshCw size={14} />
          Atualizar fontes
        </button>
      </div>
      <div
        className="source-categories"
        role="group"
        aria-label="Tipo de compartilhamento"
      >
        {(["screen", "window"] as const).map((kind) => (
          <button
            type="button"
            key={kind}
            disabled={disabled || loading}
            aria-pressed={category === kind}
            onClick={() => {
              first.current = false;
              setCategory(kind);
              if (category !== kind) change.current("", kind);
            }}
          >
            {kind === "screen" ? (
              <Monitor size={17} />
            ) : (
              <AppWindow size={17} />
            )}
            <span>
              {kind === "screen" ? "Monitores" : "Aplicativo específico"}
            </span>
          </button>
        ))}
      </div>
      <div className="source-grid" aria-busy={loading}>
        {filtered.map((s, i) => (
          <button
            type="button"
            className="source-card"
            data-source-id={s.id}
            key={s.id}
            disabled={disabled}
            aria-pressed={value === s.id}
            title={s.name}
            onClick={() => onChange(s.id, category)}
          >
            {category === "window" && s.appIcon ? (
              <img className="source-app-icon" src={s.appIcon} alt="" />
            ) : category === "screen" ? (
              <Monitor size={23} />
            ) : (
              <AppWindow size={23} />
            )}
            <span>
              <strong>
                {category === "screen"
                  ? "Monitor " + (i + 1) + (s.isPrimary ? " · principal" : "")
                  : s.name}
              </strong>
              <small>
                {category === "screen"
                  ? s.name
                  : "Somente esta janela · sem controle remoto"}
              </small>
            </span>
            {value === s.id && <Check size={17} className="source-check" />}
          </button>
        ))}
      </div>
      {!filtered.length && (
        <p className="source-empty" role="status">
          {loading
            ? "Carregando fontes…"
            : category === "window"
              ? "Nenhuma janela disponível. Abra o aplicativo e atualize a lista."
              : "Nenhum monitor disponível."}
        </p>
      )}
      {error && (
        <p className="settings-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
