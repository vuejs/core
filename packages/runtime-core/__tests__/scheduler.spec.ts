import { queueJob, nextTick, queuePostFlushCb } from '../src/scheduler'

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
        // job2 will be excuted after job1 at the same tick
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
        // cb2 will be excuted after cb1 at the same tick
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
})
