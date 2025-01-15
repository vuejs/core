# @doudol/core

Vue.js utilities including an enhanced isEmpty implementation with TypeScript support.

## Installation

```bash
npm install @doudol/core
```

## Usage

```typescript
import { createApp } from 'vue'
import { IsVEmptyPlugin } from '@doudol/core'

const app = createApp(App)
app.use(IsVEmptyPlugin, {
  strict: true,
  ignoreWhitespace: true
})

// In components:
// As directive
<div v-empty="value">...</div>

// As method
this.$isEmpty(value)
```

## License

MIT
