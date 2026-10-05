/* my.js —— 我的发布：默认已登录，直接查看并管理当前用户的信息 */
(function () {
  'use strict';
  App.setActiveNav('my');

  // 默认已登录：当前用户即发布者，直接展示，无需输入学号
  var who = Store.CURRENT_USER_ID;
  var tab = 'all';

  document.getElementById('pName').textContent = who;
  document.getElementById('pAvatar').textContent = who.charAt(0).toUpperCase();

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
    var done = all.filter(function (it) { return it.status === 'resolved'; }).length;
    document.getElementById('stTotal').textContent = all.length;
    document.getElementById('stDone').textContent = done;

    var items = all.filter(function (it) { return tab === 'all' || it.type === tab; });
    document.getElementById('count').textContent = '共 ' + items.length + ' 条';
    var listEl = document.getElementById('myList');
    if (!items.length) {
      listEl.innerHTML = '<div class="empty"><div class="big">📭</div><p>这里还没有你发布的信息<br><a href="publish.html" style="color:var(--primary);font-weight:600;">去发布第一条</a></p></div>';
      return;
    }
    listEl.innerHTML = items.map(App.cardHtml).join('');
  }

  render();
})();
