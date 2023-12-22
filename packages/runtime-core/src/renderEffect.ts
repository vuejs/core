import { ReactiveEffect } from '@vue/reactivity'

/**
 * Extend `ReactiveEffect` by adding `pause` and `resume` methods for controlling the execution of the `render` function.
 */
export class RenderEffect extends ReactiveEffect {
  private _isPaused = false
  private _isCalled = false
  pause() {
    this._isPaused = true
  }
  resume(runOnce = false) {
    if (this._isPaused) {
      this._isPaused = false
      if (this._isCalled && runOnce) {
        super.run()
      }
      this._isCalled = false
    }
  }
  update() {
    if (this._isPaused) {
      this._isCalled = true
    } else {
      return super.run()
    }
  }
}
