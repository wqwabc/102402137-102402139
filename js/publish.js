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

  // 把表单里的内容收集成一个对象（发布与“草稿自动保存”共用）
  function collect() {
    var date = document.getElementById('f_date').value;   // yyyy-mm-dd
    var time = document.getElementById('f_time').value;   // hh:mm
    return {
      type: state.type,
      title: document.getElementById('f_title').value,
      category: state.category,
      location: document.getElementById('f_location').value,
      time: (date && time) ? (date + ' ' + time) : (date || ''),
      date: date,
      clock: time,
      description: document.getElementById('f_desc').value,
      contactName: document.getElementById('f_name').value,
      contactPhone: document.getElementById('f_phone').value,
      contactQq: document.getElementById('f_qq').value,
      contactWechat: document.getElementById('f_wechat').value,
      photo: pendingPhoto,
      icon: chosenIcon
    };
  }

  // ---------- 草稿自动保存 ----------
  // 目的：填了一半不小心关掉页面/刷新，内容不会白填。照片是 base64，体积大，不入草稿。
  var draftBar = document.getElementById('draftBar');
  var draftHint = document.getElementById('draftHint');
  var draftTimer = null;

  function draftHasContent(f) {
    var texts = [f.title, f.location, f.description, f.contactPhone, f.contactQq, f.contactWechat];
    for (var i = 0; i < texts.length; i++) if ((texts[i] || '').trim()) return true;
    return !!f.category;
  }

  function scheduleDraftSave() {
    if (editId) return;                     // 编辑已有信息时不写草稿
    clearTimeout(draftTimer);
    draftTimer = setTimeout(function () {
      var f = collect();
      if (!draftHasContent(f)) { Store.clearDraft(); draftHint.textContent = ''; return; }
      var d = Store.saveDraft({ form: f });
      if (d) draftHint.textContent = '草稿已自动保存 · ' + App.fmtTime(d.savedAt);
    }, 400);
  }

  document.getElementById('formView').addEventListener('input', scheduleDraftSave);
  document.getElementById('formView').addEventListener('change', scheduleDraftSave);

  // 打开页面时若存在草稿，先问一句要不要恢复（不直接覆盖空表单）
  function showDraftBar(draft) {
    if (!draft) return;
    document.getElementById('draftText').textContent =
      '检测到 ' + App.fmtTime(draft.savedAt) + ' 保存的草稿，要恢复吗？';
    draftBar.style.display = 'flex';
  }

  function applyDraft(form) {
    state.type = form.type === 'found' ? 'found' : 'lost';
    state.category = form.category || '';
    document.getElementById('f_title').value = form.title || '';
    document.getElementById('f_location').value = form.location || '';
    document.getElementById('f_date').value = form.date || '';
    document.getElementById('f_time').value = form.clock || '';
    document.getElementById('f_desc').value = form.description || '';
    document.getElementById('f_name').value = form.contactName || '';
    document.getElementById('f_phone').value = form.contactPhone || '';
    document.getElementById('f_qq').value = form.contactQq || '';
    document.getElementById('f_wechat').value = form.contactWechat || '';
    chosenIcon = form.icon || '';
    catBox.querySelectorAll('.cat-chip').forEach(function (c) {
      c.classList.toggle('active', c.getAttribute('data-c') === state.category);
    });
    renderIconPicker();
    syncType();
  }

  document.getElementById('draftRestore').addEventListener('click', function () {
    var d = Store.getDraft();
    if (d) { applyDraft(d.form); App.toast('草稿已恢复'); }
    draftBar.style.display = 'none';
  });

  document.getElementById('draftDiscard').addEventListener('click', function () {
    Store.clearDraft();
    draftBar.style.display = 'none';
    draftHint.textContent = '';
    App.toast('已丢弃草稿');
  });

  document.getElementById('submitBtn').addEventListener('click', function () {
    var raw = collect();
    var wasEdit = !!editId;
    var res = wasEdit ? Store.updateItem(editId, raw) : Store.add(raw);
    if (!res.ok) { showErrors(res.errors); return; }
    editId = '';   // 保存后回到“新增”模式
    Store.clearDraft();
    draftHint.textContent = '';

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

    // 智能配对：找相反类型、同分类、标题相似的在途信息
    var matchBox = document.getElementById('matchBox');
    var matches = Store.findMatches(it);
    if (matches.length) {
      var noun = it.type === 'lost' ? '招领' : '寻物';
      matchBox.innerHTML =
        '<div class="match-tip">💡 发布成功！系统发现 <b>' + matches.length + '</b> 条可能和你相关的' + noun + '，先看看是不是你要找的：</div>' +
        matches.map(function (m) {
          return '<a class="match-item" href="detail.html?id=' + encodeURIComponent(m.id) + '">' +
            App.typeBadge(m) +
            '<span class="mt-title">' + App.escapeHtml(m.title) + '</span>' +
            '<span class="go">查看›</span></a>';
        }).join('');
      matchBox.style.display = 'block';
    } else {
      matchBox.style.display = 'none';
    }

    window.scrollTo(0, 0);
  });

  document.getElementById('againBtn').addEventListener('click', function () {
    document.getElementById('formView').style.display = '';
    document.getElementById('successView').style.display = 'none';
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
  else showDraftBar(Store.getDraft());

  syncType();
})();
