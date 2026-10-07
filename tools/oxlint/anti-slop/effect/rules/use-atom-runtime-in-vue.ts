import { defineRule } from "@oxlint/plugins";

import { importReference, isApplication, normalizedPath } from "../ast.ts";

/** Feature UI observes the session owner; browser adapters only provide service Layers. */
export const useAtomRuntimeInVueRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Keep durable ownership at the AcidCat root and service Layers in browser adapters.",
    },
    messages: {
      rootOwnership:
        "Observe shared AcidCat root atoms through @effect/atom-vue and invoke root handles. Build the durable runtime at packages/acidcat/src; provide browser service Layers from packages/browser-runtime/src.",
    },
  },
  create(context) {
    const filename = normalizedPath(context.filename);
    const feature = /(?:^|\/)apps\/web\/src\//u.test(filename);
    const browser = /(?:^|\/)packages\/browser-runtime\/src\//u.test(filename);
    if (!feature && !browser && !isApplication(context)) return {};
    return {
      CallExpression(node) {
        const reference = importReference(context, node.callee);
        if (!reference) return;
        const runtime =
          /^effect\.ManagedRuntime\./u.test(reference) ||
          /(?:^@effect\/atom[^.]*\.Atom|^effect\.unstable\/reactivity(?:\/|\.)Atom)\.runtime$/u.test(
            reference
          );
        const actor =
          (feature || browser) &&
          reference === "@xstate/effect.createEffectActor";
        const layer = feature && /^effect\.Layer\./u.test(reference);
        if (runtime || actor || layer)
          context.report({ node, messageId: "rootOwnership" });
      },
    };
  },
});
