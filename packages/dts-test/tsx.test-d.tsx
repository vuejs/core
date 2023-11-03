// TSX w/ defineComponent is tested in defineComponent.test-d.tsx
import { KeepAlive, Suspense, Fragment, Teleport, VNode } from 'vue'
import { expectType } from './utils'

expectType<VNode>(<div />)
expectType<JSX.Element>(<div />)
expectType<JSX.Element>(<div id="foo" />)
expectType<JSX.Element>(<div>hello</div>)
expectType<JSX.Element>(<input value="foo" />)

// @ts-expect-error style css property validation
;<div style={{ unknown: 123 }} />

// allow array styles and nested array styles
expectType<JSX.Element>(<div style={[{ color: 'red' }]} />)
expectType<JSX.Element>(
  <div style={[{ color: 'red' }, [{ fontSize: '1em' }]]} />
)

// @ts-expect-error unknown prop
;<div foo="bar" />

// allow key/ref on arbitrary element
expectType<JSX.Element>(<div key="foo" />)
expectType<JSX.Element>(<div ref="bar" />)

expectType<JSX.Element>(
  <input
    onInput={e => {
      // infer correct event type
      expectType<EventTarget | null>(e.target)
    }}
    onInputCapture={e => {
      expectType<EventTarget | null>(e.target)
    }}
    onInputOnce={e => {
      expectType<EventTarget | null>(e.target)
    }}
    onInputOnceCapture={e => {
      expectType<EventTarget | null>(e.target)
    }}
    onInputCaptureOnce={e => {
      expectType<EventTarget | null>(e.target)
    }}
    onInputPassive={e => {
      // infer correct event type
      expectType<EventTarget | null>(e.target)
    }}
    onInputCapturePassive={e => {
      expectType<EventTarget | null>(e.target)
    }}
    onInputOncePassive={e => {
      expectType<EventTarget | null>(e.target)
    }}
    onInputOnceCapturePassive={e => {
      expectType<EventTarget | null>(e.target)
    }}
    onInputPassiveCaptureOnce={e => {
      expectType<EventTarget | null>(e.target)
    }}
  />
)

// built-in types
expectType<JSX.Element>(<Fragment />)
expectType<JSX.Element>(<Fragment key="1" />)

expectType<JSX.Element>(<Teleport to="#foo" />)
expectType<JSX.Element>(<Teleport to="#foo" key="1" />)

// @ts-expect-error
;<Teleport />
// @ts-expect-error
;<Teleport to={1} />

// KeepAlive
expectType<JSX.Element>(<KeepAlive include="foo" exclude={['a']} />)
expectType<JSX.Element>(<KeepAlive key="1" />)
// @ts-expect-error
;<KeepAlive include={123} />

// Suspense
expectType<JSX.Element>(<Suspense />)
expectType<JSX.Element>(<Suspense key="1" />)
expectType<JSX.Element>(
  <Suspense onResolve={() => {}} onFallback={() => {}} onPending={() => {}} />
)
// @ts-expect-error
;<Suspense onResolve={123} />
