// using literal strings instead of numbers so that it's easier to inspect
// debugger events

// 定义操作类型枚举
export enum TrackOpTypes {
  GET = 'get', // 获取操作
  HAS = 'has', // 检查是否存在操作
  ITERATE = 'iterate', // 遍历操作
}

// 定义触发操作类型枚举
export enum TriggerOpTypes {
  SET = 'set', // 设置操作
  ADD = 'add', // 添加操作
  DELETE = 'delete', // 删除操作
  CLEAR = 'clear', // 清除操作
}

// 定义响应式标志枚举
export enum ReactiveFlags {
  SKIP = '__v_skip',
  IS_REACTIVE = '__v_isReactive',
  IS_READONLY = '__v_isReadonly',
  IS_SHALLOW = '__v_isShallow',
  RAW = '__v_raw',
  IS_REF = '__v_isRef',
}
