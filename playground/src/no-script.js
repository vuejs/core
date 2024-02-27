import { template } from '@vue/runtime-vapor'

const comp = () => {
  return template('<div><h1>Hello')()
}
comp.vapor = true

export default comp
