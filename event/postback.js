/* eslint-disable linebreak-style */
import Pool from 'pg-pool';
import line from '@line/bot-sdk';
import { processCalender } from './message/text.js';

const pool = new Pool({
  user: process.env.pgUser,
  host: process.env.pgHost,
  database: process.env.pgDatabase,
  password: process.env.pgPassWord,
  port: process.env.pgPort,
});

const client = new line.Client({
  channelAccessToken: process.env.channelAccessToken,
});
export const intervalExecute = async () => {
  // 現在時刻から1-2時間範囲にあるレコードを取得
  const resReallyRecent = await pool.query({
    text: 'select name, deadline, lecturecode, lineid from submissions where deadline between now() + cast(\'1 hour\' as interval) and now() + cast(\'2 hours\' as interval);',
  });
  // // 現在時刻から5-6時間範囲にあるレコードを取得
  const resRecent = await pool.query({
    text: 'select name, deadline, lecturecode, lineid from submissions where deadline between now() + cast(\'5 hour\' as interval) and now() + cast(\'6 hours\' as interval);',
  });
  const resUsers = await pool.query({
    text: 'SELECT lineid, url FROM users;',
  });
  // res_reallyrecent, resRecentの通知
  await resReallyRecent.rows.forEach((t) => {
    if (t.lecturecode.trim() !== 'MYTASK') {
      client.pushMessage(t.lineid.trim(), {
        type: 'text',
        text: `以下のタスクの締め切りがとても近づいています！！\n${t.name.trim()}:${t.lectureCode.trim()}`,
      });
    }
  });
  await resRecent.rows.forEach((t) => {
    if (t.lecturecode.trim() !== 'MYTASK') {
      client.pushMessage(t.lineid.trim(), {
        type: 'text',
        text: `以下のタスクの締め切りがそこそこ近づいています！！\nタスク名:${t.name.trim()}\n講義名:${t.lectureCode.trim()}`,
      });
    }
  });
  // users全員のsubmission更新
  await resUsers.rows.forEach((t) => {
    console.log(t);
    processCalender(t.url, t.lineid);
  });
  // 期限が切れたレコードの削除
  pool.query({
    text: 'DELETE FROM submissions WHERE deadline < now();',
  });
};

function initContext(lineID) {
  pool.query({
    text: 'UPDATE users SET context = null WHERE lineid = $1;',
    values: [lineID],
  });
}

async function numOfSubmissions(lineID) {
  const res = await pool.query({
    text: 'SELECT COUNT(*) FROM submissions WHERE lineid = $1;',
    values: [lineID],
  });
  return res.rows[0].count;
}

async function nunmOfMyComments(lineID) {
  const res = await pool.query({
    text: 'SELECT COUNT(*) FROM reviews WHERE userid = $1',
    values: [lineID],
  });
  return res.rows[0].count;
}

async function lecturesList() {
  const res = await pool.query({
    text: 'SELECT * FROM lectures;',
  });
  const carousel = {
    type: 'carousel',
    contents: [],
  };
  // caraucelのcontentsにpushしてカルーセル内における一つのバブルとなる
  const bubble = {
    type: 'bubble',
    size: 'giga',
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [],
      spacing: 'sm',
      paddingAll: '13px',
    },
  };
  // lectureNameとlectureCodeをcontentsにpushしてバブル内における一つの行とする
  const box = {
    type: 'box',
    layout: 'horizontal',
    contents: [],
  };

  const lectureName = {
    type: 'box',
    layout: 'vertical',
    contents: [{
      type: 'text',
      size: 'xs',
      text: '',
      wrap: true,
    }],
    width: '75%',
  };
  const lectureCode = {
    type: 'box',
    layout: 'vertical',
    contents: [{
      type: 'text',
      text: '',
      wrap: true,
      align: 'end',
      size: 'xs',
    }],
    width: '25%',
  };
  const numMaxContents = 15;
  const carousel1 = JSON.parse(JSON.stringify(carousel));
  const carousel2 = JSON.parse(JSON.stringify(carousel));
  const tmp = [];
  for (let i = 0; i < res.rows.length; i += 1) {
    const boxClone = JSON.parse(JSON.stringify(box));
    const lectureNameClone = JSON.parse(JSON.stringify(lectureName));
    const lectureCodeClone = JSON.parse(JSON.stringify(lectureCode));
    lectureNameClone.contents[0].text = `${res.rows[i].name.trim()}`;
    lectureCodeClone.contents[0].text = `${res.rows[i].code.trim()}`;
    boxClone.contents.push(lectureNameClone);
    boxClone.contents.push(lectureCodeClone);
    tmp.push(boxClone);
  }
  let bubbleClone = JSON.parse(JSON.stringify(bubble));
  tmp.sort((a, b) => (a.contents[1].contents[0].text > b.contents[1].contents[0].text ? 1 : -1));
  for (let i = 0; i < tmp.length; i += 1) {
    bubbleClone.body.contents.push(tmp[i]);
    if ((i + 1) % numMaxContents === 0) {
      if (i < (tmp.length) / 2) carousel1.contents.push(bubbleClone);
      else carousel2.contents.push(bubbleClone);
      bubbleClone = JSON.parse(JSON.stringify(bubble));
    }
  }
  carousel2.contents.push(bubbleClone);

  return [{
    type: 'flex',
    altText: 'this is a flex message',
    contents: carousel1,
  },
  {
    type: 'flex',
    altText: 'this is a flex message',
    contents: carousel2,
  }];
}

// mySubmissionList()のためにオブジェクトに格納する文字列を成型します
async function subFuncFlex(vls, idx, box) {
  const hankakuCriteria = 25;
  const zenkakuCriteria = 15;
  const boxTmp = JSON.parse(JSON.stringify(box));
  const resLectureName = await pool.query({
    text: 'SELECT name FROM lectures WHERE code = $1;',
    values: [vls.lecturecode.trim()],
  });
  const zenOrHan = /^[^\x01-\x7E\uFF61-\uFF9F]+$/;
  // 文字列がzenkakuCriteria以上の長さの全角文字列の場合抑える
  // 文字列がhankakuCriteria以上の長さの半角文字列の場合抑える
  if (zenOrHan.test(vls.name) && vls.name.length > zenkakuCriteria) {
    boxTmp.contents[0].text = `${idx + 1}:${vls.name.substr(0, zenkakuCriteria)}...`;
  } else if (!zenOrHan.test(vls.name) && vls.name.length > hankakuCriteria) {
    boxTmp.contents[0].text = `${idx + 1}:${vls.name.substr(0, hankakuCriteria)}...`;
  } else {
    boxTmp.contents[0].text = `${idx + 1}:${vls.name}`;
  }
  // lecturecodeが'MYTASK'の場合lecturesに聞いても何も返らないため、''を自力で代入する
  if (vls.lecturecode.trim() !== 'MYTASK') {
    boxTmp.contents[1].text = `${resLectureName.rows[0].name}`;
  }
  return boxTmp;
}

// lineidをもとにsubmissionテーブルからタスクを取得してflex messageのcontentsに収まるオブジェクトを返します
async function mySubmissionList(lineID) {
  const resMyTask = await pool.query({
    text: 'SELECT name, lecturecode FROM submissions WHERE lineID = $1 AND lecturecode = \'MYTASK\'',
    values: [lineID],
  });
  const resLectures = await pool.query({
    text: 'SELECT name, lecturecode FROM submissions WHERE lineID = $1 AND lecturecode != \'MYTASK\'',
    values: [lineID],
  });
  // lecturesを参照してcodeをnameに置き換える。
  const model = {
    type: 'bubble',
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: 'TODO List',
          weight: 'bold',
          color: '#1DB446',
          size: 'sm',
        },
        {
          type: 'box',
          layout: 'vertical',
          margin: 'xxl',
          spacing: 'sm',
          contents: [],
        },
        {
          type: 'separator',
          margin: 'xxl',
        },
      ],
    },
    styles: {
      footer: {
        separator: true,
      },
    },
  };
  const separator = {
    type: 'separator',
    margin: 'xxl',
  };
  const boxForLecture = {
    type: 'box',
    layout: 'horizontal',
    contents: [
      {
        type: 'text',
        text: '',
        size: 'xs',
        color: '#555555',
        flex: 0,
        wrap: true,
      },
      {
        type: 'text',
        text: '',
        size: 'xxs',
        color: '#111111',
        wrap: true,
        align: 'end',
      },
    ],
  };
  const boxForMyTask = {
    type: 'box',
    layout: 'horizontal',
    contents: [
      {
        type: 'text',
        text: '',
        size: 'xs',
        color: '#555555',
        wrap: true,
        flex: 0,
      },
    ],
  };
  model.body.contents[1].contents = await Promise.all([].concat(
    resMyTask.rows.map((t, i) => subFuncFlex(t, i, boxForMyTask)),
  ).concat(
    [separator],
  ).concat(
    resLectures.rows.map((t, i) => subFuncFlex(t, i + resMyTask.rows.length, boxForLecture)),
  ));
  return model;
}

async function subFuncFlexForDelete(vls, i, btn) {
  const hankakuCriteria = 25;
  const zenkakuCriteria = 15;
  const btnTmp = JSON.parse(JSON.stringify(btn));
  const resLectureName = await pool.query({
    text: 'SELECT name FROM lectures WHERE code = $1;',
    values: [vls.lecturecode.trim()],
  });
  const zenOrHan = /^[^\x01-\x7E\uFF61-\uFF9F]+$/;
  // 文字列がzenkakuCriteria以上の長さの全角文字列の場合抑える
  // 文字列がhankakuCriteria以上の長さの半角文字列の場合抑える
  if (zenOrHan.test(vls.name) && vls.name.length > zenkakuCriteria) {
    btnTmp.action.label = `${i + 1}:${vls.name.substr(0, zenkakuCriteria)}...`;
  } else if (!zenOrHan.test(vls.name) && vls.name.length > hankakuCriteria) {
    btnTmp.action.label = `${i + 1}:${vls.name.substr(0, hankakuCriteria)}...`;
  } else {
    btnTmp.action.label = `${i + 1}:${vls.name}`;
  }
  // if (vls.lecturecode.trim() !== 'MYTASK') {
  //   btnTmp.contents[1].text = `${resLectureName.rows[0].name}`;
  // }
  btnTmp.action.data = vls.submissionid;

  return btnTmp;
}

async function mySubmissionListForDelete(lineID) {
  const resMyTask = await pool.query({
    text: 'SELECT name, lecturecode, submissionid FROM submissions WHERE lineID = $1 AND lecturecode = \'MYTASK\'',
    values: [lineID],
  });
  const resLectures = await pool.query({
    text: 'SELECT name, lecturecode, submissionid FROM submissions WHERE lineID = $1 AND lecturecode != \'MYTASK\'',
    values: [lineID],
  });
  // lecturesを参照してcodeをnameに置き換える。
  const model = {
    type: 'bubble',
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: 'TODO List',
          weight: 'bold',
          color: '#1DB446',
          size: 'sm',
        },
        {
          type: 'box',
          layout: 'vertical',
          margin: 'xxl',
          spacing: 'sm',
          contents: [],
        },
        {
          type: 'separator',
          margin: 'xxl',
        },
      ],
    },
    styles: {
      footer: {
        separator: true,
      },
    },
  };
  const separator = {
    type: 'separator',
    margin: 'xxl',
  };
  const boxForLecture = {
    type: 'box',
    layout: 'horizontal',
    contents: [
      {
        type: 'text',
        text: '',
        size: 'xs',
        color: '#555555',
        flex: 0,
        wrap: true,
      },
      {
        type: 'text',
        text: '',
        size: 'xxs',
        color: '#111111',
        wrap: true,
        align: 'end',
      },
    ],
  };
  const boxForMyTask = {
    type: 'box',
    layout: 'horizontal',
    contents: [
      {
        type: 'text',
        text: '',
        size: 'xs',
        color: '#555555',
        wrap: true,
        flex: 0,
      },
    ],
  };

  const tmpmodel = {
    type: 'bubble',
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: 'TODO List',
          weight: 'bold',
          color: '#1DB446',
          size: 'sm',
        },
        {
          type: 'box',
          layout: 'vertical',
          margin: 'xxl',
          spacing: 'sm',
          contents: [],
        },
        {
          type: 'separator',
          margin: 'xxl',
        },
      ],
    },
    styles: {
      footer: {
        separator: true,
      },
    },
  };
  const btn = {
    type: 'button',
    action: {
      type: 'postback',
      label: '',
      data: '',
    },
    height: 'sm',
    // margin: 'none',
  };

  model.body.contents[1].contents = await Promise.all([].concat(
    resMyTask.rows.map((t, i) => subFuncFlexForDelete(t, i, btn)),
  ).concat(
    [separator],
  ).concat(
    resLectures.rows.map((t, i) => subFuncFlexForDelete(t, i + resMyTask.rows.length, btn)),
  ));
  return model;
}

async function myCommentList(lineID) {
  const res = await pool.query({
    text: 'SELECT reviewid, comment, evaluationscore, lecturecode FROM reviews WHERE userid = $1',
    values: [lineID],
  });
  const boxParent = {
    type: 'bubble',
    size: 'giga',
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: 'Comment List',
          weight: 'bold',
          color: '#1DB446',
          size: 'sm',
        },
        {
          type: 'separator',
          margin: 'xxl',
        },
        {
          type: 'box',
          layout: 'vertical',
          margin: 'xxl',
          spacing: 'sm',
          contents: [{
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: 'コメント番号',
                size: 'xs',
                color: '#555555',
                flex: 0,
                margin: 'md',
              },
              {
                type: 'separator',
                margin: 'md',
              },
              {
                type: 'text',
                text: '評価スコア',
                size: 'xs',
                color: '#555555',
                flex: 0,
                margin: 'md',
              },
              {
                type: 'separator',
                margin: 'md',
              },
              {
                type: 'text',
                text: '講義コード',
                size: 'xs',
                flex: 0,
                margin: 'md',
                color: '#555555',
              },
              {
                type: 'separator',
                margin: 'md',
              },
              {
                type: 'text',
                size: 'xs',
                text: 'コメント',
                color: '#555555',
                flex: 0,
                margin: 'md',
                wrap: true,
              },
            ],
          }],
        },
      ],
    },
    styles: {
      footer: {
        separator: true,
      },
    },
  };
  const boxChilde = {
    type: 'box',
    layout: 'horizontal',
    contents: [
      {
        type: 'text',
        text: '',
        size: 'xs',
        color: '#555555',
        flex: 0,
        margin: 'md',
      },
      {
        type: 'separator',
        margin: 'md',
      },
      {
        type: 'text',
        text: '',
        size: 'xs',
        color: '#555555',
        flex: 0,
        margin: 'md',
      },
      {
        type: 'separator',
        margin: 'md',
      },
      {
        type: 'text',
        text: '',
        size: 'xs',
        flex: 0,
        margin: 'md',
        color: '#555555',
      },
      {
        type: 'separator',
        margin: 'md',
      },
      {
        type: 'text',
        size: 'xs',
        text: '',
        color: '#555555',
        flex: 0,
        margin: 'md',
        wrap: true,
      },
    ],
  };
  for (let i = 0; i < res.rows.length; i += 1) {
    const boxChildClone = JSON.parse(JSON.stringify(boxChilde));
    boxChildClone.contents[0].text = res.rows[i].reviewid.toString();
    boxChildClone.contents[2].text = res.rows[i].evaluationscore.toString();
    boxChildClone.contents[4].text = res.rows[i].lecturecode.trim();
    boxChildClone.contents[6].text = res.rows[i].comment.trim();
    boxParent.body.contents[2].contents.push(boxChildClone);
  }
  return boxParent;
}

const tmp = async (postbackData, lineID) => {
  const context = await pool.query({
    text: 'SELECT context FROM users WHERE lineID = $1;',
    values: [lineID],
  });

  try {
    switch (await context.rows[0].context) {
      case 'delete': {
        console.log(postbackData);
        if (!Number.isNaN(Number.parseInt(postbackData, 10))) {
          pool.query({
            text: 'DELETE FROM submissions WHERE submissionid = $1;',
            values: [Number.parseInt(postbackData, 10)],
          });
          return [{
            type: 'text',
            text: 'レコードを削除しました！',
          }, {
            type: 'flex',
            altText: 'flex',
            contents: {
              type: 'bubble',
              size: 'mega',
              body: {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'text',
                    text: 'タスクの削除を続けますか？',
                  },
                  {
                    type: 'box',
                    layout: 'horizontal',
                    contents: [
                      {
                        type: 'button',
                        action: {
                          type: 'postback',
                          label: 'はい',
                          data: '項目削除',
                        },
                      },
                      {
                        type: 'button',
                        action: {
                          type: 'postback',
                          label: 'いいえ',
                          data: '項目削除の終了',
                        },
                      },
                    ],
                  },
                ],
              },
            },
          }];
        }
        return {
          type: 'text',
          text: '削除機能を終了します！',
        };
      }
      default:
        break;
    }
  } catch (err) {
    console.log(err);
  } finally {
    initContext(lineID);
  }

  let message;

  switch (postbackData) {
    case 'リスト取得': {
      if ((await numOfSubmissions(lineID)) === '0') {
        return {
          type: 'text',
          text: 'リストは空です',
        };
      }
      message = {
        type: 'flex',
        altText: 'Flex Message',
        contents: await mySubmissionList(lineID),
      };
      break;
    }

    case '項目追加': {
      message = {
        type: 'text',
        text: '追加するタスクを送信してください',
      };
      pool.query({
        text: 'UPDATE users SET context = $1 WHERE lineid = $2;',
        values: ['add', lineID],
      });
      break;
    }

    case '項目追加の終了': {
      message = {
        type: 'text',
        text: '追加機能を終了します！',
      };
      initContext(lineID);
      break;
    }

    case 'カレンダー登録': {
      // URLを入力させる
      message = {
        type: 'text',
        text: 'URLを入力してください',
      };
      pool.query({
        text: 'UPDATE users SET context = $1 WHERE lineid = $2;',
        values: ['push', lineID],
      });
      break;
    }

    case '項目削除': {
      if ((await numOfSubmissions(lineID)) === '0') {
        return {
          type: 'text',
          text: 'レコードが存在しないようです！',
        };
      }
      message = [
        {
          type: 'flex',
          altText: 'Flex Message',
          contents: await mySubmissionListForDelete(lineID),
        },
        {
          type: 'text',
          text: '削除したい項目をタップしてください!',
        }];
      pool.query({
        text: 'UPDATE users SET context = $1 WHERE lineid = $2;',
        values: ['delete', lineID],
      });
      break;
    }

    case '項目削除の終了': {
      message = {
        type: 'text',
        text: '削除機能を終了します！',
      };
      initContext(lineID);
      break;
    }

    case 'その他': {
      message = {
        type: 'flex',
        altText: 'Flex Message',
        contents: {
          type: 'bubble',
          header: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: 'その他 機能一覧',
                size: 'xxl',
                color: '#000000',
              },
              {
                type: 'text',
                text: '使いたい機能の項目をタップしてください',
                wrap: true,
                color: '#222222',
              },
            ],
            margin: 'none',
            backgroundColor: '#f0fff0',
          },
          body: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'button',
                action: {
                  type: 'postback',
                  label: '講義について',
                  data: '講義について',
                },
                height: 'sm',
              },
              {
                type: 'button',
                action: {
                  type: 'postback',
                  label: '開発中！',
                  data: '開発中1',
                },
                height: 'sm',
              },
              {
                type: 'button',
                action: {
                  type: 'postback',
                  label: '開発中！',
                  data: '開発中2',
                },
                height: 'sm',
              },
            ],
          },
        },
      };
      break;
    }

    case 'HELP': {
      // 返信するメッセージを作成
      message = {
        type: 'flex',
        altText: 'Flex Message',
        contents: {
          type: 'bubble',
          header: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: 'HELP',
                size: 'xxl',
                color: '#000000',
              },
              {
                type: 'text',
                text: '読みたい項目をタップしてください',
                color: '#222222',
              },
            ],
            margin: 'none',
            backgroundColor: '#f0fff0',
          },
          body: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'button',
                action: {
                  type: 'postback',
                  label: 'リスト取得',
                  data: 'リスト取得HELP',
                },
                height: 'sm',
              },
              {
                type: 'button',
                action: {
                  type: 'postback',
                  label: '項目追加',
                  data: '項目追加HELP',
                },
                height: 'sm',
              },
              {
                type: 'button',
                action: {
                  type: 'postback',
                  label: 'カレンダー登録',
                  data: 'カレンダー登録HELP',
                },
                height: 'sm',
              },
              {
                type: 'button',
                action: {
                  type: 'postback',
                  label: '項目削除',
                  data: '項目削除HELP',
                },
                height: 'sm',
              },
              {
                type: 'button',
                action: {
                  type: 'postback',
                  label: 'その他',
                  data: 'その他HELP',
                },
                height: 'sm',
              },
              {
                type: 'button',
                action: {
                  type: 'postback',
                  label: 'リポジトリ',
                  data: 'リポジトリHELP',
                },
                height: 'sm',
              },
              {
                type: 'button',
                action: {
                  type: 'postback',
                  label: 'Twitter',
                  data: 'TwitterHELP',
                },
                height: 'sm',
              },
            ],
          },
        },
      };
      break;
    }

    case 'リポジトリ': {
      // 返信するメッセージを作成
      message = {
        type: 'flex',
        altText: 'Flex Message',
        contents: {
          type: 'bubble',
          header: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: 'github リポジトリ',
                size: 'xxl',
                color: '#000000',
              },
              {
                type: 'text',
                text: 'リポジトリのページに遷移します。ぜひPRをお願いします!!!',
                wrap: true,
                color: '#222222',
              },
            ],
            margin: 'none',
            backgroundColor: '#f0fff0',
          },
          body: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'button',
                action: {
                  type: 'uri',
                  label: 'https://github.com/Riku58/MAI-TANNI',
                  uri: 'https://github.com/Riku58/MAI-TANNI',
                },
                height: 'sm',
              },
            ],
          },
        },
      };
      break;
    }

    case 'Twitter': {
      // 返信するメッセージを作成
      message = {
        type: 'flex',
        altText: 'Flex Message',
        contents: {
          type: 'carousel',
          contents: [
            {
              type: 'bubble',
              size: 'nano',
              header: {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'image',
                    url: 'https://scdn.line-apps.com/n/channel_devcenter/img/fx/01_1_cafe.png',
                    offsetTop: 'none',
                    margin: 'none',
                    size: 'full',
                  },
                  {
                    type: 'text',
                    text: '野原',
                    color: '#000000',
                    align: 'start',
                    size: 'xl',
                    gravity: 'center',
                  },
                ],
                backgroundColor: '#f0fff0',
                paddingTop: '10px',
                paddingAll: '10px',
                paddingBottom: '0px',
              },
              body: {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'button',
                    action: {
                      type: 'uri',
                      label: 'Twitter',
                      uri: 'https://twitter.com',
                    },
                    style: 'primary',
                    color: '#87cefa',
                  },
                ],
                spacing: 'md',
                paddingAll: '12px',
              },
              styles: {
                footer: {
                  separator: false,
                },
              },
            },
            {
              type: 'bubble',
              size: 'nano',
              header: {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'image',
                    url: 'https://pbs.twimg.com/profile_images/1544238743053570049/tv86oN9E_400x400.jpg',
                    offsetTop: 'none',
                    margin: 'none',
                    size: 'full',
                  },
                  {
                    type: 'text',
                    text: '火狐',
                    color: '#000000',
                    align: 'start',
                    size: 'xl',
                    gravity: 'center',
                  },
                ],
                backgroundColor: '#f0fff0',
                paddingTop: '10px',
                paddingAll: '10px',
                paddingBottom: '0px',
              },
              body: {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'button',
                    action: {
                      type: 'uri',
                      label: 'Twitter',
                      uri: 'https://twitter.com/6_avb7',
                    },
                    style: 'primary',
                    color: '#87cefa',
                  },
                ],
                spacing: 'md',
                paddingAll: '12px',
              },
              styles: {
                footer: {
                  separator: false,
                },
              },
            },
            {
              type: 'bubble',
              size: 'nano',
              header: {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'image',
                    url: 'https://pbs.twimg.com/profile_images/1546893847648927744/uaN5WRad_400x400.jpg',
                    offsetTop: 'none',
                    margin: 'none',
                    size: 'full',
                  },
                  {
                    type: 'text',
                    text: 'neco;',
                    color: '#000000',
                    align: 'start',
                    size: 'xl',
                    gravity: 'center',
                  },
                ],
                backgroundColor: '#f0fff0',
                paddingTop: '10px',
                paddingAll: '10px',
                paddingBottom: '0px',
              },
              body: {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'button',
                    action: {
                      type: 'uri',
                      label: 'Twitter',
                      uri: 'https://twitter.com/ocen_UoA30C2',
                    },
                    style: 'primary',
                    color: '#87cefa',
                  },
                ],
                spacing: 'md',
                paddingAll: '12px',
              },
              styles: {
                footer: {
                  separator: false,
                },
              },
            },
            {
              type: 'bubble',
              size: 'nano',
              header: {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'image',
                    url: 'https://pbs.twimg.com/profile_images/1432405414839087105/BeegqoDL_400x400.jpg',
                    offsetTop: 'none',
                    margin: 'none',
                    size: 'full',
                  },
                  {
                    type: 'text',
                    text: 'sou7__',
                    color: '#000000',
                    align: 'start',
                    size: 'xl',
                    gravity: 'center',
                  },
                ],
                backgroundColor: '#f0fff0',
                paddingTop: '10px',
                paddingAll: '10px',
                paddingBottom: '0px',
              },
              body: {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'button',
                    action: {
                      type: 'uri',
                      label: 'Twitter',
                      uri: 'https://twitter.com/sou7___',
                    },
                    style: 'primary',
                    color: '#87cefa',
                  },
                ],
                spacing: 'md',
                paddingAll: '12px',
              },
              styles: {
                footer: {
                  separator: false,
                },
              },
            },
          ],
        }, // ここの{}をFlexMessage Simulatorで生成されたコードに置き換える
      };
      break;
    }

    case 'レビューの終了': {
      message = {
        type: 'text',
        text: 'レビューを終了します！',
      };
      initContext(lineID);
      break;
    }

    case '投稿の終了': {
      message = {
        type: 'text',
        text: '投稿機能を終了します！',
      };
      initContext(lineID);
      break;
    }

    case '編集の終了': {
      message = {
        type: 'text',
        text: '編集機能を終了します！',
      };
      initContext(lineID);
      break;
    }

    case '削除の終了': {
      message = {
        type: 'text',
        text: '削除機能を終了します！',
      };
      initContext(lineID);
      break;
    }

    case 'reviewsからselectする処理はじめ': {
      const res = await lecturesList();
      pool.query({
        text: 'UPDATE users SET context = $1 WHERE lineid = $2;',
        values: ['commentreview', lineID],
      });
      res.push({
        type: 'text',
        text: 'どの講義の口コミを参照しますか。講義コードを送信してください。\n例: FU03',
      });
      return res;
    }
    case 'reviewsにinsertする処理はじめ': {
      const res = await lecturesList();
      pool.query({
        text: 'UPDATE users SET context = $1 WHERE lineid = $2',
        values: ['commentpush', lineID],
      });
      res.push({
        type: 'text',
        text: 'どの講義への口コミを投稿しますか。以下の形式で評価を送信して下さい。\n形式: 講義コード コメント 評価スコア(0~5)\n例1: MA02 明らかに楽しい 5',
      });
      return res;
    }
    case 'reviewsにupdateする処理はじめ': {
      if ((await nunmOfMyComments(lineID)) === '0') {
        return {
          type: 'text',
          text: 'あなたが投稿したコメントは存在しないようです',
        };
      }
      pool.query({
        text: 'UPDATE users SET context = $1 WHERE lineid = $2',
        values: ['commentupdata', lineID],
      });
      message = [{
        type: 'flex',
        altText: 'Flex Message',
        contents: await myCommentList(lineID),
      },
      {
        type: 'text',
        text: 'どのコメントを修正しますか。以下の形式で送信してください。\n形式: コメント番号 評価スコア(0~5) コメント\n例1: 1 5 本質的に明らかに楽しい',
      }];
      return message;
    }
    case 'reviewsにdeleteする処理はじめ': {
      if ((await nunmOfMyComments(lineID)) === '0') {
        return {
          type: 'text',
          text: 'あなたが投稿したコメントは存在しないようです',
        };
      }
      pool.query({
        text: 'UPDATE users SET context = $1 WHERE lineid = $2',
        values: ['commentdelete', lineID],
      });
      message = [{
        type: 'flex',
        altText: 'Flex Message',
        contents: await myCommentList(lineID),
      },
      {
        type: 'text',
        text: 'どのコメントを削除しますか。以下の形式で送信してください。\n形式: コメント番号\n例1: 1\n例2: 8',
      }];
      return message;
    }
    case '講義について': {
      message = {
        type: 'flex',
        altText: 'Flex Message',
        contents: {
          type: 'bubble',
          header: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: '講義について\n機能一覧',
                size: 'xxl',
                wrap: true,
                color: '#000000',
              },
              {
                type: 'text',
                text: '使いたい機能の項目をタップしてください',
                wrap: true,
                color: '#222222',
              },
            ],
            margin: 'none',
            backgroundColor: '#f0fff0',
          },
          body: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'button',
                action: {
                  type: 'postback',
                  label: '講義の評価を見る',
                  data: 'reviewsからselectする処理はじめ',
                },
                height: 'sm',
              },
              {
                type: 'button',
                action: {
                  type: 'postback',
                  label: '講義の評価を投稿する',
                  data: 'reviewsにinsertする処理はじめ',
                },
                height: 'sm',
              },
              {
                type: 'button',
                action: {
                  type: 'postback',
                  label: '自分の投稿を編集する',
                  data: 'reviewsにupdateする処理はじめ',
                },
                height: 'sm',
              },
              {
                type: 'button',
                action: {
                  type: 'postback',
                  label: '自分の投稿を削除する',
                  data: 'reviewsにdeleteする処理はじめ',
                },
                height: 'sm',
              },
            ],
          },
        },
      };
      break;
    }
    case '開発中1': {
      message = {
        type: 'text',
        text: '実装をお待ちください!',
      };
      break;
    }
    case '開発中2': {
      message = {
        type: 'text',
        text: '実装をお待ちください!',
      };
      break;
    }

    case 'リスト取得HELP': {
      message = {
        type: 'flex',
        altText: 'Flex Message',
        contents: {
          type: 'bubble',
          header: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: 'HELP: リスト取得',
                wrap: true,
                size: 'xl',
              },
            ],
            backgroundColor: '#f0fff0',
          },
          body: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: '直近７日の予定を表示します',
                wrap: true,
              },
            ],
            offsetTop: 'none',
            offsetBottom: 'none',
            paddingAll: 'lg',
            paddingTop: 'lg',
          },
        },
      };
      break;
    }
    case '項目追加HELP': {
      message = {
        type: 'flex',
        altText: 'Flex Message',
        contents: {
          type: 'bubble',
          header: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: 'HELP: 項目追加',
                wrap: true,
                size: 'xl',
              },
            ],
            backgroundColor: '#f0fff0',
          },
          body: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: '予定を追加できます',
                wrap: true,
              },
            ],
            offsetTop: 'none',
            offsetBottom: 'none',
            paddingAll: 'lg',
            paddingTop: 'lg',
          },
        },
      };
      break;
    }
    case 'カレンダー登録HELP': {
      message = {
        type: 'flex',
        altText: 'Flex Message',
        contents: {
          type: 'bubble',
          header: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: 'HELP: カレンダー登録',
                wrap: true,
                size: 'xl',
              },
            ],
            backgroundColor: '#f0fff0',
          },
          body: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: 'リスト取得に使うカレンダーを登録できます',
                wrap: true,
              },
              {
                type: 'separator',
                margin: 'lg',
              },
              {
                type: 'text',
                text: '1. LMSにアクセス',
                wrap: true,
                offsetTop: 'none',
              },
              {
                type: 'text',
                text: '2. 左上のメニューから"カレンダー"をタップ',
                wrap: true,
              },
              {
                type: 'text',
                text: '3. "カレンダーをエクスポートする"をタップ',
                wrap: true,
              },
              {
                type: 'text',
                text: '4. URLを取得',
                wrap: true,
              },
              {
                type: 'text',
                text: '5. BOTの"カレンダー登録"をタップ',
                wrap: true,
              },
              {
                type: 'text',
                text: '6. URLをペーストして送信',
                wrap: true,
              },
            ],
            offsetTop: 'none',
            offsetBottom: 'none',
            paddingAll: 'lg',
            paddingTop: 'lg',
          },
        },
      };
      break;
    }
    case '項目削除HELP': {
      message = {
        type: 'flex',
        altText: 'Flex Message',
        contents: {
          type: 'bubble',
          header: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: 'HELP: 項目削除',
                wrap: true,
                size: 'xl',
              },
            ],
            backgroundColor: '#f0fff0',
          },
          body: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: '選択した内容をリストから削除できます',
                wrap: true,
              },
            ],
            offsetTop: 'none',
            offsetBottom: 'none',
            paddingAll: 'lg',
            paddingTop: 'lg',
          },
        },
      };
      break;
    }
    case 'その他HELP': {
      message = {
        type: 'flex',
        altText: 'Flex Message',
        contents: {
          type: 'bubble',
          header: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: 'HELP: その他',
                wrap: true,
                size: 'xl',
              },
            ],
            backgroundColor: '#f0fff0',
          },
          body: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: '追加された機能を使用することができます',
                wrap: true,
              },
            ],
            offsetTop: 'none',
            offsetBottom: 'none',
            paddingAll: 'lg',
            paddingTop: 'lg',
          },
        },
      };
      break;
    }
    case 'リポジトリHELP': {
      message = {
        type: 'flex',
        altText: 'Flex Message',
        contents: {
          type: 'bubble',
          header: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: 'HELP: リポジトリ',
                wrap: true,
                size: 'xl',
              },
            ],
            backgroundColor: '#f0fff0',
          },
          body: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: 'このLINEBOTのコードを見ることができます',
                wrap: true,
              },
            ],
            offsetTop: 'none',
            offsetBottom: 'none',
            paddingAll: 'lg',
            paddingTop: 'lg',
          },
        },
      };
      break;
    }
    case 'TwitterHELP': {
      message = {
        type: 'flex',
        altText: 'Flex Message',
        contents: {
          type: 'bubble',
          header: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: 'HELP: Twitter',
                wrap: true,
                size: 'xl',
              },
            ],
            backgroundColor: '#f0fff0',
          },
          body: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: '開発者&メンターのTwitterにアクセスできます',
                wrap: true,
              },
            ],
            offsetTop: 'none',
            offsetBottom: 'none',
            paddingAll: 'lg',
            paddingTop: 'lg',
          },
        },
      };
      break;
    }
    default: break;
  }
  return message;
};
// ポストバックイベントが飛んできた時
export default async (event) => {
  const lineID = event.source.userId;
  // ポストバックデータをpostbackDataに格納
  const postbackData = event.postback.data;
  return tmp(postbackData, lineID);
};
