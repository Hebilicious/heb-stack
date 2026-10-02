/** Thrown by a step that is written but not yet implemented; the scenario reports it as pending. */
export class PendingStepError extends Error {
  public constructor(message = "Step is pending") {
    super(message);
    this.name = "PendingStepError";
  }
}
