/* index.js —— 首页：浏览 + 关键词搜索 + 类型/分类筛选 */
(function () {
  'use strict';
  App.setActiveNav('home');

  var state = { type: 'all', category: 'all', keyword: '' };

  var listEl = document.getElementById('list');
  var countEl = document.getElementById('count');
  var kwEl = document.getElementById('kw');

  // 渲染分类筛选胶囊
  function renderCatChips() {
    var box = document.getElementById('catChips');
    var html = '<span class="chip' + (state.category === 'all' ? ' active' : '') + '" data-cat="all">全部分类</span>';
    Store.CATEGORIES.forEach(function (c) {
      html += '<span class="chip' + (state.category === c ? ' active' : '') + '" data-cat="' + App.escapeHtml(c) + '">' + App.escapeHtml(c) + '</span>';
    });
    box.innerHTML = html;
  }

  function render() {
    var items = Store.query(state);
    document.getElementById('count').textContent = '共 ' + items.length + ' 条';
    if (!items.length) {
      listEl.innerHTML = '<div class="empty"><div class="big">🗂️</div><p>没有找到相关信息<br>换个关键词或筛选条件试试</p></div>';
      return;
    }
    listEl.innerHTML = items.map(function (it) { return App.cardHtml(it); }).join('');
  }

  function renderStats() {
    var s = Store.getStats();
    document.getElementById('stats').textContent =
      '今日新增 ' + s.todayNew + ' 条信息 · 本周已成功归还 ' + s.weekResolved + ' 件物品';
  }

  // 事件：顶部 tabs（全部/寻物/招领）
  document.querySelectorAll('.tabs .tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      document.querySelectorAll('.tabs .tab').forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');
      state.type = tab.getAttribute('data-type');
      render();
    });
  });

  // 事件：分类胶囊（事件委托）
  document.getElementById('catChips').addEventListener('click', function (e) {
    var chip = e.target.closest('.chip');
    if (!chip) return;
    state.category = chip.getAttribute('data-cat');
    renderCatChips();
    render();
  });

  // 事件：搜索
  kwEl.addEventListener('input', function () {
    state.keyword = kwEl.value.trim();
    render();
  });

  renderCatChips();
  renderStats();
  render();
})();
