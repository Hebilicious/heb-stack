/** Thrown by a step that decides not to run; the scenario reports it as skipped. */
export class SkippedStepError extends Error {
  public constructor(message = "Step was skipped") {
    super(message);
    this.name = "SkippedStepError";
  }
}
