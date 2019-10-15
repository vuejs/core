export const enum OperationTypes {
  // using literal strings instead of numbers so that it's easier to inspect
  // debugger events
  SET = 'set',
  ADD = 'add',
  DELETE = 'delete',
  CLEAR = 'clear',
  GET = 'get',
  HAS = 'has',
  ITERATE = 'iterate'
}

export type ReadOperationTypes =
  | OperationTypes.GET
  | OperationTypes.HAS
  | OperationTypes.ITERATE

export type WriteOperationTypes =
  | OperationTypes.SET
  | OperationTypes.ADD
  | OperationTypes.DELETE
  | OperationTypes.CLEAR
