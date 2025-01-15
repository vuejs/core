import { Plugin } from 'vue'

export interface IsEmptyOptions {
  strict?: boolean;
  ignoreWhitespace?: boolean;
}

export interface IsVEmptyPlugin extends Plugin {
  install: (app: any, options?: IsEmptyOptions) => void;
}
