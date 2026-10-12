# Vendored anti-slop rules

Vendored from `dmmulroy/anti-slop` at commit `c44ef22`, under the MIT license in `LICENSE`. `vendor/eslint-stylistic/` is ESLint Stylistic code that upstream vendors in turn; its own `UPSTREAM.md` and `LICENSE` sit beside it.

This repository deliberately receives storage, network, worker, URL, and imported-file data as `unknown` and validates it at explicit boundaries. The vendored rules therefore accept documented `BOUNDARY:` exceptions for those contracts through the `allowWithBoundaryComment` option, which `shared/boundary-comment.ts` implements once. `no-known-value-widening` accepts the exception on the type guard itself, so a guard that revalidates migrated records or typed caller input says so where it is declared. `typeof` is permitted inside type guards. Necessary assertions require an adjacent, evidence-bearing `SAFETY:` comment.

The registered Effect-specific plugin keeps XState transition ownership separate from Effect execution, requires semantic Context services instead of Effect-returning Port interfaces, keeps expected failures as plain tagged data, and requires Effect Schema rather than competing validators or manual production JSON parsing in Effect modules. Tagged values are built with their schema's `.make` (a union exposes one per case through `Schema.toTaggedUnion`) and branched with `Option.isSome`, `Predicate.isTagged`, or `Match`.

Some vendored rules are registered but not enabled in `oxlint.config.ts`:

| Rule | Why it is off |
| --- | --- |
| `anti-slop-effect/no-service-constructor-imports` | It flags every imported `make*` function, including pure value constructors, until capability modules follow its naming convention. |
| `anti-slop-effect/prefer-effect-match` | Chained literal ternaries here read better as lookup tables than as `Match`. |
| `anti-slop/no-array-filter-map` | It rewrites readable `filter`/`map` chains for an allocation cost no measurement has shown. |
| `anti-slop/require-readable-spacing` | Its blank-line policy is a style choice this template leaves to the project that adopts it. |

Definition placement rules resolve imported and local aliases to XState machine factories and AcidCat capability constructors. Machines belong in `machine.ts`, `*-machine.ts`, or `*.machine.ts`; capabilities belong in `capabilities.ts`, `*-capability.ts`, or `*.capabilities.ts`. Type references, unrelated methods, and evidence fixtures do not define production machines or capabilities.

`no-manual-effect-runtime-in-evidence` keeps `Effect.run*` and `ManagedRuntime.make` out of evidence files: a Gherkin step returns its Effect and the runner runs it in the scenario's Scope, and plain Vitest evidence uses the `testEffect` helper in `features/support`.

`no-module-level-mutable-state` keeps headless and Worker modules free of module-level `let` and `var`, which every request an isolate serves and every session an owner hosts would share. Browser presentation, tooling, and evidence files are exempt in `oxlint.config.ts`.

## Taking upstream changes

Our local edits are the `BOUNDARY:` options, `no-wall-clock-budget`, `no-module-level-mutable-state`, `no-manual-effect-runtime-in-evidence`, the repository-specific Effect rules, and three semantic changes: `no-runtime-typeof` exempts closures nested anywhere inside a type guard, `no-unknown-parameters` with `allowInTypeGuards` skips every parameter of a type guard, and `shared/lexical-type-parameters.ts` reads only own properties. To take a newer upstream commit, format the upstream `src/` trees at the old and new commits with this repository's `oxfmt`, then `git merge-file` each vendored file against them, so formatting does not register as a conflict. Copy every file upstream adds, license and provenance files included.
