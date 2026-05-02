import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  getFirstScreenUrl,
  getHydrationScenarios,
  getScenarioTargets,
  resolveScenario,
} from '../src/bench/targets.mjs'

test('dashboard hydration is a standalone first-screen scenario', () => {
  const scenario = resolveScenario('dashboard-hydration')

  assert.equal(scenario.id, 'dashboard-hydration')
  assert.equal(scenario.measurement, 'hydration-first-screen')
  assert.equal(scenario.resultPrefix, 'dashboard-hydration')
})

test('dashboard hydration targets have separate client and server dist dirs', () => {
  const targets = getScenarioTargets('dashboard-hydration')

  assert.deepEqual(
    targets.map(target => target.id),
    ['vdom', 'vapor', 'solid'],
  )
  assert.deepEqual(
    targets.map(target => target.distDir),
    [
      'dist/dashboard-hydration/vdom/client',
      'dist/dashboard-hydration/vapor/client',
      'dist/dashboard-hydration/solid/client',
    ],
  )
  assert.deepEqual(
    targets.map(target => target.serverDistDir),
    [
      'dist/dashboard-hydration/vdom/server',
      'dist/dashboard-hydration/vapor/server',
      'dist/dashboard-hydration/solid/server',
    ],
  )
})

test('dashboard hydration uses its own URL namespace', () => {
  assert.equal(
    getFirstScreenUrl('dashboard-hydration', 'vapor', 4173),
    'http://127.0.0.1:4173/dashboard-hydration/vapor/',
  )
})

test('static-heavy hydration is a standalone first-screen scenario', () => {
  const scenario = resolveScenario('static-heavy-hydration')

  assert.equal(scenario.id, 'static-heavy-hydration')
  assert.equal(scenario.measurement, 'hydration-first-screen')
  assert.equal(scenario.resultPrefix, 'static-heavy-hydration')
  assert.equal(scenario.sourceScenarioId, 'static-heavy')
})

test('static-heavy hydration targets have separate client and server dist dirs', () => {
  const targets = getScenarioTargets('static-heavy-hydration')

  assert.deepEqual(
    targets.map(target => target.id),
    ['vdom', 'vapor', 'solid'],
  )
  assert.deepEqual(
    targets.map(target => target.distDir),
    [
      'dist/static-heavy-hydration/vdom/client',
      'dist/static-heavy-hydration/vapor/client',
      'dist/static-heavy-hydration/solid/client',
    ],
  )
  assert.deepEqual(
    targets.map(target => target.serverDistDir),
    [
      'dist/static-heavy-hydration/vdom/server',
      'dist/static-heavy-hydration/vapor/server',
      'dist/static-heavy-hydration/solid/server',
    ],
  )
})

test('static-heavy hydration uses its own URL namespace', () => {
  assert.equal(
    getFirstScreenUrl('static-heavy-hydration', 'solid', 4173),
    'http://127.0.0.1:4173/static-heavy-hydration/solid/',
  )
})

test('hydration scenario list only includes hydration benches', () => {
  assert.deepEqual(
    getHydrationScenarios().map(scenario => scenario.id),
    ['dashboard-hydration', 'static-heavy-hydration'],
  )
})
