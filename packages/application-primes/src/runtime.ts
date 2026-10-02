/** The domain's owners and services, for the root composition alone. */
export { CheckHistory, PrimeMath } from "./services.ts";
export { PrimeChecker, primeCheckerLayer, CheckSnapshotSchema, type CheckSnapshot } from "./checker.ts";
export { primeMathWasmLayer, primesWasm, type PrimesWasm } from "./wasm-port.ts";
export type { CheckFailure } from "./check-machine.ts";
export { checkHistoryLayer, type HistoryText } from "./history-store.ts";
