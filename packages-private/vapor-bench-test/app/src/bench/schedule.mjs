export function createDashboardSchedule({ targets, runs, warmupRuns }) {
  const schedule = []
  const measuredRunsByTarget = Object.fromEntries(
    targets.map(target => [target.id, 0]),
  )

  for (let roundIndex = 0; roundIndex < warmupRuns + runs; roundIndex++) {
    const phase = roundIndex < warmupRuns ? 'warmup' : 'measure'
    const round =
      phase === 'warmup' ? roundIndex + 1 : roundIndex - warmupRuns + 1
    const orderedTargets = rotateTargets(targets, roundIndex)

    for (const target of orderedTargets) {
      const sample = {
        phase,
        round,
        target,
      }

      if (phase === 'measure') {
        measuredRunsByTarget[target.id] += 1
        sample.run = measuredRunsByTarget[target.id]
      }

      schedule.push(sample)
    }
  }

  return schedule
}

function rotateTargets(targets, roundIndex) {
  const offset = roundIndex % targets.length
  return [...targets.slice(offset), ...targets.slice(0, offset)]
}
