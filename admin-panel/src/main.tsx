import React, { useState, useEffect, useCallback, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  ShieldCheck,
  Monitor,
  Flag,
  History,
  LogOut,
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  LockKeyhole,
  RefreshCw,
  Check,
  ShieldAlert,
} from "lucide-react";
import "./style.css";
type Row = Record<string, any>;
type User = { username: string; csrf: string };
const labels: Record<string, string> = {
  active: "Ativo",
  blocked: "Bloqueado",
  banned: "Banido",
  open: "Aberta",
  reviewing: "Em análise",
  substantiated: "Procedente",
  dismissed: "Improcedente",
  spam: "Spam",
  fraud: "Fraude",
  unauthorized: "Acesso indevido",
  other: "Outro",
  block: "Bloqueio",
  ban: "Banimento",
  unblock: "Desbloqueio",
  "review-report": "Análise de denúncia",
  login: "Login",
  bootstrap: "Criação do administrador",
  "revoke-sessions": "Revogação de sessões",
};
const date = (value: string) => new Date(value).toLocaleString("pt-BR");
function Badge({ status }: { status: string }) {
  return (
    <span className={"badge " + status}>
      <i />
      {labels[status] ?? status}
    </span>
  );
}
function App() {
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true),
    [tab, setTab] = useState("devices"),
    [rows, setRows] = useState<Row[]>([]),
    [page, setPage] = useState(0),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [detail, setDetail] = useState<Row | null>(null),
    [action, setAction] = useState<{ kind: string; row: Row } | null>(null),
    [notice, setNotice] = useState("");
  const abort = useRef<AbortController | null>(null);
  const request = useCallback(
    async (route: string, data?: unknown, signal?: AbortSignal) => {
      const response = await fetch("/api/admin/" + route, {
        method: data === undefined ? "GET" : "POST",
        credentials: "same-origin",
        headers: {
          ...(data !== undefined
            ? {
                "Content-Type": "application/json",
                "X-CSRF-Token": user?.csrf ?? "",
              }
            : {}),
        },
        body: data === undefined ? undefined : JSON.stringify(data),
        signal,
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 401) setUser(null);
        throw new Error(result.error ?? "Não foi possível concluir a operação");
      }
      return result;
    },
    [user?.csrf],
  );
  useEffect(() => {
    void fetch("/api/admin/session", { credentials: "same-origin" })
      .then(async (r) => {
        if (r.ok) setUser(await r.json());
      })
      .catch(() => setError("Servidor indisponível"))
      .finally(() => setLoading(false));
  }, []);
  const refresh = useCallback(async () => {
    if (!user) return;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    setError("");
    try {
      const route =
        tab === "devices"
          ? "devices?q=" + encodeURIComponent(query)
          : tab === "reports"
            ? "reports?status=" + filter
            : "audit?";
      const data = await request(
        route + (route.includes("?") ? "&" : "?") + "page=" + page,
        undefined,
        controller.signal,
      );
      setRows(data.items);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }, [user, tab, query, filter, page, request]);
  useEffect(() => {
    const timer = setTimeout(() => void refresh(), 250);
    return () => {
      clearTimeout(timer);
      abort.current?.abort();
    };
  }, [refresh]);
  async function openDevice(id: string) {
    try {
      setDetail(await request("devices/" + id));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function signOut(all = false) {
    try {
      await request(all ? "sessions/revoke" : "logout", {});
      setUser(null);
      setRows([]);
      setDetail(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (loading)
    return (
      <div className="boot" role="status">
        Preparando administração…
      </div>
    );
  if (!user)
    return (
      <Login
        onLogin={(u) => {
          setUser(u);
          setError("");
        }}
        error={error}
      />
    );
  const titles: Record<string, [string, string]> = {
    devices: [
      "Dispositivos",
      "Acompanhe acessos e mantenha sua rede sob controle.",
    ],
    reports: [
      "Central de denúncias",
      "Analise cada relato antes de tomar uma decisão.",
    ],
    audit: [
      "Histórico de decisões",
      "Um registro permanente de cada ação administrativa.",
    ],
  };
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <a className="brand" href="/admin/">
          <img src="/admin/coffee-mark.svg" alt="" />
          <strong>Coffee Desk</strong>
          <small>ADMINISTRAÇÃO</small>
        </a>
        <div className="nav-label">CONTROLE DO SERVIÇO</div>
        <nav aria-label="Administração">
          {[
            ["devices", "Dispositivos", Monitor],
            ["reports", "Denúncias", Flag],
            ["audit", "Auditoria", History],
          ].map(([key, label, Icon]) => (
            <button
              key={String(key)}
              className={tab === key ? "selected" : ""}
              onClick={() => {
                setTab(String(key));
                setPage(0);
                setRows([]);
                setError("");
              }}
            >
              <Icon size={20} />
              {String(label)}
            </button>
          ))}
        </nav>
        <div className="operator">
          <ShieldCheck size={20} />
          <div>
            <strong>{user.username}</strong>
            <small>Administrador · TOTP ativo</small>
          </div>
        </div>
        <button className="logout" onClick={() => void signOut()}>
          <LogOut size={17} />
          Sair da sessão
        </button>
        <div className="signature">
          Café - Sistemas & Softwares<span>COFFEE DESK · 1.0.1</span>
        </div>
      </aside>
      <main>
        <header className="topline">
          <span>
            <i />
            Ambiente administrativo
          </span>
          <button className="quiet" onClick={() => void signOut(true)}>
            <LockKeyhole size={15} />
            Revogar minhas sessões
          </button>
        </header>
        <section className="page-heading">
          <div className="eyebrow">SEGURANÇA & CONFIANÇA</div>
          <h1>{titles[tab][0]}</h1>
          <p>{titles[tab][1]}</p>
        </section>
        {notice && (
          <div className="notice" role="status">
            <Check size={18} />
            {notice}
            <button
              aria-label="Dispensar mensagem"
              onClick={() => setNotice("")}
            >
              ×
            </button>
          </div>
        )}
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        <section className="table-panel">
          <div className="table-toolbar">
            <div className="toolbar-title">
              {tab === "devices" ? (
                <Monitor size={20} />
              ) : tab === "reports" ? (
                <Flag size={20} />
              ) : (
                <History size={20} />
              )}
              <strong>
                {tab === "devices"
                  ? "Registro de dispositivos"
                  : tab === "reports"
                    ? "Relatos recebidos"
                    : "Trilha de auditoria"}
              </strong>
            </div>
            <div className="toolbar-actions">
              {tab === "devices" && (
                <label className="search">
                  <Search size={18} />
                  <input
                    aria-label="Pesquisar ID"
                    placeholder="Buscar pelo ID do dispositivo"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setPage(0);
                    }}
                  />
                </label>
              )}
              {tab === "reports" && (
                <select
                  aria-label="Filtrar denúncias"
                  value={filter}
                  onChange={(e) => {
                    setFilter(e.target.value);
                    setPage(0);
                  }}
                >
                  <option value="">Todas as situações</option>
                  {["open", "reviewing", "substantiated", "dismissed"].map(
                    (s) => (
                      <option value={s} key={s}>
                        {labels[s]}
                      </option>
                    ),
                  )}
                </select>
              )}
              <button
                className="icon-button"
                aria-label="Atualizar lista"
                disabled={busy}
                onClick={() => void refresh()}
              >
                <RefreshCw size={17} className={busy ? "spin" : ""} />
              </button>
            </div>
          </div>
          <div className="table-scroll" aria-busy={busy}>
            <table>
              <thead>
                <tr>
                  {(tab === "devices"
                    ? [
                        "DISPOSITIVO",
                        "PRESENÇA",
                        "SITUAÇÃO",
                        "DENÚNCIAS",
                        "ÚLTIMO ACESSO",
                        "",
                      ]
                    : tab === "reports"
                      ? [
                          "DISPOSITIVO / REMETENTE",
                          "CATEGORIA",
                          "SITUAÇÃO",
                          "RECEBIDA EM",
                          "",
                        ]
                      : [
                          "QUANDO",
                          "ADMINISTRADOR",
                          "AÇÃO",
                          "ALVO",
                          "JUSTIFICATIVA",
                        ]
                  ).map((h, i) => (
                    <th key={i}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) =>
                  tab === "devices" ? (
                    <tr key={row.id}>
                      <td>
                        <button
                          className="device-link"
                          onClick={() => void openDevice(row.id)}
                        >
                          <span className="device-mark">
                            <Monitor size={19} />
                          </span>
                          <span>
                            <strong>{row.id}</strong>
                            <small>Identidade autenticada</small>
                          </span>
                        </button>
                      </td>
                      <td>
                        <span
                          className={"presence " + (row.online ? "online" : "")}
                        >
                          {row.online ? "Online" : "Offline"}
                        </span>
                      </td>
                      <td>
                        <Badge status={row.status} />
                      </td>
                      <td>
                        <span className="count">{row.reports}</span>
                      </td>
                      <td className="muted">{date(row.last_seen)}</td>
                      <td>
                        <button
                          className="view"
                          onClick={() => void openDevice(row.id)}
                        >
                          Detalhes <ArrowUpRight size={16} />
                        </button>
                      </td>
                    </tr>
                  ) : tab === "reports" ? (
                    <tr key={row.id}>
                      <td>
                        <button
                          className="device-link"
                          onClick={() => void openDevice(row.device_id)}
                        >
                          <span>
                            <strong>{row.device_id}</strong>
                            <small>Relatado por {row.reporter_id}</small>
                          </span>
                        </button>
                      </td>
                      <td>{labels[row.category]}</td>
                      <td>
                        <Badge status={row.status} />
                      </td>
                      <td className="muted">{date(row.created_at)}</td>
                      <td>
                        <button
                          className="view"
                          onClick={() => setAction({ kind: "review", row })}
                        >
                          Analisar <ArrowUpRight size={16} />
                        </button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={row.id}>
                      <td className="muted">{date(row.created_at)}</td>
                      <td>{row.username}</td>
                      <td>{labels[row.action] ?? row.action}</td>
                      <td className="mono">{row.target}</td>
                      <td className="reason-cell">{row.reason}</td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
            {!rows.length && !busy && (
              <div className="empty">
                <ShieldCheck size={34} />
                <strong>
                  {tab === "devices"
                    ? "Nenhum dispositivo encontrado"
                    : tab === "reports"
                      ? "Nenhuma denúncia nesta lista"
                      : "Nenhuma ação registrada"}
                </strong>
                <p>
                  {tab === "devices"
                    ? "Os computadores aparecerão após uma conexão autenticada."
                    : "Os registros reais do serviço aparecerão aqui."}
                </p>
              </div>
            )}
          </div>
          <footer className="table-footer">
            <span>Página {page + 1} · até 50 registros por página</span>
            <div>
              <button
                className="icon-button"
                aria-label="Página anterior"
                disabled={page === 0 || busy}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                className="icon-button"
                aria-label="Próxima página"
                disabled={rows.length < 50 || busy}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </footer>
        </section>
        <p className="moderation-note">
          <ShieldAlert size={17} />
          Denúncias exigem análise manual. Bloqueios e banimentos não
          identificam uma pessoa ou impedem o uso de outro dispositivo.
        </p>
      </main>
      {detail && (
        <Dialog title="Detalhes do dispositivo" onClose={() => setDetail(null)}>
          <div className="detail-id">
            <Monitor size={25} />
            <strong>{detail.device.id}</strong>
            <Badge status={detail.device.status} />
          </div>
          <dl>
            <dt>Primeiro registro</dt>
            <dd>{date(detail.device.created_at)}</dd>
            <dt>Último acesso</dt>
            <dd>{date(detail.device.last_seen)}</dd>
            <dt>Motivo atual</dt>
            <dd>{detail.device.reason ?? "Sem sanção registrada"}</dd>
            {detail.device.blocked_until && (
              <>
                <dt>Vencimento</dt>
                <dd>{date(detail.device.blocked_until)}</dd>
              </>
            )}
          </dl>
          <div className="detail-actions">
            <button
              className="primary"
              onClick={() => setAction({ kind: "block", row: detail.device })}
            >
              Bloquear temporariamente
            </button>
            <button
              className="danger"
              onClick={() => setAction({ kind: "ban", row: detail.device })}
            >
              Banir
            </button>
            {detail.device.status !== "active" && (
              <button
                className="secondary"
                onClick={() =>
                  setAction({ kind: "unblock", row: detail.device })
                }
              >
                Desbloquear / reverter
              </button>
            )}
          </div>
          <h3>Sanções e reversões</h3>
          {detail.sanctions.length === 0 ? (
            <p className="muted">Nenhuma sanção aplicada.</p>
          ) : (
            detail.sanctions.map((r: Row) => (
              <article className="history-item" key={r.id}>
                <strong>
                  {labels[r.action]} · {r.username}
                </strong>
                <p>{r.reason}</p>
                <small>
                  {date(r.created_at)}
                  {r.expires_at ? " · vence " + date(r.expires_at) : ""}
                </small>
              </article>
            ))
          )}
          <h3>Auditoria do dispositivo</h3>
          {detail.audit.map((r: Row) => (
            <article className="history-item" key={r.id}>
              <strong>{labels[r.action] ?? r.action}</strong>
              <p>{r.reason}</p>
              <small>
                {r.username} · {date(r.created_at)}
              </small>
            </article>
          ))}
        </Dialog>
      )}
      {action && (
        <ActionDialog
          key={action.kind + action.row.id}
          action={action}
          onClose={() => setAction(null)}
          onSubmit={async (data) => {
            await request(
              action.kind === "review"
                ? "reports/" + action.row.id
                : "devices/" + action.row.id + "/sanctions",
              data,
            );
            setAction(null);
            setNotice("Decisão registrada na auditoria.");
            if (detail) await openDevice(detail.device.id);
            await refresh();
          }}
        />
      )}
    </div>
  );
}
function Login({
  onLogin,
  error: outerError,
}: {
  onLogin: (user: User) => void;
  error: string;
}) {
  const [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [code, setCode] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="login-page">
      <div className="login-brand">
        <img src="/admin/coffee-mark.svg" alt="" />
        <span>Coffee Desk</span>
      </div>
      <form
        className="login-card"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            const res = await fetch("/api/admin/login", {
              method: "POST",
              credentials: "same-origin",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ username, password, code }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setPassword("");
            setCode("");
            onLogin(data);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="eyebrow">ÁREA RESTRITA</div>
        <h1>
          Seu serviço.
          <br />
          Sob controle.
        </h1>
        <p>Entre para administrar dispositivos e analisar denúncias.</p>
        <label>
          Usuário
          <input
            autoComplete="username"
            required
            value={username}
            maxLength={80}
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>
        <label>
          Senha
          <input
            type="password"
            autoComplete="current-password"
            required
            maxLength={256}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <label>
          Código do autenticador
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="000 000"
          />
        </label>
        {(error || outerError) && (
          <div role="alert" className="error">
            {error || outerError}
          </div>
        )}
        <button className="primary" disabled={busy}>
          {busy ? "Verificando…" : "Entrar com segurança"}
          <ArrowUpRight size={18} />
        </button>
        <small>
          <LockKeyhole size={13} />
          Senha e autenticação em duas etapas
        </small>
      </form>
      <div className="login-signature">
        Café - Sistemas & Softwares · Coffee Desk 1.0.1
      </div>
    </div>
  );
}
function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement;
    ref.current?.querySelector<HTMLElement>("button,input,textarea")?.focus();
    const key = (e: KeyboardEvent) => {
      const dialogs = [...document.querySelectorAll("[role=dialog]")];
      if (dialogs.at(-1) !== ref.current) return;
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const list = [
          ...ref.current!.querySelectorAll<HTMLElement>(
            "button:not(:disabled),input,textarea,select",
          ),
        ];
        const first = list[0],
          last = list.at(-1)!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      before?.focus();
    };
  }, [onClose]);
  return (
    <div className="overlay">
      <div
        className="dialog"
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <h2>{title}</h2>
          <button className="icon-button" aria-label="Fechar" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="dialog-body">{children}</div>
      </div>
    </div>
  );
}
function ActionDialog({
  action,
  onClose,
  onSubmit,
}: {
  action: { kind: string; row: Row };
  onClose: () => void;
  onSubmit: (data: Row) => Promise<void>;
}) {
  const [reason, setReason] = useState(""),
    [hours, setHours] = useState("24"),
    [confirm, setConfirm] = useState(""),
    [status, setStatus] = useState("reviewing"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const review = action.kind === "review";
  return (
    <Dialog
      title={
        review ? "Analisar denúncia" : labels[action.kind] + " de dispositivo"
      }
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await onSubmit(
              review
                ? { status, reason }
                : {
                    action: action.kind,
                    reason,
                    hours: Number(hours),
                    confirm,
                  },
            );
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <p className="mono">{review ? action.row.device_id : action.row.id}</p>
        {review && (
          <>
            <article className="report-text">
              <strong>{labels[action.row.category]}</strong>
              <p>{action.row.description}</p>
              <small>
                Remetente: {action.row.reporter_id}
                {action.row.call_id ? " · Sessão: " + action.row.call_id : ""}
              </small>
            </article>
            <label>
              Decisão
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {["reviewing", "substantiated", "dismissed"].map((s) => (
                  <option key={s} value={s}>
                    {labels[s]}
                  </option>
                ))}
              </select>
            </label>
            <p className="muted">
              A decisão não aplica uma sanção automaticamente.
            </p>
          </>
        )}
        {action.kind === "block" && (
          <label>
            Duração em horas
            <input
              type="number"
              required
              min="1"
              max="8760"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
            />
          </label>
        )}
        <label>
          {review ? "Justificativa da análise" : "Motivo obrigatório"}
          <textarea
            required
            minLength={5}
            maxLength={1000}
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        {action.kind === "ban" && (
          <label>
            Digite {action.row.id} para confirmar o banimento
            <input
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </label>
        )}
        {!review && action.kind !== "unblock" && (
          <p className="warning">
            Sessões ativas deste dispositivo serão encerradas nos clientes
            oficiais.
          </p>
        )}
        {error && (
          <div role="alert" className="error">
            {error}
          </div>
        )}
        <div className="form-actions">
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            className={action.kind === "ban" ? "danger" : "primary"}
            disabled={
              busy || (action.kind === "ban" && confirm !== action.row.id)
            }
          >
            {busy ? "Registrando…" : "Confirmar decisão"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
