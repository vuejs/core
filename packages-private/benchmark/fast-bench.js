const DEV = !!process.env.VSCODE_INSPECTOR_OPTIONS
const repeat = arr => arr.flatMap(v => [v, v, v])

await polyfill()
await build()
await bench()

async function polyfill() {
  const { JSDOM } = await import('jsdom')

  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>')
  globalThis.document = dom.window.document
  globalThis.Node = dom.window.Node
}

async function build() {
  const { compile } = await import(
    '../../packages/compiler-vapor/dist/compiler-vapor.esm-browser.js'
  )

  const code = compile(
    `
  <table class="table table-hover table-striped test-data">
    <tbody>
      <tr
        v-for="row of rows"
        :key="row.id"
        :class="selected === row.id ? 'danger' : ''"
      >
        <td class="col-md-1">{{ row.id }}</td>
        <td class="col-md-4">
          <a @click="select(row.id)">{{ row.label.value }}</a>
        </td>
        <td class="col-md-1">
          <a @click="remove(row.id)">
            <span class="glyphicon glyphicon-remove" aria-hidden="true">x</span>
          </a>
        </td>
        <td class="col-md-6"></td>
      </tr>
    </tbody>
  </table>
`,
    {
      mode: 'module',
      prefixIdentifiers: true,
    },
  )
    .code.replace(
      ` from 'vue'`,
      ` from '../../../packages/vue/dist/vue.runtime-with-vapor.esm-browser${!DEV ? '.prod' : ''}.js'`,
    )
    .replaceAll(`_delegateEvents(`, `// _delegateEvents(`)

  const { writeFileSync, existsSync, mkdirSync } = await import('node:fs')
  const { dirname, resolve } = await import('node:path')
  const { fileURLToPath } = await import('node:url')

  const __filename = fileURLToPath(import.meta.url)
  const __dirname = dirname(__filename)
  const outPath = resolve(__dirname, 'dist', 'component.js')

  if (!existsSync(dirname(outPath))) {
    mkdirSync(dirname(outPath))
  }
  writeFileSync(outPath, code)
}

async function bench() {
  let ID = 1

  const { render } = await import('./dist/component.js')

  const {
    shallowRef,
    reactive,
    VaporComponentInstance,
    simpleSetCurrentInstance,
    nextTick,
  } = await import(
    `../../packages/vue/dist/vue.runtime-with-vapor.esm-browser${!DEV ? '.prod' : ''}.js`
  )

  const ctx = reactive({
    selected: null,
    rows: [],
  })

  simpleSetCurrentInstance(new VaporComponentInstance({}, {}, null))
  render(ctx)

  const { run, bench, boxplot } = await import('mitata')

  boxplot(() => {
    for (const shouldRender of [false, true]) {
      const subfix = shouldRender ? ' (render)' : ''

      // bench('append: $n' + subfix, async function* (state) {
      //   const n = state.get('n')
      //   ctx.rows = []
      //   await nextTick()
      //   yield () => {
      //     ctx.rows = ctx.rows.concat(buildData(n))
      //     if (shouldRender) {
      //       await nextTick()
      //     }
      //   }
      // }).args('n', [1])

      bench('select: $n' + subfix, async function* (state) {
        const n = state.get('n')
        ctx.rows = buildData(n)
        await nextTick()
        const ids = ctx.rows.map(d => d.id)
        let i = 0
        yield shouldRender
          ? async () => {
              ctx.selected = ids[i++ % ids.length]
              await nextTick()
            }
          : () => {
              ctx.selected = ids[i++ % ids.length]
            }
      }).args('n', repeat([100]))

      bench('full-update: $n' + subfix, async function* (state) {
        const n = state.get('n')
        ctx.rows = buildData(n)
        await nextTick()
        yield shouldRender
          ? async () => {
              for (const row of ctx.rows) {
                row.label += ' !!!'
              }
              await nextTick()
            }
          : () => {
              for (const row of ctx.rows) {
                row.label += ' !!!'
              }
            }
      }).args('n', repeat([100]))

      bench('partial-update: $n' + subfix, async function* (state) {
        const n = state.get('n')
        ctx.rows = buildData(n)
        await nextTick()
        const toUpdate = []
        for (let i = 0; i < ctx.rows.length; i += 10) {
          toUpdate.push(ctx.rows[i])
        }
        yield shouldRender
          ? async () => {
              for (const row of toUpdate) {
                row.label += ' !!!'
              }
              await nextTick()
            }
          : () => {
              for (const row of toUpdate) {
                row.label += ' !!!'
              }
            }
      }).args('n', repeat([1000]))
    }
  })

  run({ format: 'markdown' })

  function _random(max) {
    return Math.round(Math.random() * 1000) % max
  }

  function buildData(count = 1000) {
    const adjectives = [
      'pretty',
      'large',
      'big',
      'small',
      'tall',
      'short',
      'long',
      'handsome',
      'plain',
      'quaint',
      'clean',
      'elegant',
      'easy',
      'angry',
      'crazy',
      'helpful',
      'mushy',
      'odd',
      'unsightly',
      'adorable',
      'important',
      'inexpensive',
      'cheap',
      'expensive',
      'fancy',
    ]
    const colours = [
      'red',
      'yellow',
      'blue',
      'green',
      'pink',
      'brown',
      'purple',
      'brown',
      'white',
      'black',
      'orange',
    ]
    const nouns = [
      'table',
      'chair',
      'house',
      'bbq',
      'desk',
      'car',
      'pony',
      'cookie',
      'sandwich',
      'burger',
      'pizza',
      'mouse',
      'keyboard',
    ]
    const data = []
    for (let i = 0; i < count; i++)
      data.push({
        id: ID++,
        label: shallowRef(
          adjectives[_random(adjectives.length)] +
            ' ' +
            colours[_random(colours.length)] +
            ' ' +
            nouns[_random(nouns.length)],
        ),
      })
    return data
  }
}
