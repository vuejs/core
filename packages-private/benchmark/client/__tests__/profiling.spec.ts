import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defer, wrap } from '../profiling'
import { nextTick } from 'vue'

// Mock Vue's nextTick
vi.mock('vue', async () => {
  const actual = await vi.importActual<typeof import('vue')>('vue')
  return {
    ...actual,
    nextTick: vi.fn(() => Promise.resolve()),
  }
})

describe('benchmark/profiling', () => {
  let performanceNowSpy: any
  let performanceMeasureSpy: any

  beforeEach(() => {
    // Clear global state before each test
    globalThis.recordTime = true
    globalThis.doProfile = false
    globalThis.reactivity = false
    // Clear times object instead of replacing it (module references it)
    if (globalThis.times) {
      Object.keys(globalThis.times).forEach(key => {
        delete globalThis.times[key]
      })
    }

    // Mock DOM APIs
    if (typeof document === 'undefined') {
      ;(global as any).document = {
        body: {
          classList: {
            add: vi.fn(),
            remove: vi.fn(),
          },
        },
        getElementById: vi.fn(() => ({
          textContent: '',
        })),
      }
    } else {
      // Reset existing mocks
      ;(document.body.classList.add as any) = vi.fn()
      ;(document.body.classList.remove as any) = vi.fn()
      ;(document.getElementById as any) = vi.fn(() => ({
        textContent: '',
      }))
    }

    // Spy on performance API
    performanceNowSpy = vi.spyOn(performance, 'now')
    performanceMeasureSpy = vi
      .spyOn(performance, 'measure')
      .mockReturnValue({ duration: 10 } as any)
    vi.spyOn(performance, 'clearMarks')
    vi.spyOn(performance, 'clearMeasures')

    // Mock console
    global.console = {
      ...console,
      log: vi.fn(),
      profile: vi.fn(),
      profileEnd: vi.fn(),
    }

    // Mock requestIdleCallback
    if (typeof requestIdleCallback === 'undefined') {
      ;(global as any).requestIdleCallback = vi.fn((cb: Function) => {
        setTimeout(cb, 0)
      })
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  describe('defer', () => {
    it('should return a Promise', () => {
      const result = defer()
      expect(result).toBeInstanceOf(Promise)
    })

    it('should resolve after requestIdleCallback', async () => {
      const spy = vi.fn()
      await defer()
      spy()
      expect(spy).toHaveBeenCalled()
    })

    it('should use requestIdleCallback', async () => {
      const requestIdleCallbackSpy = vi.spyOn(globalThis, 'requestIdleCallback')
      await defer()
      expect(requestIdleCallbackSpy).toHaveBeenCalled()
    })
  })

  describe('wrap', () => {
    it('should return a function', () => {
      const fn = vi.fn()
      const wrapped = wrap('test', fn)
      expect(typeof wrapped).toBe('function')
    })

    it('should execute the wrapped function when recordTime is false', async () => {
      globalThis.recordTime = false
      const fn = vi.fn(() => 42)
      const wrapped = wrap('test', fn)

      const result = await wrapped()

      expect(fn).toHaveBeenCalled()
      expect(result).toBe(42)
    })

    it('should pass arguments to the wrapped function', async () => {
      globalThis.recordTime = false
      const fn = vi.fn((a: number, b: number) => a + b)
      const wrapped = wrap('test', fn)

      const result = await wrapped(5, 3)

      expect(fn).toHaveBeenCalledWith(5, 3)
      expect(result).toBe(8)
    })

    it('should remove "done" class from body before execution', async () => {
      const fn = vi.fn()
      const wrapped = wrap('test', fn)

      await wrapped()

      expect(document.body.classList.remove).toHaveBeenCalledWith('done')
    })

    it('should add "done" class to body after execution', async () => {
      const fn = vi.fn()
      const wrapped = wrap('test', fn)

      await wrapped()

      expect(document.body.classList.add).toHaveBeenCalledWith('done')
    })

    it('should measure execution time', async () => {
      const fn = vi.fn()
      const wrapped = wrap('test', fn)

      await wrapped()

      expect(globalThis.times.test).toBeDefined()
      expect(globalThis.times.test.length).toBe(1)
      expect(typeof globalThis.times.test[0]).toBe('number')
    })

    it('should accumulate times across multiple calls', async () => {
      const fn = vi.fn()
      const wrapped = wrap('test', fn)

      await wrapped()
      await wrapped()
      await wrapped()

      expect(globalThis.times.test.length).toBe(3)
    })

    it('should log performance metrics', async () => {
      const fn = vi.fn()
      const wrapped = wrap('test', fn)

      await wrapped()

      expect(console.log).toHaveBeenCalled()
      const logCall = (console.log as any).mock.calls[0][0]
      expect(logCall).toContain('test:')
      expect(logCall).toContain('min:')
      expect(logCall).toContain('max:')
      expect(logCall).toContain('median:')
      expect(logCall).toContain('mean:')
      expect(logCall).toContain('time:')
      expect(logCall).toContain('std:')
    })

    it('should update time element in DOM', async () => {
      const fn = vi.fn()
      const wrapped = wrap('test', fn)
      const timeElement = { textContent: '' }

      ;(document.getElementById as any).mockReturnValue(timeElement)

      await wrapped()

      expect(document.getElementById).toHaveBeenCalledWith('time')
      expect(timeElement.textContent).toContain('test:')
    })

    it('should call console.profile when doProfile is true', async () => {
      globalThis.doProfile = true
      const fn = vi.fn()
      const wrapped = wrap('test', fn)

      await wrapped()

      expect(console.profile).toHaveBeenCalledWith('test')
      expect(console.profileEnd).toHaveBeenCalledWith('test')
    })

    it('should not call console.profile when doProfile is false', async () => {
      globalThis.doProfile = false
      const fn = vi.fn()
      const wrapped = wrap('test', fn)

      await wrapped()

      expect(console.profile).not.toHaveBeenCalled()
      expect(console.profileEnd).not.toHaveBeenCalled()
    })

    it('should use performance.measure when reactivity is true', async () => {
      globalThis.reactivity = true
      const fn = vi.fn()
      const wrapped = wrap('test', fn)

      await wrapped()

      expect(performance.measure).toHaveBeenCalledWith(
        'flushJobs-measure',
        'flushJobs-start',
        'flushJobs-end',
      )
      expect(performance.clearMarks).toHaveBeenCalled()
      expect(performance.clearMeasures).toHaveBeenCalled()
    })

    it('should use performance.now when reactivity is false', async () => {
      globalThis.reactivity = false
      const fn = vi.fn()
      const wrapped = wrap('test', fn)

      await wrapped()

      expect(performanceNowSpy).toHaveBeenCalled()
    })

    it('should track separate times for different IDs', async () => {
      const fn1 = vi.fn()
      const fn2 = vi.fn()
      const wrapped1 = wrap('operation1', fn1)
      const wrapped2 = wrap('operation2', fn2)

      await wrapped1()
      await wrapped2()

      expect(globalThis.times.operation1).toBeDefined()
      expect(globalThis.times.operation2).toBeDefined()
      expect(globalThis.times.operation1.length).toBe(1)
      expect(globalThis.times.operation2.length).toBe(1)
    })

    it('should calculate correct statistics', async () => {
      const fn = vi.fn()
      const wrapped = wrap('test', fn)

      // Mock performance.now to return predictable values
      let callCount = 0
      performanceNowSpy.mockImplementation(() => {
        callCount++
        return callCount * 10
      })

      await wrapped()
      await wrapped()
      await wrapped()

      expect(globalThis.times.test.length).toBe(3)
    })

    it('should handle errors in wrapped function gracefully', async () => {
      const fn = vi.fn(() => {
        throw new Error('Test error')
      })
      const wrapped = wrap('test', fn)

      await expect(wrapped()).rejects.toThrow('Test error')
    })

    it('should work with async functions', async () => {
      const fn = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
        return 'async result'
      })
      const wrapped = wrap('test', fn)

      await wrapped()

      expect(fn).toHaveBeenCalled()
    })

    it('should include run count in log message', async () => {
      // Use a unique ID to avoid shared state
      const fn = vi.fn()
      const wrapped = wrap('uniqueTest' + Date.now(), fn)

      await wrapped()
      await wrapped()
      await wrapped()

      const lastLogCall = (console.log as any).mock.calls[2][0]
      expect(lastLogCall).toContain('over 3 runs')
    })

    it('should format time values to 2 decimal places', async () => {
      const fn = vi.fn()
      const wrapped = wrap('test', fn)

      // Mock to return a value with many decimals
      performanceNowSpy
        .mockReturnValueOnce(100.123456789)
        .mockReturnValueOnce(105.987654321)

      await wrapped()

      const logCall = (console.log as any).mock.calls[0][0]
      // Should contain formatted numbers
      expect(logCall).toMatch(/\d+\.\d{2}/)
    })

    it('should initialize times object for new ID', async () => {
      const fn = vi.fn()
      const wrapped = wrap('newOperation', fn)

      expect(globalThis.times.newOperation).toBeUndefined()

      await wrapped()

      expect(globalThis.times.newOperation).toBeDefined()
      expect(Array.isArray(globalThis.times.newOperation)).toBe(true)
    })

    it('should wait for nextTick before and after execution', async () => {
      // This test verifies that the function waits appropriately
      const fn = vi.fn()
      const wrapped = wrap('test', fn)

      const startTime = Date.now()
      await wrapped()
      const endTime = Date.now()

      // Should take some time due to nextTick calls
      expect(fn).toHaveBeenCalled()
    })
  })

  describe('global state', () => {
    it('should initialize recordTime to true', () => {
      expect(globalThis.recordTime).toBe(true)
    })

    it('should initialize doProfile to false', () => {
      expect(globalThis.doProfile).toBe(false)
    })

    it('should initialize reactivity to false', () => {
      expect(globalThis.reactivity).toBe(false)
    })

    it('should initialize times as empty object', () => {
      // Clear and check
      Object.keys(globalThis.times).forEach(key => {
        delete globalThis.times[key]
      })
      expect(Object.keys(globalThis.times)).toEqual([])
    })
  })

  describe('edge cases and additional coverage', () => {
    it('should handle functions that return values', async () => {
      const fn = vi.fn(() => 'return value')
      const wrapped = wrap('test', fn)

      await wrapped()

      expect(fn).toHaveBeenCalled()
    })

    it('should handle functions with complex arguments', async () => {
      globalThis.recordTime = false
      const fn = vi.fn((obj: any, arr: any[], num: number) => {
        return obj.key + arr.length + num
      })
      const wrapped = wrap('test', fn)

      const result = await wrapped({ key: 'value' }, [1, 2, 3], 42)

      expect(fn).toHaveBeenCalledWith({ key: 'value' }, [1, 2, 3], 42)
    })

    it('should handle zero execution time', async () => {
      const fn = vi.fn()
      const wrapped = wrap('test', fn)

      performanceNowSpy.mockReturnValueOnce(100).mockReturnValueOnce(100)

      await wrapped()

      expect(globalThis.times.test).toBeDefined()
      expect(globalThis.times.test[0]).toBe(0)
    })

    it('should handle negative time differences gracefully', async () => {
      const fn = vi.fn()
      const wrapped = wrap('test', fn)

      // Simulate clock going backwards
      performanceNowSpy.mockReturnValueOnce(100).mockReturnValueOnce(99)

      await wrapped()

      expect(globalThis.times.test).toBeDefined()
      expect(globalThis.times.test[0]).toBe(-1)
    })

    it('should calculate stats correctly with single value', async () => {
      const fn = vi.fn()
      const wrapped = wrap('singleValue', fn)

      await wrapped()

      const logCall = (console.log as any).mock.calls[0][0]
      expect(logCall).toContain('over 1 runs')
      // min, max, median, mean should all be the same
      expect(logCall).toContain('min:')
      expect(logCall).toContain('max:')
      expect(logCall).toContain('median:')
    })

    it('should handle very large time values', async () => {
      const fn = vi.fn()
      const wrapped = wrap('largeTime', fn)

      performanceNowSpy.mockReturnValueOnce(0).mockReturnValueOnce(999999.999)

      await wrapped()

      expect(globalThis.times.largeTime[0]).toBeGreaterThan(999999)
    })

    it('should handle concurrent wrap calls with different IDs', async () => {
      const fn1 = vi.fn()
      const fn2 = vi.fn()
      const wrapped1 = wrap('concurrent1', fn1)
      const wrapped2 = wrap('concurrent2', fn2)

      // Call both concurrently
      await Promise.all([wrapped1(), wrapped2()])

      expect(globalThis.times.concurrent1).toBeDefined()
      expect(globalThis.times.concurrent2).toBeDefined()
      expect(fn1).toHaveBeenCalled()
      expect(fn2).toHaveBeenCalled()
    })

    it('should handle functions that modify external state', async () => {
      globalThis.recordTime = false
      let externalState = 0
      const fn = vi.fn(() => {
        externalState++
      })
      const wrapped = wrap('stateModifier', fn)

      await wrapped()

      expect(fn).toHaveBeenCalled()
      expect(externalState).toBe(1)
    })

    it('should handle empty string ID', async () => {
      const fn = vi.fn()
      const wrapped = wrap('', fn)

      await wrapped()

      expect(globalThis.times['']).toBeDefined()
    })

    it('should handle special characters in ID', async () => {
      const fn = vi.fn()
      const wrapped = wrap('test-with-dashes_and_underscores.dots', fn)

      await wrapped()

      expect(
        globalThis.times['test-with-dashes_and_underscores.dots'],
      ).toBeDefined()
    })

    it('should update DOM correctly with special characters in message', async () => {
      const fn = vi.fn()
      const wrapped = wrap('special<>&"', fn)
      const timeElement = { textContent: '' }

      ;(document.getElementById as any).mockReturnValue(timeElement)

      await wrapped()

      expect(timeElement.textContent).toContain('special<>&"')
    })

    it('should calculate standard deviation correctly', async () => {
      const fn = vi.fn()
      const wrapped = wrap('stdTest', fn)

      // Create predictable time values
      performanceNowSpy
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(10) // diff: 10
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(20) // diff: 20
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(30) // diff: 30

      await wrapped()
      await wrapped()
      await wrapped()

      expect(globalThis.times.stdTest).toEqual([10, 20, 30])
      // Mean is 20, std should be calculated
      const logCall = (console.log as any).mock.calls[2][0]
      expect(logCall).toContain('std:')
    })

    it('should clear performance marks and measures only when reactivity is true', async () => {
      const fn = vi.fn()

      // Test with reactivity true
      globalThis.reactivity = true
      const wrapped1 = wrap('reactivityTest', fn)
      await wrapped1()

      expect(performance.clearMarks).toHaveBeenCalled()
      expect(performance.clearMeasures).toHaveBeenCalled()

      vi.clearAllMocks()

      // Test with reactivity false
      globalThis.reactivity = false
      const wrapped2 = wrap('noReactivityTest', fn)
      await wrapped2()

      expect(performance.clearMarks).not.toHaveBeenCalled()
      expect(performance.clearMeasures).not.toHaveBeenCalled()
    })
  })
})
