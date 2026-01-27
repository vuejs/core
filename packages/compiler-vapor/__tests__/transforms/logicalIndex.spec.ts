import { makeCompile } from './_utils'
import {
  transformChildren,
  transformElement,
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
    transformVSlot,
    transformSlotOutlet,
    transformElement,
    transformChildren,
  ],
})

describe('compiler: logicalIndex', () => {
  describe('child/nthChild/next with logicalIndex', () => {
    test('next with logicalIndex for insert anchor', () => {
      // <div><div /><Comp /><div /><div v-if="true" /></div>
      // first div: 0, Comp: 1 (insert), second div: 2, v-if: 3 (append)
      // The anchor for Comp is at logicalIndex=1
      const { code } = compileWithTransforms(`
        <div>
          <div />
          <Comp />
          <div />
          <div v-if="true" />
        </div>
      `)
      // next(child(parent), logicalIndex=1) for the insert anchor
      expect(code).toContain('_next(_child(n5), 1)')
      expect(code).toMatchSnapshot()
    })

    test('nthChild with logicalIndex', () => {
      // <div><div /><Comp /><div /><div v-if="true" /><div><button :disabled="foo" /></div></div>
      // first div: 0, Comp: 1, second div: 2, v-if: 3, last div: 4
      // But the v-if is append, so the anchor is at elementIndex=3, logicalIndex=3
      const { code } = compileWithTransforms(`
        <div>
          <div />
          <Comp />
          <div />
          <div v-if="true" />
          <div>
            <button :disabled="foo" />
          </div>
        </div>
      `)
      // nthChild(parent, elementIndex=3, logicalIndex=3) for the anchor
      expect(code).toContain('_nthChild(n5, 3, 3)')
      expect(code).toMatchSnapshot()
    })

    test('child with logicalIndex when prepend exists and insert anchor needed', () => {
      // <div><Comp1 /><div /><Comp2 /><span /></div>
      // Comp1: 0 (prepend), div: 1, Comp2: 2 (insert), span: 3
      // The anchor is accessed via next(child(parent), logicalIndex)
      const { code } = compileWithTransforms(`
        <div>
          <Comp1 />
          <div />
          <Comp2 />
          <span />
        </div>
      `)
      // next(child(parent), logicalIndex=2) for the anchor (<!> placeholder)
      expect(code).toContain('_next(_child(n2), 2)')
      expect(code).toMatchSnapshot()
    })

    test('multiple prepends affect logicalIndex', () => {
      // <div><Comp1 /><Comp2 /><div /><Comp3 /><span /></div>
      // Comp1: 0, Comp2: 1, div: 2, Comp3: 3 (insert), span: 4
      const { code } = compileWithTransforms(`
        <div>
          <Comp1 />
          <Comp2 />
          <div />
          <Comp3 />
          <span />
        </div>
      `)
      // next(child(parent), logicalIndex=3) for the anchor (<!> placeholder)
      expect(code).toContain('_next(_child(n3), 3)')
      expect(code).toMatchSnapshot()
    })
  })

  describe('setInsertionState scenarios', () => {
    describe('prepend scenarios', () => {
      test('single component prepend', () => {
        const { code } = compileWithTransforms(`
          <div>
            <Comp />
            <span>A</span>
          </div>
        `)
        // setInsertionState(parent, anchor=0(prepend), logicalIndex=0, last=true)
        expect(code).toContain('_setInsertionState(n1, 0, 0, true)')
        expect(code).toMatchSnapshot()
      })

      test('multiple consecutive prepend', () => {
        const { code } = compileWithTransforms(`
          <div>
            <Comp1 />
            <Comp2 />
            <span>A</span>
          </div>
        `)
        // Comp1
        expect(code).toContain('_setInsertionState(n2, 0, 0)')
        // Comp2
        expect(code).toContain('_setInsertionState(n2, 0, 1, true)')
        expect(code).toMatchSnapshot()
      })
    })

    describe('insert scenarios', () => {
      test('single component insert in middle', () => {
        const { code } = compileWithTransforms(`
          <div>
            <span>A</span>
            <Comp />
            <p>B</p>
          </div>
        `)
        // setInsertionState(parent, anchor=n${id}, logicalIndex=1, last=true)
        expect(code).toContain('_setInsertionState(n2, n1, 1, true)')
        expect(code).toMatchSnapshot()
      })

      test('multiple consecutive insert in middle', () => {
        const { code } = compileWithTransforms(`
          <div>
            <span>A</span>
            <Comp1 />
            <Comp2 />
            <p>B</p>
          </div>
        `)
        // Comp1
        expect(code).toContain('_setInsertionState(n3, n2, 1)')
        // Comp2
        expect(code).toContain('_setInsertionState(n3, n2, 2, true)')
        expect(code).toMatchSnapshot()
      })
    })

    describe('append scenarios', () => {
      test('single component append', () => {
        const { code } = compileWithTransforms(`
          <div>
            <span>A</span>
            <Comp />
          </div>
        `)
        // setInsertionState(parent, null(append), logicalIndex=1, last=true)
        expect(code).toContain('_setInsertionState(n1, null, 1, true)')
        expect(code).toMatchSnapshot()
      })

      test('multiple consecutive append', () => {
        const { code } = compileWithTransforms(`
          <div>
            <span>A</span>
            <Comp1 />
            <Comp2 />
          </div>
        `)
        // Comp1
        expect(code).toContain('_setInsertionState(n2, null, 1)')
        // Comp2
        expect(code).toContain('_setInsertionState(n2, null, 2, true)')
        expect(code).toMatchSnapshot()
      })

      test('only component (append with logicalIndex 0)', () => {
        const { code } = compileWithTransforms(`
          <div>
            <Comp />
          </div>
        `)
        expect(code).toContain('_setInsertionState(n1, null, 0, true)')
        expect(code).toMatchSnapshot()
      })
    })

    describe('mixed scenarios', () => {
      test('prepend + append', () => {
        const { code } = compileWithTransforms(`
          <div>
            <Comp1 />
            <span>A</span>
            <Comp2 />
          </div>
        `)
        // Comp1: prepend, logicalIndex=0
        expect(code).toContain('_setInsertionState(n2, 0, 0)')
        // Comp2: append, logicalIndex=2
        expect(code).toContain('_setInsertionState(n2, null, 2, true)')
        expect(code).toMatchSnapshot()
      })

      test('prepend + insert + append', () => {
        const { code } = compileWithTransforms(`
          <div>
            <Comp1 />
            <span>A</span>
            <Comp2 />
            <p>B</p>
            <Comp3 />
          </div>
        `)
        // Comp1: prepend, logicalIndex=0
        expect(code).toContain('_setInsertionState(n3, 0, 0)')
        // Comp2: insert, logicalIndex=2
        expect(code).toContain('_setInsertionState(n3, n4, 2)')
        // Comp3: append, logicalIndex=4
        expect(code).toContain('_setInsertionState(n3, null, 4, true)')
        expect(code).toMatchSnapshot()
      })
    })

    describe('v-if scenarios', () => {
      test('v-if prepend', () => {
        const { code } = compileWithTransforms(`
          <div>
            <div v-if="show" />
            <span>A</span>
          </div>
        `)
        expect(code).toContain('_setInsertionState(n3, 0, 0, true)')
        expect(code).toMatchSnapshot()
      })

      test('v-if insert', () => {
        const { code } = compileWithTransforms(`
          <div>
            <span>A</span>
            <div v-if="show" />
            <p>B</p>
          </div>
        `)
        expect(code).toContain('_setInsertionState(n4, n3, 1, true)')
        expect(code).toMatchSnapshot()
      })

      test('v-if append', () => {
        const { code } = compileWithTransforms(`
          <div>
            <span>A</span>
            <div v-if="show" />
          </div>
        `)
        expect(code).toContain('_setInsertionState(n3, null, 1, true)')
        expect(code).toMatchSnapshot()
      })
    })

    describe('v-for scenarios', () => {
      test('v-for prepend', () => {
        const { code } = compileWithTransforms(`
          <div>
            <div v-for="i in list" :key="i" />
            <span>A</span>
          </div>
        `)
        expect(code).toContain('_setInsertionState(n3, 0, 0, true)')
        expect(code).toMatchSnapshot()
      })

      test('v-for append', () => {
        const { code } = compileWithTransforms(`
          <div>
            <span>A</span>
            <div v-for="i in list" :key="i" />
          </div>
        `)
        expect(code).toContain('_setInsertionState(n3, null, 1, true)')
        expect(code).toMatchSnapshot()
      })
    })

    describe('slot scenarios', () => {
      test('slot prepend', () => {
        const { code } = compileWithTransforms(`
          <div>
            <slot />
            <span>A</span>
          </div>
        `)
        expect(code).toContain('_setInsertionState(n1, 0, 0, true)')
        expect(code).toMatchSnapshot()
      })

      test('slot append', () => {
        const { code } = compileWithTransforms(`
          <div>
            <span>A</span>
            <slot />
          </div>
        `)
        expect(code).toContain('_setInsertionState(n1, null, 1, true)')
        expect(code).toMatchSnapshot()
      })
    })

    describe('v-if/v-else-if/v-else scenarios', () => {
      test('v-if with v-else should share same logicalIndex', () => {
        // v-if/v-else is a single logical unit
        const { code } = compileWithTransforms(`
          <div>
            <span>A</span>
            <div v-if="show">if</div>
            <div v-else>else</div>
            <p>B</p>
          </div>
        `)
        // The entire if/else block is logicalIndex = 1
        expect(code).toContain('_setInsertionState(n6, n5, 1, true)')
        expect(code).toMatchSnapshot()
      })

      test('v-if with v-else-if and v-else should share same logicalIndex', () => {
        const { code } = compileWithTransforms(`
          <div>
            <span>A</span>
            <div v-if="a">if</div>
            <div v-else-if="b">else-if</div>
            <div v-else>else</div>
            <p>B</p>
          </div>
        `)
        // The entire if/else-if/else block is logicalIndex = 1
        expect(code).toContain('_setInsertionState(n8, n7, 1, true)')
        expect(code).toMatchSnapshot()
      })

      test('v-if/v-else prepend', () => {
        const { code } = compileWithTransforms(`
          <div>
            <div v-if="show">if</div>
            <div v-else>else</div>
            <span>A</span>
          </div>
        `)
        // logicalIndex = 0 for prepend
        expect(code).toContain('_setInsertionState(n5, 0, 0, true)')
        expect(code).toMatchSnapshot()
      })

      test('v-if/v-else append', () => {
        const { code } = compileWithTransforms(`
          <div>
            <span>A</span>
            <div v-if="show">if</div>
            <div v-else>else</div>
          </div>
        `)
        // logicalIndex = 1 for append
        expect(code).toContain('_setInsertionState(n5, null, 1, true)')
        expect(code).toMatchSnapshot()
      })

      test('v-if/v-else followed by component', () => {
        const { code } = compileWithTransforms(`
          <div>
            <span>A</span>
            <div v-if="show">if</div>
            <div v-else>else</div>
            <Comp />
          </div>
        `)
        // v-if/v-else: logicalIndex = 1
        // Comp: logicalIndex = 2
        expect(code).toContain('_setInsertionState(n6, null, 1)')
        expect(code).toContain('_setInsertionState(n6, null, 2, true)')
        expect(code).toMatchSnapshot()
      })

      test('component followed by v-if/v-else', () => {
        const { code } = compileWithTransforms(`
          <div>
            <Comp />
            <div v-if="show">if</div>
            <div v-else>else</div>
            <span>A</span>
          </div>
        `)
        // Comp: logicalIndex = 0
        // v-if/v-else: logicalIndex = 1
        // span: logicalIndex = 2
        expect(code).toContain('_setInsertionState(n6, 0, 0)')
        expect(code).toContain('_setInsertionState(n6, 0, 1, true)')
        expect(code).toMatchSnapshot()
      })

      test('component + v-if/v-else + component', () => {
        const { code } = compileWithTransforms(`
          <div>
            <Comp1 />
            <div v-if="show">if</div>
            <div v-else>else</div>
            <Comp2 />
          </div>
        `)
        // Comp1: logicalIndex = 0
        // v-if/v-else: logicalIndex = 1
        // Comp2: logicalIndex = 2
        expect(code).toContain('_setInsertionState(n7, null, 0)')
        expect(code).toContain('_setInsertionState(n7, null, 1)')
        expect(code).toContain('_setInsertionState(n7, null, 2, true)')
        expect(code).toMatchSnapshot()
      })
    })
  })
})
