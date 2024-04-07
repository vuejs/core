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
  SKIP = '__v_skip', // 跳过响应式处理
  IS_REACTIVE = '__v_isReactive', // 标记是否为响应式对象
  IS_READONLY = '__v_isReadonly', // 标记是否为只读对象
  IS_SHALLOW = '__v_isShallow', // 标记是否为浅响应式对象
  RAW = '__v_raw', // 原始数据
}

// 定义脏级别枚举
export enum DirtyLevels {
  NotDirty = 0, // 未脏
  QueryingDirty = 1, // 正在查询脏状态
  MaybeDirty_ComputedSideEffect = 2, // 可能脏，存在计算副作用
  MaybeDirty = 3, // 可能脏
  Dirty = 4, // 脏
}
