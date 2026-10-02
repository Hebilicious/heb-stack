import assert from "node:assert/strict";

import { AtomRegistry, registryKey } from "@effect/atom-vue";
import { createAcidCat } from "@heb-stack/acidcat";
import { primeMathWasmLayer } from "@heb-stack/acidcat/primes";
import { checkHistoryLocalLayer } from "@heb-stack/browser-runtime";
import { Effect, Layer } from "effect";
import { createVaporApp } from "vue";

import App from "../../apps/web/src/app.vue";
import { acidCatKey } from "../../apps/web/src/root.ts";
import { vaporComponent } from "../../apps/web/src/vapor.ts";
import { eventually } from "../support/eventually.ts";
import {
  noStepArguments,
  step,
  stringStepArgument,
} from "../support/manifest.ts";
import type { ExecutableFeatureManifest } from "../support/manifest.ts";
import {
  compiledCrate,
  memoryStorage,
  required,
  scopedSession,
} from "../support/sessions.ts";

interface World {
  host?: HTMLElement;
}

export const checkPageFeature: ExecutableFeatureManifest<World> = {
  capabilityIds: ["primes.check"],
  createWorld: () => ({}),
  id: "check-page",
  steps: [
    // The page mounts over the real root and the crate in this process: only the remote hop to the Worker is absent.
    step("the prime checker page", noStepArguments, (world) =>
      Effect.gen(function* () {
        const module = yield* compiledCrate;
        const services = Layer.merge(
          primeMathWasmLayer(module),
          checkHistoryLocalLayer(memoryStorage())
        );
        const root = yield* scopedSession(
          async () => await createAcidCat({ target: "web" }, services)
        );
        const host = document.createElement("div");
        document.body.append(host);
        const app = createVaporApp(vaporComponent(App));
        app.provide(registryKey, AtomRegistry.make());
        app.provide(acidCatKey, Object.freeze({ ...root, webmcp: null }));
        yield* Effect.acquireRelease(
          Effect.sync(() => app.mount(host)),
          () =>
            Effect.sync(() => {
              app.unmount();
              host.remove();
            })
        );
        world.host = host;
      })
    ),
    step("the visitor types {string}", stringStepArgument, (world, text) => {
      const input = required(world.host, "page").querySelector("input");
      assert.ok(
        input instanceof HTMLInputElement,
        "The page has no number input"
      );
      input.value = text;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }),
    step("the page shows {string}", stringStepArgument, async (world, text) => {
      await eventually(() => {
        const status = required(world.host, "page").querySelector(
          '[role="status"]'
        );
        assert.equal(status?.textContent?.trim(), text);
      });
    }),
  ],
  uri: "features/web/check.vue.feature",
};
