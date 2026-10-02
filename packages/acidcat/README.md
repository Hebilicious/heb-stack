# @heb-stack/acidcat

AcidCat (Application Capability Identification Category) is the application interface. This package is its root: the only package that composes domain packages into the one catalog.

`createAcidCat({ target }, services)` builds a session over the Layers a host supplies (`PrimeMath`, and `CheckHistory` when the host keeps one) and binds every leaf for that target. A leaf outside the target's audience is never available, so it is absent from every listing and refused by name. External callers use `invokeExternal`, which decodes untrusted input with the leaf's schema and answers a typed `Result`.

- `@heb-stack/acidcat/catalog` exports the pure definition tree, for build tools such as the WebMCP manifest.
- `@heb-stack/acidcat/primes` exports the services and contracts a host needs to supply, never the owners.
