import "virtual:cssforge.css";
import "./page.css";
import { AtomRegistry, registryKey } from "@effect/atom-vue";
import { createBrowserAcidCat } from "@heb-stack/browser-runtime";
import { createVaporApp } from "vue";
import App from "./App.vue";
import { acidCatKey } from "./root.ts";
import { vaporComponent } from "./vapor.ts";

const root = await createBrowserAcidCat({ origin: location.origin, storage: localStorage, document });
const app = createVaporApp(vaporComponent(App));
app.provide(registryKey, AtomRegistry.make());
app.provide(acidCatKey, root);
app.mount("#app");
