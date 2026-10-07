/*
 * test/pages.test.js —— 页面静态一致性检查（不需要浏览器 / 不需要 jsdom）
 * 相当于把“人工点一遍页面”里最容易出错的几类问题自动化：
 *   1) HTML 里写的 id 和 JS 里 getElementById 的 id 对不上（点了没反应、白屏）
 *   2) 页面之间的链接、脚本、样式表路径写错（换台电脑就 404）
 *   3) 文件编码不是 UTF-8（助教打开就是乱码）
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PAGES = ['index.html', 'search.html', 'publish.html', 'detail.html', 'my.html'];

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));

// HTML 里静态声明的 id
function declaredIds(html) {
  const ids = new Set();
  const re = /\bid="([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) ids.add(m[1]);
  return ids;
}

// JS 里动态拼出来的 id（如 '<div id="contactArea"></div>'）
function dynamicIds() {
  const ids = new Set();
  const files = fs.readdirSync(path.join(ROOT, 'js')).filter((f) => f.endsWith('.js'));
  for (const f of files) {
    const src = read('js/' + f);
    const re = /\bid="([^"]+)"/g;
    let m;
    while ((m = re.exec(src))) ids.add(m[1]);
  }
  return ids;
}

// JS 里用到的 id
function usedIds(src) {
  const ids = new Set();
  for (const re of [/getElementById\(\s*'([^']+)'\s*\)/g, /getElementById\(\s*"([^"]+)"\s*\)/g]) {
    let m;
    while ((m = re.exec(src))) ids.add(m[1]);
  }
  return ids;
}

describe('目录结构：页面、脚本、样式表都在', () => {
  it('5 个页面都存在', () => {
    for (const p of PAGES) assert.ok(exists(p), `缺少页面 ${p}`);
  });

  it('每个页面都按 顺序 引入 store.js → common.js → 本页脚本', () => {
    for (const p of PAGES) {
      const html = read(p);
      const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
      const pageJs = 'js/' + p.replace(/\.html$/, '.js');
      assert.deepEqual(scripts, ['js/store.js', 'js/common.js', pageJs], `${p} 的脚本引入顺序不对`);
    }
  });

  it('页面引用的脚本、样式表文件真实存在', () => {
    for (const p of PAGES) {
      const html = read(p);
      const refs = [
        ...[...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]),
        ...[...html.matchAll(/<link[^>]+href="([^"]+)"/g)].map((m) => m[1])
      ];
      for (const r of refs) {
        if (/^https?:/.test(r)) continue;
        assert.ok(exists(r), `${p} 引用的 ${r} 不存在`);
      }
    }
  });

  it('js / css 目录下的文件都被某个页面用到，且没有多余文件', () => {
    const referenced = new Set();
    for (const p of PAGES) {
      const html = read(p);
      for (const m of html.matchAll(/(?:src|href)="((?:js|css)\/[^"]+)"/g)) referenced.add(m[1]);
    }
    const onDisk = [
      ...fs.readdirSync(path.join(ROOT, 'js')).map((f) => 'js/' + f),
      ...fs.readdirSync(path.join(ROOT, 'css')).map((f) => 'css/' + f)
    ];
    for (const f of onDisk) {
      assert.ok(referenced.has(f), `${f} 没有被任何页面引用（死文件）`);
    }
  });
});

describe('id 一致性：JS 找到的元素在页面上真的存在', () => {
  const dynamic = dynamicIds();

  it('每个页面脚本用到的 id 都能在页面（或动态生成的 HTML）里找到', () => {
    for (const p of PAGES) {
      const html = read(p);
      const js = read('js/' + p.replace(/\.html$/, '.js'));
      const known = new Set([...declaredIds(html), ...dynamic]);
      for (const id of usedIds(js)) {
        assert.ok(known.has(id), `${p} 的脚本里 getElementById('${id}') 找不到对应元素`);
      }
    }
  });

  it('页面里没有重复的 id（重复 id 会让 getElementById 取错元素）', () => {
    for (const p of PAGES) {
      const all = [...read(p).matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
      const dup = all.filter((x, i) => all.indexOf(x) !== i);
      assert.deepEqual(dup, [], `${p} 里存在重复 id：${dup.join(',')}`);
    }
  });
});

describe('链接一致性：页面之间的跳转不会 404', () => {
  it('HTML / JS 里出现的所有 .html 链接都存在', () => {
    const files = [
      ...PAGES,
      ...fs.readdirSync(path.join(ROOT, 'js')).map((f) => 'js/' + f)
    ];
    for (const f of files) {
      const src = read(f);
      for (const m of src.matchAll(/([A-Za-z0-9_-]+\.html)/g)) {
        assert.ok(exists(m[1]), `${f} 里的链接 ${m[1]} 不存在`);
      }
    }
  });

  it('底部导航在 5 个页面里都保持一致（首页/搜索/发布/我的）', () => {
    for (const p of PAGES) {
      const html = read(p);
      const nav = html.match(/<nav class="tabbar">([\s\S]*?)<\/nav>/);
      assert.ok(nav, `${p} 缺少底部导航`);
      const targets = [...nav[1].matchAll(/data-page="([^"]+)"/g)].map((m) => m[1]);
      assert.deepEqual(targets, ['home', 'search', 'publish', 'my'], `${p} 的底部导航项不一致`);
    }
  });
});

describe('编码：不会出现乱码', () => {
  it('所有源文件都是 UTF-8（没有 BOM、没有替换字符）', () => {
    const files = [
      ...PAGES,
      ...fs.readdirSync(path.join(ROOT, 'js')).map((f) => 'js/' + f),
      ...fs.readdirSync(path.join(ROOT, 'css')).map((f) => 'css/' + f)
    ];
    for (const f of files) {
      const buf = fs.readFileSync(path.join(ROOT, f));
      assert.notEqual(buf[0], 0xFF, `${f} 是 UTF-16 编码，Chrome 里会显示乱码`);
      assert.notEqual(buf[0], 0xFE, `${f} 是 UTF-16 编码，Chrome 里会显示乱码`);
      assert.equal(read(f).includes('\uFFFD'), false, `${f} 解码后出现替换字符`);
    }
  });

  it('页面声明了 charset=UTF-8 且标题是中文', () => {
    for (const p of PAGES) {
      const html = read(p);
      assert.ok(/<meta charset="UTF-8">/.test(html), `${p} 缺少 UTF-8 声明`);
      assert.ok(/<html lang="zh-CN">/.test(html), `${p} 缺少 lang="zh-CN"`);
      assert.ok(/<title>[^<]*[\u4e00-\u9fa5][^<]*<\/title>/.test(html), `${p} 的标题没有中文`);
    }
  });
});
