const CDP = require('chrome-remote-interface');
async function run() {
  let client;
  try {
    client = await CDP({port: 9222});
    const {Runtime} = client;
    console.log('Connected to WebView!');
    const result = await Runtime.evaluate({
      expression: `
        (() => {
          // ReactのChat.jsx等で使用されているテキストエリア/インプットを探す
          const input = document.querySelector('input[type="text"]') || document.querySelector('textarea') || document.querySelector('input');
          if (!input) return 'Input not found';
          
          // 送信ボタンを探す (svgアイコンを持つボタン等)
          const btns = Array.from(document.querySelectorAll('button'));
          const btn = btns[btns.length - 1]; // 通常、最後のボタンが送信ボタン
          if (!btn) return 'Button not found';
          
          // Reactに認識させるため、ネイティブのsetterを使用する
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
          const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
          
          if (input.tagName === 'TEXTAREA') {
            nativeTextAreaValueSetter.call(input, 'こんにちは');
          } else {
            nativeInputValueSetter.call(input, 'こんにちは');
          }
          
          input.dispatchEvent(new Event('input', {bubbles: true}));
          
          btn.click();
          return 'Sent hello!';
        })();
      `
    });
    console.log('Result:', result.result.value);
  } catch (err) {
    console.error(err);
  } finally {
    if (client) await client.close();
  }
}
run();
