import axios from 'axios';
import ical from 'ical';
import Pool from 'pg-pool';
/*
const pool = new Pool({
  user: process.env.pgUser,
  host: process.env.pgHost,
  database: process.env.pgDatabase,
  password: process.env.pgPassWord,
  port: process.env.pgPort,
});
*/
/*
async function numOfSubmissions(lineID) {
  const res = await pool.query({
    text: 'SELECT COUNT(*) FROM submissions WHERE lineid = $1;',
    values: [lineID],
  });
  return res.rows[0].count;
}
// data[].endに格納されている時間をsql用に成型します
function convertZuluToJST(zulu) {
  const date = JSON.stringify(zulu).split('T');
  const date1 = date[0].slice(1);
  const date2 = date[1].split('.')[0];
  const date3 = date2.split(':');
  const date4 = (Number(JSON.stringify(date3[0]).slice(1, -1)) + 9) % 24;
  return `${date1} ${date4}:${date3[1]}:${date3[2]}`;
}
// submissionsから一覧を取得して表示する文字列を返す関数
async function displaySubmissionList(lineID) {
  const res = await pool.query({
    text: 'SELECT name, lectureCode FROM submissions WHERE lineID = $1',
    values: [lineID],
  });
  let buf = '';
  for (let i = 1; i <= res.rows.length; i += 1)buf += `${i}: ${res.rows[i - 1].lecturecode.trim()}\n${res.rows[i - 1].name}\n`;
  return buf;
}

// urlからicsデータを取得しdbにinsertする関数
async function processCalender(url, lineID) {
  try {
    const response = await axios.get(url);
    // データ取得
    const data = Object.values(ical.parseICS(response.data));
    // insert処理
    // db(submissionsとUsersLectures)の更新
    for (let i = 0; i < data.length; i += 1) {
      // submissionの更新
      pool.query({
        text: 'INSERT INTO submissions (lectureCode, deadline, name, lineID) VALUES ($1, TO_TIMESTAMP($2, $3), $4, $5);',
        values: [data[i].categories[0].split('_')[0], convertZuluToJST(data[i].end), 'YYYY-MM-DD T1:MI:SS', data[i].summary, lineID],
      });
      // userslecturesの更新
      // 知らない組み合わせを得たら更新する
      pool.query({
        text: 'INSERT INTO UsersLectures SELECT $1, $2 WHERE NOT EXISTS (SELECT * FROM UsersLectures WHERE lineID = $1 AND lectureCode = $2)',
        values: [lineID, data[i].categories[0].split('_')[0]],
      });
    }
  } catch (err) { console.log(err); }
}
*/
// テキストメッセージの処理をする関数
export const textEvent = async (event, client) => {
  // lineIDの取得
  const lineID = event.source.userId;
  /*  const urlData = await pool.query({
      text: 'SELECT url FROM users WHERE lineid = $1;',
      values: [lineID],
    });
    */
  let message;
  /*
    // url更新処理
    // ユーザーのcontextを確認する。pushなら対応する。
    const context = await pool.query({
      text: 'SELECT context FROM users WHERE lineID = $1;',
      values: [lineID],
    });
    const urlSample = /^https:\/\/elms.u-aizu.ac.jp\/calendar\/export_execute.php\?userid\=/;
    try {
      switch (await context.rows[0].context) {
        case 'push': {
          if (urlSample.test(event.message.text)) {
            pool.query({
              text: 'UPDATE users SET (url, context) = ($1, $2) WHERE (lineID = $3);',
              values: [event.message.text, null, lineID],
            });
            return {
              type: 'text',
              text: 'URLを更新しました',
            };
          }
          return {
            type: 'text',
            text: 'URLを指定しなおしてください',
          };
        }
        case 'delete': {
          if (!Number.isNaN(event.message.text)) {
            pool.query({
              text: 'DELETE FROM submissions WHERE submissionid = (SELECT submissionid FROM submissions WHERE lineid = $1 LIMIT 1 OFFSET $2);',
              values: [lineID, event.message.text - 1],
            });
            pool.query({
              text: 'UPDATE users SET context = null WHERE lineid = $1;',
              values: [lineID],
            });
            return {
              type: 'text',
              text: 'レコードを削除しました',
            };
          }
          return {
            type: 'text',
            text: '数字を指定しなおしてください',
          };
        }
        case 'add': {
          pool.query({
            text: 'UPDATE users SET context = $1 WHERE lineID = $2;',
            values: [null, lineID],
          });
          // lectureCode, deadline, nameが必要
          pool.query({
            text: 'INSERT INTO submissions (lectureCode, deadline, name, lineid) VALUES ($1, CURRENT_TIMESTAMP + \'7 day\', $2, $3);',
            values: ['MYTASK', event.message.text, lineID],
          });
          return {
            type: 'text',
            text: 'タスクを追加しました',
          };
        }
        default: break;
      }
    } catch (err) { console.log(err); }
  */
  // メッセージのテキストごとに条件分岐
  switch (event.message.text) {
    // URLの取得
    /*
    case 'URL': {
      // URLを入力させる
      message = {
        type: 'text',
        text: 'URLを入力してください。',
      };
      pool.query({
        text: 'UPDATE users SET context = $1 WHERE lineid = $2;',
        values: ['push', lineID],
      });
      break;
    }
  
    // urlDataに受け取っているurl文字列が格納されているのでそれをpeocessCalender()に渡してinsertを実行する
    case 'データベーステスト': {
      processCalender(urlData.rows[0].url, lineID);
      break;
    }
    case 'データベース一覧表示テスト': {
      message = {
        type: 'text',
        text: await displaySubmissionList(lineID),
      };
      break;
    }
    // '締め切り'というメッセージが送られてきた時
    case 'リスト表示': {
      const res = await pool.query({
        text: 'SELECT * FROM submissions WHERE deadline BETWEEN now() AND now() + interval \'7 day\';',
      });
      console.log(res);
      let buf = '';
      for (let i = 1; i <= res.rows.length; i += 1)buf += `${i}: ${res.rows[i - 1].lecturecode.trim()}\n${res.rows[i - 1].name}\n`;
      message = {
        type: 'text',
        text: `${buf}`,
      };
      break;
    }
  
    // 期限切れの課題を削除（定期的）
    case '削除': {
      await pool.query({
        text: 'DELETE FROM submissions WHERE deadline < now();',
      });
      break;
    }
  
    case 'レコード削除テスト': {
      if ((await numOfSubmissions(lineID)) === '0') {
        return {
          type: 'text',
          text: 'レコードが存在しません',
        };
      }
      message = {
        type: 'text',
        text: `削除したいレコード番号を指定してください\n\n${await displaySubmissionList(lineID)}`,
      };
      pool.query({
        text: 'UPDATE users SET context = $1 WHERE lineid = $2;',
        values: ['delete', lineID],
      });
      break;
    }
    case 'レコード挿入テスト': {
      message = {
        type: 'text',
        text: 'レコードの内容を送信してください',
      };
      pool.query({
        text: 'UPDATE users SET context = $1 WHERE lineid = $2;',
        values: ['add', lineID],
      });
      break;
    }
  */
    // 'おはよう'というメッセージが送られてきた時
    // eslint-disable-next-line no-fallthrough
    case 'おはよう': {
      // 返信するメッセージを作成
      message = {
        type: 'text',
        text: '朝だよ。お布団が待ってる！',
      };
      break;
    }

    // 'こんにちは'というメッセージが送られてきた時
    case 'こんにちは': {
      // 返信するメッセージを作成
      message = {
        type: 'text',
        text: 'Hello, world',
      };
      break;
    }
    // 'こんばんは'というメッセージが送られてきた時
    case 'こんばんは': {
      // 返信するメッセージを作成
      message = {
        type: 'text',
        text: 'こんばんは〜',
      };
      break;
    }
    // '複数メッセージ'というメッセージが送られてきた時
    case '複数メッセージ': {
      // 返信するメッセージを作成
      message = [
        {
          type: 'text',
          text: 'Hello, user',
        },
        {
          type: 'text',
          text: 'May I help you?',
        },
      ];
      break;
    }
    // 'クイックリプライ'というメッセージが送られてきた時
    case 'クイックリプライ': {
      // 返信するメッセージを作成
      message = {
        type: 'text',
        text: 'クイックリプライ（以下のアクションはクイックリプライ専用で、他のメッセージタイプでは使用できません）',
        quickReply: {
          items: [
            {
              type: 'action',
              action: {
                type: 'camera',
                label: 'カメラを開く',
              },
            },
            {
              type: 'action',
              action: {
                type: 'cameraRoll',
                label: 'カメラロールを開く',
              },
            },
            {
              type: 'action',
              action: {
                type: 'location',
                label: '位置情報画面を開く',
              },
            },
          ],
        },
      };
      break;
    }
    // 'スタンプメッセージ'というメッセージが送られてきた時
    case 'スタンプメッセージ': {
      // 返信するメッセージを作成
      message = {
        type: 'sticker',
        packageId: '446',
        stickerId: '1988',
      };
      break;
    }
    // '画像メッセージ'というメッセージが送られてきた時
    case '画像メッセージ': {
      // 返信するメッセージを作成
      message = {
        type: 'image',
        originalContentUrl: 'https://shinbunbun.info/images/photos/7.jpeg',
        previewImageUrl: 'https://shinbunbun.info/images/photos/7.jpeg',
      };
      break;
    }
    // '音声メッセージ'というメッセージが送られてきた時
    case '音声メッセージ': {
      // 返信するメッセージを作成
      message = {
        type: 'audio',
        originalContentUrl:
          'https://github.com/shinbunbun/aizuhack-bot/blob/master/media/demo.m4a?raw=true',
        duration: 6000,
      };
      break;
    }
    // '動画メッセージ'というメッセージが送られてきた時
    case '動画メッセージ': {
      // 返信するメッセージを作成
      message = {
        type: 'video',
        originalContentUrl: 'https://github.com/shinbunbun/aizuhack-bot/blob/master/media/demo.mp4?raw=true',
        previewImageUrl: 'https://raw.githubusercontent.com/shinbunbun/aizuhack-bot/master/media/thumbnail.jpg?raw=true',
      };
      break;
    }
    // '位置情報メッセージ'というメッセージが送られてきた時
    case '位置情報メッセージ': {
      // 返信するメッセージを作成
      message = {
        type: 'location',
        title: 'my location',
        address: '〒160-0004 東京都新宿区四谷一丁目6番1号',
        latitude: 35.687574,
        longitude: 139.72922,
      };
      break;
    }
    // 'イメージマップメッセージ'というメッセージが送られてきた時
    case 'イメージマップメッセージ': {
      // イメージマップの画像の作成方法には細かい指定があります。参考→https://developers.line.biz/ja/reference/messaging-api/#imagemap-message
      message = [
        {
          type: 'imagemap',
          baseUrl:
            'https://github.com/shinbunbun/aizuhack-bot/blob/master/media/imagemap.png?raw=true',
          altText: 'This is an imagemap',
          baseSize: {
            width: 1686,
            height: 948,
          },
          actions: [
            {
              type: 'uri',
              area: {
                x: 590,
                y: 179,
                width: 511,
                height: 585,
              },
              linkUri: 'https://shinbunbun.info/about/',
            },
            {
              type: 'message',
              area: {
                x: 0,
                y: 0,
                width: 458,
                height: 948,
              },
              text: 'しんぶんぶん！！！',
            },
            {
              type: 'message',
              area: {
                x: 1230,
                y: 0,
                width: 456,
                height: 948,
              },
              text: 'しんぶんぶん！！！',
            },
          ],
        },
        {
          type: 'text',
          text: '画像の色々なところをタップしてみよう！',
        },
      ];
      break;
    }
    // 'ボタンテンプレート'というメッセージが送られてきた時
    case 'ボタンテンプレート': {
      // 返信するメッセージを作成
      message = {
        type: 'template',
        altText: 'ボタンテンプレート',
        template: {
          type: 'buttons',
          thumbnailImageUrl: 'https://shinbunbun.info/images/photos/7.jpeg',
          imageAspectRatio: 'rectangle',
          imageSize: 'cover',
          imageBackgroundColor: '#FFFFFF',
          title: 'ボタンテンプレート',
          text: 'ボタンだお',
          defaultAction: {
            type: 'uri',
            label: 'View detail',
            uri: 'https://shinbunbun.info/images/photos/',
          },
          actions: [
            {
              type: 'postback',
              label: 'ポストバックアクション',
              data: 'button-postback',
            },
            {
              type: 'message',
              label: 'メッセージアクション',
              text: 'button-message',
            },
            {
              type: 'uri',
              label: 'URIアクション',
              uri: 'https://shinbunbun.info/',
            },
            {
              type: 'datetimepicker',
              label: '日時選択アクション',
              data: 'button-date',
              mode: 'datetime',
              initial: '2021-06-01t00:00',
              max: '2022-12-31t23:59',
              min: '2021-06-01t00:00',
            },
          ],
        },
      };
      break;
    }
    // '確認テンプレート'というメッセージが送られてきた時
    case '確認テンプレート': {
      // 返信するメッセージを作成
      message = {
        type: 'template',
        altText: '確認テンプレート',
        template: {
          type: 'confirm',
          text: '確認テンプレート',
          actions: [
            {
              type: 'message',
              label: 'はい',
              text: 'yes',
            },
            {
              type: 'message',
              label: 'いいえ',
              text: 'no',
            },
          ],
        },
      };
      break;
    }
    // 'カルーセルテンプレート'というメッセージが送られてきた時
    case 'カルーセルテンプレート': {
      // 返信するメッセージを作成
      message = {
        type: 'template',
        altText: 'カルーセルテンプレート',
        template: {
          type: 'carousel',
          columns: [
            {
              thumbnailImageUrl: 'https://shinbunbun.info/images/photos/7.jpeg',
              imageBackgroundColor: '#FFFFFF',
              title: 'タイトル1',
              text: '説明1',
              defaultAction: {
                type: 'uri',
                label: 'View detail',
                uri: 'https://shinbunbun.info/',
              },
              actions: [
                {
                  type: 'postback',
                  label: 'ポストバック',
                  data: 'postback-carousel-1',
                },
                {
                  type: 'uri',
                  label: 'URIアクション',
                  uri: 'https://shinbunbun.info/',
                },
              ],
            },
            {
              thumbnailImageUrl:
                'https://shinbunbun.info/images/photos/10.jpeg',
              imageBackgroundColor: '#FFFFFF',
              title: 'タイトル2',
              text: '説明2',
              defaultAction: {
                type: 'uri',
                label: 'View detail',
                uri: 'https://shinbunbun.info/',
              },
              actions: [
                {
                  type: 'postback',
                  label: 'ポストバック',
                  data: 'postback-carousel-2',
                },
                {
                  type: 'uri',
                  label: 'URIアクション',
                  uri: 'https://shinbunbun.info/',
                },
              ],
            },
          ],
          imageAspectRatio: 'rectangle',
          imageSize: 'cover',
        },
      };
      break;
    }
    // '画像カルーセルテンプレート'というメッセージが送られてきた時
    case '画像カルーセルテンプレート': {
      // 返信するメッセージを作成
      message = {
        type: 'template',
        altText: '画像カルーセルテンプレート',
        template: {
          type: 'image_carousel',
          columns: [
            {
              imageUrl: 'https://shinbunbun.info/images/photos/4.jpeg',
              action: {
                type: 'postback',
                label: 'ポストバック',
                data: 'image-carousel-1',
              },
            },
            {
              imageUrl: 'https://shinbunbun.info/images/photos/5.jpeg',
              action: {
                type: 'message',
                label: 'メッセージ',
                text: 'いえい',
              },
            },
            {
              imageUrl: 'https://shinbunbun.info/images/photos/7.jpeg',
              action: {
                type: 'uri',
                label: 'URIアクション',
                uri: 'https://shinbunbun.info/',
              },
            },
          ],
        },
      };
      break;
    }
    // 'Flex Message'というメッセージが送られてきた時
    case 'Flex Message': {
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
                text: 'Flex Message',
                color: '#FFFFFF',
                weight: 'bold',
              },
            ],
          },
          hero: {
            type: 'image',
            url: 'https://pbs.twimg.com/profile_images/1236928986212478976/wDa51i9T_400x400.jpg',
            size: 'xl',
          },
          body: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: 'しんぶんぶん',
                size: 'xl',
                weight: 'bold',
                align: 'center',
              },
              {
                type: 'text',
                text: '会津大学学部一年',
                align: 'center',
              },
              {
                type: 'separator',
                margin: 'md',
              },
              {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'button',
                    action: {
                      type: 'uri',
                      label: 'ホームページ',
                      uri: 'https://shinbunbun.info/',
                    },
                    style: 'primary',
                    offsetBottom: '10px',
                  },
                  {
                    type: 'button',
                    action: {
                      type: 'uri',
                      label: 'Twitter',
                      uri: 'https://twitter.com/shinbunbun_',
                    },
                    style: 'primary',
                    color: '#1DA1F2',
                  },
                ],
                paddingTop: '10px',
              },
            ],
          },
          styles: {
            header: {
              backgroundColor: '#008282',
            },
          },
        },
      };
      break;
    }
    // 'プロフィール'というメッセージが送られてきた時
    case 'プロフィール': {
      // ユーザーのプロフィール情報を取得
      const profile = await client.getProfile(event.source.userId);
      // 返信するメッセージを作成
      message = {
        type: 'text',
        text: `あなたの名前: ${profile.displayName}\nユーザーID: ${profile.userId}\nプロフィール画像のURL: ${profile.pictureUrl}\nステータスメッセージ: ${profile.statusMessage}`,
      };
      break;
    }
    // 'ここはどこ'というメッセージが送られてきた時
    case 'ここはどこ': {
      // 送信元がユーザーとの個チャだった場合
      if (event.source.type === 'user') {
        // 返信するメッセージを作成
        message = {
          type: 'text',
          text: 'ここは個チャだよ！',
        };
        // 送信元がグループだった場合
      } else if (event.source.type === 'group') {
        // 返信するメッセージを作成
        message = {
          type: 'text',
          text: 'ここはグループだよ！',
        };
      }
      break;
    }
    // 上で条件分岐した以外のメッセージが送られてきた時
    default: {
      // 返信するメッセージを作成
      message = {
        type: 'text',
        text: `受け取ったメッセージ: ${event.message.text}\nそのメッセージの返信には対応してません...`,
      };
      break;
    }
  }
  return message;
};
