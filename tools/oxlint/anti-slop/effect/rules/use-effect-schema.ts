import { defineRule, type ESTree } from "@oxlint/plugins";
import { isApplication, moduleReferences, normalizedPath, propertyName } from "../ast.ts";

const COMPETING_SCHEMA_LIBRARIES = /^(?:valibot|zod|ajv|yup|joi|@sinclair\/typebox)(?:\/|$)/u;
const TEST_OR_EVIDENCE_FILE = /(?:^|\/)(?:features|test|tests)\/|\.(?:test|spec)\.[cm]?[jt]sx?$/u;
const JSON_TYPES = new Set(["object", "array", "string", "number", "integer", "boolean", "null"]);

function isJsonSchema(node: ESTree.ObjectExpression): boolean {
  return node.properties.some((property) => {
    if (property.type !== "Property") return false;
    const key = propertyName(property.key);
    if (["$schema", "$defs", "$ref"].includes(key ?? "")) return true;
    return (
      key === "type" &&
      property.value.type === "Literal" &&
      typeof property.value.value === "string" &&
      JSON_TYPES.has(property.value.value)
    );
  });
}

/** One Effect Schema is the source for decoding, types, machine assertions, and generated JSON Schema. */
export const useEffectSchemaRule = defineRule({
  meta: {
    type: "problem",
    docs: { description: "Use Effect Schema and derive the external JSON Schema contract." },
    messages: {
      competingSchema:
        "Use Effect Schema for capability contracts and decoding. Derive types and typed failures from those schemas; standardSchemaValidator() may assert the same schemas at the XState boundary.",
      manualJson:
        "Decode this untrusted JSON boundary with Schema.fromJsonString and a semantic Effect Schema instead of JSON.parse.",
      authoredSchema:
        "Derive JSON Schema from the canonical Effect Schema in the manifest build. Do not author a second schema or capability contract by hand.",
    },
  },
  create(context) {
    const capability = isApplication(context.filename);
    let importsEffect = capability;
    const competingImports: ESTree.Node[] = [];
    const manualJsonCalls: ESTree.CallExpression[] = [];
    const isTestOrEvidence = TEST_OR_EVIDENCE_FILE.test(normalizedPath(context.filename));
    return {
      ...moduleReferences((source, node) => {
        if (source === "effect" || source.startsWith("effect/")) importsEffect = true;
        if (COMPETING_SCHEMA_LIBRARIES.test(source)) competingImports.push(node);
      }),
      ObjectExpression(node) {
        if (capability && isJsonSchema(node)) context.report({ node, messageId: "authoredSchema" });
      },
      CallExpression(node) {
        if (isTestOrEvidence) return;
        const callee = node.callee;
        if (
          callee.type === "MemberExpression" &&
          callee.object.type === "Identifier" &&
          callee.object.name === "JSON" &&
          propertyName(callee.property) === "parse"
        )
          manualJsonCalls.push(node);
      },
      "Program:exit"() {
        if (!importsEffect) return;
        for (const node of competingImports) context.report({ node, messageId: "competingSchema" });
        for (const node of manualJsonCalls) context.report({ node, messageId: "manualJson" });
      },
    };
  },
});
