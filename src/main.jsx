jsx
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./app.jsx";
import "./index.css";


const root = createRoot(document.getElementById("root"));
root.render(<App />);


// Inject PWA assets with correct base (works for GH Pages subpaths)
const BASE = import.meta.env.BASE_URL; // e.g. "/<repo>/" on Pages, "/" locally
function injectLink(rel, href, attrs = {}) {
const el = document.createElement("link");
el.rel = rel; el.href = `${BASE}${href}`; Object.assign(el, attrs); document.head.appendChild(el);
}
injectLink("manifest", "manifest.webmanifest");
injectLink("apple-touch-icon", "icons/icon-192.png");


// Service worker
if ("serviceWorker" in navigator) {
window.addEventListener("load", () => {
navigator.serviceWorker.register(`${BASE}sw.js`).catch((e) => console.log("SW reg failed", e));
});
}