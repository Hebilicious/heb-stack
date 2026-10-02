import { defineRule, type Context, type ESTree } from "@oxlint/plugins";

import { importReference, normalizedPath, propertyName } from "../ast.ts";

function isEvidence(filename: string): boolean {
  return /(?:^|\/)(?:type-tests|fixtures)\/|\.(?:test|spec|probe)\.[cm]?tsx?$/u.test(
    filename
  );
}

/** Follow local aliases to their initializer while respecting lexical shadowing. */
function initializer(
  context: Context,
  node: ESTree.Node
): ESTree.Node | undefined {
  if (node.type !== "Identifier") return undefined;
  let scope: ReturnType<typeof context.sourceCode.getScope> | null =
    context.sourceCode.getScope(node);
  while (scope) {
    const binding = scope.set.get(node.name);
    if (binding) {
      const definition = binding.defs.find(
        (entry) => entry.type === "Variable"
      );
      return definition?.node.type === "VariableDeclarator"
        ? (definition.node.init ?? undefined)
        : undefined;
    }
    scope = scope.upper;
  }
  return undefined;
}

function reference(
  context: Context,
  node: ESTree.Node,
  seen = new Set<ESTree.Node>()
): string | undefined {
  if (seen.has(node)) return undefined;
  seen.add(node);
  const imported = importReference(context, node);
  if (imported) return imported;
  const value = initializer(context, node);
  if (value) return reference(context, value, seen);
  if (node.type === "MemberExpression") {
    const owner = reference(context, node.object, seen);
    const member =
      !node.computed || node.property.type === "Literal"
        ? propertyName(node.property)
        : undefined;
    return owner && member ? `${owner}.${member}` : undefined;
  }
  return undefined;
}

function isSetup(
  context: Context,
  node: ESTree.Node,
  seen = new Set<ESTree.Node>()
): boolean {
  if (seen.has(node)) return false;
  seen.add(node);
  const value = initializer(context, node);
  if (value) return isSetup(context, value, seen);
  if (node.type !== "CallExpression") return false;
  const name = reference(context, node.callee);
  return name === "xstate.setup" || name === "@xstate/effect.setupEffect";
}

export const requireMachineFilesRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Keep XState machine definitions in identifiable machine files.",
    },
    messages: {
      placement:
        "Define machines in machine.ts, *-machine.ts, or *.machine.ts.",
    },
  },
  create(context) {
    const filename = normalizedPath(context.filename);
    if (
      isEvidence(filename) ||
      /(?:^|[\/.-])machine\.[cm]?tsx?$/u.test(filename)
    )
      return {};
    return {
      CallExpression(node) {
        const callee = node.callee;
        const direct = reference(context, callee) === "xstate.createMachine";
        const configured =
          callee.type === "MemberExpression" &&
          propertyName(callee.property) === "createMachine" &&
          (!callee.computed || callee.property.type === "Literal") &&
          isSetup(context, callee.object);
        if (direct || configured)
          context.report({ node, messageId: "placement" });
      },
    };
  },
});

export const requireCapabilityFilesRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Keep AcidCat capability definitions in identifiable capability files.",
    },
    messages: {
      placement:
        "Define capabilities in capabilities.ts, *-capability.ts, or *.capabilities.ts.",
    },
  },
  create(context) {
    const filename = normalizedPath(context.filename);
    if (
      isEvidence(filename) ||
      /(?:^|[\/.-])capabilit(?:y|ies)\.[cm]?tsx?$/u.test(filename)
    )
      return {};
    return {
      CallExpression(node) {
        if (
          reference(context, node.callee) ===
          "@heb-stack/acidcat-kernel.defineCapability"
        )
          context.report({ node, messageId: "placement" });
      },
    };
  },
});
