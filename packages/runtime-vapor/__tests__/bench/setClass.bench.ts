import { describe, test } from 'vite-plus/test'
import { setClass, setClassName } from '../../src/dom/prop'

type TargetElement = HTMLElement & {
  $root?: true
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
  el.$root = true
  el.className = 'fallthrough'
  return el
}

function currentSetClassTernary1(el: TargetElement, state: number): void {
  setClass(el, state ? 'danger' : '')
}

function currentSetClassObject1(el: TargetElement, state: number): void {
  setClass(el, { danger: state })
}

function currentSetClassObject1WithBase(
  el: TargetElement,
  state: number,
): void {
  setClass(el, ['base', { danger: state }])
}

// Mirrors generated output for a single dynamic class fragment. The compiler
// passes a string here so stable updates allocate no fragment array.
function currentSetClassName1(el: TargetElement, state: number): void {
  setClassName(el, state ? 1 : 0, 'danger')
}

// Static base classes are folded into the prefix argument. The dynamic fragment
// keeps its leading space so the runtime can concatenate without joining arrays.
function currentSetClassName1WithBase(el: TargetElement, state: number): void {
  setClassName(el, state ? 1 : 0, ' danger', 'base')
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
    test('stable', async ({ bench }) => {
      const ternaryEl = createEmptyEl()
      let ternaryIndex = 0
      const objectEl = createEmptyEl()
      let objectIndex = 0
      const classNameEl = createEmptyEl()
      let classNameIndex = 0

      await bench.compare(
        bench('setClass (ternary)', () => {
          for (let j = 0; j < BATCH; j++) {
            currentSetClassTernary1(ternaryEl, stable2[ternaryIndex++ & 3] & 1)
          }
        }),
        bench('setClass (object)', () => {
          for (let j = 0; j < BATCH; j++) {
            currentSetClassObject1(objectEl, stable2[objectIndex++ & 3] & 1)
          }
        }),
        bench('setClassName', () => {
          for (let j = 0; j < BATCH; j++) {
            currentSetClassName1(classNameEl, stable2[classNameIndex++ & 3] & 1)
          }
        }),
      )
    })

    test('toggles every update', async ({ bench }) => {
      const ternaryEl = createEmptyEl()
      let ternaryIndex = 0
      const objectEl = createEmptyEl()
      let objectIndex = 0
      const classNameEl = createEmptyEl()
      let classNameIndex = 0

      await bench.compare(
        bench('setClass (ternary)', () => {
          for (let j = 0; j < BATCH; j++) {
            currentSetClassTernary1(ternaryEl, toggle(ternaryIndex++, 1))
          }
        }),
        bench('setClass (object)', () => {
          for (let j = 0; j < BATCH; j++) {
            currentSetClassObject1(objectEl, toggle(objectIndex++, 1))
          }
        }),
        bench('setClassName', () => {
          for (let j = 0; j < BATCH; j++) {
            currentSetClassName1(classNameEl, toggle(classNameIndex++, 1))
          }
        }),
      )
    })
  })

  describe('1 key with base', () => {
    test('stable', async ({ bench }) => {
      const objectEl = createEl()
      let objectIndex = 0
      const classNameEl = createEl()
      let classNameIndex = 0

      await bench.compare(
        bench('setClass (object)', () => {
          for (let j = 0; j < BATCH; j++) {
            currentSetClassObject1WithBase(
              objectEl,
              stable2[objectIndex++ & 3] & 1,
            )
          }
        }),
        bench('setClassName', () => {
          for (let j = 0; j < BATCH; j++) {
            currentSetClassName1WithBase(
              classNameEl,
              stable2[classNameIndex++ & 3] & 1,
            )
          }
        }),
      )
    })

    test('toggles every update', async ({ bench }) => {
      const objectEl = createEl()
      let objectIndex = 0
      const classNameEl = createEl()
      let classNameIndex = 0

      await bench.compare(
        bench('setClass (object)', () => {
          for (let j = 0; j < BATCH; j++) {
            currentSetClassObject1WithBase(objectEl, toggle(objectIndex++, 1))
          }
        }),
        bench('setClassName', () => {
          for (let j = 0; j < BATCH; j++) {
            currentSetClassName1WithBase(
              classNameEl,
              toggle(classNameIndex++, 1),
            )
          }
        }),
      )
    })
  })

  describe('1 key root without base', () => {
    test('stable', async ({ bench }) => {
      const ternaryEl = createRootEl()
      let ternaryIndex = 0
      const objectEl = createRootEl()
      let objectIndex = 0
      const classNameEl = createRootEl()
      let classNameIndex = 0

      await bench.compare(
        bench('setClass (ternary)', () => {
          for (let j = 0; j < BATCH; j++) {
            currentSetClassTernary1(ternaryEl, stable2[ternaryIndex++ & 3] & 1)
          }
        }),
        bench('setClass (object)', () => {
          for (let j = 0; j < BATCH; j++) {
            currentSetClassObject1(objectEl, stable2[objectIndex++ & 3] & 1)
          }
        }),
        bench('setClassName', () => {
          for (let j = 0; j < BATCH; j++) {
            currentSetClassName1(classNameEl, stable2[classNameIndex++ & 3] & 1)
          }
        }),
      )
    })

    test('toggles every update', async ({ bench }) => {
      const ternaryEl = createRootEl()
      let ternaryIndex = 0
      const objectEl = createRootEl()
      let objectIndex = 0
      const classNameEl = createRootEl()
      let classNameIndex = 0

      await bench.compare(
        bench('setClass (ternary)', () => {
          for (let j = 0; j < BATCH; j++) {
            currentSetClassTernary1(ternaryEl, toggle(ternaryIndex++, 1))
          }
        }),
        bench('setClass (object)', () => {
          for (let j = 0; j < BATCH; j++) {
            currentSetClassObject1(objectEl, toggle(objectIndex++, 1))
          }
        }),
        bench('setClassName', () => {
          for (let j = 0; j < BATCH; j++) {
            currentSetClassName1(classNameEl, toggle(classNameIndex++, 1))
          }
        }),
      )
    })
  })

  describe('2 keys', () => {
    test('stable', async ({ bench }) => {
      const classEl = createEl()
      let classIndex = 0
      const classNameEl = createEl()
      let classNameIndex = 0

      await bench.compare(
        bench('setClass', () => {
          for (let j = 0; j < BATCH; j++)
            currentSetClass2(classEl, stable2[classIndex++ & 3])
        }),
        bench('setClassName', () => {
          for (let j = 0; j < BATCH; j++)
            currentSetClassName2(classNameEl, stable2[classNameIndex++ & 3])
        }),
      )
    })

    test('toggles every update', async ({ bench }) => {
      const classEl = createEl()
      let classIndex = 0
      const classNameEl = createEl()
      let classNameIndex = 0

      await bench.compare(
        bench('setClass', () => {
          for (let j = 0; j < BATCH; j++)
            currentSetClass2(classEl, toggle(classIndex++, 3))
        }),
        bench('setClassName', () => {
          for (let j = 0; j < BATCH; j++)
            currentSetClassName2(classNameEl, toggle(classNameIndex++, 3))
        }),
      )
    })
  })

  describe('4 keys', () => {
    test('stable', async ({ bench }) => {
      const classEl = createEl()
      let classIndex = 0
      const classNameEl = createEl()
      let classNameIndex = 0

      await bench.compare(
        bench('setClass', () => {
          for (let j = 0; j < BATCH; j++)
            currentSetClass4(classEl, stable4[classIndex++ & 3])
        }),
        bench('setClassName', () => {
          for (let j = 0; j < BATCH; j++)
            currentSetClassName4(classNameEl, stable4[classNameIndex++ & 3])
        }),
      )
    })

    test('toggles every update', async ({ bench }) => {
      const classEl = createEl()
      let classIndex = 0
      const classNameEl = createEl()
      let classNameIndex = 0

      await bench.compare(
        bench('setClass', () => {
          for (let j = 0; j < BATCH; j++)
            currentSetClass4(classEl, toggle(classIndex++, 15))
        }),
        bench('setClassName', () => {
          for (let j = 0; j < BATCH; j++)
            currentSetClassName4(classNameEl, toggle(classNameIndex++, 15))
        }),
      )
    })

    test('sparse churn', async ({ bench }) => {
      const classEl = createEl()
      let classIndex = 0
      const classNameEl = createEl()
      let classNameIndex = 0

      await bench.compare(
        bench('setClass', () => {
          for (let j = 0; j < BATCH; j++)
            currentSetClass4(classEl, sparse(classIndex++, 15))
        }),
        bench('setClassName', () => {
          for (let j = 0; j < BATCH; j++)
            currentSetClassName4(classNameEl, sparse(classNameIndex++, 15))
        }),
      )
    })
  })

  describe('8 keys', () => {
    test('stable', async ({ bench }) => {
      const classEl = createEl()
      let classIndex = 0
      const classNameEl = createEl()
      let classNameIndex = 0

      await bench.compare(
        bench('setClass', () => {
          for (let j = 0; j < BATCH; j++)
            currentSetClass8(classEl, stable8[classIndex++ & 3])
        }),
        bench('setClassName', () => {
          for (let j = 0; j < BATCH; j++)
            currentSetClassName8(classNameEl, stable8[classNameIndex++ & 3])
        }),
      )
    })

    test('toggles every update', async ({ bench }) => {
      const classEl = createEl()
      let classIndex = 0
      const classNameEl = createEl()
      let classNameIndex = 0

      await bench.compare(
        bench('setClass', () => {
          for (let j = 0; j < BATCH; j++)
            currentSetClass8(classEl, toggle(classIndex++, 255))
        }),
        bench('setClassName', () => {
          for (let j = 0; j < BATCH; j++)
            currentSetClassName8(classNameEl, toggle(classNameIndex++, 255))
        }),
      )
    })

    test('sparse churn', async ({ bench }) => {
      const classEl = createEl()
      let classIndex = 0
      const classNameEl = createEl()
      let classNameIndex = 0

      await bench.compare(
        bench('setClass', () => {
          for (let j = 0; j < BATCH; j++)
            currentSetClass8(classEl, sparse(classIndex++, 255))
        }),
        bench('setClassName', () => {
          for (let j = 0; j < BATCH; j++)
            currentSetClassName8(classNameEl, sparse(classNameIndex++, 255))
        }),
      )
    })
  })
})
