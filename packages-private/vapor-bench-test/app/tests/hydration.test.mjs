import assert from 'node:assert/strict'
import { test } from 'node:test'
import { injectHydrationHtml } from '../src/bench/hydration.mjs'

test('injects ssr html into the client app container', () => {
  const html =
    '<body><div id="app"></div><script src="/entry.js"></script></body>'

  assert.equal(
    injectHydrationHtml(html, '<main data-server-rendered="true">ok</main>'),
    '<body><div id="app"><main data-server-rendered="true">ok</main></div><script src="/entry.js"></script></body>',
  )
})

test('injects hydration scripts before the client module', () => {
  const html =
    '<body><div id="app"></div><script type="module" src="/entry.js"></script></body>'

  assert.equal(
    injectHydrationHtml(html, '<main>ok</main>', '<script>window.x=1</script>'),
    '<body><div id="app"><main>ok</main></div><script>window.x=1</script><script type="module" src="/entry.js"></script></body>',
  )
})
