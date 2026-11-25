/**
 * The experimental WebMCP host API Chromium exposes on `document` behind `--enable-features=WebMCP`, as far as these
 * scenarios call it. A tool's input crosses the API as an object, and its answer as JSON text.
 */
interface ModelContextTool {
  readonly name: string;
  readonly description: string;
}

/** A JSON value, as a tool's arguments hold them. */
type ToolArgument =
  | string
  | number
  | boolean
  | null
  | readonly ToolArgument[]
  | { readonly [key: string]: ToolArgument };

/** The arguments a tool's input schema describes, as one object. */
type ToolArguments = Readonly<Record<string, ToolArgument>>;

interface ModelContext {
  readonly getTools: () => Promise<readonly ModelContextTool[]>;
  readonly executeTool: (
    tool: ModelContextTool,
    input: ToolArguments
  ) => Promise<string>;
}

interface Document {
  readonly modelContext?: ModelContext;
}
