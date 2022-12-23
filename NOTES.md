# Fixing problems with hyphenated vs. camelCased element props

## Situation

Vue has two different ways of applying the vnode's props to an element:
  1. apply them as element attributes (`el.settAttribute('value', 'Test')`)
  2. apply them as element properties (`el.value = 'Test'`)

Vue prefers the second way *if* it can detect that property on the element (simplified: ` if (value in el)`, plus some exceptions/special cases.)

As no* regular HTML attribute contains a hyphen, kebab-case vs. camelCase is usually not an issue, but there are two important exceptions:

- all `aria-` attributes.
- any custom Attributes can contain hyphens (or be camelCased element properties). These are usually used on custom elements ("web components")

## The problem

When a hyphenated or camelCased vnode prop is processed in `patchProp`, we can experience a few related but distinct undesirable bugs.

|prop|Has DOM prop?|handled correctly?|behavior
|-|-|-|-|
|`id`|✅|✅|applied as DOM property `id`|
|`aria-label`|❌|✅|applied as attribute `aria-label`|
|`ariaControls`|❌ |❌| 🚸 applied as attribute `ariacontrols` (1)|
|`custom-attr`|✅ `customAttr`|❌| 🚸 applied as attribute `custom-attr` (2a), though |
|`customAttr`|✅|✅| 🚸 applied as el property `customAttr` (2b)|

Problem (1):

a `camelCase` prop is applied as lowercase attribute (missing hyphen)

Problem (2): 

- `kebap-case`prop applied as attribute even though matching camelCase DOM property exists.
- while `camelCase` prop is applied to element via the matching DOM property.

This can lead to problems with custom elements. For example, if the custom element's prop `post` expects a post object, that has to be passed as a DOMprop. Applying it as an attribute will result in `posts="[Object object]"`.

## Things things to consider / Open questions.

- SVGs can have `camelCase` attributes. That should be handled properly by the implementation, though - I think it's covered.
- `tabindex` attribute vs `tabIndex` DOMProp. Don't think this is a problem either but it feels worth mentioning as it's the only instance I can think of where a regular HTML attribute has a camelCase counterpart.
- `aria-haspopup` vs. `ariaHasPopup`: Chrome has the latter as a DOMProp (FF doesn't). That domProp's name is *not* the camelCase Version of the `aria-haspopup` attribute. Kinda like the tabindex situation.