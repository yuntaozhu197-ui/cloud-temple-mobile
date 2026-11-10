import { createRoot } from "react-dom/client";
import Home from "./page";
import "./globals.css";
import "./mobile.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("The temple's root element is missing.");
}

createRoot(root).render(<Home />);
