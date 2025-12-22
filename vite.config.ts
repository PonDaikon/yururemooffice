import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "path";
import { defineConfig } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";
import { Server } from "socket.io";
import { setupSocketIO } from "./server/socket";
import { nodePolyfills } from "vite-plugin-node-polyfills";

const socketIOPlugin = {
  name: "socket-io-plugin",
  configureServer(server: any) {
    if (!server.httpServer) return;
    const io = new Server(server.httpServer);
    setupSocketIO(io);
  }
};

const plugins = [
  react(), 
  tailwindcss(), 
  jsxLocPlugin(), 
  vitePluginManusRuntime(), 
  socketIOPlugin,
  nodePolyfills({
    protocolImports: true,
  })
];

export default defineConfig({
  plugins,
  define: {
    global: 'globalThis',
    'process.env': {},
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    strictPort: true, // Fail if 3000 is busy, do not switch to other ports
    host: true,
    allowedHosts: [
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer",
      "localhost",
      "127.0.0.1",
    ],
    proxy: {},
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
    headers: {
      "Permissions-Policy": "display-capture=*",
    },
  },
});
