import { defineConfig } from "vite";
import FastRefresh from "@vitejs/plugin-react-refresh";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    // FullReload(["src/**/*"])
    FastRefresh(),
  ],
  server: {
    port: 3001,
  },
});
