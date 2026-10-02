import "virtual:cssforge.css";
import "./page.css";
import { AtomRegistry, registryKey } from "@effect/atom-vue";
import { createBrowserAcidCat } from "@heb-stack/browser-runtime";
import { createVaporApp } from "vue";

import App from "./app.vue";
import { acidCatKey } from "./root.ts";
import { vaporComponent } from "./vapor.ts";

const root = await createBrowserAcidCat({
  document,
  origin: location.origin,
  storage: localStorage,
});
const app = createVaporApp(vaporComponent(App));
app.provide(registryKey, AtomRegistry.make());
app.provide(acidCatKey, root);
app.mount("#app");
