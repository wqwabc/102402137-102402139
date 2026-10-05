/*
 * common.js —— 公共渲染与工具函数（挂到 window.App）
 * 每个页面都先引入它，再引入本页脚本。
 */
(function (global) {
  'use strict';

  // 转义用户输入，防止 XSS / 页面被破坏
  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // 时间友好显示：今天 HH:mm / 昨天 HH:mm / MM-DD HH:mm
  function fmtTime(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    var now = new Date();
    var p = function (n) { return String(n).padStart(2, '0'); };
    var hm = p(d.getHours()) + ':' + p(d.getMinutes());
    var sameDay = d.toDateString() === now.toDateString();
    var yest = new Date(now.getTime() - 86400000);
    if (sameDay) return '今天 ' + hm;
    if (d.toDateString() === yest.toDateString()) return '昨天 ' + hm;
    return p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + hm;
  }

  // 状态徽标：寻物->已找到，招领->已归还，否则 处理中
  function statusText(item) {
    if (item.status === 'resolved') return item.type === 'lost' ? '已找到' : '已归还';
    return '处理中';
  }
  function statusClass(item) {
    return item.status === 'resolved' ? 'st-done' : 'st-active';
  }

  // 物品类型徽标
  function typeBadge(item) {
    var label = item.type === 'lost' ? '寻物' : '招领';
    return '<span class="badge badge-' + item.type + '">' + label + '</span>';
  }

  // 类别对应的图标底色（用 emoji 作为简易图标，避免引入图片资源）
  var CAT_ICON = {
    '证件卡': '🪪', '数码电子': '🎧', '生活用品': '🥤', '雨具': '🌂',
    '包袋': '🎒', '随身物品': '👓', '图书资料': '📚', '其他': '📦'
  };
  function catIcon(cat) { return CAT_ICON[cat] || '📦'; }

  // 渲染一条物品卡片（首页/搜索/我的列表通用）
  // from: 可选来源标记（'my' / 'search'），详情页据此决定“返回”跳回哪里
  function cardHtml(item, from) {
    var href = 'detail.html?id=' + encodeURIComponent(item.id) +
      (from ? '&from=' + encodeURIComponent(from) : '');
    return '' +
      '<a class="card" href="' + href + '">' +
        '<div class="card-icon cat-' + escapeHtml(item.category) + '">' +
          (item.photo ? '<img class="cat-img" src="' + item.photo + '" alt="物品照片">' : (item.icon || catIcon(item.category))) +
        '</div>' +
        '<div class="card-body">' +
          '<div class="card-title-row">' + typeBadge(item) +
            '<span class="card-title">' + escapeHtml(item.title) + '</span>' +
          '</div>' +
          '<div class="card-desc">' + escapeHtml(item.description || '暂无描述') + '</div>' +
          '<div class="card-meta">' +
            '<span class="loc">📍 ' + escapeHtml(item.location) + '</span>' +
            '<span class="time">' + escapeHtml(fmtTime(item.createdAt)) + '</span>' +
          '</div>' +
        '</div>' +
        '<span class="badge ' + statusClass(item) + '">' + statusText(item) + '</span>' +
      '</a>';
  }

  // 复制文本（file:// 下优先用 execCommand 兜底）
  function copyText(text) {
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); return true; } catch (e) { return false; }
      finally { document.body.removeChild(ta); }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, fallback);
    }
    return Promise.resolve(fallback());
  }

  var toastTimer = null;
  function toast(msg) {
    var el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 1800);
  }

  // 底部导航高亮
  function setActiveNav(page) {
    var links = document.querySelectorAll('.tabbar a');
    links.forEach(function (a) {
      if (a.getAttribute('data-page') === page) a.classList.add('active');
    });
  }

  function qs(name) {
    var m = new RegExp('[?&]' + name + '=([^&]*)').exec(location.search);
    return m ? decodeURIComponent(m[1]) : '';
  }

  global.App = {
    escapeHtml: escapeHtml,
    fmtTime: fmtTime,
    statusText: statusText,
    statusClass: statusClass,
    typeBadge: typeBadge,
    catIcon: catIcon,
    cardHtml: cardHtml,
    copyText: copyText,
    toast: toast,
    setActiveNav: setActiveNav,
    qs: qs
  };
})(window);
