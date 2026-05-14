const RENDER_TARGETS = [
  {
    id: 'vdom',
    label: 'Vue VDOM',
  },
  {
    id: 'vapor',
    label: 'Vue Vapor',
  },
  {
    id: 'solid',
    label: 'Solid',
  },
]

const HYDRATION_TARGETS = RENDER_TARGETS.map(target => ({
  ...target,
  label: `${target.label} Hydration`,
}))

export const BENCH_SCENARIOS = {
  dashboard: {
    id: 'dashboard',
    label: 'Dashboard',
    reportTitle: 'Dashboard First Screen Report',
    resultPrefix: 'dashboard-first-screen',
  },
  dashboardHydration: {
    id: 'dashboard-hydration',
    label: 'Dashboard hydration',
    reportTitle: 'Dashboard Hydration First Screen Report',
    resultPrefix: 'dashboard-hydration',
    measurement: 'hydration-first-screen',
    sourceScenarioId: 'dashboard',
  },
  staticHeavy: {
    id: 'static-heavy',
    label: 'Static-heavy',
    reportTitle: 'Static-heavy First Screen Report',
    resultPrefix: 'static-heavy-first-screen',
    measurement: 'first-screen',
  },
  staticHeavyHydration: {
    id: 'static-heavy-hydration',
    label: 'Static-heavy hydration',
    reportTitle: 'Static-heavy Hydration First Screen Report',
    resultPrefix: 'static-heavy-hydration',
    measurement: 'hydration-first-screen',
    sourceScenarioId: 'static-heavy',
  },
  localizedLeaf: {
    id: 'localized-leaf',
    label: 'Localized leaf updates',
    reportTitle: 'Localized Leaf Updates Report',
    resultPrefix: 'localized-leaf',
    measurement: 'operations',
  },
  conditionalBranch: {
    id: 'conditional-branch',
    label: 'Conditional branch churn',
    reportTitle: 'Conditional Branch Churn Report',
    resultPrefix: 'conditional-branch',
    measurement: 'operations',
  },
  componentFanout: {
    id: 'component-fanout',
    label: 'Component fanout',
    reportTitle: 'Component Fanout Report',
    resultPrefix: 'component-fanout',
    measurement: 'operations',
  },
  dynamicPropsAttrs: {
    id: 'dynamic-props-attrs',
    label: 'Dynamic props / attrs fallthrough',
    reportTitle: 'Dynamic Props / Attrs Fallthrough Report',
    resultPrefix: 'dynamic-props-attrs',
    measurement: 'operations',
  },
  codeSlope: {
    id: 'code-slope',
    label: 'Generated code slope',
    reportTitle: 'Generated Code Slope Report',
    resultPrefix: 'code-slope',
    measurement: 'code-size-slope',
  },
}

export const DASHBOARD_TARGETS = getScenarioTargets('dashboard')
export const DASHBOARD_DEFAULT_RUNS = 15
export const DASHBOARD_DEFAULT_WARMUP_RUNS = 5

export function resolveScenario(id) {
  const scenario = Object.values(BENCH_SCENARIOS).find(
    scenario => scenario.id === id,
  )

  if (!scenario) {
    const expected = Object.values(BENCH_SCENARIOS)
      .map(scenario => scenario.id)
      .join(', ')
    throw new Error(`Unknown BENCH_SCENARIO "${id}". Expected ${expected}.`)
  }

  return scenario
}

export function getHydrationScenarios() {
  return Object.values(BENCH_SCENARIOS).filter(
    scenario => scenario.measurement === 'hydration-first-screen',
  )
}

export function getMemoryScenarios() {
  return Object.values(BENCH_SCENARIOS).filter(
    scenario => scenario.measurement !== 'code-size-slope',
  )
}

export function getScenarioTargets(scenarioId) {
  const scenario = resolveScenario(scenarioId)
  const targets =
    scenario.measurement === 'hydration-first-screen'
      ? HYDRATION_TARGETS
      : RENDER_TARGETS

  return targets.map(target => ({
    ...target,
    ...getTargetDistDirs(scenario, target.id),
  }))
}

function getTargetDistDirs(scenario, targetId) {
  if (scenario.measurement === 'hydration-first-screen') {
    return {
      distDir: `dist/${scenario.id}/${targetId}/client`,
      serverDistDir: `dist/${scenario.id}/${targetId}/server`,
    }
  }

  return {
    distDir:
      scenario.id === 'dashboard'
        ? `dist/${targetId}`
        : `dist/${scenario.id}/${targetId}`,
  }
}

export function getFirstScreenUrl(scenarioId, target, port) {
  const targetId = typeof target === 'string' ? target : target.id
  const route =
    scenarioId === 'dashboard' ? targetId : `${scenarioId}/${targetId}`

  return `http://127.0.0.1:${port}/${route}/`
}

export function getDashboardUrl(target, port) {
  return getFirstScreenUrl('dashboard', target, port)
}
