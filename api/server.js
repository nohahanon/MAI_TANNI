// モジュールの読み込み
import express from 'express';
import { middleware } from '@line/bot-sdk';
import 'dotenv/config';
import cron from 'node-cron';

// ファイルの読み込み
import { index } from '../index.js';
import { intervalExecute } from '../event/postback.js';

const PORT = process.env.PORT || 3000;
const app = express();

// /にアクセスがあった時、Deploy succeededと返す
app.get('/', (req, res) => { res.send('Deploy succeeded'); });
// /webhookにアクセスがあったとき、bot.jsのindexを呼び出す
app.post('/webhook', middleware({
  channelSecret: process.env.channelSecret,
}), index);

app.get('/interval-execute', (req, res) => {
  intervalExecute();
  console.log('正しく叩けているよ!!!\n');
});

app.listen(PORT);
console.log(`Server running at ${PORT}`);

// ローカルでの定期実行のテスト用
// cron.schedule('* * * * *', () => {
//   console.log('@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@');
//   intervalExecute();
// });
