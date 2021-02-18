import express from 'express';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import { getPort } from './helpers/port';
import lockRoutes from './routes';
import { handleCustomErrors } from './middleware/errors';

dotenv.config();

export const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use('/api', lockRoutes);
app.get('/ping', (req, res) => {
  res.send('pong');
});
app.use(handleCustomErrors);

const hostname = process.env.HOST ?? 'localhost';
const port = getPort() ?? 3000;

app.listen(port, hostname, () => {
  console.log(`Running server on port ${port}`);
});
