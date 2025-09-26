import { userEvent } from '@vitest/browser/context'
import { createVaporApp } from 'vue'
import App from '../todomvc/App.vue'
import 'todomvc-app-css/index.css'
import { E2E_TIMEOUT, css, enterValue } from './e2eUtils'

beforeAll(() => {
  // MVC relies on local storage, but it persists between reruns in watch mode
  localStorage.clear()
})

describe('e2e: todomvc', () => {
  test('vapor', { timeout: E2E_TIMEOUT }, async () => {
    createVaporApp(App).mount('#app')

    expect(css('.main')).not.toBeVisible()
    expect(css('.footer')).not.toBeVisible()
    expect(css('.filters .selected')).toHaveLength(1)
    expect(css('.filters .selected')).toHaveTextContent('All')
    expect(css('.todo')).toHaveLength(0)

    await enterValue(css('.new-todo'), 'test')
    expect(css('.todo')).toHaveLength(1)
    expect(css('.todo .edit')).not.toBeVisible()
    expect(css('.todo label')).toHaveTextContent('test')
    expect(css('.todo-count strong')).toHaveTextContent('1')
    expect(css('.todo .toggle')).not.toBeChecked()
    expect(css('.main')).toBeVisible()
    expect(css('.footer')).toBeVisible()
    expect(css('.clear-completed')).not.toBeVisible()
    expect(css('.new-todo')).toHaveValue('')

    await enterValue(css('.new-todo'), 'test2')
    expect(css('.todo')).toHaveLength(2)
    expect(css('.todo:nth-child(2) label')).toHaveTextContent('test2')
    expect(css('.todo-count strong')).toHaveTextContent('2')

    // toggle
    await css('.todo .toggle').first().click()
    expect(css('.todo.completed')).toHaveLength(1)
    expect(css('.todo:nth-child(1)')).toHaveClass('completed')
    expect(css('.todo-count strong')).toHaveTextContent('1')
    expect(css('.clear-completed')).toBeVisible()

    await enterValue(css('.new-todo'), 'test3')
    expect(css('.todo')).toHaveLength(3)
    expect(css('.todo:nth-child(3) label')).toHaveTextContent('test3')
    expect(css('.todo-count strong')).toHaveTextContent('2')

    await enterValue(css('.new-todo'), 'test4')
    await enterValue(css('.new-todo'), 'test5')
    expect(css('.todo')).toHaveLength(5)
    expect(css('.todo-count strong')).toHaveTextContent('4')

    // toggle more
    await css('.todo:nth-child(4) .toggle').click()
    await css('.todo:nth-child(5) .toggle').click()
    expect(css('.todo.completed')).toHaveLength(3)
    expect(css('.todo-count strong')).toHaveTextContent('2')

    // remove
    await removeItemAt(1)
    expect(css('.todo')).toHaveLength(4)
    expect(css('.todo.completed')).toHaveLength(2)
    expect(css('.todo-count strong')).toHaveTextContent('2')
    await removeItemAt(2)
    expect(css('.todo')).toHaveLength(3)
    expect(css('.todo.completed')).toHaveLength(2)
    expect(css('.todo-count strong')).toHaveTextContent('1')

    // remove all
    await css('.clear-completed').click()
    expect(css('.todo')).toHaveLength(1)
    expect(css('.todo label')).toHaveTextContent('test2')
    expect(css('.todo.completed')).toHaveLength(0)
    expect(css('.todo-count strong')).toHaveTextContent('1')
    expect(css('.clear-completed')).not.toBeVisible()

    // prepare to test filters
    await enterValue(css('.new-todo'), 'test')
    await enterValue(css('.new-todo'), 'test')
    await css('.todo:nth-child(2) .toggle').click()
    await css('.todo:nth-child(3) .toggle').click()

    // active filter
    await css('.filters li:nth-child(2) a').click()

    await expect.element(css('.todo')).toHaveLength(1)
    expect(css('.todo.completed')).toHaveLength(0)
    // add item with filter active
    await enterValue(css('.new-todo'), 'test')
    expect(css('.todo')).toHaveLength(2)

    // completed filter
    await css('.filters li:nth-child(3) a').click()

    await expect.element(css('.todo')).toHaveLength(2)
    expect(css('.todo.completed')).toHaveLength(2)

    // filter on page load
    location.hash = '#active'

    await expect.element(css('.todo.completed')).toHaveLength(0)
    await expect.element(css('.todo')).toHaveLength(2)
    expect(css('.todo-count strong')).toHaveTextContent('2')

    // completed on page load
    location.hash = '#completed'

    // expect.element().toHaveLength(0) will also pass here
    // because it's 0 at the start! make sure we wait the hash change
    await expect.element(css('.todo.completed')).not.toHaveLength(0)
    await expect.element(css('.todo')).toHaveLength(2)

    expect(css('.todo.completed')).toHaveLength(2)
    expect(css('.todo-count strong')).toHaveTextContent('2')

    // toggling with filter active
    await css('.todo .toggle').first().click()
    await expect.element(css('.todo')).toHaveLength(1)

    await css('.filters li:nth-child(2) a').click()
    await expect.element(css('.todo')).toHaveLength(3)

    await css('.todo .toggle').first().click()
    await expect.element(css('.todo')).toHaveLength(2)

    // editing triggered by blur
    await css('.filters li:nth-child(1) a').click()
    await css('.todo:nth-child(1) label').dblClick()

    await expect.element(css('.todo.editing')).toHaveLength(1)
    await expect.element(css('.todo:nth-child(1) .edit')).toHaveFocus()

    await css('.todo:nth-child(1) .edit').clear()
    await userEvent.type(css('.todo:nth-child(1) .edit'), 'edited!')
    await css('.new-todo').click() // blur

    expect(css('.todo.editing')).toHaveLength(0)
    expect(css('.todo:nth-child(1) label')).toHaveTextContent('edited!')

    // editing triggered by enter
    await css('.todo label').first().dblClick()
    await enterValue(css('.todo:nth-child(1) .edit'), 'edited again!')
    await expect.element(css('.todo.editing')).toHaveLength(0)
    await expect
      .element(css('.todo:nth-child(1) label'))
      .toHaveTextContent('edited again!')

    // cancel
    await css('.todo label').first().dblClick()
    await css('.todo:nth-child(1) .edit').clear()
    await userEvent.type(css('.todo:nth-child(1) .edit'), 'edited!{escape}')

    await expect.element(css('.todo.editing')).toHaveLength(0)
    await expect
      .element(css('.todo:nth-child(1) label'))
      .toHaveTextContent('edited again!')

    // empty value should remove
    await css('.todo label').first().dblClick()
    await enterValue(css('.todo:nth-child(1) .edit'), ' ')
    await expect.element(css('.todo')).toHaveLength(3)

    // toggle all
    await css('.toggle-all+label').click()
    expect(css('.todo.completed')).toHaveLength(3)
    await css('.toggle-all+label').click()
    expect(css('.todo:not(.completed)')).toHaveLength(3)
  })
})

// no timeout is needed because expect.element awaits
// const timeout = async (ms: number) => {
//   await new Promise(resolve => setTimeout(resolve, ms))
// }

async function removeItemAt(n: number) {
  const item = css(`.todo:nth-child(${n})`)
  await item.hover()
  await css(`.todo:nth-child(${n}) .destroy`).click()
}
