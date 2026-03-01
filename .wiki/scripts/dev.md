# 1. 这个是vue框架的开发时的脚本，解释一下它的主要逻辑，它启动的示例代码存放在哪里，我应该如何一边修改示例一边调试

## dev.js 脚本主要逻辑解析

### 1. 核心功能

这个脚本主要用于 **开发时实时编译和监听 Vue 源码变更**，它会：

- 使用 `rolldown` 构建工具监听源码变化
- 实时重新打包指定的包（如 vue、runtime-vapor 等）
- 生成开发版本的构建文件供示例使用

### 2. 主要参数说明

```bash
# 基本用法
node scripts/dev.js [targets] [-f format] [-p] [-i]

# 参数：
# targets: 要构建的包名（默认为 'vue'）
# -f format: 输出格式（global/esm-browser/esm-bundler/cjs 等）
# -p: 生产模式（prod）
# -i: 内联依赖
```

### 3. 构建流程

1. **解析命令行参数** - 获取目标包、输出格式等
2. **确定包路径** - 在 `packages/` 或 `packages-private/` 中查找
3. **设置入口文件** - 根据包类型和格式选择不同的入口
4. **配置外部依赖** - 决定哪些依赖需要外部化
5. **应用插件** - 如 node polyfills 等
6. **启动监听** - 使用 rolldown.watch 监听文件变化

## 示例代码位置

根据项目结构，主要有以下几个地方存放示例代码：

### 1. 本地游乐场（推荐用于调试）

```
packages-private/local-playground/
├── src/
│   ├── App.vue          # 主应用组件
│   ├── main.ts          # 入口文件
│   └── style.css        # 样式文件
├── index.html           # HTML 模板
└── vite.config.ts       # Vite 配置
```

### 2. SFC 游乐场

```
packages-private/sfc-playground/
├── src/
│   ├── App.vue          # SFC 编辑器界面
│   └── main.ts
└── index.html
```

### 3. 经典示例

```
packages/vue/examples/
├── classic/             # 传统选项式 API 示例
│   ├── tree.html        # 树形组件示例
│   ├── grid.html        # 表格示例
│   └── ...
├── composition/         # 组合式 API 示例
└── transition/          # 过渡动画示例
```

### 4. 模板浏览器

```
packages-private/template-explorer/
├── src/
│   └── index.ts         # 模板编译器探索工具
├── index.html
└── local.html
```

## 调试方式

### 方法一：使用本地游乐场（最推荐）

1. **启动开发环境**： 【失败 **vite_ssr_exportName** is not defined】

```bash
# 同时启动 Vue 源码监听和本地游乐场
pnpm run dev-vapor
```

2. **或者分步启动**：

```bash
# 1. 在一个终端中监听源码变化
node scripts/dev.js runtime-vapor -f esm-bundler

# 2. 在另一个终端启动游乐场
cd packages-private/local-playground
pnpm run dev
```

3. **修改示例代码**：
   直接编辑 `packages-private/local-playground/src/App.vue` 和其他相关文件

### 方法二：使用 SFC 游乐场【成功】

```bash
# 启动 SFC 游乐场开发环境
pnpm run dev-sfc-run
```

然后访问 `http://localhost:5173`

### 方法三：运行经典示例 【成功】

```bash
# 构建 Vue 并运行示例
node scripts/dev.js vue -f global
# 然后在浏览器中打开 packages/vue/examples/ 下的 HTML 文件
```

## 推荐的调试工作流

1. **日常开发**：使用 `pnpm run dev-vapor` 启动本地游乐场
2. **源码修改**：直接编辑 `packages/runtime-vapor/src/` 下的源文件
3. **示例测试**：在 `packages-private/local-playground/src/` 中编写测试代码
4. **实时反馈**：保存文件后自动重新构建，刷新页面即可看到效果

这样你就可以一边修改 Vue 源码，一边在示例中实时看到调试结果了！
