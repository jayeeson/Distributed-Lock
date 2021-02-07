/* eslint-disable @typescript-eslint/no-unused-vars */
import { State } from './types';

export class IStateManager<T> {
  protected state: T;

  constructor(state: T) {
    this.state = state;
  }

  set = (key: string, newState: State): void => {
    throw new Error('abstract class, dont call');
  };

  get = (key: string): State | undefined => {
    throw new Error('abstract class, dont call');
  };
}
