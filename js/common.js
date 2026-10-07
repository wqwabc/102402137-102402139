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

  // 关键词高亮：先转义再包 <mark>，大小写不敏感、支持一处文本多次命中
  // 返回的仍是安全的 HTML 片段（所有原文片段都经过 escapeHtml）
  function highlight(text, keyword) {
    var s = (text == null) ? '' : String(text);
    var kw = (keyword == null) ? '' : String(keyword).trim();
    if (!kw) return escapeHtml(s);
    var lower = s.toLowerCase();
    var target = kw.toLowerCase();
    var out = '', from = 0, idx;
    while ((idx = lower.indexOf(target, from)) !== -1) {
      out += escapeHtml(s.slice(from, idx)) +
        '<mark class="hl">' + escapeHtml(s.slice(idx, idx + kw.length)) + '</mark>';
      from = idx + kw.length;
    }
    return out + escapeHtml(s.slice(from));
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

  // 头像渲染：上传的图片(dataURL)显示为圆形裁剪图，否则按 emoji 文本显示
  function avatarHtml(a) {
    if (a && a.indexOf('data:image') === 0) {
      return '<img src="' + a + '" alt="头像" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">';
    }
    return escapeHtml(a || '我');
  }

  // 渲染一条物品卡片（首页/搜索/我的列表通用）
  // from: 可选来源标记（'my' / 'search'），详情页据此决定“返回”跳回哪里
  // keyword: 可选搜索关键词，命中时高亮显示
  function cardHtml(item, from, keyword) {
    var href = 'detail.html?id=' + encodeURIComponent(item.id) +
      (from ? '&from=' + encodeURIComponent(from) : '');
    return '' +
      '<a class="card' + (item.status === 'resolved' ? ' resolved' : '') + '" href="' + href + '" data-id="' + escapeHtml(item.id) + '">' +
        '<div class="card-icon cat-' + escapeHtml(item.category) + '">' +
          (item.photo ? '<img class="cat-img" src="' + item.photo + '" alt="物品照片">' : (item.icon || catIcon(item.category))) +
        '</div>' +
        '<div class="card-body">' +
          '<div class="card-title-row">' + typeBadge(item) +
            '<span class="card-title">' + highlight(item.title, keyword) + '</span>' +
          '</div>' +
          '<div class="card-desc">' + highlight(item.description || '暂无描述', keyword) + '</div>' +
          '<div class="card-meta">' +
            '<span class="loc">📍 ' + highlight(item.location, keyword) + '</span>' +
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

  // 悬浮预览：鼠标停在卡片上时浮出简介/照片
  function initCardPreview() {
    var box = document.getElementById('cardPreview');
    if (!box) {
      box = document.createElement('div');
      box.id = 'cardPreview';
      document.body.appendChild(box);
    }
    function show(id, x, y) {
      var it = (typeof Store !== 'undefined' && Store.getById) ? Store.getById(id) : null;
      if (!it) { box.style.display = 'none'; return; }
      var photo = it.photo ? '<img class="pv-photo" src="' + it.photo + '" alt="物品照片">' : '';
      box.innerHTML =
        photo +
        '<div class="pv-title">' + typeBadge(it) + ' ' + escapeHtml(it.title) + '</div>' +
        '<div class="pv-desc">' + escapeHtml(it.description || '（暂无描述）') + '</div>' +
        '<div class="pv-meta">📍 ' + escapeHtml(it.location || '—') + ' · ' + escapeHtml(it.time || '') + '</div>';
      box.style.display = 'block';
      move(x, y);
    }
    function move(x, y) {
      var w = box.offsetWidth, h = box.offsetHeight;
      var left = x - w / 2;
      var top = y - h - 16;            // 浮在鼠标上方
      if (left < 8) left = 8;
      if (left + w > window.innerWidth - 8) left = window.innerWidth - w - 8;
      if (top < 8) top = y + 16;       // 上方空间不够就改到下方
      box.style.left = left + 'px';
      box.style.top = top + 'px';
    }
    document.addEventListener('mouseover', function (e) {
      var card = e.target.closest('.card');
      if (!card) return;
      show(card.getAttribute('data-id'), e.clientX, e.clientY);
    });
    document.addEventListener('mousemove', function (e) {
      if (box.style.display === 'block') move(e.clientX, e.clientY);
    });
    document.addEventListener('mouseout', function (e) {
      var card = e.target.closest('.card');
      if (card && !card.contains(e.relatedTarget)) box.style.display = 'none';
    });
  }
  initCardPreview();

  function qs(name) {
    var m = new RegExp('[?&]' + name + '=([^&]*)').exec(location.search);
    return m ? decodeURIComponent(m[1]) : '';
  }

  // 「加载更多」按钮（p 为 Store.paginate 的返回值；纯字符串，便于单测）
  function moreHtml(p) {
    if (!p || !p.total) return '';
    if (!p.hasMore) return '<div class="list-end">— 已经到底啦 —</div>';
    return '<button type="button" class="more-btn" id="moreBtn">加载更多（还有 ' +
      (p.total - p.loaded) + ' 条）</button>';
  }

  global.App = {
    escapeHtml: escapeHtml,
    highlight: highlight,
    fmtTime: fmtTime,
    statusText: statusText,
    statusClass: statusClass,
    typeBadge: typeBadge,
    catIcon: catIcon,
    avatarHtml: avatarHtml,
    cardHtml: cardHtml,
    moreHtml: moreHtml,
    copyText: copyText,
    toast: toast,
    setActiveNav: setActiveNav,
    qs: qs
  };

  // 浏览器里挂到 window.App；Node 里导出，便于单元测试
  if (typeof module !== 'undefined' && module.exports) module.exports = App;
})(typeof globalThis !== 'undefined' ? globalThis : this);
