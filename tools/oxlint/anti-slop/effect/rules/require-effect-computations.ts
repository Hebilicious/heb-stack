import { defineRule, type ESTree } from "@oxlint/plugins";
import { importReference, isApplication, propertyName } from "../ast.ts";

/** Capability modules describe computations; only the root-bound executor settles external Promises. */
export const requireEffectComputationsRule = defineRule({
  meta: {
    type: "problem",
    docs: { description: "Keep capability computations in Effect with explicit typed requirements and failures." },
    messages: {
      promise:
        "Compose capability computations with Effect.gen/Effect.fn and semantic Context services. Keep Promise settlement and Effect.runPromise at the root-bound external adapter; bridge browser APIs in browser service Layers.",
    },
  },
  create(context) {
    if (!isApplication(context.filename)) return {};
    const reportAsync = (node: Extract<ESTree.Node, { async: boolean }>) => {
      if (node.async) context.report({ node, messageId: "promise" });
    };
    return {
      ArrowFunctionExpression: reportAsync,
      FunctionExpression: reportAsync,
      FunctionDeclaration: reportAsync,
      TSTypeReference(node) {
        if (node.typeName.type === "Identifier" && ["Promise", "PromiseLike"].includes(node.typeName.name))
          context.report({ node, messageId: "promise" });
      },
      NewExpression(node) {
        if (node.callee.type === "Identifier" && node.callee.name === "Promise")
          context.report({ node, messageId: "promise" });
      },
      CallExpression(node) {
        const promise =
          node.callee.type === "MemberExpression" &&
          node.callee.object.type === "Identifier" &&
          node.callee.object.name === "Promise";
        const runner = /^effect\.Effect\.runPromise(?:Exit)?$/u.test(importReference(context, node.callee) ?? "");
        if (promise || runner) context.report({ node, messageId: "promise" });
      },
      VariableDeclarator(node) {
        // Aliasing the Promise constructor must not erase the computation boundary.
        if (node.init?.type === "Identifier" && propertyName(node.init) === "Promise")
          context.report({ node, messageId: "promise" });
      },
    };
  },
});
