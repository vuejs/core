import { createComponent } from '../src/component'
import { value } from '@vue/reactivity'
import { PropType } from '../src/componentProps'

// mock React just for TSX testing purposes
const React = {
  createElement: () => {}
}

test('createComponent type inference', () => {
  const MyComponent = createComponent({
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
    render(props) {
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
  // test TSX props inference
  ;(<MyComponent a={1} b="foo" dd={['foo']}/>)
})

test('type inference w/ optional props declaration', () => {
  const Comp = createComponent({
    setup(props: { msg: string }) {
      props.msg
      return {
        a: 1
      }
    },
    render(props) {
      props.msg
      this.a * 2
      // should not make state and this indexable
      // state.foobar
      // this.foobar
    }
  })
  ;(<Comp msg="hello"/>)
})

test('type inference w/ direct setup function', () => {
  const Comp = createComponent((props: { msg: string }) => {
    return () => <div>{props.msg}</div>
  })
  ;(<Comp msg="hello"/>)
})

test('type inference w/ array props declaration', () => {
  const Comp = createComponent({
    props: ['a', 'b'],
    setup(props) {
      props.a
      props.b
      return {
        c: 1
      }
    },
    render(props) {
      props.a
      props.b
      this.a
      this.b
      this.c
    }
  })
  ;(<Comp a={1} b={2}/>)
})
