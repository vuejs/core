import {
  createComponentSimple,
  // createFor,
  createVaporApp,
  delegate,
  delegateEvents,
  ref,
  renderEffectSimple,
  template,
} from 'vue/vapor'

function createForSimple(val: () => any, render: (i: number) => any) {
  const l = val(),
    arr = new Array(l)
  for (let i = 0; i < l; i++) {
    arr[i] = render(i)
  }
  return arr
}

const t0 = template('<h1>Vapor</h1>')
const App = {
  vapor: true,
  __name: 'App',
  setup() {
    return (_ctx => {
      const n0 = t0()
      const n1 = createForSimple(
        () => 10000,
        (i: number) => createComponentSimple(Comp, { count: i }),
      )
      return [n0, createComponentSimple(Counter), n1]
    })()
  },
}

const Counter = {
  vapor: true,
  __name: 'Counter',
  setup() {
    delegateEvents('click')
    const count = ref(0)
    const button = document.createElement('button')
    button.textContent = '++'
    delegate(button, 'click', () => () => count.value++)
    return [
      button,
      createComponentSimple(Comp, {
        // if ref
        count,
        // if exp
        get plusOne() {
          return count.value + 1
        },
      }),
      // TODO dynamic props: merge with Proxy that iterates sources on access
    ]
  },
}

const t0$1 = template('<div></div>')
const Comp = {
  vapor: true,
  __name: 'Comp',
  setup(props: any) {
    return (_ctx => {
      const n = t0$1()
      renderEffectSimple(() => {
        n.textContent = props.count + ' / ' + props.plusOne
      })
      return n
    })()
  },
}

const s = performance.now()
const app = createVaporApp(App)
app.mount('#app')
console.log((performance.now() - s).toFixed(2))
