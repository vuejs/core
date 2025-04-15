<script setup>
import { onActivated, onDeactivated, onMounted, onUnmounted, ref } from 'vue'
const msg = ref('vdom')

onMounted(() => {
    window.calls.push('mounted')
})
onActivated(() => {
    window.calls.push('activated')
})
onDeactivated(() => {
    window.calls.push('deactivated')
})
onUnmounted(() => {
    window.calls.push('unmounted')
})
</script>
<template>
    <input type="text" v-model="msg" />
</template>