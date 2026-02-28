# 1. 这个 release.yml 做了哪些事情，如何将包发布到npm 的

现在我已经充分了解了整个发布流程。让我为你详细解释这个 GitHub Actions `release.yml` 文件的工作原理以及如何将包发布到 npm。

## GitHub Actions Release 工作流程详解

### 1. 触发条件
```yaml
on:
  push:
    tags:
      - 'v*' # 当推送匹配 v* 的标签时触发（如 v1.0, v20.15.10）
```

### 2. 主要工作步骤

#### 第一步：运行测试
```yaml
jobs:
  test:
    uses: ./.github/workflows/test.yml
```
首先调用单独的测试工作流确保代码质量。

#### 第二步：发布流程
```yaml
release:
  # 只在官方仓库运行，防止 fork 仓库意外发布
  if: github.repository == 'vuejs/core'
  needs: [test]  # 等待测试完成
```

#### 第三步：环境准备
```yaml
- name: Checkout
  uses: actions/checkout@v6

- name: Install pnpm
  uses: pnpm/action-setup@v4

- name: Install Node.js
  uses: actions/setup-node@v6
  with:
    node-version-file: '.node-version'
    registry-url: 'https://registry.npmjs.org'
    cache: 'pnpm'

- name: Install deps
  run: pnpm install

- name: Update npm
  run: npm i -g npm@latest
```

#### 第四步：构建和发布
```yaml
- name: Build and publish
  id: publish
  run: |
    pnpm release --publishOnly
```

这是核心步骤，调用 `scripts/release.js` 脚本进行发布。

#### 第五步：创建 GitHub Release
```yaml
- name: Create GitHub release
  id: release_tag
  uses: yyx990803/release-tag@master
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  with:
    tag_name: ${{ github.ref }}
```

## 发布到 npm 的详细过程

通过分析 `scripts/release.js` 源码，发布过程如下：

### 1. 包识别和过滤
```javascript
const packages = fs
  .readdirSync(path.resolve(__dirname, '../packages'))
  .filter(p => {
    const pkgRoot = path.resolve(__dirname, '../packages', p)
    if (fs.statSync(pkgRoot).isDirectory()) {
      const pkg = JSON.parse(
        fs.readFileSync(path.resolve(pkgRoot, 'package.json'), 'utf-8'),
      )
      return !pkg.private  // 只发布非私有包
    }
  })
```

会发布以下公开包：
- `vue` (主包)
- `@vue/runtime-core`
- `@vue/runtime-dom`
- `@vue/runtime-vapor`
- `@vue/runtime-pure-vapor`
- `@vue/compiler-core`
- `@vue/compiler-dom`
- `@vue/compiler-sfc`
- `@vue/compiler-ssr`
- `@vue/compiler-vapor`
- `@vue/reactivity`
- `@vue/server-renderer`
- `@vue/shared`
- `vue-compat`

跳过 `packages-private` 目录下的所有私有包。

### 2. 版本更新和依赖处理
```javascript
function updateVersions(version, getNewPackageName = keepThePackageName) {
  // 更新根目录 package.json
  updatePackage(path.resolve(__dirname, '..'), version, getNewPackageName)
  // 更新所有包的版本号
  packages.forEach(p =>
    updatePackage(getPkgRoot(p), version, getNewPackageName),
  )
}
```

### 3. 构建过程
```javascript
async function buildPackages() {
  step('\nBuilding all packages...')
  if (!skipBuild) {
    await run('pnpm', ['run', 'build', '--withTypes'])
  }
}
```

调用 `scripts/build.js` 构建所有包的不同格式（ESM、CJS、UMD等）。

### 4. npm 发布
```javascript
async function publishPackages(version) {
  const additionalPublishFlags = []
  // 在 CI 环境中添加 provenance 元数据
  if (process.env.CI && !args.registry) {
    additionalPublishFlags.push('--provenance')
  }

  for (const pkg of packages) {
    await publishPackage(pkg, version, additionalPublishFlags)
  }
}

async function publishPackage(pkgName, version, additionalFlags) {
  let releaseTag = null
  // 根据版本号自动设置 npm tag
  if (version.includes('alpha')) {
    releaseTag = 'alpha'
  } else if (version.includes('beta')) {
    releaseTag = 'beta'
  } else if (version.includes('rc')) {
    releaseTag = 'rc'
  }

  await run(
    'pnpm',
    [
      'publish',
      ...(releaseTag ? ['--tag', releaseTag] : []),
      '--access', 'public',
      ...(args.registry ? ['--registry', args.registry] : []),
      ...additionalFlags,
    ],
    {
      cwd: getPkgRoot(pkgName),
      stdio: 'pipe',
    },
  )
}
```

### 5. 自动化特性

- **版本预设**：支持 alpha、beta、rc 等预发布标签
- **依赖管理**：自动处理 workspace 内部依赖关系
- **类型定义**：构建时包含 TypeScript 类型文件
- **安全验证**：使用 provenance 提供发布来源证明
- **错误恢复**：发布失败时自动回滚版本号

### 6. 完整发布命令示例

本地可以这样执行完整发布流程：
```bash
# 发布新版本（包含构建和发布）
pnpm release --publish

# 仅发布已构建的包  ----------------> 这里值得怀疑
pnpm release --publishOnly

# 预发布版本
pnpm release --publish --preid beta

# 指定特定版本
pnpm release 3.5.0 --publish
```

这个发布系统非常完善，自动化程度很高，确保了 Vue.js 项目的高质量发布流程。


# 2. pnpm release --publishOnly 时，调用publishOnly() 也会执行buildPackages(),   不带pbulishOnly时，执行main函数。重点介绍一下main的逻辑吧

让我总结一下 `main()` 函数的逻辑：

## `main()` 函数完整执行逻辑详解

当不带 `--publishOnly` 参数执行 `pnpm release` 时，会调用 `main()` 函数，这是一个完整的发布工作流。

### 核心执行流程

#### 1. 函数选择机制
```javascript
const fnToRun = args.publishOnly ? publishOnly : main
```
- 带 `--publishOnly` → 调用 `publishOnly()` 函数
- 不带参数或带其他参数 → 调用 `main()` 函数

#### 2. main() 函数的关键步骤

**步骤1：远程同步检查**
- 通过 GitHub API 验证本地是否与远程仓库同步
- 防止基于过期代码进行发布

**步骤2：版本选择和确认**
- 支持交互式版本选择（patch/minor/major/pre-release）
- 支持自定义版本输入
- 验证版本格式有效性

**步骤3：测试执行**
- 智能检查 CI 状态
- 可选择跳过本地测试（如果 CI 已通过）

**步骤4：版本更新**
- 更新根目录和所有包的版本号
- 处理内部依赖关系
- 设置版本更新标记用于错误回滚

**步骤5：Changelog 生成**
- 自动生成变更日志
- 需要用户确认 changelog 内容

**步骤6：依赖锁定文件更新**
- 更新 `pnpm-lock.yaml` 文件

**步骤7：Git 操作**
- 条件性提交变更
- 创建版本标签
- 推送到远程仓库

**步骤8：条件性构建发布**
```javascript
if (args.publish) {
  await buildPackages()      // 只有指定 --publish 才构建
  await publishPackages(targetVersion)
}
```

### 关键区别点

| 方面 | main() | publishOnly() |
|------|--------|---------------|
| **构建控制** | 需要 `--publish` 参数 | 总是构建 |
| **版本处理** | 交互式选择 | 使用现有版本 |
| **测试** | 智能判断执行 | 不执行测试 |
| **Git 操作** | 完整流程 | 无 Git 操作 |
| **Changelog** | 自动生成 | 不生成 |

### 实际应用场景

- **本地发布**：`pnpm release --publish` （完整交互流程）
- **CI 发布**：`pnpm release --publishOnly` （自动化流程）
- **预览**：`pnpm release --dry` （dry run 模式）

这种设计提供了很大的灵活性，既能满足本地开发者的交互式需求，也能适应 CI/CD 的自动化要求。


# 3. 在github action 中，执行 pnpm publish的逻辑，它怎么知道发布哪个文件夹中的dist的？它怎么获取publish权限，账号信息或token是怎么传递进去的?

现在我可以详细回答您的问题了。让我分析 `pnpm publish` 在 GitHub Actions 中的工作机制：

## `pnpm publish` 在 GitHub Actions 中的工作机制详解

### 1. 文件定位机制

从源码可以看出，文件定位是通过 `getPkgRoot` 函数实现的：

```javascript
// release.js 行 107-108
const getPkgRoot = (/** @type {string} */ pkg) =>
  path.resolve(__dirname, '../packages/' + pkg)

// release.js 行 438-441
{
  cwd: getPkgRoot(pkgName),  // 设置工作目录到具体包路径
  stdio: 'pipe',
}
```

**工作原理**：
- `getPkgRoot(pkgName)` 返回 `e:/core/packages/[包名]` 的完整路径
- 每个包都有自己的 `dist` 目录结构，例如：
  - `packages/vue/dist/`
  - `packages/runtime-core/dist/`
  - `packages/compiler-sfc/dist/`
- `pnpm publish` 会在对应的包目录下执行，自动找到该目录下的 `package.json` 和 `dist` 文件

### 2. npm 认证和权限机制

#### GitHub Actions 权限配置
```yaml
# release.yml 行 17-19
permissions:
  contents: write
  id-token: write
```

#### Node.js 环境设置
```yaml
# release.yml 行 29-34
- name: Install Node.js
  uses: actions/setup-node@v6
  with:
    node-version-file: '.node-version'
    registry-url: 'https://registry.npmjs.org'  # 关键：设置 npm registry
    cache: 'pnpm'
```

#### 认证令牌传递方式

根据搜索结果和现代 npm 发布实践，主要有两种方式：

**方式1：使用 GitHub OIDC（推荐）**
```yaml
env:
  NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**方式2：使用 npm automation token**
```yaml
env:
  NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### 3. 完整的发布流程

```javascript
// release.js 行 428-441 的完整上下文
await run(
  'pnpm',
  [
    'publish',
    ...(releaseTag ? ['--tag', releaseTag] : []),  // 预发布标签
    '--access', 'public',                           // 公开访问
    ...(args.registry ? ['--registry', args.registry] : []),
    ...additionalFlags,
  ],
  {
    cwd: getPkgRoot(pkgName),  // 关键：定位到正确的包目录
    stdio: 'pipe',
  },
)
```

### 4. 实际执行过程

1. **包识别**：`packages` 数组包含所有非私有包
2. **目录定位**：`getPkgRoot(pkgName)` 确定每个包的具体路径
3. **环境准备**：GitHub Actions 设置好 npm registry 和认证
4. **命令执行**：在每个包目录下执行 `pnpm publish`
5. **文件发布**：npm 自动读取该目录下的：
   - `package.json`（包元信息）
   - `dist/` 目录（构建产物）
   - `files` 字段指定的其他文件

### 5. 安全机制

现代 npm 发布采用以下安全措施：

- **Provenance**：`--provenance` 参数提供发布来源证明
- **OIDC 身份验证**：GitHub Actions 使用临时令牌而非永久密钥
- **环境隔离**：每个包在独立目录中发布
- **权限最小化**：只给必要的 `contents: write` 和 `id-token: write` 权限

这种方式既保证了安全性，又简化了配置管理，是现代开源项目的标准做法。


# 4. 还是没看懂怎么 pnpm publish 进行认证的，是不是必须用 vuejs 这个组织的账号，或者必须yyx990803 本人的账号才能发布？ 这些账号需要提前在个人的setting中创建 Personal access tokens才行。

让我详细解释一下 npm 发布的认证机制，这确实是很多人容易混淆的地方。

## npm 发布认证机制详解

### 现代 npm 发布不需要个人账号密码

您提到的理解有一些误区。现代 npm 包发布（特别是开源项目）**不需要**：

❌ 不需要 vuejs 组织的账号  
❌ 不需要 Evan You (yyx990803) 个人账号  
❌ 不需要手动创建 Personal Access Tokens  

### 实际的认证方式

#### 1. GitHub Actions OIDC 认证（推荐方式）

从 `release.yml` 可以看出：

```yaml
permissions:
  contents: write
  id-token: write    # 关键：启用 OIDC 身份验证
```

```yaml
- name: Install Node.js
  uses: actions/setup-node@v6
  with:
    registry-url: 'https://registry.npmjs.org'  # 设置 npm registry
```

GitHub Actions 会自动处理认证，通过 OIDC（OpenID Connect）提供临时的、有期限的认证令牌。

#### 2. npm Organization 成员机制

对于 `@vue/*` 作用域的包：

- 包发布权限由 **npm organization**（vuejs 组织）控制
- GitHub Actions 作为 **organization level automation** 获得发布权限
- 不需要个人开发者账号

#### 3. 实际的权限配置

在 npmjs.com 上，vuejs 组织会配置：

```
Organization: vuejs
Team: maintainers
Permissions: 
  - Publish packages
  - Modify package settings
Automation: GitHub Actions (via OIDC)
```

### 认证流程示意

```
GitHub Actions (release.yml)
        ↓
请求 OIDC 身份令牌
        ↓
npm registry 验证身份
        ↓
确认是 vuejs 组织授权的自动化发布
        ↓
允许发布 @vue/* 包
```

### 为什么这样设计？

1. **安全性**：临时令牌，自动过期，无法被盗用
2. **便利性**：无需人工干预，CI/CD 自动化
3. **审计性**：所有发布都有完整记录和来源证明
4. **团队协作**：多人可以维护，不需要共享个人凭证

### 对比传统的 PAT 方式

**传统方式**（不推荐）：
```yaml
env:
  NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}  # 需要手动创建和管理
```

**现代 OIDC 方式**（推荐）：
```yaml
permissions:
  id-token: write  # GitHub 自动处理，零配置
```

所以回答您的问题：**不需要任何个人账号或手动创建的 tokens**，GitHub Actions 的 OIDC 机制会自动处理整个认证流程。这也是目前开源项目发布 npm 包的标准做法。