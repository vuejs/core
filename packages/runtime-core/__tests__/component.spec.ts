import {
  type ComponentInternalInstance,
  getCurrentInstance,
  h,
  nodeOps,
  render,
} from '@vue/runtime-test'
import { formatComponentName } from '../src/component'

describe('formatComponentName', () => {
  test('default name', () => {
    let instance: ComponentInternalInstance | null = null
    const Comp = {
      setup() {
        instance = getCurrentInstance()
        return () => null
      },
    }
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

    expect(formatComponentName(instance, Comp)).toBe('ToggleButton')
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

    expect(formatComponentName(instance, Comp)).toBe('ListItem')
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

    expect(formatComponentName(instance, Comp)).toBe('FieldLabel')
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
