/*
 * store.js —— 校园失物招领 数据层
 * 基于 localStorage 持久化，纯前端、无服务器。
 * 同时兼容浏览器（挂到 window.Store）与 Node（module.exports，用于单元测试）。
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'campus_lost_found_items_v1';
  var PROFILE_KEY = 'campus_profile_v1';

  // 物品分类（下拉/胶囊按钮的固定取值，便于筛选与白盒测试）
  var CATEGORIES = ['证件卡', '数码电子', '生活用品', '雨具', '包袋', '随身物品', '图书资料', '其他'];
  // 信息类型：lost=寻物启事（我丢了东西），found=失物招领（我捡到东西）
  var TYPES = { lost: '寻物', found: '招领' };

  // 当前登录用户：雏形阶段默认已登录，固定为本机同学的学号。
  // 发布时自动署名，不再让用户手动填写“发布者标识”。
  var CURRENT_USER_ID = '102402137';

  function pad(n) { return String(n).padStart(2, '0'); }

  // 生成信息编号，形如 LF20260927018
  function genCode() {
    var d = new Date();
    var stamp = '' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
    var seq = String(Math.floor(Math.random() * 900) + 100);
    return 'LF' + stamp + seq;
  }

  function genId() {
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  function load() {
    try {
      var raw = global.localStorage ? global.localStorage.getItem(STORAGE_KEY) : null;
      if (!raw) return null;
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : null;
    } catch (e) {
      return null;
    }
  }

  function save(items) {
    if (global.localStorage) {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    }
  }

  // 首次打开时写入的演示数据，让首页立刻有内容。
  function seed() {
    var now = Date.now();
    var H = 3600 * 1000, D = 24 * H;
    return [
      {
        id: genId(), code: 'LF2026092701', type: 'found',
        title: '黑色保温杯', category: '生活用品',
        location: '图书馆三楼自习区', time: '2026-09-27 09:20',
        description: '杯身贴有图书馆活动标签，杯盖边缘略有磨损，容量约500ml。目前暂存在图书馆三楼值班室，失主可携带学号前来认领。',
        contactName: '李思远', contactPhone: '13800138000', contactQq: '', contactWechat: '',
        publisher: '102402137', status: 'resolved', createdAt: now - 2 * H, views: 12
      },
      {
        id: genId(), code: 'LF2026092702', type: 'lost',
        title: '校园一卡通（学号2023开头）', category: '证件卡',
        location: '第二食堂二楼', time: '2026-09-26 18:40',
        description: '卡套内夹有一张健身房会员卡，丢失后急需用卡吃饭打水，拾到同学请联系，万分感谢。',
        contactName: '张同学', contactPhone: '13911112222', contactQq: '10086', contactWechat: '',
        publisher: '102402138', status: 'active', createdAt: now - 1 * D, views: 8
      },
      {
        id: genId(), code: 'LF2026092603', type: 'lost',
        title: '白色无线耳机充电盒', category: '数码电子',
        location: '体育馆羽毛球区', time: '2026-09-25 21:10',
        description: '耳机盒内侧有手写姓"陈"的贴纸，配套两只白色耳机，对本人很重要，捡到请联系。',
        contactName: '陈同学', contactPhone: '13722223333', contactQq: '', contactWechat: 'chen_wj2024',
        publisher: '102402138', status: 'active', createdAt: now - 2 * D, views: 15
      },
      {
        id: genId(), code: 'LF2026092504', type: 'found',
        title: '藏蓝色折叠雨伞', category: '雨具',
        location: '教学楼A座302', time: '2026-09-25 16:05',
        description: '伞柄有轻微掉漆，伞套已丢失，发现时落在教室后排座位。请失主描述伞柄特征认领。',
        contactName: '王小雨', contactPhone: '13633334444', contactQq: '', contactWechat: '',
        publisher: '102402137', status: 'active', createdAt: now - 2 * D, views: 5
      },
      {
        id: genId(), code: 'LF2026092405', type: 'found',
        title: '银色圆框眼镜', category: '随身物品',
        location: '校车站3号候车亭', time: '2026-09-24 08:15',
        description: '装在灰色眼镜盒内，镜片度数约300度。放在候车亭长椅上，估计是赶校车同学落下的。',
        contactName: '刘同学', contactPhone: '13544445555', contactQq: '20240901', contactWechat: '',
        publisher: '102402139', status: 'active', createdAt: now - 3 * D, views: 9
      },
      {
        id: genId(), code: 'LF2026092706', type: 'lost',
        title: '蓝色卡套校园卡', category: '证件卡',
        location: '第二食堂', time: '2026-09-27 12:10',
        description: '卡套为蓝色，上面印着学校校训。中午在食堂打饭时不慎遗失，急用于晚自习签到。',
        contactName: '王小雨', contactPhone: '13633334444', contactQq: '', contactWechat: '',
        publisher: '102402137', status: 'active', createdAt: now - 4 * H, views: 3
      }
    ];
  }

  function getAll() {
    var items = load();
    if (!items) {
      items = seed();
      save(items);
    }
    return items;
  }

  // 校验：返回 { ok:bool, errors:[], item|null }
  function validate(raw) {
    var errors = [];
    var r = raw || {};
    var title = (r.title || '').trim();
    var category = (r.category || '').trim();
    var location = (r.location || '').trim();
    var contactName = (r.contactName || '').trim();
    var phone = (r.contactPhone || '').trim();
    var qq = (r.contactQq || '').trim();
    var wechat = (r.contactWechat || '').trim();
    var publisher = (r.publisher || '').trim();

    if (r.type !== 'lost' && r.type !== 'found') errors.push('请选择信息类型（寻物/招领）');
    if (!title) errors.push('物品名称不能为空');
    else if (title.length > 30) errors.push('物品名称不能超过30字');
    if (!category) errors.push('请选择物品分类');
    else if (CATEGORIES.indexOf(category) === -1) errors.push('物品分类不在可选范围内');
    if (!location) errors.push('请填写丢失/拾取地点');
    else if (location.length > 50) errors.push('地点描述不能超过50字');
    if (!contactName) errors.push('请填写联系人称呼');
    if (!phone && !qq && !wechat) errors.push('请至少填写一种联系方式（电话/QQ/微信）');
    if (phone && !/^1[3-9]\d{9}$/.test(phone)) errors.push('联系电话应为11位大陆手机号');
    if (qq && !/^\d{5,12}$/.test(qq)) errors.push('QQ号应为5-12位数字');

    if (errors.length) return { ok: false, errors: errors, item: null };

    return {
      ok: true,
      errors: [],
      item: {
        id: genId(),
        code: genCode(),
        type: r.type,
        title: title,
        category: category,
        location: location,
        time: (r.time || '').trim() || '时间未填',
        description: ((r.description || '').trim()).slice(0, 500),
        contactName: contactName,
        contactPhone: phone,
        contactQq: qq,
        contactWechat: wechat,
        photo: (r.photo || ''),
        icon: (r.icon || ''),
        publisher: CURRENT_USER_ID,
        status: 'active',
        createdAt: Date.now(),
        views: 0
      }
    };
  }

  function add(raw) {
    var res = validate(raw);
    if (!res.ok) return res;
    var items = getAll();
    items.unshift(res.item);
    save(items);
    return { ok: true, errors: [], item: res.item };
  }

  function getById(id) {
    var items = getAll();
    for (var i = 0; i < items.length; i++) if (items[i].id === id) return items[i];
    return null;
  }

  // status: 'active' | 'resolved'
  function updateStatus(id, status) {
    if (status !== 'active' && status !== 'resolved') return false;
    var items = getAll();
    for (var i = 0; i < items.length; i++) {
      if (items[i].id === id) {
        items[i].status = status;
        save(items);
        return true;
      }
    }
    return false;
  }

  function remove(id) {
    var items = getAll();
    var next = items.filter(function (it) { return it.id !== id; });
    if (next.length === items.length) return false;
    save(next);
    return true;
  }

  function incrViews(id) {
    var items = getAll();
    for (var i = 0; i < items.length; i++) {
      if (items[i].id === id) {
        items[i].views = (items[i].views || 0) + 1;
        save(items);
        return;
      }
    }
  }

  // 组合查询：keyword / type / category / location / status
  // opt: { keyword, type, category, location, status }
  function query(opt) {
    opt = opt || {};
    var kw = (opt.keyword || '').trim().toLowerCase();
    var items = getAll();
    var out = [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (opt.type && opt.type !== 'all' && it.type !== opt.type) continue;
      if (opt.category && opt.category !== 'all' && it.category !== opt.category) continue;
      if (opt.location && opt.location !== 'all' && it.location.indexOf(opt.location) === -1) continue;
      if (opt.status && opt.status !== 'all' && it.status !== opt.status) continue;
      if (kw) {
        var hay = (it.title + ' ' + it.description + ' ' + it.location + ' ' + it.category).toLowerCase();
        if (hay.indexOf(kw) === -1) continue;
      }
      out.push(it);
    }
    // 排序：处理中的排前面，已找到/已归还的沉底；同一状态内按发布时间倒序
    out.sort(function (a, b) {
      var ra = a.status === 'resolved' ? 1 : 0;
      var rb = b.status === 'resolved' ? 1 : 0;
      if (ra !== rb) return ra - rb;
      return b.createdAt - a.createdAt;
    });
    return out;
  }

  function getByPublisher(name) {
    var n = (name || '').trim();
    if (!n) return [];
    return query({}).filter(function (it) {
      return (it.publisher || '') === n;
    });
  }

  // 首页顶部统计：今日新增、本周成功归还
  function getStats() {
    var items = getAll();
    var now = Date.now();
    var startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    var weekAgo = now - 7 * 24 * 3600 * 1000;
    var todayNew = 0, weekResolved = 0;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (it.createdAt >= startOfDay.getTime()) todayNew++;
      if (it.status === 'resolved' && it.createdAt >= weekAgo) weekResolved++;
    }
    return { total: items.length, todayNew: todayNew, weekResolved: weekResolved };
  }

  function _reset() { save(seed()); }

  // ---------- 个人信息（昵称 / 学院，可在“我的”页编辑） ----------
  function getProfile() {
    var def = {
      name: '王小雨', college: '计算机学院', campus: '东湖校区',
      avatar: '🐱', phone: '', wechat: '', qq: ''
    };
    try {
      var raw = global.localStorage ? global.localStorage.getItem(PROFILE_KEY) : null;
      if (raw) return Object.assign(def, JSON.parse(raw));
    } catch (e) {}
    return def;
  }
  function saveProfile(p) {
    var prof = {
      name: ((p.name || '').trim() || '未命名'),
      college: ((p.college || '').trim() || '东湖校区'),
      campus: ((p.campus || '').trim() || '东湖校区'),
      avatar: (p.avatar || '🐱'),
      phone: ((p.phone || '').trim()),
      wechat: ((p.wechat || '').trim()),
      qq: ((p.qq || '').trim())
    };
    if (global.localStorage) global.localStorage.setItem(PROFILE_KEY, JSON.stringify(prof));
    return prof;
  }

  var Store = {
    CATEGORIES: CATEGORIES,
    TYPES: TYPES,
    CURRENT_USER_ID: CURRENT_USER_ID,
    getAll: getAll,
    validate: validate,
    add: add,
    getById: getById,
    updateStatus: updateStatus,
    remove: remove,
    incrViews: incrViews,
    query: query,
    getByPublisher: getByPublisher,
    getStats: getStats,
    getProfile: getProfile,
    saveProfile: saveProfile,
    genCode: genCode,
    _seed: seed,
    _reset: _reset
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Store;
  else global.Store = Store;
})(typeof globalThis !== 'undefined' ? globalThis : this);
