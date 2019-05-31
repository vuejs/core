import { createComponent } from '../src/component'
import { value } from '@vue/observer'
import { PropType } from '../src/componentProps'

test('createComponent type inference', () => {
  createComponent({
    props: {
      a: Number,
      // required should make property non-void
      b: {
        type: String,
        required: true
      },
      // default value should infer type and make it non-void
      bb: {
        default: 'hello'
      },
      // explicit type casting
      cc: (Array as any) as PropType<string[]>,
      // required + type casting
      dd: {
        type: (Array as any) as PropType<string[]>,
        required: true
      }
    } as const, // required to narrow for conditional check
    setup(props) {
      props.a && props.a * 2
      props.b.slice()
      props.bb.slice()
      props.cc && props.cc.push('hoo')
      props.dd.push('dd')
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
      props.a && props.a * 2
      props.b.slice()
      props.bb.slice()
      props.cc && props.cc.push('hoo')
      props.dd.push('dd')
      this.a && this.a * 2
      this.b.slice()
      this.bb.slice()
      this.c * 2
      this.d.e.slice()
      this.cc && this.cc.push('hoo')
      this.dd.push('dd')
    }
  })
  // rename this file to .tsx to test TSX props inference
  // ;(<MyComponent a={1} b="foo"/>)
})

test('type inference w/ optional props declaration', () => {
  createComponent({
    setup(props) {
      props.anything
      return {
        a: 1
      }
    },
    render({ props, state }) {
      props.foobar
      state.a * 2
      this.a * 2

      // should not make state and this indexable
      // state.foobar
      // this.foobar
    }
  })
})

// test('type inference w/ array props declaration', () => {
//   createComponent({
//     props: ['a', 'b'],
//     setup(props) {
//       props.a
//       props.b
//       return {
//         c: 1
//       }
//     },
//     render({ props, state }) {
//       props.a
//       props.b
//       state.c
//       this.a
//       this.b
//       this.c
//     }
//   })
// })
