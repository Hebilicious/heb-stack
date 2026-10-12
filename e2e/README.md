# Browser evidence

Two Playwright scenarios against the built page served by `alchemy dev` on a free port, in Chromium with WebMCP enabled. In `check.e2e.ts`, a check travels over capnweb and the history survives a reload. In `webmcp.e2e.ts`, an agent in the page calls `primes.next` through `document.modelContext`. `moon run e2e:test` runs both.
