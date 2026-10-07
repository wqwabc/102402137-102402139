/* my.js —— 我的发布：默认已登录，直接查看并管理当前用户的信息 */
(function () {
  'use strict';
  App.setActiveNav('my');

  // 默认已登录：当前用户即发布者，直接展示，无需输入学号
  var who = Store.CURRENT_USER_ID;
  var tab = 'all';

  var AVATARS = ['🐱', '🐶', '📚', '🎧', '⚽', '🚀', '🐼', '🌟', '🍀', '🎮'];
  var chosenAvatar = Store.getProfile().avatar;

  function renderProfile() {
    var prof = Store.getProfile();
    document.getElementById('pName').textContent = prof.name;
    document.getElementById('pCollege').textContent = prof.college + ' · ' + prof.campus;
    document.getElementById('pAvatar').innerHTML = App.avatarHtml(prof.avatar);
  }
  renderProfile();

  function renderAvatarPicker() {
    var box = document.getElementById('pf_avatar');
    box.innerHTML = AVATARS.map(function (a) {
      return '<span class="av' + (a === chosenAvatar ? ' active' : '') + '" data-a="' + a + '">' + a + '</span>';
    }).join('');
    box.querySelectorAll('.av').forEach(function (el) {
      el.addEventListener('click', function () {
        chosenAvatar = el.getAttribute('data-a');
        box.querySelectorAll('.av').forEach(function (x) { x.classList.remove('active'); });
        el.classList.add('active');
        refreshAvatarPreview();
      });
    });
  }

  // 上传头像：居中裁剪成 120px 方图，存 base64
  var avatarFile = document.getElementById('pfAvatarFile');
  var avatarUpload = document.getElementById('pfAvatarUpload');
  var avatarPreview = document.getElementById('pfAvatarPreview');
  var avatarHint = document.getElementById('pfAvatarHint');
  function refreshAvatarPreview() {
    if (chosenAvatar && chosenAvatar.indexOf('data:image') === 0) {
      avatarPreview.innerHTML = '<img src="' + chosenAvatar + '" alt="">';
      avatarPreview.style.display = 'flex';
      avatarHint.style.display = 'none';
    } else {
      avatarPreview.style.display = 'none';
      avatarHint.style.display = '';
    }
  }
  avatarUpload.addEventListener('click', function () { avatarFile.click(); });
  avatarFile.addEventListener('change', function () {
    var file = avatarFile.files && avatarFile.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (ev) {
      var img = new Image();
      img.onload = function () {
        var S = 120, side = Math.min(img.width, img.height);
        var c = document.createElement('canvas');
        c.width = S; c.height = S;
        c.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, S, S);
        chosenAvatar = c.toDataURL('image/jpeg', 0.8);
        refreshAvatarPreview();
        document.querySelectorAll('#pf_avatar .av').forEach(function (x) { x.classList.remove('active'); });
      };
      img.src = ev.target.result;
    };
    reader.readAsText(file);
  });

  // 编辑个人信息
  var mask = document.getElementById('editMask');
  function openEditModal() {
    var prof = Store.getProfile();
    chosenAvatar = prof.avatar;
    document.getElementById('pf_name').value = prof.name;
    document.getElementById('pf_college').value = prof.college;
    document.getElementById('pf_campus').value = prof.campus;
    document.getElementById('pf_phone').value = prof.phone;
    document.getElementById('pf_wechat').value = prof.wechat;
    document.getElementById('pf_qq').value = prof.qq;
    renderAvatarPicker();
    refreshAvatarPreview();
    mask.style.display = 'flex';
  }
  document.getElementById('editBtn').addEventListener('click', openEditModal);
  document.getElementById('pfCancel').addEventListener('click', function () { mask.style.display = 'none'; });
  mask.addEventListener('click', function (e) { if (e.target === mask) mask.style.display = 'none'; });
  document.getElementById('pfSave').addEventListener('click', function () {
    Store.saveProfile({
      name: document.getElementById('pf_name').value,
      college: document.getElementById('pf_college').value,
      campus: document.getElementById('pf_campus').value,
      avatar: chosenAvatar,
      phone: document.getElementById('pf_phone').value,
      wechat: document.getElementById('pf_wechat').value,
      qq: document.getElementById('pf_qq').value
    });
    mask.style.display = 'none';
    renderProfile();
    App.toast('个人信息已保存');
  });

  document.querySelectorAll('.tabs .tab').forEach(function (t) {
    t.addEventListener('click', function () {
      document.querySelectorAll('.tabs .tab').forEach(function (x) { x.classList.remove('active'); });
      t.classList.add('active');
      tab = t.getAttribute('data-type');
      render();
    });
  });

  function render() {
    var all = Store.getByPublisher(who);
    var sum = Store.summarize(all);
    document.getElementById('stTotal').textContent = sum.total;
    document.getElementById('stDone').textContent = sum.resolved;
    document.getElementById('stViews').textContent = sum.views;

    var items = all.filter(function (it) { return tab === 'all' || it.type === tab; });
    document.getElementById('count').textContent = '共 ' + items.length + ' 条';
    var listEl = document.getElementById('myList');
    if (!items.length) {
      listEl.innerHTML = '<div class="empty"><div class="big">📭</div><p>这里还没有你发布的信息<br><a href="publish.html" style="color:var(--primary);font-weight:600;">去发布第一条</a></p></div>';
      return;
    }
    listEl.innerHTML = items.map(function (it) { return App.cardHtml(it, 'my'); }).join('');
  }

  // 从首页右上角按钮跳入：自动打开编辑弹窗
  if (App.qs('edit')) openEditModal();

  render();
})();
