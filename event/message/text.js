/* eslint-disable linebreak-style */
import axios from 'axios';
import ical from 'ical';
import Pool from 'pg-pool';

const pool = new Pool({
  user: process.env.pgUser,
  host: process.env.pgHost,
  database: process.env.pgDatabase,
  password: process.env.pgPassWord,
  port: process.env.pgPort,
});

function initContext(lineID) {
  pool.query({
    text: 'UPDATE users SET context = null WHERE lineid = $1;',
    values: [lineID],
  });
}

function convertZuluToJST(zulu) {
  const date = JSON.stringify(zulu).split('T');
  const date1 = date[0].slice(1);
  const date2 = date[1].split('.')[0];
  const date3 = date2.split(':');
  const date4 = (Number(JSON.stringify(date3[0]).slice(1, -1)) + 9) % 24;
  return `${date1} ${date4}:${date3[1]}:${date3[2]}`;
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

async function displayCommentList(lectureid) {
  const res = await pool.query({
    text: 'SELECT comment FROM reviews WHERE lecturecode = $1',
    values: [lectureid],
  });
  let buf = '';
  for (let i = 0; i < res.rows.length; i += 1)buf += `${res.rows[i].comment.trim()}\n\n`;
  return buf;
}

// テキストメッセージの処理をする関数
export const textEvent = async (event, client) => {
  // lineIDの取得
  const lineID = event.source.userId;

  const context = await pool.query({
    text: 'SELECT context FROM users WHERE lineID = $1;',
    values: [lineID],
  });

  const urlSample = /^https:\/\/elms.u-aizu.ac.jp\/calendar\/export_execute.php\?userid\=/;
  try {
    switch (await context.rows[0].context) {
      case 'commentdelete': {
        const data = event.message.text.trim();
        if (!Number.isNaN(Number.parseInt(data, 10))) {
          pool.query({
            text: 'DELETE FROM reviews WHERE reviewid = (SELECT reviewid FROM reviews WHERE userid = $2 LIMIT 1 OFFSET $1);',
            values: [Number.parseInt(data, 10) - 1, lineID],
          });
          return {
            type: 'text',
            text: '削除しました',
          };
        }
        return {
          type: 'text',
          text: 'はじめからやりなおしてください',
        };
      }
      case 'commentupdata': {
        const data = event.message.text.trim().split(' ');
        if (data.length === 3
          && Number.isInteger(Number.parseInt(data[0], 10))
          && data[2].length <= 200
          && Number.isInteger(Number.parseInt(data[1], 10))
          && data[1] <= 5
          && data[1] >= 0) {
          pool.query({
            text: 'UPDATE reviews SET (comment, evaluationscore) = ($3, $4) WHERE reviewid = (SELECT reviewid FROM reviews WHERE userid = $1 LIMIT 1 OFFSET $2)',
            values:
              [lineID, Number.parseInt(data[0], 10) - 1, data[2], Number.parseInt(data[1], 10)],
          });
          return {
            type: 'text',
            text: '更新しました',
          };
        }
        return {
          type: 'text',
          text: 'はじめからやりなおしてください',
        };
      }
      case 'commentpush': {
        try {
          const data = event.message.text.trim().split(' ');
          if (data.length === 3
            && data[0].length <= 8
            && data[1].length <= 200
            && parseInt(data[2], 10) >= 0
            && parseInt(data[2], 10) <= 5) {
            await pool.query({
              text: 'INSERT INTO reviews (userid, comment, lecturecode, evaluationscore) VALUES ($1, $3, $2, $4);',
              values: [lineID, data[0], data[1], data[2]],
            });
            return {
              type: 'text',
              text: '評価を追加しました',
            };
          }
          return {
            type: 'text',
            text: 'はじめからやりなおしてください(一つの講義に対して一つの投稿しかできません！)',
          };
        } catch (err) {
          return {
            type: 'text',
            text: 'はじめからやりなおしてください(一つの講義に対して一つの投稿しかできません！)',
          };
        }
      }
      case 'push': {
        if (urlSample.test(event.message.text)) {
          pool.query({
            text: 'UPDATE users SET url = $1 WHERE lineID = $2;',
            values: [event.message.text, lineID],
          });
          processCalender(event.message.text, lineID);
          return {
            type: 'text',
            text: 'URLを更新しました',
          };
        }
        return {
          type: 'text',
          text: 'はじめからやりなおしてください',
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
          text: 'はじめからやりなおしてください',
        };
      }
      case 'add': {
        pool.query({
          text: 'INSERT INTO submissions (lectureCode, deadline, name, lineid) VALUES ($1, CURRENT_TIMESTAMP + \'7 day\', $2, $3);',
          values: ['MYTASK', event.message.text, lineID],
        });
        return {
          type: 'text',
          text: 'タスクを追加しました',
        };
      }
      case 'commentreview': {
        const lectureCodeCriteria = 8;
        const buf = await displayCommentList(event.message.text);
        if (buf !== '' && event.message.text.length <= lectureCodeCriteria) {
          return {
            type: 'text',
            text: `${buf}`,
          };
        }
        return {
          type: 'text',
          text: 'はじめからやりなおしてください',
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

  // メッセージのテキストごとに条件分岐
  switch (event.message.text) {
    case 'insertTolectures': {
      const dt = ['HS04 言語学',
        'HS05 文学',
        'HS06 芸術学',
        'HS07 ジェンダー・セクシュアリティ論',
        'HS09 法学',
        'HS10 経済学',
        'HS11 社会学',
        'HS12 日本国憲法',
        'HS13 国際関係論',
        'HS16 保健体育理論',
        'HS17 科学史',
        'HS19 会津の歴史と文化',
        'HS20 アカデミックスキル１',
        'HS21 アカデミックスキル２',
        'HS22 地域社会学',
        'HS23 経済発展論',
        'PA01 体育実技１',
        'PA02 体育実技２',
        'PA03 体育実技３',
        'PA04 体育実技４',
        'EN01 Introductory English 1',
        'EN02 Introductory English 2',
        'EN03 Bridge 1 to Intermediate English',
        'EN04 Bridge 2 to Intermediate English',
        'EN05 Intermediate English 1',
        'EN06 Intermediate English 2',
        'EN07 Advanced English',
        'EN08 Thesis Writing and Presentation',
        'EG101 Global Experience Gateway (RHIT)',
        'EG102 Global Experience Gateway (Waikato)',
        'JP01 初級日本語 I [留学生対象]',
        'JP02 初級日本語 II [留学生対象]',
        'JP03 中級日本語 I [留学生対象]',
        'JP04 中級日本語 II [留学生対象]',
        'JP05 上級日本語 I [留学生対象]',
        'JP06 上級日本語 II [留学生対象]',
        'JP07 ビジネス日本語 [留学生対象]',
        'EL102 Design of Human Languages',
        'EL115 Analysis of English Sentence Structure',
        'EL131 Language and Linguistics',
        'EL134 High Frequency Vocabulary',
        'EL144 Conversation Analysis and the Pragmatics of Spoken Interaction',
        'EL146 Corpus Linguistics for Language Learners',
        'EL152 Reading Fluency',
        'EL154 SDGs で学ぶ英語ディスカッション',
        'EL155 Notetaking and Listening Skills for Academic Lectures in English',
        'EL218 English Speaking and Presentation Skills',
        'EL222 Business Writing and Presentations',
        'EL244 An Introduction to Cross-cultural Communication',
        'EL247 Second Language Acquisition Methods',
        'EL248 Visualization and Storytelling in Data Science',
        'EL314 Experimental Methods and Statistics for Linguistics',
        'EL315 Design and Analysis for IT Business',
        'EL317 Patterns and language',
        'EL318 ICT in Education',
        'EL321 Pronunciation: Acoustic Analysis Using Software',
        'EL329 Critical Thinking',
        'EL330 Computer Science Vocabulary',
        'EL331 Authorship analysis using Python',
        'MA01 線形代数 I',
        'MA02 線形代数 II',
        'MA03 微積分 I',
        'MA04 微積分 II',
        'MA05 フーリエ解析',
        'MA06 複素関数論',
        'MA07 確率統計学',
        'MA08 応用代数',
        'MA09 数理論理学',
        'MA10 位相幾何学概論',
        'NS01 力学',
        'NS02 電磁気学',
        'NS03 量子力学',
        'NS04 半導体デバイス',
        'NS05 熱・統計力学',
        'LI01 コンピュータリテラシー',
        'LI03 コンピュータ理工学のすすめ',
        'LI04 コンピュータシステム概論',
        'LI06 情報セキュリティ',
        'LI07 情報と職業',
        'LI08 情報倫理',
        'LI09 システム開発とプロジェクトマネジメントの基礎',
        'LI10 マルチメディアシステム概論',
        'LI11 コンピュータネットワーク概論',
        'LI12 創造力開発スタジオ',
        'LI13 コンピュータ理工学演習 I',
        'LI14 コンピュータ理工学演習 II',
        'PL01 プログラミング入門',
        'PL02 プログラミングC',
        'PL03 プログラミングJAVA I',
        'PL04 プログラミングC++',
        'PL05 コンピュータ言語論',
        'PL06 プログラミングJAVA II',
        'FU01 アルゴリズムとデータ構造 I',
        'FU02 情報理論と圧縮',
        'FU03 離散系論',
        'FU04 論理回路設計論',
        'FU05 コンピュータアーキテクチャ論',
        'FU06 オペレーティングシステム論',
        'FU08 オートマトンと言語理論',
        'FU09 アルゴリズムとデータ構造 II',
        'FU10 言語処理系論',
        'FU11 数値解析',
        'FU14 ソフトウェア工学概論',
        'FU15 データマネジメント概論',
        'SY02 電子回路',
        'SY04 組込みシステム',
        'SY05 並列コンピュータシステム',
        'SY06 VLSI設計技術',
        'SY07 論理回路設計特論',
        'CN02 ネットワークセキュリティ',
        'CN03 ネットワークプログラミング',
        'CN04 ワイヤレスネットワーク',
        'CN05 コンピュータネットワークシステムのモデリングとシミュレーション',
        'IT01 人工知能',
        'IT02 コンピュータグラフィックス論',
        'IT03 画像処理論',
        'IT05 ロボット工学と自動制御',
        'IT06 ヒューマンインターフェイスと仮想現実',
        'IT08 信号処理と線形システム',
        'IT09 音響音声処理論',
        'IT10 ビジュアルコンピューティングのための幾何学',
        'IT11 情報検索と自然言語処理',
        'SE01 ウェブエンジニアリング',
        'SE04 ソフトウェア工学特論',
        'SE05 ソフトウェアスタジオ',
        'SE06 並列分散コンピューティング',
        'SE07 データベースシステム論',
        'SE08 データマイニング概論 [SE-DE]',
        'OT01-I ベンチャー基本コース各論 I',
        'OT01-II ベンチャー基本コース各論 II',
        'OT02-1 ベンチャー体験工房 1',
        'OT02-2 ベンチャー体験工房 2',
        'OT02-3 ベンチャー体験工房 3',
        'OT02-4 ベンチャー体験工房 4',
        'OT02-5 ベンチャー体験工房 5',
        'OT02-6 ベンチャー体験工房 6',
        'OT02-9 ベンチャー体験工房 9',
        'OT04 情報処理試験対策講座',
        'OT05 キャリアデザインI',
        'OT06 キャリアデザインII',
        'OT08 TOEIC準備コース',
        'OT09 課外活動コース I＜インターンシップIII（シリコンバレーC）＞',
        'OT10 課外活動コース II＜インターンシップIII＞',
        'OT11 ICTベンチャー起業と経営',
        'TE01 教師入門',
        'TE02 教育入門',
        'TE03 教育心理学',
        'TE04 教育課程論',
        'TE05 教育方法',
        'TE06 数学科教育法１',
        'TE07 数学科教育法２',
        'TE08 数学科教育法３',
        'TE09 数学科教育法４',
        'TE10 情報科教育法１',
        'TE11 情報科教育法２',
        'TE12 道徳教育',
        'TE13 特別活動',
        'TE14 生徒指導・教育相談',
        'TE15 キャリア教育',
        'TE16 教育実習１',
        'TE17 教育実習２',
        'TE18 教育実習事前事後指導',
        'TE19 教育制度論',
        'TE20 教職実践演習（中・高）',
        'TE21 特別支援教育入門',
        'TE22 総合的な学習の時間の指導法',
        'TE23 情報機器の活用に関する理論と方法',
        'IE01 システム総合演習 I',
        'IE02 システム総合演習 II',
        'IE03 ソフトウェア総合演習 I',
        'IE04 ソフトウェア総合演習 II',
        'OT03-001 大規模分散Webインフラ構築入門',
        'OT03-002 学内生活を便利にするアプリケーション・サービスを作ろう',
        'OT03-003 AI・ロボットと倫理',
        'OT03-004 月惑星データ解析＆国際宇宙ステーションたんぽぽプロジェクト',
        'OT03-005 教師になろう！',
        'OT03-006 機械学習技術の紹介とレコメンダーシステムへの応用',
        'OT03-007 Observable (D3.js)を用いた情報可視化プロトタイピング',
        'OT03-008 韓国語と韓国文化',
        'OT03-009 社会調査とICTによる地域サポートプロジェクト',
        'OT03-010 課題解決型プロジェクト入門 - 理工系学生のための異文化理解及び地域イノベーション -',
        'OT03-011 論理的思考、批判的思考(クリティカルシンキング)',
        'OT03-012 Human Body Motion Analysis Project',
        'OT03-013 競技用ロボットの開発',
        'OT03-014 コンピュータを使った音と映像のコンテンツ制作',
        'OT03-015 A Peek Inside Computers',
        'OT03-016 会津ならではのスポーツ活動',
        'OT03-017 電子工作プロジェクト',
        'OT03-018 マナビーノ Arduino/Pi',
        'OT03-019 夏季 海外準備のための英語体験プログラム',
        'OT03-020 Designing Air Pollution Analytical Framework for SORAMAME',
        'OT03-021 Computer Modeling in Biomedical Engineering',
        'OT03-022 自分で作ったAI回路を動かそう！！',
        'OT03-023 Advanced Pattern Recognition and Software Development',
        'OT03-024 Korean IT and Culture Study',
        'OT03-025 ソフトなハード「FPGA」を使ったLSI設計の基礎',
        'OT03-026 コンピュータを使ってプログラムや理論の正しさを証明しよう',
        'OT03-027 SNSを活用する地域ブランディングの方法についての研究',
        'OT03-028 競技プログラミング',
        'OT03-029 実践的プログラミング',
        'OT03-030 スポーツ×ICTに関わるウェアラブルセンサーの制作',
        'OT03-031 Meaning Expression in the English Language',
        'OT03-032 ミクロな世界の回路を描いてみよう -EDAツールを用いた回路設計入門-'];
      for (let i = 0; i < dt.length; i += 1) {
        let buf = '';
        for (let j = 1; j < dt[i].split(' ').length; j += 1) {
          buf += dt[i].split(' ')[j];
        }
        pool.query({
          text: 'INSERT INTO lectures (code, name) VALUES ($1, $2);',
          values: [dt[i].split(' ')[0], buf],
        });
      }
      break;
    }
    // 'おはよう'というメッセージが送られてきた時
    case 'おはよう': {
      // 返信するメッセージを作成
      message = { type: 'text', text: 'おはよう' };
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
