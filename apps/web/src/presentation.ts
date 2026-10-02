import type { CheckSnapshot } from "@heb-stack/acidcat/primes";

/** What the page says about the lifecycle's current state. */
export function checkLine(snapshot: CheckSnapshot): string {
  if (snapshot.status === "idle") return "Type a whole number to check it.";
  if (snapshot.status === "checking") return `Checking ${String(snapshot.n)}…`;
  const { answer, failure } = snapshot;
  if (answer !== null)
    return answer.prime
      ? `${String(answer.n)} is prime`
      : `${String(answer.n)} = ${String(answer.smallestFactor)} × ${String(answer.n / answer.smallestFactor)}`;
  if (failure?._tag === "OutOfRange") return `Enter a whole number from ${failure.min} to ${failure.max}.`;
  return "The check did not answer.";
}

/** The number a draft names, or `null` when it is not a whole number a check can carry. */
export function draftNumber(draft: string): number | null {
  const trimmed = draft.trim();
  if (!/^-?\d+$/u.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isSafeInteger(value) ? value : null;
}
