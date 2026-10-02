import { defineRule } from "@oxlint/plugins";
import { applicationImport, applicationOwner, isRoot, moduleReferences } from "../ast.ts";

/** Application packages are private to their owner and root composition, including Product Promise callers. */
export const noApplicationBypassRule = defineRule({
  meta: {
    type: "problem",
    docs: { description: "Route application consumers through the sole AcidCat root interface." },
    messages: {
      bypass:
        "Consume AcidCat root handles from @heb-stack/acidcat. Only packages/acidcat/src composes application packages; cross-domain work uses semantic Context services wired there. Pure domain/mechanism imports remain available.",
    },
  },
  create(context) {
    if (isRoot(context.filename)) return {};
    return moduleReferences((source, node) => {
      const importedOwner = applicationImport(source, context.filename);
      if (!importedOwner) return;
      if (source.startsWith(".") && importedOwner === applicationOwner(context.filename)) return;
      context.report({ node, messageId: "bypass" });
    });
  },
});
