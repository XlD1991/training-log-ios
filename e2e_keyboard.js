/* 键盘避让验证：在 390x844 视口里构造底部弹层，设置 --kb 后
   测量弹层面板底部是否抬升了对应高度。结果写进 document.title。 */
(function () {
  var pass = 0, fail = 0, fails = [];
  function ok(cond, msg) { if (cond) pass++; else { fail++; fails.push(msg); } }

  try {
    // 构造与生产一致的 DOM 结构
    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<div id="k_modal" style="position:fixed;top:0;right:0;bottom:var(--kb,0px);left:0;' +
      'display:flex;align-items:flex-end;justify-content:center;">' +
      '<div id="k_panel" style="position:relative;width:100%;max-height:calc(88vh - var(--kb,0px));' +
      'height:300px;background:#fff;"></div></div>';
    document.body.appendChild(wrap);

    var modal = document.getElementById('k_modal');
    var panel = document.getElementById('k_panel');

    var VH = window.innerHeight;

    // 键盘未弹起：--kb = 0，面板底部贴视口底
    document.documentElement.style.setProperty('--kb', '0px');
    var bottom0 = panel.getBoundingClientRect().bottom;

    // 模拟键盘高度 336px（iPhone 中文键盘典型值）
    document.documentElement.style.setProperty('--kb', '336px');
    var bottom1 = panel.getBoundingClientRect().bottom;

    ok(Math.abs(bottom0 - VH) < 2, 'kb=0 时面板底应贴视口底(' + VH + ')，实际 ' + bottom0);
    ok(Math.abs(bottom1 - (VH - 336)) < 2, 'kb=336 时面板底应抬到 ' + (VH - 336) + '，实际 ' + bottom1);
    ok(Math.abs((bottom0 - bottom1) - 336) < 2, '面板应随键盘上移 336px，实际 ' + (bottom0 - bottom1));

    // max-height 应扣减键盘，避免顶部溢出
    var cs = window.getComputedStyle(panel);
    ok(cs.maxHeight.indexOf(String(VH - 336)) >= 0 || parseFloat(cs.maxHeight) <= (VH - 336) + 1,
       '面板 max-height 应扣减键盘(约' + (VH - 336) + ')，实际 ' + cs.maxHeight);
  } catch (e) {
    fail++; fails.push('异常: ' + e.message);
  }

  document.title = 'RESULT:{"pass":' + pass + ',"fail":' + fail + ',"fails":' +
    JSON.stringify(fails) + '}';
})();
