import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import DataCollector from "./dev/DataCollector";
import "./index.css";

// DEV ONLY: Mount landmark collector when URL contains ?collect=true
const isCollectMode =
  new URLSearchParams(window.location.search).get("collect") === "true";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {isCollectMode ? <DataCollector /> : <App />}
  </React.StrictMode>
);