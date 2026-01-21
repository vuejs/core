<script setup lang="ts" vapor>
import { ref } from 'vue'

const disabled = ref(false)

function toggleDisabled() {
    disabled.value = !disabled.value
}

// expose for e2e test
; (window as any).getVideoTime = () => {
    const video = document.querySelector('.teleport-move-test video') as HTMLVideoElement
    return video ? video.currentTime : 0
}
    ; (window as any).isVideoPlaying = () => {
        const video = document.querySelector('.teleport-move-test video') as HTMLVideoElement
        return video ? !video.paused : false
    }
</script>

<template>
    <div class="teleport-container">
        <!-- Test: Teleport disabled toggle should preserve video state -->
        <div class="teleport-move-test">
            <div class="target"></div>
            <div class="main">
                <Teleport to=".teleport-move-test > .target" :disabled="disabled">
                    <div class="content">
                        <video src="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm"
                            width="200" autoplay muted loop></video>
                    </div>
                </Teleport>
            </div>
            <button id="toggleDisabled" @click="toggleDisabled">
                Toggle Disabled ({{ disabled }})
            </button>
        </div>
    </div>
</template>

<style>
.teleport-container>div {
    padding: 15px;
    border: 1px solid #ccc;
    margin: 10px 0;
}

.target {
    border: 2px dashed blue;
    min-height: 50px;
    padding: 10px;
}

.target::before {
    content: 'Target';
    color: blue;
    font-size: 12px;
}

.main {
    border: 2px dashed green;
    min-height: 50px;
    padding: 10px;
}

.main::before {
    content: 'Main';
    color: green;
    font-size: 12px;
}
</style>
