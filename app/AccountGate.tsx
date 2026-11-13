import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, RefreshCw } from "lucide-react";
import type * as THREE from "three";
import "./account.css";

export type AccountUser = { id: string; name: string; username?: string };
type AuthResult = { authenticated: boolean; user?: AccountUser; message?: string };
type Props = { onAuthenticated: (user: AccountUser) => void };

function AccountTemplePreview() {
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    let dispose = () => {};
    void (async () => {
      try {
        const T = await import("three");
        if (!alive || !host.current) return;
        const container = host.current;
        const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        renderer.outputColorSpace = T.SRGBColorSpace;
        renderer.toneMapping = T.ACESFilmicToneMapping;
        renderer.toneMappingExposure = .96;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = T.PCFSoftShadowMap;
        renderer.domElement.setAttribute("aria-hidden", "true");
        container.appendChild(renderer.domElement);
        const scene = new T.Scene();
        const camera = new T.PerspectiveCamera(32, 1, .1, 80);
        camera.position.set(10, 9.5, 13);
        camera.lookAt(0, 1.1, 0);
        const geometries = new Set<THREE.BufferGeometry>();
        const materials = new Set<THREE.Material>();
        const cleanups: (() => void)[] = [];
        let disposed = false;
        dispose = () => {
          if (disposed) return;
          disposed = true;
          cleanups.forEach(cleanup => cleanup());
          geometries.forEach(geometry => geometry.dispose());
          materials.forEach(material => material.dispose());
          scene.clear();
          renderer.dispose();
          renderer.forceContextLoss();
          renderer.domElement.remove();
        };
        const surface = (color: string, roughness = .88) => {
          const material = new T.MeshStandardMaterial({ color, roughness });
          materials.add(material);
          return material;
        };
        const jade = surface("#284e4c");
        const tile = surface("#52776a");
        const timber = surface("#8b493a");
        const darkWood = surface("#493a30");
        const plaster = surface("#edddba");
        const stone = surface("#cbbfa6");
        const gold = surface("#b4925b", .62);
        const pine = surface("#476d58");
        const ridge = surface("#416861");
        const distantRidge = surface("#63847b");
        function add(geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) {
          geometries.add(geometry);
          const object = new T.Mesh(geometry, material);
          object.position.set(x, y, z);
          object.castShadow = true;
          object.receiveShadow = true;
          scene.add(object);
          return object;
        }
        const box = (x: number, y: number, z: number, width: number, height: number, depth: number, material: THREE.Material) => add(new T.BoxGeometry(width, height, depth), material, x, y, z);
        function roof(x: number, z: number, width: number, depth: number, height: number, rise: number) {
          for (const direction of [-1, 1]) {
            const positions: number[] = [], indices: number[] = [];
            for (let row = 0; row <= 8; row++) for (let column = 0; column <= 16; column++) {
              const across = column / 16 * 2 - 1, down = row / 8;
              positions.push(x + across * width / 2, height + rise * (1 - down) ** 1.4 + .16 * down ** 5 + .12 * Math.abs(across) ** 6, z + direction * down * depth / 2);
            }
            for (let row = 0; row < 8; row++) for (let column = 0; column < 16; column++) {
              const first = row * 17 + column;
              if (direction === 1) indices.push(first, first + 17, first + 1, first + 1, first + 17, first + 18);
              else indices.push(first, first + 1, first + 17, first + 1, first + 18, first + 17);
            }
            const geometry = new T.BufferGeometry();
            geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
            geometry.setIndex(indices);
            geometry.computeVertexNormals();
            add(geometry, jade, 0, 0, 0);
            for (let column = 0; column <= 12; column++) {
              const across = column / 12 * 2 - 1;
              const points = Array.from({ length: 9 }, (_, row) => {
                const down = row / 8;
                return new T.Vector3(x + across * width / 2, height + rise * (1 - down) ** 1.4 + .16 * down ** 5 + .12 * Math.abs(across) ** 6 + .025, z + direction * down * depth / 2);
              });
              add(new T.TubeGeometry(new T.CatmullRomCurve3(points), 8, .025, 4, false), tile, 0, 0, 0);
            }
          }
          box(x, height + rise + .04, z, width + .1, .09, .12, gold);
        }
        function hall(x: number, z: number, scale: number) {
          box(x, .25, z, 3.6 * scale, .34, 2.7 * scale, stone);
          box(x, .45, z, 3.4 * scale, .08, 2.5 * scale, plaster);
          box(x, 1.25 * scale + .45, z - 1.05 * scale, 3.2 * scale, 2.5 * scale, .13, plaster);
          box(x, 1.45 * scale, z - .96 * scale, 1.05 * scale, 2 * scale, .04, darkWood);
          for (const side of [-1, 1]) {
            box(x + side * 1.55 * scale, 1.25 * scale + .45, z, .12, 2.5 * scale, 2.2 * scale, plaster);
            box(x + side * 1.1 * scale, 1.25 * scale + .45, z + 1.05 * scale, .9 * scale, 2.5 * scale, .13, plaster);
            add(new T.CylinderGeometry(.085 * scale, .11 * scale, 2.5 * scale, 8), timber, x + side * .66 * scale, 1.25 * scale + .45, z + 1.07 * scale);
            box(x + side * .66 * scale, .48, z + 1.07 * scale, .26 * scale, .16, .26 * scale, stone);
            const window = add(new T.TorusGeometry(.26 * scale, .035 * scale, 4, 16), darkWood, x + side * 1.14 * scale, 1.55 * scale, z + 1.13 * scale);
            window.castShadow = false;
            for (const offset of [-.12, 0, .12]) box(x + side * 1.14 * scale + offset * scale, 1.55 * scale, z + 1.14 * scale, .025, .44 * scale, .025, darkWood);
          }
          box(x, 2.6 * scale + .42, z + 1.08 * scale, 3.2 * scale, .14, .16, timber);
          box(x, 2.35 * scale + .4, z + 1.17 * scale, .9 * scale, .3 * scale, .08, darkWood);
          roof(x, z, 4 * scale, 3.2 * scale, 2.72 * scale + .4, .8 * scale);
          for (let step = 0; step < 3; step++) box(x, .06 + step * .07, z + 1.7 * scale - step * .25, 1.6 * scale, .12 + step * .14, .38, stone);
        }
        const base = add(new T.CylinderGeometry(5.6, 4.8, .6, 8), ridge, 0, -.22, .2);
        base.receiveShadow = true;
        add(new T.CylinderGeometry(5.35, 5.5, .16, 8), pine, 0, .13, .2);
        box(0, .23, 1.5, 1.8, .05, 5.1, stone);
        hall(0, -1.35, 1);
        hall(-3.1, 1, .56);
        hall(3.1, 1, .56);
        for (const [x, z, scale] of [[-3.5, -1.4, 1], [3.8, -1.3, .8], [-3.8, 2.7, .7]]) {
          add(new T.CylinderGeometry(.05 * scale, .08 * scale, 1.8 * scale, 6), darkWood, x, 1.1 * scale, z);
          for (let tier = 0; tier < 3; tier++) {
            const crown = add(new T.IcosahedronGeometry(.75 * scale, 1), pine, x + Math.sin(tier * 2) * .16, (1.5 + tier * .4) * scale, z);
            crown.scale.set(1, .45, .85);
          }
        }
        for (const [x, y, z, scale] of [[-4, 1.3, -4.5, 2.4], [0, 1.5, -6, 3], [4.3, .8, -4.8, 2]]) {
          const mountain = add(new T.IcosahedronGeometry(1, 1), distantRidge, x, y, z);
          mountain.scale.set(scale, scale * 1.1, scale * .75);
          mountain.castShadow = false;
        }
        const ambient = new T.HemisphereLight(0xffebcb, 0x385b50, 1.7);
        const sun = new T.DirectionalLight(0xffd6a0, 3.8);
        sun.position.set(-5, 10, 7);
        sun.castShadow = true;
        sun.shadow.mapSize.set(1024, 1024);
        Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: .5, far: 30 });
        sun.shadow.normalBias = .035;
        scene.add(ambient, sun);
        const draw = () => {
          if (!alive || disposed || document.hidden || !container.clientWidth || !container.clientHeight) return;
          camera.aspect = container.clientWidth / container.clientHeight;
          camera.zoom = Math.min(1, camera.aspect / 1.15);
          camera.updateProjectionMatrix();
          renderer.setSize(container.clientWidth, container.clientHeight, false);
          renderer.render(scene, camera);
        };
        const restored = () => { draw(); if (alive) setReady(true); };
        const lost = (event: Event) => { event.preventDefault(); if (alive) setReady(false); };
        const observer = new ResizeObserver(draw);
        observer.observe(container);
        window.addEventListener("focus", restored);
        document.addEventListener("visibilitychange", restored);
        renderer.domElement.addEventListener("webglcontextlost", lost);
        renderer.domElement.addEventListener("webglcontextrestored", restored);
        cleanups.push(() => {
          observer.disconnect();
          window.removeEventListener("focus", restored);
          document.removeEventListener("visibilitychange", restored);
          renderer.domElement.removeEventListener("webglcontextlost", lost);
          renderer.domElement.removeEventListener("webglcontextrestored", restored);
          sun.shadow.dispose();
        });
        draw();
        if (alive) setReady(true);
      } catch { dispose(); }
    })();
    return () => { alive = false; dispose(); };
  }, []);

  return <div className={`account-scene ${ready ? "is-ready" : ""}`} ref={host} aria-hidden="true" />;
}

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
    <AccountTemplePreview />
    <section className="account-card" aria-labelledby="account-title">
      <header className="account-heading">
        <h1 id="account-title">云间寺</h1>
        <p>取个名字，来寺里坐坐</p>
      </header>
      {checking ? <div className="account-checking" role="status"><div className="account-skeleton" aria-hidden="true"><span /><span /><span /></div><p>正在轻轻推开寺门…</p></div> : <>
        <form className="account-form" onSubmit={event => { event.preventDefault(); void enterTemple(); }}>
          <label htmlFor="temple-name">你的名字
            <input id="temple-name" name="nickname" autoComplete="nickname" autoCapitalize="none" spellCheck={false} required disabled={busy} value={name} onChange={event => setName(event.target.value)} placeholder="中文、英文、数字都可以" />
          </label>
          {error && <p className="account-error" role="alert">{error}</p>}
          <button className="account-submit" type="submit" disabled={busy}>{busy ? "正在入寺…" : "进入寺院"}<ArrowRight size={18} aria-hidden="true" /></button>
        </form>
        <p className="account-note">这个浏览器会记住你的小和尚。同名的寺友也有各自的日记。</p>
        {error && <button className="account-retry" disabled={busy} onClick={() => void checkSession()}><RefreshCw size={16} />重新连接</button>}
      </>}
      <p className="account-trial">免费体验期间，名字和日记记录可能随服务休眠或重启重置。</p>
    </section>
  </main>;
}
