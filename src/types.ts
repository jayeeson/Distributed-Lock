export interface State {
  locked: boolean;
  holder: string | undefined;
  version: number;
}

export interface ILockDAO {
  lock: (
    uid: string,
    keys: string[],
    exp?: number
  ) => { error?: any; tokens?: { key: string; version: number }[] };
  unlock: (
    uid: string,
    keyTokenPairs: { key: string; version: number }[]
  ) => void;
  check: (keys: string[]) => { locked: boolean };
}
