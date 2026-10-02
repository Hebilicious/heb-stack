import { servesTarget, walkCatalogEntries, type Catalog, type SessionTarget } from "@heb-stack/acidcat";

/** One capability as the command line lists it. */
export interface CommandCatalogEntry {
  readonly id: string;
  readonly domain: string;
  readonly description: string;
}

/**
 * The kernel's catalog walk, kept to the leaves this target serves and sorted by id. A new leaf needs no change here:
 * its own audience decides whether the command line lists it.
 */
export function commandCatalogEntries(catalog: Catalog, target: SessionTarget): readonly CommandCatalogEntry[] {
  return walkCatalogEntries(catalog)
    .filter(({ capability }) => servesTarget(capability.audience, target))
    .map(({ domain, capability }) => ({ id: capability.id, domain, description: capability.description }))
    .sort((left, right) => left.id.localeCompare(right.id));
}
