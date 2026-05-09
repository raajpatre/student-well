import express from 'express';
import cors from 'cors';
import { env } from './config/env';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const port = env.PORT || 3001;

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
