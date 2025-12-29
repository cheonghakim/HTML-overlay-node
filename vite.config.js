import { defineConfig } from "vite";

export default defineConfig({
  base: "/HTML-overlay-node/",
  build: {
    lib: {
      entry: "src/index.js",
      name: "HTMLOverlayNode",
      fileName: (format) => `html-overlay-node.${format}.js`,
    },
    sourcemap: true,
    minify: "terser",
  },
  test: {
    globals: true,
    environment: "jsdom",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.js"],
      exclude: ["**/*.test.js", "**/*.spec.js"],
    },
  },
});
