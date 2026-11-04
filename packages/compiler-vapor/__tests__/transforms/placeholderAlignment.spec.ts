import { makeCompile } from './_utils'
import {
  transformChildren,
  transformElement,
  transformKey,
  transformSlotOutlet,
  transformText,
  transformVFor,
  transformVIf,
} from '../../src'
import { transformVSlot } from '../../src/transforms/vSlot'

const compileWithTransforms = makeCompile({
  nodeTransforms: [
    transformText,
    transformVIf,
    transformVFor,
    transformKey,
    transformVSlot,
    transformSlotOutlet,
    transformElement,
    transformChildren,
  ],
})

// Every dynamic block that has a later template sibling is anchored by its
// own `<!>` placeholder, so the CSR element index equals the SSR logical unit
// index and the DOM helpers need no extra hydration index arguments.
function expectNoIndexArgs(code: string) {
  expect(code).not.toMatch(/_child\(n\d+, /)
  expect(code).not.toMatch(/_next\([^)]+, \d/)
  expect(code).not.toMatch(/_nthChild\(n\d+, \d+, /)
  expect(code).not.toMatch(/_setInsertionState\(n\d+, n\d+, /)
}

// The generated code must never reference an undeclared anchor variable
// (regression guard for the old shared-anchor INSERT_NODE codegen).
function expectDeclaredVariables(code: string) {
  const declared = new Set<string>()
  for (const m of code.matchAll(/(?:const|let)\s+(n\d+)\b/g)) {
    declared.add(m[1])
  }
  for (const m of code.matchAll(/[(,[]\s*(n\d+)\b/g)) {
    expect(declared, `variable ${m[1]} must be declared`).toContain(m[1])
  }
  expect(code).not.toContain('n-1')
}

describe('compiler: placeholder alignment', () => {
  describe('prepend (folded into anchored insert)', () => {
    test('single component prepend', () => {
      const { code } = compileWithTransforms(`
        <div>
          <Comp />
          <div />
        </div>
      `)
      // template gains a leading placeholder; the block anchors to it
      expect(code).toContain(`_template("<div><!><div>`)
      expect(code).toContain(`const n1 = _child(n2)`)
      expect(code).toContain(`_setInsertionState(n2, n1)`)
      expectNoIndexArgs(code)
    })

    test('multiple consecutive prepends get one placeholder each', () => {
      const { code } = compileWithTransforms(`
        <div>
          <Comp />
          <Bar />
          <div />
        </div>
      `)
      expect(code).toContain(`_template("<div><!><!><div>`)
      expect(code).toContain(`const n2 = _child(n3)`)
      expect(code).toContain(`const n4 = _next(n2)`)
      expect(code).toContain(`_setInsertionState(n3, n2)`)
      expect(code).toContain(`_setInsertionState(n3, n4)`)
      expectNoIndexArgs(code)
    })

    test('statics after a prepend chain from the placeholder', () => {
      const { code } = compileWithTransforms(`
        <div>
          <Comp />
          <div>{{ a }}</div>
        </div>
      `)
      // element 0 is the placeholder, element 1 the static — located by a
      // plain sibling walk, not a diverged hydration index
      expect(code).toContain(`const n2 = _child(n3)`)
      expect(code).toContain(`const n1 = _next(n2)`)
      expect(code).toContain(`_setInsertionState(n3, n2)`)
      expectNoIndexArgs(code)
    })
  })

  describe('anchored insert in the middle', () => {
    test('single component insert', () => {
      const { code } = compileWithTransforms(`
        <div>
          <div />
          <Comp />
          <div />
        </div>
      `)
      expect(code).toContain(`_template("<div><div></div><!><div>`)
      expect(code).toContain(`const n1 = _next(_child(n2))`)
      expect(code).toContain(`_setInsertionState(n2, n1)`)
      expectNoIndexArgs(code)
    })

    test('consecutive inserts get one placeholder each', () => {
      const { code } = compileWithTransforms(`
        <div>
          <div />
          <Comp />
          <Bar />
          <div />
        </div>
      `)
      expect(code).toContain(`_template("<div><div></div><!><!><div>`)
      expect(code).toContain(`const n2 = _next(_child(n3))`)
      expect(code).toContain(`const n4 = _next(n2)`)
      expect(code).toContain(`_setInsertionState(n3, n2)`)
      expect(code).toContain(`_setInsertionState(n3, n4)`)
      expectNoIndexArgs(code)
    })

    test('statics after placeholders use plain element indexes', () => {
      const { code } = compileWithTransforms(`
        <div>
          <div />
          <Comp />
          <div />
          <div>{{ a }}</div>
        </div>
      `)
      // placeholder occupies element slot 1; the referenced static sits at
      // element index 3 in both CSR and SSR unit space
      expect(code).toContain(`_nthChild(n3, 3)`)
      expectNoIndexArgs(code)
    })
  })

  describe('append (no placeholder)', () => {
    test('sole child append omits the index', () => {
      const { code } = compileWithTransforms(`
        <div>
          <Comp />
        </div>
      `)
      expect(code).not.toContain(`<!>`)
      expect(code).toContain(`_setInsertionState(n1)\n`)
      expectNoIndexArgs(code)
    })

    test('append after statics passes the unit index', () => {
      const { code } = compileWithTransforms(`
        <div>
          <div />
          <Comp />
        </div>
      `)
      expect(code).not.toContain(`<!>`)
      expect(code).toContain(`_setInsertionState(n1, 1)`)
    })

    test('consecutive appends occupy successive units', () => {
      const { code } = compileWithTransforms(`
        <div>
          <div />
          <Comp />
          <Bar />
        </div>
      `)
      expect(code).toContain(`_setInsertionState(n2, 1)`)
      expect(code).toContain(`_setInsertionState(n2, 2)`)
    })

    test('appends after a placeholder count it as a unit', () => {
      const { code } = compileWithTransforms(`
        <div>
          <Comp />
          <div />
          <Bar />
        </div>
      `)
      // units: Comp placeholder = 0, div = 1, Bar appends at 2
      expect(code).toContain(`_template("<div><!><div>`)
      expect(code).toContain(`const n2 = _child(n3)`)
      expect(code).toContain(`_setInsertionState(n3, n2)`)
      expect(code).toContain(`_setInsertionState(n3, 2)`)
      expectNoIndexArgs(code)
    })
  })

  describe('mixed positions', () => {
    test('prepend + insert + append', () => {
      const { code } = compileWithTransforms(`
        <div>
          <Comp />
          <div />
          <Bar />
          <div />
          <Baz />
        </div>
      `)
      expect(code).toContain(`_template("<div><!><div></div><!><div>`)
      // Comp anchors at element 0, Bar at element 2, Baz appends at unit 4
      expect(code).toContain(`const n3 = _child(n4)`)
      expect(code).toContain(`const n5 = _nthChild(n4, 2)`)
      expect(code).toContain(`_setInsertionState(n4, n3)`)
      expect(code).toContain(`_setInsertionState(n4, n5)`)
      expect(code).toContain(`_setInsertionState(n4, 4)`)
      expectNoIndexArgs(code)
      expectDeclaredVariables(code)
    })
  })

  describe('block types', () => {
    test.each([
      ['v-if', `<div><div v-if="ok" /><div /></div>`],
      ['v-for', `<div><div v-for="i in list" /><div /></div>`],
      ['slot', `<div><slot /><div /></div>`],
      ['keyed element', `<div><div :key="k" /><div /></div>`],
      ['component', `<div><Comp /><div /></div>`],
    ])('%s in anchored position gets a placeholder', (_, template) => {
      const { code } = compileWithTransforms(template)
      expect(code).toContain(`<!>`)
      expect(code).toMatch(/_setInsertionState\(n\d+, n\d+\)/)
      expectNoIndexArgs(code)
    })

    test.each([
      ['v-if', `<div><div /><div v-if="ok" /></div>`],
      ['v-for', `<div><div /><div v-for="i in list" /></div>`],
      ['slot', `<div><div /><slot /></div>`],
      ['keyed element', `<div><div /><div :key="k" /></div>`],
      ['component', `<div><div /><Comp /></div>`],
    ])('%s in append position stays placeholder-free', (_, template) => {
      const { code } = compileWithTransforms(template)
      expect(code).not.toContain(`<!>`)
      expect(code).toMatch(/_setInsertionState\(n\d+, 1\)/)
    })

    test('v-if/v-else chain is one block with one placeholder', () => {
      const { code } = compileWithTransforms(`
        <div>
          <div v-if="ok" />
          <div v-else />
          <div />
        </div>
      `)
      expect(code.match(/<!>/g)!.length).toBe(1)
      expect(code).toMatch(/_setInsertionState\(n\d+, n\d+\)/)
      expectNoIndexArgs(code)
    })
  })

  describe('invalid nesting (INSERT_NODE)', () => {
    test('anchored moved node inserts before its own declared placeholder', () => {
      const { code } = compileWithTransforms(`<p>a<div>x</div>b</p>`)
      expect(code).toContain(`_template("<p>a<!>b`)
      expect(code).toContain(`const n1 = _next(_child(n2))`)
      expect(code).toContain(`_insert(n0, n2, n1)`)
      expectDeclaredVariables(code)
    })

    test('prepended moved node uses a placeholder, not a sentinel', () => {
      const { code } = compileWithTransforms(`<p><div>x</div>b</p>`)
      expect(code).toContain(`_template("<p><!>b`)
      expect(code).toContain(`const n1 = _child(n2)`)
      expect(code).toContain(`_insert(n0, n2, n1)`)
      expectDeclaredVariables(code)
    })

    test('trailing moved node appends without an anchor', () => {
      const { code } = compileWithTransforms(`<p>a<div>x</div></p>`)
      expect(code).not.toContain(`<!>`)
      expect(code).toMatch(/_insert\(n0, n1\)/)
      expectDeclaredVariables(code)
    })

    test('moved node and block sibling insert independently', () => {
      const { code } = compileWithTransforms(`<p>a<div>x</div><Comp/>b</p>`)
      // one placeholder per member; the block is not duplicated through
      // INSERT_NODE elements
      expect(code).toContain(`_template("<p>a<!><!>b`)
      expect(code).toMatch(/_insert\(n0, n\d+, n\d+\)/)
      expect(code).not.toMatch(/_insert\(\[/)
      expectDeclaredVariables(code)
    })
  })
})
