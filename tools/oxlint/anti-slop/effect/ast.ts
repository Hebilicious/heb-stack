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
export function isApplication(filename: string): boolean {
  return /(?:^|\/)packages\/application-[^/]+\/src\//u.test(
    normalizedPath(filename)
  );
}

export function applicationOwner(filename: string): string | undefined {
  return normalizedPath(filename).match(
    /(?:^|\/)(packages\/application-[^/]+)(?:\/|$)/u
  )?.[1];
}

export function applicationImport(
  source: string,
  filename: string
): string | undefined {
  const packageName = source.match(
    /^@heb-stack\/(application-[^/]+)(?:\/|$)/u
  )?.[1];
  if (packageName) return `packages/${packageName}`;
  return applicationOwner(
    source.startsWith(".") ? resolve(dirname(filename), source) : source
  );
}
