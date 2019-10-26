import {
  createApp,
  nodeOps,
  getCurrentInstance,
  mockWarn
} from '@vue/runtime-test'

import { ComponentInternalInstance } from '../src/component'
import { PropType } from '../src/componentProps'

describe('component props', () => {
  mockWarn()

  it('props should work', () => {
    const app = createApp()
    let instanceProxy: any
    const Comp = {
      props: {
        num: Number,
        s: String,
        obj1: {
          type: String,
          required: true
        },
        obj2: {
          default: 'hello'
        },
        arr1: Array as PropType<string[]>,
        arr2: {
          type: Array as PropType<string[]>,
          required: true
        },
        // explicit type casting with constructor
        propctor1: Array as () => string[],
        propctr2: {
          type: Array as () => string[],
          required: true
        }
      },
      setup() {
        return () => null
      },
      mounted() {
        instanceProxy = this
      }
    }
    app.mount(Comp, nodeOps.createElement('div'), {
      num: 1,
      s: 'hello',
      obj1: 'obj1',
      obj2: 'obj2',
      arr1: ['1', '2'],
      arr2: ['3', '4'],
      propctor1: ['5', '6'],
      propctr2: ['7', '8']
    })
    expect(instanceProxy.num).toBe(1)
    expect(instanceProxy.s).toBe('hello')
    expect(instanceProxy.obj1).toBe('obj1')
    expect(instanceProxy.obj2).toBe('obj2')
    expect(['1', '2']).toEqual(expect.arrayContaining(instanceProxy.arr1))
    expect(['3', '4']).toEqual(expect.arrayContaining(instanceProxy.arr2))
    expect(['5', '6']).toEqual(expect.arrayContaining(instanceProxy.propctor1))
    expect(['7', '8']).toEqual(expect.arrayContaining(instanceProxy.propctr2))
  })

  it('props reserved key', () => {
    const app = createApp()
    let instanceProxy: any
    const Comp = {
      props: {
        $key: String,
        $ref: String,
        $slots: String,
        key: String,
        ref: String,
        onVnode1: String
      },
      mounted() {
        instanceProxy = this
      },
      render() {
        return null
      }
    }
    app.mount(Comp, nodeOps.createElement('div'), {
      $key: 'key',
      $ref: 'ref',
      $slots: 'slots',
      key: 'key1',
      ref: 'ref1',
      onVnode1: 'onVnode1'
    })

    expect(
      `Invalid prop name: "$key" is a reserved property.`
    ).toHaveBeenWarned()
    expect(
      `Invalid prop name: "$ref" is a reserved property.`
    ).toHaveBeenWarned()
    expect(
      `Invalid prop name: "$slots" is a reserved property.`
    ).toHaveBeenWarned()
    expect(instanceProxy.key).toBeUndefined()
    expect(instanceProxy.ref).toBeUndefined()
    expect(instanceProxy.onVnode1).toBeUndefined()
  })

  it('props declared default value and validator', () => {
    const app = createApp()
    let instanceProxy: any
    const Comp = {
      props: {
        obj1: {
          type: String,
          required: true,
          default: 'obj1'
        },
        obj2: {
          type: String,
          default: 'obj2'
        },
        obj3: {
          type: String
        },
        obj4: {
          type: String,
          default: () => {
            return 'obj4'
          }
        },
        obj5: {
          type: String,
          required: true
        },
        obj6: {
          type: String,
          validator: (value: String) => {
            return value !== 'obj6'
          }
        }
      },
      setup() {
        return () => null
      },
      mounted() {
        instanceProxy = this
      }
    }
    app.mount(Comp, nodeOps.createElement('div'), {
      obj1: 'obj11',
      obj6: 'obj6'
    })

    expect(instanceProxy.obj1).toBe('obj11')
    expect(instanceProxy.obj2).toBe('obj2')
    expect(instanceProxy.obj3).toBeUndefined()
    expect(instanceProxy.obj4).toBe('obj4')
    expect(`Missing required prop: "obj5"`).toHaveBeenWarned()
    expect(
      `Invalid prop: custom validator check failed for prop "obj6"`
    ).toHaveBeenWarned()
  })

  it('no declared props move to attrs', () => {
    const app = createApp()
    let instanceProxy: any
    let instance: ComponentInternalInstance
    const Comp = {
      props: {
        obj1: {
          type: String,
          default: 'obj1'
        }
      },
      setup() {
        return () => null
      },
      mounted() {
        instance = getCurrentInstance()!
        instanceProxy = this
      }
    }
    app.mount(Comp, nodeOps.createElement('div'), {
      obj2: 'obj2'
    })

    expect(instanceProxy.obj1).toBe('obj1')
    expect(instanceProxy.obj2).toBeUndefined()
    expect(instance!.attrs.obj2).toBe('obj2')
  })

  it('props camelize', () => {
    const app = createApp()
    let instanceProxy: any
    const Comp = {
      props: {
        'obj-test-1': String
      },
      setup() {
        return () => null
      },
      mounted() {
        instanceProxy = this
      }
    }
    app.mount(Comp, nodeOps.createElement('div'), {
      'obj-test-1': 'obj1'
    })

    expect(instanceProxy.objTest1).toBe('obj1')
  })

  it('props boolean cast', () => {
    const app = createApp()
    let instanceProxy: any
    const Comp = {
      props: {
        obj1: Boolean,
        obj2: [Boolean, String],
        'obj-3': [Boolean, String]
      },
      setup() {
        return () => null
      },
      mounted() {
        instanceProxy = this
      }
    }
    app.mount(Comp, nodeOps.createElement('div'), {
      obj2: '', // true
      'obj-3': 'obj3' // true
    })

    expect(instanceProxy.obj1).toBe(false)
    expect(instanceProxy.obj2).toBe(true)
    expect(instanceProxy.obj3).toBe(true)
  })

  it('props type invalid message', () => {
    const app = createApp()
    const Comp = {
      props: {
        obj1: String,
        obj2: Number,
        obj3: [String]
      },
      mounted() {},
      render() {
        return null
      }
    }
    app.mount(Comp, nodeOps.createElement('div'), {
      obj1: 1,
      obj2: 'obj2',
      obj3: 2
    })

    expect(
      `Invalid prop: type check failed for prop "obj1". Expected String with value "1", got Number with value 1`
    ).toHaveBeenWarned()
    expect(
      `Invalid prop: type check failed for prop "obj2". Expected Number with value NaN, got String with value "obj2`
    ).toHaveBeenWarned()
    expect(
      `Invalid prop: type check failed for prop "obj3". Expected String with value "2", got Number with value 2.`
    ).toHaveBeenWarned()
  })
})
