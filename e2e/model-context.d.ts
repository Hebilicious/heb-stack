/**
 * The experimental WebMCP host API Chromium exposes on `document` behind `--enable-features=WebMCP`, as far as these
 * scenarios call it. A tool's input and answer cross the API as JSON text.
 */
interface ModelContextTool {
  readonly name: string;
  readonly description: string;
}

interface ModelContext {
  readonly getTools: () => Promise<readonly ModelContextTool[]>;
  readonly executeTool: (
    tool: ModelContextTool,
    input: string
  ) => Promise<string>;
}

interface Document {
  readonly modelContext?: ModelContext;
}
