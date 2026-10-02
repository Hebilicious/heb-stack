import { Predicate } from "effect";
import type { VaporComponent } from "vue";

/**
 * BOUNDARY: vize's type checker models every SFC as a VDOM component, so a Vapor-compiled SFC reaches the Vapor app as
 * `unknown` and is checked here for the marker `defineVaporComponent` sets.
 */
export function vaporComponent(component: unknown): VaporComponent {
  if (
    !Predicate.hasProperty(component, "__vapor") ||
    component.__vapor !== true
  ) {
    throw new TypeError(
      "The component was not compiled for Vapor; check compiler.vapor in vize.config.ts"
    );
  }
  // SAFETY: `defineVaporComponent` marks exactly the components it defines with `__vapor: true`, checked above.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the marker check above is the evidence.
  return component as VaporComponent;
}
