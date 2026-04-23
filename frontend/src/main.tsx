// Import console filter first to suppress URL exposure in browser console
import "./lib/consoleFilter";

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
