/* search.js —— 搜索页：关键词 + 类型筛选 + 热门搜索 + 搜索历史 + 加载更多 */
(function () {
  'use strict';
  App.setActiveNav('search');

  var PAGE_SIZE = 6;
  var HOT = ['校园卡', '雨伞', '耳机', '眼镜', '书包', '保温杯'];
  var state = { type: 'all', keyword: '', page: 1 };
  var kwEl = document.getElementById('kw');
  var listEl = document.getElementById('list');
  var moreEl = document.getElementById('more');

  // ---------- 热门搜索 ----------
  var hotBox = document.getElementById('hot');
  hotBox.innerHTML = '<span class="chips-label">试试</span>' + HOT.map(function (w) {
    return '<span class="chip" data-w="' + App.escapeHtml(w) + '">' + App.escapeHtml(w) + '</span>';
  }).join('');
  hotBox.addEventListener('click', function (e) {
    var chip = e.target.closest('.chip');
    if (!chip) return;
    kwEl.value = chip.getAttribute('data-w');
    doSearch();
  });

  // ---------- 搜索历史（最近 8 条，存 localStorage） ----------
  var hisWrap = document.getElementById('historyBox');
  var hisBox = document.getElementById('history');

  function renderHistory() {
    var list = Store.getSearchHistory();
    if (!list.length) {
      hisWrap.style.display = 'none';
      hisBox.innerHTML = '';
      return;
    }
    hisWrap.style.display = 'block';
    hisBox.innerHTML = '<span class="chips-label">历史</span>' + list.map(function (w) {
      return '<span class="chip his" data-w="' + App.escapeHtml(w) + '">' + App.escapeHtml(w) +
        '<b class="del" data-del="' + App.escapeHtml(w) + '" title="删除这条记录">✕</b></span>';
    }).join('');
  }

  hisBox.addEventListener('click', function (e) {
    var del = e.target.closest('.del');
    if (del) {
      Store.removeSearchHistory(del.getAttribute('data-del'));
      renderHistory();
      return;
    }
    var chip = e.target.closest('.chip');
    if (!chip) return;
    kwEl.value = chip.getAttribute('data-w');
    doSearch();
  });

  document.getElementById('clearHistory').addEventListener('click', function () {
    Store.clearSearchHistory();
    renderHistory();
    App.toast('已清空搜索历史');
  });

  // ---------- 结果渲染 ----------
  function render() {
    var items = Store.query({ keyword: state.keyword, type: state.type });
    document.getElementById('count').textContent = '共 ' + items.length + ' 条';

    if (!items.length) {
      listEl.innerHTML =
        '<div class="empty"><div class="big">😕</div>' +
        '<p>未找到与“' + App.escapeHtml(state.keyword) + '”相关的信息<br>换个关键词试试，或去发布一条</p>' +
        '<a class="btn ghost small" href="publish.html" style="margin:14px auto 0;">去发布一条</a></div>';
      moreEl.innerHTML = '';
      return;
    }

    var page = Store.paginate(items, state.page, PAGE_SIZE);
    listEl.innerHTML = page.items.map(function (it) {
      return App.cardHtml(it, 'search', state.keyword);
    }).join('');

    moreEl.innerHTML = App.moreHtml(page);
    var btn = document.getElementById('moreBtn');
    if (btn) btn.addEventListener('click', function () { state.page++; render(); });
  }

  function doSearch() {
    state.keyword = kwEl.value.trim();
    state.page = 1;
    if (state.keyword) Store.addSearchHistory(state.keyword);
    renderHistory();
    render();
  }

  // ---------- 事件绑定 ----------
  document.getElementById('go').addEventListener('click', doSearch);
  kwEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') doSearch(); });

  document.querySelectorAll('.tabs .tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      document.querySelectorAll('.tabs .tab').forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');
      state.type = tab.getAttribute('data-type');
      state.page = 1;
      render();
    });
  });

  // ---------- 支持深链接：search.html?kw=雨伞&type=found ----------
  var initKw = App.qs('kw');
  var initType = App.qs('type');
  if (initType === 'lost' || initType === 'found') {
    state.type = initType;
    document.querySelectorAll('.tabs .tab').forEach(function (t) {
      t.classList.toggle('active', t.getAttribute('data-type') === initType);
    });
  }

  if (initKw) {
    kwEl.value = initKw;
    doSearch();          // 直接出结果，并写入搜索历史
  } else {
    renderHistory();
    render();
  }
})();
