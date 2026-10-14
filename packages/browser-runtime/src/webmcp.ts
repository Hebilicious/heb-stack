import type { WebMcp } from "@heb-stack/acidcat";
import { Predicate } from "effect";

/**
 * BOUNDARY: The WebMCP host the document exposes, `document.modelContext` first and `navigator.modelContext` second,
 * or `undefined` when neither has a callable `registerTool`. The binding never reads what `registerTool` returns.
 */
export function discoverModelContext(
  documentValue: unknown
): WebMcp.ModelContext | undefined {
  const view = Predicate.hasProperty(documentValue, "defaultView")
    ? documentValue.defaultView
    : undefined;
  const navigator = Predicate.hasProperty(view, "navigator")
    ? view.navigator
    : undefined;
  return modelContextOf(documentValue) ?? modelContextOf(navigator);
}

/** BOUNDARY: An experimental host API is a model context only when its `registerTool` is callable. */
function modelContextOf(value: unknown): WebMcp.ModelContext | undefined {
  if (!Predicate.hasProperty(value, "modelContext")) {
    return undefined;
  }
  const context = value.modelContext;
  if (
    !Predicate.hasProperty(context, "registerTool") ||
    !Predicate.isFunction(context.registerTool)
  ) {
    return undefined;
  }
  const register = context.registerTool;
  return {
    registerTool: (tool, options) => {
      // The binding never reads what the host answers, whatever it is.
      const answer: unknown = register.call(context, tool, options);
      return answer;
    },
  };
}
