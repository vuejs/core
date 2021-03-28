<template>
  <iframe
    id="preview"
    ref="iframe"
    sandbox="allow-forms allow-modals allow-pointer-lock allow-popups allow-same-origin allow-scripts allow-top-navigation-by-user-activation"
    :srcdoc="srcdoc"
  ></iframe>
  <Message :err="runtimeError" />
  <Message v-if="!runtimeError" :warn="runtimeWarning" />
</template>

<script setup lang="ts">
import Message from '../Message.vue'
import { ref, onMounted, onUnmounted, watchEffect, defineProps } from 'vue'
import srcdoc from './srcdoc.html?raw'
import { PreviewProxy } from './PreviewProxy'
import { sandboxVueURL } from '../store'

const props = defineProps<{ code: string }>()

const iframe = ref()
const runtimeError = ref()
const runtimeWarning = ref()

let proxy: PreviewProxy

async function updatePreview() {
  if (!props.code?.trim()) {
    return
  }
  try {
  proxy.eval(`
  ${props.code}

  if (window.vueApp) {
    window.vueApp.unmount()
  }
  const container = document.getElementById('app')
  container.innerHTML = ''

  import { createApp as _createApp } from "${sandboxVueURL}"
  const app = window.vueApp = _createApp(__comp)

  app.config.errorHandler = e => console.error(e)

  app.mount(container)
  `)
  } catch (e) {
    runtimeError.value = e.message
    return
  }
  runtimeError.value = null
  runtimeWarning.value = null
}

onMounted(() => {
  proxy = new PreviewProxy(iframe.value, {
    on_fetch_progress: (progress: any) => {
      // pending_imports = progress;
    },
    on_error: (event: any) => {
      // push_logs({ level: 'error', args: [event.value] });
      runtimeError.value = event.value
    },
    on_unhandled_rejection: (event: any) => {
      let error = event.value
      if (typeof error === 'string') error = { message: error }
      runtimeError.value = 'Uncaught (in promise): ' + error.message
    },
    on_console: (log: any) => {
      if (log.level === 'error') {
        runtimeError.value = log.args.join('')
      } else if (log.level === 'warn') {
        if (log.args[0].toString().includes('[Vue warn]')) {
          runtimeWarning.value = log.args.join('').replace(/\[Vue warn\]:/, '').trim()
        }
      }
    },
    on_console_group: (action: any) => {
      // group_logs(action.label, false);
    },
    on_console_group_end: () => {
      // ungroup_logs();
    },
    on_console_group_collapsed: (action: any) => {
      // group_logs(action.label, true);
    }
  })

  iframe.value.addEventListener('load', () => {
    proxy.handle_links();
    watchEffect(updatePreview)
  });
})

onUnmounted(() => {
  proxy.destroy()
})
</script>

<style>
iframe {
  width: 100%;
  height: 100%;
  border: none;
  background-color: #fff;
}
</style>
