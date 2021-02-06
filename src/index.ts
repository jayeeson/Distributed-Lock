import express from 'express';
import mysql from 'mysql';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const hostname = process.env.HOST || 'localhost';
const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;

app.use(express.static('public'));

const db = mysql.createConnection({
  host: 'localhost',
  //user:
});

////////////
// ROUTES //
////////////

// GET HOMEPAGE ROUTE
app.get('/', (req, res) => {
  app.render('index');
});

// POST ROUTE
//app.post('')

app.listen(port, hostname, () => {
  console.log(`Running server on port ${port}`);
});
