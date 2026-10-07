import { defineRule, type ESTree } from "@oxlint/plugins";

import { importReference, isApplication } from "../ast.ts";

export const noXstatePromiseActorsWithEffectRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Use invoked Effect actors for Effect workflow settlement.",
    },
    messages: {
      mixedOwnership:
        "Use an invoked fromEffect actor from @xstate/effect to preserve typed errors, requirements, and state-owned interruption. Provide its services through the owning Layer.",
    },
  },
  create(context) {
    let importsEffect = isApplication(context);
    const candidates: ESTree.Node[] = [];
    return {
      ImportDeclaration(node) {
        if (
          node.source.value === "effect" ||
          node.source.value.startsWith("effect/") ||
          node.source.value === "@xstate/effect"
        )
          importsEffect = true;
        if (!/^xstate(?:-v[^/]*)?$/u.test(node.source.value)) return;
        for (const specifier of node.specifiers) {
          if (
            specifier.type === "ImportSpecifier" &&
            specifier.imported.type === "Identifier" &&
            specifier.imported.name === "fromPromise"
          )
            candidates.push(specifier);
        }
      },
      CallExpression(node) {
        if (
          /^xstate(?:-v[^.]*)?\.fromPromise$/u.test(
            importReference(context, node.callee) ?? ""
          ) &&
          node.callee.type === "MemberExpression"
        )
          candidates.push(node);
      },
      "Program:exit"() {
        if (importsEffect)
          for (const node of candidates)
            context.report({ node, messageId: "mixedOwnership" });
      },
    };
  },
});
