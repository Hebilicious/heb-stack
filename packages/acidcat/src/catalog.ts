import { primeDefinitions } from "@heb-stack/primes";

/** Canonical pure descriptor tree; importing it acquires no application services. */
export const definitions = { ...primeDefinitions };

type DescriptorIds<Tree> = Tree extends {
  readonly id: infer Id extends string;
  readonly load: unknown;
}
  ? Id
  : { [Key in keyof Tree]: DescriptorIds<Tree[Key]> }[keyof Tree];

/** Literal IDs from the sole descriptor tree, without a second registry. */
export type CapabilityId = DescriptorIds<typeof definitions>;
