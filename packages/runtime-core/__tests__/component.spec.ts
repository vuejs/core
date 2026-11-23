import {
  type ComponentInternalInstance,
  type EffectScope,
  getCurrentInstance,
  getCurrentScope,
  h,
  nextTick,
  nodeOps,
  ref,
  render,
  serializeInner,
  watch,
} from '@vue/runtime-test'
import { type GenericComponent, formatComponentName } from '../src/component'

describe('formatComponentName', () => {
  test('default name', () => {
    let instance: ComponentInternalInstance | null = null
    const Comp = {
      setup() {
        instance = getCurrentInstance()
        return () => null
      },
    } as GenericComponent
    render(h(Comp), nodeOps.createElement('div'))

    expect(formatComponentName(null, Comp)).toBe('Anonymous')
    expect(formatComponentName(null, Comp, true)).toBe('App')
    expect(formatComponentName(instance, Comp)).toBe('Anonymous')
    expect(formatComponentName(instance, Comp, true)).toBe('App')
  })

  test('name option', () => {
    let instance: ComponentInternalInstance | null = null
    const Comp = {
      name: 'number-input',
      setup() {
        instance = getCurrentInstance()
        return () => null
      },
    }
    render(h(Comp), nodeOps.createElement('div'))

    expect(formatComponentName(null, Comp)).toBe('NumberInput')
    expect(formatComponentName(instance, Comp, true)).toBe('NumberInput')
  })

  test('self recursive name', () => {
    let instance: ComponentInternalInstance | null = null
    const Comp = {
      components: {} as any,
      setup() {
        instance = getCurrentInstance()
        return () => null
      },
    }
    Comp.components.ToggleButton = Comp
    render(h(Comp), nodeOps.createElement('div'))

    expect(formatComponentName(instance, Comp as GenericComponent)).toBe(
      'ToggleButton',
    )
  })

  test('name from parent', () => {
    let instance: ComponentInternalInstance | null = null
    const Comp = {
      setup() {
        instance = getCurrentInstance()
        return () => null
      },
    }
    const Parent = {
      components: {
        list_item: Comp,
      },
      render() {
        return h(Comp)
      },
    }
    render(h(Parent), nodeOps.createElement('div'))

    expect(formatComponentName(instance, Comp as GenericComponent)).toBe(
      'ListItem',
    )
  })

  test('functional components', () => {
    const UserAvatar = () => null
    expect(formatComponentName(null, UserAvatar)).toBe('UserAvatar')
    UserAvatar.displayName = 'UserPicture'
    expect(formatComponentName(null, UserAvatar)).toBe('UserPicture')
    expect(formatComponentName(null, () => null)).toBe('Anonymous')
  })

  test('Name from file', () => {
    const Comp = {
      __file: './src/locale-dropdown.vue',
    }

    expect(formatComponentName(null, Comp)).toBe('LocaleDropdown')
  })

  test('inferred name', () => {
    const Comp = {
      __name: 'MainSidebar',
    }

    expect(formatComponentName(null, Comp)).toBe('MainSidebar')
  })

  test('global component', () => {
    let instance: ComponentInternalInstance | null = null
    const Comp = {
      setup() {
        instance = getCurrentInstance()
        return () => null
      },
    }
    render(h(Comp), nodeOps.createElement('div'))

    instance!.appContext.components.FieldLabel = Comp

    expect(formatComponentName(instance, Comp as GenericComponent)).toBe(
      'FieldLabel',
    )
  })

  test('name precedence', () => {
    let instance: ComponentInternalInstance | null = null
    const Dummy = () => null
    const Comp: Record<string, any> = {
      components: { Dummy },
      setup() {
        instance = getCurrentInstance()
        return () => null
      },
    }
    const Parent = {
      components: { Dummy } as any,
      render() {
        return h(Comp)
      },
    }
    render(h(Parent), nodeOps.createElement('div'))

    expect(formatComponentName(instance, Comp)).toBe('Anonymous')
    expect(formatComponentName(instance, Comp, true)).toBe('App')

    instance!.appContext.components.CompA = Comp
    expect(formatComponentName(instance, Comp)).toBe('CompA')
    expect(formatComponentName(instance, Comp, true)).toBe('CompA')

    Parent.components.CompB = Comp
    expect(formatComponentName(instance, Comp)).toBe('CompB')

    Comp.components.CompC = Comp
    expect(formatComponentName(instance, Comp)).toBe('CompC')

    Comp.__file = './CompD.js'
    expect(formatComponentName(instance, Comp)).toBe('CompD')

    Comp.__name = 'CompE'
    expect(formatComponentName(instance, Comp)).toBe('CompE')

    Comp.name = 'CompF'
    expect(formatComponentName(instance, Comp)).toBe('CompF')
  })
})

describe('component scope pause', () => {
  test('pausing a component scope pauses its descendants until it resumes', async () => {
    const count = ref(0)
    const log: string[] = []
    let scope!: EffectScope
    const Leaf = {
      setup: () => () => (log.push('leaf'), h('i', count.value)),
    }
    const Parent = {
      setup() {
        scope = getCurrentScope()!
        return () => h('div', [h(Leaf)])
      },
    }
    const root = nodeOps.createElement('div')
    render(h(Parent), root)
    log.length = 0

    scope.pause()
    count.value++
    await nextTick()
    expect(log).toEqual([])
    expect(serializeInner(root)).toBe('<div><i>0</i></div>')

    scope.resume()
    await nextTick()
    expect(log).toEqual(['leaf'])
    expect(serializeInner(root)).toBe('<div><i>1</i></div>')
  })

  test('a render queued before its scope pauses waits for the resume', async () => {
    const count = ref(0)
    const log: string[] = []
    let scope!: EffectScope
    const Comp = {
      setup() {
        scope = getCurrentScope()!
        watch(count, () => log.push('watcher'))
        return () => (log.push('render'), h('div', count.value))
      },
    }
    const root = nodeOps.createElement('div')
    render(h(Comp), root)
    log.length = 0

    count.value++
    scope.pause()
    await nextTick()
    expect(log).toEqual([])

    scope.resume()
    await nextTick()
    expect(log).toEqual(['watcher', 'render'])
    expect(serializeInner(root)).toBe('<div>1</div>')
  })
})
