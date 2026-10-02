// Alchemy's Worker bundler uploads `.wasm` imports as compiled modules, so workerd compiles them once per isolate.
declare module "*.wasm" {
  const module: WebAssembly.Module;
  export default module;
}
