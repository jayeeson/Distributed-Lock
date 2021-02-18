import express from 'express';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import { newRedisClient } from './helpers/redis';
import { getPort } from './helpers/port';

dotenv.config();

const app = express();
app.use(bodyParser.json());
bodyParser.urlencoded({ extended: false });

export const redis = newRedisClient();

const hostname = process.env.HOST ?? 'localhost';
const port = getPort() ?? 3000;

app.listen(port, hostname, () => {
  console.log(`Running server on port ${port}`);
});
