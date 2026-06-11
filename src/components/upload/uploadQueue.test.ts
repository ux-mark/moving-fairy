import { describe, expect, it } from 'vitest'

import {
  MAX_BATCH_SIZE,
  MAX_CONCURRENT_UPLOADS,
  UploadQueue,
  type UploadTasks,
} from './uploadQueue'

function makeFiles(n: number): File[] {
  return Array.from({ length: n }, (_, i) => new File(['x'], `photo-${i}.jpg`, { type: 'image/jpeg' }))
}

interface Deferred {
  resolve: (url: string) => void
  reject: (err: Error) => void
}

/** Tasks harness with manually-resolvable uploads and instant item creation. */
function makeManualTasks() {
  const pending: Deferred[] = []
  let concurrent = 0
  let maxConcurrent = 0
  const tasks: UploadTasks = {
    uploadFile: () =>
      new Promise<string>((resolve, reject) => {
        concurrent++
        maxConcurrent = Math.max(maxConcurrent, concurrent)
        pending.push({
          resolve: (url) => {
            concurrent--
            resolve(url)
          },
          reject: (err) => {
            concurrent--
            reject(err)
          },
        })
      }),
    createItem: () => Promise.resolve(),
  }
  return {
    tasks,
    pending,
    getMaxConcurrent: () => maxConcurrent,
  }
}

/** Lets queued microtasks (status transitions, pump cycles) flush. */
async function settle(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}

describe('UploadQueue', () => {
  it('caps a batch at 50 files and reports the rejected count', () => {
    const queue = new UploadQueue({
      uploadFile: () => new Promise(() => {}),
      createItem: () => Promise.resolve(),
    })

    const result = queue.enqueue(makeFiles(64))

    expect(result).toEqual({ accepted: MAX_BATCH_SIZE, rejected: 14 })
    expect(queue.getSnapshot().total).toBe(MAX_BATCH_SIZE)
    expect(queue.getSnapshot().pendingCount).toBe(MAX_BATCH_SIZE)
  })

  it('caps follow-up enqueues against the live batch total', () => {
    const queue = new UploadQueue({
      uploadFile: () => new Promise(() => {}),
      createItem: () => Promise.resolve(),
    })

    queue.enqueue(makeFiles(45))
    const result = queue.enqueue(makeFiles(10))

    expect(result).toEqual({ accepted: 5, rejected: 5 })
    expect(queue.getSnapshot().total).toBe(MAX_BATCH_SIZE)
  })

  it('never runs more than 3 uploads at once', async () => {
    const { tasks, pending, getMaxConcurrent } = makeManualTasks()
    const queue = new UploadQueue(tasks)

    queue.enqueue(makeFiles(8))
    await settle()
    expect(pending.length).toBe(MAX_CONCURRENT_UPLOADS)

    // Finishing one upload admits exactly one more.
    pending[0]!.resolve('item-images/u/1.webp')
    await settle()
    expect(pending.length).toBe(4)
    expect(getMaxConcurrent()).toBe(MAX_CONCURRENT_UPLOADS)

    // Drain the rest — the cap is never exceeded.
    while (pending.length > 0) {
      pending.shift()!.resolve('item-images/u/x.webp')
      await settle()
    }
    expect(getMaxConcurrent()).toBe(MAX_CONCURRENT_UPLOADS)
  })

  it('marks a file failed on upload error and re-queues it via retryFailed', async () => {
    let attempts = 0
    const queue = new UploadQueue({
      uploadFile: () => {
        attempts++
        return attempts === 1
          ? Promise.reject(new Error('Upload failed'))
          : Promise.resolve('item-images/u/1.webp')
      },
      createItem: () => Promise.resolve(),
    })

    queue.enqueue(makeFiles(1))
    await settle()

    let snap = queue.getSnapshot()
    expect(snap.failedCount).toBe(1)
    expect(snap.phase).toBe('settled')
    expect(snap.files[0]?.error).toBe('Upload failed')

    queue.retryFailed()
    await settle()

    snap = queue.getSnapshot()
    expect(snap.failedCount).toBe(0)
    expect(snap.doneCount).toBe(1)
    expect(snap.phase).toBe('settled')
  })

  it('retry after a failed item-creation resumes from createItem without re-uploading', async () => {
    let uploads = 0
    let creates = 0
    const queue = new UploadQueue({
      uploadFile: () => {
        uploads++
        return Promise.resolve('item-images/u/1.webp')
      },
      createItem: () => {
        creates++
        return creates === 1
          ? Promise.reject(new Error('Failed to create item (500)'))
          : Promise.resolve()
      },
    })

    queue.enqueue(makeFiles(1))
    await settle()
    expect(queue.getSnapshot().failedCount).toBe(1)

    queue.retryFailed()
    await settle()

    expect(uploads).toBe(1) // no orphaned second storage object
    expect(creates).toBe(2)
    expect(queue.getSnapshot().doneCount).toBe(1)
  })

  it('retry after a failed upload still re-runs the upload', async () => {
    let uploads = 0
    const queue = new UploadQueue({
      uploadFile: () => {
        uploads++
        return uploads === 1
          ? Promise.reject(new Error('Upload failed'))
          : Promise.resolve('item-images/u/1.webp')
      },
      createItem: () => Promise.resolve(),
    })

    queue.enqueue(makeFiles(1))
    await settle()
    queue.retryFile(queue.getSnapshot().files[0]!.id)
    await settle()

    expect(uploads).toBe(2)
    expect(queue.getSnapshot().doneCount).toBe(1)
  })

  it('counts a file failed when item creation fails after a successful upload', async () => {
    const queue = new UploadQueue({
      uploadFile: () => Promise.resolve('item-images/u/1.webp'),
      createItem: () => Promise.reject(new Error('Failed to create item (500)')),
    })

    queue.enqueue(makeFiles(2))
    await settle()

    const snap = queue.getSnapshot()
    expect(snap.failedCount).toBe(2)
    expect(snap.doneCount).toBe(0)
    expect(snap.phase).toBe('settled')
  })

  it('accounts completion: done + failed = total, pendingCount hits zero', async () => {
    let calls = 0
    const queue = new UploadQueue({
      uploadFile: () => {
        calls++
        return calls % 3 === 0
          ? Promise.reject(new Error('Upload failed'))
          : Promise.resolve('item-images/u/ok.webp')
      },
      createItem: () => Promise.resolve(),
    })

    queue.enqueue(makeFiles(9))
    await settle()

    const snap = queue.getSnapshot()
    expect(snap.doneCount).toBe(6)
    expect(snap.failedCount).toBe(3)
    expect(snap.finished).toBe(snap.total)
    expect(snap.pendingCount).toBe(0)
    expect(snap.phase).toBe('settled')
  })

  it('starts a fresh batch after the previous one settled', async () => {
    const queue = new UploadQueue({
      uploadFile: () => Promise.resolve('item-images/u/1.webp'),
      createItem: () => Promise.resolve(),
    })

    queue.enqueue(makeFiles(2))
    await settle()
    expect(queue.getSnapshot().phase).toBe('settled')

    queue.enqueue(makeFiles(3))
    await settle()

    const snap = queue.getSnapshot()
    expect(snap.total).toBe(3)
    expect(snap.doneCount).toBe(3)
  })

  it('dismiss clears a settled batch but never an active one', async () => {
    const { tasks, pending } = makeManualTasks()
    const queue = new UploadQueue(tasks)

    queue.enqueue(makeFiles(1))
    await settle()
    queue.dismiss()
    expect(queue.getSnapshot().phase).toBe('active')

    pending[0]!.resolve('item-images/u/1.webp')
    await settle()
    expect(queue.getSnapshot().phase).toBe('settled')

    queue.dismiss()
    expect(queue.getSnapshot().phase).toBe('idle')
    expect(queue.getSnapshot().total).toBe(0)
  })

  it('notifies subscribers on every state change', async () => {
    const queue = new UploadQueue({
      uploadFile: () => Promise.resolve('item-images/u/1.webp'),
      createItem: () => Promise.resolve(),
    })
    let notifications = 0
    const unsubscribe = queue.subscribe(() => notifications++)

    queue.enqueue(makeFiles(1))
    await settle()

    expect(notifications).toBeGreaterThan(0)
    expect(queue.getSnapshot().doneCount).toBe(1)
    unsubscribe()
  })
})
