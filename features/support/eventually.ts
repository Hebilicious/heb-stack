/**
 * Waiting on in-process work in component evidence.
 *
 * The work a component scenario waits for is deterministic and always
 * completes; how long it takes depends on how busy the machine is. So a wait
 * polls for its condition, and its deadline is a hang guard far above any
 * healthy latency rather than a pace the work has to keep.
 *
 * Unlike `vi.waitFor`, polling runs on the real event loop and never advances
 * fake timers, so a scenario's fake clock stays exactly where its steps put it.
 */

/** The hang guard for one in-process wait. A healthy wait settles in milliseconds. */
export const IN_PROCESS_WAIT_GUARD_MS = 10_000;

const POLL_INTERVAL_MS = 10;

// Captured when the module loads, before any scenario installs fake timers.
const realSetTimeout = globalThis.setTimeout.bind(globalThis);
const now = performance.now.bind(performance);

/** Resolves once `assertion` stops throwing, or rethrows its last error after the guard. */
export async function eventually(assertion: () => void | Promise<void>): Promise<void> {
  const deadline = now() + IN_PROCESS_WAIT_GUARD_MS;
  for (;;) {
    try {
      await assertion();
      return;
    } catch (error) {
      if (now() >= deadline) throw error;
    }
    await new Promise<void>((resolve) => realSetTimeout(resolve, POLL_INTERVAL_MS));
  }
}
