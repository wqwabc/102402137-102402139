/* publish.js —— 发布表单：类型选择、分类选择、校验、提交、成功页 */
(function () {
  'use strict';
  App.setActiveNav('publish');

  var state = { type: App.qs('type') === 'found' ? 'found' : 'lost', category: '' };

  // 初始化信息类型选中（来自 URL ?type=）
  function syncType() {
    document.querySelectorAll('.type-opt').forEach(function (b) {
      b.classList.remove('sel-lost', 'sel-found');
      var t = b.getAttribute('data-type');
      if (t === state.type) b.classList.add(t === 'lost' ? 'sel-lost' : 'sel-found');
    });
    document.getElementById('locLabel').innerHTML =
      (state.type === 'lost' ? '丢失地点' : '拾取地点') + ' <span class="req">*</span>';
  }
  document.querySelectorAll('.type-opt').forEach(function (b) {
    b.addEventListener('click', function () {
      state.type = b.getAttribute('data-type');
      syncType();
    });
  });

  // 渲染分类胶囊
  var catBox = document.getElementById('f_cat');
  catBox.innerHTML = Store.CATEGORIES.map(function (c) {
    return '<span class="cat-chip" data-c="' + App.escapeHtml(c) + '">' + App.escapeHtml(c) + '</span>';
  }).join('');
  catBox.addEventListener('click', function (e) {
    var chip = e.target.closest('.cat-chip');
    if (!chip) return;
    catBox.querySelectorAll('.cat-chip').forEach(function (c) { c.classList.remove('active'); });
    chip.classList.add('active');
    state.category = chip.getAttribute('data-c');
  });

  function showErrors(errors) {
    var box = document.getElementById('errBox');
    box.querySelector('ul').innerHTML = errors.map(function (e) { return '<li>· ' + App.escapeHtml(e) + '</li>'; }).join('');
    box.classList.add('show');
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  document.getElementById('submitBtn').addEventListener('click', function () {
    var date = document.getElementById('f_date').value;   // yyyy-mm-dd
    var time = document.getElementById('f_time').value;   // hh:mm
    var raw = {
      type: state.type,
      title: document.getElementById('f_title').value,
      category: state.category,
      location: document.getElementById('f_location').value,
      time: (date && time) ? (date + ' ' + time) : (date || ''),
      description: document.getElementById('f_desc').value,
      contactName: document.getElementById('f_name').value,
      contactPhone: document.getElementById('f_phone').value,
      contactQq: document.getElementById('f_qq').value,
      contactWechat: document.getElementById('f_wechat').value
    };
    var res = Store.add(raw);
    if (!res.ok) { showErrors(res.errors); return; }

    // 发布成功：切换到成功页
    var it = res.item;
    document.getElementById('formView').style.display = 'none';
    document.getElementById('successView').style.display = 'block';
    var rows = [
      ['信息类型', it.type === 'lost' ? '寻物启事' : '失物招领'],
      ['物品名称', it.title],
      ['物品分类', it.category],
      [it.type === 'lost' ? '丢失地点' : '拾取地点', it.location],
      ['时间', it.time],
      ['信息编号', it.code]
    ];
    document.getElementById('successSummary').innerHTML =
      '<h3>本次发布</h3>' + rows.map(function (r) {
        return '<div class="row"><span class="k">' + r[0] + '</span><span class="v">' + App.escapeHtml(r[1]) + '</span></div>';
      }).join('');
    document.getElementById('viewDetail').setAttribute('href', 'detail.html?id=' + encodeURIComponent(it.id));
    window.scrollTo(0, 0);
  });

  document.getElementById('againBtn').addEventListener('click', function () {
    document.getElementById('formView').style.display = '';
    document.getElementById('successView').style.display = 'none';
    document.querySelector('#formView form') || resetForm();
    resetForm();
    window.scrollTo(0, 0);
  });

  function resetForm() {
    ['f_title', 'f_location', 'f_date', 'f_time', 'f_desc', 'f_name', 'f_phone', 'f_qq', 'f_wechat'].forEach(function (id) {
      document.getElementById(id).value = '';
    });
    state.category = '';
    catBox.querySelectorAll('.cat-chip').forEach(function (c) { c.classList.remove('active'); });
    document.getElementById('errBox').classList.remove('show');
  }

  // 用个人信息预填联系人/联系方式
  (function prefillContact() {
    var prof = Store.getProfile();
    document.getElementById('f_name').value = prof.name;
    if (prof.phone) document.getElementById('f_phone').value = prof.phone;
    if (prof.wechat) document.getElementById('f_wechat').value = prof.wechat;
    if (prof.qq) document.getElementById('f_qq').value = prof.qq;
  })();

  syncType();
})();
