/* eslint-disable linebreak-style */
import Pool from 'pg-pool';

const pool = new Pool({
  user: process.env.pgUser,
  host: process.env.pgHost,
  database: process.env.pgDatabase,
  password: process.env.pgPassWord,
  port: process.env.pgPort,
});

// submissionsから一覧を取得して表示する文字列を返す関数
async function displaySubmissionList(lineID) {
  const res = await pool.query({
    text: 'SELECT name, lectureCode FROM submissions WHERE lineID = $1',
    values: [lineID],
  });
  let buf = '';
  for (let i = 1; i <= res.rows.length; i += 1)buf += `${i}: ${res.rows[i - 1].lecturecode.trim()}\n${res.rows[i - 1].name.trim()}\n`;
  return buf;
}

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

async function displayLecturesList() {
  const res = await pool.query({
    text: 'SELECT * FROM lectures;',
  });
  let buf = '';
  for (let i = 0; i < res.rows.length; i += 1)buf += `${res.rows[i].code.trim()}: ${res.rows[i].name.trim()}\n`;
  return buf;
}

// displaySubmissionListFlex()のためにオブジェクトに格納する文字列を成型します
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
    boxTmp.contents[0].text = `${idx + 1}:${vls.name.length.substr(0, zenkakuCriteria)}...`;
  } else if (!zenOrHan.test(vls.name) && vls.name.length > hankakuCriteria) {
    boxTmp.contents[0].text = `${idx + 1}:${vls.name.substr(0, hankakuCriteria)}...`;
  } else {
    boxTmp.contents[0].text = `${idx + 1}:${vls.name}`;
  }
  // lecturecodeが'MYTASK'の場合lecturesに聞いても何も返らないため、''を自力で代入する
  if (vls.lecturecode.trim() !== 'MYTASK') {
    boxTmp.contents[1].text = `${resLectureName.rows[0].name}`;
  }
  // console.log(boxTmp);
  // tar.push(boxTmp);
  return boxTmp;
}

// lineidをもとにsubmissionテーブルからタスクを取得してflex messageのcontentsに収まるオブジェクトを返します
async function displaySubmissionListFlex(lineID) {
  const resMyTask = await pool.query({
    text: 'SELECT name, lecturecode FROM submissions WHERE lineID = $1 AND lecturecode = \'MYTASK\'',
    values: [lineID],
  });
  const resOther = await pool.query({
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
      },
      {
        type: 'text',
        text: '',
        size: 'xxs',
        color: '#111111',
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
        flex: 0,
      },
    ],
  };
  const promises1 = await resMyTask.rows.map(async (vls, idx) => {
    model.body.contents[1].contents.push(await subFuncFlex(vls, idx, boxForMyTask));
  });
  const promises2 = await resOther.rows.map(async (vls, idx) => {
    model.body.contents[1].contents.push(await subFuncFlex(vls, idx, boxForLecture));
  });
  await Promise.all(promises1);
  model.body.contents[1].contents.push(separator);
  await Promise.all(promises2);
  console.log(model.body.contents[1].contents);
  return model;
}

const tmp = async (postbackData, lineID) => {
  let message;

  switch (postbackData) {
    case '定期表示': {
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
    case '定期削除': {
      pool.query({
        text: 'DELETE FROM submissions WHERE deadline < now();',
      });
      break;
    }
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
        contents: await displaySubmissionListFlex(lineID),
      };
      break;
    }

    case '項目追加': {
      message = {
        type: 'text',
        text: '追加するタスクを送信してください',
      };
      try {
        pool.query({
          text: 'UPDATE users SET context = $1 WHERE lineid = $2;',
          values: ['add', lineID],
        });
      } catch (err) {
        console.log(err);
        initContext(lineID);
      }
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
      try {
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
      } catch (err) {
        console.log(err);
        initContext(lineID);
      }
      break;
    }

    case 'その他': {
      message = {
        type: 'text',
        text: 'その他 機能一覧',
        quickReply: {
          items: [
            {
              type: 'action',
              action: {
                type: 'postback',
                label: '講義について',
                data: '講義について',
              },
            },
            {
              type: 'action',
              action: {
                type: 'postback',
                label: '開発中！',
                data: '開発中1',
              },
            },
            {
              type: 'action',
              action: {
                type: 'postback',
                label: '開発中！',
                data: '開発中2',
              },
            },
          ],
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
            backgroundColor: '#38572955',
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
          type: 'carousel',
          contents: [
            {
              type: 'bubble',
              size: 'giga',
              header: {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'text',
                    text: 'github',
                    color: '#FFFFFF',
                    align: 'start',
                    size: 'lg',
                    gravity: 'center',
                  },
                ],
                backgroundColor: '#171515',
                paddingTop: '19px',
                paddingAll: '12px',
                paddingBottom: '16px',
              },
              body: {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'button',
                    action: {
                      type: 'uri',
                      label: 'link',
                      uri: 'https://github.com/Riku58/MAI-TANNI/?openExternalBrowser=1',
                    },
                    style: 'secondary',
                    color: '#cccccc',
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
                    color: '#ffffff',
                    align: 'start',
                    size: 'xl',
                    gravity: 'center',
                  },
                ],
                backgroundColor: '#27ACB2',
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
                    color: '#00acee',
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
                    color: '#ffffff',
                    align: 'start',
                    size: 'xl',
                    gravity: 'center',
                  },
                ],
                backgroundColor: '#27ACB2',
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
                    color: '#00acee',
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
                    color: '#ffffff',
                    align: 'start',
                    size: 'xl',
                    gravity: 'center',
                  },
                ],
                backgroundColor: '#27ACB2',
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
                    color: '#00acee',
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
                    color: '#ffffff',
                    align: 'start',
                    size: 'xl',
                    gravity: 'center',
                  },
                ],
                backgroundColor: '#27ACB2',
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
                    color: '#00acee',
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

    case 'reviewsからselectする処理はじめ': {
      const res = await displayLecturesList();
      pool.query({
        text: 'UPDATE users SET context = $1 WHERE lineid = $2;',
        values: ['reviewStep1', lineID],
      });
      return {
        type: 'text',
        text: `${res}\n\nどの講義の口コミを参照しますか。講義コードを送信してください。\n例: FU03`,
      };
    }
    case 'reviewsにinsertする処理はじめ': {
      const res = await displayLecturesList();
      pool.query({
        text: 'UPDATE users SET context = $1 WHERE lineid = $2;',
        values: ['reviewStep1', lineID],
      });
      message = {
        type: 'text',
        text: `${res}どの講義への口コミを投稿しますか。以下の形式で評価を送信して下さい。\n形式: 講義コード コメント 評価スコア(0~5)\n例1: MA02 明らかに楽しい 5`,
      };
      pool.query({
        text: 'UPDATE users SET context = $1 WHERE lineid = $2',
        values: ['commentpush', lineID],
      });
      break;
    }
    case 'reviewsにupdateする処理はじめ': {
      message = {
        type: 'text',
        text: '開発中です!',
      };
      break;
    }

    case '講義について': {
      message = {
        type: 'text',
        text: '機能を選択してください',
        quickReply: {
          items: [
            {
              type: 'action',
              action: {
                type: 'postback',
                label: '講義の評価を見る',
                data: 'reviewsからselectする処理はじめ',
              },
            },
            {
              type: 'action',
              action: {
                type: 'postback',
                label: '講義の評価を投稿する',
                data: 'reviewsにinsertする処理はじめ',
              },
            },
            {
              type: 'action',
              action: {
                type: 'postback',
                label: '自分の投稿を編集する',
                data: 'reviewsにupdateする処理はじめ',
              },
            },
          ],
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
        type: 'text',
        text: '7日以内にある課題を表示します',
      };
      break;
    }
    case '項目追加HELP': {
      message = {
        type: 'text',
        text: '予定を追加できます',
      };
      break;
    }
    case 'カレンダー登録HELP': {
      message = {
        type: 'text',
        text: 'リスト取得に使うカレンダーを登録できます\n【使用方法】\n1.LMSにアクセス\n2.左上のメニューから"カレンダー"をクリック\n3."カレンダーをエクスポートする"をクリック\n4.URLを取得\n5.BOTの"カレンダー登録"をクリック\n6.URLをペースト',
      };
      break;
    }
    case '項目削除HELP': {
      message = {
        type: 'text',
        text: 'リストから予定を選択して消せます',
      };
      break;
    }
    case 'その他HELP': {
      message = {
        type: 'text',
        text: '今後機能が追加されるかも？\n開発チーム次第です',
      };
      break;
    }
    case 'リポジトリHELP': {
      message = {
        type: 'text',
        text: 'githubのリンクに飛べます',
      };
      break;
    }
    case 'TwitterHELP': {
      message = {
        type: 'text',
        text: '開発チーム&メンターのtwitterです',
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
