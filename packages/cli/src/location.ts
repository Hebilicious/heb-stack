/**
 * Where the command line's bundle is built, relative to the checkout root. The bundle config writes it and the adapter
 * finds the crate from it, so the two cannot drift.
 */
export const CLI_BUNDLE_DIRECTORY = ".artifacts/cli";
