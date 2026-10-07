import { dirname, resolve } from "node:path";

import type { Context, ESTree, Visitor } from "@oxlint/plugins";

export function propertyName(node: ESTree.Node): string | undefined {
  if (node.type === "Identifier") return node.name;
  if (node.type === "Literal" && typeof node.value === "string")
    return node.value;
  return undefined;
}

/** Resolve the lexical import binding, including aliases and namespace members, without matching shadowed names. */
export function importReference(
  context: Context,
  node: ESTree.Node,
  includeTypes = false
): string | undefined {
  if (node.type === "TSQualifiedName") {
    const owner = importReference(context, node.left, includeTypes);
    return owner ? `${owner}.${node.right.name}` : undefined;
  }
  if (node.type === "MemberExpression") {
    const owner = importReference(context, node.object, includeTypes);
    const member =
      !node.computed || node.property.type === "Literal"
        ? propertyName(node.property)
        : undefined;
    return owner && member ? `${owner}.${member}` : undefined;
  }
  if (node.type !== "Identifier") return undefined;
  let scope: ReturnType<typeof context.sourceCode.getScope> | null =
    context.sourceCode.getScope(node);
  while (scope) {
    const binding = scope.set.get(node.name);
    if (binding) {
      const definition = binding.defs.find(
        (entry) => entry.type === "ImportBinding"
      );
      const specifier = definition?.node;
      const declaration = specifier?.parent;
      if (
        !specifier ||
        declaration?.type !== "ImportDeclaration" ||
        (!includeTypes && declaration.importKind === "type")
      )
        return undefined;
      const source = declaration.source.value.replace(/^effect\//u, "effect.");
      if (specifier.type === "ImportNamespaceSpecifier") return source;
      if (specifier.type === "ImportDefaultSpecifier") return source;
      if (
        specifier.type === "ImportSpecifier" &&
        (includeTypes || specifier.importKind !== "type")
      )
        return `${source}.${propertyName(specifier.imported)}`;
      return undefined;
    }
    scope = scope.upper;
  }
  return undefined;
}

/** Import/reexport/dynamic-import sites share the same native AST policy. */
export function moduleReferences(
  visit: (source: string, node: ESTree.Node) => void
): Visitor {
  return {
    ImportDeclaration(node) {
      visit(node.source.value, node.source);
    },
    TSImportType(node) {
      visit(node.source.value, node.source);
    },
    TSExternalModuleReference(node) {
      visit(node.expression.value, node.expression);
    },
    ExportNamedDeclaration(node) {
      if (node.source) visit(node.source.value, node.source);
    },
    ExportAllDeclaration(node) {
      visit(node.source.value, node.source);
    },
    ImportExpression(node) {
      if (
        node.source.type === "Literal" &&
        typeof node.source.value === "string"
      )
        visit(node.source.value, node.source);
      if (
        node.source.type === "TemplateLiteral" &&
        node.source.expressions.length === 0
      ) {
        const source = node.source.quasis[0]?.value.cooked;
        if (source !== undefined && source !== null) visit(source, node.source);
      }
    },
  };
}

export function normalizedPath(filename: string): string {
  return filename.replaceAll("\\", "/");
}
export function isRoot(filename: string): boolean {
  return /(?:^|\/)packages\/acidcat\/src\//u.test(normalizedPath(filename));
}
/**
 * The AcidCat domain packages and their npm scope, declared once in the lint config:
 * `settings: { acidcat: { scope: "@heb-stack", domains: ["primes"] } }`. A domain package lives at
 * `packages/<domain>` and is published as `<scope>/<domain>`.
 */
interface AcidCatSettings {
  readonly scope: string;
  readonly domains: readonly string[];
}

/* BOUNDARY: Lint settings are untyped configuration; anything malformed declares no domain. */
function acidCatSettings(context: Context): AcidCatSettings {
  const settings: unknown = context.settings;
  const acidcat: unknown =
    typeof settings === "object" && settings !== null && "acidcat" in settings
      ? settings.acidcat
      : undefined;
  if (typeof acidcat !== "object" || acidcat === null)
    return { domains: [], scope: "" };
  const scope =
    "scope" in acidcat && typeof acidcat.scope === "string"
      ? acidcat.scope
      : "";
  const declared: unknown = "domains" in acidcat ? acidcat.domains : [];
  const domains = Array.isArray(declared)
    ? declared.filter((domain): domain is string => typeof domain === "string")
    : [];
  return { domains, scope };
}

function escape(text: string): string {
  return text.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

/** The domain package a path sits in, such as `packages/primes`, or `undefined`. */
export function applicationOwner(
  context: Context,
  filename: string
): string | undefined {
  const path = normalizedPath(filename);
  return acidCatSettings(context)
    .domains.map((domain) => `packages/${domain}`)
    .find((owner) =>
      new RegExp(`(?:^|/)${escape(owner)}(?:/|$)`, "u").test(path)
    );
}

/** Whether the file being linted is a domain package's source. */
export function isApplication(context: Context): boolean {
  const owner = applicationOwner(context, context.filename);
  return (
    owner !== undefined &&
    normalizedPath(context.filename).includes(`${owner}/src/`)
  );
}

/** The domain package an import reaches, by package name or by relative path, or `undefined`. */
export function applicationImport(
  context: Context,
  source: string
): string | undefined {
  const { domains, scope } = acidCatSettings(context);
  const named = domains.find(
    (domain) =>
      source === `${scope}/${domain}` ||
      source.startsWith(`${scope}/${domain}/`)
  );
  if (named !== undefined) return `packages/${named}`;
  return applicationOwner(
    context,
    source.startsWith(".") ? resolve(dirname(context.filename), source) : source
  );
}
