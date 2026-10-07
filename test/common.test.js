/*
 * test/common.test.js —— 公共渲染/工具函数单元测试
 * 这些函数是纯函数（只依赖入参），最容易被测试覆盖，也最容易出错。
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

const App = h.loadApp();

describe('App.escapeHtml —— XSS 防护', () => {
  it('转义 & < > " \' 五个字符', () => {
    assert.equal(App.escapeHtml('<script>'), '&lt;script&gt;');
    assert.equal(App.escapeHtml('a & b'), 'a &amp; b');
    assert.equal(App.escapeHtml('"双引号"'), '&quot;双引号&quot;');
    assert.equal(App.escapeHtml("'单引号'"), '&#39;单引号&#39;');
  });

  it('null / undefined 返回空串（不会渲染出 "null"）', () => {
    assert.equal(App.escapeHtml(null), '');
    assert.equal(App.escapeHtml(undefined), '');
    assert.equal(App.escapeHtml(0), '0');
  });
});

describe('App.highlight —— 关键词高亮', () => {
  it('没有关键词时等价于转义输出', () => {
    assert.equal(App.highlight('<b>雨伞</b>', ''), '&lt;b&gt;雨伞&lt;/b&gt;');
    assert.equal(App.highlight('雨伞'), '雨伞');
  });

  it('命中一次时用 <mark class="hl"> 包住', () => {
    assert.equal(App.highlight('黑色雨伞', '雨伞'), '黑色<mark class="hl">雨伞</mark>');
  });

  it('同一段文字命中多次时全部高亮', () => {
    const out = App.highlight('雨伞雨伞雨伞', '雨伞');
    assert.equal(out.split('<mark').length - 1, 3);
  });

  it('大小写不敏感，且保留原文大小写', () => {
    assert.equal(App.highlight('Blue Umbrella', 'blue'), '<mark class="hl">Blue</mark> Umbrella');
  });

  it('关键词含正则特殊字符也不会出错', () => {
    assert.equal(App.highlight('a.b*c', '.'), 'a<mark class="hl">.</mark>b*c');
    assert.equal(App.highlight('价格 9.9 元', '9.9'), '价格 <mark class="hl">9.9</mark> 元');
  });

  it('先转义再高亮：原文里的 HTML 不会变成可执行标签', () => {
    const out = App.highlight('<img src=x onerror=alert(1)>雨伞', '雨伞');
    assert.equal(out.includes('<img'), false);
    assert.ok(out.endsWith('<mark class="hl">雨伞</mark>'));
  });

  it('关键词两边空格自动忽略；匹配不到时原样返回', () => {
    assert.equal(App.highlight('黑色雨伞', '  雨伞  '), '黑色<mark class="hl">雨伞</mark>');
    assert.equal(App.highlight('黑色雨伞', '保温杯'), '黑色雨伞');
  });

  it('null 文本不崩溃', () => {
    assert.equal(App.highlight(null, '雨伞'), '');
  });
});

describe('App.fmtTime —— 时间友好显示', () => {
  it('今天 → “今天 HH:mm”', () => {
    const d = new Date(); d.setHours(10, 5, 0, 0);
    assert.equal(App.fmtTime(d.getTime()), '今天 10:05');
  });

  it('昨天 → “昨天 HH:mm”', () => {
    const d = new Date(Date.now() - 86400000); d.setHours(9, 7, 0, 0);
    assert.equal(App.fmtTime(d.getTime()), '昨天 09:07');
  });

  it('更早 → “MM-DD HH:mm”', () => {
    assert.equal(App.fmtTime(new Date(2020, 0, 5, 8, 9).getTime()), '01-05 08:09');
  });

  it('0 / 空值返回空串', () => {
    assert.equal(App.fmtTime(0), '');
    assert.equal(App.fmtTime(null), '');
  });
});

describe('App 徽标渲染', () => {
  it('寻物信息：已找到 / 处理中', () => {
    assert.equal(App.statusText({ type: 'lost', status: 'resolved' }), '已找到');
    assert.equal(App.statusText({ type: 'lost', status: 'active' }), '处理中');
    assert.equal(App.statusClass({ status: 'resolved' }), 'st-done');
    assert.equal(App.statusClass({ status: 'active' }), 'st-active');
  });

  it('招领信息：已归还', () => {
    assert.equal(App.statusText({ type: 'found', status: 'resolved' }), '已归还');
  });

  it('类型徽标带对应样式类', () => {
    assert.ok(App.typeBadge({ type: 'lost' }).includes('badge-lost'));
    assert.ok(App.typeBadge({ type: 'found' }).includes('badge-found'));
    assert.ok(App.typeBadge({ type: 'found' }).includes('招领'));
  });

  it('分类图标：已知分类返回 emoji，未知分类给兜底图标', () => {
    assert.equal(App.catIcon('雨具'), '🌂');
    assert.equal(App.catIcon('不存在的分类'), '📦');
    assert.equal(App.catIcon(''), '📦');
  });
});

describe('App.cardHtml —— 列表卡片', () => {
  const it0 = h.item({ id: 'id-1', title: '黑色雨伞', description: '伞柄有划痕' });

  it('包含详情页链接，并带上来源标记（用于“返回”跳转）', () => {
    const html = App.cardHtml(it0, 'my');
    assert.ok(html.includes('href="detail.html?id=id-1&amp;from=my"') || html.includes('href="detail.html?id=id-1&from=my"'));
  });

  it('关键词在标题和描述里被高亮', () => {
    const html = App.cardHtml(it0, '', '雨伞');
    assert.ok(html.includes('<mark class="hl">雨伞</mark>'));
  });

  it('已解决的信息加上 resolved 类（前端做灰化沉底）', () => {
    assert.ok(App.cardHtml(h.item({ status: 'resolved' }), '').includes('class="card resolved"'));
    assert.ok(!App.cardHtml(h.item({ status: 'active' }), '').includes('card resolved'));
  });

  it('有照片时渲染图片标签，没有照片时用 emoji 图标', () => {
    assert.ok(App.cardHtml(h.item({ photo: 'data:image/png;base64,AAA' }), '').includes('<img class="cat-img"'));
    assert.ok(!App.cardHtml(h.item({ photo: '' }), '').includes('<img'));
  });

  it('用户输入里的 HTML 会被转义，不会注入页面', () => {
    const html = App.cardHtml(h.item({ title: '<img src=x onerror=alert(1)>', location: '<b>坏地点</b>' }), '');
    assert.equal(html.includes('<img src=x'), false);
    assert.equal(html.includes('<b>坏地点</b>'), false);
  });

  it('缺少描述时显示占位文案', () => {
    assert.ok(App.cardHtml(h.item({ description: '' }), '').includes('暂无描述'));
  });
});

describe('App.moreHtml —— 加载更多按钮', () => {
  it('还有数据时显示剩余条数', () => {
    const html = App.moreHtml({ total: 10, loaded: 6, hasMore: true });
    assert.ok(html.includes('加载更多'));
    assert.ok(html.includes('还有 4 条'));
    assert.ok(html.includes('id="moreBtn"'));
  });

  it('全部加载完时显示“已经到底啦”', () => {
    assert.ok(App.moreHtml({ total: 6, loaded: 6, hasMore: false }).includes('已经到底啦'));
  });

  it('空列表不渲染任何东西', () => {
    assert.equal(App.moreHtml({ total: 0, loaded: 0, hasMore: false }), '');
    assert.equal(App.moreHtml(null), '');
  });
});
