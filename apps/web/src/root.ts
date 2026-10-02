import type { BrowserAcidCat } from "@heb-stack/browser-runtime";
import { inject } from "vue";
import type { InjectionKey } from "vue";

/** The page's one AcidCat session, provided by the entry point. */
export const acidCatKey: InjectionKey<BrowserAcidCat> =
  Symbol("heb-stack-acidcat");

export function useAcidCat(): BrowserAcidCat {
  const root = inject(acidCatKey);
  if (root === undefined) {
    throw new Error("The page's AcidCat session was not provided");
  }
  return root;
}
