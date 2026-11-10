import { useCallback, useEffect, useRef, useState } from "react";
import { Leaf, LockKeyhole, RefreshCw } from "lucide-react";
import "./account.css";

export type AccountUser = { id: string; name: string; username: string };
type AuthResult = { authenticated: boolean; user?: AccountUser; message?: string };
type Props = { onAuthenticated: (user: AccountUser) => void };

export default function AccountGate({ onAuthenticated }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const mounted = useRef(true);
  const submitting = useRef(false);
  const pending = useRef<AbortController | null>(null);
  const callback = useRef(onAuthenticated);
  callback.current = onAuthenticated;

  const checkSession = useCallback(async () => {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 12_000);
    setChecking(true);
    setError("");
    try {
      const response = await fetch("/api/auth", {
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
      });
      const result = await response.json() as AuthResult;
      if (!response.ok) throw new Error(result.message || "暂时没有连接到寺门，请稍后重试。");
      if (!mounted.current || pending.current !== controller) return;
      if (result.authenticated && result.user) {
        callback.current(result.user);
        return;
      }
      setChecking(false);
    } catch (failure) {
      if (!mounted.current || pending.current !== controller) return;
      setChecking(false);
      setError(failure instanceof Error && failure.name !== "AbortError"
        ? failure.message : "寺门连接稍慢，请再试一次。");
    } finally {
      window.clearTimeout(timeout);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void checkSession();
    const viewport = window.visualViewport;
    const resize = () => document.documentElement.style.setProperty("--temple-viewport-height", `${Math.round(viewport?.height ?? window.innerHeight)}px`);
    resize();
    viewport?.addEventListener("resize", resize);
    window.addEventListener("resize", resize);
    return () => {
      mounted.current = false;
      pending.current?.abort();
      viewport?.removeEventListener("resize", resize);
      window.removeEventListener("resize", resize);
    };
  }, [checkSession]);

  function switchMode(next: "login" | "register") {
    setMode(next);
    setPassword("");
    setConfirmation("");
    setError("");
  }

  async function submit() {
    if (submitting.current) return;
    const account = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,24}$/.test(account)) {
      setError("账号请填写3至24位英文字母、数字或下划线。");
      return;
    }
    if (password.length < 8 || password.length > 128) {
      setError("密码请填写8至128个字符。");
      return;
    }
    if (mode === "register" && password !== confirmation) {
      setError("两次填写的密码需要一致。");
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError("");
    const controller = new AbortController();
    pending.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: mode, username: account, password }),
        signal: controller.signal,
      });
      const result = await response.json() as AuthResult;
      if (!response.ok || !result.authenticated || !result.user) {
        throw new Error(result.message || "账号或密码未通过验证，请检查后重试。");
      }
      if (!mounted.current) return;
      setPassword("");
      setConfirmation("");
      callback.current(result.user);
    } catch (failure) {
      if (!mounted.current) return;
      setPassword("");
      setConfirmation("");
      setError(failure instanceof Error && failure.name !== "AbortError"
        ? failure.message : "连接稍慢，请重新填写密码后再试一次。");
    } finally {
      window.clearTimeout(timeout);
      submitting.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  return <main className="account-gate" aria-label="云间寺账号登录">
    <section className="account-card" aria-labelledby="account-title">
      <header className="account-heading"><span className="account-leaf"><Leaf size={30} /></span><h1 id="account-title">云间寺</h1><p>给心，放个小假</p></header>
      {checking ? <div className="account-checking" role="status"><RefreshCw size={22} /><p>正在轻轻推开寺门…</p></div> : <>
        <div className="account-tabs" role="tablist" aria-label="账号入口">
          <button role="tab" aria-selected={mode === "login"} aria-controls="account-form" disabled={busy} onClick={() => switchMode("login")}>登录</button>
          <button role="tab" aria-selected={mode === "register"} aria-controls="account-form" disabled={busy} onClick={() => switchMode("register")}>设置密码</button>
        </div>
        <form id="account-form" className="account-form" onSubmit={event => { event.preventDefault(); void submit(); }}>
          <label htmlFor="temple-account">账号<input id="temple-account" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} inputMode="text" minLength={3} maxLength={24} required disabled={busy} value={username} onChange={event => setUsername(event.target.value)} placeholder="3–24位字母、数字或下划线" /></label>
          <label htmlFor="temple-password">{mode === "register" ? "设置登录密码" : "密码"}<input id="temple-password" name="password" type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} minLength={8} maxLength={128} required disabled={busy} value={password} onChange={event => setPassword(event.target.value)} placeholder="至少8个字符" /></label>
          {mode === "register" && <label htmlFor="temple-confirmation">再输入一次密码<input id="temple-confirmation" name="confirm-password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required disabled={busy} value={confirmation} onChange={event => setConfirmation(event.target.value)} placeholder="确认刚才的密码" /></label>}
          {error && <p className="account-error" role="alert">{error}</p>}
          <button className="account-submit" type="submit" disabled={busy}><LockKeyhole size={18} />{busy ? "正在验证…" : mode === "register" ? "设置密码，进入寺院" : "登录，进入寺院"}</button>
        </form>
        <p className="account-note">首次设置账号密码后，可在其他设备登录同一位小和尚。</p>
        {mode === "register" && <p className="account-note">在当前浏览器注册会保留尚存在的修行记录。</p>}
        {error && <button className="account-retry" disabled={busy} onClick={() => void checkSession()}><RefreshCw size={16} />重新检查登录状态</button>}
      </>}
      <p className="account-trial">当前为免费体验，账号及日记可能随服务休眠或重启重置。</p>
    </section>
  </main>;
}
