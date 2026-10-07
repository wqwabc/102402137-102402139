/*
 * test/helpers.js —— 单元测试公用工具
 * 1) 一个极简的 localStorage 桩（Node 里没有 localStorage，用它替代浏览器存储）
 * 2) 构造合法的信息对象，方便各测试文件复用
 */
'use strict';

// 内存版 localStorage，接口与浏览器保持一致
function createLocalStorage() {
  var map = new Map();
  return {
    get length() { return map.size; },
    key: function (i) { return Array.from(map.keys())[i] || null; },
    getItem: function (k) { return map.has(String(k)) ? map.get(String(k)) : null; },
    setItem: function (k, v) { map.set(String(k), String(v)); },
    removeItem: function (k) { map.delete(String(k)); },
    clear: function () { map.clear(); },
    _dump: function () { return Object.fromEntries(map); }
  };
}

// 换一个干净的 localStorage（模拟“第一次打开浏览器”）
function installLocalStorage() {
  var ls = createLocalStorage();
  globalThis.localStorage = ls;
  return ls;
}

// 拿到一个干净的 Store 实例（清掉 require 缓存，保证模块状态不串场）
function freshStore() {
  installLocalStorage();
  var p = require.resolve('../js/store.js');
  delete require.cache[p];
  return require(p);
}

function loadApp() {
  var p = require.resolve('../js/common.js');
  delete require.cache[p];
  return require(p);
}

// 一条合法信息（可覆盖任意字段）
function item(over) {
  return Object.assign({
    id: 'id-1', code: 'LF20261001001', type: 'lost', title: '黑色雨伞',
    category: '雨具', location: '图书馆门口', time: '2026-10-01 09:00',
    description: '伞柄有划痕', contactName: '小明', contactPhone: '13800138000',
    contactQq: '', contactWechat: '', publisher: '102402137', status: 'active',
    createdAt: 1700000000000, views: 3
  }, over || {});
}

// 用一批自定义数据替换 Store 里的数据（借用导入接口）
function useItems(Store, list) {
  var res = Store.importData({ items: list });
  if (!res.ok) throw new Error('测试数据准备失败：' + res.errors.join('，'));
  return res;
}

// 一份合法的发布表单
function validRaw(over) {
  return Object.assign({
    type: 'found', title: '黑色保温杯', category: '生活用品', location: '图书馆三楼自习区',
    time: '2026-10-03 09:20', description: '杯盖有磨损', contactName: '李思远',
    contactPhone: '13800138000', contactQq: '', contactWechat: ''
  }, over || {});
}

module.exports = {
  createLocalStorage: createLocalStorage,
  installLocalStorage: installLocalStorage,
  freshStore: freshStore,
  loadApp: loadApp,
  item: item,
  useItems: useItems,
  validRaw: validRaw
};
