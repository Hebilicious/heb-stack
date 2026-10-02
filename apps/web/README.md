# Web

The prime checker page: Vue 3.6 in Vapor mode, built by Vite and vize, styled with cssforge tokens.

The check lifecycle comes from `primes.check`'s snapshot through an `@effect/atom-vue` atom; the page keeps only its draft and notices. `moon run web:build` writes `dist`, which the Worker serves. `moon run web:manifest` derives the WebMCP manifest into `public/`.
