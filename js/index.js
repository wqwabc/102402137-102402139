/* index.js —— 首页：浏览 + 关键词搜索 + 类型/分类/地点筛选 + 排序 + 加载更多 */
(function () {
  'use strict';
  App.setActiveNav('home');

  // 右上角圆球：若上传了头像则显示头像，否则保持 👤
  var fab = document.querySelector('.fab-avatar');
  if (fab) {
    var prof = Store.getProfile();
    if (prof.avatar && prof.avatar.indexOf('data:image') === 0) {
      fab.innerHTML = '<img src="' + prof.avatar + '" alt="我的头像" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">';
      fab.style.background = '#fff';
    }
  }

  var PAGE_SIZE = 6;   // 每页条数（“加载更多”每次多显示 6 条）
  var state = {
    type: 'all', category: 'all', location: 'all',
    keyword: '', sort: 'newest', page: 1
  };

  var listEl = document.getElementById('list');
  var countEl = document.getElementById('count');
  var moreEl = document.getElementById('more');
  var kwEl = document.getElementById('kw');

  // ---------- 筛选胶囊 ----------
  function renderCatChips() {
    var box = document.getElementById('catChips');
    var html = '<span class="chips-label">分类</span>' +
      '<span class="chip' + (state.category === 'all' ? ' active' : '') + '" data-cat="all">全部</span>';
    Store.CATEGORIES.forEach(function (c) {
      html += '<span class="chip' + (state.category === c ? ' active' : '') +
        '" data-cat="' + App.escapeHtml(c) + '">' + App.escapeHtml(c) + '</span>';
    });
    box.innerHTML = html;
  }

  function renderLocChips() {
    var box = document.getElementById('locChips');
    var html = '<span class="chips-label">地点</span>' +
      '<span class="chip' + (state.location === 'all' ? ' active' : '') + '" data-loc="all">全部</span>';
    Store.HOT_LOCATIONS.forEach(function (l) {
      html += '<span class="chip' + (state.location === l ? ' active' : '') +
        '" data-loc="' + App.escapeHtml(l) + '">' + App.escapeHtml(l) + '</span>';
    });
    box.innerHTML = html;
  }

  function renderSorts() {
    document.querySelectorAll('#sorts .sort').forEach(function (el) {
      el.classList.toggle('active', el.getAttribute('data-sort') === state.sort);
    });
  }

  // ---------- 列表渲染 ----------
  function filters() {
    return {
      type: state.type, category: state.category, location: state.location,
      keyword: state.keyword, sort: state.sort
    };
  }

  function hasFilter() {
    return state.type !== 'all' || state.category !== 'all' ||
      state.location !== 'all' || !!state.keyword;
  }

  function emptyHtml() {
    return '<div class="empty"><div class="big">🗂️</div>' +
      '<p>没有找到相关信息<br>换个关键词或筛选条件试试</p>' +
      (hasFilter() ? '<button type="button" class="btn ghost small" id="resetFilters" style="margin:14px auto 0;">清空全部筛选</button>' : '') +
      '</div>';
  }

  function render() {
    var items = Store.query(filters());
    countEl.textContent = '共 ' + items.length + ' 条';

    if (!items.length) {
      listEl.innerHTML = emptyHtml();
      moreEl.innerHTML = '';
      var reset = document.getElementById('resetFilters');
      if (reset) reset.addEventListener('click', clearFilters);
      return;
    }

    var page = Store.paginate(items, state.page, PAGE_SIZE);
    listEl.innerHTML = page.items.map(function (it) {
      return App.cardHtml(it, '', state.keyword);
    }).join('');

    moreEl.innerHTML = App.moreHtml(page);
    var btn = document.getElementById('moreBtn');
    if (btn) btn.addEventListener('click', function () { state.page++; render(); });
  }

  function clearFilters() {
    state.type = 'all'; state.category = 'all'; state.location = 'all';
    state.keyword = ''; state.page = 1;
    kwEl.value = '';
    document.querySelectorAll('.tabs .tab').forEach(function (t) {
      t.classList.toggle('active', t.getAttribute('data-type') === 'all');
    });
    renderCatChips();
    renderLocChips();
    render();
  }

  function renderStats() {
    var s = Store.getStats();
    document.getElementById('stats').textContent =
      '今日新增 ' + s.todayNew + ' 条信息 · 本周已成功归还 ' + s.weekResolved + ' 件物品';
  }

  // ---------- 事件绑定 ----------
  document.querySelectorAll('.tabs .tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      document.querySelectorAll('.tabs .tab').forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');
      state.type = tab.getAttribute('data-type');
      state.page = 1;
      render();
    });
  });

  document.getElementById('catChips').addEventListener('click', function (e) {
    var chip = e.target.closest('.chip');
    if (!chip) return;
    state.category = chip.getAttribute('data-cat');
    state.page = 1;
    renderCatChips();
    render();
  });

  document.getElementById('locChips').addEventListener('click', function (e) {
    var chip = e.target.closest('.chip');
    if (!chip) return;
    state.location = chip.getAttribute('data-loc');
    state.page = 1;
    renderLocChips();
    render();
  });

  document.getElementById('sorts').addEventListener('click', function (e) {
    var el = e.target.closest('.sort');
    if (!el) return;
    state.sort = el.getAttribute('data-sort');
    state.page = 1;
    renderSorts();
    render();
  });

  kwEl.addEventListener('input', function () {
    state.keyword = kwEl.value.trim();
    state.page = 1;
    render();
  });

  renderCatChips();
  renderLocChips();
  renderSorts();
  renderStats();
  render();
})();
