// ポストバックイベントが飛んできた時
export default (event) => {
  let message;
  // ポストバックデータをpostbackDataに格納
  const postbackData = event.postback.data;
  // もしevent.postback.paramsが存在する場合
  if (event.postback.params) {
    // 返信するメッセージを作成
    message = {
      type: 'text',
      text: `日時データを受け取りました！\ndata: ${postbackData}\ndatetime: ${event.postback.params.datetime}`,
    };
    // 存在しない場合
  } else {
    // 返信するメッセージを作成
    message = {
      type: 'text',
      text: `ポストバックデータを受け取りました！\ndata: ${postbackData}`,
    };
  }

  switch (postbackData) {
    case '講義の口コミ': {
      message = {
        type: 'text',
        text: '講義の口コミ',
      };
      break;
    }
    case '口コミを投稿する': {
      message = {
        type: 'text',
        text: '口コミを投稿する',
      };
      break;
    }
    case '自分の投稿を編集する': {
      message = {
        type: 'text',
        text: '自分の投稿を編集する',
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
    default: break;
  }

  // 関数の呼び出し元（bot.jsのindex）に返信するメッセージを返す
  return message;
};
