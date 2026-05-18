import { effectScope } from '@vue/reactivity'
import { nextTick, ref } from '@vue/runtime-dom'
import { toDisplayString } from '@vue/shared'
import { bench, describe } from 'vitest'
import { renderEffect, setTextBinding, template } from '../../src'
import { txt } from '../../src/dom/node'
import { setText } from '../../src/dom/prop'

type TextNodeWithCache = Text & { $txt?: string }

const BATCH = 100
const MANY_BINDINGS = 100
const MANY_BATCH = 20

function createParent(): ParentNode {
  return template('<div> </div>', 1)() as ParentNode
}

function initOldPath(): void {
  const scope = effectScope()
  scope.run(() => {
    const parent = createParent()
    const text = txt(parent) as TextNodeWithCache
    const source = ref(0)
    renderEffect(() => setText(text, toDisplayString(source.value)))
  })
  scope.stop()
}

function initBindingEffect(): void {
  const scope = effectScope()
  scope.run(() => {
    const parent = createParent()
    const source = ref(0)
    setTextBinding(parent, () => toDisplayString(source.value))
  })
  scope.stop()
}

async function updateOldPath(): Promise<void> {
  const scope = effectScope()
  const source = ref(0)
  try {
    scope.run(() => {
      const parent = createParent()
      const text = txt(parent) as TextNodeWithCache
      renderEffect(() => setText(text, toDisplayString(source.value)))
    })
    for (let i = 1; i <= BATCH; i++) {
      source.value = i
      await nextTick()
    }
  } finally {
    scope.stop()
  }
}

async function updateBindingEffect(): Promise<void> {
  const scope = effectScope()
  const source = ref(0)
  try {
    scope.run(() => {
      const parent = createParent()
      setTextBinding(parent, () => toDisplayString(source.value))
    })
    for (let i = 1; i <= BATCH; i++) {
      source.value = i
      await nextTick()
    }
  } finally {
    scope.stop()
  }
}

async function updateManyOldPath(): Promise<void> {
  const scope = effectScope()
  const source = ref(0)
  try {
    scope.run(() => {
      for (let i = 0; i < MANY_BINDINGS; i++) {
        const parent = createParent()
        const text = txt(parent) as TextNodeWithCache
        renderEffect(() => setText(text, toDisplayString(source.value + i)))
      }
    })
    for (let i = 1; i <= MANY_BATCH; i++) {
      source.value = i
      await nextTick()
    }
  } finally {
    scope.stop()
  }
}

async function updateManyBindingEffect(): Promise<void> {
  const scope = effectScope()
  const source = ref(0)
  try {
    scope.run(() => {
      for (let i = 0; i < MANY_BINDINGS; i++) {
        const parent = createParent()
        setTextBinding(parent, () => toDisplayString(source.value + i))
      }
    })
    for (let i = 1; i <= MANY_BATCH; i++) {
      source.value = i
      await nextTick()
    }
  } finally {
    scope.stop()
  }
}

describe('text binding effect', () => {
  describe('update', () => {
    bench('txt + renderEffect + setText', async () => {
      await updateOldPath()
    })

    bench('setTextBinding', async () => {
      await updateBindingEffect()
    })
  })

  describe('update many bindings', () => {
    bench('txt + renderEffect + setText', async () => {
      await updateManyOldPath()
    })

    bench('setTextBinding', async () => {
      await updateManyBindingEffect()
    })
  })

  describe('init', () => {
    bench('txt + renderEffect + setText', () => {
      initOldPath()
    })

    bench('setTextBinding', () => {
      initBindingEffect()
    })
  })
})
