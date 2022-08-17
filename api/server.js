// モジュールの読み込み
import express from 'express';
import { middleware } from '@line/bot-sdk';
import 'dotenv/config';

// ファイルの読み込み
import { index } from '../bot.js';
import { intervalExecute1, intervalExecute2 } from '../event/postback.js';

const PORT = process.env.PORT || 3000;
const app = express();

// /にアクセスがあった時、Deploy succeededと返す
app.get('/', (req, res) => { res.send('Deploy succeeded'); });
// /webhookにアクセスがあったとき、bot.jsのindexを呼び出す
app.post('/webhook', middleware({
  channelSecret: process.env.channelSecret,
}), index);

app.get('/interval-execute-long', (req, res) => {
  intervalExecute1();
  console.log('正しく叩けているよ!!!long!!!!\n');
});

app.get('/interval-execute-short', (req, res) => {
  intervalExecute2();
  console.log('正しく叩けているよ!!!short!!!!\n');
});

app.listen(PORT);
console.log(`Server running at ${PORT}`);
