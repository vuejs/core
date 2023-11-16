import { render } from 'vue/vapor'
// @ts-expect-error
import App from './App.vue'

render(App.render, '#app')
