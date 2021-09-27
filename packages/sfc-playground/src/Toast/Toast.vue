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
    left: 50%;
    top: 40%;
    transform: translate(-200px);
    background-color: #42d392;
    text-align: center;
    line-height: 80px;
    font-size: 2rem;
}
</style>