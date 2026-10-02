import { defineWranglerConfig } from "wrangler/experimental-config";

// The crate is imported as a compiled module, so workerd compiles it once when the isolate starts.
export default defineWranglerConfig(() => ({
  rules: [{ type: "CompiledWasm", globs: ["**/*.wasm"], fallthrough: false }],
  dev: { ip: "127.0.0.1" },
  assetsDirectory: "../../apps/web/dist",
}));
