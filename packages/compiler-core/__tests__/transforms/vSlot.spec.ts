import { CompilerOptions, parse, transform, generate } from '../../src'
import { transformElement } from '../../src/transforms/transformElement'
import { transformOn } from '../../src/transforms/vOn'
import { transformBind } from '../../src/transforms/vBind'
import { transformExpression } from '../../src/transforms/transformExpression'
import { trackSlotScopes } from '../../src/transforms/vSlot'

function parseWithSlots(template: string, options: CompilerOptions = {}) {
  const ast = parse(template)
  transform(ast, {
    nodeTransforms: [
      ...(options.prefixIdentifiers
        ? [transformExpression, trackSlotScopes]
        : []),
      transformElement
    ],
    directiveTransforms: {
      on: transformOn,
      bind: transformBind
    },
    ...options
  })
  return ast
}

describe('compiler: transform component slots', () => {
  test('generate slot', () => {
    const ast = parseWithSlots(
      `
<Comp>
  <Comp v-slot="{ dur }">
    hello {{ dur }}
  </Comp>
</Comp>
`,
      { prefixIdentifiers: true }
    )
    const { code } = generate(ast, { prefixIdentifiers: true })
    console.log(code)
  })
})
