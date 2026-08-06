import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app.js";
import "./styles.css";
import "./styles-v2.css";

const root = document.getElementById("root");
if (root === null) {
  throw new Error("Pacium root element is missing");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
