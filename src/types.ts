export interface State {
  [StateParams.locked]: boolean;
  [StateParams.holder]: string | undefined;
  [StateParams.version]: number;
}

export enum StateParams {
  locked = 'locked',
  holder = 'holder',
  version = 'version',
}

export interface ILockDAO {
  lock: (
    uid: string,
    keys: string[],
    exp?: number
  ) => Promise<{ error?: any; tokens?: { key: string; version: number }[] }>;
  unlock: (
    uid: string,
    keyTokenPairs: { key: string; version: number }[]
  ) => Promise<{ unlocked: string[] }>;
  check: (keys: string[]) => Promise<{ locked: boolean }>;
}

export interface LockReturnType {
  error?: any;
  tokens?:
    | {
        key: string;
        version: number;
      }[]
    | undefined;
}

export interface LockRequestBody {
  uid: string;
  keys: string | string[];
  exp?: number;
}

export interface UnlockRequestBody {
  uid: string;
  keys: { key: string; version: number }[];
}

export interface CheckRequestBody {
  keys: string | string[];
}

export enum ErrorTypes {
  VALIDATION = 'VALIDATION',
  AUTH = 'AUTHENTICATION',
  DB = 'DB',
  INIT = 'INIT',
  CONFIG = 'CONFIG',
  BAD_REQUEST = 'BAD_REQUEST',
}
