/* my.js —— 我的发布：输入发布者标识后查看并管理自己的信息 */
(function () {
  'use strict';
  App.setActiveNav('my');

  var who = '';
  var tab = 'all';

  var whoInput = document.getElementById('whoInput');
  // 记住上次输入的发布者标识
  whoInput.value = localStorage.getItem('my_publisher') || '';

  function enter() {
    who = whoInput.value.trim();
    if (!who) { App.toast('请先输入你的发布者标识'); return; }
    localStorage.setItem('my_publisher', who);
    document.getElementById('identifyBox').style.display = 'none';
    document.getElementById('profileBox').style.display = '';
    document.getElementById('myArea').style.display = '';
    document.getElementById('pName').textContent = who;
    document.getElementById('pAvatar').textContent = who.charAt(0).toUpperCase();
    render();
  }

  document.getElementById('whoBtn').addEventListener('click', enter);
  whoInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') enter(); });

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
})();
