import {
  type BenchFn,
  type BenchOptions,
  type BenchRunOptions,
  type TestAPI,
  test as baseTest,
} from 'vite-plus/test'

type Benchmark = (
  fn: BenchFn,
  options?: BenchRunOptions,
  taskOptions?: BenchOptions,
) => Promise<void>

export const test: TestAPI<{ benchmark: Benchmark }> = baseTest.extend<{
  benchmark: Benchmark
}>({
  benchmark: async ({ bench, task }, use) => {
    const baseline = `temp/bench/${task.file.name}/${encodeURIComponent(task.fullTestName)}.json`
    const compare = process.env.BENCH_COMPARE === '1'

    await use(async (fn, options = {}, taskOptions = {}) => {
      const current = bench(
        task.name,
        { ...taskOptions, writeResult: compare ? undefined : baseline },
        fn,
      )
      if (compare) {
        await bench.compare(bench.from('baseline', baseline), current, options)
      } else {
        await current.run(options)
      }
    })
  },
})
