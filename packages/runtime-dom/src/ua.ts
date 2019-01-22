export const UA = window.navigator.userAgent.toLowerCase()
export const isEdge = UA.indexOf('edge/') > 0
export const isChrome = /chrome\/\d+/.test(UA) && !isEdge
