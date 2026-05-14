export function summarizeTrace(events, options = {}) {
  const traceWindow = resolveTraceWindow(events, options.window)
  const completeEvents = events.filter(
    event => event.ph === 'X' && event.dur > 0 && typeof event.tid === 'number',
  )
  const mainThread = findRendererMainThread(events, completeEvents, traceWindow)
  const mainEvents = completeEvents.filter(event => event.tid === mainThread)
  const busyMs = unionDuration(mainEvents, traceWindow) / 1000
  const scriptingMs =
    unionDuration(mainEvents.filter(isScriptingEvent), traceWindow) / 1000
  const renderingMs =
    unionDuration(mainEvents.filter(isRenderingEvent), traceWindow) / 1000
  const paintingMs =
    unionDuration(mainEvents.filter(isPaintingEvent), traceWindow) / 1000
  const taskEvents = mainEvents.filter(isTaskEvent)
  const taskDurations = (
    taskEvents.length > 0
      ? taskEvents
          .map(event => getEventInterval(event, traceWindow))
          .filter(Boolean)
      : unionIntervals(mainEvents, traceWindow)
  ).map(([start, end]) => (end - start) / 1000)
  const jsParseCompileMs =
    unionDuration(mainEvents.filter(isJsParseCompileEvent), traceWindow) / 1000
  const jsEvaluateMs =
    unionDuration(mainEvents.filter(isJsEvaluateEvent), traceWindow) / 1000
  const summary = {
    mainThread,
    mainThreadBusyMs: round(busyMs),
    scriptingMs: round(scriptingMs),
    renderingMs: round(renderingMs),
    paintingMs: round(paintingMs),
    longTaskCount: taskDurations.filter(duration => duration >= 50).length,
    maxTaskMs: round(
      taskDurations.length === 0 ? 0 : Math.max(...taskDurations),
    ),
    jsParseCompileMs: round(jsParseCompileMs),
    jsEvaluateMs: round(jsEvaluateMs),
  }

  if (traceWindow) {
    summary.traceWindowMs = round(
      (traceWindow.endTs - traceWindow.startTs) / 1000,
    )
  }

  summary.warnings = createTraceWarnings(summary, mainEvents, traceWindow)

  return summary
}

function resolveTraceWindow(events, traceWindow) {
  if (!traceWindow) return undefined

  const startMark = findTraceMark(events, traceWindow.startMark)
  const endMark = findTraceMark(events, traceWindow.endMark)
  const startTs =
    typeof traceWindow.startTs === 'number'
      ? traceWindow.startTs
      : startMark && startMark.ts
  const endTs =
    typeof traceWindow.endTs === 'number'
      ? traceWindow.endTs
      : endMark && endMark.ts

  if (typeof startTs !== 'number') {
    throw new Error(`Missing trace start mark "${traceWindow.startMark}"`)
  }
  if (typeof endTs !== 'number') {
    throw new Error(`Missing trace end mark "${traceWindow.endMark}"`)
  }
  if (endTs <= startTs) {
    throw new Error(`Invalid trace window ${startTs}..${endTs}`)
  }

  return {
    startTs,
    endTs,
  }
}

function findTraceMark(events, name) {
  return events.find(
    event =>
      event.name === name &&
      typeof event.ts === 'number' &&
      (event.cat || '').includes('blink.user_timing'),
  )
}

function findRendererMainThread(events, completeEvents, traceWindow) {
  const rendererPids = new Set(
    events
      .filter(
        event =>
          event.ph === 'M' &&
          event.name === 'process_name' &&
          event.args &&
          event.args.name === 'Renderer',
      )
      .map(event => event.pid),
  )
  const rendererMains = events
    .filter(
      event =>
        event.ph === 'M' &&
        event.name === 'thread_name' &&
        event.args &&
        event.args.name === 'CrRendererMain' &&
        (rendererPids.size === 0 || rendererPids.has(event.pid)),
    )
    .map(event => ({
      pid: event.pid,
      tid: event.tid,
      duration: unionDuration(
        completeEvents.filter(
          completeEvent =>
            completeEvent.pid === event.pid && completeEvent.tid === event.tid,
        ),
        traceWindow,
      ),
    }))
    .sort((a, b) => b.duration - a.duration)

  if (rendererMains.length > 0 && rendererMains[0].duration > 0) {
    return rendererMains[0].tid
  }
  if (rendererMains.length > 0) {
    return rendererMains[0].tid
  }

  return findBusyThread(completeEvents, traceWindow)
}

function findBusyThread(events, traceWindow) {
  const totals = new Map()

  for (const event of events) {
    if (!isTimelineEvent(event)) continue
    const interval = getEventInterval(event, traceWindow)
    if (!interval) continue
    totals.set(
      event.tid,
      (totals.get(event.tid) || 0) + interval[1] - interval[0],
    )
  }

  const busiest = Array.from(totals.entries()).sort((a, b) => b[1] - a[1])[0]

  return busiest ? busiest[0] : 0
}

function unionDuration(events, traceWindow) {
  return unionIntervals(events, traceWindow).reduce(
    (total, [start, end]) => total + end - start,
    0,
  )
}

function unionIntervals(events, traceWindow) {
  const intervals = events
    .filter(isTimelineEvent)
    .map(event => getEventInterval(event, traceWindow))
    .filter(Boolean)
    .sort((a, b) => a[0] - b[0])

  const merged = []
  let currentStart = 0
  let currentEnd = 0

  for (const [start, end] of intervals) {
    if (currentEnd === 0) {
      currentStart = start
      currentEnd = end
    } else if (start <= currentEnd) {
      currentEnd = Math.max(currentEnd, end)
    } else {
      merged.push([currentStart, currentEnd])
      currentStart = start
      currentEnd = end
    }
  }

  if (currentEnd !== 0) {
    merged.push([currentStart, currentEnd])
  }

  return merged
}

function getEventInterval(event, traceWindow) {
  let start = event.ts
  let end = event.ts + event.dur

  if (traceWindow) {
    start = Math.max(start, traceWindow.startTs)
    end = Math.min(end, traceWindow.endTs)
  }

  if (end <= start) return undefined

  return [start, end]
}

function isTimelineEvent(event) {
  const categories = event.cat || ''
  return (
    categories.includes('devtools.timeline') ||
    categories.includes('v8') ||
    categories.includes('blink.user_timing')
  )
}

function isScriptingEvent(event) {
  const categories = event.cat || ''

  return (
    categories.includes('v8') ||
    event.name.startsWith('V8.') ||
    event.name.startsWith('v8.') ||
    [
      'EvaluateScript',
      'FunctionCall',
      'RunMicrotasks',
      'EventDispatch',
    ].includes(event.name)
  )
}

function isTaskEvent(event) {
  return event.name === 'RunTask'
}

function isJsParseCompileEvent(event) {
  return /compile|parse/i.test(event.name)
}

function isJsEvaluateEvent(event) {
  return (
    event.name === 'EvaluateScript' ||
    event.name === 'v8.evaluateModule' ||
    event.name === 'V8.EvaluateModule'
  )
}

function createTraceWarnings(summary, mainEvents, traceWindow) {
  const warnings = []
  const windowedMainEvents = traceWindow
    ? mainEvents.filter(event => getEventInterval(event, traceWindow))
    : mainEvents

  if (windowedMainEvents.length === 0) {
    warnings.push('no main thread events in measured window')
  }
  if (summary.scriptingMs > summary.mainThreadBusyMs) {
    warnings.push('scriptingMs exceeds mainThreadBusyMs')
  }
  if (summary.mainThreadBusyMs === 0) {
    warnings.push('mainThreadBusyMs is 0')
  }

  return warnings
}

function isRenderingEvent(event) {
  return ['UpdateLayoutTree', 'Layout', 'RecalculateStyles'].includes(
    event.name,
  )
}

function isPaintingEvent(event) {
  return ['Paint', 'PrePaint', 'CompositeLayers'].includes(event.name)
}

function round(value) {
  return Math.round(value * 100) / 100
}
