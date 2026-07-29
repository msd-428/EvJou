const CDP = require('chrome-remote-interface');
async function run() {
  let client;
  try {
    client = await CDP({port: 9222});
    const {Runtime, Log, Console} = client;
    await Runtime.enable();
    await Log.enable();
    await Console.enable();
    Console.messageAdded((params) => console.log('Console:', params.message.text));
    Runtime.consoleAPICalled((params) => {
      console.log('ConsoleAPI:', params.type, params.args.map(a => a.value || a.description).join(' '));
    });
    
    // ページをリロードして初期化時のエラーをキャッチする
    console.log('Reloading page to catch startup errors...');
    const {Page} = client;
    await Page.enable();
    await Page.reload();
    
    setTimeout(async () => {
      await client.close();
      process.exit(0);
    }, 5000);
  } catch(err) {
    console.error(err);
    process.exit(1);
  }
}
run();
