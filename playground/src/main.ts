import { render } from 'vue/vapor'
import App from './App.vue'

// @ts-expect-error
render(App.render, '#app')
