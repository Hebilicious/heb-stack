import { adapterBundleConfig } from "@heb-stack/node-runtime/bundle";

import { CLI_BUNDLE_DIRECTORY } from "./src/location.ts";

/**
 * One Node entry point for the command line, so a caller runs `node main.js`
 * without a toolchain. The crate is not bundled: the adapter reads it from the
 * checkout its bundle sits in, which is why `CLI_BUNDLE_DIRECTORY` is shared.
 */
export default adapterBundleConfig({
  entry: "src/main.ts",
  outDir: `../../${CLI_BUNDLE_DIRECTORY}`,
});
