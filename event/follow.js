// フォローイベントがとんできた時
export default () => {
  // 返信するメッセージを作成
  const message = {
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
            text: 'フォローありがとう\nございます',
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
            text: '初めての利用の方はメニュー2に\n移動後、HELPをお読みください',
            wrap: true,
          },
        ],
      },
    },
  };
  // 返信するメッセージをこの関数の呼び出し元（bot.js）に返す
  return message;
};
