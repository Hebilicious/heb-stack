import { defineRule, type Context, type ESTree } from "@oxlint/plugins";

import { importReference, propertyName } from "../ast.ts";

function isEnqueue(context: Context, node: ESTree.Node): boolean {
  if (node.type !== "Identifier") return false;
  // Retain the original direct enqueue callback diagnostic; resolve destructured aliases below.
  if (["enq", "enqueue"].includes(node.name)) return true;
  let parent = node.parent;
  while (parent && parent.type !== "Program") {
    if (
      parent.type === "ArrowFunctionExpression" ||
      parent.type === "FunctionExpression"
    ) {
      const call = parent.parent;
      if (
        call?.type === "CallExpression" &&
        /^xstate(?:-v[^.]*)?\.enqueueActions$/u.test(
          importReference(context, call.callee) ?? ""
        )
      ) {
        return parent.params.some(
          (parameter) =>
            parameter.type === "ObjectPattern" &&
            parameter.properties.some(
              (property) =>
                property.type === "Property" &&
                propertyName(property.key) === "enqueue" &&
                property.value.type === "Identifier" &&
                property.value.name === node.name
            )
        );
      }
    }
    parent = parent.parent;
  }
  return false;
}

/** Migrated modules use the upstream host and declare non-authoritative Effect actions. */
export const useEffectActorHostRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Use scoped Effect actors and declared Effect actions.",
    },
    messages: {
      rawActor:
        "Create Effect-backed actors with createEffectActor from @xstate/effect inside the owning Layer/Scope.",
      inlineEffect:
        "Declare Effect actions in setupEffect({ actions }) and enqueue the named action. Use an invoked fromEffect actor for work that controls settlement.",
    },
  },
  create(context) {
    let usesEffectActors = false;
    const rawActors: ESTree.Node[] = [];
    return {
      ImportDeclaration(node) {
        if (node.source.value === "@xstate/effect") usesEffectActors = true;
        if (!/^xstate(?:-v[^/]*)?$/u.test(node.source.value)) return;
        for (const specifier of node.specifiers) {
          if (
            specifier.type === "ImportSpecifier" &&
            propertyName(specifier.imported) === "createActor" &&
            node.importKind !== "type" &&
            specifier.importKind !== "type"
          )
            rawActors.push(specifier);
        }
      },
      CallExpression(node) {
        const reference = importReference(context, node.callee) ?? "";
        if (
          /^xstate(?:-v[^.]*)?\.createActor$/u.test(reference) &&
          node.callee.type === "MemberExpression"
        )
          rawActors.push(node);
        if (!reference.startsWith("effect.Effect.")) return;
        let parent = node.parent;
        while (parent && parent.type !== "Program") {
          if (
            parent.type === "ArrowFunctionExpression" ||
            parent.type === "FunctionExpression"
          ) {
            const call = parent.parent;
            if (
              call?.type === "CallExpression" &&
              isEnqueue(context, call.callee)
            )
              context.report({ node, messageId: "inlineEffect" });
            return;
          }
          parent = parent.parent;
        }
      },
      "Program:exit"() {
        if (usesEffectActors)
          for (const node of rawActors)
            context.report({ node, messageId: "rawActor" });
      },
    };
  },
});
