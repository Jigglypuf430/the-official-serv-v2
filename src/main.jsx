import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

const root = createRoot(document.getElementById("root"));
root.render(<App />);

// Robust SW registration for subpath deployments (GitHub Pages)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const swUrl = `${import.meta.env.BASE_URL}sw.js`; // resolves to /THE-OFFICIAL-SERV/sw.js
    navigator.serviceWorker.register(swUrl).catch((e) => console.log("SW reg failed", e));
  });
}
