import { ErrorTypes } from './types';

export class HandleError extends Error {
  status: number;
  type: ErrorTypes;

  constructor(status: number, message: string, type: ErrorTypes) {
    super(message);
    this.status = status;
    this.name = 'HandleError';
    this.type = type;
  }
}
