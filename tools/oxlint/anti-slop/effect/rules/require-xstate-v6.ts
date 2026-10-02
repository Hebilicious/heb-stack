import { defineRule } from "@oxlint/plugins";

import { moduleReferences } from "../ast.ts";

/** One canonical package resolves the paired core; aliases cannot establish a second actor ecosystem. */
export const requireXstateV6Rule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Reject legacy XState core aliases in all repository imports.",
    },
    messages: {
      legacyCore:
        'Import the paired v6 core from "xstate". Remove legacy xstate-v6/xstate-v6-pr5687 aliases; the root dependency override owns the single core version.',
    },
  },
  create(context) {
    return moduleReferences((source, node) => {
      if (/^xstate-v[^/]*(?:\/|$)/u.test(source))
        context.report({ node, messageId: "legacyCore" });
    });
  },
});
