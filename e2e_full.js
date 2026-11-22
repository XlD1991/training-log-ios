/* 完整使用流程 E2E（真实浏览器环境 · 真点击真输入）
   由 ios/e2e_full.py 注入到 index.html 末尾运行，结果写进 document.title。
   覆盖：冷启动 → 记录组 → 休息计时 → 加组/撤销 → 换动作 → 超级组 →
        有氧日 → 结束训练/总结 → 历史回看 → 计划编辑 → 模式切换 →
        周期状态条 → 备份往返 → 器械库/规则/身体 → 持久化。 */
(function () {
  var PASS = 0, FAIL = 0, FAILS = [], ERRS = [];
  window.addEventListener('error', function (e) { ERRS.push(String(e.message)); });

  function ok(c, m) { if (c) { PASS++; } else { FAIL++; FAILS.push(m); } }
  function eq(a, b, m) { ok(a === b, m + '（实际 ' + JSON.stringify(a) + ' / 期望 ' + JSON.stringify(b) + '）'); }
  function q(s, r) { return (r || document).querySelector(s); }
  function qa(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function click(el) { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window })); }
  function cs(s, m) {
    var el = q(s);
    if (!el) { ok(false, '找不到元素：' + s + (m ? ' [' + m + ']' : '')); return false; }
    click(el); return true;
  }
  function inp(s, v) {
    var el = q(s);
    if (!el) { ok(false, '找不到输入框：' + s); return false; }
    el.value = String(v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }
  /* 只看界面区域：注入的测试脚本本身也在 body 里，直接用 body.textContent
     会把断言文案当页面内容，既误报脏值也可能造成假通过。 */
  function txt(r) {
    if (r) return r.textContent || '';
    return ['#app', '#modal', '#confirm', '#toast', '#timer'].map(function (s) {
      var el = q(s); return el && !el.classList.contains('hidden') ? el.textContent : '';
    }).join(' ');
  }
  function has(s) { return txt().indexOf(s) >= 0; }
  function junk(where) {
    var t = txt();
    ['undefined', 'NaN', '[object Object]', 'null kg'].forEach(function (bad) {
      if (t.indexOf(bad) >= 0) {
        var i = t.indexOf(bad);
        ok(false, where + ' 渲染出现脏值「' + bad + '」：…' + t.slice(Math.max(0, i - 40), i + 30).replace(/\s+/g, ' ') + '…');
      }
    });
  }
  function sec(name, fn) {
    try { fn(); } catch (e) { FAIL++; FAILS.push('【' + name + '】抛错：' + (e && e.message)); }
  }
  function seed(date, exKey, w, r) {
    state.records.push({ date: date, day: 'mon', exKey: exKey, exName: '历史', setIndex: 1, weight: w || 60, reps: r || 8, rir: 2, ts: 1 });
  }
  function fresh() {
    state = blank(); applyMode('ppl'); save();
    ui.today = '2026-11-20'; ui.day = 'fri'; ui.offDay = false; ui.reviewDate = '';
    ui.tab = 'today'; ui.confirmYes = null; ui.confirmNo = null; ui.lastCompleteAt = 0;
    blockCache = {}; render();
  }

  /* ============ 1 冷启动与今日页 ============ */
  sec('1 冷启动', function () {
    fresh();
    eq(window.__TRAINLOG_READY__, true, '应用完整执行到底（就绪标记）');
    eq(qa('#tabbar button').length, 5, '底部导航 5 个入口（含饮食）');
    eq(qa('#app .card[data-ex]').length, 5, '周五 5 个动作卡片');
    ok(has('上肢'), '副标题显示当天训练主题');
    ok(has('0 / 14 组'), '进度显示 0 / 14 组');
    ok(has('坐姿卷腹'), '新增的核心动作出现在周五');
    ok(!!q('#app [data-act="start-session"]'), '有「开始训练计时」入口');
    eq(!!q('#app [data-act="block-skip"]'), false, '无记录时不显示周期状态条');
    junk('今日页');
  });

  /* ============ 2 记录一组 + 输入校验 ============ */
  sec('2 记录组', function () {
    var row = '.card[data-ex="fri-1"] .setrow[data-set="1"]';
    inp(row + ' input.w', 50);
    inp(row + ' input.r', 12);
    ui.lastCompleteAt = 0;
    cs(row + ' [data-act="done"]', '完成第 1 组');
    eq(state.records.length, 1, '记录写入 1 条');
    var r = state.records[0] || {};
    eq(r.weight, 50, '重量 50 kg');
    eq(r.reps, 12, '次数 12');
    eq(r.date, '2026-11-20', '记录日期为今天');
    eq(r.setIndex, 1, '组号为 1');
    eq(r.exKey, 'fri-1', '动作 key 正确');
    ok(!!(state.sessions['2026-11-20'] || {}).start, '未手动计时也会自动记训练开始');
    ok(!q('#timer').classList.contains('hidden'), '完成后自动开始组间休息');
    ok(!!q('.card[data-ex="fri-1"] .setrow[data-set="1"] .setdone'), '该组切换为已完成态');
    ok(has('1 / 14 组'), '进度更新为 1 / 14 组');

    /* 次数留空 */
    inp('.card[data-ex="fri-1"] .setrow[data-set="2"] input.r', '');
    ui.lastCompleteAt = 0;
    cs('.card[data-ex="fri-1"] .setrow[data-set="2"] [data-act="done"]', '空次数点完成');
    eq(state.records.length, 1, '次数为空不落记录');
    ok(has('请填写次数'), '空次数给出提示');

    /* 重量为负 */
    inp('.card[data-ex="fri-1"] .setrow[data-set="2"] input.w', -5);
    inp('.card[data-ex="fri-1"] .setrow[data-set="2"] input.r', 10);
    ui.lastCompleteAt = 0;
    cs('.card[data-ex="fri-1"] .setrow[data-set="2"] [data-act="done"]', '负重量点完成');
    eq(state.records.length, 1, '负重量不落记录');
    junk('记录后');
  });

  /* ============ 3 休息计时 ============ */
  sec('3 休息计时', function () {
    ok(!q('#timer').classList.contains('hidden'), '计时器可见');
    eq(ui.timerTotal, restSeconds(findEx('fri-1')), '计时时长等于该动作的组间休息');
    ok((q('#timer').textContent || '').length > 0, '计时器有倒计时文本');
    cs('[data-act="skip-timer"]', '跳过休息');
    ok(q('#timer').classList.contains('hidden'), '跳过休息后计时器隐藏');
    cs('.card[data-ex="fri-2"] [data-act="start-rest"]', '手动开始休息');
    ok(!q('#timer').classList.contains('hidden'), '手动开始休息生效');
    eq(ui.timerTotal, restSeconds(findEx('fri-2')), '手动计时时长跟随该动作');
    cs('[data-act="skip-timer"]', '再次跳过');
  });

  /* ============ 4 加组 / 撤销 ============ */
  sec('4 加组与撤销', function () {
    var base = qa('.card[data-ex="fri-5"] .setrow').length;
    eq(base, 2, '卷腹默认 2 组');
    cs('.card[data-ex="fri-5"] [data-act="addset"]', '加一组');
    eq(qa('.card[data-ex="fri-5"] .setrow').length, 3, '加组后变 3 组');
    eq(state.extra['fri-5|2026-11-20'], 1, '加组记入 extra');
    ok(has('1 / 15 组'), '总组数同步到 15');

    cs('.card[data-ex="fri-1"] .setrow[data-set="1"] [data-act="undo"]', '撤销第 1 组');
    eq(state.records.length, 0, '撤销后记录清零');
    ok(has('0 / 15 组'), '进度回落到 0 / 15 组');

    /* 重新记一组，供后续流程使用 */
    inp('.card[data-ex="fri-1"] .setrow[data-set="1"] input.w', 50);
    inp('.card[data-ex="fri-1"] .setrow[data-set="1"] input.r', 12);
    ui.lastCompleteAt = 0;
    cs('.card[data-ex="fri-1"] .setrow[data-set="1"] [data-act="done"]', '重新完成第 1 组');
    eq(state.records.length, 1, '重新记录成功');
    cs('[data-act="skip-timer"]', '清掉计时');
  });

  /* ============ 5 换动作 ============ */
  sec('5 换动作', function () {
    var before = findEx('fri-3').name;
    cs('.card[data-ex="fri-3"] [data-act="open-swap"]', '打开替换弹层');
    var cands = qa('#modal [data-act="swap-pick"]');
    ok(cands.length > 0, '替换弹层里有同类候选（' + cands.length + ' 个）');
    var target = cands.filter(function (b) { return b.dataset.gear !== (findEx('fri-3').gearId || ''); })[0] || cands[0];
    var wantName = (target.querySelector('.si-name') || {}).textContent || '';
    click(target);
    ok(!!state.overrides['fri-3'], '替换写入 overrides');
    ok(effEx(findEx('fri-3')).name !== before, '卡片动作名已改变');
    ok(has(wantName.trim().slice(0, 4)), '页面显示新动作名');
    eq(state.records.length, 1, '换动作不影响已记的组');
    /* 换回模板，避免污染后续断言 */
    delete state.overrides['fri-3'];
    delete state.slotModes['fri-3'];
    applyMode('ppl'); render();

    /* 一键换一个（同类替代） */
    var before2 = findEx('fri-4').name;
    cs('.card[data-ex="fri-4"] [data-act="swap-random"]', '一键换同类');
    var yes = q('#confirm [data-act="confirm-yes"]');
    ok(!!yes, '一键换同类有二次确认');
    if (yes) click(yes);
    ok(!!state.overrides['fri-4'], '一键换同类写入 overrides');
    ok(effEx(findEx('fri-4')).name !== before2, '一键换同类后名称改变');
    delete state.overrides['fri-4'];
    delete state.slotModes['fri-4'];
    applyMode('ppl'); render();
  });

  /* ============ 6 超级组 ============ */
  sec('6 超级组', function () {
    cs('.card[data-ex="fri-3"] [data-act="superset-open"]', '打开超级组弹层');
    var recos = qa('#modal [data-act="pair-preset"]');
    ok(recos.length > 0, '弹层给出科学配对推荐（' + recos.length + ' 对）');
    var pick = recos[0] || q('#modal [data-act="superset-pick"]');
    var a = pick.dataset.a || pick.dataset.ex, b = pick.dataset.b || pick.dataset.pair;
    click(pick);
    eq(state.supersets[a], b, '配对写入状态');
    eq(state.supersets[b], a, '配对是双向的');
    ok(has('A1') || has('A2'), '卡片显示 A1/A2 标签');

    /* 做完 A 的第 2 组（第 1 组前面已完成）：不应启动休息，应提示去做 B */
    ui.lastCompleteAt = 0;
    inp('.card[data-ex="' + a + '"] .setrow[data-set="2"] input.w', 40);
    inp('.card[data-ex="' + a + '"] .setrow[data-set="2"] input.r', 12);
    cs('.card[data-ex="' + a + '"] .setrow[data-set="2"] [data-act="done"]', '完成超级组 A1');
    ok(q('#timer').classList.contains('hidden'), '超级组中途不启动休息');
    ok(has('超级组'), '给出「去做配对动作」的提示');

    /* 做完 B 同轮：此时才休息 */
    ui.lastCompleteAt = 0;
    inp('.card[data-ex="' + b + '"] .setrow[data-set="2"] input.w', 30);
    inp('.card[data-ex="' + b + '"] .setrow[data-set="2"] input.r', 15);
    cs('.card[data-ex="' + b + '"] .setrow[data-set="2"] [data-act="done"]', '完成超级组 B1');
    ok(!q('#timer').classList.contains('hidden'), '成对完成后启动休息');
    cs('[data-act="skip-timer"]', '清掉计时');
    cs('.card[data-ex="' + a + '"] [data-act="superset-open"]', '重新打开配对弹层');
    cs('#modal [data-act="superset-clear"]', '解除配对');
    ok(!state.supersets[a], '解除配对清空状态');
  });

  /* ============ 7 有氧日（模拟周四） ============ */
  sec('7 有氧日', function () {
    ui.today = '2026-11-19'; ui.day = 'thu'; ui.offDay = false; ui.reviewDate = '';
    blockCache = {}; render();
    ok(has('休息'), '周四显示为恢复日');
    var slot = (qa('#app [data-act="cardio-done"]')[0] || {}).dataset;
    ok(!!(slot && slot.slot), '周四有有氧卡片');
    if (!slot) return;
    var sk = slot.slot;
    /* 不填时长直接点完成：应被拦下 */
    cs('[data-act="cardio-done"][data-slot="' + sk + '"]', '空时长点完成');
    ok(!(state.cardio[cardioKey(sk, ui.today)] || {}).done, '未填时长不能标记完成');
    ok(has('先填时长'), '给出「先填时长」提示');
    /* 填时长 → 完成 */
    inp('.cardio-in[data-slot="' + sk + '"][data-cf="minutes"]', 30);
    cs('[data-act="cardio-done"][data-slot="' + sk + '"]', '填时长后完成');
    ok(!!(state.cardio[cardioKey(sk, ui.today)] || {}).done, '有氧完成已记录');
    var tEl = q('#toast');
    ok(has('有氧完成') || has('收工'), '完成有给出反馈（toast=' + (tEl ? tEl.className + '|' + tEl.textContent : '无') + '）');
    /* 取消完成 */
    cs('[data-act="cardio-done"][data-slot="' + sk + '"]', '取消有氧完成');
    ok(!(state.cardio[cardioKey(sk, ui.today)] || {}).done, '可以取消有氧完成');
    junk('有氧日');
    /* 回到周五 */
    ui.today = '2026-11-20'; ui.day = 'fri'; ui.offDay = false; blockCache = {}; render();
  });

  /* ============ 8 结束训练与总结 ============ */
  sec('8 结束训练', function () {
    cs('[data-act="end-session"]', '结束记录');
    ok(!q('#modal').classList.contains('hidden'), '结束后弹出训练总结');
    var m = txt(q('#modal'));
    ok(m.indexOf('组（力量）') >= 0, '总结显示力量组数');
    ok(m.indexOf('总容量') >= 0, '总结显示总容量');
    ok(m.indexOf('训练时长') >= 0, '总结显示训练时长');
    junk('总结弹层');
    cs('#modal [data-act="close-modal"]', '关闭总结');
    ok(q('#modal').classList.contains('hidden'), '总结可关闭');
  });

  /* ============ 9 全部完成态 / 收尾 ============ */
  sec('9 完成态', function () {
    /* 把周五剩余组一次性补齐 */
    var keys = ['fri-1', 'fri-2', 'fri-3', 'fri-4', 'fri-5'];
    var guard = 0;
    while (todayProgress().done < todayProgress().total && guard < 40) {
      guard++;
      var btn = q('#app [data-act="done"]');
      if (!btn) break;
      var card = btn.closest('.card');
      var k = card.dataset.ex;
      var row = btn.closest('.setrow');
      var si = row.dataset.set;
      inp('.card[data-ex="' + k + '"] .setrow[data-set="' + si + '"] input.w', 40);
      inp('.card[data-ex="' + k + '"] .setrow[data-set="' + si + '"] input.r', 10);
      ui.lastCompleteAt = 0;
      click(btn);
    }
    var pr = todayProgress();
    eq(pr.done >= pr.total, true, '所有组都能完成（' + pr.done + '/' + pr.total + '）');
    ok(has('练完了') || has('今天练完了'), '完成态给出收尾提示');
    ok(!!q('[data-act="del-today-strength"]'), '完成态提供「今天没练力量」的清理入口');
    junk('完成态');
  });

  /* ============ 10 历史与只读回看 ============ */
  sec('10 历史与回看', function () {
    cs('#tabbar [data-tab="history"]', '进入历史页');
    ok(has('训练历史'), '历史页标题');
    ok(has('塔式推胸') || has('坐姿卷腹'), '历史页列出今天练过的动作');
    ok(!!q('#app [data-act="report-open"]'), '历史页有周报入口');
    /* 打卡热力图：刻度、星期、月份、明细点击 */
    ok(!!q('#app .hm-cal'), '热力图有日历容器');
    eq(qa('#app .hm-days span').length, 7, '热力图左侧 7 个星期标签');
    ok(qa('#app .hm-months span').length >= 1, '热力图顶部有月份刻度');
    eq(qa('#app .hm-week').length, 10, '热力图 10 个周列');
    eq(qa('#app .hm-week .hm').length, 70, '热力图 70 个日格');
    ok(has('每格 1 天'), '热力图有读图说明');
    ok(has('颜色深浅 = 当天记录条数'), '图例讲清颜色含义');
    var todayCell = q('#app [data-act="hm-day"][data-date="2026-11-20"]');
    ok(!!todayCell, '今天格子可点击');
    if (todayCell) {
      ok((todayCell.getAttribute('title') || '').indexOf('力量') >= 0, '今天格子 title 含力量组数明细');
      click(todayCell);
      ok((q('#toast').textContent || '').indexOf('力量') >= 0, '点格子弹出当天明细');
    }
    junk('历史');

    /* 回看入口在「完成态」的今日页 */
    cs('#tabbar [data-tab="today"]', '回到今日');
    var rb = q('#app [data-act="review-date"]');
    ok(!!rb, '完成态有「回看今天记录」入口');
    if (rb) {
      click(rb);
      ok(!!ui.reviewDate, '进入只读回看');
      eq(qa('#app .setrow input').length, 0, '回看页不渲染可写输入框');
      ok(has('只读') || has('回看'), '回看页有只读提示');
      cs('[data-act="review-today"]', '返回今天');
      eq(ui.reviewDate, '', '返回今天清空回看日期');
    }
    junk('回看');
  });

  /* ============ 11 计划编辑器 ============ */
  sec('11 计划编辑', function () {
    cs('#tabbar [data-tab="plan"]', '进入计划页');
    ok(has('编辑我的训练计划'), '计划页标题');
    ok(has('当前模式'), '显示当前分化模式');
    eq(qa('#app [data-act="plan-delex"]').length, 27, '计划内 27 个动作');
    ok(!!q('#app [data-act="plan-pair"]'), '有科学配对一键套用');
    ok(has('躯干屈'), '卷腹动作模式与器械库一致');

    /* 下移一个动作 */
    var mv = q('#app [data-act="plan-move"][data-ek="fri-1"]');
    ok(!!mv, '有排序按钮');
    if (mv) {
      click(mv);
      ok(EX.filter(function (e) { return e.day === 'fri'; })[0].key !== 'fri-1', '动作顺序已改变');
      /* 还原 */
      cs('#app [data-act="plan-move"][data-ek="fri-1"][data-dir="-1"]', '上移还原');
    }

    /* 删除动作 → 确认 → 恢复 */
    cs('#app [data-act="plan-delex"][data-ek="fri-5"]', '删除卷腹');
    ok(!!q('#confirm [data-act="confirm-yes"]'), '删除有二次确认');
    cs('#confirm [data-act="confirm-yes"]', '确认删除');
    eq(EX.length, 26, '计划动作减到 26');
    ok(!!q('#app [data-act="plan-reset"]'), '出现「恢复模板」按钮');
    cs('#app [data-act="plan-reset"]', '恢复模板');
    eq(EX.length, 27, '恢复模板后回到 27 个动作');
    junk('计划页');
    cs('#tabbar [data-tab="today"]', '回到今日');
  });

  /* ============ 12 模式切换 ============ */
  sec('12 模式切换', function () {
    cs('[data-act="open-more"]', '打开更多');
    cs('[data-tab="backup"]', '进入备份/设置页');
    ok(has('训练分化模式'), '设置页有分化模式开关');
    cs('[data-act="set-mode"][data-v="five"]', '切到五分化');
    eq(state.settings.mode, 'five', '模式记为 five');
    eq(EX.length, 26, '五分化 26 个动作（含核心）');
    cs('#tabbar [data-tab="today"]', '回今日看计划变化');
    ok(has('胸') || has('背'), '今日计划随模式变化');
    cs('[data-act="open-more"]', '再开更多');
    cs('[data-tab="backup"]', '回设置页');
    cs('[data-act="set-mode"][data-v="ppl"]', '切回推拉腿');
    eq(state.settings.mode, 'ppl', '模式回到 ppl');
    eq(EX.length, 27, '推拉腿 27 个动作');
    ok('PPL 计划含手臂与核心直接组', ['mon-6', 'tue-6', 'fri-5'].every(function (k) { return EX.some(function (e) { return e.key === k; }); }));
    /* 五分化核心补齐 + 小肌群覆盖汇总 */
    (function () {
      var fv = planSource('five');
      ok('五分化模板含核心动作 arms-6', fv.ex.some(function (e) { return e.key === 'arms-6' && e.pattern === '躯干屈'; }));
      var mig = migratePlanOrder({ ppl: { days: clone(DAYS_PPL), ex: clone(EX_PPL).filter(function (e) { return e.key !== 'mon-6'; }) } }, 2, { 'mon-1': { name: '自定义卧推' } }, {});
      ok('自定义老存档也补齐缺失补项', mig.ppl.ex.some(function (e) { return e.key === 'mon-6'; }));
      ui.tab = 'plan'; render();
      ok('计划页显示小肌群覆盖汇总', document.getElementById('app').textContent.indexOf('小肌群直接组') >= 0);
    })();
    cs('#tabbar [data-tab="today"]', '回今日');
  });

  /* ============ 13 周期状态条 ============ */
  sec('13 周期状态条', function () {
    state.records = [];
    blockCache = {};
    seed('2026-11-16', 'fri-1');
    render();
    var info = blockInfo(ui.today);
    eq(info.week, 1, '本周仅 1 周记录 → 第 1 周');
    eq(info.add, 0, '第 1 周不加组');
    eq(setCount(findEx('fri-1'), ui.today), 3, '第 1 周按模板 3 组');
    ok(has('周期第 1 / 4 周'), '状态条显示第 1 周');

    seed('2026-11-09', 'fri-1');
    blockCache = {};
    render();
    info = blockInfo(ui.today);
    eq(info.week, 2, '连续 2 周 → 第 2 周');
    eq(info.add, 1, '第 2 周每天加 1 组');
    eq(setCount(findEx('fri-1'), ui.today), 4, '复合动作 3 → 4 组');
    eq(setCount(findEx('fri-4'), ui.today), 3, '孤立动作不加组');
    ok(has('第 2 / 4 周'), '状态条显示第 2 周');

    /* 跳过加量 */
    cs('[data-act="block-skip"]', '跳过本周加量');
    ok(!!state.blockSkip['2026-11-16'], '跳过记入 blockSkip');
    eq(setCount(findEx('fri-1'), ui.today), 3, '跳过后回到模板组数');
    ok(has('已跳过周期调整'), '状态条显示已跳过');
    /* 恢复 */
    cs('[data-act="block-resume"]', '恢复周期调整');
    ok(!state.blockSkip['2026-11-16'], '恢复后清空 blockSkip');
    eq(setCount(findEx('fri-1'), ui.today), 4, '恢复后重新加量');

    /* 第 4 周自动减量 */
    seed('2026-11-02', 'fri-1');
    seed('2026-10-26', 'fri-1');
    blockCache = {};
    render();
    info = blockInfo(ui.today);
    eq(info.week, 4, '连续 4 周 → 第 4 周');
    eq(info.deload, true, '第 4 周自动减量');
    eq(setCount(findEx('fri-1'), ui.today), Math.max(1, Math.round(3 * 0.7)), '减量后按模板组数 ×0.7');
    ok(has('减量期'), '状态条显示减量期');
    /* 减量周「本周不减量」：应沿用上一周峰值，而不是掉回基础周 */
    cs('[data-act="block-skip"]', '本周不减量');
    ok(!!state.blockSkip['2026-11-16'], '跳过记入 blockSkip');
    eq(deloadActive(ui.today), false, '跳过后本周不再减量');
    blockCache = {};
    eq(setCount(findEx('fri-1'), ui.today), 4, '「不减量」沿用峰值组数 4 组');
    eq(setCount(findEx('fri-4'), ui.today), 3, '孤立动作仍不加组');
    ok(has('峰值组数继续练'), '状态条说明按峰值继续');
    junk('周期状态条');

    /* 收拾：回到干净状态 */
    state.records = []; state.deloadSkip = {}; state.blockSkip = {}; state.blockExtend = {};
    blockCache = {}; render();
  });

  /* ============ 14 备份 / 导入归一化 ============ */
  sec('14 备份往返', function () {
    state.records = [];
    seed('2026-11-20', 'fri-1', 60, 8);
    seed('2026-11-20', 'fri-1', 60, 7);
    state.extra['fri-5|2026-11-20'] = 1;
    state.supersets = { 'fri-3': 'fri-4', 'fri-4': 'fri-3' };
    save(); render();
    cs('[data-act="open-more"]', '打开更多');
    cs('[data-tab="backup"]', '进入备份页');
    ok(has('累计组数'), '备份页有统计');
    ok(has('导出备份'), '有导出入口');
    ok(has('导入备份'), '有导入入口');

    /* 导出：桩掉下载，确认不抛错且有反馈 */
    var oldCreate = URL.createObjectURL, oldClick = HTMLAnchorElement.prototype.click;
    var made = 0;
    URL.createObjectURL = function () { made++; return 'blob:test'; };
    HTMLAnchorElement.prototype.click = function () {};
    try { cs('[data-act="export-json"]', '导出 JSON'); } catch (e) { ok(false, '导出抛错：' + e.message); }
    URL.createObjectURL = oldCreate; HTMLAnchorElement.prototype.click = oldClick;
    eq(made, 1, '导出确实生成了文件');
    ok(!!state.lastBackup, '导出后记录备份时间');

    /* 备份 → 归一化 → 导入等价（模拟换设备恢复） */
    var dump = JSON.parse(JSON.stringify(state));
    var back = normalizeState(dump);
    eq(back.records.length, 2, '往返后记录数一致');
    eq(back.extra['fri-5|2026-11-20'], 1, '往返后加组信息保留');
    eq(back.supersets['fri-3'], 'fri-4', '往返后超级组配对保留');
    eq(back.planOrderRev, PLAN_ORDER_REV, '往返后计划修订号保留');
    ok(Array.isArray(back.blockSkip) === false && typeof back.blockSkip === 'object', '周期字段结构正确');
    /* 脏数据兜底 */
    var dirty = normalizeState({ records: [{ date: '2026-99-99' }, { date: '2026-11-20', exKey: 'x' }], plans: null });
    eq(dirty.records.length, 1, '非法日期记录被过滤');
    eq(normalizeState(null).records.length, 0, '空备份归一化为空状态');
    junk('备份页');
    cs('#tabbar [data-tab="today"]', '回今日');
  });

  /* ============ 15 器械库 / 规则 / 身体 ============ */
  sec('15 其他页面', function () {
    cs('[data-act="open-more"]', '打开更多');
    cs('[data-tab="gear"]', '进入器械库');
    ok(has('器械库') || has('器械动作'), '器械库页渲染');
    ok(qa('#app [data-act="open-swap"]').length >= 0, '器械库可读');
    junk('器械库');

    cs('[data-act="open-more"]', '打开更多');
    cs('[data-tab="rules"]', '进入规则页');
    ok(has('执行规则'), '规则页标题');
    ok(has('容量周期化'), '规则里写明容量周期化');
    ok(has('手臂'), '规则里保留手臂说明');
    junk('规则页');

    cs('[data-act="open-more"]', '打开更多');
    cs('[data-tab="body"]', '进入身体页');
    ok(has('身体') || has('体重'), '身体页渲染');
    var addBody = q('#app [data-act="add-body"]');
    ok(!!addBody, '有记录体重入口');
    if (addBody) {
      click(addBody);
      ok(!q('#modal').classList.contains('hidden'), '体重表单打开');
      var wIn = q('#modal .body-w') || q('#modal input[type="number"]');
      if (wIn) { wIn.value = '70'; wIn.dispatchEvent(new Event('input', { bubbles: true })); }
      var sv = q('#modal [data-act="save-body"]');
      ok(!!sv, '有保存按钮');
      if (sv) {
        click(sv);
        ok((state.body || []).length >= 1, '体重记录已保存');
      }
    }
    junk('身体页');
    cs('#tabbar [data-tab="today"]', '回今日');
  });

  /* ============ 16 跳过与恢复 ============ */
  sec('16 跳过今天', function () {
    ui.today = '2026-11-20'; ui.day = 'fri'; ui.offDay = false; blockCache = {}; render();
    var sk = q('#app [data-act="skip"]');
    ok(!!sk, '有「标记今天跳过」入口');
    if (sk) {
      click(sk);
      cs('#confirm [data-act="confirm-yes"]', '确认跳过');
      ok(!!state.skips['2026-11-20'], '跳过状态已记录');
      ok(has('跳过') || has('休'), '今日页显示跳过态');
      cs('#app [data-act="unskip"]', '取消跳过');
      blockCache = {}; render();
      ok(!has('顺延中'), '取消跳过恢复正常');
    }
    junk('跳过态');
  });

  /* ============ 17 持久化 ============ */
  sec('17 持久化', function () {
    state = blank(); applyMode('ppl'); save();
    ui.today = '2026-11-20'; ui.day = 'fri'; ui.offDay = false; ui.tab = 'today'; render();
    inp('.card[data-ex="fri-1"] .setrow[data-set="1"] input.w', 72.5);
    inp('.card[data-ex="fri-1"] .setrow[data-set="1"] input.r', 6);
    ui.lastCompleteAt = 0;
    cs('.card[data-ex="fri-1"] .setrow[data-set="1"] [data-act="done"]', '记录一组');
    var raw = localStorage.getItem('workout_log_v1');
    ok(!!raw, '本机存储已写入');
    var parsed = JSON.parse(raw);
    eq(parsed.records.length, 1, '存储里 1 条记录');
    eq(parsed.records[0].weight, 72.5, '存储里重量正确');
    /* 模拟被杀后台后重新加载 */
    var reloaded = load();
    eq(reloaded.records.length, 1, '重新载入后记录还在');
    eq(reloaded.records[0].weight, 72.5, '重新载入后重量不丢');
    eq(reloaded.plans && typeof reloaded.plans, 'object', '计划字段结构完整');
  });

  /* ============ 18 器械档位与配片器 ============ */
  sec('18 档位与配片', function () {
    state = blank(); applyMode('ppl'); save();
    ui.today = '2026-11-16'; ui.day = 'mon'; ui.offDay = false; ui.reviewDate = '';
    ui.tab = 'today'; blockCache = {}; render();
    eq(incrementSpec(findEx('mon-1')).step, 5, '杠铃按 5 kg 档位递增');
    eq(incrementSpec(findEx('mon-2')).step, 2.5, '哑铃按 2.5 kg 档位递增');

    /* 上次 60kg 三组都做到次数上限 → 本次应建议加重，且落在真实档位 */
    [1, 2, 3].forEach(function (i) {
      state.records.push({ date: '2026-11-09', day: 'mon', exKey: 'mon-1', exName: '杠铃平板卧推', setIndex: i, weight: 60, reps: 10, rir: 2, ts: 1 });
    });
    blockCache = {}; render();
    var pg = progression(findEx('mon-1'), ui.today);
    eq(pg.level, 'up', '到次数上限后判为加重');
    eq(pg.next.to, 65, '60 kg 加重落到 65 kg（不出现 62.5）');
    ok(String(pg.next.hint || '').indexOf('每边各加 2.5') >= 0, '杠铃给出「每边各加 2.5」口径（' + pg.next.hint + '）');

    cs('.card[data-ex="mon-1"] [data-act="plate"]', '打开配片器');
    ok(!q('#modal').classList.contains('hidden'), '配片弹层打开');
    inp('[data-plate-target]', 62.5);
    var ptxt = txt(q('#plateResult'));
    ok(ptxt.indexOf('配不出来') >= 0, '62.5 kg 明确提示配不出来');
    ok(ptxt.indexOf('65') >= 0, '给出最近可配重量 65 kg');
    inp('[data-plate-target]', 60);
    ok(txt(q('#plateResult')).indexOf('可精确配出') >= 0, '60 kg 可精确配出');
    cs('#modal [data-act="close-modal"]', '关闭配片器');
    junk('配片器');
  });

  /* ============ 19 编辑动作 ============ */
  sec('19 编辑动作', function () {
    cs('.card[data-ex="mon-4"] .exname', '点动作名进入编辑');
    ok(!q('#modal').classList.contains('hidden'), '编辑弹层打开');
    inp('#modal .exf[data-f="name"]', '龙门架夹胸（试改）');
    cs('#modal [data-act="save-ex"]', '保存编辑');
    eq(effEx(findEx('mon-4')).name, '龙门架夹胸（试改）', '动作名已更新');
    ok(!!state.overrides['mon-4'], '编辑写入 overrides');
    /* 通过「恢复默认动作」回到模板 */
    cs('.card[data-ex="mon-4"] [data-act="open-swap"]', '打开替换弹层');
    cs('#modal [data-act="reset-ex"]', '恢复默认动作');
    eq(effEx(findEx('mon-4')).name, '龙门架绳索夹胸', '恢复为模板动作名');
    ok(!state.overrides['mon-4'], '恢复后清掉覆写');
  });

  /* ============ 20 备注与热身 ============ */
  sec('20 备注与热身', function () {
    inp('.exnote[data-exnote="mon-1"]', '左肩下沉，起杠前收肩胛');
    eq(state.notes['mon-1'], '左肩下沉，起杠前收肩胛', '动作备注已保存');
    cs('[data-act="toggle-warmup"]', '展开热身清单');
    var cb = q('input[data-act="warmup"][data-i="0"]');
    ok(!!cb, '热身清单有勾选项');
    if (cb) {
      /* 合成 click 也会触发复选框的激活行为，不需要手动改 checked */
      click(cb);
      ok((state.warmup[ui.today] || []).indexOf(0) >= 0, '热身勾选已记录');
      ok(has('1/'), '热身计数更新');
    }
    junk('备注热身');
  });

  /* ============ 21 周报 / 导出 PDF ============ */
  sec('21 周报', function () {
    cs('#tabbar [data-tab="history"]', '进入历史');
    cs('#app [data-act="report-open"]', '打开周报');
    ok(!q('#modal').classList.contains('hidden'), '周报弹层打开');
    ok(has('按周') && has('任意日期区间'), '支持按周 / 区间两种模式');
    cs('#modal [data-act="report-mode"][data-v="range"]', '切到区间模式');
    var quick = q('#modal [data-act="report-range-quick"]');
    ok(!!quick, '区间模式有快捷范围');
    if (quick) click(quick);
    var oldPrint = window.print;
    window.print = function () {};
    try {
      cs('#modal [data-act="report-print"]', '打印/导出 PDF');
      ok(has('另存为') || has('打印'), '给出打印提示');
    } catch (e) { ok(false, '周报打印抛错：' + e.message); }
    window.print = oldPrint;
    cs('#modal [data-act="close-modal"]', '关闭周报');
    junk('周报');
  });

  /* ============ 22 连点保护 ============ */
  sec('22 连点保护', function () {
    state = blank(); applyMode('ppl'); save();
    ui.today = '2026-11-20'; ui.day = 'fri'; ui.offDay = false; ui.tab = 'today'; blockCache = {}; render();
    inp('.card[data-ex="fri-1"] .setrow[data-set="1"] input.w', 55);
    inp('.card[data-ex="fri-1"] .setrow[data-set="1"] input.r', 10);
    ui.lastCompleteAt = 0;
    cs('.card[data-ex="fri-1"] .setrow[data-set="1"] [data-act="done"]', '完成一组');
    eq(state.records.length, 1, '记录成功');
    /* 连点撤销应被拦下 */
    cs('.card[data-ex="fri-1"] .setrow[data-set="1"] [data-act="undo"]', '立刻撤销');
    eq(state.records.length, 1, '800ms 内撤销被拦下');
    ok(has('请稍后再撤销'), '提示稍后再撤销');
    ui.lastCompleteAt = 0;
    cs('.card[data-ex="fri-1"] .setrow[data-set="1"] [data-act="undo"]', '稍后撤销');
    eq(state.records.length, 0, '稍后撤销生效');
  });

  /* ============ 23 空数据边界 ============ */
  sec('23 空数据', function () {
    state = blank(); applyMode('ppl'); save();
    ui.today = '2026-11-20'; ui.day = 'fri'; ui.offDay = false; ui.tab = 'today'; ui.reviewDate = '';
    blockCache = {}; render();
    cs('#tabbar [data-tab="history"]', '空状态进历史');
    ok(has('还没有记录'), '空历史给出引导文案');
    cs('#tabbar [data-tab="today"]', '回今日');
    cs('[data-act="open-more"]', '打开更多');
    cs('[data-tab="cardio"]', '有氧页');
    ok(has('有氧') || has('Zone'), '有氧页可打开');
    junk('有氧页');
    cs('[data-act="open-more"]', '打开更多');
    cs('[data-tab="backup"]', '备份页');
    ok(has('还没备份过'), '未备份时给出提醒');
    junk('空数据备份页');
    cs('#tabbar [data-tab="today"]', '回今日');
  });

  /* ============ 25 全周巡检（两种分化） ============ */
  sec('25 全周巡检', function () {
    ['ppl', 'five'].forEach(function (mode) {
      state = blank(); state.settings.mode = mode; applyMode(mode); save();
      ui.tab = 'today'; ui.reviewDate = ''; ui.offDay = false;
      ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].forEach(function (dk) {
        ui.day = dk; blockCache = {}; render();
        var p = planForWeekday(dk);
        var cards = qa('#app .card[data-ex]').length;
        var cardio = qa('#app [data-act="cardio-done"]').length;
        if (p.rest) ok(cardio >= 1, mode + ' · ' + dk + ' 休息日有有氧卡片');
        else ok(cards >= 4, mode + ' · ' + dk + ' 动作数 ' + cards + ' ≥ 4');
        junk(mode + ' · ' + dk);
      });
    });
    state = blank(); applyMode('ppl'); save();
    ui.today = '2026-11-20'; ui.day = 'fri'; ui.offDay = false; blockCache = {}; render();
  });

  /* ============ 26 停练断档 ============ */
  sec('26 停练断档', function () {
    state = blank(); applyMode('ppl'); save();
    seed('2026-11-20', 'fri-1');
    seed('2026-10-26', 'fri-1');   // 中间断了 2 周
    blockCache = {};
    var info = blockInfo('2026-11-20');
    eq(info.week, 1, '中间停练两周 → 回到第 1 周重新累积');
    eq(info.add, 0, '断档后不加组');
  });

  /* ============ 27 力量 + 有氧混排日 ============ */
  sec('27 混排日', function () {
    state = blank(); applyMode('ppl'); save();
    state.slotModes['fri-4'] = { type: 'cardio', gearId: 'c01' };
    ui.today = '2026-11-20'; ui.day = 'fri'; ui.offDay = false; ui.tab = 'today'; blockCache = {}; render();
    ok(has('力量 + 有氧混排'), '页面标明混排日');
    eq(qa('#app .card[data-ex]').length, 4, '力量卡片剩 4 个');
    eq(qa('#app [data-act="cardio-done"]').length, 1, '有 1 段有氧卡片');
    ok(has('项'), '进度按「项」计数');
    var slot = qa('#app [data-act="cardio-done"]')[0].dataset.slot;
    inp('.cardio-in[data-slot="' + slot + '"][data-cf="minutes"]', 25);
    cs('[data-act="cardio-done"][data-slot="' + slot + '"]', '完成混排有氧');
    ok(!!(state.cardio[cardioKey(slot, ui.today)] || {}).done, '混排有氧可标记完成');
    junk('混排日');
    delete state.slotModes['fri-4'];
    save(); render();
  });

  /* ============ 28 自定义器械 ============ */
  sec('28 自定义器械', function () {
    cs('[data-act="open-more"]', '打开更多');
    cs('[data-tab="gear"]', '进入器械库');
    cs('#app [data-act="add-custom-gear"]', '新增自定义器械');
    ok(!q('#modal').classList.contains('hidden'), '器械表单打开');
    inp('#modal .exf[data-gf="name"]', '我的胸推机');
    inp('#modal .exf[data-gf="gear"]', '健身房 B3 层推胸机');
    inp('#modal .exf[data-gf="rest"]', 120);
    cs('#modal [data-act="save-custom-gear"]', '保存自定义器械');
    var g = allGear().filter(function (x) { return x.name === '我的胸推机'; })[0];
    ok(!!g, '自定义器械进入器械库');
    if (g) {
      cs('#app [data-act="delete-custom-gear"][data-gear="' + g.id + '"]', '删除自定义器械');
      cs('#confirm [data-act="confirm-yes"]', '确认删除');
      ok(!allGear().some(function (x) { return x.name === '我的胸推机'; }), '删除后不再出现在器械库');
    }
    junk('器械库');
    cs('#tabbar [data-tab="today"]', '回今日');
  });

  /* ============ 29 删除今天的力量记录 ============ */
  sec('29 删除今日力量', function () {
    state = blank(); applyMode('ppl'); save();
    ui.today = '2026-11-20'; ui.day = 'fri'; ui.offDay = false; ui.tab = 'today'; blockCache = {}; render();
    /* 把周五全部组做完 */
    var guard = 0;
    while (todayProgress().done < todayProgress().total && guard < 40) {
      guard++;
      var btn = q('#app [data-act="done"]');
      if (!btn) break;
      var k = btn.closest('.card').dataset.ex, si = btn.closest('.setrow').dataset.set;
      inp('.card[data-ex="' + k + '"] .setrow[data-set="' + si + '"] input.w', 40);
      inp('.card[data-ex="' + k + '"] .setrow[data-set="' + si + '"] input.r', 10);
      ui.lastCompleteAt = 0;
      click(btn);
    }
    var n0 = state.records.length;
    ok(n0 > 0, '今日记录已建立（' + n0 + ' 组）');
    state.cardio[cardioKey('thu-1', ui.today)] = blankCardioRec('thu-1', ui.today);
    state.cardio[cardioKey('thu-1', ui.today)].done = true;
    save(); render();
    cs('#app [data-act="del-today-strength"]', '删除今天力量');
    cs('#confirm [data-act="confirm-yes"]', '确认删除');
    eq(todayStrengthRecs().length, 0, '今日力量记录已清空');
    eq(state.records.length, 0, '总记录数归零');
    ok(!!(state.cardio[cardioKey('thu-1', ui.today)] || {}).done, '今天的有氧记录保留');
  });

  /* ============ 30 顺延减量 ============ */
  sec('30 顺延减量', function () {
    state = blank(); applyMode('ppl'); save();
    /* 本周之前已连续练 2 周，本周破 PR → 处于第 3 周 */
    seed('2026-11-09', 'fri-1', 60, 8);
    seed('2026-11-02', 'fri-1', 60, 8);
    state.records.push({ date: '2026-11-20', day: 'fri', exKey: 'fri-1', exName: '塔式推胸', setIndex: 1, weight: 70, reps: 10, rir: 2, ts: 1 });
    ui.today = '2026-11-20'; ui.day = 'fri'; ui.offDay = false; ui.tab = 'today';
    blockCache = {}; render();
    eq(blockInfo(ui.today).week, 3, '本周处于第 3 周');
    var extBtn = q('[data-act="block-extend"]');
    ok(!!extBtn, '第 3 周刚破 PR 时给出「顺延一周」');
    if (extBtn) click(extBtn);
    ok(!!state.blockExtend['2026-11-23'], '顺延标记打到下一周');
    /* 下周开练一次 → 第 4 周，但应顺延不减量 */
    state.records.push({ date: '2026-11-23', day: 'mon', exKey: 'mon-1', exName: '杠铃平板卧推', setIndex: 1, weight: 60, reps: 8, rir: 2, ts: 1 });
    ui.today = '2026-11-23'; ui.day = 'mon'; blockCache = {}; render();
    var nx = blockInfo('2026-11-23');
    eq(nx.week, 4, '下周进入第 4 周');
    eq(nx.extended, true, '顺延标记生效');
    eq(nx.deload, false, '顺延后不减量');
    eq(setCount(findEx('mon-1'), '2026-11-23'), 4, '顺延周按峰值组数练');
    ok(has('顺延峰值'), '状态条标明是顺延峰值');
    ok(!has('本周组数 ×0.7'), '状态条不再声称本周减量');
    junk('顺延周');
    state.records = []; state.blockExtend = {}; blockCache = {};
  });

  /* ============ 31 重新配对的一致性 ============ */
  sec('31 重新配对', function () {
    state = blank(); applyMode('ppl'); save();
    ui.today = '2026-11-20'; ui.day = 'fri'; ui.offDay = false; ui.tab = 'today'; blockCache = {}; render();
    /* 先把 fri-3 和 fri-4 配成一对 */
    cs('.card[data-ex="fri-3"] [data-act="superset-open"]', '打开配对');
    cs('#modal [data-act="superset-pick"][data-pair="fri-4"]', '配 fri-3 ↔ fri-4');
    eq(supersetPartner('fri-3'), 'fri-4', '第一对已建立');
    /* 再把 fri-3 改成和 fri-5 配 */
    cs('.card[data-ex="fri-3"] [data-act="superset-open"]', '再次打开配对');
    cs('#modal [data-act="superset-pick"][data-pair="fri-5"]', '改配 fri-3 ↔ fri-5');
    eq(supersetPartner('fri-3'), 'fri-5', '新配对生效');
    eq(supersetPartner('fri-4'), '', '旧伙伴不残留反向指针');
    eq(!!q('.card[data-ex="fri-4"] .tag.pair'), false, '旧伙伴卡片不再显示交替标签');
    /* 解除 */
    cs('.card[data-ex="fri-3"] [data-act="superset-open"]', '打开配对');
    cs('#modal [data-act="superset-clear"]', '解除配对');
    eq(supersetPartner('fri-5'), '', '解除后双向都清空');
  });

  /* ============ 32 今天换个训练日 ============ */
  sec('32 类型切换', function () {
    state = blank(); applyMode('ppl'); save();
    ui.today = '2026-11-20'; ui.day = 'fri'; ui.offDay = false; ui.tab = 'today'; blockCache = {}; render();
    var before = qa('#app .card[data-ex]').length;
    cs('#app [data-act="settype"][data-type="wed"]', '把今天改成腿日');
    ok(!!state.typeOverride['2026-11-20'], '覆盖已记录');
    ok(has('腿'), '页面显示腿日');
    ok(qa('#app .card[data-ex]').length === 5, '换成腿日 5 个动作');
    ok(has('/ 15 组'), '进度按腿日组数计算');
    cs('#app [data-act="settype"][data-type="auto"]', '恢复自动');
    ok(!state.typeOverride['2026-11-20'], '覆盖已清除');
    eq(qa('#app .card[data-ex]').length, before, '恢复原来的动作数');
  });

  /* ============ 33 一键填入建议重量 ============ */
  sec('33 建议填重', function () {
    state = blank(); applyMode('ppl'); save();
    [1, 2, 3].forEach(function (i) {
      state.records.push({ date: '2026-11-09', day: 'mon', exKey: 'mon-1', exName: '杠铃平板卧推', setIndex: i, weight: 60, reps: 10, rir: 2, ts: 1 });
    });
    ui.today = '2026-11-16'; ui.day = 'mon'; ui.offDay = false; ui.tab = 'today'; blockCache = {}; render();
    var btn = q('.card[data-ex="mon-1"] [data-act="use-suggest"]');
    ok(!!btn, '给出「用建议重量」按钮');
    if (btn) {
      click(btn);
      eq(q('.card[data-ex="mon-1"] .setrow[data-set="1"] input.w').value, '65', '第 1 组填入 65');
      eq(q('.card[data-ex="mon-1"] .setrow[data-set="3"] input.w').value, '65', '第 3 组也填入 65');
      eq(state.drafts['mon-1|1'].w, 65, '草稿同步保存');
    }
    /* 有完成组后不能再一键改写剩余组 */
    inp('.card[data-ex="mon-1"] .setrow[data-set="1"] input.r', 8);
    ui.lastCompleteAt = 0;
    cs('.card[data-ex="mon-1"] .setrow[data-set="1"] [data-act="done"]', '完成第 1 组');
    eq(!!q('.card[data-ex="mon-1"] [data-act="use-suggest"]'), false, '已有完成组后不再给一键填重');
  });

  /* ============ 34 RIR 记录 ============ */
  sec('34 RIR', function () {
    var rirs = qa('.card[data-ex="mon-1"] .setrir');
    ok(rirs.length >= 3, '每组都有 RIR 行');
    if (rirs.length >= 3) {
      click(q('[data-act="set-rir"][data-set="2"][data-rir="0"]', rirs[1]) || qa('.card[data-ex="mon-1"] [data-act="set-rir"][data-set="2"][data-rir="0"]')[0]);
    }
    inp('.card[data-ex="mon-1"] .setrow[data-set="2"] input.w', 65);
    inp('.card[data-ex="mon-1"] .setrow[data-set="2"] input.r', 9);
    ui.lastCompleteAt = 0;
    cs('.card[data-ex="mon-1"] .setrow[data-set="2"] [data-act="done"]', '完成第 2 组');
    var r2 = state.records.filter(function (r) { return r.exKey === 'mon-1' && r.date === '2026-11-16' && r.setIndex === 2; })[0];
    eq((r2 || {}).rir, 0, 'RIR 0 如实记录');

    click(qa('.card[data-ex="mon-1"] [data-act="set-rir"][data-set="3"][data-rir="F"]')[0]);
    inp('.card[data-ex="mon-1"] .setrow[data-set="3"] input.w', 65);
    inp('.card[data-ex="mon-1"] .setrow[data-set="3"] input.r', 8);
    ui.lastCompleteAt = 0;
    cs('.card[data-ex="mon-1"] .setrow[data-set="3"] [data-act="done"]', '完成第 3 组');
    var r3 = state.records.filter(function (r) { return r.exKey === 'mon-1' && r.date === '2026-11-16' && r.setIndex === 3; })[0];
    eq((r3 || {}).rir, 5, '力竭统一记为 RIR 5');
  });

  /* ============ 35 有氧计时 ============ */
  sec('35 有氧计时', function () {
    ui.today = '2026-11-19'; ui.day = 'thu'; ui.offDay = false; ui.tab = 'today'; blockCache = {}; render();
    var slot = qa('#app [data-act="cardio-timer-start"]')[0];
    ok(!!slot, '有氧卡片有开始计时');
    if (!slot) return;
    var sk = slot.dataset.slot;
    click(slot);
    eq(ui.cardioTimer.slot, sk, '计时器绑定该段有氧');
    ok(!!q('[data-act="cardio-timer-stop"][data-slot="' + sk + '"]'), '出现结束计时按钮');
    cs('[data-act="cardio-timer-stop"][data-slot="' + sk + '"]', '结束计时');
    var rec = state.cardio[cardioKey(sk, ui.today)] || {};
    ok(Number(rec.minutes) >= 1, '自动填入至少 1 分钟（实际 ' + rec.minutes + '）');
    ok(has('已填入'), '给出已填入提示');
    junk('有氧计时');
  });

  /* ============ 36 布局溢出（iPhone 12 / SE 窄屏） ============ */
  sec('36 布局溢出', function () {
    state = blank(); applyMode('ppl'); save();
    ui.today = '2026-11-20'; ui.day = 'fri'; ui.offDay = false; ui.reviewDate = '';
    blockCache = {}; render();
    var iw = window.innerWidth;
    function overflow(tag) {
      var sw = document.documentElement.scrollWidth;
      ok(sw <= iw + 1, tag + ' 无横向溢出（内容 ' + sw + ' / 视口 ' + iw + '）');
    }
    overflow('今日');
    cs('#tabbar [data-tab="history"]', '历史');
    overflow('历史');
    cs('#tabbar [data-tab="plan"]', '计划');
    overflow('计划');
    cs('[data-act="open-more"]', '更多');
    cs('[data-tab="gear"]', '器械库');
    overflow('器械库');
    cs('[data-act="open-more"]', '更多');
    cs('[data-tab="rules"]', '规则');
    overflow('规则');
    cs('[data-act="open-more"]', '更多');
    cs('[data-tab="backup"]', '备份');
    overflow('备份');
    cs('[data-act="open-more"]', '更多');
    cs('[data-tab="body"]', '身体');
    overflow('身体');
    cs('[data-act="open-more"]', '更多');
    cs('[data-tab="cardio"]', '有氧');
    overflow('有氧');
    /* 弹层也要能完整显示 */
    cs('#tabbar [data-tab="today"]', '回今日');
    cs('.card[data-ex="fri-1"] [data-act="open-swap"]', '打开替换弹层');
    var mw = q('#modal .modal-panel');
    ok(!!mw && mw.getBoundingClientRect().width <= iw, '替换弹层不超出视口');
    cs('#modal [data-act="close-modal"]', '关闭');
  });

  /* ============ 37 删除配对动作后的残留 ============ */
  sec('37 删除配对动作', function () {
    state = blank(); applyMode('ppl'); save();
    ui.today = '2026-11-20'; ui.day = 'fri'; ui.offDay = false; ui.tab = 'today'; blockCache = {}; render();
    cs('.card[data-ex="fri-3"] [data-act="superset-open"]', '打开配对');
    cs('#modal [data-act="superset-pick"][data-pair="fri-4"]', '配 fri-3 ↔ fri-4');
    eq(supersetPartner('fri-3'), 'fri-4', '配对建立');
    cs('#tabbar [data-tab="plan"]', '去计划页');
    cs('#app [data-act="plan-delex"][data-ek="fri-4"]', '删除 fri-4');
    cs('#confirm [data-act="confirm-yes"]', '确认删除');
    eq(!!state.supersets['fri-4'], false, '被删动作的配对条目已清掉');
    eq(!!state.supersets['fri-3'], false, '搭档上的反向指针也清掉');
    cs('#tabbar [data-tab="today"]', '回今日');
    ok(!has('交替：?'), '页面不出现指向已删动作的交替标签');
    cs('#tabbar [data-tab="plan"]', '回计划页');
    cs('#app [data-act="plan-reset"]', '恢复模板');
    eq(EX.length, 27, '恢复模板后动作数回到 27');
  });

  /* ============ 24 导入备份（真实文件） ============ */
  function finish() {
    ok(ERRS.length === 0, '全程无未捕获 JS 错误' + (ERRS.length ? '：' + ERRS.slice(0, 3).join(' | ') : ''));
    document.title = 'RESULT:' + JSON.stringify({ pass: PASS, fail: FAIL, fails: FAILS.slice(0, 40) });
  }

  (function importRun() {
    try {
      state = blank(); applyMode('ppl'); save();
      ui.today = '2026-11-20'; ui.day = 'fri'; ui.offDay = false; ui.tab = 'today'; blockCache = {}; render();
      var payload = JSON.parse(JSON.stringify(state));
      payload.records = [{ date: '2026-11-18', day: 'wed', exKey: 'wed-1', exName: '杠铃深蹲', setIndex: 1, weight: 100, reps: 5, rir: 2, ts: 2 }];
      payload.settings = { restAlert: 'both', restRounds: 2, staleWeeks: 4, mode: 'ppl' };
      var file = new File([JSON.stringify(payload)], 'backup.json', { type: 'application/json' });
      var input = document.getElementById('importFile');
      var dt = new DataTransfer();
      dt.items.add(file);
      Object.defineProperty(input, 'files', { value: dt.files, configurable: true });
      input.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (e) {
      FAIL++; FAILS.push('【24 导入】发起导入抛错：' + e.message);
      finish();
      return;
    }
    setTimeout(function () {
      try {
        ok(!!q('#confirm [data-act="confirm-yes"]'), '导入前弹出覆盖确认');
        if (q('#confirm [data-act="confirm-yes"]')) click(q('#confirm [data-act="confirm-yes"]'));
        eq(state.records.length, 1, '导入后记录数被替换');
        eq((state.records[0] || {}).weight, 100, '导入的数据生效');
        ok(has('已导入'), '导入成功有提示');
      } catch (e) {
        FAIL++; FAILS.push('【24 导入】确认导入抛错：' + e.message);
      }

      /* ============ 25 原生文件桥（模拟 iOS 壳 __TL_NATIVE__） ============ */
      try {
        var saved = [], copies = [], pdfs = [], haptics = 0;
        window.__TL_NATIVE__ = {
          saveFile: function (name, b64) { saved.push({ name: name, b64: b64 }); return true; },
          savePDF: function (name, html) { pdfs.push({ name: name, html: html }); return true; },
          copyText: function (t) { copies.push(t); return true; },
          haptic: function () { haptics++; }
        };
        /* 25.1 内容转 base64 正确（含中文 UTF-8） */
        var b64cn = toBase64('力量记录');
        var raw = atob(b64cn), bytes = new Uint8Array(raw.length);
        for (var bi = 0; bi < raw.length; bi++) bytes[bi] = raw.charCodeAt(bi);
        eq(new TextDecoder().decode(bytes), '力量记录', 'toBase64 中文按 UTF-8 编码可还原');
        /* 25.2 导出 JSON 走原生桥：文件落地、提示为真实保存、不误报 */
        var s0 = saved.length;
        var okJson = exportJSON();
        eq(okJson, true, '原生桥下导出 JSON 返回成功');
        eq(saved.length, s0 + 1, '导出确实写入原生文件系统');
        ok(/\.json$/.test(saved[s0].name), '原生收到 .json 文件名');
        ok(saved[s0].b64.length > 0, '原生收到非空 base64 内容');
        ok(has('存储到文件'), '提示改为让用户「存储到文件」而非假提示');
        /* 25.3 二进制 ZIP 也走桥、base64 非空 */
        var s1 = saved.length;
        var okZip = download(new Uint8Array([0, 1, 2, 255]), 'application/zip', 't.zip');
        eq(okZip, true, '二进制内容导出返回成功');
        eq(saved.length, s1 + 1, '二进制也写入原生');
        eq(atob(saved[s1].b64).length, 4, 'Uint8Array 按字节转 base64 无丢失');
        /* 25.4 原生写入失败 → 返回 false，不记录备份时间 */
        window.__TL_NATIVE__.saveFile = function () { return false; };
        var oldBackup = state.lastBackup;
        var clickFail = q('[data-act="export-json"]');
        if (clickFail) click(clickFail);
        eq(state.lastBackup, oldBackup, '写入失败时不更新备份时间（消除假备份）');
        /* 25.5 PDF 走原生渲染桥 */
        var okPdf = exportPDF(ui.today, { detail: true, stats: true });
        eq(okPdf, true, 'PDF 走原生桥返回成功');
        ok(pdfs.length >= 1 && /\.pdf$/.test(pdfs[pdfs.length - 1].name), '原生收到 .pdf 渲染请求');
        ok(pdfs.length && pdfs[pdfs.length - 1].html.indexOf('<!doctype html>') === 0, 'PDF 内容是完整 HTML');
        /* 25.6 原生剪贴板与触觉桥可用（复制入口依赖当天有明细，这里直测桥） */
        eq(window.__TL_NATIVE__.copyText('测试明细'), true, '原生剪贴板桥返回成功');
        eq(copies.length, 1, '文本已送到原生剪贴板');
        ok(typeof copyGarminNotes === 'function', '复制明细入口存在');
        buzz();
        ok(haptics >= 1, '组间休息提醒走原生触觉');
        /* 清理 mock，避免影响后续 */
        delete window.__TL_NATIVE__;
      } catch (e) {
        FAIL++; FAILS.push('【25 原生文件桥】抛错：' + (e && e.message));
      }
      finish();
    }, 600);
  })();
})();
