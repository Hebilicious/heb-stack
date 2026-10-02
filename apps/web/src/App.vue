<script setup lang="ts" vapor>
import { AsyncResult, Atom, useAtomValue } from "@effect/atom-vue";
import type { HistoryEntry } from "@heb-stack/acidcat/primes";
import { Effect, Option } from "effect";
import { computed, shallowRef, watch } from "vue";
import { checkedAtLabel, checkLine, draftNumber } from "./presentation.ts";
import { useAcidCat } from "./root.ts";
import { useSnapshot } from "./use-snapshot.ts";

const root = useAcidCat();
const { check, next } = root.catalog.primes;
const history = root.catalog.history;
if (check.snapshot === undefined) throw new Error("primes.check publishes no lifecycle snapshot");
const lifecycle = useSnapshot(check.snapshot);
const webmcp = root.webmcp === null ? null : useSnapshot(root.webmcp.snapshot);

const draft = shallowRef("");
const notice = shallowRef<string | null>(null);
const historyRevision = shallowRef(0);

const line = computed(() => checkLine(lifecycle.value));
const draftValue = computed(() => draftNumber(draft.value));
const retryable = computed(
  () => lifecycle.value.status === "failed" && lifecycle.value.failure?._tag === "CheckUnanswered",
);

// A check that answers adds to the history, whoever asked: this page, or an agent through WebMCP.
watch(lifecycle, (snapshot) => {
  if (snapshot.status === "result") historyRevision.value += 1;
});

const historyQuery = computed(() => {
  const revision = historyRevision.value;
  return Atom.make(
    Effect.tryPromise({
      try: (signal) => history.list.execute({}, { signal }),
      catch: () => "The history could not be read.",
    }).pipe(Effect.map((result) => ({ revision, result }))),
  );
});
const historyState = useAtomValue(() => historyQuery.value);
// The last list that answered stays on screen while the next one loads.
const entries = computed<readonly HistoryEntry[]>((previous) => {
  const loaded = Option.getOrNull(AsyncResult.value(historyState.value));
  if (loaded === null) return previous ?? [];
  return loaded.result.ok ? loaded.result.value.entries : [];
});

const webmcpLine = computed(() => {
  if (webmcp === null) return "This browser exposes no model context, so no WebMCP tools are registered.";
  const status = webmcp.value;
  return status.phase === "ready"
    ? "The capability catalog is registered as WebMCP tools."
    : `WebMCP: ${status.phase}${status.message === null ? "" : ` — ${status.message}`}`;
});

/** The lifecycle shows the outcome; a call another call replaced, or one that failed, needs nothing more here. */
function ask(n: number): void {
  notice.value = null;
  check.execute({ n }).catch(() => undefined);
}

function onInput(event: Event): void {
  if (!(event.target instanceof HTMLInputElement)) return;
  draft.value = event.target.value;
  const n = draftNumber(draft.value);
  if (n !== null) ask(n);
}

function retry(): void {
  const n = lifecycle.value.n;
  if (n !== null) ask(n);
}

function askNext(): void {
  const after = draftValue.value;
  if (after === null) return;
  notice.value = null;
  next.execute({ after }).then(
    (result) => {
      if (!result.ok) {
        notice.value = `There is no next prime to show; enter a number from ${result.error.min} to ${result.error.max}.`;
        return;
      }
      draft.value = String(result.value.prime);
      ask(result.value.prime);
    },
    () => {
      notice.value = "The next prime could not be found. Try again.";
    },
  );
}

function clear(): void {
  history.clear.execute({}).then(
    (result) => {
      if (result.ok) historyRevision.value += 1;
      else notice.value = `The history could not be cleared: ${result.error.reason}`;
    },
    () => {
      notice.value = "The history could not be cleared. Try again.";
    },
  );
}

function entryLine(entry: HistoryEntry): string {
  return `${String(entry.n)} ${entry.prime ? "is prime" : "is composite"}`;
}
</script>

<template>
  <main class="page">
    <h1 class="title">Prime checker</h1>
    <label class="field">
      <span class="label">Number</span>
      <input
        class="input"
        :value="draft"
        inputmode="numeric"
        autocomplete="off"
        placeholder="97"
        aria-label="Number"
        @input="onInput"
      />
    </label>
    <p class="result" :data-status="lifecycle.status" role="status" aria-live="polite">{{ line }}</p>
    <div class="actions">
      <button class="button" type="button" :disabled="draftValue === null" @click="askNext">Next prime</button>
      <button v-if="retryable" class="button" type="button" @click="retry">Retry</button>
    </div>
    <p v-if="notice !== null" class="notice" role="alert">{{ notice }}</p>
    <section class="history" aria-labelledby="history-title">
      <header class="history-header">
        <h2 id="history-title" class="subtitle">History</h2>
        <button class="button quiet" type="button" :disabled="entries.length === 0" @click="clear">Clear</button>
      </header>
      <ol v-if="entries.length > 0" class="entries" aria-label="Checks">
        <li v-for="entry in entries" :key="`${entry.checkedAt}-${entry.n}`" class="entry" :data-prime="entry.prime">
          <span>{{ entryLine(entry) }}</span>
          <time class="time" :datetime="entry.checkedAt">{{ checkedAtLabel(entry.checkedAt) }}</time>
        </li>
      </ol>
      <p v-else class="empty">No checks yet.</p>
    </section>
    <footer class="footer">{{ webmcpLine }}</footer>
  </main>
</template>
