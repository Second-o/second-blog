/* ==========================================================
   二次可能 · 一键更新视频数据（浏览器控制台版）
   ----------------------------------------------------------
   为什么要有这个：
     B 站接口有风控，静态网页直接调基本会被拦（-352 / -799 / -403）。
     但在你自己已登录的浏览器里，投稿页的数据本来就是现成的，
     直接从页面 DOM 里读出来就 100% 能拿到，不需要任何接口权限。

   用法（30 秒）：
     1. 浏览器打开 https://space.bilibili.com/1328121264/upload/video
     2. 按 F12，切到「控制台 / Console」
     3. 把本文件全部内容粘贴进去，回车
     4. 会自动下载一个 videos-data.js
     5. 用它替换网站的 js/videos-data.js，刷新作品页即可
   ========================================================== */
(function () {
  var MID = 1328121264;
  var out = [];
  var seen = {};

  // B 站投稿页的卡片：链接里带 /video/BVxxxx
  var links = document.querySelectorAll('a[href*="/video/BV"]');
  links.forEach(function (a) {
    var m = (a.getAttribute('href') || '').match(/\/video\/(BV[0-9A-Za-z]+)/);
    if (!m) { return; }
    var bv = m[1];
    if (seen[bv]) { return; }

    // 往上找卡片容器，抠标题 / 播放数 / 时长 / 日期
    var box = a;
    for (var i = 0; i < 6 && box.parentElement; i++) {
      box = box.parentElement;
      if (box.querySelectorAll('a[href*="/video/BV"]').length > 1) { break; }
    }
    var text = (box.innerText || '').replace(/\s+/g, ' ').trim();

    var title = (a.getAttribute('title') || a.innerText || '').replace(/\s+/g, ' ').trim();
    if (!title || title.length < 2) {
      var tNode = box.querySelector('[title]');
      if (tNode) { title = (tNode.getAttribute('title') || '').trim(); }
    }
    if (!title) { return; }

    var playM = text.match(/([\d.]+)\s*万?\s*(?:播放|观看)/);
    var plays = 0;
    if (playM) {
      var num = parseFloat(playM[1]) || 0;
      plays = /万/.test(playM[0]) ? Math.round(num * 10000) : Math.round(num);
    }

    var lenM = text.match(/\b(\d{1,2}:\d{2}(?::\d{2})?)\b/);
    var dateM = text.match(/(\d{1,2}月\d{1,2}日|\d{4}年\d{1,2}月\d{1,2}日|昨天|前天|\d+\s*(?:分钟|小时|天)前)/);

    var pic = '';
    var img = box.querySelector('img[src*="hdslb"]');
    if (img) { pic = img.getAttribute('src') || ''; }

    seen[bv] = 1;
    out.push({
      bvid: bv,
      title: title,
      plays: plays,
      length: lenM ? lenM[1] : '',
      date: dateM ? dateM[1] : '',
      cover: pic
    });
  });

  if (!out.length) {
    console.warn('没读到视频。请确认：① 当前是投稿视频页 ② 卡片已加载出来 ③ 再粘一次。');
    return;
  }

  var today = new Date();
  var ymd = today.getFullYear() + '-' +
            String(today.getMonth() + 1).padStart(2, '0') + '-' +
            String(today.getDate()).padStart(2, '0');

  var body = out.map(function (v) {
    return '    {\n' +
      '      bvid: ' + JSON.stringify(v.bvid) + ',\n' +
      '      title: ' + JSON.stringify(v.title) + ',\n' +
      '      plays: ' + v.plays + ',\n' +
      '      length: ' + JSON.stringify(v.length) + ',\n' +
      '      date: ' + JSON.stringify(v.date) + ',\n' +
      '      cover: ' + JSON.stringify(v.cover) + '\n' +
      '    }';
  }).join(',\n');

  var content = '/* ==========================================================\n' +
    '   二次可能 · B 站投稿数据快照\n' +
    '   ----------------------------------------------------------\n' +
    '   本文件由「一键更新视频数据」脚本生成。\n' +
    '   更新时间：' + ymd + '\n' +
    '   ========================================================== */\n' +
    'window.SECOND_VIDEOS = {\n' +
    '  mid: ' + MID + ',\n' +
    "  updatedAt: '" + ymd + "',\n" +
    '  videos: [\n' + body + '\n  ]\n};\n';

  var blob = new Blob([content], { type: 'text/javascript;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'videos-data.js';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 3000);

  console.log('%c✅ 已生成 videos-data.js（' + out.length + ' 个视频）',
    'color:#2E7D53;font-weight:700;font-size:14px;');
  console.table(out.map(function (v) {
    return { BV号: v.bvid, 标题: v.title, 播放: v.plays, 时长: v.length, 日期: v.date };
  }));
  console.log('把它替换到网站的 js/videos-data.js，然后刷新作品页。');
})();
