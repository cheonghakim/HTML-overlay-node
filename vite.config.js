import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "src/index.js",
      name: "FreeNode",
      fileName: (format) => `free-node.${format}.js`,
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
