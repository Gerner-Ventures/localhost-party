/**
 * Build script for bundling the WebSocket server with esbuild.
 * This bundles server.ts and all ../lib/ imports into a single file
 * so it can be deployed to Railway without the parent directory.
 */
import * as esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["server.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  outfile: "dist/server.js",
  format: "esm",
  // Don't bundle node_modules - they'll be installed via npm
  external: ["socket.io", "dotenv"],
  // Preserve environment variable access
  define: {
    "process.env.NODE_ENV": JSON.stringify(
      process.env.NODE_ENV || "production"
    ),
  },
  sourcemap: true,
  minify: false, // Keep readable for debugging
});

console.log("Build complete: dist/server.js");
