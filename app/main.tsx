import { createRoot } from "react-dom/client";
import { lazy, Suspense } from "react";
import Home from "./page";
import "./globals.css";
import "./mobile.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("The temple's root element is missing.");
}

const TempleAdmin = lazy(() => import("./TempleAdmin"));
const isAdmin = /^\/admin\/?$/.test(window.location.pathname);
createRoot(root).render(isAdmin
  ? <Suspense fallback={<p role="status">正在打开云间寺管理后台…</p>}><TempleAdmin /></Suspense>
  : <Home />);
