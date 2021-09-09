<script lang='ts' setup>
defineProps(['msg'])
</script>

<template>
    <div class="toast">{{ msg }}</div>
</template>

<style scoped>
.toast {
    position: absolute;
    width: 400px;
    height: 80px;
    border: 1px solid var(--color-branding);
    left: 50%;
    top: 40%;
    transform: translate(-200px);
    background-color: #fff;
    text-align: center;
    line-height: 80px;
    font-size: 2rem;
}
</style>