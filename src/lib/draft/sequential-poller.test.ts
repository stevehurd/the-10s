import assert from 'node:assert/strict'
import test from 'node:test'

import { startSequentialPoller } from './sequential-poller.ts'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((complete) => { resolve = complete })
  return { promise, resolve }
}

test('draft polling schedules the next request only after the current request finishes', async () => {
  const requests = [deferred(), deferred()]
  const scheduled: Array<() => void> = []
  let requestCount = 0
  const stop = startSequentialPoller({
    intervalMs: 2_000,
    task: () => requests[requestCount++].promise,
    scheduler: {
      setTimeout(callback) {
        scheduled.push(callback)
        return callback
      },
      clearTimeout() {},
    },
  })

  assert.equal(requestCount, 1)
  assert.equal(scheduled.length, 0)

  requests[0].resolve()
  await Promise.resolve()
  await Promise.resolve()
  assert.equal(scheduled.length, 1)

  scheduled[0]()
  assert.equal(requestCount, 2)
  assert.equal(scheduled.length, 1)

  stop()
  requests[1].resolve()
  await Promise.resolve()
  await Promise.resolve()
  assert.equal(scheduled.length, 1)
})
