/* eslint-disable linebreak-style */
import Pool from 'pg-pool';

const pool = new Pool({
  user: process.env.pgUser,
  host: process.env.pgHost,
  database: process.env.pgDatabase,
  password: process.env.pgPassWord,
  port: process.env.pgPort,
});

async function repeatSelect() {
  const res = await pool.query({
    text: 'SELECT * FROM submissions WHERE deadline BETWEEN now() AND now() + interval \'7 day\';',
  });
  console.log(res);
  let buf = '';
  for (let i = 1; i <= res.rows.length; i += 1)buf += `${i}: ${res.rows[i - 1].lecturecode.trim()}\n${res.rows[i - 1].name}\n`;
  return {
    type: 'text',
    text: `${buf}`,
  };
}

function repeatDelete() {
  pool.query({
    text: 'DELETE FROM submissions WHERE deadline < now();',
  });
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

async function numOfComments(lineID) {
  const res = await pool.query({
    text: 'SELECT COUNT(*) FROM reviews WHERE userid = $1',
    values: [lineID],
  });
  return res.rows[0].count;
}

async function displayLecturesList() {
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
    resOther.rows.map((t, i) => subFuncFlex(t, i + resMyTask.rows.length, boxForLecture)),
  ));
  return model;
}

async function displayCommentListFlex(lineID) {
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
  let boxChildClone = JSON.parse(JSON.stringify(boxChilde));
  boxChildClone.contents[0].text = 'コメント番号';
  boxChildClone.contents[2].text = '評価スコア';
  boxChildClone.contents[4].text = '講義コード';
  boxChildClone.contents[6].text = 'コメント';
  boxParent.body.contents.splice(2, 0, boxChildClone);
  for (let i = 0; i < res.rows.length; i += 1) {
    boxChildClone = JSON.parse(JSON.stringify(boxChilde));
    boxChildClone.contents[0].text = res.rows[i].reviewid.toString();
    boxChildClone.contents[2].text = res.rows[i].evaluationscore.toString();
    boxChildClone.contents[4].text = res.rows[i].lecturecode.trim();
    boxChildClone.contents[6].text = res.rows[i].comment.trim();
    boxParent.body.contents[3].contents.push(boxChildClone);
  }
  return boxParent;
}

const tmp = async (postbackData, lineID) => {
  let message;

  switch (postbackData) {
    case '定期表示': {
      message = await repeatSelect();
      break;
    }
    case '定期削除': {
      repeatDelete();
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
        message = [
          {
            type: 'flex',
            altText: 'Flex Message',
            contents: await displaySubmissionListFlex(lineID),
          },
          {
            type: 'text',
            text: '削除したいレコード番号を指定してください',
          }];
        console.log(message);
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
        values: ['commentreview', lineID],
      });
      res.push({
        type: 'text',
        text: 'どの講義の口コミを参照しますか。講義コードを送信してください。\n例: FU03',
      });
      return res;
    }
    case 'reviewsにinsertする処理はじめ': {
      const res = await displayLecturesList();
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
      if ((await numOfComments(lineID)) === '0') {
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
        contents: await displayCommentListFlex(lineID),
      },
      {
        type: 'text',
        text: 'どのコメントを修正しますか。以下の形式で送信してください。\n形式: コメント番号 評価スコア(0~5) コメント\n例1: 1 本質的に明らかに楽しい 5',
      }];
      return message;
    }
    case 'reviewsにdeleteする処理はじめ': {
      if ((await numOfComments(lineID)) === '0') {
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
        contents: await displayCommentListFlex(lineID),
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

    // "wrap": true, でtextを自動改行
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
