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
  ) => Promise<{ status: string }>;
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
