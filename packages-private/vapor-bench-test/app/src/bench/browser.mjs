export function resolveHeadlessMode(env) {
  const value = env.BENCH_HEADLESS
  return value === '1' || value === 'true'
}

export function resolveCpuThrottle(env, scenario) {
  if (env.BENCH_CPU_THROTTLE) {
    return Number(env.BENCH_CPU_THROTTLE)
  }

  return scenario.measurement === 'operations' ? 10 : 4
}

export function createChromeLaunchOptions({ chromePath, headless }) {
  const disabledFeatures = [
    'Translate',
    'PrivacySandboxSettings4',
    'IPH_SidePanelGenericMenuFeature',
  ]

  return {
    executablePath: chromePath,
    headless,
    args: [
      '--ash-no-nudges',
      '--disable-background-networking',
      '--disable-default-apps',
      '--disable-extensions',
      `--disable-features=${disabledFeatures.join(',')}`,
      '--disable-sync',
      '--js-flags=--expose-gc',
      '--no-default-browser-check',
      '--no-first-run',
    ],
  }
}
