import {
  type SchedulerJob,
  SchedulerJobFlags,
  flushPostFlushCbs,
  flushPreFlushCbs,
  nextTick,
  queueJob,
  queuePostFlushCb,
} from '../src/scheduler'

describe('scheduler', () => {
  it('nextTick', async () => {
    const calls: string[] = []
    const dummyThen = Promise.resolve().then()
    const job1 = () => {
      calls.push('job1')
    }
    const job2 = () => {
      calls.push('job2')
    }
    nextTick(job1)
    job2()

    expect(calls.length).toBe(1)
    await dummyThen
    // job1 will be pushed in nextTick
    expect(calls.length).toBe(2)
    expect(calls).toMatchObject(['job2', 'job1'])
  })

  describe('queueJob', () => {
    it('basic usage', async () => {
      const calls: string[] = []
      const job1 = () => {
        calls.push('job1')
      }
      const job2 = () => {
        calls.push('job2')
      }
      queueJob(job1)
      queueJob(job2)
      expect(calls).toEqual([])
      await nextTick()
      expect(calls).toEqual(['job1', 'job2'])
    })

    it("should insert jobs in ascending order of job's id when flushing", async () => {
      const calls: string[] = []
      const job1 = () => {
        calls.push('job1')

        queueJob(job2)
        queueJob(job3)
      }

      const job2 = () => {
        calls.push('job2')
        queueJob(job4)
        queueJob(job5)
      }
      job2.id = 10

      const job3 = () => {
        calls.push('job3')
      }
      job3.id = 1

      const job4 = () => {
        calls.push('job4')
      }

      const job5 = () => {
        calls.push('job5')
      }

      queueJob(job1)

      expect(calls).toEqual([])
      await nextTick()
      expect(calls).toEqual(['job1', 'job3', 'job2', 'job4', 'job5'])
    })

    it('should dedupe queued jobs', async () => {
      const calls: string[] = []
      const job1 = () => {
        calls.push('job1')
      }
      const job2 = () => {
        calls.push('job2')
      }
      queueJob(job1)
      queueJob(job2)
      queueJob(job1)
      queueJob(job2)
      expect(calls).toEqual([])
      await nextTick()
      expect(calls).toEqual(['job1', 'job2'])
    })

    it('queueJob while flushing', async () => {
      const calls: string[] = []
      const job1 = () => {
        calls.push('job1')
        // job2 will be executed after job1 at the same tick
        queueJob(job2)
      }
      const job2 = () => {
        calls.push('job2')
      }
      queueJob(job1)

      await nextTick()
      expect(calls).toEqual(['job1', 'job2'])
    })
  })

  describe('pre flush jobs', () => {
    it('queueJob inside preFlushCb', async () => {
      const calls: string[] = []
      const job1 = () => {
        calls.push('job1')
      }
      const cb1: SchedulerJob = () => {
        // queueJob in postFlushCb
        calls.push('cb1')
        queueJob(job1)
      }
      cb1.flags! |= SchedulerJobFlags.PRE

      queueJob(cb1)
      await nextTick()
      expect(calls).toEqual(['cb1', 'job1'])
    })

    it('queueJob & preFlushCb inside preFlushCb', async () => {
      const calls: string[] = []
      const job1 = () => {
        calls.push('job1')
      }
      job1.id = 1

      const cb1: SchedulerJob = () => {
        calls.push('cb1')
        queueJob(job1)
        // cb2 should execute before the job
        queueJob(cb2)
        queueJob(cb3)
      }
      cb1.flags! |= SchedulerJobFlags.PRE

      const cb2: SchedulerJob = () => {
        calls.push('cb2')
      }
      cb2.flags! |= SchedulerJobFlags.PRE
      cb2.id = 1

      const cb3: SchedulerJob = () => {
        calls.push('cb3')
      }
      cb3.flags! |= SchedulerJobFlags.PRE
      cb3.id = 1

      queueJob(cb1)
      await nextTick()
      expect(calls).toEqual(['cb1', 'cb2', 'cb3', 'job1'])
    })

    it('should insert jobs after pre jobs with the same id', async () => {
      const calls: string[] = []
      const job1: SchedulerJob = () => {
        calls.push('job1')
      }
      job1.id = 1
      job1.flags! |= SchedulerJobFlags.PRE
      const job2: SchedulerJob = () => {
        calls.push('job2')
        queueJob(job5)
        queueJob(job6)
      }
      job2.id = 2
      job2.flags! |= SchedulerJobFlags.PRE
      const job3: SchedulerJob = () => {
        calls.push('job3')
      }
      job3.id = 2
      job3.flags! |= SchedulerJobFlags.PRE
      const job4: SchedulerJob = () => {
        calls.push('job4')
      }
      job4.id = 3
      job4.flags! |= SchedulerJobFlags.PRE
      const job5: SchedulerJob = () => {
        calls.push('job5')
      }
      job5.id = 2
      const job6: SchedulerJob = () => {
        calls.push('job6')
      }
      job6.id = 2
      job6.flags! |= SchedulerJobFlags.PRE

      // We need several jobs to test this properly, otherwise
      // findInsertionIndex can yield the correct index by chance
      queueJob(job4)
      queueJob(job2)
      queueJob(job3)
      queueJob(job1)

      await nextTick()
      expect(calls).toEqual(['job1', 'job2', 'job3', 'job6', 'job5', 'job4'])
    })

    it('preFlushCb inside queueJob', async () => {
      const calls: string[] = []
      const job1 = () => {
        // the only case where a pre-flush cb can be queued inside a job is
        // when updating the props of a child component. This is handled
        // directly inside `updateComponentPreRender` to avoid non atomic
        // cb triggers (#1763)
        queueJob(cb1)
        queueJob(cb2)
        flushPreFlushCbs()
        calls.push('job1')
      }
      const cb1: SchedulerJob = () => {
        calls.push('cb1')
        // a cb triggers its parent job, which should be skipped
        queueJob(job1)
      }
      cb1.flags! |= SchedulerJobFlags.PRE
      const cb2: SchedulerJob = () => {
        calls.push('cb2')
      }
      cb2.flags! |= SchedulerJobFlags.PRE

      queueJob(job1)
      await nextTick()
      expect(calls).toEqual(['cb1', 'cb2', 'job1'])
    })

    it('should insert pre jobs without ids first during flushing', async () => {
      const calls: string[] = []
      const job1: SchedulerJob = () => {
        calls.push('job1')
        queueJob(job3)
        queueJob(job4)
      }
      // job1 has no id
      job1.flags! |= SchedulerJobFlags.PRE
      const job2: SchedulerJob = () => {
        calls.push('job2')
      }
      job2.id = 1
      job2.flags! |= SchedulerJobFlags.PRE
      const job3: SchedulerJob = () => {
        calls.push('job3')
      }
      // job3 has no id
      job3.flags! |= SchedulerJobFlags.PRE
      const job4: SchedulerJob = () => {
        calls.push('job4')
      }
      // job4 has no id
      job4.flags! |= SchedulerJobFlags.PRE

      queueJob(job1)
      queueJob(job2)
      await nextTick()
      expect(calls).toEqual(['job1', 'job3', 'job4', 'job2'])
    })

    // #3806
    it('queue preFlushCb inside postFlushCb', async () => {
      const spy = vi.fn()
      const cb: SchedulerJob = () => spy()
      cb.flags! |= SchedulerJobFlags.PRE
      queuePostFlushCb(() => {
        queueJob(cb)
      })
      await nextTick()
      expect(spy).toHaveBeenCalled()
    })
  })

  describe('queuePostFlushCb', () => {
    it('basic usage', async () => {
      const calls: string[] = []
      const cb1 = () => {
        calls.push('cb1')
      }
      const cb2 = () => {
        calls.push('cb2')
      }
      const cb3 = () => {
        calls.push('cb3')
      }

      queuePostFlushCb([cb1, cb2])
      queuePostFlushCb(cb3)

      expect(calls).toEqual([])
      await nextTick()
      expect(calls).toEqual(['cb1', 'cb2', 'cb3'])
    })

    it('should dedupe queued postFlushCb', async () => {
      const calls: string[] = []
      const cb1 = () => {
        calls.push('cb1')
      }
      const cb2 = () => {
        calls.push('cb2')
      }
      const cb3 = () => {
        calls.push('cb3')
      }

      queuePostFlushCb([cb1, cb2])
      queuePostFlushCb(cb3)

      queuePostFlushCb([cb1, cb3])
      queuePostFlushCb(cb2)

      expect(calls).toEqual([])
      await nextTick()
      expect(calls).toEqual(['cb1', 'cb2', 'cb3'])
    })

    it('queuePostFlushCb while flushing', async () => {
      const calls: string[] = []
      const cb1 = () => {
        calls.push('cb1')
        // cb2 will be executed after cb1 at the same tick
        queuePostFlushCb(cb2)
      }
      const cb2 = () => {
        calls.push('cb2')
      }
      queuePostFlushCb(cb1)

      await nextTick()
      expect(calls).toEqual(['cb1', 'cb2'])
    })
  })

  describe('queueJob w/ queuePostFlushCb', () => {
    it('queueJob inside postFlushCb', async () => {
      const calls: string[] = []
      const job1 = () => {
        calls.push('job1')
      }
      const cb1 = () => {
        // queueJob in postFlushCb
        calls.push('cb1')
        queueJob(job1)
      }

      queuePostFlushCb(cb1)
      await nextTick()
      expect(calls).toEqual(['cb1', 'job1'])
    })

    it('queueJob & postFlushCb inside postFlushCb', async () => {
      const calls: string[] = []
      const job1 = () => {
        calls.push('job1')
      }
      const cb1 = () => {
        calls.push('cb1')
        queuePostFlushCb(cb2)
        // job1 will executed before cb2
        // Job has higher priority than postFlushCb
        queueJob(job1)
      }
      const cb2 = () => {
        calls.push('cb2')
      }

      queuePostFlushCb(cb1)
      await nextTick()
      expect(calls).toEqual(['cb1', 'job1', 'cb2'])
    })

    it('postFlushCb inside queueJob', async () => {
      const calls: string[] = []
      const job1 = () => {
        calls.push('job1')
        // postFlushCb in queueJob
        queuePostFlushCb(cb1)
      }
      const cb1 = () => {
        calls.push('cb1')
      }

      queueJob(job1)
      await nextTick()
      expect(calls).toEqual(['job1', 'cb1'])
    })

    it('queueJob & postFlushCb inside queueJob', async () => {
      const calls: string[] = []
      const job1 = () => {
        calls.push('job1')
        // cb1 will executed after job2
        // Job has higher priority than postFlushCb
        queuePostFlushCb(cb1)
        queueJob(job2)
      }
      const job2 = () => {
        calls.push('job2')
      }
      const cb1 = () => {
        calls.push('cb1')
      }

      queueJob(job1)
      await nextTick()
      expect(calls).toEqual(['job1', 'job2', 'cb1'])
    })

    it('nested queueJob w/ postFlushCb', async () => {
      const calls: string[] = []
      const job1 = () => {
        calls.push('job1')

        queuePostFlushCb(cb1)
        queueJob(job2)
      }
      const job2 = () => {
        calls.push('job2')
        queuePostFlushCb(cb2)
      }
      const cb1 = () => {
        calls.push('cb1')
      }
      const cb2 = () => {
        calls.push('cb2')
      }

      queueJob(job1)
      await nextTick()
      expect(calls).toEqual(['job1', 'job2', 'cb1', 'cb2'])
    })

    test('jobs added during post flush are ordered correctly', async () => {
      const calls: string[] = []

      const job1: SchedulerJob = () => {
        calls.push('job1')
      }
      job1.id = 1

      const job2: SchedulerJob = () => {
        calls.push('job2')
      }
      job2.id = 2

      queuePostFlushCb(() => {
        queueJob(job2)
        queueJob(job1)
      })

      await nextTick()

      expect(calls).toEqual(['job1', 'job2'])
    })
  })

  test('sort job based on id', async () => {
    const calls: string[] = []
    const job1 = () => calls.push('job1')
    // job1 has no id
    const job2 = () => calls.push('job2')
    job2.id = 2
    const job3 = () => calls.push('job3')
    job3.id = 1
    const job4: SchedulerJob = () => calls.push('job4')
    job4.id = 2
    job4.flags! |= SchedulerJobFlags.PRE
    const job5: SchedulerJob = () => calls.push('job5')
    // job5 has no id
    job5.flags! |= SchedulerJobFlags.PRE

    queueJob(job1)
    queueJob(job2)
    queueJob(job3)
    queueJob(job4)
    queueJob(job5)
    await nextTick()
    expect(calls).toEqual(['job5', 'job3', 'job4', 'job2', 'job1'])
  })

  test('sort SchedulerCbs based on id', async () => {
    const calls: string[] = []
    const cb1 = () => calls.push('cb1')
    // cb1 has no id
    const cb2 = () => calls.push('cb2')
    cb2.id = 2
    const cb3 = () => calls.push('cb3')
    cb3.id = 1

    queuePostFlushCb(cb1)
    queuePostFlushCb(cb2)
    queuePostFlushCb(cb3)
    await nextTick()
    expect(calls).toEqual(['cb3', 'cb2', 'cb1'])
  })

  // #1595
  test('avoid duplicate postFlushCb invocation', async () => {
    const calls: string[] = []
    const cb1 = () => {
      calls.push('cb1')
      queuePostFlushCb(cb2)
    }
    const cb2 = () => {
      calls.push('cb2')
    }
    queuePostFlushCb(cb1)
    queuePostFlushCb(cb2)
    await nextTick()
    expect(calls).toEqual(['cb1', 'cb2'])
  })

  test('nextTick should capture scheduler flush errors', async () => {
    const err = new Error('test')
    queueJob(() => {
      throw err
    })
    try {
      await nextTick()
    } catch (e: any) {
      expect(e).toBe(err)
    }
    expect(
      `Unhandled error during execution of scheduler flush`,
    ).toHaveBeenWarned()

    // this one should no longer error
    await nextTick()
  })

  test('jobs can be re-queued after an error', async () => {
    const err = new Error('test')
    let shouldThrow = true

    const job1: SchedulerJob = vi.fn(() => {
      if (shouldThrow) {
        shouldThrow = false
        throw err
      }
    })
    job1.id = 1

    const job2: SchedulerJob = vi.fn()
    job2.id = 2

    queueJob(job1)
    queueJob(job2)

    try {
      await nextTick()
    } catch (e: any) {
      expect(e).toBe(err)
    }
    expect(
      `Unhandled error during execution of scheduler flush`,
    ).toHaveBeenWarned()

    expect(job1).toHaveBeenCalledTimes(1)
    expect(job2).toHaveBeenCalledTimes(0)

    queueJob(job1)
    queueJob(job2)

    await nextTick()

    expect(job1).toHaveBeenCalledTimes(2)
    expect(job2).toHaveBeenCalledTimes(1)
  })

  test('should prevent self-triggering jobs by default', async () => {
    let count = 0
    const job = () => {
      if (count < 3) {
        count++
        queueJob(job)
      }
    }
    queueJob(job)
    await nextTick()
    // only runs once - a job cannot queue itself
    expect(count).toBe(1)
  })

  test('should allow explicitly marked jobs to trigger itself', async () => {
    // normal job
    let count = 0
    const job: SchedulerJob = () => {
      if (count < 3) {
        count++
        queueJob(job)
      }
    }
    job.flags! |= SchedulerJobFlags.ALLOW_RECURSE
    queueJob(job)
    await nextTick()
    expect(count).toBe(3)

    // post cb
    const cb: SchedulerJob = () => {
      if (count < 5) {
        count++
        queuePostFlushCb(cb)
      }
    }
    cb.flags! |= SchedulerJobFlags.ALLOW_RECURSE
    queuePostFlushCb(cb)
    await nextTick()
    expect(count).toBe(5)
  })

  test('recursive jobs can only be queued once non-recursively', async () => {
    const job: SchedulerJob = vi.fn()
    job.id = 1
    job.flags = SchedulerJobFlags.ALLOW_RECURSE

    queueJob(job)
    queueJob(job)

    await nextTick()

    expect(job).toHaveBeenCalledTimes(1)
  })

  test('recursive jobs can only be queued once recursively', async () => {
    let recurse = true

    const job: SchedulerJob = vi.fn(() => {
      if (recurse) {
        queueJob(job)
        queueJob(job)
        recurse = false
      }
    })
    job.id = 1
    job.flags = SchedulerJobFlags.ALLOW_RECURSE

    queueJob(job)

    await nextTick()

    expect(job).toHaveBeenCalledTimes(2)
  })

  test(`recursive jobs can't be re-queued by other jobs`, async () => {
    let recurse = true

    const job1: SchedulerJob = () => {
      if (recurse) {
        // job2 is already queued, so this shouldn't do anything
        queueJob(job2)
        recurse = false
      }
    }
    job1.id = 1

    const job2: SchedulerJob = vi.fn(() => {
      if (recurse) {
        queueJob(job1)
        queueJob(job2)
      }
    })
    job2.id = 2
    job2.flags = SchedulerJobFlags.ALLOW_RECURSE

    queueJob(job2)

    await nextTick()

    expect(job2).toHaveBeenCalledTimes(2)
  })

  test('jobs are de-duplicated correctly when calling flushPreFlushCbs', async () => {
    let recurse = true

    const job1: SchedulerJob = vi.fn(() => {
      queueJob(job3)
      queueJob(job3)
      flushPreFlushCbs()
    })
    job1.id = 1
    job1.flags = SchedulerJobFlags.PRE

    const job2: SchedulerJob = vi.fn(() => {
      if (recurse) {
        // job2 does not allow recurse, so this shouldn't do anything
        queueJob(job2)

        // job3 is already queued, so this shouldn't do anything
        queueJob(job3)
        recurse = false
      }
    })
    job2.id = 2
    job2.flags = SchedulerJobFlags.PRE

    const job3: SchedulerJob = vi.fn(() => {
      if (recurse) {
        queueJob(job2)
        queueJob(job3)

        // The jobs are already queued, so these should have no effect
        queueJob(job2)
        queueJob(job3)
      }
    })
    job3.id = 3
    job3.flags = SchedulerJobFlags.ALLOW_RECURSE | SchedulerJobFlags.PRE

    queueJob(job1)

    await nextTick()

    expect(job1).toHaveBeenCalledTimes(1)
    expect(job2).toHaveBeenCalledTimes(1)
    expect(job3).toHaveBeenCalledTimes(2)
  })

  // #1947 flushPostFlushCbs should handle nested calls
  // e.g. app.mount inside app.mount
  test('flushPostFlushCbs', async () => {
    let count = 0

    const queueAndFlush = (hook: Function) => {
      queuePostFlushCb(hook)
      flushPostFlushCbs()
    }

    queueAndFlush(() => {
      queueAndFlush(() => {
        count++
      })
    })

    await nextTick()
    expect(count).toBe(1)
  })

  // #910
  test('should not run stopped reactive effects', async () => {
    const spy = vi.fn()

    // simulate parent component that toggles child
    const job1 = () => {
      // @ts-expect-error
      job2.flags! |= SchedulerJobFlags.DISPOSED
    }
    // simulate child that's triggered by the same reactive change that
    // triggers its toggle
    const job2 = () => spy()
    expect(spy).toHaveBeenCalledTimes(0)

    queueJob(job1)
    queueJob(job2)
    await nextTick()

    // should not be called
    expect(spy).toHaveBeenCalledTimes(0)
  })

  it('flushPreFlushCbs inside a pre job', async () => {
    const spy = vi.fn()
    const job: SchedulerJob = () => {
      spy()
      flushPreFlushCbs()
    }
    job.flags! |= SchedulerJobFlags.PRE
    queueJob(job)
    await nextTick()
    expect(spy).toHaveBeenCalledTimes(1)
  })

  test('flushPreFlushCbs inside a post job', async () => {
    const calls: string[] = []
    const callsAfterFlush: string[] = []

    const job1: SchedulerJob = () => {
      calls.push('job1')
    }
    job1.id = 1
    job1.flags! |= SchedulerJobFlags.PRE

    const job2: SchedulerJob = () => {
      calls.push('job2')
    }
    job2.id = 2
    job2.flags! |= SchedulerJobFlags.PRE

    queuePostFlushCb(() => {
      queueJob(job2)
      queueJob(job1)

      // e.g. nested app.mount() call
      flushPreFlushCbs()
      callsAfterFlush.push(...calls)
    })

    await nextTick()

    expect(callsAfterFlush).toEqual(['job1', 'job2'])
    expect(calls).toEqual(['job1', 'job2'])
  })

  it('nextTick should return promise', async () => {
    const fn = vi.fn(() => {
      return 1
    })

    const p = nextTick(fn)

    expect(p).toBeInstanceOf(Promise)
    expect(await p).toBe(1)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  // #10003
  test('nested flushPostFlushCbs', async () => {
    const calls: string[] = []
    const cb1 = () => calls.push('cb1')
    // cb1 has no id
    const cb2 = () => calls.push('cb2')
    cb2.id = -1
    const queueAndFlush = (hook: Function) => {
      queuePostFlushCb(hook)
      flushPostFlushCbs()
    }

    queueAndFlush(() => {
      queuePostFlushCb([cb1, cb2])
      flushPostFlushCbs()
    })

    await nextTick()
    expect(calls).toEqual(['cb2', 'cb1'])
  })
})
