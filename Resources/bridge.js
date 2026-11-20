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
})();
