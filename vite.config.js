import { defineConfig } from "vite";

export default defineConfig({
  base: process.env.BUILD_DEMO ? "./" : "/",
  build: process.env.BUILD_DEMO
    ? {
      outDir: "dist",
    }
    : {
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
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.js"],
      exclude: ["**/*.test.js", "**/*.spec.js"],
    },
  },
});
