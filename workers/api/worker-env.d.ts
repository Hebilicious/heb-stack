// The API Worker's bindings, inferred from its configuration.
type ApiWorkerConfig = typeof import("./cloudflare.config.ts");
type InferredWorkerEnv<TWorker> = import("cf/config").InferEnv<import("cf/config").UnwrapConfig<TWorker>>;

interface ApiWorkerEnv extends InferredWorkerEnv<ApiWorkerConfig["previewWorker"]> {}

declare module "*.wasm" {
  const module: WebAssembly.Module;
  export default module;
}
