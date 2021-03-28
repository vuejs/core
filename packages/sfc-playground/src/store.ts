import { reactive, watchEffect } from 'vue'
import {
  parse,
  compileTemplate,
  compileStyleAsync,
  compileScript,
  rewriteDefault,
  CompilerError
} from '@vue/compiler-sfc'

const storeKey = 'sfc-code'
const saved =
  localStorage.getItem(storeKey) ||
  `
<template>
  <h1>{{ msg }}</h1>
</template>

<script setup>
const msg = 'Hello World!'
</script>

<style scoped>
h1 {
  color: #42b983;
}
</style>
`.trim()

// @ts-ignore
export const sandboxVueURL = import.meta.env.PROD
  ? '/vue.runtime.esm-browser.js' // to be copied on build
  : '/src/vue-dev-proxy'

export const store = reactive({
  code: saved,
  compiled: {
    executed: '',
    js: '',
    css: '',
    template: ''
  },
  errors: [] as (string | CompilerError | SyntaxError)[]
})

const filename = 'Playground.vue'
const id = 'scope-id'
const compIdentifier = `__comp`

watchEffect(async () => {
  const { code, compiled } = store
  if (!code.trim()) {
    return
  }

  localStorage.setItem(storeKey, code)

  const { errors, descriptor } = parse(code, { filename, sourceMap: true })
  if (errors.length) {
    store.errors = errors
    return
  }

  const hasScoped = descriptor.styles.some(s => s.scoped)
  let finalCode = ''

  if (
    (descriptor.script && descriptor.script.lang) ||
    (descriptor.scriptSetup && descriptor.scriptSetup.lang) ||
    descriptor.styles.some(s => s.lang) ||
    (descriptor.template && descriptor.template.lang)
  ) {
    store.errors = [
      'lang="x" pre-processors are not supported in the in-browser playground.'
    ]
    return
  }

  // script
  if (descriptor.script || descriptor.scriptSetup) {
    try {
      const compiledScript = compileScript(descriptor, {
        id,
        refSugar: true,
        inlineTemplate: true
      })
      compiled.js = compiledScript.content.trim()
      finalCode +=
        `\n` +
        rewriteDefault(
          rewriteVueImports(compiledScript.content),
          compIdentifier
        )
    } catch (e) {
      store.errors = [e]
      return
    }
  } else {
    compiled.js = ''
    finalCode += `\nconst ${compIdentifier} = {}`
  }

  // template
  if (descriptor.template && !descriptor.scriptSetup) {
    const templateResult = compileTemplate({
      source: descriptor.template.content,
      filename,
      id,
      scoped: hasScoped,
      slotted: descriptor.slotted,
      isProd: false
    })
    if (templateResult.errors.length) {
      store.errors = templateResult.errors
      return
    }

    compiled.template = templateResult.code.trim()
    finalCode +=
      `\n` +
      rewriteVueImports(templateResult.code).replace(
        /\nexport (function|const) render/,
        '$1 render'
      )
    finalCode += `\n${compIdentifier}.render = render`
  } else {
    compiled.template = descriptor.scriptSetup
      ? '/* inlined in JS (script setup) */'
      : '/* no template present */'
  }
  if (hasScoped) {
    finalCode += `\n${compIdentifier}.__scopeId = ${JSON.stringify(
      `data-v-${id}`
    )}`
  }

  // styles
  let css = ''
  for (const style of descriptor.styles) {
    if (style.module) {
      // TODO error
      continue
    }

    const styleResult = await compileStyleAsync({
      source: style.content,
      filename,
      id,
      scoped: style.scoped,
      modules: !!style.module
    })
    if (styleResult.errors.length) {
      // postcss uses pathToFileURL which isn't polyfilled in the browser
      // ignore these errors for now
      if (!styleResult.errors[0].message.includes('pathToFileURL')) {
        store.errors = styleResult.errors
      }
      // proceed even if css compile errors
    } else {
      css += styleResult.code + '\n'
    }
  }
  if (css) {
    compiled.css = css.trim()
    finalCode += `\ndocument.getElementById('__sfc-styles').innerHTML = ${JSON.stringify(
      css
    )}`
  } else {
    compiled.css = ''
  }

  store.errors = []
  if (finalCode) {
    compiled.executed =
      `/* Exact code being executed in the preview iframe (different from production bundler output) */\n` +
      finalCode
  }
})

// TODO use proper parser
function rewriteVueImports(code: string): string {
  return code.replace(
    /\b(import \{.*?\}\s+from\s+)(?:"vue"|'vue')/g,
    `$1"${sandboxVueURL}"`
  )
}
