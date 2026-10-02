import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";

/**
 * Evidence runs Effects through its harness: a Gherkin step returns the Effect and the runner runs it in the
 * scenario's Scope, and `node:test` evidence uses the harness helper beside it. Each hand-built runtime wires its own
 * services, clock, and scope, and a forgotten `Effect.scoped` leaks without failing anything.
 */

const evidenceFilePattern = /(?:^|\/)[^/]+\.(?:test|spec|manifest|graph)\.ts$/u;

const EFFECT_RUNNERS = new Set([
  "runCallback",
  "runCallbackWith",
  "runFork",
  "runForkWith",
  "runPromise",
  "runPromiseExit",
  "runPromiseExitWith",
  "runPromiseWith",
  "runSync",
  "runSyncExit",
  "runSyncExitWith",
  "runSyncWith",
]);

function manualRunner(callee: ESTree.Node): string | null {
  if (callee.type !== "MemberExpression" || callee.computed) return null;
  if (
    callee.object.type !== "Identifier" ||
    callee.property.type !== "Identifier"
  )
    return null;
  const owner = callee.object.name;
  const method = callee.property.name;
  if (owner === "Effect" && EFFECT_RUNNERS.has(method))
    return `Effect.${method}`;
  if (owner === "ManagedRuntime" && method === "make")
    return "ManagedRuntime.make";
  return null;
}

export const noManualEffectRuntimeInEvidenceRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow running Effects or building runtimes by hand in evidence; the harness runs them.",
    },
    messages: {
      manualRunner:
        "`{{runner}}` runs an Effect by hand in evidence. Return the Effect from the Gherkin step (the runner runs it in the scenario's Scope), or use the harness helper for `node:test` evidence.",
    },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (!evidenceFilePattern.test(context.filename)) return;
        const runner = manualRunner(node.callee);
        if (runner !== null)
          context.report({
            node: node.callee,
            messageId: "manualRunner",
            data: { runner },
          });
      },
    };
  },
});
