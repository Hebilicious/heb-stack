import { registerFeatureSource } from "../support/vitest-adapter.ts";
// The DOM environment replaces the global URL, so the Feature text arrives through the bundler instead of a file read.
import source from "./check.vue.feature?raw";
import { checkPageFeature } from "./check.vue.manifest.ts";

registerFeatureSource(checkPageFeature, source);
