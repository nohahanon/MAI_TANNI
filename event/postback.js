import Pool from 'pg-pool';

const pool = new Pool({
  user: process.env.pgUser,
  host: process.env.pgHost,
  database: process.env.pgDatabase,
  password: process.env.pgPassWord,
  port: process.env.pgPort,
});

async function displayLecturesList() {
  const res = await pool.query({
    text: 'SELECT * FROM lectures;',
  });
  let buf = '';
  for (let i = 0; i < res.rows.length; i += 1)buf += `${res.rows[i].code.trim()}: ${res.rows[i].name.trim()}\n`;
  return buf;
}
const tmp = async (postbackData, lineID) => {
  let message;
  switch (postbackData) {
    // 'リスト取得'というメッセージが送られてきた時
    case 'リスト取得': {
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

    case '項目追加': {
      message = {
        type: 'text',
        text: '項目追加',
      };
      break;
    }

    case 'カレンダー登録': {
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

    case '項目削除': {
      message = {
        type: 'text',
        text: '項目削除',
      };
      break;
    }

    case 'その他': {
      message = {
        type: 'text',
        text: 'coming soon',
      };
      break;
    }

    case 'HELP': {
      // 返信するメッセージを作成
      message = {
        type: 'text',
        text: 'どのHELPを読みますか？',
        quickReply: {
          items: [
            {
              type: 'action',
              action: {
                type: 'postback',
                data: 'リスト取得HELP',
                label: 'リスト取得',
              },
            },
            {
              type: 'action',
              action: {
                type: 'postback',
                data: '項目追加HELP',
                label: '項目追加',
              },
            },
            {
              type: 'action',
              action: {
                type: 'postback',
                data: 'カレンダー登録HELP',
                label: 'カレンダー登録',
              },
            },
            {
              type: 'action',
              action: {
                type: 'postback',
                data: '項目削除HELP',
                label: '項目削除',
              },
            },
            {
              type: 'action',
              action: {
                type: 'postback',
                data: 'その他HELP',
                label: 'その他',
              },
            },
            {
              type: 'action',
              action: {
                type: 'postback',
                data: 'リポジトリHELP',
                label: 'リポジトリ',
              },
            },
            {
              type: 'action',
              action: {
                type: 'postback',
                data: 'TwitterHELP',
                label: 'Twitter',
              },
            },
          ],
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

    case '講義の口コミ': {
      const res = await displayLecturesList();
      pool.query({
        text: 'UPDATE users SET context = $1 WHERE lineid = $2;',
        values: ['reviewStep1', lineID],
      });
      return {
        type: 'text',
        text: `${res}\n\nどの講義の口コミを参照しますか。講義コードを送信してください。例: FU03`,
      };
    }
    case '口コミを投稿する': {
      message = {
        type: 'text',
        text: 'どの講義への口コミを投稿しますか',
      };
      break;
    }
    case '自分の投稿を編集する': {
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
                label: '講義の口コミ',
                data: '講義の口コミ',
              },
            },
            {
              type: 'action',
              action: {
                type: 'postback',
                label: '口コミを投稿する',
                data: '口コミを投稿する',
              },
            },
            {
              type: 'action',
              action: {
                type: 'postback',
                label: '自分の投稿を編集する',
                data: '自分の投稿を編集する',
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
