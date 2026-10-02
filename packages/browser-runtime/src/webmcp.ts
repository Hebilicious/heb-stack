import type { AcidCat, ModelContextPort } from "@heb-stack/acidcat";
import { Predicate } from "effect";

/** Where the build publishes the manifest the page registers tools from. */
export const MANIFEST_PATH = "/acidcat-manifest.generated.json";

/** BOUNDARY: Validate the optional host API before fetching schemas or loading the adapter. */
export async function connectBrowserWebMcp(
  root: AcidCat,
  documentValue: unknown
) {
  const port =
    discoverModelContext(documentValue) ??
    discoverNavigatorModelContext(documentValue);
  if (port === null) {
    return null;
  }
  return await root.installWebMcp(port, async (signal) => {
    const response = await fetch(MANIFEST_PATH, { signal });
    if (!response.ok) {
      throw new Error("Tool registration metadata could not be loaded");
    }
    const manifest: unknown = await response.json();
    return manifest;
  });
}

/** BOUNDARY: Discover the native navigator API that earlier Chromium versions expose. */
function discoverNavigatorModelContext(
  documentValue: unknown
): ModelContextPort | null {
  if (!Predicate.hasProperty(documentValue, "defaultView")) {
    return null;
  }
  const view = documentValue.defaultView;
  return Predicate.hasProperty(view, "navigator")
    ? discoverModelContext(view.navigator)
    : null;
}

/** BOUNDARY: Experimental host callability and return values are validated here. */
function discoverModelContext(value: unknown): ModelContextPort | null {
  if (!Predicate.hasProperty(value, "modelContext")) {
    return null;
  }
  const context = value.modelContext;
  if (
    !Predicate.hasProperty(context, "registerTool") ||
    !Predicate.isFunction(context.registerTool)
  ) {
    return null;
  }
  const register = context.registerTool;
  return {
    registerTool: async (tool, options) => {
      const result: unknown = await register.call(context, tool, options);
      if (result !== undefined) {
        throw new TypeError("WebMCP registration returned an unexpected value");
      }
    },
  };
}
