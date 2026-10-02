import { registerFeature } from "../support/vitest-adapter.ts";
import { primesFeature } from "./primes.manifest.ts";

await registerFeature(primesFeature, new URL("./primes.feature", import.meta.url));
