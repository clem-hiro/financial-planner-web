// Pure utility (the actual declaration). The barrel re-exports this — resolver must land here, not on the barrel.

export function formatCents(amount: number): string {
  return (amount / 100).toFixed(2);
}

export class TimerHandle {
  constructor(public readonly id: number) {}
  cancel(): void {
    // no-op
  }
}
