(function () {
  var TAG = '__TLSTORE__';
  var NULL = '__TL_NULL__';
  function call(op, k, v) {
    try {
      var q = { op: op };
      if (k !== undefined) q.k = k;
      if (v !== undefined) q.v = v;
      var r = window.prompt(TAG, JSON.stringify(q));
      return (r === null || r === undefined) ? null : r;
    } catch (e) { return null; }
  }
  function Storage() {}
  Storage.prototype = {
    get length() {
      var n = Number(call('length'));
      return isNaN(n) ? 0 : n;
    },
    key: function (i) {
      var r = call('key', String(i));
      return (r === null || r === '') ? null : r;
    },
    getItem: function (k) {
      var r = call('get', String(k));
      return (r === null || r === NULL) ? null : r;
    },
    setItem: function (k, v) { call('set', String(k), String(v)); },
    removeItem: function (k) { call('remove', String(k)); },
    clear: function () { call('clear'); }
  };
  var store = new Storage();
  var desc = { value: store, configurable: true, enumerable: true, writable: true };
  try { Object.defineProperty(window, 'localStorage', desc); }
  catch (e) { try { window.localStorage = store; } catch (e2) {} }
  try { Object.defineProperty(window, 'sessionStorage', desc); }
  catch (e) { try { window.sessionStorage = store; } catch (e2) {} }
  window.__TL_STORE__ = store;

  /* 原生能力桥：写文件并弹系统分享面板 / 复制文本 / 震动 / 生成 PDF。
     复用同一条 prompt 通道，新增 op；原生不认识时返回空串，网页据此回退。
     文件内容统一走 base64：k = 文件名，v = base64；二进制 ZIP 也能完整传出。 */
  window.__TL_NATIVE__ = {
    /* 把 base64 内容写成文件并弹分享面板；返回 true 表示原生已接管 */
    saveFile: function (filename, b64) {
      var r = call('saveFile', String(filename), String(b64));
      return r === '1';
    },
    /* 生成 PDF：把报告 HTML 交给原生渲染成 PDF 并弹分享面板 */
    savePDF: function (filename, html) {
      var r = call('savePDF', String(filename), String(html));
      return r === '1';
    },
    /* 复制到系统剪贴板 */
    copyText: function (text) { return call('copyText', '', String(text)) === '1'; },
    /* 触觉反馈（组间休息提醒） */
    haptic: function () { call('haptic'); }
  };
})();
