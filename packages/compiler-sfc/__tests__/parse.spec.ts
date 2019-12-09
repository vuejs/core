import { parse } from '../src'
import { mockWarn } from '@vue/runtime-test'

describe('compiler:sfc', () => {
  mockWarn()

  describe('source map', () => {
    test('style block', () => {
      const style = parse(`<style>\n.color {\n color: red;\n }\n</style>\n`)
        .styles[0]
      // TODO need to actually test this with SourceMapConsumer
      expect(style.map).not.toBeUndefined()
    })

    test('script block', () => {
      const script = parse(`<script>\nconsole.log(1)\n }\n</script>\n`).script
      // TODO need to actually test this with SourceMapConsumer
      expect(script!.map).not.toBeUndefined()
    })
  })

  test('pad content', () => {
    const content = `
<template>
<div></div>
</template>
<script>
export default {}
</script>
<style>
h1 { color: red }
</style>`
    const padFalse = parse(content.trim(), { pad: false })
    expect(padFalse.template!.content).toBe('\n<div></div>\n')
    expect(padFalse.script!.content).toBe('\nexport default {}\n')
    expect(padFalse.styles[0].content).toBe('\nh1 { color: red }\n')

    const padTrue = parse(content.trim(), { pad: true })
    expect(padTrue.script!.content).toBe(
      Array(3 + 1).join('//\n') + '\nexport default {}\n'
    )
    expect(padTrue.styles[0].content).toBe(
      Array(6 + 1).join('\n') + '\nh1 { color: red }\n'
    )

    const padLine = parse(content.trim(), { pad: 'line' })
    expect(padLine.script!.content).toBe(
      Array(3 + 1).join('//\n') + '\nexport default {}\n'
    )
    expect(padLine.styles[0].content).toBe(
      Array(6 + 1).join('\n') + '\nh1 { color: red }\n'
    )

    const padSpace = parse(content.trim(), { pad: 'space' })
    expect(padSpace.script!.content).toBe(
      `<template>\n<div></div>\n</template>\n<script>`.replace(/./g, ' ') +
        '\nexport default {}\n'
    )
    expect(padSpace.styles[0].content).toBe(
      `<template>\n<div></div>\n</template>\n<script>\nexport default {}\n</script>\n<style>`.replace(
        /./g,
        ' '
      ) + '\nh1 { color: red }\n'
    )
  })

  test('should ignore nodes with no content', () => {
    expect(parse(`<template/>`).template).toBe(null)
    expect(parse(`<script/>`).script).toBe(null)
    expect(parse(`<style/>`).styles.length).toBe(0)
    expect(parse(`<custom/>`).customBlocks.length).toBe(0)
  })

  describe('error', () => {
    test('should only allow single template element', () => {
      parse(`<template><div/></template><template><div/></template>`)
      expect(
        `Single file component can contain only one template element`
      ).toHaveBeenWarned()
    })

    test('should only allow single script element', () => {
      parse(`<script>console.log(1)</script><script>console.log(1)</script>`)
      expect(
        `Single file component can contain only one script element`
      ).toHaveBeenWarned()
    })
  })
})
