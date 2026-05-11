import { bench, describe } from 'vitest'
import { setClass, setClassName } from '../../src/dom/prop'

type TargetElement = HTMLElement & {
  $cls?: string
  $clsFlags?: number
}

const BATCH = 100

const stable2 = [3, 3, 3, 3]
const stable4 = [15, 15, 15, 15]
const stable8 = [255, 255, 255, 255]

const toggle = (i: number, all: number): number => (i & 1 ? all : 0)

const sparse = (i: number, all: number): number => {
  const phase = i & 7
  return phase < 6 ? all : 0
}

function createEl(): TargetElement {
  const el = document.createElement('div') as TargetElement
  el.className = 'base'
  return el
}

function createEmptyEl(): TargetElement {
  return document.createElement('div') as TargetElement
}

function createRootEl(): TargetElement {
  const el = document.createElement('div') as TargetElement
  ;(el as any).$root = true
  el.className = 'fallthrough'
  return el
}

function currentSetClassTernary1(el: TargetElement, state: number): void {
  setClass(el, state ? 'danger' : '')
}

function currentSetClassObject1(el: TargetElement, state: number): void {
  setClass(el, { danger: state })
}

function currentSetClass2(el: TargetElement, state: number): void {
  setClass(el, [
    'base',
    {
      c0: state & 1,
      c1: state & 2,
    },
  ])
}

function currentSetClass4(el: TargetElement, state: number): void {
  setClass(el, [
    'base',
    {
      c0: state & 1,
      c1: state & 2,
      c2: state & 4,
      c3: state & 8,
    },
  ])
}

function currentSetClass8(el: TargetElement, state: number): void {
  setClass(el, [
    'base',
    {
      c0: state & 1,
      c1: state & 2,
      c2: state & 4,
      c3: state & 8,
      c4: state & 16,
      c5: state & 32,
      c6: state & 64,
      c7: state & 128,
    },
  ])
}

function currentSetClassName1(el: TargetElement, state: number): void {
  setClassName(el, state ? 1 : 0, ['danger'])
}

function currentSetClassName2(el: TargetElement, state: number): void {
  setClassName(
    el,
    (state & 1 ? 1 : 0) | (state & 2 ? 2 : 0),
    [' c0', ' c1'],
    'base',
  )
}

function currentSetClassName4(el: TargetElement, state: number): void {
  setClassName(
    el,
    (state & 1 ? 1 : 0) |
      (state & 2 ? 2 : 0) |
      (state & 4 ? 4 : 0) |
      (state & 8 ? 8 : 0),
    [' c0', ' c1', ' c2', ' c3'],
    'base',
  )
}

function currentSetClassName8(el: TargetElement, state: number): void {
  setClassName(
    el,
    (state & 1 ? 1 : 0) |
      (state & 2 ? 2 : 0) |
      (state & 4 ? 4 : 0) |
      (state & 8 ? 8 : 0) |
      (state & 16 ? 16 : 0) |
      (state & 32 ? 32 : 0) |
      (state & 64 ? 64 : 0) |
      (state & 128 ? 128 : 0),
    [' c0', ' c1', ' c2', ' c3', ' c4', ' c5', ' c6', ' c7'],
    'base',
  )
}

describe('setClass', () => {
  describe('1 key without base', () => {
    {
      const el = createEmptyEl()
      let i = 0
      bench('setClass ternary stable', () => {
        for (let j = 0; j < BATCH; j++) {
          currentSetClassTernary1(el, stable2[i++ & 3] & 1)
        }
      })
    }

    {
      const el = createEmptyEl()
      let i = 0
      bench('setClass object stable', () => {
        for (let j = 0; j < BATCH; j++) {
          currentSetClassObject1(el, stable2[i++ & 3] & 1)
        }
      })
    }

    {
      const el = createEmptyEl()
      let i = 0
      bench('setClassName stable', () => {
        for (let j = 0; j < BATCH; j++) {
          currentSetClassName1(el, stable2[i++ & 3] & 1)
        }
      })
    }

    {
      const el = createEmptyEl()
      let i = 0
      bench('setClass ternary toggles every update', () => {
        for (let j = 0; j < BATCH; j++) {
          currentSetClassTernary1(el, toggle(i++, 1))
        }
      })
    }

    {
      const el = createEmptyEl()
      let i = 0
      bench('setClass object toggles every update', () => {
        for (let j = 0; j < BATCH; j++) {
          currentSetClassObject1(el, toggle(i++, 1))
        }
      })
    }

    {
      const el = createEmptyEl()
      let i = 0
      bench('setClassName toggles every update', () => {
        for (let j = 0; j < BATCH; j++) {
          currentSetClassName1(el, toggle(i++, 1))
        }
      })
    }
  })

  describe('1 key root without base', () => {
    {
      const el = createRootEl()
      let i = 0
      bench('setClass ternary stable', () => {
        for (let j = 0; j < BATCH; j++) {
          currentSetClassTernary1(el, stable2[i++ & 3] & 1)
        }
      })
    }

    {
      const el = createRootEl()
      let i = 0
      bench('setClass object stable', () => {
        for (let j = 0; j < BATCH; j++) {
          currentSetClassObject1(el, stable2[i++ & 3] & 1)
        }
      })
    }

    {
      const el = createRootEl()
      let i = 0
      bench('setClassName stable', () => {
        for (let j = 0; j < BATCH; j++) {
          currentSetClassName1(el, stable2[i++ & 3] & 1)
        }
      })
    }

    {
      const el = createRootEl()
      let i = 0
      bench('setClass ternary toggles every update', () => {
        for (let j = 0; j < BATCH; j++) {
          currentSetClassTernary1(el, toggle(i++, 1))
        }
      })
    }

    {
      const el = createRootEl()
      let i = 0
      bench('setClass object toggles every update', () => {
        for (let j = 0; j < BATCH; j++) {
          currentSetClassObject1(el, toggle(i++, 1))
        }
      })
    }

    {
      const el = createRootEl()
      let i = 0
      bench('setClassName toggles every update', () => {
        for (let j = 0; j < BATCH; j++) {
          currentSetClassName1(el, toggle(i++, 1))
        }
      })
    }
  })

  describe('2 keys', () => {
    {
      const el = createEl()
      let i = 0
      bench('setClass stable', () => {
        for (let j = 0; j < BATCH; j++) currentSetClass2(el, stable2[i++ & 3])
      })
    }

    {
      const el = createEl()
      let i = 0
      bench('setClassName stable', () => {
        for (let j = 0; j < BATCH; j++)
          currentSetClassName2(el, stable2[i++ & 3])
      })
    }

    {
      const el = createEl()
      let i = 0
      bench('setClass toggles every update', () => {
        for (let j = 0; j < BATCH; j++) currentSetClass2(el, toggle(i++, 3))
      })
    }

    {
      const el = createEl()
      let i = 0
      bench('setClassName toggles every update', () => {
        for (let j = 0; j < BATCH; j++) currentSetClassName2(el, toggle(i++, 3))
      })
    }
  })

  describe('4 keys', () => {
    {
      const el = createEl()
      let i = 0
      bench('setClass stable', () => {
        for (let j = 0; j < BATCH; j++) currentSetClass4(el, stable4[i++ & 3])
      })
    }

    {
      const el = createEl()
      let i = 0
      bench('setClassName stable', () => {
        for (let j = 0; j < BATCH; j++)
          currentSetClassName4(el, stable4[i++ & 3])
      })
    }

    {
      const el = createEl()
      let i = 0
      bench('setClass toggles every update', () => {
        for (let j = 0; j < BATCH; j++) currentSetClass4(el, toggle(i++, 15))
      })
    }

    {
      const el = createEl()
      let i = 0
      bench('setClassName toggles every update', () => {
        for (let j = 0; j < BATCH; j++)
          currentSetClassName4(el, toggle(i++, 15))
      })
    }

    {
      const el = createEl()
      let i = 0
      bench('setClass sparse churn', () => {
        for (let j = 0; j < BATCH; j++) currentSetClass4(el, sparse(i++, 15))
      })
    }

    {
      const el = createEl()
      let i = 0
      bench('setClassName sparse churn', () => {
        for (let j = 0; j < BATCH; j++)
          currentSetClassName4(el, sparse(i++, 15))
      })
    }
  })

  describe('8 keys', () => {
    {
      const el = createEl()
      let i = 0
      bench('setClass stable', () => {
        for (let j = 0; j < BATCH; j++) currentSetClass8(el, stable8[i++ & 3])
      })
    }

    {
      const el = createEl()
      let i = 0
      bench('setClassName stable', () => {
        for (let j = 0; j < BATCH; j++)
          currentSetClassName8(el, stable8[i++ & 3])
      })
    }

    {
      const el = createEl()
      let i = 0
      bench('setClass toggles every update', () => {
        for (let j = 0; j < BATCH; j++) currentSetClass8(el, toggle(i++, 255))
      })
    }

    {
      const el = createEl()
      let i = 0
      bench('setClassName toggles every update', () => {
        for (let j = 0; j < BATCH; j++)
          currentSetClassName8(el, toggle(i++, 255))
      })
    }

    {
      const el = createEl()
      let i = 0
      bench('setClass sparse churn', () => {
        for (let j = 0; j < BATCH; j++) currentSetClass8(el, sparse(i++, 255))
      })
    }

    {
      const el = createEl()
      let i = 0
      bench('setClassName sparse churn', () => {
        for (let j = 0; j < BATCH; j++)
          currentSetClassName8(el, sparse(i++, 255))
      })
    }
  })
})
