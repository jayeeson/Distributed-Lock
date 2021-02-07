import { IStateManager } from "./IStateManager";
import { State } from "./types";

export class InMemoryStateManager extends IStateManager<Map<string, State>> {
  set = (key: string, newState: State) => {
    this.state.set(key, newState);
  };

  get = (key: string) => {
    return this.state.get(key);
  };
}
