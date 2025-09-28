import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";


const container = document.getElementById("root");
const root = createRoot(container);
root.render(<App />);


// Register service worker
if ("serviceWorker" in navigator) {
window.addEventListener("load", () => {
navigator.serviceWorker.register("/sw.js").catch(console.error);
});
}