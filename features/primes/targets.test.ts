import { registerFeature } from "../support/vitest-adapter.ts";
import { targetsFeature } from "./targets.manifest.ts";

await registerFeature(
  targetsFeature,
  new URL("targets.feature", import.meta.url)
);
