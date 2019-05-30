import { createComponent } from '../src/component'
import { value } from '@vue/observer'

test('createComponent type inference', () => {
  const MyComponent = createComponent({
    props: {
      a: Number,
      b: {
        type: String
      }
    },
    setup(props) {
      props.a * 2
      props.b.slice()
      return {
        c: value(1),
        d: {
          e: value('hi')
        }
      }
    },
    render({ state, props }) {
      state.c * 2
      state.d.e.slice()
      props.a * 2
      props.b.slice()
      this.a * 2
      this.b.slice()
      this.c * 2
      this.d.e.slice()
    }
  })
  MyComponent // avoid unused
  // rename this file to .tsx to test TSX props inference
  // ;(<MyComponent a={1} b="foo"/>)
})
