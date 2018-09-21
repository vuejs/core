import {
  observable,
  autorun,
  stop,
  unwrap,
  OperationTypes,
  DebuggerEvent,
  markNonReactive
} from '../src/index'
import { ITERATE_KEY } from '../src/autorun'

describe('observer/autorun', () => {
  it('should run the passed function once (wrapped by a autorun)', () => {
    const fnSpy = jest.fn(() => {})
    autorun(fnSpy)
    expect(fnSpy).toHaveBeenCalledTimes(1)
  })

  it('should observe basic properties', () => {
    let dummy
    const counter = observable({ num: 0 })
    autorun(() => (dummy = counter.num))

    expect(dummy).toBe(0)
    counter.num = 7
    expect(dummy).toBe(7)
  })

  it('should observe multiple properties', () => {
    let dummy
    const counter = observable({ num1: 0, num2: 0 })
    autorun(() => (dummy = counter.num1 + counter.num1 + counter.num2))

    expect(dummy).toBe(0)
    counter.num1 = counter.num2 = 7
    expect(dummy).toBe(21)
  })

  it('should handle multiple autoruns', () => {
    let dummy1, dummy2
    const counter = observable({ num: 0 })
    autorun(() => (dummy1 = counter.num))
    autorun(() => (dummy2 = counter.num))

    expect(dummy1).toBe(0)
    expect(dummy2).toBe(0)
    counter.num++
    expect(dummy1).toBe(1)
    expect(dummy2).toBe(1)
  })

  it('should observe nested properties', () => {
    let dummy
    const counter = observable({ nested: { num: 0 } })
    autorun(() => (dummy = counter.nested.num))

    expect(dummy).toBe(0)
    counter.nested.num = 8
    expect(dummy).toBe(8)
  })

  it('should observe delete operations', () => {
    let dummy
    const obj = observable({ prop: 'value' })
    autorun(() => (dummy = obj.prop))

    expect(dummy).toBe('value')
    delete obj.prop
    expect(dummy).toBe(undefined)
  })

  it('should observe has operations', () => {
    let dummy
    const obj: any = observable({ prop: 'value' })
    autorun(() => (dummy = 'prop' in obj))

    expect(dummy).toBe(true)
    delete obj.prop
    expect(dummy).toBe(false)
    obj.prop = 12
    expect(dummy).toBe(true)
  })

  it('should observe properties on the prototype chain', () => {
    let dummy
    const counter = observable({ num: 0 })
    const parentCounter = observable({ num: 2 })
    Object.setPrototypeOf(counter, parentCounter)
    autorun(() => (dummy = counter.num))

    expect(dummy).toBe(0)
    delete counter.num
    expect(dummy).toBe(2)
    parentCounter.num = 4
    expect(dummy).toBe(4)
    counter.num = 3
    expect(dummy).toBe(3)
  })

  it('should observe has operations on the prototype chain', () => {
    let dummy
    const counter = observable({ num: 0 })
    const parentCounter = observable({ num: 2 })
    Object.setPrototypeOf(counter, parentCounter)
    autorun(() => (dummy = 'num' in counter))

    expect(dummy).toBe(true)
    delete counter.num
    expect(dummy).toBe(true)
    delete parentCounter.num
    expect(dummy).toBe(false)
    counter.num = 3
    expect(dummy).toBe(true)
  })

  it('should observe inherited property accessors', () => {
    let dummy, parentDummy, hiddenValue: any
    const obj: any = observable({})
    const parent = observable({
      set prop(value) {
        hiddenValue = value
      },
      get prop() {
        return hiddenValue
      }
    })
    Object.setPrototypeOf(obj, parent)
    autorun(() => (dummy = obj.prop))
    autorun(() => (parentDummy = parent.prop))

    expect(dummy).toBe(undefined)
    expect(parentDummy).toBe(undefined)
    obj.prop = 4
    expect(dummy).toBe(4)
    // this doesn't work, should it?
    // expect(parentDummy).toBe(4)
    parent.prop = 2
    expect(dummy).toBe(2)
    expect(parentDummy).toBe(2)
  })

  it('should observe function call chains', () => {
    let dummy
    const counter = observable({ num: 0 })
    autorun(() => (dummy = getNum()))

    function getNum() {
      return counter.num
    }

    expect(dummy).toBe(0)
    counter.num = 2
    expect(dummy).toBe(2)
  })

  it('should observe iteration', () => {
    let dummy
    const list = observable(['Hello'])
    autorun(() => (dummy = list.join(' ')))

    expect(dummy).toBe('Hello')
    list.push('World!')
    expect(dummy).toBe('Hello World!')
    list.shift()
    expect(dummy).toBe('World!')
  })

  it('should observe implicit array length changes', () => {
    let dummy
    const list = observable(['Hello'])
    autorun(() => (dummy = list.join(' ')))

    expect(dummy).toBe('Hello')
    list[1] = 'World!'
    expect(dummy).toBe('Hello World!')
    list[3] = 'Hello!'
    expect(dummy).toBe('Hello World!  Hello!')
  })

  it('should observe sparse array mutations', () => {
    let dummy
    const list: any[] = observable([])
    list[1] = 'World!'
    autorun(() => (dummy = list.join(' ')))

    expect(dummy).toBe(' World!')
    list[0] = 'Hello'
    expect(dummy).toBe('Hello World!')
    list.pop()
    expect(dummy).toBe('Hello')
  })

  it('should observe enumeration', () => {
    let dummy = 0
    const numbers: any = observable({ num1: 3 })
    autorun(() => {
      dummy = 0
      for (let key in numbers) {
        dummy += numbers[key]
      }
    })

    expect(dummy).toBe(3)
    numbers.num2 = 4
    expect(dummy).toBe(7)
    delete numbers.num1
    expect(dummy).toBe(4)
  })

  it('should observe symbol keyed properties', () => {
    const key = Symbol('symbol keyed prop')
    let dummy, hasDummy
    const obj = observable({ [key]: 'value' })
    autorun(() => (dummy = obj[key]))
    autorun(() => (hasDummy = key in obj))

    expect(dummy).toBe('value')
    expect(hasDummy).toBe(true)
    obj[key] = 'newValue'
    expect(dummy).toBe('newValue')
    delete obj[key]
    expect(dummy).toBe(undefined)
    expect(hasDummy).toBe(false)
  })

  it('should not observe well-known symbol keyed properties', () => {
    const key = Symbol.isConcatSpreadable
    let dummy
    const array: any = observable([])
    autorun(() => (dummy = array[key]))

    expect(array[key]).toBe(undefined)
    expect(dummy).toBe(undefined)
    array[key] = true
    expect(array[key]).toBe(true)
    expect(dummy).toBe(undefined)
  })

  it('should observe function valued properties', () => {
    const oldFunc = () => {}
    const newFunc = () => {}

    let dummy
    const obj = observable({ func: oldFunc })
    autorun(() => (dummy = obj.func))

    expect(dummy).toBe(oldFunc)
    obj.func = newFunc
    expect(dummy).toBe(newFunc)
  })

  it('should not observe set operations without a value change', () => {
    let hasDummy, getDummy
    const obj = observable({ prop: 'value' })

    const getSpy = jest.fn(() => (getDummy = obj.prop))
    const hasSpy = jest.fn(() => (hasDummy = 'prop' in obj))
    autorun(getSpy)
    autorun(hasSpy)

    expect(getDummy).toBe('value')
    expect(hasDummy).toBe(true)
    obj.prop = 'value'
    expect(getSpy).toHaveBeenCalledTimes(1)
    expect(hasSpy).toHaveBeenCalledTimes(1)
    expect(getDummy).toBe('value')
    expect(hasDummy).toBe(true)
  })

  it('should not observe raw mutations', () => {
    let dummy
    const obj: any = observable()
    autorun(() => (dummy = unwrap(obj).prop))

    expect(dummy).toBe(undefined)
    obj.prop = 'value'
    expect(dummy).toBe(undefined)
  })

  it('should not be triggered by raw mutations', () => {
    let dummy
    const obj: any = observable()
    autorun(() => (dummy = obj.prop))

    expect(dummy).toBe(undefined)
    unwrap(obj).prop = 'value'
    expect(dummy).toBe(undefined)
  })

  it('should not be triggered by inherited raw setters', () => {
    let dummy, parentDummy, hiddenValue: any
    const obj: any = observable({})
    const parent = observable({
      set prop(value) {
        hiddenValue = value
      },
      get prop() {
        return hiddenValue
      }
    })
    Object.setPrototypeOf(obj, parent)
    autorun(() => (dummy = obj.prop))
    autorun(() => (parentDummy = parent.prop))

    expect(dummy).toBe(undefined)
    expect(parentDummy).toBe(undefined)
    unwrap(obj).prop = 4
    expect(dummy).toBe(undefined)
    expect(parentDummy).toBe(undefined)
  })

  it('should avoid implicit infinite recursive loops with itself', () => {
    const counter = observable({ num: 0 })

    const counterSpy = jest.fn(() => counter.num++)
    autorun(counterSpy)
    expect(counter.num).toBe(1)
    expect(counterSpy).toHaveBeenCalledTimes(1)
    counter.num = 4
    expect(counter.num).toBe(5)
    expect(counterSpy).toHaveBeenCalledTimes(2)
  })

  it('should allow explicitly recursive raw function loops', () => {
    const counter = observable({ num: 0 })
    const numSpy = jest.fn(() => {
      counter.num++
      if (counter.num < 10) {
        numSpy()
      }
    })
    autorun(numSpy)
    expect(counter.num).toEqual(10)
    expect(numSpy).toHaveBeenCalledTimes(10)
  })

  it('should avoid infinite loops with other autoruns', () => {
    const nums = observable({ num1: 0, num2: 1 })

    const spy1 = jest.fn(() => (nums.num1 = nums.num2))
    const spy2 = jest.fn(() => (nums.num2 = nums.num1))
    autorun(spy1)
    autorun(spy2)
    expect(nums.num1).toBe(1)
    expect(nums.num2).toBe(1)
    expect(spy1).toHaveBeenCalledTimes(1)
    expect(spy2).toHaveBeenCalledTimes(1)
    nums.num2 = 4
    expect(nums.num1).toBe(4)
    expect(nums.num2).toBe(4)
    expect(spy1).toHaveBeenCalledTimes(2)
    expect(spy2).toHaveBeenCalledTimes(2)
    nums.num1 = 10
    expect(nums.num1).toBe(10)
    expect(nums.num2).toBe(10)
    expect(spy1).toHaveBeenCalledTimes(3)
    expect(spy2).toHaveBeenCalledTimes(3)
  })

  it('should return a new reactive version of the function', () => {
    function greet() {
      return 'Hello World'
    }
    const autorun1 = autorun(greet)
    const autorun2 = autorun(greet)
    expect(typeof autorun1).toBe('function')
    expect(typeof autorun2).toBe('function')
    expect(autorun1).not.toBe(greet)
    expect(autorun1).not.toBe(autorun2)
  })

  it('should discover new branches while running automatically', () => {
    let dummy
    const obj = observable({ prop: 'value', run: false })

    const conditionalSpy = jest.fn(() => {
      dummy = obj.run ? obj.prop : 'other'
    })
    autorun(conditionalSpy)

    expect(dummy).toBe('other')
    expect(conditionalSpy).toHaveBeenCalledTimes(1)
    obj.prop = 'Hi'
    expect(dummy).toBe('other')
    expect(conditionalSpy).toHaveBeenCalledTimes(1)
    obj.run = true
    expect(dummy).toBe('Hi')
    expect(conditionalSpy).toHaveBeenCalledTimes(2)
    obj.prop = 'World'
    expect(dummy).toBe('World')
    expect(conditionalSpy).toHaveBeenCalledTimes(3)
  })

  it('should discover new branches when running manually', () => {
    let dummy
    let run = false
    const obj = observable({ prop: 'value' })
    const runner = autorun(() => {
      dummy = run ? obj.prop : 'other'
    })

    expect(dummy).toBe('other')
    runner()
    expect(dummy).toBe('other')
    run = true
    runner()
    expect(dummy).toBe('value')
    obj.prop = 'World'
    expect(dummy).toBe('World')
  })

  it('should not be triggered by mutating a property, which is used in an inactive branch', () => {
    let dummy
    const obj = observable({ prop: 'value', run: true })

    const conditionalSpy = jest.fn(() => {
      dummy = obj.run ? obj.prop : 'other'
    })
    autorun(conditionalSpy)

    expect(dummy).toBe('value')
    expect(conditionalSpy).toHaveBeenCalledTimes(1)
    obj.run = false
    expect(dummy).toBe('other')
    expect(conditionalSpy).toHaveBeenCalledTimes(2)
    obj.prop = 'value2'
    expect(dummy).toBe('other')
    expect(conditionalSpy).toHaveBeenCalledTimes(2)
  })

  it('should not double wrap if the passed function is a autorun', () => {
    const runner = autorun(() => {})
    const otherRunner = autorun(runner)
    expect(runner).not.toBe(otherRunner)
    expect(runner.raw).toBe(otherRunner.raw)
  })

  it('should not run multiple times for a single mutation', () => {
    let dummy
    const obj: any = observable()
    const fnSpy = jest.fn(() => {
      for (const key in obj) {
        dummy = obj[key]
      }
      dummy = obj.prop
    })
    autorun(fnSpy)

    expect(fnSpy).toHaveBeenCalledTimes(1)
    obj.prop = 16
    expect(dummy).toBe(16)
    expect(fnSpy).toHaveBeenCalledTimes(2)
  })

  it('should allow nested autoruns', () => {
    const nums = observable({ num1: 0, num2: 1, num3: 2 })
    const dummy: any = {}

    const childSpy = jest.fn(() => (dummy.num1 = nums.num1))
    const childautorun = autorun(childSpy)
    const parentSpy = jest.fn(() => {
      dummy.num2 = nums.num2
      childautorun()
      dummy.num3 = nums.num3
    })
    autorun(parentSpy)

    expect(dummy).toEqual({ num1: 0, num2: 1, num3: 2 })
    expect(parentSpy).toHaveBeenCalledTimes(1)
    expect(childSpy).toHaveBeenCalledTimes(2)
    // this should only call the childautorun
    nums.num1 = 4
    expect(dummy).toEqual({ num1: 4, num2: 1, num3: 2 })
    expect(parentSpy).toHaveBeenCalledTimes(1)
    expect(childSpy).toHaveBeenCalledTimes(3)
    // this calls the parentautorun, which calls the childautorun once
    nums.num2 = 10
    expect(dummy).toEqual({ num1: 4, num2: 10, num3: 2 })
    expect(parentSpy).toHaveBeenCalledTimes(2)
    expect(childSpy).toHaveBeenCalledTimes(4)
    // this calls the parentautorun, which calls the childautorun once
    nums.num3 = 7
    expect(dummy).toEqual({ num1: 4, num2: 10, num3: 7 })
    expect(parentSpy).toHaveBeenCalledTimes(3)
    expect(childSpy).toHaveBeenCalledTimes(5)
  })

  it('should observe class method invocations', () => {
    class Model {
      count: number
      constructor() {
        this.count = 0
      }
      inc() {
        this.count++
      }
    }
    const model = observable(new Model())
    let dummy
    autorun(() => {
      dummy = model.count
    })
    expect(dummy).toBe(0)
    model.inc()
    expect(dummy).toBe(1)
  })

  it('scheduler', () => {
    let runner: any, dummy
    const scheduler = jest.fn(_runner => {
      runner = _runner
    })
    const obj = observable({ foo: 1 })
    autorun(
      () => {
        dummy = obj.foo
      },
      { scheduler }
    )
    expect(scheduler).not.toHaveBeenCalled()
    expect(dummy).toBe(1)
    // should be called on first trigger
    obj.foo++
    expect(scheduler).toHaveBeenCalledTimes(1)
    // should not run yet
    expect(dummy).toBe(1)
    // manually run
    runner()
    // should have run
    expect(dummy).toBe(2)
  })

  it('events: onTrack', () => {
    let events: any[] = []
    let dummy
    const onTrack = jest.fn((e: DebuggerEvent) => {
      events.push(e)
    })
    const obj = observable({ foo: 1, bar: 2 })
    const runner = autorun(
      () => {
        dummy = obj.foo
        dummy = 'bar' in obj
        dummy = Object.keys(obj)
      },
      { onTrack }
    )
    expect(dummy).toEqual(['foo', 'bar'])
    expect(onTrack).toHaveBeenCalledTimes(3)
    expect(events).toEqual([
      {
        runner,
        target: unwrap(obj),
        type: OperationTypes.GET,
        key: 'foo'
      },
      {
        runner,
        target: unwrap(obj),
        type: OperationTypes.HAS,
        key: 'bar'
      },
      {
        runner,
        target: unwrap(obj),
        type: OperationTypes.ITERATE,
        key: ITERATE_KEY
      }
    ])
  })

  it('events: onTrigger', () => {
    let events: any[] = []
    let dummy
    const onTrigger = jest.fn((e: DebuggerEvent) => {
      events.push(e)
    })
    const obj = observable({ foo: 1 })
    const runner = autorun(
      () => {
        dummy = obj.foo
      },
      { onTrigger }
    )

    obj.foo++
    expect(dummy).toBe(2)
    expect(onTrigger).toHaveBeenCalledTimes(1)
    expect(events[0]).toEqual({
      runner,
      target: unwrap(obj),
      type: OperationTypes.SET,
      key: 'foo',
      oldValue: 1,
      newValue: 2
    })

    delete obj.foo
    expect(dummy).toBeUndefined()
    expect(onTrigger).toHaveBeenCalledTimes(2)
    expect(events[1]).toEqual({
      runner,
      target: unwrap(obj),
      type: OperationTypes.DELETE,
      key: 'foo',
      oldValue: 2
    })
  })

  it('stop', () => {
    let dummy
    const obj = observable({ prop: 1 })
    const runner = autorun(() => {
      dummy = obj.prop
    })
    obj.prop = 2
    expect(dummy).toBe(2)
    stop(runner)
    obj.prop = 3
    expect(dummy).toBe(2)

    // stopped runner should still be manually callable
    runner()
    expect(dummy).toBe(3)
  })

  it('markNonReactive', () => {
    const obj = observable({
      foo: markNonReactive({
        prop: 0
      })
    })
    let dummy
    autorun(() => {
      dummy = obj.foo.prop
    })
    expect(dummy).toBe(0)
    obj.foo.prop++
    expect(dummy).toBe(0)
    obj.foo = { prop: 1 }
    expect(dummy).toBe(1)
  })
})
