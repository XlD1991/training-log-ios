/* 饮食模块无头测试：注入到 www 副本的 index.html，用真实 DOM 点击 / 输入。
   结果写进 document.title，由 e2e_diet.py 解析。 */
(function () {
  var R = { pass: 0, fail: 0, errors: [] };
  function ok(name, cond) {
    if (cond) { R.pass++; } else { R.fail++; R.errors.push(name); }
  }
  function click(el) {
    if (!el) { R.errors.push('click:null'); return false; }
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    return true;
  }
  function qs(sel) { return document.querySelector(sel); }
  function qsa(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }
  function byAct(act) { return qs('[data-act="' + act + '"]'); }
  function txt() { return document.getElementById('app').textContent; }
  function setF(f, v, scope) {
    var el = (scope || document).querySelector('[data-f="' + f + '"]');
    if (el) { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); return true; }
    return false;
  }
  function input(sel, v) {
    var el = qs(sel); if (!el) return false;
    el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); return true;
  }
  function goTab(t) { click(qs('#tabbar button[data-tab="' + t + '"]')); }

  try {
    /* ---- 0. 冷启动 / 食物库 ---- */
    ok('foods.js 已加载', typeof FOOD_DB !== 'undefined' && FOOD_DB.length >= 200);
    ok('食物库分类齐全', typeof FOOD_CATS !== 'undefined' && FOOD_CATS.length === 9);
    ok('估算与准确项都有', FOOD_DB.some(function (f) { return f.acc === 'e'; }) && FOOD_DB.some(function (f) { return f.acc === 'a'; }));

    /* ---- 1. 切到饮食 tab ---- */
    goTab('diet');
    ok('饮食页打开', txt().indexOf('今日四餐') >= 0);
    ok('四餐都在', ['早餐', '午餐', '晚餐', '加餐'].every(function (m) { return txt().indexOf(m) >= 0; }));
    ok('无目标时提示设置', txt().indexOf('还没设营养目标') >= 0);

    /* ---- 2. 设置营养目标 ---- */
    click(byAct('diet-goal'));
    ok('目标弹层打开', !!qs('[data-act="diet-goal-save"]'));
    setF('sex', 'm', qs('#modal')); setF('age', '30', qs('#modal')); setF('height', '175', qs('#modal'));
    setF('weight', '75', qs('#modal')); setF('activity', '1.55', qs('#modal'));
    setF('proteinPerKg', '1.8', qs('#modal')); setF('fatPerKg', '0.9', qs('#modal')); setF('rate', '0.25', qs('#modal'));
    click(byAct('diet-goal-save'));
    ok('目标保存后显示 TDEE', txt().indexOf('TDEE') >= 0);
    ok('目标卡有今日目标', txt().indexOf('今日目标') >= 0);
    ok('训练日/休息日标签', txt().indexOf('训练日') >= 0 || txt().indexOf('休息日') >= 0);

    /* ---- 3. 加食物：早餐 米饭 1碗 ---- */
    click(qs('[data-act="diet-picker"][data-meal="breakfast"]'));
    ok('食物选择弹层打开', !!qs('#dietSearch'));
    ok('分类 chip 存在', qsa('[data-act="diet-cat"]').length >= 7);
    ok('米饭在列表', !!qs('[data-act="diet-pick"][data-fid="s001"]'));
    click(qs('[data-act="diet-pick"][data-fid="s001"]'));
    ok('份量弹层打开', !!qs('[data-act="diet-confirm"]'));
    click(qs('[data-act="diet-grams"][data-g="150"]'));
    ok('份量切换显示 174 kcal', qs('#modal .diet-total-box') && qs('#modal .diet-total-box').textContent.indexOf('174') >= 0);
    /* 自定义克数 */
    input('#modal [data-f="dietGram"]', '200');
    ok('自定义克数刷新 232 kcal', qs('#modal .diet-total-box') && qs('#modal .diet-total-box').textContent.indexOf('232') >= 0);
    click(byAct('diet-confirm'));
    ok('记录后回到饮食页', txt().indexOf('今日四餐') >= 0);
    ok('早餐出现米饭', qs('.diet-meal') && qs('.diet-meal').textContent.indexOf('米饭（蒸）') >= 0);
    ok('累计热量出现', qs('.diet-summary') && qs('.diet-summary').textContent.indexOf('kcal') >= 0);

    /* ---- 4. 搜索过滤 ---- */
    click(qs('[data-act="diet-picker"][data-meal="lunch"]'));
    input('#dietSearch', '鸡胸');
    ok('搜索保留鸡胸', qsa('[data-act="diet-pick"]').some(function (b) { return b.dataset.fid === 'm001'; }));
    ok('搜索过滤掉无关', !qsa('[data-act="diet-pick"]').some(function (b) { return b.dataset.fid === 's001'; }));
    /* 清空搜索再点分类 */
    input('#dietSearch', '');
    click(qs('[data-act="diet-cat"][data-cat="常见外卖"]'));
    var picks = qsa('[data-act="diet-pick"]');
    ok('外卖分类生效', picks.length > 0 && picks.every(function (b) { return b.dataset.fid.charAt(0) === 'w'; }));
    /* 估算项区间 */
    click(qs('[data-act="diet-pick"][data-fid="w001"]'));
    ok('估算项份量显示区间', qs('#modal .diet-total-box') && qs('#modal .diet-total-box').textContent.indexOf('–') >= 0);
    click(byAct('diet-confirm'));
    ok('估算项入账成功', (state.diet.log[ui.today] || []).some(function (e) { return e.fid === 'w001'; }));

    /* ---- 5. 存常吃组合 + 一键整餐 ---- */
    click(qs('[data-act="diet-fav-form"][data-meal="breakfast"]'));
    ok('存常吃弹层打开', !!qs('[data-act="diet-fav-save"]'));
    input('#modal [data-f="favName"]', '我的早餐');
    click(byAct('diet-fav-save'));
    ok('常吃组合已创建', dietFavs().some(function (f) { return f.name === '我的早餐'; }));
    /* 删掉早餐米饭 */
    var bfast = qs('.diet-meal [data-act="diet-del"]');
    if (bfast) click(bfast);
    var before = (state.diet.log[ui.today] || []).length;
    /* 打开晚餐选择器，用常吃组合一键恢复 */
    click(qs('[data-act="diet-picker"][data-meal="dinner"]'));
    var favUse = qs('[data-act="diet-fav-use"]');
    ok('常吃组合可一键用', !!favUse);
    if (favUse) click(favUse);
    ok('一键整餐后有记录', (state.diet.log[ui.today] || []).length > before);
    if (typeof closeModal === 'function') closeModal();

    /* ---- 6. 删除常吃组合 ---- */
    click(qs('[data-act="diet-picker"][data-meal="snack"]'));
    var favDel = qs('[data-act="diet-fav-del"]');
    ok('常吃组合可删除', !!favDel);
    if (favDel) click(favDel);
    ok('删除后组合消失', !dietFavs().some(function (f) { return f.name === '我的早餐'; }));
    if (typeof closeModal === 'function') closeModal();

    /* ---- 7. 体重趋势（复用 state.body） ---- */
    ui.tab = 'body'; render();
    ok('身体页打开', txt().indexOf('添加身体数据') >= 0);
    click(byAct('add-body'));
    ok('身体数据弹层打开', !!byAct('save-body'));
    var m = qs('#modal');
    setF('date', ui.today, m); setF('weight', '75.2', m); setF('waist', '78', m); setF('fat', '18', m);
    click(byAct('save-body'));
    ok('体重已记录', txt().indexOf('75.2') >= 0);

    /* ---- 8. 数据随 state 整体序列化 ---- */
    var parsed = JSON.parse(localStorage.getItem('workout_log_v1'));
    ok('diet 进主存储', !!parsed.diet && !!parsed.diet.log && !!parsed.diet.goal);
    ok('body 进主存储', Array.isArray(parsed.body) && parsed.body.length > 0);
    ok('饮食记录进存储', Object.keys(parsed.diet.log).some(function (d) { return parsed.diet.log[d].length > 0; }));
    ok('目标进存储', parsed.diet.goal.height === 175);

    /* ---- 9. TDEE 计算正确性（Mifflin-St Jeor 男 75kg/175cm/30 = 1699 ≈ TDEE 2634） ---- */
    goTab('diet');
    var bmr = dietBMR(), tdee = dietTDEE();
    ok('BMR 公式正确', Math.abs(bmr - (10*dietWeight()+6.25*175-5*30+5)) < 1);
    ok('TDEE= BMR*活动系数', Math.abs(tdee - Math.round(bmr * 1.55)) < 2);
    var tg = dietTargets(ui.today);
    ok('目标热量有值', tg && tg.kcal > 0 && tg.p > 0 && tg.c > 0 && tg.f > 0);
    ok('蛋白按 1.8g/kg', tg && Math.abs(tg.p - 135) < 2);

    /* ---- 10. 布局完整性 ---- */
    ui.tab = 'diet'; render();
    ok('饮食页可再次打开', txt().indexOf('今日四餐') >= 0);
    var app = document.getElementById('app');
    ok('无横向溢出', app.scrollWidth <= app.clientWidth + 2);
    /* ---- 11. BUG 回归：体重留空 / 输入法重绘 / 热量下限 / 失效组合 / 脏日期 ---- */
    state.body = []; state.diet.goal = {}; state.diet.goalSet = false; save();
    ui.tab = 'diet'; render();
    click(byAct('diet-goal'));
    setF('age', '30'); setF('height', '175'); setF('weight', '');
    ok('体重字段留空', qs('#modal [data-f="weight"]').value === '');
    click(byAct('diet-goal-save'));
    ok('空体重不写死 30kg', state.diet.goal.weight === 0);
    ok('缺体重时提示补填而非假 TDEE', txt().indexOf('目标还缺体重') >= 0 && txt().indexOf('TDEE ') < 0);
    click(byAct('diet-picker'));
    var s1 = qs('#dietSearch');
    ok('搜索框存在', !!s1);
    input('#dietSearch', '鸡');
    ok('搜索输入不重建输入框（中文 IME 不中断）', qs('#dietSearch') === s1);
    input('#dietSearch', '鸡胸');
    ok('搜索词保留', qs('#dietSearch').value === '鸡胸');
    ok('搜索结果已过滤', qsa('[data-act="diet-pick"]').length > 0 && qsa('[data-act="diet-pick"]').length < 20);
    closeModal();
    state.body = []; state.diet.goal = { sex: 'm', age: 30, height: 180, weight: 250, activity: 1.55, proteinPerKg: 3, fatPerKg: 2, rate: -1 }; save();
    var ex = dietTargets(ui.today);
    ok('极端目标下热量不低于三大营养素之和', ex.kcal >= ex.p * 4 + ex.c * 4 + ex.f * 9 - 2);
    state.diet.favs = [{ id: 'fvbad', name: '失效', items: [{ fid: 'NOPE', grams: 100, meal: 'lunch' }], ts: Date.now() }]; save();
    useDietFav('fvbad');
    ok('失效组合不误报已记入', qs('#toast').textContent.indexOf('失效') >= 0);
    state.body = [{ date: 'bad-date', weight: 60 }, { date: ui.today, weight: 71 }]; save();
    ok('脏日期不冒充最新体重', dietWeight() === 71);
    ok('脏日期不进体重曲线', dietWeightMA().list.length === 1);
    state.body = [{ date: shiftDayStr(ui.today, -21), weight: 70 }, { date: ui.today, weight: 72 }]; save();
    var wh = dietWeightChartHTML();
    ok('断记 3 周时周均按实际间隔折算', wh.indexOf('+0.67') >= 0 && wh.indexOf('跨 3 周') >= 0);
    click(byAct('diet-picker'));
    input('#dietSearch', '蓝莓');
    ok('搜蓝莓同时出现鲜 / 冷冻两条', qsa('[data-act="diet-pick"]').length >= 2 && qs('#modal').textContent.indexOf('冷冻蓝莓') >= 0);
    input('#dietSearch', '冷冻蓝莓');
    ok('搜冷冻蓝莓精确命中', qsa('[data-act="diet-pick"]').length === 1 && qs('#modal').textContent.indexOf('冷冻蓝莓') >= 0);
    ok('补剂含酵母蛋白粉', !!foodById('p016') && foodById('p016').acc === 'e');
    ok('补剂含豌豆 / 大豆 / 胶原蛋白肽', !!foodById('p017') && !!foodById('p018') && !!foodById('p019'));
    ok('补剂含 EAA / HMB', !!foodById('p023') && !!foodById('p024'));
    ok('补剂含鱼油 / 磷虾油 / 藻油', !!foodById('p006') && !!foodById('p032') && !!foodById('p033'));
    ok('补剂含完整维生素族', ['p038', 'p039', 'p040', 'p042', 'p046'].every(function (id) { return !!foodById(id); }));
    ok('补剂含矿物质 / 关节 / 代谢类', ['p050', 'p058', 'p063', 'p071'].every(function (id) { return !!foodById(id); }));
    ok('补剂总数达 80+', foodDB().filter(function (f) { return f.cat === '补剂'; }).length >= 80);
    ok('家常菜食堂类达 90 项且全为估算', foodDB().filter(function (f) { return f.cat === '家常菜食堂'; }).length >= 90 && foodDB().filter(function (f) { return f.cat === '家常菜食堂'; }).every(function (f) { return f.acc === 'e'; }));
    ok('家常素炒覆盖炒白菜/包菜/豆芽/茄子', ['h051', 'h058', 'h066', 'h076'].every(function (id) { return !!foodById(id); }));
    ok('山东鲁菜类达 78 项且全为估算', foodDB().filter(function (f) { return f.cat === '山东鲁菜'; }).length >= 78 && foodDB().filter(function (f) { return f.cat === '山东鲁菜'; }).every(function (f) { return f.acc === 'e'; }));
    ok('山东代表菜齐全', ['sd006', 'sd018', 'sd021', 'sd037', 'sd060', 'sd046'].every(function (id) { return !!foodById(id); }));
    var h001 = foodById('h001');
    ok('家常菜份量换算正确（番茄炒蛋1份200g=210kcal）', !!h001 && Math.round(h001.kcal * h001.portions[0].g / 100) === 210);
    var w001 = foodById('w001');
    ok('外卖口径已修正（黄焖鸡1份400g=700kcal非2800）', !!w001 && Math.round(w001.kcal * w001.portions[0].g / 100) === 700);
    input('#dietSearch', '酵母蛋白');
    ok('搜酵母蛋白命中并显示区间', qsa('[data-act="diet-pick"]').length === 1 && qs('#modal').textContent.indexOf('–') >= 0);
    closeModal();

    /* ---- 边界防护：极端克数 / 脏数据 ---- */
    var c0 = dietDay(ui.today).length;
    ok('负数克数不入账', dietAddEntry('v001', -100, 'snack', ui.today) === false && dietDay(ui.today).length === c0);
    ok('零克数不入账', dietAddEntry('v001', 0, 'snack', ui.today) === false);
    ok('超大克数（100kg）被拦', dietAddEntry('v001', 100000, 'snack', ui.today) === false && dietDay(ui.today).length === c0);
    ok('5000g 边界内可入账', dietAddEntry('v001', 5000, 'snack', ui.today) === true);
    dietDelEntry(dietDay(ui.today).slice(-1)[0].id, ui.today); // 还原
    ok('云同步快照含饮食', !!(cloudSnapshot().diet && cloudSnapshot().diet.log));
  } catch (e) {
    R.fail++; R.errors.push('EXCEPTION: ' + (e && e.message ? e.message : String(e)));
  }
  document.title = 'RESULT:' + JSON.stringify(R);
})();
