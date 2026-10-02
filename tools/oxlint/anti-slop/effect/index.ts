import { eslintCompatPlugin } from "@oxlint/plugins";

import { noEffectPortsRule } from "./rules/no-effect-ports.ts";
import { noXstatePromiseActorsWithEffectRule } from "./rules/no-xstate-promise-actors-with-effect.ts";
import { requireXstateV6Rule } from "./rules/require-xstate-v6.ts";
import { useAtomRuntimeInVueRule } from "./rules/use-atom-runtime-in-vue.ts";
import { useEffectSchemaRule } from "./rules/use-effect-schema.ts";
import { useEffectActorHostRule } from "./rules/use-effect-actor-host.ts";
import { noManualEffectErrorTagRule } from "./rules/no-manual-effect-error-tag.ts";
import { noManualEffectRuntimeInEvidenceRule } from "./rules/no-manual-effect-runtime-in-evidence.ts";
import { noManualTagComparisonRule } from "./rules/no-manual-tag-comparison.ts";
import { noManualTaggedConstructionRule } from "./rules/no-manual-tagged-construction.ts";
import { noServiceConstructorImportsRule } from "./rules/no-service-constructor-imports.ts";
import { preferEffectMatchRule } from "./rules/prefer-effect-match.ts";

import { noApplicationBypassRule } from "./rules/no-application-bypass.ts";
import { requireEffectComputationsRule } from "./rules/require-effect-computations.ts";
import { requireMachineFilesRule, requireCapabilityFilesRule } from "./rules/require-definition-files.ts";

/** Native conventions for the unified AcidCat/Effect architecture. */
const antiSlopEffectPlugin = eslintCompatPlugin({
  meta: { name: "anti-slop-effect" },
  rules: {
    "require-machine-files": requireMachineFilesRule,
    "require-capability-files": requireCapabilityFilesRule,
    "no-application-bypass": noApplicationBypassRule,
    "require-effect-computations": requireEffectComputationsRule,
    "no-effect-ports": noEffectPortsRule,
    "no-xstate-promise-actors-with-effect": noXstatePromiseActorsWithEffectRule,
    "require-xstate-v6": requireXstateV6Rule,
    "use-atom-runtime-in-vue": useAtomRuntimeInVueRule,
    "use-effect-schema": useEffectSchemaRule,
    "use-effect-actor-host": useEffectActorHostRule,
    "no-manual-effect-error-tag": noManualEffectErrorTagRule,
    "no-manual-effect-runtime-in-evidence": noManualEffectRuntimeInEvidenceRule,
    "no-manual-tag-comparison": noManualTagComparisonRule,
    "no-manual-tagged-construction": noManualTaggedConstructionRule,
    "no-service-constructor-imports": noServiceConstructorImportsRule,
    "prefer-effect-match": preferEffectMatchRule,
  },
});

export default antiSlopEffectPlugin;
