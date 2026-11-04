/* ==========================================================
   二次可能 · 个人网站  公共脚本
   1. 移动端菜单
   2. 卡片滚动淡入
   3. 控制台小彩蛋
   ========================================================== */
(function () {
  'use strict';

  // 标记脚本可用，让 .card 的兜底样式失效
  document.documentElement.classList.remove('no-js');

  // ---------- 1. 移动端菜单 ----------
  var burger = document.getElementById('burger');
  var navLinks = document.getElementById('navLinks');
  if (burger && navLinks) {
    burger.addEventListener('click', function () {
      navLinks.classList.toggle('open');
    });
    navLinks.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') { navLinks.classList.remove('open'); }
    });
    // 点击页面其他位置收起菜单
    document.addEventListener('click', function (e) {
      if (!burger.contains(e.target) && !navLinks.contains(e.target)) {
        navLinks.classList.remove('open');
      }
    });
  }

  // ---------- 2. 卡片滚动淡入 ----------
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('show'); }
      });
    }, { threshold: 0.12 });
    document.querySelectorAll('.card').forEach(function (c) { io.observe(c); });
  } else {
    document.querySelectorAll('.card').forEach(function (c) { c.classList.add('show'); });
  }

  // ---------- 3. 控制台小彩蛋 ----------
  var art = [
    "███████  ███████  ██████   ██████   ███    ██  ██████ ",
    "██       ██      ██       ██    ██  ████   ██  ██   ██",
    "███████  █████   ██       ██    ██  ██ ██  ██  ██   ██",
    "     ██  ██      ██       ██    ██  ██  ██ ██  ██   ██",
    "███████  ███████  ██████   ██████   ██   ████  ██████",
   ];

  // 换行符用字符码构造，避免转义差异
  var NL = String.fromCharCode(10);

  var palette = ['#FFD89B', '#FFC46B', '#F0A94B', '#E8973A', '#D9832B', '#C9751F'];
  var mono = 'font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px;line-height:1.15;font-weight:700;';
  var styles = palette.map(function (c) { return 'color:' + c + ';' + mono; });

  // 六行字符画一次性输出，行距不会被其他日志打乱
  var out = art.map(function (r) { return '%c' + r; }).join(NL);
  console.log.apply(console, [out].concat(styles));

  // 签名
  console.log('%c 二 次 可 能 ',
    'background:linear-gradient(90deg,#FFC46B,#E8973A);color:#1B2A3A;' +
    'padding:4px 14px;border-radius:999px;font-weight:700;font-size:13px;letter-spacing:2px;');

  console.log('%c嘿bro，你居然翻到这儿了 👀',
    'color:#FFC46B;font-size:14px;font-weight:600;margin-top:6px;');

  var desc = [
    '既然会打开控制台，说明我们都是喜欢折腾的人。',
    '这个网站是我自己从零手写的',
    '有问题想聊？QQ 3980136315 · Secondo__@outlook.com'
  ].join(NL);
  console.log('%c' + desc, 'color:#A8BCD0;font-size:12px;line-height:1.8;');

  // 小游戏彩蛋提示（仅在游戏脚本加载成功时出现）
  if (typeof window.eat_fish_together === 'function') {
    console.log('%c🎮 彩蛋：在控制台输入 eat_fish_together() 开始「一起吃小鱼」',
      'background:rgba(232,151,58,.16);color:#C9751F;padding:6px 12px;border-radius:8px;' +
      'font-size:13px;font-weight:600;border:1px solid rgba(232,151,58,.45);');
    console.log('%c   结束游戏：eat_fish_together.stop()',
      'color:#7A8B9C;font-size:12px;font-style:italic;');
  }

  console.log('%c© 2026 二次可能  用 HTML + CSS + JavaScript 手写',
    'color:#5B6B7C;font-size:11px;');
})();
