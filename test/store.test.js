/*
 * test/store.test.js —— 数据层 Store 单元测试（白盒 + 边界值）
 * 运行：node --test test/
 */
'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

const Store = h.freshStore();

// 每条用例都从“全新的浏览器 + 6 条演示数据”开始，避免用例之间互相污染
beforeEach(() => {
  h.installLocalStorage();
  Store._reset();
});

/* ==================== validate：表单校验 ==================== */
describe('Store.validate —— 发布信息校验', () => {
  it('合法数据：返回 ok，且自动补全 id / 编号 / 发布者 / 状态', () => {
    const res = Store.validate(h.validRaw());
    assert.equal(res.ok, true);
    assert.deepEqual(res.errors, []);
    assert.ok(res.item.id);
    assert.match(res.item.code, /^LF\d{11}$/);
    assert.equal(res.item.publisher, Store.CURRENT_USER_ID);
    assert.equal(res.item.status, 'active');
    assert.equal(res.item.views, 0);
  });

  it('物品名称为空 / 全是空格 → 报错', () => {
    assert.equal(Store.validate(h.validRaw({ title: '' })).ok, false);
    const res = Store.validate(h.validRaw({ title: '   ' }));
    assert.equal(res.ok, false);
    assert.ok(res.errors.includes('物品名称不能为空'));
  });

  it('物品名称超过 30 字 → 报错（边界：30 字合法，31 字非法）', () => {
    assert.equal(Store.validate(h.validRaw({ title: '伞'.repeat(30) })).ok, true);
    const res = Store.validate(h.validRaw({ title: '伞'.repeat(31) }));
    assert.equal(res.ok, false);
    assert.ok(res.errors.includes('物品名称不能超过30字'));
  });

  it('信息类型必须是 lost / found', () => {
    assert.ok(Store.validate(h.validRaw({ type: 'lost' })).ok);
    assert.equal(Store.validate(h.validRaw({ type: 'other' })).ok, false);
    assert.equal(Store.validate(h.validRaw({ type: '' })).ok, false);
  });

  it('分类必须在下拉可选范围内', () => {
    assert.equal(Store.validate(h.validRaw({ category: '不存在的分类' })).ok, false);
    assert.ok(Store.validate(h.validRaw({ category: '其他' })).ok);
  });

  it('地点不能为空且不超过 50 字', () => {
    assert.equal(Store.validate(h.validRaw({ location: '' })).ok, false);
    assert.ok(Store.validate(h.validRaw({ location: '楼'.repeat(50) })).ok);
    assert.equal(Store.validate(h.validRaw({ location: '楼'.repeat(51) })).ok, false);
  });

  it('联系人称呼必填', () => {
    assert.equal(Store.validate(h.validRaw({ contactName: '' })).ok, false);
  });

  it('三种联系方式至少要填一个', () => {
    const res = Store.validate(h.validRaw({ contactPhone: '', contactQq: '', contactWechat: '' }));
    assert.equal(res.ok, false);
    assert.ok(res.errors.includes('请至少填写一种联系方式（电话/QQ/微信）'));
    assert.ok(Store.validate(h.validRaw({ contactPhone: '', contactWechat: 'wx_abc' })).ok);
    assert.ok(Store.validate(h.validRaw({ contactPhone: '', contactQq: '123456' })).ok);
  });

  it('手机号格式：11 位、1 开头、第二位 3-9', () => {
    assert.ok(Store.validate(h.validRaw({ contactPhone: '19912345678' })).ok);
    assert.equal(Store.validate(h.validRaw({ contactPhone: '12345678901' })).ok, false);
    assert.equal(Store.validate(h.validRaw({ contactPhone: '1380013800' })).ok, false);   // 10 位
    assert.equal(Store.validate(h.validRaw({ contactPhone: '13800138000a' })).ok, false);
  });

  it('QQ 号必须是 5-12 位纯数字', () => {
    assert.equal(Store.validate(h.validRaw({ contactPhone: '', contactQq: '1234' })).ok, false);
    assert.ok(Store.validate(h.validRaw({ contactPhone: '', contactQq: '12345' })).ok);
    assert.ok(Store.validate(h.validRaw({ contactPhone: '', contactQq: '123456789012' })).ok);
    assert.equal(Store.validate(h.validRaw({ contactPhone: '', contactQq: '1234567890123' })).ok, false);
    assert.equal(Store.validate(h.validRaw({ contactPhone: '', contactQq: '12a45' })).ok, false);
  });

  it('多条错误一次性返回（不是遇到第一条就停）', () => {
    const res = Store.validate({ type: 'x', title: '', category: '', location: '', contactName: '' });
    assert.equal(res.ok, false);
    assert.ok(res.errors.length >= 5);
  });

  it('描述超长时截断到 500 字；时间留空时给默认值', () => {
    const res = Store.validate(h.validRaw({ description: 'a'.repeat(600), time: '' }));
    assert.equal(res.item.description.length, 500);
    assert.equal(res.item.time, '时间未填');
  });

  it('null / undefined 入参不崩溃，按“空表单”处理', () => {
    assert.equal(Store.validate(null).ok, false);
    assert.equal(Store.validate(undefined).ok, false);
  });

  it('首尾空格会被 trim（避免“看起来填了其实没填”）', () => {
    const res = Store.validate(h.validRaw({ title: '  黑色雨伞  ', location: ' 图书馆 ' }));
    assert.equal(res.item.title, '黑色雨伞');
    assert.equal(res.item.location, '图书馆');
  });
});

/* ==================== add / getById / incrViews ==================== */
describe('Store.add / getById / incrViews', () => {
  it('add 成功后信息排在最前，并能按 id 查回', () => {
    const before = Store.getAll().length;
    const res = Store.add(h.validRaw({ title: '新发布的雨伞' }));
    assert.equal(res.ok, true);
    const all = Store.getAll();
    assert.equal(all.length, before + 1);
    assert.equal(all[0].title, '新发布的雨伞');
    assert.equal(Store.getById(res.item.id).title, '新发布的雨伞');
  });

  it('add 校验失败时不写入数据', () => {
    const before = Store.getAll().length;
    const res = Store.add(h.validRaw({ title: '' }));
    assert.equal(res.ok, false);
    assert.equal(Store.getAll().length, before);
  });

  it('getById 查不到返回 null', () => {
    assert.equal(Store.getById('不存在的-id'), null);
  });

  it('incrViews 每一次浏览 +1；id 不存在时静默失败', () => {
    const it = Store.add(h.validRaw()).item;
    Store.incrViews(it.id);
    Store.incrViews(it.id);
    assert.equal(Store.getById(it.id).views, 2);
    assert.doesNotThrow(() => Store.incrViews('不存在的-id'));
  });
});

/* ==================== query：搜索与筛选 ==================== */
describe('Store.query —— 关键词搜索 / 多维筛选 / 排序', () => {
  beforeEach(() => {
    h.useItems(Store, [
      h.item({ id: 'a', type: 'lost', title: '黑色雨伞', category: '雨具', location: '图书馆门口', views: 1, createdAt: 1000 }),
      h.item({ id: 'b', type: 'found', title: '折叠雨伞', category: '雨具', location: '第二食堂', views: 9, createdAt: 2000 }),
      h.item({ id: 'c', type: 'lost', title: '校园一卡通', category: '证件卡', location: '图书馆三楼', views: 5, createdAt: 3000 }),
      h.item({ id: 'd', type: 'found', title: '白色耳机', category: '数码电子', location: '体育馆', views: 7, createdAt: 4000, status: 'resolved' })
    ]);
  });

  it('空条件返回全部', () => {
    assert.equal(Store.query().length, 4);
    assert.equal(Store.query({}).length, 4);
  });

  it('关键词命中标题 / 描述 / 地点 / 分类，且大小写不敏感', () => {
    assert.equal(Store.query({ keyword: '雨伞' }).length, 2);
    assert.equal(Store.query({ keyword: '图书馆' }).length, 2);
    assert.equal(Store.query({ keyword: '证件卡' }).length, 1);
    assert.equal(Store.query({ keyword: '伞柄有划痕' }).length, 4);   // 描述相同，四条都命中
    assert.equal(Store.query({ keyword: 'no-such-key' }).length, 0);
  });

  it('关键词首尾空格被忽略', () => {
    assert.equal(Store.query({ keyword: '  雨伞  ' }).length, 2);
  });

  it('按类型筛选，type=all 表示不筛选', () => {
    assert.equal(Store.query({ type: 'lost' }).length, 2);
    assert.equal(Store.query({ type: 'found' }).length, 2);
    assert.equal(Store.query({ type: 'all' }).length, 4);
  });

  it('按分类筛选（精确匹配）', () => {
    assert.equal(Store.query({ category: '雨具' }).length, 2);
    assert.equal(Store.query({ category: '证件卡' }).length, 1);
    assert.equal(Store.query({ category: '不存在的分类' }).length, 0);
  });

  it('按地点筛选（模糊匹配，校园场景下用“图书馆”就能筛出相关地点）', () => {
    assert.equal(Store.query({ location: '图书馆' }).length, 2);
    assert.equal(Store.query({ location: '食堂' }).length, 1);
    assert.equal(Store.query({ location: 'all' }).length, 4);
  });

  it('按状态筛选（只看进行中 / 只看已完成）', () => {
    assert.equal(Store.query({ status: 'active' }).length, 3);
    assert.equal(Store.query({ status: 'resolved' }).length, 1);
  });

  it('多个条件是与关系', () => {
    assert.equal(Store.query({ type: 'lost', location: '图书馆' }).length, 2);
    assert.equal(Store.query({ type: 'found', location: '图书馆' }).length, 0);
    assert.equal(Store.query({ keyword: '雨伞', type: 'found' }).length, 1);
  });

  it('默认排序：进行中在前、已解决沉底，同组按发布时间倒序', () => {
    const ids = Store.query().map((it) => it.id);
    assert.deepEqual(ids, ['c', 'b', 'a', 'd']);
  });

  it('sort=views：同状态内按浏览次数从多到少', () => {
    const active = Store.query({ sort: 'views', status: 'active' }).map((it) => it.id);
    assert.deepEqual(active, ['b', 'c', 'a']);
  });

  it('sort=oldest：同状态内按发布时间正序', () => {
    const active = Store.query({ sort: 'oldest', status: 'active' }).map((it) => it.id);
    assert.deepEqual(active, ['a', 'b', 'c']);
  });

  it('非法 sort 参数回退到默认排序，不报错', () => {
    const ids = Store.query({ sort: 'hack' }).map((it) => it.id);
    assert.deepEqual(ids, ['c', 'b', 'a', 'd']);
  });
});

/* ==================== paginate：加载更多 ==================== */
describe('Store.paginate —— 分页（加载更多）', () => {
  const list = Array.from({ length: 10 }, (_, i) => h.item({ id: 'p' + i }));

  it('第 1 页返回前 size 条，并告知还有更多', () => {
    const p = Store.paginate(list, 1, 6);
    assert.equal(p.items.length, 6);
    assert.equal(p.total, 10);
    assert.equal(p.loaded, 6);
    assert.equal(p.hasMore, true);
  });

  it('翻到最后一页时 hasMore 变为 false（累计展示，不会漏条）', () => {
    const p = Store.paginate(list, 2, 6);
    assert.equal(p.items.length, 10);
    assert.equal(p.hasMore, false);
  });

  it('页数超出范围时返回全部而不是空列表', () => {
    assert.equal(Store.paginate(list, 99, 6).items.length, 10);
  });

  it('非法页码/每页条数回退到默认值 1 / 10', () => {
    const p = Store.paginate(list, 0, 0);
    assert.equal(p.page, 1);
    assert.equal(p.size, 10);
    assert.equal(p.items.length, 10);
    const p2 = Store.paginate(list, 'abc', -5);
    assert.equal(p2.page, 1);
    assert.equal(p2.size, 10);
  });

  it('非数组入参、空列表都不会崩', () => {
    assert.equal(Store.paginate(null, 1, 6).total, 0);
    assert.equal(Store.paginate([], 1, 6).hasMore, false);
  });
});

/* ==================== summarize：我的数据统计 ==================== */
describe('Store.summarize —— 统计汇总', () => {
  it('统计总数 / 已完成 / 总浏览 / 完成率', () => {
    const s = Store.summarize([
      h.item({ status: 'active', views: 2 }),
      h.item({ status: 'resolved', views: 5 }),
      h.item({ status: 'active', views: 0 })
    ]);
    assert.deepEqual(s, { total: 3, resolved: 1, active: 2, views: 7, rate: 33 });
  });

  it('空列表完成率为 0，不会出现 NaN', () => {
    assert.deepEqual(Store.summarize([]), { total: 0, resolved: 0, active: 0, views: 0, rate: 0 });
    assert.deepEqual(Store.summarize(null), { total: 0, resolved: 0, active: 0, views: 0, rate: 0 });
  });
});

/* ==================== updateItem / updateStatus / remove ==================== */
describe('Store.updateItem / updateStatus / remove', () => {
  it('编辑信息：保留 id、编号、发布者、状态、浏览量，只更新可改字段', () => {
    const it = Store.add(h.validRaw()).item;
    Store.incrViews(it.id);
    Store.updateStatus(it.id, 'resolved');
    const res = Store.updateItem(it.id, h.validRaw({ title: '改过的标题', category: '数码电子' }));
    assert.equal(res.ok, true);
    const after = Store.getById(it.id);
    assert.equal(after.title, '改过的标题');
    assert.equal(after.category, '数码电子');
    assert.equal(after.code, it.code);
    assert.equal(after.publisher, it.publisher);
    assert.equal(after.status, 'resolved');
    assert.equal(after.views, 1);
    assert.equal(after.createdAt, it.createdAt);
  });

  it('编辑信息：校验不通过时原数据保持不变', () => {
    const it = Store.add(h.validRaw()).item;
    const res = Store.updateItem(it.id, h.validRaw({ title: '' }));
    assert.equal(res.ok, false);
    assert.equal(Store.getById(it.id).title, it.title);
  });

  it('编辑不存在的信息 → 返回“信息不存在或已被删除”', () => {
    const res = Store.updateItem('不存在的-id', h.validRaw());
    assert.equal(res.ok, false);
    assert.ok(res.errors[0].includes('不存在'));
  });

  it('updateStatus 只接受 active / resolved', () => {
    const it = Store.add(h.validRaw()).item;
    assert.equal(Store.updateStatus(it.id, 'resolved'), true);
    assert.equal(Store.getById(it.id).status, 'resolved');
    assert.equal(Store.updateStatus(it.id, 'active'), true);
    assert.equal(Store.getById(it.id).status, 'active');
    assert.equal(Store.updateStatus(it.id, 'done'), false);
    assert.equal(Store.updateStatus('不存在的-id', 'resolved'), false);
  });

  it('remove：删除成功返回 true，再删一次返回 false', () => {
    const it = Store.add(h.validRaw()).item;
    assert.equal(Store.remove(it.id), true);
    assert.equal(Store.getById(it.id), null);
    assert.equal(Store.remove(it.id), false);
  });
});

/* ==================== getByPublisher / findMatches / getStats ==================== */
describe('Store.getByPublisher / findMatches / getStats', () => {
  it('getByPublisher：空字符串返回空数组（避免“没登录就看到全部”）', () => {
    assert.deepEqual(Store.getByPublisher(''), []);
    assert.deepEqual(Store.getByPublisher('   '), []);
    assert.deepEqual(Store.getByPublisher(null), []);
  });

  it('getByPublisher：只返回该学号发布的信息', () => {
    h.useItems(Store, [
      h.item({ id: 'a', publisher: '102402137' }),
      h.item({ id: 'b', publisher: '102402138' })
    ]);
    const mine = Store.getByPublisher(' 102402137 ');
    assert.equal(mine.length, 1);
    assert.equal(mine[0].id, 'a');
  });

  it('findMatches：只推荐“相反类型 + 同分类 + 标题有 2 字重合 + 仍在进行中”的信息', () => {
    h.useItems(Store, [
      h.item({ id: 'm1', type: 'found', category: '雨具', title: '折叠雨伞', status: 'active' }),
      h.item({ id: 'm2', type: 'found', category: '雨具', title: '折叠雨伞', status: 'resolved' }),  // 已解决，不该推荐
      h.item({ id: 'm3', type: 'found', category: '证件卡', title: '蓝色雨伞卡套' }),                // 分类不同
      h.item({ id: 'm4', type: 'lost', category: '雨具', title: '蓝色雨伞' })                        // 类型相同
    ]);
    const matches = Store.findMatches({ id: 'new', type: 'lost', category: '雨具', title: '蓝色雨伞' });
    assert.deepEqual(matches.map((m) => m.id), ['m1']);
  });

  it('findMatches：最多推荐 3 条', () => {
    const many = Array.from({ length: 6 }, (_, i) =>
      h.item({ id: 'f' + i, type: 'found', category: '雨具', title: '折叠雨伞' + i }));
    h.useItems(Store, many);
    const matches = Store.findMatches({ id: 'new', type: 'lost', category: '雨具', title: '蓝色雨伞' });
    assert.equal(matches.length, 3);
  });

  it('getStats：统计今日新增与本周已归还', () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const todayTs = start.getTime() + 60 * 1000;      // 今天 00:01，保证算“今日新增”
    h.useItems(Store, [
      h.item({ id: 't1', createdAt: todayTs, status: 'active' }),
      h.item({ id: 't2', createdAt: todayTs, status: 'resolved' }),
      h.item({ id: 't3', createdAt: Date.now() - 30 * 24 * 3600 * 1000, status: 'resolved' })  // 一个月前，不算本周
    ]);
    const s = Store.getStats();
    assert.equal(s.total, 3);
    assert.equal(s.todayNew, 2);
    assert.equal(s.weekResolved, 1);
  });
});

/* ==================== 演示数据与 genCode ==================== */
describe('演示数据与编号生成', () => {
  it('首次访问自动写入 6 条演示数据，且不会重复写入', () => {
    h.installLocalStorage();          // 换一个空存储，模拟第一次打开
    assert.equal(Store.getAll().length, 6);
    assert.equal(Store.getAll().length, 6);
    assert.equal(Store.getStats().total, 6);
  });

  it('_reset 会恢复到 6 条演示数据', () => {
    Store.remove(Store.getAll()[0].id);
    assert.equal(Store.getAll().length, 5);
    Store._reset();
    assert.equal(Store.getAll().length, 6);
  });

  it('genCode 形如 LF + yyyyMMdd + 3 位序号', () => {
    assert.match(Store.genCode(), /^LF\d{11}$/);
    assert.ok(Store.genCode().startsWith('LF' + new Date().getFullYear()));
  });
});

/* ==================== 搜索历史 ==================== */
describe('Store 搜索历史', () => {
  it('初始为空', () => {
    assert.deepEqual(Store.getSearchHistory(), []);
  });

  it('新增后最近一次在最前面；重复关键词不产生重复项（忽略大小写）', () => {
    Store.addSearchHistory('雨伞');
    Store.addSearchHistory('校园卡');
    Store.addSearchHistory('雨伞');
    assert.deepEqual(Store.getSearchHistory(), ['雨伞', '校园卡']);
    Store.addSearchHistory('ABC');
    Store.addSearchHistory('abc');
    assert.deepEqual(Store.getSearchHistory(), ['abc', '雨伞', '校园卡']);
  });

  it('空白关键词不记录', () => {
    Store.addSearchHistory('   ');
    Store.addSearchHistory('');
    Store.addSearchHistory(null);
    assert.deepEqual(Store.getSearchHistory(), []);
  });

  it('最多保留 8 条，超出后丢掉最旧的', () => {
    for (let i = 1; i <= 10; i++) Store.addSearchHistory('关键词' + i);
    const list = Store.getSearchHistory();
    assert.equal(list.length, 8);
    assert.equal(list[0], '关键词10');
    assert.equal(list.includes('关键词3'), true);    // 刚好第 8 条，还留着
    assert.equal(list.includes('关键词2'), false);   // 被挤掉了
    assert.equal(list.includes('关键词1'), false);
  });

  it('可删除单条、可一键清空', () => {
    Store.addSearchHistory('雨伞');
    Store.addSearchHistory('耳机');
    assert.deepEqual(Store.removeSearchHistory('雨伞'), ['耳机']);
    assert.deepEqual(Store.clearSearchHistory(), []);
    assert.deepEqual(Store.getSearchHistory(), []);
  });

  it('localStorage 里存的是坏数据时，读取不崩溃', () => {
    globalThis.localStorage.setItem('campus_search_history_v1', '{坏JSON');
    assert.deepEqual(Store.getSearchHistory(), []);
    globalThis.localStorage.setItem('campus_search_history_v1', '"不是数组"');
    assert.deepEqual(Store.getSearchHistory(), []);
  });
});

/* ==================== 发布草稿 ==================== */
describe('Store 发布草稿', () => {
  it('没有草稿时返回 null', () => {
    assert.equal(Store.getDraft(), null);
  });

  it('保存后可以读回表单内容，并带保存时间', () => {
    const d = Store.saveDraft({ form: { title: '写了一半的雨伞', location: '图书馆' } });
    assert.ok(d.savedAt > 0);
    const got = Store.getDraft();
    assert.equal(got.form.title, '写了一半的雨伞');
    assert.equal(got.form.location, '图书馆');
  });

  it('clearDraft 之后读回 null', () => {
    Store.saveDraft({ form: { title: 'x' } });
    Store.clearDraft();
    assert.equal(Store.getDraft(), null);
  });

  it('草稿被写坏时返回 null，不抛异常', () => {
    globalThis.localStorage.setItem('campus_publish_draft_v1', 'not json');
    assert.equal(Store.getDraft(), null);
    globalThis.localStorage.setItem('campus_publish_draft_v1', '{"form":"不是对象"}');
    assert.equal(Store.getDraft(), null);
  });

  it('saveDraft 传空对象也不会写坏结构', () => {
    Store.saveDraft(null);
    assert.deepEqual(Store.getDraft().form, {});
  });
});

/* ==================== 数据备份导出 / 导入 ==================== */
describe('Store 数据备份：exportData / importData / resetAll', () => {
  it('导出内容包含版本号、导出时间、信息列表和个人信息', () => {
    const data = Store.exportData();
    assert.equal(data.app, 'campus-lost-found');
    assert.equal(data.version, 1);
    assert.match(data.exportedAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(data.items.length, 6);
    assert.ok(data.profile.name);
  });

  it('导入 JSON 字符串：整表替换并保留作者、状态、浏览量', () => {
    const res = Store.importData(JSON.stringify({
      items: [h.item({ id: 'z1', publisher: '102402138', status: 'resolved', views: 11 })]
    }));
    assert.equal(res.ok, true);
    assert.equal(res.count, 1);
    const all = Store.getAll();
    assert.equal(all.length, 1);
    assert.equal(all[0].publisher, '102402138');
    assert.equal(all[0].status, 'resolved');
    assert.equal(all[0].views, 11);
  });

  it('导入非法 JSON / 缺 items / 全是不合法记录 → 失败且不破坏原数据', () => {
    const before = Store.getAll().length;
    assert.equal(Store.importData('{坏').ok, false);
    assert.equal(Store.importData({ foo: 1 }).ok, false);
    assert.equal(Store.importData({ items: [{ title: '' }, { type: 'x', title: 'y' }, null] }).ok, false);
    assert.equal(Store.getAll().length, before);
  });

  it('导入时字段兜底：缺失分类归到“其他”，缺失联系方式给空串，非法状态归为 active', () => {
    Store.importData({ items: [{ type: 'lost', title: '只有标题', status: 'weird' }] });
    const it = Store.getAll()[0];
    assert.equal(it.category, '其他');
    assert.equal(it.contactPhone, '');
    assert.equal(it.status, 'active');
    assert.equal(it.location, '未填写');
  });

  it('导入会覆盖本机个人信息', () => {
    Store.importData({ items: [h.item({})], profile: { name: '新同学', college: '数计学院' } });
    const p = Store.getProfile();
    assert.equal(p.name, '新同学');
    assert.equal(p.college, '数计学院');
  });

  it('导出再导入应保持数据条数一致（回归保护）', () => {
    const dump = JSON.stringify(Store.exportData());
    Store.remove(Store.getAll()[0].id);
    assert.equal(Store.getAll().length, 5);
    Store.importData(dump);
    assert.equal(Store.getAll().length, 6);
  });

  it('resetAll：恢复演示数据，同时清掉草稿与搜索历史', () => {
    Store.addSearchHistory('雨伞');
    Store.saveDraft({ form: { title: 'x' } });
    Store.remove(Store.getAll()[0].id);
    Store.resetAll();
    assert.equal(Store.getAll().length, 6);
    assert.deepEqual(Store.getSearchHistory(), []);
    assert.equal(Store.getDraft(), null);
  });
});

/* ==================== 个人信息 ==================== */
describe('Store 个人信息', () => {
  it('默认有昵称/学院/头像', () => {
    const p = Store.getProfile();
    assert.equal(p.name, '王小雨');
    assert.equal(p.college, '计算机学院');
    assert.ok(p.avatar);
  });

  it('保存时做 trim 与兜底，并写入本地存储', () => {
    const saved = Store.saveProfile({ name: '  ', college: '', avatar: '' });
    assert.equal(saved.name, '未命名');
    assert.ok(saved.college);
    assert.ok(saved.avatar);
    assert.equal(Store.getProfile().name, '未命名');
  });

  it('localStorage 里的个人信息被写坏时回退到默认值', () => {
    globalThis.localStorage.setItem('campus_profile_v1', '{坏JSON');
    assert.equal(Store.getProfile().name, '王小雨');
  });
});
