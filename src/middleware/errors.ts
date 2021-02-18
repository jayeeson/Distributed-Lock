import { NextFunction, Request, Response } from 'express';
import { HandleError } from '../HandleError';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const handleCustomErrors = (
  err: Error,
  req: Request,
  res: Response,
  // NextFunction -- required so node knows this middleware as 4 args to ensure it runs when error is encountered
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) => {
  if (err.name === 'HandleError') {
    const { message, name, type, status } = err as HandleError;
    return res.status(status).send({ message, name, type });
  }

  // unhandled error
  return res.sendStatus(500);
};
