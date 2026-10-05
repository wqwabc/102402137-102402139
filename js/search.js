/* search.js —— 搜索页：关键词 + 类型筛选 + 热门搜索 */
(function () {
  'use strict';
  App.setActiveNav('search');

  var HOT = ['校园卡', '雨伞', '耳机', '眼镜', '书包', '保温杯'];
  var state = { type: 'all', keyword: '' };
  var kwEl = document.getElementById('kw');
  var listEl = document.getElementById('list');

  // 热门搜索
  var hotBox = document.getElementById('hot');
  hotBox.innerHTML = HOT.map(function (w) {
    return '<span class="chip" data-w="' + App.escapeHtml(w) + '">' + App.escapeHtml(w) + '</span>';
  }).join('');
  hotBox.addEventListener('click', function (e) {
    var chip = e.target.closest('.chip');
    if (!chip) return;
    kwEl.value = chip.getAttribute('data-w');
    doSearch();
  });

  function render() {
    var items = Store.query(state);
    document.getElementById('count').textContent = '共 ' + items.length + ' 条';
    if (!items.length) {
      listEl.innerHTML = '<div class="empty"><div class="big">😕</div><p>未找到与“' + App.escapeHtml(state.keyword) + '”相关的信息<br>换个关键词试试，或去发布一条</p></div>';
      return;
    }
    listEl.innerHTML = items.map(App.cardHtml).join('');
  }

  function doSearch() {
    state.keyword = kwEl.value.trim();
    render();
  }

  document.getElementById('go').addEventListener('click', doSearch);
  kwEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') doSearch(); });

  document.querySelectorAll('.tabs .tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      document.querySelectorAll('.tabs .tab').forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');
      state.type = tab.getAttribute('data-type');
      render();
    });
  });

  render();
})();
