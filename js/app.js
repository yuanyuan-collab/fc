/* =========================================================
 * 趣味测试 H5 引擎
 * - 从 data/*.json 加载测试（每个测试一个独立数据文件）
 * - 主题由 JSON theme 字段驱动（CSS 变量注入）
 * - 触摸优化：点选自动前进、左右滑动翻题、按压反馈
 * - 结果页 + Canvas 生成带二维码的分享图
 * ========================================================= */
(function () {
  'use strict';

  var QUIZ_ID = new URLSearchParams(location.search).get('quiz') || 'otherworld-talent';
  var $ = function (id) { return document.getElementById(id); };

  var state = {
    quiz: null,
    current: 0,
    scores: {},
    answers: [],
    locked: false
  };

  /* ---------- 屏幕切换 ---------- */
  function showScreen(name) {
    var screens = document.querySelectorAll('.screen');
    for (var i = 0; i < screens.length; i++) screens[i].classList.remove('active');
    $('screen-' + name).classList.add('active');
  }

  /* ---------- 装饰星空 ---------- */
  function buildDecor(containerId, emojis) {
    var layer = $(containerId);
    if (!layer) return;
    layer.innerHTML = '';
    var n = 14;
    for (var i = 0; i < n; i++) {
      var s = document.createElement('span');
      s.className = 'star';
      s.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      s.style.left = Math.random() * 100 + '%';
      s.style.top = Math.random() * 100 + '%';
      s.style.fontSize = 10 + Math.random() * 16 + 'px';
      s.style.setProperty('--tw-dur', 2 + Math.random() * 3 + 's');
      s.style.animationDelay = Math.random() * 3 + 's';
      layer.appendChild(s);
    }
  }

  /* ---------- 主题注入 ---------- */
  function applyTheme(theme) {
    var r = document.documentElement.style;
    r.setProperty('--bg', theme.bg);
    r.setProperty('--primary', theme.primary);
    r.setProperty('--accent', theme.accent);
    r.setProperty('--gold', theme.gold || '#ffd700');
    r.setProperty('--card-bg', theme.cardBg);
    r.setProperty('--card-border', theme.cardBorder);
    r.setProperty('--text-main', theme.textMain);
    r.setProperty('--text-sub', theme.textSub);
  }

  /* ---------- 初始化首页 ---------- */
  function initHome() {
    var q = state.quiz;
    document.title = q.title;
    $('home-emoji').textContent = q.emoji;
    $('home-title').textContent = q.title;
    $('home-subtitle').textContent = q.subtitle || '';
    $('home-desc').textContent = q.description || '';
    var base = 12000 + Math.floor(Math.random() * 3000);
    var played = parseInt(localStorage.getItem('played_' + q.id) || '0', 10);
    $('play-count').textContent = (base + played).toLocaleString();
    buildDecor('decor-home', q.theme.decorEmojis);
  }

  /* ---------- 答题逻辑 ---------- */
  function startQuiz() {
    state.current = 0;
    state.scores = {};
    state.answers = new Array(state.quiz.questions.length).fill(-1);
    buildDecor('decor-quiz', state.quiz.theme.decorEmojis);
    showScreen('quiz');
    renderQuestion(0, null);
  }

  function renderQuestion(index, direction) {
    var q = state.quiz.questions[index];
    var card = $('question-card');
    card.className = 'question-card';
    if (direction === 'next') card.classList.add('slide-in-left');
    else if (direction === 'prev') card.classList.add('slide-in-right');

    var total = state.quiz.questions.length;
    $('quiz-step').textContent = (index + 1) + ' / ' + total;
    var pct = Math.round(((index + 1) / total) * 100);
    $('quiz-pct').textContent = pct + '%';
    $('progress-bar').style.width = pct + '%';

    $('q-num').textContent = 'Q' + (index + 1);
    $('q-text').textContent = q.text;

    var box = $('options');
    box.innerHTML = '';
    var letters = ['A', 'B', 'C', 'D', 'E', 'F'];
    q.options.forEach(function (opt, i) {
      var btn = document.createElement('button');
      btn.className = 'option';
      var letter = document.createElement('span');
      letter.className = 'opt-letter';
      letter.textContent = letters[i];
      var txt = document.createElement('span');
      txt.textContent = opt.text;
      btn.appendChild(letter);
      btn.appendChild(txt);
      btn.addEventListener('click', function () { pickOption(i, btn); });
      box.appendChild(btn);
    });
    state.locked = false;
  }

  function pickOption(optIndex, btn) {
    if (state.locked) return;
    state.locked = true;
    btn.classList.add('picked');
    state.answers[state.current] = optIndex;

    // 轻微震动反馈（支持的设备）
    if (navigator.vibrate) navigator.vibrate(15);

    setTimeout(function () {
      var total = state.quiz.questions.length;
      if (state.current < total - 1) {
        goQuestion(state.current + 1, 'next');
      } else {
        finishQuiz();
      }
    }, 320);
  }

  function goQuestion(index, direction) {
    if (state.locked && direction !== null) {
      // 滑动时若刚选中则忽略
    }
    var card = $('question-card');
    var outClass = direction === 'next' ? 'slide-out-left' : 'slide-out-right';
    card.classList.add(outClass);
    setTimeout(function () {
      state.current = index;
      renderQuestion(index, direction);
    }, 200);
  }

  /* ---------- 滑动翻页 ---------- */
  function bindSwipe() {
    var body = $('quiz-body');
    var startX = 0, startY = 0, tracking = false;

    body.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      tracking = true;
    }, { passive: true });

    body.addEventListener('touchend', function (e) {
      if (!tracking) return;
      tracking = false;
      if (state.locked) return;
      var dx = e.changedTouches[0].clientX - startX;
      var dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      var total = state.quiz.questions.length;
      if (dx < 0 && state.current < total - 1 && state.answers[state.current] !== -1) {
        goQuestion(state.current + 1, 'next');
      } else if (dx > 0 && state.current > 0) {
        goQuestion(state.current - 1, 'prev');
      }
    }, { passive: true });
  }

  /* ---------- 结算 ---------- */
  function finishQuiz() {
    var scores = {};
    state.quiz.questions.forEach(function (q, qi) {
      var opt = q.options[state.answers[qi]];
      if (!opt) return;
      Object.keys(opt.scores).forEach(function (key) {
        scores[key] = (scores[key] || 0) + opt.scores[key];
      });
    });
    state.scores = scores;

    // 最高分天赋；平分则取在 results 中定义顺序靠前者
    var best = null, bestVal = -1;
    Object.keys(state.quiz.results).forEach(function (key) {
      var v = scores[key] || 0;
      if (v >= bestVal) { bestVal = v; best = key; }
    });
    state.resultKey = best;

    var played = parseInt(localStorage.getItem('played_' + state.quiz.id) || '0', 10);
    localStorage.setItem('played_' + state.quiz.id, String(played + 1));

    buildDecor('decor-loading', state.quiz.theme.decorEmojis);
    showScreen('loading');
    setTimeout(function () { renderResult(); }, 1400);
  }

  /* ---------- 结果页 ---------- */
  function renderResult() {
    var q = state.quiz;
    var r = q.results[state.resultKey];
    var root = document.documentElement.style;
    root.setProperty('--result-color', r.color);
    root.setProperty('--result-glow', r.color);

    $('result-emoji').textContent = r.emoji;
    $('result-name').textContent = r.name;
    $('result-title').textContent = r.title;
    $('result-tagline').textContent = '「' + r.tagline + '」';
    $('result-desc').textContent = r.description;

    var traitsBox = $('result-traits');
    traitsBox.innerHTML = '';
    r.traits.forEach(function (t) {
      var tag = document.createElement('span');
      tag.className = 'trait-tag';
      tag.textContent = '# ' + t;
      traitsBox.appendChild(tag);
    });

    var skillsBox = $('result-skills');
    skillsBox.innerHTML = '';
    var heading = document.createElement('div');
    heading.className = 'skills-heading';
    heading.textContent = '⚔ 觉醒技能详解 ⚔';
    skillsBox.appendChild(heading);
    r.skills.forEach(function (s, i) {
      var item = document.createElement('div');
      item.className = 'skill-item';
      item.innerHTML =
        '<div class="skill-icon">' + (i + 1) + '</div>' +
        '<div><div class="skill-name">' + s.name + '</div>' +
        '<div class="skill-desc">' + s.desc + '</div></div>';
      skillsBox.appendChild(item);
    });

    $('result-soulmate').innerHTML = '💞 最佳拍档：<b>' + r.soulmate + '</b>，快 @ TA 来测！';

    buildDecor('decor-result', q.theme.decorEmojis);
    showScreen('result');
    var scroll = document.querySelector('.result-scroll');
    if (scroll) scroll.scrollTop = 0;
  }

  /* ---------- 分享图生成 ---------- */
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function wrapText(ctx, text, maxWidth) {
    var lines = [], line = '';
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (ctx.measureText(line + ch).width > maxWidth && line) {
        lines.push(line);
        line = ch;
      } else {
        line += ch;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function generateShareImage() {
    var q = state.quiz;
    var r = q.results[state.resultKey];
    var share = q.share || {};

    var W = 750, H = 1334;
    var canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');

    // 背景渐变（使用结果天赋色）
    var g = ctx.createLinearGradient(0, 0, W, H);
    var grad = r.gradient || ['#2d1b69', '#0f3460'];
    g.addColorStop(0, grad[0]);
    g.addColorStop(1, grad[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // 装饰光斑
    ctx.globalAlpha = 0.12;
    for (var i = 0; i < 6; i++) {
      var cx = Math.random() * W, cy = Math.random() * H, cr = 60 + Math.random() * 140;
      var rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, cr);
      rg.addColorStop(0, '#ffffff');
      rg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(cx - cr, cy - cr, cr * 2, cr * 2);
    }
    ctx.globalAlpha = 1;

    // 星星点缀
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (var j = 0; j < 40; j++) {
      var sx = Math.random() * W, sy = Math.random() * H, sr = Math.random() * 2.2 + 0.5;
      ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
    }

    var cx = W / 2;

    // 顶部标题
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '600 30px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText('✦ ' + (share.slogan || q.title) + ' ✦', cx, 92);

    // 主卡片
    var cardX = 55, cardY = 130, cardW = W - 110, cardH = 880;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 12;
    roundRect(ctx, cardX, cardY, cardW, cardH, 32);
    ctx.fillStyle = 'rgba(255,255,255,0.97)';
    ctx.fill();
    ctx.restore();

    // 徽章
    ctx.fillStyle = r.color;
    ctx.font = '700 22px "PingFang SC", sans-serif';
    var badgeText = '我的异世界天赋';
    var bw = ctx.measureText(badgeText).width + 48;
    roundRect(ctx, cx - bw / 2, cardY + 42, bw, 44, 22);
    ctx.globalAlpha = 0.14; ctx.fill(); ctx.globalAlpha = 1;
    ctx.fillStyle = r.color;
    ctx.fillText(badgeText, cx, cardY + 73);

    // 天赋 emoji
    ctx.font = '110px sans-serif';
    ctx.fillText(r.emoji, cx, cardY + 210);

    // 天赋名
    ctx.fillStyle = '#22103f';
    ctx.font = '800 58px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText(r.name, cx, cardY + 300);

    // 天赋等级
    ctx.font = '700 26px "PingFang SC", sans-serif';
    var tw = ctx.measureText(r.title).width + 44;
    var tg = ctx.createLinearGradient(cx - tw / 2, 0, cx + tw / 2, 0);
    tg.addColorStop(0, r.color);
    tg.addColorStop(1, grad[0]);
    roundRect(ctx, cx - tw / 2, cardY + 330, tw, 48, 24);
    ctx.fillStyle = tg;
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(r.title, cx, cardY + 364);

    // tagline
    ctx.fillStyle = '#7c6b9e';
    ctx.font = 'italic 26px "PingFang SC", sans-serif';
    ctx.fillText('「' + r.tagline + '」', cx, cardY + 424);

    // 分割线
    ctx.strokeStyle = 'rgba(120,90,180,0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cardX + 50, cardY + 460);
    ctx.lineTo(cardX + cardW - 50, cardY + 460);
    ctx.stroke();

    // 描述（自动换行）
    ctx.fillStyle = '#4a3a6b';
    ctx.font = '26px "PingFang SC", sans-serif';
    ctx.textAlign = 'left';
    var descLines = wrapText(ctx, r.description, cardW - 110).slice(0, 5);
    descLines.forEach(function (line, idx) {
      ctx.fillText(line, cardX + 55, cardY + 512 + idx * 42);
    });

    // 技能列表（取前 2 个）
    var sy = cardY + 512 + descLines.length * 42 + 26;
    ctx.textAlign = 'center';
    ctx.fillStyle = r.color;
    ctx.font = '800 26px "PingFang SC", sans-serif';
    ctx.fillText('⚔ 觉醒技能 ⚔', cx, sy);
    sy += 22;
    ctx.textAlign = 'left';
    r.skills.slice(0, 2).forEach(function (s) {
      sy += 52;
      roundRect(ctx, cardX + 55, sy - 34, cardW - 110, 52, 14);
      ctx.fillStyle = 'rgba(120, 90, 180, 0.09)';
      ctx.fill();
      ctx.fillStyle = '#22103f';
      ctx.font = '700 25px "PingFang SC", sans-serif';
      ctx.fillText('· ' + s.name, cardX + 78, sy);
      ctx.fillStyle = '#8a7bab';
      ctx.font = '22px "PingFang SC", sans-serif';
      var d = s.desc.length > 16 ? s.desc.slice(0, 16) + '…' : s.desc;
      ctx.fillText(d, cardX + 78 + ctx.measureText('· ' + s.name).width + 16, sy);
    });

    // 底部：二维码 + CTA
    var qrSize = 150;
    var qrY = H - 240;
    try {
      // 二维码指向分享链接：优先取 share.url，否则用当前页面地址（保留 ?quiz= 参数，确保回到当前测试）
      var qrUrl = share.url || location.href.split('#')[0];
      var qr = qrcode(0, 'M');
      qr.addData(qrUrl);
      qr.make();
      var qrImg = new Image();
      qrImg.src = qr.createDataURL(6, 2);
      // createDataURL 为同步字符串，直接绘制需等待加载
      qrImg.onload = function () {
        finishDraw(qrImg);
      };
      qrImg.onerror = function () { finishDraw(null); };
    } catch (e) {
      finishDraw(null);
    }

    function finishDraw(qrImg) {
      // 底部面板
      roundRect(ctx, 55, qrY - 26, W - 110, 210, 26);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fill();

      if (qrImg) {
        ctx.save();
        roundRect(ctx, 85, qrY, qrSize, qrSize, 16);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.clip();
        ctx.drawImage(qrImg, 91, qrY + 6, qrSize - 12, qrSize - 12);
        ctx.restore();
      }

      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 34px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillText('你的天赋是什么？', 270, qrY + 52);
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = '25px "PingFang SC", sans-serif';
      ctx.fillText(share.cta || '扫码测一测', 270, qrY + 96);
      ctx.fillStyle = r.color;
      ctx.font = '600 22px "PingFang SC", sans-serif';
      ctx.fillText(share.hashtags || '', 270, qrY + 136);

      var url = canvas.toDataURL('image/png');
      var img = $('share-img');
      img.src = url;
      $('share-modal').classList.add('open');

      // 尝试触发下载（桌面端有效；移动端走长按保存）
      try {
        var a = document.createElement('a');
        a.href = url;
        a.download = '异世界天赋-' + r.name + '.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } catch (e) { /* 移动端忽略 */ }
    }
  }

  /* ---------- 事件绑定 ---------- */
  function bindEvents() {
    $('btn-start').addEventListener('click', startQuiz);
    $('btn-retry').addEventListener('click', function () { showScreen('home'); });
    $('btn-save').addEventListener('click', generateShareImage);
    $('btn-close-modal').addEventListener('click', function () {
      $('share-modal').classList.remove('open');
    });
    $('modal-mask').addEventListener('click', function () {
      $('share-modal').classList.remove('open');
    });
    bindSwipe();
  }

  /* ---------- 启动 ---------- */
  function init(quiz) {
    state.quiz = quiz;
    applyTheme(quiz.theme);
    initHome();
    bindEvents();
    showScreen('home');
  }

  function showError() {
    $('home-title').textContent = '测试加载失败';
    $('home-subtitle').textContent = '请通过 http 服务访问，或检查数据文件';
  }

  function boot() {
    // 优先从独立 JSON 文件加载（部署到 Pages 的标准方式）
    // file:// 直接双击打开时 fetch 会被浏览器拦截，此时回退到内嵌数据
    fetch('data/' + QUIZ_ID + '.json')
      .then(function (res) {
        if (!res.ok) throw new Error('quiz not found');
        return res.json();
      })
      .then(function (quiz) {
        init(quiz);
      })
      .catch(function () {
        var fallback = window.__QUIZZES__ && window.__QUIZZES__[QUIZ_ID];
        if (fallback) {
          init(fallback);
        } else {
          showError();
        }
      });
  }

  boot();
})();
