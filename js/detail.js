/* detail.js —— 详情页：展示详情 + 联系发布者（一键复制）+ 发布者状态维护 */
(function () {
  'use strict';
  App.setActiveNav('');

  var root = document.getElementById('detailRoot');
  var id = App.qs('id');
  var item = Store.getById(id);

  if (!item) {
    root.innerHTML = '<div class="empty"><div class="big">🤔</div><p>找不到这条信息，可能已被删除</p><a class="btn" href="index.html">返回首页</a></div>';
    return;
  }
  Store.incrViews(id);

  // “返回”按钮根据来源跳回：我的 -> my.html，搜索 -> search.html，否则首页
  var from = App.qs('from');
  var backHref = from === 'my' ? 'my.html' : (from === 'search' ? 'search.html' : 'index.html');
  var backLink = document.querySelector('.topbar .back');
  if (backLink) backLink.setAttribute('href', backHref);

  var heroClass = item.type === 'found' ? 'hero-found' : 'hero-lost';
  var locLabel = item.type === 'lost' ? '丢失地点' : '拾取地点';
  var timeLabel = item.type === 'lost' ? '丢失时间' : '拾取时间';
  var resolved = item.status === 'resolved';
  var isOwner = (item.publisher === Store.CURRENT_USER_ID);

  root.innerHTML =
    '<div class="detail-hero ' + heroClass + '">' +
      '<div class="topline">' + App.typeBadge(item) +
        '<span>' + (resolved ? (item.type === 'lost' ? '已找到 · ' : '已归还 · ') : '进行中 · ') +
        '发布于 ' + App.fmtTime(item.createdAt) + '</span></div>' +
      '<div class="main">' +
        '<div class="big-icon">' + App.catIcon(item.category) + '</div>' +
        '<div><h2>' + App.escapeHtml(item.title) + '</h2>' +
        '<div class="sub">' + App.escapeHtml(item.description ? item.description.slice(0, 24) : '暂无描述') + '…</div></div>' +
      '</div>' +
    '</div>' +

    '<div class="section">' +
      row('物品分类', item.category) +
      row(locLabel, item.location) +
      row(timeLabel, item.time) +
      row('信息编号', item.code) +
      row('浏览次数', (item.views || 0) + ' 次') +
    '</div>' +

    '<div class="section"><h3>📝 详细描述</h3>' +
      '<div class="desc-text">' + App.escapeHtml(item.description || '（发布者未填写描述）') + '</div>' +
    '</div>' +

    '<div class="section"><h3>👤 发布者</h3>' +
      '<div class="publisher">' +
        '<div class="avatar">' + App.escapeHtml(item.contactName.charAt(0).toUpperCase()) + '</div>' +
        '<div class="info"><div class="n">' + App.escapeHtml(item.contactName) + '</div>' +
        '<div class="d">学号：' + App.escapeHtml(item.publisher) + '</div></div>' +
      '</div>' +
    '</div>' +

    '<div class="section"><h3>📞 联系方式</h3>' +
      '<div id="contactArea"></div>' +
    '</div>' +

    (isOwner
      ? '<div class="section"><h3>🛠️ 发布者管理</h3><div id="ownerBtns"></div></div>'
      : '');

  function row(k, v) {
    return '<div class="row"><span class="k">' + k + '</span><span class="v">' + App.escapeHtml(v || '—') + '</span></div>';
  }

  // 联系方式：先隐藏，点击后展示并支持一键复制
  var contactArea = document.getElementById('contactArea');
  function renderContactHidden() {
    contactArea.innerHTML =
      '<div class="contact-hidden">出于隐私保护，联系方式需点击下方按钮查看<br>' +
      '<small>请勿将联系方式用于其它用途</small></div>' +
      '<button class="btn" id="revealBtn">联系' + (item.type === 'found' ? '拾取人' : '失主') + '</button>';
    document.getElementById('revealBtn').addEventListener('click', function () {
      renderContactShown();
    });
  }
  function renderContactShown() {
    var rows = [];
    if (item.contactPhone) rows.push(['📱 手机', item.contactPhone]);
    if (item.contactQq) rows.push(['💬 QQ', item.contactQq]);
    if (item.contactWechat) rows.push(['🟢 微信', item.contactWechat]);
    contactArea.innerHTML = '<div class="contact-shown">' + rows.map(function (r) {
      return '<div class="c-row"><span>' + r[0] + '：<b>' + App.escapeHtml(r[1]) + '</b></span>' +
        '<button class="copy" data-v="' + App.escapeHtml(r[1]) + '">复制</button></div>';
    }).join('') + '</div>';
    contactArea.querySelectorAll('.copy').forEach(function (btn) {
      btn.addEventListener('click', function () {
        App.copyText(btn.getAttribute('data-v')).then(function () { App.toast('已复制到剪贴板'); });
      });
    });
  }
  renderContactHidden();

  // 发布者管理：已登录且为本人时，直接显示状态维护按钮，无需再核对学号
  if (isOwner) {
    var ownerBtns = document.getElementById('ownerBtns');
    var doneLabel = item.type === 'lost' ? '标记为已找到' : '标记为已归还';
    ownerBtns.innerHTML =
      (resolved
        ? '<button class="btn small" id="reopenBtn">↩ 重新标记为进行中</button>'
        : '<button class="btn small" id="doneBtn">✔ ' + doneLabel + '</button>') +
      ' <button class="btn small danger" id="delBtn">🗑 删除这条信息</button>';
    var reopen = document.getElementById('reopenBtn');
    if (reopen) reopen.addEventListener('click', function () {
      Store.updateStatus(item.id, 'active'); App.toast('已重新标记为进行中'); setTimeout(function(){ location.reload(); }, 600);
    });
    var done = document.getElementById('doneBtn');
    if (done) done.addEventListener('click', function () {
      Store.updateStatus(item.id, 'resolved'); App.toast(doneLabel + '，已减少重复打扰'); setTimeout(function(){ location.reload(); }, 700);
    });
    document.getElementById('delBtn').addEventListener('click', function () {
      if (confirm('确定删除这条信息吗？删除后不可恢复。')) {
        Store.remove(item.id);
        App.toast('已删除');
        setTimeout(function () { location.href = 'my.html'; }, 700);
      }
    });
  }
})();
