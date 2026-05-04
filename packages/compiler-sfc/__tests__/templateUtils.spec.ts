import {
  isDataUrl,
  isExternalUrl,
  isRelativeUrl,
} from '../src/template/templateUtils'
import { compileSFCScript as compile } from './utils'

describe('compiler sfc:templateUtils isRelativeUrl', () => {
  test('should return true when The first character of the string path is .', () => {
    const url = './**.vue'
    const result = isRelativeUrl(url)
    expect(result).toBe(true)
  })

  test('should return true when The first character of the string path is ~', () => {
    const url = '~/xx.vue'
    const result = isRelativeUrl(url)
    expect(result).toBe(true)
  })

  test('should return true when The first character of the string path is @', () => {
    const url = '@/xx.vue'
    const result = isRelativeUrl(url)
    expect(result).toBe(true)
  })
})

describe('compiler sfc:templateUtils isExternalUrl', () => {
  test('should return true when String starts with http://', () => {
    const url = 'http://vuejs.org/'
    const result = isExternalUrl(url)
    expect(result).toBe(true)
  })

  test('should return true when String starts with https://', () => {
    const url = 'https://vuejs.org/'
    const result = isExternalUrl(url)
    expect(result).toBe(true)
  })

  test('should return true when String starts with //', () => {
    const url = '//vuejs.org/'
    const result = isExternalUrl(url)
    expect(result).toBe(true)
  })
})

describe('compiler sfc:templateUtils isDataUrl', () => {
  test('should return true w/ hasn`t media type and encode', () => {
    expect(isDataUrl('data:,i')).toBe(true)
  })

  test('should return true w/ media type + encode', () => {
    expect(isDataUrl('data:image/png;base64,i')).toBe(true)
  })

  test('should return true w/ media type + hasn`t encode', () => {
    expect(isDataUrl('data:image/png,i')).toBe(true)
  })
})

describe('multiRoot metadata', () => {
  test('marks a non-inline component as multi-root', () => {
    const { content } = compile(
      `
        <script setup vapor>
        const ok = true
        </script>
        <template>
          <div />
          <div />
        </template>
      `,
      {
        inlineTemplate: false,
        vapor: true,
      },
    )

    expect(content).toContain(`__multiRoot: true`)
  })

  test('treats root control flow as a single owner unit', () => {
    const { content } = compile(
      `
        <script setup vapor>
        const ok = true
        </script>
        <template>
          <template v-if="ok">
            <div />
            <div />
          </template>
        </template>
      `,
      {
        inlineTemplate: false,
        vapor: true,
      },
    )

    expect(content).toContain(`__multiRoot: false`)
  })

  test('treats a root if / else-if / else chain as a single owner unit', () => {
    const { content } = compile(
      `
        <script setup vapor>
        const ok = true
        const maybe = false
        </script>
        <template>
          <template v-if="ok">
            <div />
          </template>
          <template v-else-if="maybe">
            <div />
          </template>
          <template v-else>
            <div />
          </template>
        </template>
      `,
      {
        inlineTemplate: false,
        vapor: true,
      },
    )

    expect(content).toContain(`__multiRoot: false`)
  })

  test('treats preserved root comments as root units', () => {
    const { content } = compile(
      `
        <script setup vapor>
        const ok = true
        </script>
        <template>
          <!-- root comment -->
          <div />
        </template>
      `,
      {
        inlineTemplate: false,
        vapor: true,
      },
    )

    expect(content).toContain(`__multiRoot: true`)
  })

  test('respects template comments option when inferring multiRoot', () => {
    const { content } = compile(
      `
        <script setup vapor>
        const ok = true
        </script>
        <template>
          <!-- root comment -->
          <div />
        </template>
      `,
      {
        inlineTemplate: false,
        vapor: true,
        templateOptions: {
          compilerOptions: {
            comments: false,
          },
        },
      },
    )

    expect(content).toContain(`__multiRoot: false`)
  })

  test('ignores comments between root if branches', () => {
    const { content } = compile(
      `
        <script setup vapor>
        const ok = true
        </script>
        <template>
          <template v-if="ok">
            <div />
          </template>
          <!-- branch separator -->
          <template v-else>
            <div />
          </template>
        </template>
      `,
      {
        inlineTemplate: false,
        vapor: true,
      },
    )

    expect(content).toContain(`__multiRoot: false`)
  })

  test('ignores preserved whitespace between root if branches', () => {
    const { content } = compile(
      `
        <script setup vapor>
        const ok = true
        </script>
        <template>
          <template v-if="ok">
            <div />
          </template>

          <template v-else>
            <div />
          </template>
        </template>
      `,
      {
        inlineTemplate: false,
        vapor: true,
      },
      {
        templateParseOptions: {
          whitespace: 'preserve',
        },
      },
    )

    expect(content).toContain(`__multiRoot: false`)
  })

  test('treats root v-for as a single owner unit', () => {
    const { content } = compile(
      `
        <script setup vapor>
        const list = [1, 2]
        </script>
        <template>
          <template v-for="item in list" :key="item">
            <div>{{ item }}</div>
          </template>
        </template>
      `,
      {
        inlineTemplate: false,
        vapor: true,
      },
    )

    expect(content).toContain(`__multiRoot: false`)
  })

  test('treats a root slot outlet as a single owner unit', () => {
    const { content } = compile(
      `
        <script setup vapor>
        const ok = true
        </script>
        <template>
          <slot />
        </template>
      `,
      {
        inlineTemplate: false,
        vapor: true,
      },
    )

    expect(content).toContain(`__multiRoot: false`)
  })

  test('treats root text with a sibling as multi-root', () => {
    const { content } = compile(
      `
        <script setup vapor>
        const msg = 'hello'
        </script>
        <template>
          hello
          <div />
        </template>
      `,
      {
        inlineTemplate: false,
        vapor: true,
      },
    )

    expect(content).toContain(`__multiRoot: true`)
  })

  test('treats a root component as a single owner unit', () => {
    const { content } = compile(
      `
        <script setup vapor>
        const Foo = {}
        </script>
        <template>
          <Foo />
        </template>
      `,
      {
        inlineTemplate: false,
        vapor: true,
      },
    )

    expect(content).toContain(`__multiRoot: false`)
  })

  test('treats a root component with a sibling as multi-root', () => {
    const { content } = compile(
      `
        <script setup vapor>
        import { KeepAlive } from 'vue'
        </script>
        <template>
          <KeepAlive>
            <div />
          </KeepAlive>
          <span />
        </template>
      `,
      {
        inlineTemplate: true,
        vapor: true,
      },
    )

    expect(content).toContain(`__multiRoot: true`)
  })

  test('treats a plain root template element as a single root', () => {
    const { content } = compile(
      `
        <script setup vapor>
        const ok = true
        </script>
        <template>
          <template>
            <div />
            <div />
          </template>
        </template>
      `,
      {
        inlineTemplate: false,
        vapor: true,
      },
    )

    expect(content).toContain(`__multiRoot: false`)
  })

  test('marks an inline component as multi-root', () => {
    const { content } = compile(
      `
        <script setup vapor>
        const ok = true
        </script>
        <template>
          <div />
          <div />
        </template>
      `,
      {
        inlineTemplate: true,
        vapor: true,
      },
    )

    expect(content).toContain(`__multiRoot: true`)
  })
})
