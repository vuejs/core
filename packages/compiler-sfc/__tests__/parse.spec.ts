import { parse } from '../src'
import {
  ElementTypes,
  NodeTypes,
  baseCompile,
  createRoot,
} from '@vue/compiler-core'
import { SourceMapConsumer } from 'source-map-js'

describe('compiler:sfc', () => {
  describe('source map', () => {
    test('style block', () => {
      // Padding determines how many blank lines will there be before the style block
      const padding = Math.round(Math.random() * 10)
      const src =
        `${'\n'.repeat(padding)}` +
        `<style>
.css {
color: red;
}
</style>

<style module>
.css-module {
color: red;
}
</style>

<style scoped>
.css-scoped {
color: red;
}
</style>

<style scoped>
.css-scoped-nested {
color: red;
.dummy {
color: green;
}
font-weight: bold;
}
</style>`
      const {
        descriptor: { styles },
      } = parse(src)

      expect(styles[0].map).not.toBeUndefined()
      const consumer = new SourceMapConsumer(styles[0].map!)
      const lineOffset =
        src.slice(0, src.indexOf(`<style>`)).split('\n').length - 1
      consumer.eachMapping(mapping => {
        expect(mapping.generatedLine + lineOffset).toBe(mapping.originalLine)
      })

      expect(styles[1].map).not.toBeUndefined()
      const consumer1 = new SourceMapConsumer(styles[1].map!)
      const lineOffset1 =
        src.slice(0, src.indexOf(`<style module>`)).split('\n').length - 1
      consumer1.eachMapping(mapping => {
        expect(mapping.generatedLine + lineOffset1).toBe(mapping.originalLine)
      })

      expect(styles[2].map).not.toBeUndefined()
      const consumer2 = new SourceMapConsumer(styles[2].map!)
      const lineOffset2 =
        src.slice(0, src.indexOf(`<style scoped>`)).split('\n').length - 1
      consumer2.eachMapping(mapping => {
        expect(mapping.generatedLine + lineOffset2).toBe(mapping.originalLine)
      })
    })

    test('script block', () => {
      // Padding determines how many blank lines will there be before the style block
      const padding = Math.round(Math.random() * 10)
      const script = parse(
        `${'\n'.repeat(padding)}<script>\nconsole.log(1)\n }\n</script>\n`,
      ).descriptor.script

      expect(script!.map).not.toBeUndefined()

      const consumer = new SourceMapConsumer(script!.map!)
      consumer.eachMapping(mapping => {
        expect(mapping.originalLine - mapping.generatedLine).toBe(padding)
      })
    })

    test('template block with lang + indent', () => {
      // Padding determines how many blank lines will there be before the style block
      const padding = Math.round(Math.random() * 10)
      const template = parse(
        `${'\n'.repeat(padding)}<template lang="pug">
  h1 foo
    div bar
    span baz
</template>\n`,
      ).descriptor.template!

      expect(template.map).not.toBeUndefined()

      const consumer = new SourceMapConsumer(template.map!)
      consumer.eachMapping(mapping => {
        expect(mapping.originalLine - mapping.generatedLine).toBe(padding)
        expect(mapping.originalColumn - mapping.generatedColumn).toBe(2)
      })
    })

    test('custom block', () => {
      const padding = Math.round(Math.random() * 10)
      const custom = parse(
        `${'\n'.repeat(padding)}<i18n>\n{\n  "greeting": "hello"\n}\n</i18n>\n`,
      ).descriptor.customBlocks[0]

      expect(custom!.map).not.toBeUndefined()

      const consumer = new SourceMapConsumer(custom!.map!)
      consumer.eachMapping(mapping => {
        expect(mapping.originalLine - mapping.generatedLine).toBe(padding)
      })
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
</style>
<i18n>
{ "greeting": "hello" }
</i18n>
`
    const padFalse = parse(content.trim(), { pad: false }).descriptor
    expect(padFalse.template!.content).toBe('\n<div></div>\n')
    expect(padFalse.script!.content).toBe('\nexport default {}\n')
    expect(padFalse.styles[0].content).toBe('\nh1 { color: red }\n')
    expect(padFalse.customBlocks[0].content).toBe('\n{ "greeting": "hello" }\n')

    const padTrue = parse(content.trim(), { pad: true }).descriptor
    expect(padTrue.script!.content).toBe(
      Array(3 + 1).join('//\n') + '\nexport default {}\n',
    )
    expect(padTrue.styles[0].content).toBe(
      Array(6 + 1).join('\n') + '\nh1 { color: red }\n',
    )
    expect(padTrue.customBlocks[0].content).toBe(
      Array(9 + 1).join('\n') + '\n{ "greeting": "hello" }\n',
    )

    const padLine = parse(content.trim(), { pad: 'line' }).descriptor
    expect(padLine.script!.content).toBe(
      Array(3 + 1).join('//\n') + '\nexport default {}\n',
    )
    expect(padLine.styles[0].content).toBe(
      Array(6 + 1).join('\n') + '\nh1 { color: red }\n',
    )
    expect(padLine.customBlocks[0].content).toBe(
      Array(9 + 1).join('\n') + '\n{ "greeting": "hello" }\n',
    )

    const padSpace = parse(content.trim(), { pad: 'space' }).descriptor
    expect(padSpace.script!.content).toBe(
      `<template>\n<div></div>\n</template>\n<script>`.replace(/./g, ' ') +
        '\nexport default {}\n',
    )
    expect(padSpace.styles[0].content).toBe(
      `<template>\n<div></div>\n</template>\n<script>\nexport default {}\n</script>\n<style>`.replace(
        /./g,
        ' ',
      ) + '\nh1 { color: red }\n',
    )
    expect(padSpace.customBlocks[0].content).toBe(
      `<template>\n<div></div>\n</template>\n<script>\nexport default {}\n</script>\n<style>\nh1 { color: red }\n</style>\n<i18n>`.replace(
        /./g,
        ' ',
      ) + '\n{ "greeting": "hello" }\n',
    )
  })

  test('should parse correct range for root level self closing tag', () => {
    const content = `\n  <div/>\n`
    const { descriptor } = parse(`<template>${content}</template>`)
    expect(descriptor.template).toBeTruthy()
    expect(descriptor.template!.content).toBe(content)
    expect(descriptor.template!.loc).toMatchObject({
      start: { line: 1, column: 11, offset: 10 },
      end: {
        line: 3,
        column: 1,
        offset: 10 + content.length,
      },
    })
  })

  test('should parse correct range for blocks with no content (self closing)', () => {
    const { descriptor } = parse(`<template/>`)
    expect(descriptor.template).toBeTruthy()
    expect(descriptor.template!.content).toBeFalsy()
    expect(descriptor.template!.loc).toMatchObject({
      start: { line: 1, column: 12, offset: 11 },
      end: { line: 1, column: 12, offset: 11 },
    })
  })

  test('should parse correct range for blocks with no content (explicit)', () => {
    const { descriptor } = parse(`<template></template>`)
    expect(descriptor.template).toBeTruthy()
    expect(descriptor.template!.content).toBeFalsy()
    expect(descriptor.template!.loc).toMatchObject({
      start: { line: 1, column: 11, offset: 10 },
      end: { line: 1, column: 11, offset: 10 },
    })
  })

  test('should ignore other nodes with no content', () => {
    expect(parse(`<script/>`).descriptor.script).toBe(null)
    expect(parse(`<script> \n\t  </script>`).descriptor.script).toBe(null)
    expect(parse(`<style/>`).descriptor.styles.length).toBe(0)
    expect(parse(`<style> \n\t </style>`).descriptor.styles.length).toBe(0)
    expect(parse(`<custom/>`).descriptor.customBlocks.length).toBe(0)
    expect(
      parse(`<custom> \n\t </custom>`).descriptor.customBlocks.length,
    ).toBe(0)
  })

  test('handle empty nodes with src attribute', () => {
    const { descriptor } = parse(`<script src="com"/>`)
    expect(descriptor.script).toBeTruthy()
    expect(descriptor.script!.content).toBeFalsy()
    expect(descriptor.script!.attrs['src']).toBe('com')
  })

  test('should not expose ast on template node if has src import', () => {
    const { descriptor } = parse(`<template src="./foo.html"/>`)
    expect(descriptor.template!.ast).toBeUndefined()
  })

  test('ignoreEmpty: false', () => {
    const { descriptor } = parse(
      `<script></script>\n<script setup>\n</script>`,
      {
        ignoreEmpty: false,
      },
    )
    expect(descriptor.script).toBeTruthy()
    expect(descriptor.script!.loc).toMatchObject({
      start: { line: 1, column: 9, offset: 8 },
      end: { line: 1, column: 9, offset: 8 },
    })

    expect(descriptor.scriptSetup).toBeTruthy()
    expect(descriptor.scriptSetup!.loc).toMatchObject({
      start: { line: 2, column: 15, offset: 32 },
      end: { line: 3, column: 1, offset: 33 },
    })
  })

  test('nested templates', () => {
    const content = `
    <template v-if="ok">ok</template>
    <div><div></div></div>
    `
    const { descriptor } = parse(`<template>${content}</template>`)
    expect(descriptor.template!.content).toBe(content)
  })

  test('treat empty lang attribute as the html', () => {
    const content = `<div><template v-if="ok">ok</template></div>`
    const { descriptor, errors } = parse(
      `<template lang="">${content}</template>`,
    )
    expect(descriptor.template!.content).toBe(content)
    expect(errors.length).toBe(0)
  })

  // #1120
  test('template with preprocessor lang should be treated as plain text', () => {
    const content = `p(v-if="1 < 2") test <div/>`
    const { descriptor, errors } = parse(
      `<template lang="pug">` + content + `</template>`,
    )
    expect(errors.length).toBe(0)
    expect(descriptor.template!.content).toBe(content)
    // should not attempt to parse the content
    expect(descriptor.template!.ast!.children.length).toBe(1)
  })

  //#2566
  test('div lang should not be treated as plain text', () => {
    const { errors } = parse(`
    <template lang="pug">
      <div lang="">
        <div></div>
      </div>
    </template>
    `)
    expect(errors.length).toBe(0)
  })

  test('slotted detection', async () => {
    expect(parse(`<template>hi</template>`).descriptor.slotted).toBe(false)
    expect(
      parse(`<template>hi</template><style>h1{color:red;}</style>`).descriptor
        .slotted,
    ).toBe(false)
    expect(
      parse(
        `<template>hi</template><style scoped>:slotted(h1){color:red;}</style>`,
      ).descriptor.slotted,
    ).toBe(true)
    expect(
      parse(
        `<template>hi</template><style scoped>::v-slotted(h1){color:red;}</style>`,
      ).descriptor.slotted,
    ).toBe(true)
  })

  test('error tolerance', () => {
    const { errors } = parse(`<template>`)
    expect(errors.length).toBe(1)
  })

  test('should parse as DOM by default', () => {
    const { errors } = parse(`<template><input></template>`)
    expect(errors.length).toBe(0)
  })

  test('custom compiler', () => {
    const { errors } = parse(`<template><input></template>`, {
      compiler: {
        parse: (_, options) => {
          options.onError!(new Error('foo') as any)
          return createRoot([])
        },
        compile: baseCompile,
      },
    })
    expect(errors.length).toBe(2)
    // error thrown by the custom parse
    expect(errors[0].message).toBe('foo')
    // error thrown based on the returned root
    expect(errors[1].message).toMatch('At least one')
  })

  test('treat custom blocks as raw text', () => {
    const { errors, descriptor } = parse(
      `<template><input></template><foo> <-& </foo>`,
    )
    expect(errors.length).toBe(0)
    expect(descriptor.customBlocks[0].content).toBe(` <-& `)
  })

  test('should accept parser options', () => {
    const { errors, descriptor } = parse(`<template><hello/></template>`, {
      templateParseOptions: {
        isCustomElement: t => t === 'hello',
      },
    })
    expect(errors.length).toBe(0)
    expect(descriptor.template!.ast!.children[0]).toMatchObject({
      type: NodeTypes.ELEMENT,
      tag: 'hello',
      tagType: ElementTypes.ELEMENT,
    })

    // test cache invalidation on different options
    const { descriptor: d2 } = parse(`<template><hello/></template>`, {
      templateParseOptions: {
        isCustomElement: t => t !== 'hello',
      },
    })
    expect(d2.template!.ast!.children[0]).toMatchObject({
      type: NodeTypes.ELEMENT,
      tag: 'hello',
      tagType: ElementTypes.COMPONENT,
    })
  })

  describe('warnings', () => {
    function assertWarning(errors: Error[], msg: string) {
      expect(errors.some(e => e.message.match(msg))).toBe(true)
    }

    test('should only allow single template element', () => {
      assertWarning(
        parse(`<template><div/></template><template><div/></template>`).errors,
        `Single file component can contain only one <template> element`,
      )
    })

    test('should only allow single script element', () => {
      assertWarning(
        parse(`<script>console.log(1)</script><script>console.log(1)</script>`)
          .errors,
        `Single file component can contain only one <script> element`,
      )
    })

    test('should only allow single script setup element', () => {
      assertWarning(
        parse(
          `<script setup>console.log(1)</script><script setup>console.log(1)</script>`,
        ).errors,
        `Single file component can contain only one <script setup> element`,
      )
    })

    test('should not warn script & script setup', () => {
      expect(
        parse(
          `<script setup>console.log(1)</script><script>console.log(1)</script>`,
        ).errors.length,
      ).toBe(0)
    })

    // # 6676
    test('should throw error if no <template> or <script> is present', () => {
      assertWarning(
        parse(`import { ref } from 'vue'`).errors,
        `At least one <template> or <script> is required in a single file component`,
      )
    })
  })
})
