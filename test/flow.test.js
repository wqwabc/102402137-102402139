/*
 * test/flow.test.js —— 业务主流程集成测试
 * 用 Store 这一层把「发布信息 → 浏览/搜索 → 查看详情 → 联系发布者 → 更新状态」整条链路走通，
 * 相当于把用户操作手册翻译成可自动执行的断言。
 */
'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

const Store = h.freshStore();

beforeEach(() => {
  h.installLocalStorage();   // 全新的本地存储
  Store._reset();            // 每条用例都从 6 条演示数据开始，保证可重复执行
});

describe('核心流程：发布 → 浏览/搜索 → 详情 → 联系 → 更新状态', () => {
  it('完整走一遍主流程，每一步都能看到上一步的结果', () => {
    // ① 发布一条招领信息
    const created = Store.add({
      type: 'found', title: '蓝色校园卡套', category: '证件卡', location: '第二食堂二楼',
      time: '2026-10-05 12:30', description: '卡套内有健身卡一张',
      contactName: '测试同学', contactPhone: '13900000000', contactQq: '', contactWechat: 'wx_test'
    });
    assert.equal(created.ok, true);
    const id = created.item.id;

    // ② 首页浏览：新发布的信息排在最前面（进行中 + 最新）
    assert.equal(Store.query({})[0].id, id);
    assert.equal(Store.getStats().total, 7);

    // ③ 搜索：按物品名称关键词能搜到
    assert.equal(Store.query({ keyword: '卡套', type: 'found' })[0].id, id);
    assert.equal(Store.query({ keyword: '校园卡套' })[0].id, id);            // 只有这条招领信息命中
    assert.equal(Store.query({ keyword: '卡套', type: 'lost' }).some((x) => x.id === id), false);  // 类型不对搜不到
    // 搜索历史也记下来了
    Store.addSearchHistory('卡套');
    assert.deepEqual(Store.getSearchHistory(), ['卡套']);

    // ④ 筛选：按分类 / 地点也能定位到它
    assert.ok(Store.query({ category: '证件卡' }).some((x) => x.id === id));
    assert.ok(Store.query({ location: '食堂' }).some((x) => x.id === id));

    // ⑤ 查看详情：能按 id 取到完整信息，并且浏览量 +1
    const detail = Store.getById(id);
    assert.equal(detail.title, '蓝色校园卡套');
    assert.equal(detail.code, created.item.code);
    assert.equal(detail.publisher, Store.CURRENT_USER_ID);
    Store.incrViews(id);
    assert.equal(Store.getById(id).views, 1);

    // ⑥ 联系发布者：详情页拿得到联系方式
    assert.equal(detail.contactPhone, '13900000000');
    assert.equal(detail.contactWechat, 'wx_test');

    // ⑦ 发布者把信息标记为“已归还”
    assert.equal(Store.updateStatus(id, 'resolved'), true);
    assert.equal(Store.getById(id).status, 'resolved');
    assert.ok(!Store.query({ status: 'active' }).some((x) => x.id === id));   // 不再出现在“进行中”
    const ranked = Store.query({});
    const firstResolved = ranked.findIndex((x) => x.status === 'resolved');
    assert.equal(ranked[firstResolved].id, id);                               // 已解决的信息沉底，且最新的排最前
    assert.ok(firstResolved > 0);

    // ⑧ 误操作可以撤回：重新标记为进行中
    assert.equal(Store.updateStatus(id, 'active'), true);
    assert.equal(Store.query({})[0].id, id);
  });

  it('发布失败时不会产生半成品数据（校验先行）', () => {
    const before = Store.getAll().length;
    const res = Store.add({ type: 'lost', title: '', category: '雨具', location: '图书馆', contactName: '小明', contactPhone: '13800138000' });
    assert.equal(res.ok, false);
    assert.equal(Store.getAll().length, before);
  });

  it('编辑自己的信息后，搜索结果里的内容同步更新', () => {
    const created = Store.add(h.validRaw({ title: '旧标题雨伞' })).item;
    assert.equal(Store.query({ keyword: '旧标题' }).length, 1);
    const edited = Store.updateItem(created.id, h.validRaw({ title: '新标题水杯', category: '生活用品' }));
    assert.equal(edited.ok, true);
    assert.equal(Store.query({ keyword: '旧标题' }).length, 0);
    assert.equal(Store.query({ keyword: '新标题' })[0].id, created.id);
  });

  it('删除后首页和详情页都不再出现这条信息', () => {
    const created = Store.add(h.validRaw()).item;
    assert.equal(Store.remove(created.id), true);
    assert.equal(Store.getById(created.id), null);
    assert.ok(!Store.query({ keyword: created.title }).some((x) => x.id === created.id));
  });

  it('“我的发布”只展示当前登录用户的信息，并能统计完成情况', () => {
    Store.add(h.validRaw({ title: '我的第一条' }));
    const mine = Store.getByPublisher(Store.CURRENT_USER_ID);
    assert.ok(mine.length >= 1);
    assert.ok(mine.every((x) => x.publisher === Store.CURRENT_USER_ID));
    const sum = Store.summarize(mine);
    assert.equal(sum.total, mine.length);
    assert.equal(sum.active + sum.resolved, sum.total);
  });

  it('智能配对：寻物信息发布后能匹配到分类相同、标题相似的招领信息', () => {
    // 演示数据里已有一条招领：「藏蓝色折叠雨伞 / 雨具」
    const mine = Store.add({ type: 'lost', title: '蓝色折叠雨伞', category: '雨具', location: '教学楼A座',
      contactName: '张同学', contactPhone: '13911112222' });
    const matches = Store.findMatches(mine.item);
    assert.equal(matches.length, 1);
    assert.equal(matches[0].type, 'found');
    assert.equal(matches[0].title, '藏蓝色折叠雨伞');
  });

  it('换台电脑：导出备份再导入，数据完全一致', () => {
    Store.add(h.validRaw({ title: '备份前发布的信息' }));
    const dump = JSON.stringify(Store.exportData());
    const before = Store.getAll().length;

    h.installLocalStorage();                     // 模拟“换了一台电脑”，本地存储是空的
    assert.equal(Store.getAll().length, 6);      // 新电脑只有演示数据
    const res = Store.importData(dump);
    assert.equal(res.ok, true);
    assert.equal(Store.getAll().length, before);
    assert.ok(Store.query({ keyword: '备份前发布' }).length === 1);
  });

  it('断线重填：发布到一半关掉页面，草稿能恢复', () => {
    const draftForm = { type: 'lost', title: '写了一半的寻物启事', category: '雨具', location: '图书馆', date: '2026-10-06', clock: '08:30' };
    Store.saveDraft({ form: draftForm });
    const got = Store.getDraft();
    assert.equal(got.form.title, '写了一半的寻物启事');
    assert.ok(got.savedAt > 0);

    // 恢复草稿后正常发布 → 草稿被清掉
    Store.clearDraft();
    assert.equal(Store.getDraft(), null);
    const created = Store.add({
      type: got.form.type, title: got.form.title, category: got.form.category,
      location: got.form.location, time: got.form.date + ' ' + got.form.clock,
      contactName: '小明', contactPhone: '13800138000'
    });
    assert.equal(created.ok, true);
    assert.equal(Store.query({ keyword: '写了一半' }).length, 1);
  });
});
