/* publish.js —— 发布表单：类型选择、分类选择、校验、提交、成功页 */
(function () {
  'use strict';
  App.setActiveNav('publish');

  var state = { type: App.qs('type') === 'found' ? 'found' : 'lost', category: '' };
  var editId = App.qs('edit') || '';   // 有 ?edit=<id> 即为编辑模式

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
    chosenIcon = App.catIcon(state.category);   // 选分类时默认带对应图标
    renderIconPicker();
  });

  // ---------- 物品图标选择（可不选，默认随分类） ----------
  var ITEM_ICONS = ['🥤', '🪪', '🎧', '🌂', '🎒', '👓', '📚', '📱', '💻', '⌚', '🔑', '💰', '⚽', '🧸', '👟', '🧥'];
  var chosenIcon = '';
  var iconBox = document.getElementById('f_icon');
  function renderIconPicker() {
    iconBox.innerHTML = ITEM_ICONS.map(function (ic) {
      return '<span class="av' + (ic === chosenIcon ? ' active' : '') + '" data-ic="' + ic + '">' + ic + '</span>';
    }).join('');
  }
  renderIconPicker();
  iconBox.addEventListener('click', function (e) {
    var el = e.target.closest('.av');
    if (!el) return;
    chosenIcon = el.getAttribute('data-ic');
    renderIconPicker();
  });

  // ---------- 照片上传（FileReader + canvas 压缩为 base64） ----------
  var pendingPhoto = '';
  var photoInput = document.getElementById('f_photo');
  var photoBox = document.getElementById('photoBox');

  function readAndCompress(file, cb) {
    var reader = new FileReader();
    reader.onload = function (ev) {
      var img = new Image();
      img.onload = function () {
        var MAX = 480, w = img.width, h = img.height;
        if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
        var c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        cb(c.toDataURL('image/jpeg', 0.72));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }
  photoBox.addEventListener('click', function (e) {
    if (e.target.closest('#photoRemove')) return;
    photoInput.click();
  });
  photoInput.addEventListener('change', function () {
    var file = photoInput.files && photoInput.files[0];
    if (!file) return;
    readAndCompress(file, function (dataUrl) {
      pendingPhoto = dataUrl;
      document.getElementById('previewImg').src = dataUrl;
      document.getElementById('photoPreview').style.display = 'block';
      document.getElementById('photoPlaceholder').style.display = 'none';
    });
  });
  document.getElementById('photoRemove').addEventListener('click', function () {
    pendingPhoto = ''; photoInput.value = '';
    document.getElementById('photoPreview').style.display = 'none';
    document.getElementById('photoPlaceholder').style.display = '';
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
      contactWechat: document.getElementById('f_wechat').value,
      photo: pendingPhoto,
      icon: chosenIcon
    };
    var wasEdit = !!editId;
    var res = wasEdit ? Store.updateItem(editId, raw) : Store.add(raw);
    if (!res.ok) { showErrors(res.errors); return; }
    editId = '';   // 保存后回到“新增”模式

    // 发布成功：切换到成功页
    var it = res.item;
    document.getElementById('formView').style.display = 'none';
    document.getElementById('successView').style.display = 'block';
    document.querySelector('#successView h2').textContent = wasEdit ? '修改已保存' : '发布成功';
    document.querySelector('#successView p').textContent = wasEdit
      ? '你的信息已更新'
      : '信息已同步到首页列表，同学们可以搜索到它';
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
    document.getElementById('viewDetail').setAttribute('href',
      'detail.html?id=' + encodeURIComponent(it.id) + (wasEdit ? '&from=my' : ''));
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
    chosenIcon = ''; renderIconPicker();
    document.getElementById('errBox').classList.remove('show');
    // 清空照片
    pendingPhoto = ''; photoInput.value = '';
    document.getElementById('photoPreview').style.display = 'none';
    document.getElementById('photoPlaceholder').style.display = '';
  }

  // 用个人信息预填联系人/联系方式
  (function prefillContact() {
    var prof = Store.getProfile();
    document.getElementById('f_name').value = prof.name;
    if (prof.phone) document.getElementById('f_phone').value = prof.phone;
    if (prof.wechat) document.getElementById('f_wechat').value = prof.wechat;
    if (prof.qq) document.getElementById('f_qq').value = prof.qq;
  })();

  // 编辑模式：把已有信息填进表单
  function loadEditItem() {
    var it = Store.getById(editId);
    if (!it) { App.toast('找不到要编辑的信息'); return; }
    state.type = it.type;
    state.category = it.category;
    document.getElementById('f_title').value = it.title;
    document.getElementById('f_location').value = it.location;
    var parts = (it.time && it.time.indexOf('-') === 0) ? it.time.split(' ') : ['', ''];
    document.getElementById('f_date').value = parts[0] || '';
    document.getElementById('f_time').value = parts[1] || '';
    document.getElementById('f_desc').value = it.description || '';
    document.getElementById('f_name').value = it.contactName || '';
    document.getElementById('f_phone').value = it.contactPhone || '';
    document.getElementById('f_qq').value = it.contactQq || '';
    document.getElementById('f_wechat').value = it.contactWechat || '';
    catBox.querySelectorAll('.cat-chip').forEach(function (c) {
      c.classList.toggle('active', c.getAttribute('data-c') === it.category);
    });
    chosenIcon = it.icon || '';
    renderIconPicker();
    pendingPhoto = it.photo || '';
    if (pendingPhoto) {
      document.getElementById('previewImg').src = pendingPhoto;
      document.getElementById('photoPreview').style.display = 'block';
      document.getElementById('photoPlaceholder').style.display = 'none';
    }
    document.querySelector('.topbar h1').textContent = '编辑信息';
    document.getElementById('submitBtn').textContent = '保存修改';
    // 编辑时“返回”回到该信息详情，详情页再带 from=my 回到“我的”
    document.querySelector('.topbar .back').setAttribute('href',
      'detail.html?id=' + encodeURIComponent(editId) + '&from=my');
  }
  if (editId) loadEditItem();

  syncType();
})();
