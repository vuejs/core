import { queueJob, nextTick } from '../src/index'

describe('scheduler', () => {
  test('queueJob', async () => {
    const calls: any = []
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

  test('queueJob while already flushing', async () => {
    const calls: any = []
    const job1 = () => {
      calls.push('job1')
      // job1 queues job2
      queueJob(job2)
      // should be called sync
      expect(calls).toEqual(['job1', 'job2'])
    }
    const job2 = () => {
      calls.push('job2')
    }
    queueJob(job1)
    expect(calls).toEqual([])
    await nextTick()
    expect(calls).toEqual(['job1', 'job2'])
  })

  test('queueJob w/ postFlushCb', async () => {
    const calls: any = []
    const job1 = () => {
      calls.push('job1')
    }
    const job2 = () => {
      calls.push('job2')
    }
    const cb1 = () => {
      calls.push('cb1')
    }
    const cb2 = () => {
      calls.push('cb2')
    }
    queueJob(job1, cb1)
    queueJob(job2, cb2)
    await nextTick()
    expect(calls).toEqual(['job1', 'job2', 'cb1', 'cb2'])
  })

  test('queueJob w/ postFlushCb while flushing', async () => {
    const calls: any = []
    const job1 = () => {
      calls.push('job1')
      // job1 queues job2
      queueJob(job2, cb2)
      // should be called sync
      expect(calls).toEqual(['job1', 'job2'])
    }
    const job2 = () => {
      calls.push('job2')
    }
    const cb1 = () => {
      calls.push('cb1')
    }
    const cb2 = () => {
      calls.push('cb2')
    }
    queueJob(job1, cb1)
    expect(calls).toEqual([])
    await nextTick()
    expect(calls).toEqual(['job1', 'job2', 'cb1', 'cb2'])
  })

  test('should dedupe queued tasks', async () => {
    const calls: any = []
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
})
