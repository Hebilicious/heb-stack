export type { Handles, WebMcp } from "@acid-cat/core-effect";
export type { Availability, Result } from "@acid-cat/spec-ts";
export { app, capabilityIds, type SessionTarget } from "./catalog.ts";
export {
  acidCatLayer,
  openAcidCat,
  type AcidCat,
  type AcidCatOptions,
  type AcidCatServices,
} from "./root.ts";
export {
  openSession,
  type OpenSession,
  type SessionOptions,
  type WebMcpRegistration,
} from "./session.ts";
