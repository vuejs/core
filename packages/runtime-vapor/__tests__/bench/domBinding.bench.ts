import { type Ref, effectScope } from '@vue/reactivity'
import { nextTick, ref } from '@vue/runtime-dom'
import { toDisplayString } from '@vue/shared'
import { bench, describe } from 'vitest'
import {
  onBinding,
  renderEffect,
  setAttrBinding,
  setBlockHtmlBinding,
  setBlockTextBinding,
  setClassBinding,
  setClassNameBinding,
  setDOMPropBinding,
  setDynamicEvents,
  setDynamicEventsBinding,
  setDynamicPropsBinding,
  setEventBinding,
  setHtmlBinding,
  setMergedDynamicPropsBinding,
  setPropBinding,
  setStyleBinding,
  setTextBinding,
  setValueBinding,
  template,
  txt,
} from '../../src'
import {
  setAttr,
  setBlockHtml,
  setBlockText,
  setClass,
  setClassName,
  setDOMProp,
  setDynamicProps,
  setHtml,
  setProp,
  setStyle,
  setText,
  setValue,
} from '../../src/dom/prop'

const MANY_BINDINGS = 100
const UPDATE_BATCH = 20
const TEXT_UPDATE_BATCH = 100

type Source = Ref<number>
type Setup = (el: any, source: Source, index: number) => void
type TextNodeWithCache = Text & { $txt?: string }

function createDiv(): HTMLElement {
  return document.createElement('div')
}

function createInput(): HTMLInputElement {
  return document.createElement('input')
}

function createTextParent(): ParentNode {
  return template('<div> </div>', 1)() as ParentNode
}

function noop(): void {}

function init(create: () => any, setup: Setup): void {
  const scope = effectScope()
  scope.run(() => {
    const source = ref(0)
    for (let i = 0; i < MANY_BINDINGS; i++) {
      setup(create(), source, i)
    }
  })
  scope.stop()
}

async function update(create: () => any, setup: Setup): Promise<void> {
  const scope = effectScope()
  const source = ref(0)
  try {
    scope.run(() => {
      for (let i = 0; i < MANY_BINDINGS; i++) {
        setup(create(), source, i)
      }
    })
    for (let i = 1; i <= UPDATE_BATCH; i++) {
      source.value = i
      await nextTick()
    }
  } finally {
    scope.stop()
  }
}

function benchBinding(
  name: string,
  create: () => any,
  oldPath: Setup,
  bindingPath: Setup,
): void {
  describe(name, () => {
    describe('update', () => {
      bench('renderEffect + setter', async () => {
        await update(create, oldPath)
      })

      bench('binding helper', async () => {
        await update(create, bindingPath)
      })
    })

    describe('init', () => {
      bench('renderEffect + setter', () => {
        init(create, oldPath)
      })

      bench('binding helper', () => {
        init(create, bindingPath)
      })
    })
  })
}

function initText(oldPath: boolean): void {
  const scope = effectScope()
  scope.run(() => {
    const parent = createTextParent()
    const source = ref(0)
    if (oldPath) {
      const text = txt(parent) as TextNodeWithCache
      renderEffect(() => setText(text, toDisplayString(source.value)))
    } else {
      setTextBinding(parent, () => toDisplayString(source.value))
    }
  })
  scope.stop()
}

async function updateText(oldPath: boolean): Promise<void> {
  const scope = effectScope()
  const source = ref(0)
  try {
    scope.run(() => {
      const parent = createTextParent()
      if (oldPath) {
        const text = txt(parent) as TextNodeWithCache
        renderEffect(() => setText(text, toDisplayString(source.value)))
      } else {
        setTextBinding(parent, () => toDisplayString(source.value))
      }
    })
    for (let i = 1; i <= TEXT_UPDATE_BATCH; i++) {
      source.value = i
      await nextTick()
    }
  } finally {
    scope.stop()
  }
}

async function updateManyText(oldPath: boolean): Promise<void> {
  const scope = effectScope()
  const source = ref(0)
  try {
    scope.run(() => {
      for (let i = 0; i < MANY_BINDINGS; i++) {
        const parent = createTextParent()
        if (oldPath) {
          const text = txt(parent) as TextNodeWithCache
          renderEffect(() => setText(text, toDisplayString(source.value + i)))
        } else {
          setTextBinding(parent, () => toDisplayString(source.value + i))
        }
      }
    })
    for (let i = 1; i <= UPDATE_BATCH; i++) {
      source.value = i
      await nextTick()
    }
  } finally {
    scope.stop()
  }
}

describe('DOM binding effects', () => {
  describe('setText', () => {
    describe('update', () => {
      bench('txt + renderEffect + setText', async () => {
        await updateText(true)
      })

      bench('setTextBinding', async () => {
        await updateText(false)
      })
    })

    describe('update many bindings', () => {
      bench('txt + renderEffect + setText', async () => {
        await updateManyText(true)
      })

      bench('setTextBinding', async () => {
        await updateManyText(false)
      })
    })

    describe('init', () => {
      bench('txt + renderEffect + setText', () => {
        initText(true)
      })

      bench('setTextBinding', () => {
        initText(false)
      })
    })
  })

  benchBinding(
    'setProp',
    createDiv,
    (el, source) => {
      renderEffect(() => setProp(el, 'id', source.value))
    },
    (el, source) => {
      setPropBinding(el, 'id', () => source.value)
    },
  )

  benchBinding(
    'setAttr',
    createDiv,
    (el, source) => {
      renderEffect(() => setAttr(el, 'data-id', source.value))
    },
    (el, source) => {
      setAttrBinding(el, 'data-id', () => source.value)
    },
  )

  benchBinding(
    'setDOMProp',
    createDiv,
    (el, source) => {
      renderEffect(() => setDOMProp(el, 'title', source.value))
    },
    (el, source) => {
      setDOMPropBinding(el, 'title', () => source.value)
    },
  )

  benchBinding(
    'setValue',
    createInput,
    (el, source) => {
      renderEffect(() => setValue(el, source.value))
    },
    (el, source) => {
      setValueBinding(el, () => source.value)
    },
  )

  benchBinding(
    'setClass',
    createDiv,
    (el, source) => {
      renderEffect(() => setClass(el, source.value & 1 ? 'one' : 'two'))
    },
    (el, source) => {
      setClassBinding(el, () => (source.value & 1 ? 'one' : 'two'))
    },
  )

  benchBinding(
    'setClassName',
    createDiv,
    (el, source) => {
      renderEffect(() => setClassName(el, source.value & 1 ? 1 : 0, 'one'))
    },
    (el, source) => {
      setClassNameBinding(el, () => (source.value & 1 ? 1 : 0), 'one')
    },
  )

  benchBinding(
    'setStyle',
    createDiv,
    (el, source) => {
      renderEffect(() =>
        setStyle(el, { color: source.value & 1 ? 'red' : 'blue' }),
      )
    },
    (el, source) => {
      setStyleBinding(el, () => ({
        color: source.value & 1 ? 'red' : 'blue',
      }))
    },
  )

  benchBinding(
    'setHtml',
    createDiv,
    (el, source) => {
      renderEffect(() => setHtml(el, `<span>${source.value}</span>`))
    },
    (el, source) => {
      setHtmlBinding(el, () => `<span>${source.value}</span>`)
    },
  )

  benchBinding(
    'setBlockText',
    createDiv,
    (el, source) => {
      renderEffect(() => setBlockText(el, source.value))
    },
    (el, source) => {
      setBlockTextBinding(el, () => source.value)
    },
  )

  benchBinding(
    'setBlockHtml',
    createDiv,
    (el, source) => {
      renderEffect(() => setBlockHtml(el, `<span>${source.value}</span>`))
    },
    (el, source) => {
      setBlockHtmlBinding(el, () => `<span>${source.value}</span>`)
    },
  )

  benchBinding(
    'setDynamicProps',
    createDiv,
    (el, source) => {
      renderEffect(() =>
        setDynamicProps(el, [
          { id: `id-${source.value}`, class: source.value & 1 ? 'one' : 'two' },
        ]),
      )
    },
    (el, source) => {
      setDynamicPropsBinding(el, () => [
        { id: `id-${source.value}`, class: source.value & 1 ? 'one' : 'two' },
      ])
    },
  )

  describe('setMergedDynamicProps', () => {
    const arrayGetterPath: Setup = (el, source) => {
      setDynamicPropsBinding(el, () => [
        { id: 'static-id' },
        { title: `title-${source.value}` },
        { class: 'static-class' },
      ])
    }
    const mergedSourcesPath: Setup = (el, source) => {
      setMergedDynamicPropsBinding(
        el,
        { id: 'static-id' },
        () => ({ title: `title-${source.value}` }),
        { class: 'static-class' },
      )
    }

    describe('update', () => {
      bench('array getter helper', async () => {
        await update(createDiv, arrayGetterPath)
      })

      bench('merged sources helper', async () => {
        await update(createDiv, mergedSourcesPath)
      })
    })

    describe('init', () => {
      bench('array getter helper', () => {
        init(createDiv, arrayGetterPath)
      })

      bench('merged sources helper', () => {
        init(createDiv, mergedSourcesPath)
      })
    })
  })

  benchBinding(
    'setEvent',
    createDiv,
    (el, source) => {
      renderEffect(() =>
        onBinding(el, source.value & 1 ? 'click' : 'mouseover', noop),
      )
    },
    (el, source) => {
      setEventBinding(
        el,
        () => (source.value & 1 ? 'click' : 'mouseover'),
        noop,
      )
    },
  )

  benchBinding(
    'setDynamicEvents',
    createDiv,
    (el, source) => {
      renderEffect(() =>
        setDynamicEvents(el, {
          [source.value & 1 ? 'click' : 'mouseover']: noop,
        }),
      )
    },
    (el, source) => {
      setDynamicEventsBinding(el, () => ({
        [source.value & 1 ? 'click' : 'mouseover']: noop,
      }))
    },
  )
})
