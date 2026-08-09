/** High-resolution timer for per-request phase measurement. */
export class Timer {
  private readonly start = process.hrtime.bigint();
  private marks = new Map<string, number>();

  /** Milliseconds elapsed since the timer was created. */
  elapsedMs(): number {
    return Number(process.hrtime.bigint() - this.start) / 1e6;
  }

  /** Record a named mark (ms since start). */
  mark(name: string): number {
    const ms = this.elapsedMs();
    this.marks.set(name, ms);
    return ms;
  }

  snapshot(): Record<string, number> {
    return Object.fromEntries(this.marks);
  }
}
