import assert from 'node:assert/strict'
import { test } from 'node:test'
import { summarizeTrace } from '../src/bench/trace.mjs'

test('trace summary uses renderer main thread and includes v8 script work', () => {
  const traceEvents = [
    {
      ph: 'M',
      name: 'process_name',
      pid: 100,
      tid: 0,
      args: { name: 'Renderer' },
    },
    {
      ph: 'M',
      name: 'thread_name',
      pid: 100,
      tid: 11,
      args: { name: 'CrRendererMain' },
    },
    {
      ph: 'M',
      name: 'thread_name',
      pid: 100,
      tid: 12,
      args: { name: 'ThreadPoolForegroundWorker' },
    },
    {
      ph: 'X',
      pid: 100,
      tid: 12,
      ts: 0,
      dur: 1_000_000,
      cat: 'v8',
      name: 'v8.evaluateModule',
    },
    {
      ph: 'X',
      pid: 100,
      tid: 11,
      ts: 0,
      dur: 1_000,
      cat: 'devtools.timeline',
      name: 'Layout',
    },
    {
      ph: 'X',
      pid: 100,
      tid: 11,
      ts: 1_000,
      dur: 25_000,
      cat: 'v8',
      name: 'v8.evaluateModule',
    },
    {
      ph: 'X',
      pid: 100,
      tid: 11,
      ts: 26_000,
      dur: 5_000,
      cat: 'v8',
      name: 'V8.CompileCode',
    },
    {
      ph: 'X',
      pid: 100,
      tid: 11,
      ts: 31_000,
      dur: 3_000,
      cat: 'v8',
      name: 'v8.callFunction',
    },
  ]

  assert.deepEqual(summarizeTrace(traceEvents), {
    mainThread: 11,
    mainThreadBusyMs: 34,
    scriptingMs: 33,
    renderingMs: 1,
    paintingMs: 0,
    warnings: [],
  })
})

test('trace summary uses unioned scripting intervals', () => {
  const traceEvents = [
    {
      ph: 'M',
      name: 'process_name',
      pid: 100,
      tid: 0,
      args: { name: 'Renderer' },
    },
    {
      ph: 'M',
      name: 'thread_name',
      pid: 100,
      tid: 11,
      args: { name: 'CrRendererMain' },
    },
    {
      ph: 'X',
      pid: 100,
      tid: 11,
      ts: 0,
      dur: 100_000,
      cat: 'devtools.timeline',
      name: 'FunctionCall',
    },
    {
      ph: 'X',
      pid: 100,
      tid: 11,
      ts: 20_000,
      dur: 50_000,
      cat: 'v8',
      name: 'v8.callFunction',
    },
  ]

  assert.deepEqual(summarizeTrace(traceEvents), {
    mainThread: 11,
    mainThreadBusyMs: 100,
    scriptingMs: 100,
    renderingMs: 0,
    paintingMs: 0,
    warnings: [],
  })
})

test('trace summary chooses the active renderer main thread', () => {
  const traceEvents = [
    {
      ph: 'M',
      name: 'process_name',
      pid: 100,
      tid: 0,
      args: { name: 'Renderer' },
    },
    {
      ph: 'M',
      name: 'thread_name',
      pid: 100,
      tid: 11,
      args: { name: 'CrRendererMain' },
    },
    {
      ph: 'M',
      name: 'process_name',
      pid: 200,
      tid: 0,
      args: { name: 'Renderer' },
    },
    {
      ph: 'M',
      name: 'thread_name',
      pid: 200,
      tid: 21,
      args: { name: 'CrRendererMain' },
    },
    {
      ph: 'X',
      pid: 100,
      tid: 11,
      ts: 0,
      dur: 30,
      cat: 'devtools.timeline',
      name: 'FunctionCall',
    },
    {
      ph: 'X',
      pid: 200,
      tid: 21,
      ts: 0,
      dur: 120_000,
      cat: 'devtools.timeline',
      name: 'FunctionCall',
    },
  ]

  assert.equal(summarizeTrace(traceEvents).mainThread, 21)
})

test('trace summary can be scoped to user timing marks', () => {
  const traceEvents = [
    {
      ph: 'M',
      name: 'process_name',
      pid: 100,
      tid: 0,
      args: { name: 'Renderer' },
    },
    {
      ph: 'M',
      name: 'thread_name',
      pid: 100,
      tid: 11,
      args: { name: 'CrRendererMain' },
    },
    {
      ph: 'I',
      name: 'bench:start',
      pid: 100,
      tid: 11,
      ts: 10_000,
      cat: 'blink.user_timing',
    },
    {
      ph: 'X',
      pid: 100,
      tid: 11,
      ts: 0,
      dur: 50_000,
      cat: 'devtools.timeline',
      name: 'FunctionCall',
    },
    {
      ph: 'I',
      name: 'bench:end',
      pid: 100,
      tid: 11,
      ts: 40_000,
      cat: 'blink.user_timing',
    },
  ]

  assert.deepEqual(
    summarizeTrace(traceEvents, {
      window: {
        startMark: 'bench:start',
        endMark: 'bench:end',
      },
    }),
    {
      mainThread: 11,
      mainThreadBusyMs: 30,
      scriptingMs: 30,
      renderingMs: 0,
      paintingMs: 0,
      traceWindowMs: 30,
      warnings: [],
    },
  )
})
