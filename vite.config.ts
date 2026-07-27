import { defineConfig } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { sites } from "./build/sites-vite-plugin";
import vinext from "vinext";

export default defineConfig({
  plugins: [vinext(), sites(), cloudflare({ viteEnvironment: { name: "rsc" } })],
});
