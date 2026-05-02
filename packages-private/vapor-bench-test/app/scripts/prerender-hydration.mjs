import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { fileURLToPath } from 'node:url'
import { injectHydrationHtml } from '../src/bench/hydration.mjs'
import { getScenarioTargets, resolveScenario } from '../src/bench/targets.mjs'

const appRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const scenario = resolveScenario(
  process.env.BENCH_SCENARIO || 'dashboard-hydration',
)

if (scenario.measurement !== 'hydration-first-screen') {
  throw new Error(`${scenario.id} is not a hydration scenario`)
}

for (const target of getScenarioTargets(scenario.id)) {
  const serverEntry = path.join(appRoot, target.serverDistDir, 'server.mjs')
  const clientIndex = path.join(appRoot, target.distDir, 'index.html')
  const serverModule = await import(pathToFileURL(serverEntry).href)

  if (typeof serverModule.render !== 'function') {
    throw new Error(`${target.id} server bundle does not export render()`)
  }

  const rendered = await serverModule.render()
  const ssrHtml = typeof rendered === 'string' ? rendered : rendered.html
  const hydrationScript =
    typeof rendered === 'string' ? '' : rendered.hydrationScript || ''
  const html = await fs.readFile(clientIndex, 'utf8')
  await fs.writeFile(
    clientIndex,
    injectHydrationHtml(html, ssrHtml, hydrationScript),
  )
  await fs.writeFile(
    path.join(appRoot, target.serverDistDir, 'ssr.html'),
    ssrHtml,
  )
  console.info(`Hydration HTML written for ${scenario.id}/${target.id}`)
}
