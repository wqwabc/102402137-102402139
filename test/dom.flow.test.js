/*
 * test/dom.flow.test.js —— 真·DOM 级集成测试（可选）
 *
 * 用 jsdom 把页面真正跑起来：加载 HTML、执行页面脚本、模拟点击与输入，
 * 验证“首页筛选/排序/加载更多、搜索高亮与历史、发布表单提交、详情页状态维护”在浏览器里真的能用。
 *
 * 这是可选依赖：没有安装 jsdom 时本文件整体跳过，其余测试照常运行。
 *   启用方式：npm install --no-save jsdom
 *   运行方式：node --test test/
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

let JSDOM = null;
try {
  JSDOM = require('jsdom').JSDOM;
} catch (e) {
  JSDOM = null;
}

// 浏览器里 jsdom 没实现的少数 API，补几个空实现即可
const POLYFILL = '<script>' +
  'Element.prototype.scrollIntoView = function () {};' +
  'window.confirm = function () { return true; };' +
  'window.scrollTo = function () {};' +
  'window.URL.createObjectURL = function () { return "blob:test"; };' +
  'window.URL.revokeObjectURL = function () {};' +
  '</script>';

/**
 * 把页面加载进 jsdom。
 * file:// 在 jsdom 里是“不透明源”，localStorage 不可用，
 * 所以把 <script src> 全部内联，并把 url 设成 http://localhost/。
 */
function loadPage(file, beforeScripts) {
  const split = file.split('?');
  const name = split[0];
  const query = split[1] ? '?' + split[1] : '';
  const html = fs.readFileSync(path.join(ROOT, name), 'utf8')
    .replace('<head>', '<head>' + POLYFILL + (beforeScripts || ''))
    .replace(/<script src="([^"]+)"><\/script>/g, (_, src) => {
      const code = fs.readFileSync(path.join(ROOT, src), 'utf8');
      return '<script>' + code.split('</script>').join('<\\/script>') + '</script>';
    });
  return new JSDOM(html, {
    url: 'http://localhost/' + name + query,
    runScripts: 'dangerously'
  });
}

function click(win, el) {
  el.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
}

function typeInto(win, el, value) {
  el.value = value;
  el.dispatchEvent(new win.Event('input', { bubbles: true }));
}

function testItem() {
  return {
    id: 'test-1', code: 'LF20261006001', type: 'lost', title: '测试用黑色雨伞',
    category: '雨具', location: '图书馆门口', time: '2026-10-06 09:00',
    description: '伞柄有划痕', contactName: '小明', contactPhone: '13800138000',
    contactQq: '', contactWechat: '', publisher: '102402137', status: 'active',
    createdAt: Date.now(), views: 0
  };
}

describe('DOM 集成测试（需要 jsdom，未安装则跳过）', { skip: JSDOM ? false : '未安装 jsdom，可执行 npm install --no-save jsdom 后重跑' }, () => {
  it('首页：渲染演示数据、tab 筛选、地点筛选、关键词搜索、加载更多状态', () => {
    const dom = loadPage('index.html');
    const win = dom.window, doc = win.document;
    try {
      assert.equal(doc.querySelectorAll('#list .card').length, 6, '演示数据应渲染 6 张卡片');
      assert.ok(doc.getElementById('count').textContent.includes('共 6 条'));
      assert.ok(doc.getElementById('more').textContent.includes('已经到底啦'));
      assert.ok(doc.querySelectorAll('#catChips .chip').length >= 9, '分类胶囊应渲染出来');
      assert.ok(doc.querySelectorAll('#locChips .chip').length >= 9, '地点胶囊应渲染出来');

      // 切到“招领”
      click(win, doc.querySelector('.tabs .tab[data-type="found"]'));
      assert.equal(doc.querySelectorAll('#list .card').length, 3);

      // 回到全部，再按地点筛选：演示数据里只有一条在图书馆
      click(win, doc.querySelector('.tabs .tab[data-type="all"]'));
      click(win, doc.querySelector('#locChips .chip[data-loc="图书馆"]'));
      assert.equal(doc.querySelectorAll('#list .card').length, 1);
      assert.ok(doc.querySelector('#list .card .loc').textContent.includes('图书馆'));

      // 关键词搜索 + 高亮
      click(win, doc.querySelector('#locChips .chip[data-loc="all"]'));
      typeInto(win, doc.getElementById('kw'), '雨伞');
      assert.equal(doc.querySelectorAll('#list .card').length, 1);
      assert.equal(doc.querySelector('#list .card mark.hl').textContent, '雨伞');

      // 排序切换不应该报错，列表还在
      click(win, doc.querySelector('#sorts .sort[data-sort="views"]'));
      assert.ok(doc.querySelectorAll('#list .card').length >= 1);

      // 搜不到时出现空状态与“清空全部筛选”
      typeInto(win, doc.getElementById('kw'), '不存在的物品xyz');
      assert.ok(doc.querySelector('#list .empty'));
      assert.ok(doc.getElementById('resetFilters'));
      click(win, doc.getElementById('resetFilters'));
      assert.equal(doc.querySelectorAll('#list .card').length, 6);
      assert.equal(doc.getElementById('kw').value, '');
    } finally {
      win.close();
    }
  });

  it('首页：信息超过一页时出现「加载更多」，点一次把剩下的都展示出来', () => {
    const items = Array.from({ length: 9 }, (_, i) => Object.assign(testItem(), {
      id: 'many-' + i, code: 'LF2026100600' + i, title: '测试物品' + i,
      createdAt: Date.now() - i * 60000
    }));
    const seed = '<script>localStorage.setItem("campus_lost_found_items_v1", ' +
      JSON.stringify(JSON.stringify(items)) + ');</script>';
    const dom = loadPage('index.html', seed);
    const win = dom.window, doc = win.document;
    try {
      assert.equal(doc.querySelectorAll('#list .card').length, 6, '第一页 6 条');
      const more = doc.getElementById('moreBtn');
      assert.ok(more, '应出现加载更多按钮');
      assert.ok(more.textContent.includes('还有 3 条'));
      click(win, more);
      assert.equal(doc.querySelectorAll('#list .card').length, 9, '点完后全部展示');
      assert.ok(doc.getElementById('more').textContent.includes('已经到底啦'));
    } finally {
      win.close();
    }
  });

  it('发布页：已有草稿时给出恢复提示，恢复后表单内容与类型/分类都被填回', () => {
    const draft = {
      savedAt: Date.now(),
      form: {
        type: 'found', title: '上次没写完的雨伞', category: '雨具', location: '图书馆门口',
        date: '2026-10-06', clock: '08:30', description: '灰色伞面',
        contactName: '小明', contactPhone: '13800138000', icon: '🌂'
      }
    };
    const seed = '<script>localStorage.setItem("campus_publish_draft_v1", ' +
      JSON.stringify(JSON.stringify(draft)) + ');</script>';
    const dom = loadPage('publish.html', seed);
    const win = dom.window, doc = win.document;
    try {
      assert.notEqual(doc.getElementById('draftBar').style.display, 'none', '应出现草稿提示条');
      assert.ok(doc.getElementById('draftText').textContent.includes('草稿'));

      click(win, doc.getElementById('draftRestore'));
      assert.equal(doc.getElementById('f_title').value, '上次没写完的雨伞');
      assert.equal(doc.getElementById('f_location').value, '图书馆门口');
      assert.equal(doc.getElementById('f_date').value, '2026-10-06');
      assert.ok(doc.querySelector('.type-opt[data-type="found"]').classList.contains('sel-found'));
      assert.ok(doc.querySelector('#f_cat .cat-chip[data-c="雨具"]').classList.contains('active'));
      assert.equal(doc.getElementById('draftBar').style.display, 'none');

      // 丢弃草稿后本地不再保留
      click(win, doc.getElementById('draftDiscard'));
      assert.equal(win.Store.getDraft(), null);
    } finally {
      win.close();
    }
  });

  it('发布页：输入内容 400ms 后自动保存草稿（防抖，不是每敲一个字都写）', async () => {
    const dom = loadPage('publish.html');
    const win = dom.window, doc = win.document;
    try {
      typeInto(win, doc.getElementById('f_title'), '正在写的内容');
      assert.equal(win.Store.getDraft(), null, '防抖期间还没落盘');
      await new Promise((r) => setTimeout(r, 500));
      const draft = win.Store.getDraft();
      assert.ok(draft, '输入后应自动生成草稿');
      assert.equal(draft.form.title, '正在写的内容');
      assert.ok(doc.getElementById('draftHint').textContent.includes('草稿已自动保存'));
    } finally {
      win.close();
    }
  });

  it('搜索页：搜索有结果会高亮，并写入搜索历史；无结果给出提示', () => {    const dom = loadPage('search.html');
    const win = dom.window, doc = win.document;
    try {
      typeInto(win, doc.getElementById('kw'), '雨伞');
      click(win, doc.getElementById('go'));
      assert.equal(doc.querySelectorAll('#list .card').length, 1);
      assert.equal(doc.querySelector('#list .card mark.hl').textContent, '雨伞');

      // 历史记录：写进 localStorage，并在页面显示
      assert.deepEqual([...win.Store.getSearchHistory()], ['雨伞']);
      assert.notEqual(doc.getElementById('historyBox').style.display, 'none');
      assert.ok(doc.getElementById('history').textContent.includes('雨伞'));

      // 点历史条目能再次搜索
      click(win, doc.querySelector('#history .chip[data-w="雨伞"]'));
      assert.equal(doc.querySelectorAll('#list .card').length, 1);

      // 删除一条历史
      click(win, doc.querySelector('#history .del'));
      assert.deepEqual([...win.Store.getSearchHistory()], []);

      // 搜不到的关键词
      typeInto(win, doc.getElementById('kw'), 'zzz不存在');
      click(win, doc.getElementById('go'));
      assert.ok(doc.querySelector('#list .empty'));
      assert.equal(doc.querySelectorAll('#list .card').length, 0);
    } finally {
      win.close();
    }
  });

  it('搜索页：支持带参数直接打开（search.html?kw=雨伞）并自动出结果', () => {
    const dom = loadPage('search.html?kw=' + encodeURIComponent('雨伞'));
    const win = dom.window, doc = win.document;
    try {
      assert.equal(doc.getElementById('kw').value, '雨伞');
      assert.equal(doc.querySelectorAll('#list .card').length, 1);
      assert.equal(doc.querySelector('#list .card mark.hl').textContent, '雨伞');
      assert.deepEqual([...win.Store.getSearchHistory()], ['雨伞']);
    } finally {
      win.close();
    }
  });

  it('发布页：填表 → 校验通过 → 出现成功页，数据进入列表；草稿会被清掉', () => {
    const dom = loadPage('publish.html');
    const win = dom.window, doc = win.document;
    try {
      const before = win.Store.getAll().length;

      // 先故意少填必填项，点发布应给出校验提示
      click(win, doc.getElementById('submitBtn'));
      assert.ok(doc.getElementById('errBox').classList.contains('show'));
      assert.equal(win.Store.getAll().length, before);

      // 正常填写
      doc.getElementById('f_title').value = '测试发布的蓝色水杯';
      click(win, doc.querySelector('#f_cat .cat-chip[data-c="生活用品"]'));
      doc.getElementById('f_location').value = '第二食堂';
      doc.getElementById('f_date').value = '2026-10-06';
      doc.getElementById('f_time').value = '12:30';
      doc.getElementById('f_phone').value = '13900000000';
      click(win, doc.getElementById('submitBtn'));

      assert.equal(doc.getElementById('successView').style.display, 'block');
      assert.ok(doc.getElementById('successSummary').textContent.includes('测试发布的蓝色水杯'));
      assert.equal(win.Store.getAll().length, before + 1);
      assert.equal(win.Store.getDraft(), null, '发布成功后草稿应被清除');
      assert.ok(doc.getElementById('viewDetail').getAttribute('href').includes('detail.html?id='));
    } finally {
      win.close();
    }
  });

  it('详情页：展示信息 → 查看联系方式 → 一键复制 → 发布者标记为已找到', () => {
    const seed = '<script>localStorage.setItem("campus_lost_found_items_v1", ' +
      JSON.stringify(JSON.stringify([testItem()])) + ');</script>';
    const dom = loadPage('detail.html?id=test-1', seed);
    const win = dom.window, doc = win.document;
    try {
      assert.ok(doc.getElementById('detailRoot').textContent.includes('测试用黑色雨伞'));
      assert.ok(doc.getElementById('detailRoot').textContent.includes('图书馆门口'));

      // 联系方式默认隐藏，点击后显示并可复制
      assert.ok(doc.getElementById('revealBtn'));
      click(win, doc.getElementById('revealBtn'));
      assert.ok(doc.getElementById('contactArea').textContent.includes('13800138000'));
      assert.ok(doc.querySelector('#contactArea .copy'));
      click(win, doc.querySelector('#contactArea .copy'));   // 复制不报错即可（jsdom 无剪贴板）

      // 浏览量 +1
      assert.equal(win.Store.getById('test-1').views, 1);

      // 发布者管理：标记为已找到
      assert.ok(doc.getElementById('doneBtn'));
      click(win, doc.getElementById('doneBtn'));
      assert.equal(win.Store.getById('test-1').status, 'resolved');
    } finally {
      win.close();
    }
  });

  it('详情页：id 不存在时给出友好提示，而不是白屏', () => {
    const dom = loadPage('detail.html?id=不存在的id');
    const win = dom.window, doc = win.document;
    try {
      assert.ok(doc.getElementById('detailRoot').textContent.includes('找不到这条信息'));
      assert.ok(doc.querySelector('#detailRoot a[href="index.html"]'));
    } finally {
      win.close();
    }
  });

  it('我的页：统计卡片、个人信息弹窗、数据管理按钮都能用', () => {
    const dom = loadPage('my.html');
    const win = dom.window, doc = win.document;
    try {
      assert.ok(Number(doc.getElementById('stTotal').textContent) >= 1);
      assert.ok(Number(doc.getElementById('stViews').textContent) >= 0);

      // 打开/关闭个人信息弹窗
      click(win, doc.getElementById('editBtn'));
      assert.equal(doc.getElementById('editMask').style.display, 'flex');
      click(win, doc.getElementById('pfCancel'));
      assert.equal(doc.getElementById('editMask').style.display, 'none');

      // 恢复演示数据
      click(win, doc.getElementById('resetBtn'));
      assert.equal(win.Store.getAll().length, 6);
      assert.equal(win.Store.getDraft(), null);
    } finally {
      win.close();
    }
  });
});
