// TSX w/ defineComponent is tested in defineComponent.test-d.tsx

import { expectError, expectType } from 'tsd'
import { KeepAlive, Suspense, Fragment, Teleport } from '@vue/runtime-dom'

expectType<JSX.Element>(<div />)
expectType<JSX.Element>(<div id="foo" />)
expectType<JSX.Element>(<input value="foo" />)

// unknown prop
expectError(<div foo="bar" />)

// allow key/ref on arbitrary element
expectType<JSX.Element>(<div key="foo" />)
expectType<JSX.Element>(<div ref="bar" />)

expectType<JSX.Element>(
  <input
    onInput={e => {
      // infer correct event type
      expectType<EventTarget | null>(e.target)
    }}
  />
)

// built-in types
expectType<JSX.Element>(<Fragment />)
expectType<JSX.Element>(<Fragment key="1" />)

expectType<JSX.Element>(<Teleport to="#foo" />)
expectType<JSX.Element>(<Teleport to="#foo" key="1" />)
expectError(<Teleport />)
expectError(<Teleport to={1} />)

// KeepAlive
expectType<JSX.Element>(<KeepAlive include="foo" exclude={['a']} />)
expectType<JSX.Element>(<KeepAlive key="1" />)
expectError(<KeepAlive include={123} />)

// Suspense
expectType<JSX.Element>(<Suspense />)
expectType<JSX.Element>(<Suspense key="1" />)
expectType<JSX.Element>(<Suspense onResolve={() => {}} onRecede={() => {}} />)
expectError(<Suspense onResolve={123} />)
