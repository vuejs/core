import { store, File } from './store'
import {
  SFCDescriptor,
  BindingMetadata,
  shouldTransformRef,
  transformRef
} from '@vue/compiler-sfc'
import * as defaultCompiler from '@vue/compiler-sfc'
import { ref } from 'vue'

export const MAIN_FILE = 'App.vue'
export const COMP_IDENTIFIER = `__sfc__`

/**
 * The default SFC compiler we are using is built from each commit
 * but we may swap it out with a version fetched from CDNs
 */
let SFCCompiler: typeof defaultCompiler = defaultCompiler

// @ts-ignore
const defaultVueUrl = import.meta.env.PROD
  ? `${location.origin}/vue.runtime.esm-browser.js` // to be copied on build
  : `${location.origin}/src/vue-dev-proxy`

export const vueRuntimeUrl = ref(defaultVueUrl)

export async function setVersion(version: string) {
  const compilerUrl = `https://unpkg.com/@vue/compiler-sfc@${version}/dist/compiler-sfc.esm-browser.js`
  const runtimeUrl = `https://unpkg.com/@vue/runtime-dom@${version}/dist/runtime-dom.esm-browser.js`
  const [compiler] = await Promise.all([
    import(/* @vite-ignore */ compilerUrl),
    import(/* @vite-ignore */ runtimeUrl)
  ])
  SFCCompiler = compiler
  vueRuntimeUrl.value = runtimeUrl
  console.info(`Now using Vue version: ${version}`)
}

export function resetVersion() {
  SFCCompiler = defaultCompiler
  vueRuntimeUrl.value = defaultVueUrl
}

async function transformTS(src: string) {
  return (await import('sucrase')).transform(src, {
    transforms: ['typescript']
  }).code
}

export async function compileFile({ filename, code, compiled }: File) {
  if (!code.trim()) {
    store.errors = []
    return
  }

  if (!filename.endsWith('.vue')) {
    if (shouldTransformRef(code)) {
      code = transformRef(code, { filename }).code
    }

    if (filename.endsWith('.ts')) {
      code = await transformTS(code)
    }

    compiled.js = compiled.ssr = code
    store.errors = []
    return
  }

  const id = await hashId(filename)
  const { errors, descriptor } = SFCCompiler.parse(code, {
    filename,
    sourceMap: true
  })
  if (errors.length) {
    store.errors = errors
    return
  }

  if (
    descriptor.styles.some(s => s.lang) ||
    (descriptor.template && descriptor.template.lang)
  ) {
    store.errors = [
      `lang="x" pre-processors for <template> or <style> are currently not ` +
        `supported.`
    ]
    return
  }

  const scriptLang =
    (descriptor.script && descriptor.script.lang) ||
    (descriptor.scriptSetup && descriptor.scriptSetup.lang)
  if (scriptLang && scriptLang !== 'ts') {
    store.errors = [`Only lang="ts" is supported for <script> blocks.`]
    return
  }

  const hasScoped = descriptor.styles.some(s => s.scoped)
  let clientCode = ''
  let ssrCode = ''

  const appendSharedCode = (code: string) => {
    clientCode += code
    ssrCode += code
  }

  const clientScriptResult = await doCompileScript(descriptor, id, false)
  if (!clientScriptResult) {
    return
  }
  const [clientScript, bindings] = clientScriptResult
  clientCode += clientScript

  // script ssr only needs to be performed if using <script setup> where
  // the render fn is inlined.
  if (descriptor.scriptSetup) {
    const ssrScriptResult = await doCompileScript(descriptor, id, true)
    if (ssrScriptResult) {
      ssrCode += ssrScriptResult[0]
    } else {
      ssrCode = `/* SSR compile error: ${store.errors[0]} */`
    }
  } else {
    // when no <script setup> is used, the script result will be identical.
    ssrCode += clientScript
  }

  // template
  // only need dedicated compilation if not using <script setup>
  if (descriptor.template && !descriptor.scriptSetup) {
    const clientTemplateResult = doCompileTemplate(
      descriptor,
      id,
      bindings,
      false
    )
    if (!clientTemplateResult) {
      return
    }
    clientCode += clientTemplateResult

    const ssrTemplateResult = doCompileTemplate(descriptor, id, bindings, true)
    if (ssrTemplateResult) {
      // ssr compile failure is fine
      ssrCode += ssrTemplateResult
    } else {
      ssrCode = `/* SSR compile error: ${store.errors[0]} */`
    }
  }

  if (hasScoped) {
    appendSharedCode(
      `\n${COMP_IDENTIFIER}.__scopeId = ${JSON.stringify(`data-v-${id}`)}`
    )
  }

  if (clientCode || ssrCode) {
    appendSharedCode(
      `\n${COMP_IDENTIFIER}.__file = ${JSON.stringify(filename)}` +
        `\nexport default ${COMP_IDENTIFIER}`
    )
    compiled.js = clientCode.trimStart()
    compiled.ssr = ssrCode.trimStart()
  }

  // styles
  let css = ''
  for (const style of descriptor.styles) {
    if (style.module) {
      store.errors = [`<style module> is not supported in the playground.`]
      return
    }

    const styleResult = await SFCCompiler.compileStyleAsync({
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
  } else {
    compiled.css = '/* No <style> tags present */'
  }

  // clear errors
  store.errors = []
}

async function doCompileScript(
  descriptor: SFCDescriptor,
  id: string,
  ssr: boolean
): Promise<[string, BindingMetadata | undefined] | undefined> {
  if (descriptor.script || descriptor.scriptSetup) {
    try {
      const compiledScript = SFCCompiler.compileScript(descriptor, {
        id,
        refTransform: true,
        inlineTemplate: true,
        templateOptions: {
          ssr,
          ssrCssVars: descriptor.cssVars
        }
      })
      let code = ''
      if (compiledScript.bindings) {
        code += `\n/* Analyzed bindings: ${JSON.stringify(
          compiledScript.bindings,
          null,
          2
        )} */`
      }
      code +=
        `\n` +
        SFCCompiler.rewriteDefault(compiledScript.content, COMP_IDENTIFIER)

      if ((descriptor.script || descriptor.scriptSetup)!.lang === 'ts') {
        code = await transformTS(code)
      }

      return [code, compiledScript.bindings]
    } catch (e) {
      store.errors = [e.stack.split('\n').slice(0, 12).join('\n')]
      return
    }
  } else {
    return [`\nconst ${COMP_IDENTIFIER} = {}`, undefined]
  }
}

function doCompileTemplate(
  descriptor: SFCDescriptor,
  id: string,
  bindingMetadata: BindingMetadata | undefined,
  ssr: boolean
) {
  const templateResult = SFCCompiler.compileTemplate({
    source: descriptor.template!.content,
    filename: descriptor.filename,
    id,
    scoped: descriptor.styles.some(s => s.scoped),
    slotted: descriptor.slotted,
    ssr,
    ssrCssVars: descriptor.cssVars,
    isProd: false,
    compilerOptions: {
      bindingMetadata
    }
  })
  if (templateResult.errors.length) {
    store.errors = templateResult.errors
    return
  }

  const fnName = ssr ? `ssrRender` : `render`

  return (
    `\n${templateResult.code.replace(
      /\nexport (function|const) (render|ssrRender)/,
      `$1 ${fnName}`
    )}` + `\n${COMP_IDENTIFIER}.${fnName} = ${fnName}`
  )
}

async function hashId(filename: string) {
  const msgUint8 = new TextEncoder().encode(filename) // encode as (utf-8) Uint8Array
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8) // hash the message
  const hashArray = Array.from(new Uint8Array(hashBuffer)) // convert buffer to byte array
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('') // convert bytes to hex string
  return hashHex.slice(0, 8)
}
