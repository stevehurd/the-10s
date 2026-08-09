interface PollScheduler {
  setTimeout(callback: () => void, delayMs: number): unknown
  clearTimeout(handle: unknown): void
}

export function startSequentialPoller({
  task,
  intervalMs,
  scheduler,
}: {
  task: () => Promise<void>
  intervalMs: number
  scheduler: PollScheduler
}) {
  let stopped = false
  let nextPoll: unknown

  async function run() {
    await task()
    if (!stopped) {
      nextPoll = scheduler.setTimeout(() => void run(), intervalMs)
    }
  }

  void run()

  return () => {
    stopped = true
    if (nextPoll !== undefined) scheduler.clearTimeout(nextPoll)
  }
}
