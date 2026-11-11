import { useCallback, useEffect, useRef, useState } from "react";
import { Leaf, RefreshCw } from "lucide-react";
import "./account.css";

export type AccountUser = { id: string; name: string; username?: string };
type AuthResult = { authenticated: boolean; user?: AccountUser; message?: string };
type Props = { onAuthenticated: (user: AccountUser) => void };

export default function AccountGate({ onAuthenticated }: Props) {
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
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

  async function enterTemple() {
    if (submitting.current) return;
    const nickname = name.trim();
    if (!nickname) {
      setError("给小和尚取个名字吧。");
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
        body: JSON.stringify({ action: "enter", name: nickname }),
        signal: controller.signal,
      });
      const result = await response.json() as AuthResult;
      if (!response.ok || !result.authenticated || !result.user) {
        throw new Error(result.message || "名字暂时没有送达，请再试一次。");
      }
      if (mounted.current) callback.current(result.user);
    } catch (failure) {
      if (!mounted.current) return;
      setError(failure instanceof Error && failure.name !== "AbortError"
        ? failure.message : "寺门连接稍慢，请再试一次。");
    } finally {
      window.clearTimeout(timeout);
      submitting.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  return <main className="account-gate" aria-label="进入云间寺">
    <section className="account-card" aria-labelledby="account-title">
      <header className="account-heading">
        <span className="account-leaf"><Leaf size={30} /></span>
        <h1 id="account-title">云间寺</h1>
        <p>取个名字，来寺里坐坐</p>
      </header>
      {checking ? <div className="account-checking" role="status"><RefreshCw size={22} /><p>正在轻轻推开寺门…</p></div> : <>
        <form className="account-form" onSubmit={event => { event.preventDefault(); void enterTemple(); }}>
          <label htmlFor="temple-name">你的名字
            <input id="temple-name" name="nickname" autoComplete="nickname" autoCapitalize="none" spellCheck={false} required disabled={busy} value={name} onChange={event => setName(event.target.value)} placeholder="中文、英文、数字都可以" />
          </label>
          {error && <p className="account-error" role="alert">{error}</p>}
          <button className="account-submit" type="submit" disabled={busy}>{busy ? "正在入寺…" : "进入寺院"}</button>
        </form>
        <p className="account-note">这个浏览器会记住你的小和尚。同名的寺友也有各自的日记。</p>
        {error && <button className="account-retry" disabled={busy} onClick={() => void checkSession()}><RefreshCw size={16} />重新连接</button>}
      </>}
      <p className="account-trial">免费体验期间，名字和日记记录可能随服务休眠或重启重置。</p>
    </section>
  </main>;
}
