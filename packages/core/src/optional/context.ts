import { observable } from '@vue/observer'
import { Component } from '../component'
import { Slots } from '../vdom'

const contextStore = observable() as Record<string | symbol, any>

export class Provide extends Component {
  updateValue() {
    contextStore[this.$props.id] = this.$props.value
  }
  created() {
    if (__DEV__) {
      if (contextStore.hasOwnProperty(this.$props.id)) {
        console.warn(
          `A context provider with id ${this.$props.id} already exists.`
        )
      }
      this.$watch(
        () => this.$props.id,
        (id: string, oldId: string) => {
          console.warn(
            `Context provider id change detected (from "${oldId}" to "${id}"). ` +
              `This is not supported and should be avoided.`
          )
        },
        { sync: true }
      )
    }
    this.updateValue()
  }
  beforeUpdate() {
    this.updateValue()
  }
  render(_: any, slots: Slots) {
    return slots.default && slots.default()
  }
}

if (__DEV__) {
  Provide.options = {
    props: {
      id: {
        type: [String, Symbol],
        required: true
      },
      value: {
        required: true
      }
    }
  }
}

export class Inject extends Component {
  render(props: any, slots: Slots) {
    return slots.default && slots.default(contextStore[props.id])
  }
}
