import { adapterBundleConfig } from "./packages/node-runtime/src/bundle.ts";
import { CLI_BUNDLE_DIRECTORY } from "./packages/cli/src/location.ts";

/**
 * One Node entry point for the command line, so a caller runs `node main.js` without a toolchain. The crate is not
 * bundled; the adapter reads it from the checkout its bundle sits in, which is why `CLI_BUNDLE_DIRECTORY` is shared.
 */
export default adapterBundleConfig({ entry: "packages/cli/src/main.ts", outDir: CLI_BUNDLE_DIRECTORY });
