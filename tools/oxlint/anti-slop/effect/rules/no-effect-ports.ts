import { defineRule } from "@oxlint/plugins";

/** Effect requirements must carry semantic Context service names instead of structural Port names. */
export const noEffectPortsRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow interfaces named *Port whose contract returns Effect values.",
    },
    messages: {
      effectPort:
        "Replace this Effect-returning Port with a semantic Context.Service. Let Effect<A, E, R> name the requirement and provide implementations with Layers.",
    },
  },
  create(context) {
    return {
      TSInterfaceDeclaration(node) {
        if (!node.id.name.endsWith("Port")) return;
        if (!/\bEffect\.Effect\s*</u.test(context.sourceCode.getText(node))) return;
        context.report({ node: node.id, messageId: "effectPort" });
      },
    };
  },
});
