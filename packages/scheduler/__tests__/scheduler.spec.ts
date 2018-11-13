import { queueJob, queuePostEffect, nextTick } from '../src/index'

describe('scheduler', () => {
  it('queueJob', async () => {
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

  it('queueJob while already flushing', async () => {
    const calls: any = []
    const job1 = () => {
      calls.push('job1')
      // job1 queues job2
      queueJob(job2)
    }
    const job2 = () => {
      calls.push('job2')
    }
    queueJob(job1)
    expect(calls).toEqual([])
    await nextTick()
    expect(calls).toEqual(['job1', 'job2'])
  })

  it('queueJob w/ postCommitCb', async () => {
    const calls: any = []
    const job1 = () => {
      calls.push('job1')
      queuePostEffect(cb1)
    }
    const job2 = () => {
      calls.push('job2')
      queuePostEffect(cb2)
    }
    const cb1 = () => {
      calls.push('cb1')
    }
    const cb2 = () => {
      calls.push('cb2')
    }
    queueJob(job1)
    queueJob(job2)
    await nextTick()
    // post commit cbs are called in reverse!
    expect(calls).toEqual(['job1', 'job2', 'cb2', 'cb1'])
  })

  it('queueJob w/ postFlushCb while flushing', async () => {
    const calls: any = []
    const job1 = () => {
      calls.push('job1')
      queuePostEffect(cb1)
      // job1 queues job2
      queueJob(job2)
    }
    const job2 = () => {
      calls.push('job2')
      queuePostEffect(cb2)
    }
    const cb1 = () => {
      calls.push('cb1')
    }
    const cb2 = () => {
      calls.push('cb2')
    }
    queueJob(job1)
    expect(calls).toEqual([])
    await nextTick()
    expect(calls).toEqual(['job1', 'job2', 'cb2', 'cb1'])
  })

  it('should dedupe queued tasks', async () => {
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

  it('queueJob inside postEffect', async () => {
    const calls: any = []
    const job1 = () => {
      calls.push('job1')
      queuePostEffect(cb1)
    }
    const cb1 = () => {
      // queue another job in postFlushCb
      calls.push('cb1')
      queueJob(job2)
    }
    const job2 = () => {
      calls.push('job2')
      queuePostEffect(cb2)
    }
    const cb2 = () => {
      calls.push('cb2')
    }

    queueJob(job1)
    queueJob(job2)
    await nextTick()
    expect(calls).toEqual(['job1', 'job2', 'cb2', 'cb1', 'job2', 'cb2'])
  })
})
