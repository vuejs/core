# 1. index和runtime的入口，compile 函数不能用于vapor

compile 函数在vapor模式下不能使用，因为vapor模式下没有编译模板的功能。
compile是从@vue/compiler-dom包导出的，而vapor模式下只支持使用render函数。

 将compile函数从index和runtime的入口移除， index 和 runtime 的代码就一致了

 # 2. vapor模式的限制, 这些都是要移除的功能-------------- 见者可杀
 Vue Vapor（3.6+ 实验性）核心限制如下（截至 2026-03-06）：
一、API 与语法不支持
❌ Options API 完全不支持，仅支持 <script setup> + Composition API
❌ app.config.globalProperties 不可用
❌ getCurrentInstance() 返回 null
❌ 模板中 $slots / $props / $attrs 等实例属性不可用
❌ @vue:mounted 等元素级生命周期事件不支持
❌ v-once / v-html 暂不支持
❌ Class Components 不支持
❌ Mixin 不支持
二、组件与渲染限制
❌ SSR / 服务端渲染 不支持
❌ <KeepAlive> 暂不支持（开发中）
❌ 递归组件、复杂嵌套插槽 兼容性差
❌ Vapor 插槽在 VDOM 组件内不能用 slots.default()，必须用 renderSlot
❌ 与基于 VDOM 的第三方组件库混用存在兼容性问题
三、自定义指令
指令接口完全不同，不兼容现有自定义指令
新类型：VaporDirective = (node, value?, arg?, modifiers?) => (() => void) | void
四、开发与工具链
⚠️ 调试工具不完善，DevTools 支持有限
⚠️ 类型推导、模板分析 仍在完善
⚠️ 编译输出更复杂，调试难度更高
⚠️ 仅支持 Chrome 79+ 等现代浏览器，不兼容 IE11
五、其他限制
实验阶段，不建议生产环境使用
不支持 自定义渲染器（仅浏览器 DOM）
运行时不支持复杂 CSS 选择器，仅简单 class / 分组选择器
