# 1. vue库的构建脚本，讲一下它有哪些入参，如何设置构建哪些包，构建产物有哪些格式，以及如何指定每个包的入口？

## Vue 库构建脚本详解

### 一、命令行参数（入参）

构建脚本支持以下参数：

```bash
# 基本用法示例
nr build dom                    # 模糊匹配包含 "dom" 的包名
nr build vue -f cjs            # 指定输出格式为 cjs
nr build vue -f esm-bundler+esm-browser  # 指定多个格式
```

**支持的参数选项：**

- `-f, --formats`: 指定构建格式（如 `cjs`, `esm-bundler`, `global` 等）
- `-d, --devOnly`: 只构建开发版本
- `-p, --prodOnly`: 只构建生产版本  
- `-t, --withTypes`: 同时构建 TypeScript 类型定义
- `-s, --sourceMap`: 生成 source map
- `--release`: 发布构建模式
- `-a, --all`: 匹配所有符合条件的目标
- `--size`: 计算并报告文件大小
- `-e, --e2eTest`: 用于端到端测试的构建

### 二、如何设置构建哪些包

1. **自动发现包**：
   - 脚本会自动扫描 `packages/` 目录下的所有子目录
   - 过滤条件：必须包含 `package.json` 且不是私有包（除非有 `buildOptions`）

2. **目标包选择方式**：
   ```javascript
   // utils.js 中的 targets 数组包含了所有可构建的包
   const targets = fs.readdirSync(packagesPath).filter(f => {
     // 过滤逻辑...
   }).concat('template-explorer')
   ```

3. **模糊匹配**：
   ```javascript
   // 支持部分匹配，如 "dom" 会匹配 "compiler-dom", "runtime-dom" 等
   fuzzyMatchTarget(['dom'], false)  // 返回第一个匹配项
   fuzzyMatchTarget(['dom'], true)   // 返回所有匹配项
   ```

### 三、构建产物格式

支持 8 种构建格式（在 `create-rolldown-config.js` 中定义）：

1. **`esm-bundler`**: ES Module 格式，供打包工具使用     【index-with-vapor.ts】
2. **`esm-browser`**: 浏览器原生 ES Module 格式          【index.ts】
3. **`cjs`**: CommonJS 格式                             【index.ts】
4. **`global`**: IIFE 格式，可通过全局变量访问            【index.ts】
5. **`esm-bundler-runtime`**: 运行时专用的 ES Module      (runtime-with-vapor.ts)
6. **`esm-browser-runtime`**: 浏览器运行时专用 ES Module  【runtime.ts】
7. **`global-runtime`**: 运行时专用的全局格式             【runtime.ts】
8. **`esm-browser-vapor`**: Vapor 模式的浏览器 ES Module  (runtime-with-vapor.ts)


### 四、每个包的入口配置

#### 1. 入口文件确定规则

在 `create-rolldown-config.js` 的 `createConfig` 函数中：

```javascript
let entryFile = 'index.ts'  // 默认入口

// 特殊处理 vue 包的不同格式
if (pkg.name === 'vue') {
  if (format === 'esm-browser-vapor' || format === 'esm-bundler-runtime') {
    entryFile = 'runtime-with-vapor.ts'
  } else if (format === 'esm-bundler') {
    entryFile = 'index-with-vapor.ts'  
  } else if (format.includes('runtime')) {
    entryFile = 'runtime.ts'
  }
}

// 兼容包特殊处理
if (isCompatPackage && (isBrowserESMBuild || isBundlerESMBuild)) {
  entryFile = `esm-${entryFile}`
}

entryFile = 'src/' + entryFile  // 最终路径
```

#### 2. 实际入口文件示例

**Vue 主包 (`packages/vue`)：**
- `src/index.ts`: 完整构建（包含编译器）
- `src/runtime.ts`: 运行时构建（不包含编译器）
- `src/runtime-with-vapor.ts`: 运行时 + Vapor 模式
- `src/index-with-vapor.ts`: 完整 + Vapor 模式

**Runtime Core (`packages/runtime-core`)：**
- `src/index.ts`: 导出核心 API

**Shared 工具包 (`packages/shared`)：**
- `src/index.ts`: 导出共享工具函数

#### 3. 包级别的格式配置

每个包的 `package.json` 中通过 `buildOptions.formats` 指定支持的格式：

```json
{
  "buildOptions": {
    "name": "Vue",
    "formats": [
      "esm-bundler",
      "esm-bundler-runtime", 
      "cjs",
      "global",
      "global-runtime",
      "esm-browser",
      "esm-browser-runtime",
      "esm-browser-vapor"
    ]
  }
}
```

### 五、构建流程总结

1. **解析命令行参数** → 确定要构建的包和格式
2. **模糊匹配目标包** → 找到对应的包目录
3. **读取包配置** → 获取 `package.json` 中的构建选项
4. **创建 Rollup 配置** → 为每种格式生成配置
5. **执行构建** → 使用 Rolldown 打包
6. **输出产物** → 生成到各包的 `dist/` 目录
7. **可选步骤** → 构建类型定义、计算文件大小等

这套构建系统设计得非常灵活，既支持单个包的精确构建，也支持批量构建，还能根据不同用途生成不同格式的产物。


# 2. 在构建时，如何替换 __DEV__  __ESM_BUNDLER__ 这些预定义的变量的？

我来详细分析 build 脚本中是如何替换这些预定义变量的。

现在我来详细解释 build 脚本中是如何替换 `__DEV__`、`__ESM_BUNDLER__` 等预定义变量的：

## Vue 构建脚本中的预定义变量替换机制

### 一、变量替换的两种方式

构建脚本使用 **双重机制** 来替换预定义变量：

#### 1. Rolldown 的 `transform.define` 配置（主要方式）

在 `create-rolldown-config.js` 的 `createConfig` 函数中：

```javascript
transform: {
  define: resolveDefine(),  // 主要的变量替换机制
  target: isServerRenderer || isCJSBuild ? 'es2019' : 'es2016',
}
```

#### 2. Replace 插件（补充方式）

```javascript
plugins: [
  ...resolveReplace(),  // 补充的字符串替换插件
  // 其他插件...
]
```

### 二、`resolveDefine()` 函数 - 主要替换逻辑

```javascript
function resolveDefine() {
  const defines = {
    __COMMIT__: `"${commit}"`,
    __VERSION__: `"${masterVersion}"`,
    __TEST__: `false`,
    __E2E_TEST__: String(e2eTest),
    __BROWSER__: String(isBrowserBuild),
    __GLOBAL__: String(isGlobalBuild),
    __ESM_BUNDLER__: String(isBundlerESMBuild),
    __ESM_BROWSER__: String(isBrowserESMBuild),
    __CJS__: String(isCJSBuild),
    __SSR__: String(isCJSBuild || isBundlerESMBuild || isServerRenderer),
    __COMPAT__: String(isCompatBuild),
    
    // 功能标志
    __FEATURE_SUSPENSE__: `true`,
    __FEATURE_OPTIONS_API__: isBundlerESMBuild
      ? `__VUE_OPTIONS_API__`  // 保留给打包工具处理
      : `true`,
    __FEATURE_PROD_DEVTOOLS__: isBundlerESMBuild
      ? `__VUE_PROD_DEVTOOLS__`  // 保留给打包工具处理
      : `false`,
    __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__: isBundlerESMBuild
      ? `__VUE_PROD_HYDRATION_MISMATCH_DETAILS__`
      : `false`,
  }

  // 对于非 bundler 构建，硬编码 dev/prod 状态
  if (!isBundlerESMBuild) {
    defines.__DEV__ = String(!isProductionBuild)
  }

  // 允许环境变量覆盖
  Object.keys(defines).forEach(key => {
    if (key in process.env) {
      const value = process.env[key]
      defines[key] = value
    }
  })

  return defines
}
```

### 三、特殊情况处理

#### 1. ESM Bundler 构建的特殊处理

对于 ESM bundler 构建，`__DEV__` 不会被直接替换，而是保留给最终的打包工具处理：

```javascript
// 在 resolveReplace() 中
if (isBundlerESMBuild) {
  Object.assign(replacements, {
    // 保留给打包工具处理
    __DEV__: `!!(process.env.NODE_ENV !== 'production')`,
  })
}
```

这样用户可以在自己的项目中通过 `process.env.NODE_ENV` 控制开发/生产模式。

#### 2. 环境变量覆盖机制

支持通过环境变量动态覆盖任何预定义变量：

```bash
# 示例：强制开启运行时编译功能
__RUNTIME_COMPILE__=true pnpm build runtime-core
```

### 四、实际替换效果示例

假设构建 `vue` 包的 `global` 格式（生产环境）：

**源代码：**
```typescript
// packages/vue/src/runtime.ts
if (__DEV__) {
  initDev()
}

if (__ESM_BUNDLER__) {
  // bundler 特定逻辑
}
```

**构建后结果：**
```javascript
// dist/vue.runtime.global.prod.js
if (false) {  // __DEV__ 被替换为 false
  initDev()
}

if (false) {  // __ESM_BUNDLER__ 被替换为 false
  // bundler 特定逻辑（这段代码会被 tree-shaking 移除）
}
```

### 五、支持的所有预定义变量

从 `global.d.ts` 和构建脚本中可以看到支持的变量包括：

**环境标识：**
- `__DEV__`: 开发模式
- `__TEST__`: 测试环境
- `__E2E_TEST__`: 端到端测试
- `__BROWSER__`: 浏览器环境
- `__GLOBAL__`: 全局构建
- `__ESM_BUNDLER__`: ESM bundler 构建
- `__ESM_BROWSER__`: ESM 浏览器构建
- `__CJS__`: CommonJS 构建
- `__SSR__`: 服务端渲染

**版本和特性：**
- `__VERSION__`: 版本号
- `__COMPAT__`: 兼容模式
- `__FEATURE_*`: 各种功能标志

这种设计使得 Vue 能够在构建时进行条件编译，移除不需要的代码分支，从而实现更小的包体积和更好的性能。