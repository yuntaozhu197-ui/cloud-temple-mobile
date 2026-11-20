import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Download, LockKeyhole, LogOut, MessageCircle, RefreshCw } from "lucide-react";
import "./admin.css";

type DashboardData = {
  metrics: {
    online: number;
    today: number;
    last7Days: number;
    last30Days: number;
    daily: { date: string; players: number }[];
    trackingSince: number;
  };
  feedback: {
    entries: { id: string; authorName: string; message: string; createdAt: number }[];
    total: number;
    offset: number;
    limit: number;
  };
  trial: { temporaryRecords: boolean };
};

type Screen = "checking" | "login" | "dashboard" | "disabled" | "unavailable";
type AdminProblem = { error?: string; message?: string };
type AdminResult<T> = { ok: true; data: T; headers: Headers } | { ok: false; status: number; problem: AdminProblem };
const number = new Intl.NumberFormat("zh-CN");
const date = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", year: "numeric", month: "long", day: "numeric" });
const dateTime = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

async function adminRequest<T = unknown>(path: string, signal: AbortSignal, body?: Record<string, string>, read = (response: Response): Promise<T> => response.json()): Promise<AdminResult<T>> {
  const timeout = new AbortController();
  const timer = window.setTimeout(() => timeout.abort(), 12_000);
  const cancel = () => timeout.abort();
  if (signal.aborted) cancel();
  signal.addEventListener("abort", cancel, { once: true });
  try {
    const response = await fetch(path, {
      credentials: "same-origin",
      cache: "no-store",
      signal: timeout.signal,
      ...(body && { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    });
    if (!response.ok) {
      const problem = await response.json().catch(() => ({}));
      return { ok: false, status: response.status, problem: problem || {} };
    }
    return { ok: true, data: await read(response), headers: response.headers };
  } finally {
    window.clearTimeout(timer);
    signal.removeEventListener("abort", cancel);
  }
}

export default function TempleAdmin() {
  const [screen, setScreen] = useState<Screen>("checking");
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const active = useRef<AbortController | null>(null);
  const feedbackHeading = useRef<HTMLHeadingElement>(null);

  const handleSessionStatus = useCallback((status: number, problem: AdminProblem) => {
    if (status !== 401 && !(status === 503 && problem.error === "admin_disabled")) return false;
    setDashboard(null);
    setScreen(status === 401 ? "login" : "disabled");
    return true;
  }, []);

  const loadDashboard = useCallback(async (offset: number, controller: AbortController, focusFeedback = false) => {
    const result = await adminRequest<DashboardData>(`/api/admin/dashboard?offset=${offset}`, controller.signal);
    if (controller.signal.aborted) return;
    if (!result.ok) {
      if (!handleSessionStatus(result.status, result.problem)) throw new Error();
      return;
    }
    setDashboard(result.data);
    setScreen("dashboard");
    if (focusFeedback) feedbackHeading.current?.focus();
  }, [handleSessionStatus]);

  const refresh = useCallback(async (offset = 0, focusFeedback = false) => {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setError("");
    try {
      await loadDashboard(offset, controller, focusFeedback);
    } catch {
      if (!controller.signal.aborted) {
        setScreen(current => current === "dashboard" ? current : "unavailable");
        setError("暂时无法读取管理数据，请重试。");
      }
    } finally {
      if (active.current === controller) {
        active.current = null;
        setBusy(false);
      }
    }
  }, [loadDashboard]);

  useEffect(() => {
    void refresh();
    return () => {
      active.current?.abort();
      active.current = null;
    };
  }, [refresh]);

  async function changeSession(action: "login" | "logout") {
    if (active.current || (action === "login" && !passcode.trim())) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setError("");
    const body: Record<string, string> = action === "login" ? { action, passcode: passcode.trim() } : { action };
    setPasscode("");
    try {
      const result = await adminRequest("/api/admin/session", controller.signal, body);
      if (controller.signal.aborted) return;
      if (!result.ok) {
        if (result.status !== 401 && handleSessionStatus(result.status, result.problem)) return;
        setError(typeof result.problem.message === "string" ? result.problem.message : "操作没有完成，请重试。");
        return;
      }
      if (action === "logout") {
        setDashboard(null);
        setScreen("login");
        return;
      }
      try {
        await loadDashboard(0, controller);
      } catch {
        if (!controller.signal.aborted) {
          setScreen("unavailable");
          setError("登录成功，暂时无法读取管理数据。请重试。");
        }
      }
    } catch {
      if (!controller.signal.aborted) setError("连接暂时不可用，请重试。");
    } finally {
      if (active.current === controller) {
        active.current = null;
        setBusy(false);
      }
    }
  }

  async function exportBackup() {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setError("");
    try {
      const result = await adminRequest<Blob>("/api/admin/export", controller.signal, undefined, response => response.blob());
      if (controller.signal.aborted) return;
      if (!result.ok) {
        if (!handleSessionStatus(result.status, result.problem)) throw new Error();
        return;
      }
      const filename = result.headers.get("Content-Disposition")?.match(/yunjian-\d{4}-\d{2}-\d{2}\.json/)?.[0];
      const url = URL.createObjectURL(result.data);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename ?? "yunjian-backup.json";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch {
      if (!controller.signal.aborted) setError("备份导出失败，请重试。");
    } finally {
      if (active.current === controller) {
        active.current = null;
        setBusy(false);
      }
    }
  }

  if (screen !== "dashboard" || !dashboard) return (
    <main className="temple-admin admin-login" aria-labelledby="admin-title">
      <section className="admin-login-card">
        <a className="admin-home" href="/"><ArrowLeft size={16} aria-hidden="true" />返回云间寺</a>
        <div className="admin-login-mark" aria-hidden="true"><LockKeyhole size={24} strokeWidth={1.6} /></div>
        <h1 id="admin-title">云间寺管理</h1>
        {screen === "checking" && <p role="status">正在检查登录状态…</p>}
        {screen === "disabled" && <p role="status">管理员入口尚未配置。</p>}
        {screen === "unavailable" && <button className="admin-button" type="button" disabled={busy} onClick={() => void refresh()}><RefreshCw size={16} aria-hidden="true" />{busy ? "正在读取…" : "重新读取"}</button>}
        {screen === "login" && <form className="admin-login-form" onSubmit={event => { event.preventDefault(); void changeSession("login"); }}>
          <label htmlFor="temple-admin-passcode">管理员登录码</label>
          <input id="temple-admin-passcode" type="password" autoComplete="current-password" autoCapitalize="none" spellCheck={false} dir="ltr" value={passcode} onChange={event => setPasscode(event.target.value)} required disabled={busy} />
          <button className="admin-button primary" type="submit" disabled={busy || !passcode.trim()}>{busy ? "正在登录…" : "进入管理页"}</button>
        </form>}
        {error && <p className="admin-error" role="alert">{error}</p>}
      </section>
    </main>
  );

  const { metrics, feedback, trial } = dashboard;
  const peak = Math.max(1, ...metrics.daily.map(day => day.players));
  const hasPrevious = feedback.offset > 0;
  const hasNext = feedback.offset + feedback.limit < feedback.total;
  const playerCounts = [
    { label: "今日玩家", count: metrics.today },
    { label: "近 7 日玩家", count: metrics.last7Days },
    { label: "近 30 日玩家", count: metrics.last30Days },
    { label: "当前在线", count: metrics.online },
  ];

  return <main className="temple-admin" aria-labelledby="admin-title">
    <div className="admin-shell">
      <header className="admin-heading">
        <div><a className="admin-home" href="/"><ArrowLeft size={16} aria-hidden="true" />返回云间寺</a><h1 id="admin-title">云间寺管理</h1></div>
        <div className="admin-actions">
          <button className="admin-button" type="button" disabled={busy} onClick={() => void refresh(feedback.offset)}><RefreshCw size={16} aria-hidden="true" />{busy ? "处理中…" : "刷新"}</button>
          <button className="admin-button" type="button" disabled={busy} onClick={() => void exportBackup()}><Download size={16} aria-hidden="true" />导出备份</button>
          <button className="admin-button" type="button" disabled={busy} onClick={() => void changeSession("logout")}><LogOut size={16} aria-hidden="true" />退出</button>
        </div>
      </header>
      {error && <p className="admin-error" role="alert">{error}</p>}
      {trial.temporaryRecords && <p className="admin-storage-note">免费试用实例休眠、重启或重新部署后，留言和统计可能清空。</p>}

      <section className="admin-section" aria-labelledby="admin-stats-title">
        <h2 id="admin-stats-title">入寺统计</h2>
        <p className="admin-note">按北京时间统计，从 {date.format(metrics.trackingSince)} 起记录。每个时段内同一玩家只计一次。</p>
        <dl className="admin-metrics">
          {playerCounts.map(({ label, count }) => <div key={label}><dt>{label}</dt><dd>{number.format(count)}</dd></div>)}
        </dl>
        <h3>近 7 天每日玩家</h3>
        <ol className="admin-chart" aria-label="近 7 天每日玩家">
          {metrics.daily.map(day => {
            const dayLabel = day.date.slice(5).replace("-", "/");
            return <li key={day.date} aria-label={`${dayLabel}，${number.format(day.players)} 人`}>
              <span className="admin-chart-count">{number.format(day.players)}</span>
              <span className="admin-chart-track" aria-hidden="true"><span style={{ height: `${day.players / peak * 100}%` }} /></span>
              <time dateTime={day.date}>{dayLabel}</time>
            </li>;
          })}
        </ol>
      </section>

      <section className="admin-section" aria-labelledby="admin-feedback-title">
        <div className="admin-section-heading">
          <h2 id="admin-feedback-title" ref={feedbackHeading} tabIndex={-1}><MessageCircle size={20} aria-hidden="true" />玩家留言与建议</h2>
          <p className="admin-note">{number.format(feedback.total)} 条</p>
        </div>
        {feedback.entries.length === 0 ? <p className="admin-empty">{feedback.total ? "这一页没有留言。" : "还没有收到玩家留言。"}</p> : <ul className="admin-feedback">
          {feedback.entries.map(entry => <li key={entry.id}>
            <div className="admin-feedback-meta"><strong>{entry.authorName || "寺友"}</strong><time dateTime={new Date(entry.createdAt).toISOString()}>{dateTime.format(entry.createdAt)}</time></div>
            <p>{entry.message}</p>
          </li>)}
        </ul>}
        {(hasPrevious || hasNext) && <nav className="admin-pagination" aria-label="留言分页">
          <button className="admin-button" type="button" disabled={busy || !hasPrevious} onClick={() => void refresh(Math.max(0, feedback.offset - feedback.limit), true)}><ChevronLeft size={16} aria-hidden="true" />上一页</button>
          <button className="admin-button" type="button" disabled={busy || !hasNext} onClick={() => void refresh(feedback.offset + feedback.limit, true)}>下一页<ChevronRight size={16} aria-hidden="true" /></button>
        </nav>}
      </section>
    </div>
  </main>;
}
