/* ==========================================================
   二次可能 · 作品页脚本
   1. 用 js/videos-data.js 的数据动态生成作品卡片
   2. 播放器切换自动刷新（先断旧会话再载入新地址）
   3. 自动检查有没有新投稿：
      - 打开页面静默查一次，也可以点「检查新视频」手动查
      - 依次尝试：B 站接口直连 → 几个公共 CORS 代理
      - 查到就走缓存 + 标 NEW；查不到就保留本地数据，给跳转入口
      - 无论成败，页面都不会白屏或丢卡片
   说明：B 站接口有风控，公共代理也不稳定，所以「全自动」不保证成功。
        想 100% 拿到最新列表，用 tools/一键更新视频数据.js
        （在已登录的 B 站投稿页跑一下，会直接生成新的 videos-data.js）。
   ========================================================== */
(function () {
  'use strict';

  var DATA       = window.SECOND_VIDEOS || { mid: 0, updatedAt: '', videos: [] };
  var MID        = DATA.mid || 1328121264;
  var CACHE_KEY  = 'second:videos-cache';   // 上次成功抓到的列表
  var SEEN_KEY   = 'second:videos-seen';    // 见过的视频号（判断新旧）
  var NEW_KEY    = 'second:videos-new';     // 还没点开过的新视频号

  var grid     = document.getElementById('worksGrid');
  var titleEl  = document.getElementById('playerTitle');
  var wrap     = document.getElementById('playerWrap');
  var btn      = document.getElementById('playerRefresh');
  var loading  = document.getElementById('playerLoading');
  var checkBtn = document.getElementById('checkUpdate');
  var statusEl = document.getElementById('worksStatus');

  var players = [];   // 当前渲染出来的卡片
  var current = '';   // 当前播放的 bvid
  var seq = 0;

  /* ---------------- 小工具 ---------------- */

  function lsGet(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
  }
  function lsSet(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }

  // 播放数：超过一万压成「x.x 万」
  function fmtPlays(n) {
    n = Number(n) || 0;
    if (n >= 10000) { return (n / 10000).toFixed(1).replace('.0', '') + ' 万'; }
    return String(n);
  }

  // 时间戳 → 「x月x日」，跨年补上年份
  function fmtDate(ts) {
    if (!ts) { return ''; }
    var d = new Date(ts * 1000);
    if (isNaN(d.getTime())) { return ''; }
    var now = new Date();
    if (d.getFullYear() !== now.getFullYear()) {
      return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日';
    }
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }

  // 统一成页面内部用的结构
  function normalize(v) {
    return {
      bvid:    v.bvid,
      title:   v.title || '未命名投稿',
      plays:   Number(v.plays) || 0,
      length:  v.length || '',
      date:    v.date || fmtDate(v.created),
      cover:   v.cover || v.pic || '',
      created: Number(v.created) || 0
    };
  }

  /* ---------------- 数据合并 ---------------- */

  // 本地快照 + 浏览器缓存，按 bvid 去重（缓存优先，因为它更新）
  function mergedVideos() {
    var cached = lsGet(CACHE_KEY);
    var list = [];
    var seen = {};

    (cached && cached.videos ? cached.videos : []).forEach(function (v) {
      var n = normalize(v);
      if (n.bvid && !seen[n.bvid]) { seen[n.bvid] = 1; list.push(n); }
    });
    (DATA.videos || []).forEach(function (v) {
      var n = normalize(v);
      if (n.bvid && !seen[n.bvid]) { seen[n.bvid] = 1; list.push(n); }
    });

    // 有发布时间就按时间倒序，没有就保持原顺序（原顺序已是「最新发布」）
    if (list.every(function (v) { return !v.created; })) { return list; }
    return list.sort(function (a, b) { return (b.created || 0) - (a.created || 0); });
  }

  /* ---------------- 渲染卡片 ---------------- */

  function buildCard(v, isNew) {
    var card = document.createElement('button');
    card.className = 'work-card';
    card.type = 'button';
    card.setAttribute('data-bvid', v.bvid);
    card.setAttribute('data-title', v.title);

    var thumb = document.createElement('div');
    thumb.className = 'work-thumb';
    if (v.cover) {
      var img = document.createElement('img');
      img.src = v.cover;
      img.alt = '';
      img.loading = 'lazy';
      img.referrerPolicy = 'no-referrer';   // 绕过 B 站图床的防盗链
      img.addEventListener('error', function () { img.remove(); });   // 封面挂了退回渐变底
      thumb.appendChild(img);
    }
    if (v.length) {
      var dur = document.createElement('span');
      dur.className = 'work-dur';
      dur.textContent = v.length;
      thumb.appendChild(dur);
    }
    if (isNew) {
      var tag = document.createElement('span');
      tag.className = 'work-new';
      tag.textContent = 'NEW';
      thumb.appendChild(tag);
    }

    var info = document.createElement('div');
    info.className = 'work-info';

    var t = document.createElement('div');
    t.className = 'work-title';
    t.textContent = v.title;

    var m = document.createElement('div');
    m.className = 'work-meta';
    m.textContent = fmtPlays(v.plays) + ' 播放' + (v.date ? ' · ' + v.date : '');

    info.appendChild(t);
    info.appendChild(m);
    card.appendChild(thumb);
    card.appendChild(info);
    return card;
  }

  function renderGrid(videos, newSet) {
    if (!grid) { return; }
    grid.innerHTML = '';

    videos.forEach(function (v) {
      var card = buildCard(v, newSet && newSet[v.bvid]);
      card.addEventListener('click', function () { load(v.bvid, v.title, true); });
      grid.appendChild(card);
    });

    // 最后一张恒定入口：去 B 站看全部
    var more = document.createElement('a');
    more.className = 'work-card';
    more.href = 'https://space.bilibili.com/' + MID + '/upload';
    more.target = '_blank';
    more.rel = 'noopener';
    more.innerHTML =
      '<div class="work-thumb"><span class="work-more-icon">🎬</span></div>' +
      '<div class="work-info"><div class="work-title">查看全部投稿</div>' +
      '<div class="work-meta">共 ' + videos.length + ' 个视频 · 前往 B 站</div></div>';
    grid.appendChild(more);

    players = Array.prototype.slice.call(grid.querySelectorAll('.work-card[data-bvid]'));
  }

  /* ---------------- 播放器 ---------------- */

  function buildUrl(bvid, autoplay) {
    seq += 1;
    return 'https://player.bilibili.com/player.html?bvid=' + bvid +
           '&page=1&high_quality=1&danmaku=0' +
           '&autoplay=' + (autoplay ? 1 : 0) +
           '&t=' + Date.now() + '_' + seq;
  }

  var hideTimer = null;
  function showLoading() {
    if (!loading) { return; }
    loading.classList.remove('hide');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hideLoading, 8000);   // 兜底：8 秒后无论如何收起遮罩
  }
  function hideLoading() {
    if (!loading) { return; }
    loading.classList.add('hide');
    clearTimeout(hideTimer);
  }

  function render(bvid, autoplay) {
    if (!wrap) { return; }
    current = bvid;

    var old = wrap.querySelector('iframe');
    var f = document.createElement('iframe');
    f.id = 'biliPlayer';
    f.setAttribute('allowfullscreen', 'true');
    f.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture');
    f.setAttribute('scrolling', 'no');
    f.setAttribute('frameborder', 'no');
    f.setAttribute('framespacing', '0');
    f.setAttribute('referrerpolicy', 'no-referrer');
    f.title = '哔哩哔哩播放器';
    f.src = 'about:blank';            // 关键：先断开旧会话，避免复用旧画面

    if (old) { wrap.replaceChild(f, old); }
    else { wrap.insertBefore(f, wrap.firstChild); }

    showLoading();

    var realSet = false;
    f.addEventListener('load', function () {
      if (realSet) { hideLoading(); }
    });

    var url = buildUrl(bvid, autoplay);
    setTimeout(function () {
      realSet = true;
      f.src = url;                    // 再写入带时间戳的真实地址
    }, 40);
  }

  function load(bvid, title, autoplay) {
    render(bvid, !!autoplay);
    players.forEach(function (c) { c.classList.remove('active'); });
    var hit = players.filter(function (c) { return c.getAttribute('data-bvid') === bvid; })[0];
    if (hit) { hit.classList.add('active'); }
    if (titleEl) { titleEl.textContent = title || ''; }
    if (autoplay && window.innerWidth < 640 && wrap) {
      wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  /* ---------------- 状态栏 ---------------- */

  function setStatus(text, tone) {
    if (!statusEl) { return; }
    statusEl.textContent = text;
    statusEl.className = 'works-status' + (tone ? ' ' + tone : '');
  }

  // 查不到时：说明 + 一个直接去 B 站的入口
  function setFailStatus() {
    if (!statusEl) { return; }
    statusEl.className = 'works-status warn';
    statusEl.textContent = '这次没查到更新（B 站接口有频率限制，属正常），当前显示本地数据 · 更新于 ' +
      (DATA.updatedAt || '未知') + ' ';
    var a = document.createElement('a');
    a.href = 'https://space.bilibili.com/' + MID + '/upload';
    a.target = '_blank';
    a.rel = 'noopener';
    a.className = 'status-link';
    a.textContent = '去 B 站看最新投稿 →';
    statusEl.appendChild(a);
  }

  /* ---------------- 自动检查新视频 ---------------- */

  // 直连 + 公共代理，轮着试；任何一个通了就更新
  function proxyList() {
    var api = 'https://api.bilibili.com/x/space/wbi/arc/search?mid=' + MID + '&ps=30&pn=1&order=pubdate';
    var enc = encodeURIComponent(api);
    return [
      api,                                                      // 直连（无 CORS 限制的环境可用）
      'https://api.allorigins.win/raw?url=' + enc,
      'https://api.codetabs.com/v1/proxy?quest=' + enc,
      'https://api.cors.lol/?url=' + enc,
      'https://cors.eu.org/' + api
    ];
  }

  // 从各种可能的返回结构里抠出视频数组
  function pickList(json) {
    if (!json) { return null; }
    var d = json.data || json;
    if (d && d.list && Array.isArray(d.list.vlist)) { return d.list.vlist; }
    if (d && Array.isArray(d.list)) { return d.list; }
    return null;
  }

  function fetchOnce(url, timeout) {
    return new Promise(function (resolve, reject) {
      var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
      var timer = setTimeout(function () {
        if (ctrl) { ctrl.abort(); }
        reject(new Error('timeout'));
      }, timeout);
      fetch(url, { signal: ctrl ? ctrl.signal : undefined, credentials: 'omit' })
        .then(function (r) { return r.text(); })
        .then(function (txt) {
          clearTimeout(timer);
          var json;
          try { json = JSON.parse(txt); } catch (e) { return reject(new Error('bad-json')); }
          if (json && json.code !== undefined && json.code !== 0) {
            return reject(new Error('code-' + json.code));
          }
          var list = pickList(json);
          if (!list) { return reject(new Error('no-list')); }
          resolve(list);
        })
        .catch(function (e) { clearTimeout(timer); reject(e); });
    });
  }

  // 记住见过的视频号；第一次运行只做基线，不把老视频全标成 NEW
  function syncSeen(videos) {
    var seen = lsGet(SEEN_KEY);
    if (!Array.isArray(seen)) {
      lsSet(SEEN_KEY, videos.map(function (v) { return v.bvid; }));
      return {};
    }
    var newSet = {};
    videos.forEach(function (v) {
      if (seen.indexOf(v.bvid) === -1) { newSet[v.bvid] = true; }
    });
    lsSet(SEEN_KEY, seen.concat(videos.map(function (v) { return v.bvid; })));
    if (Object.keys(newSet).length) { lsSet(NEW_KEY, Object.keys(newSet)); }
    return newSet;
  }

  function storedNew() {
    var arr = lsGet(NEW_KEY);
    var set = {};
    if (Array.isArray(arr)) { arr.forEach(function (b) { set[b] = true; }); }
    return set;
  }

  var checking = false;

  function checkUpdate() {
    if (checking) { return; }
    checking = true;
    if (checkBtn) { checkBtn.disabled = true; checkBtn.classList.add('loading'); }
    setStatus('正在检查有没有新投稿…', 'busy');

    var urls = proxyList();
    var i = 0;

    function next() {
      if (i >= urls.length) {
        setFailStatus();
        done();
        return;
      }
      var url = urls[i++];
      fetchOnce(url, 9000).then(function (list) {
        var videos = list.map(function (v) {
          return normalize({
            bvid: v.bvid, title: v.title, plays: v.play,
            length: v.length, created: v.created, pic: v.pic
          });
        }).filter(function (v) { return v.bvid; });

        if (!videos.length) { return next(); }

        // 抓到了：写缓存 → 比新旧 → 重绘
        lsSet(CACHE_KEY, { updatedAt: new Date().toISOString(), videos: videos });
        var newSet = syncSeen(videos);
        var all = mergedVideos();
        var newCount = 0;
        all.forEach(function (v) { if (newSet[v.bvid]) { newCount += 1; } });

        var mark = {};
        Object.keys(storedNew()).forEach(function (k) { mark[k] = true; });
        Object.keys(newSet).forEach(function (k) { mark[k] = true; });

        renderGrid(all, mark);
        keepActive();

        var now = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        setStatus(
          newCount > 0
            ? '发现有 ' + newCount + ' 个新投稿 🎉 现在一共 ' + all.length + ' 个视频'
            : '已是最新 · 共 ' + all.length + ' 个视频（' + now + ' 检查）',
          'ok'
        );
        done();
      }).catch(function () {
        next();   // 这个通道不行就换下一个
      });
    }

    function done() {
      checking = false;
      if (checkBtn) { checkBtn.disabled = false; checkBtn.classList.remove('loading'); }
    }

    next();
  }

  // 重绘后把高亮还给当前视频；当前视频不在了就退到第一个
  function keepActive() {
    var still = false;
    players.forEach(function (c) {
      if (c.getAttribute('data-bvid') === current) { c.classList.add('active'); still = true; }
    });
    if (!still && players.length) {
      var first = players[0];
      first.classList.add('active');
      render(first.getAttribute('data-bvid'), false);
      if (titleEl) { titleEl.textContent = first.getAttribute('data-title'); }
    }
  }

  /* ---------------- 启动 ---------------- */

  var videos = mergedVideos();
  if (!videos.length) {
    setStatus('没有读到投稿数据，可以直接去 B 站看。', 'warn');
    return;
  }

  // 首次进入只做基线记录，不误报 NEW
  if (!lsGet(SEEN_KEY)) { syncSeen(videos); }

  renderGrid(videos, storedNew());
  load(videos[0].bvid, videos[0].title, false);

  setStatus('本地数据 · 更新于 ' + (DATA.updatedAt || '未知') + '，点右侧按钮检查有没有新投稿', '');

  // 打开页面 1.2 秒后静默检查一次（失败也只是换文案，不打扰）
  setTimeout(function () {
    if (navigator.onLine === false) { return; }
    checkUpdate();
  }, 1200);

  if (checkBtn) {
    checkBtn.addEventListener('click', function (e) {
      e.preventDefault();
      checkUpdate();
    });
  }

  /* 手动刷新当前视频 */
  if (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      render(current, false);
      btn.classList.add('spinning');
      setTimeout(function () { btn.classList.remove('spinning'); }, 700);
    });
  }
})();
