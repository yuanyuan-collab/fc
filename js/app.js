/* =========================================================
 * 极简风测试 H5 引擎
 * - 数据驱动：data/<id>.json（每个测试独立）
 * - 首屏不预渲染任何测试文案，数据就绪后一次性展示
 * - 支持综合评分 + 多维度评分
 * - Canvas 生成带二维码的极简分享图
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
    locked: false,
    charmScore: 0,
    dims: []
  };

  /* ---------- 配置文案（避免把某个测试的文案写死） ---------- */
  function label(key, fallback) {
    var L = (state.quiz && state.quiz.labels) || {};
    var v = L[key];
    return (v === undefined || v === null || v === '') ? fallback : v;
  }

  /* ---------- 屏幕切换 ---------- */
  function showScreen(name) {
    var screens = document.querySelectorAll('.screen');
    for (var i = 0; i < screens.length; i++) screens[i].classList.remove('active');
    var el = $('screen-' + name);
    if (el) el.classList.add('active');
  }

  /* ---------- 主题注入 ---------- */
  function applyTheme(theme) {
    if (!theme) return;
    var r = document.documentElement.style;
    var map = {
      '--bg': theme.bg,
      '--primary': theme.primary,
      '--accent': theme.accent,
      '--surface': theme.surface,
      '--surface-strong': theme.surfaceStrong,
      '--line': theme.line,
      '--card-bg': theme.cardBg,
      '--card-shadow': theme.cardShadow,
      '--btn-bg': theme.btnBg,
      '--btn-text': theme.btnText,
      '--text-main': theme.textMain,
      '--text-sub': theme.textSub
    };
    Object.keys(map).forEach(function (k) {
      if (map[k]) r.setProperty(k, map[k]);
    });
    // 移动端浏览器地址栏配色
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta && theme.bg && theme.bg.charAt(0) === '#') meta.setAttribute('content', theme.bg);
  }

  /* ---------- 首页 ---------- */
  function initHome() {
    var q = state.quiz;
    document.title = q.title;

    $('home-emoji').textContent = q.emoji || '';
    $('home-title').textContent = q.title || '';
    $('home-subtitle').textContent = q.subtitle || '';
    $('home-desc').textContent = q.description || '';
    $('btn-start-text').textContent = label('startBtn', '开始测试');
    $('swipe-hint').textContent = label('swipeHint', '点选作答 · 左右滑动切换');
    $('loading-text').textContent = label('loadingText', '正在计算');

    var base = 12000 + Math.floor(Math.random() * 3000);
    var played = parseInt(localStorage.getItem('played_' + q.id) || '0', 10);
    var tip = document.querySelector('.home-tip');
    if (tip) tip.innerHTML = (base + played).toLocaleString() + ' ' + label('homeTip', '人已完成');
  }

  /* ---------- 答题 ---------- */
  function startQuiz() {
    state.current = 0;
    state.scores = {};
    state.answers = new Array(state.quiz.questions.length).fill(-1);
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

    $('q-num').textContent = String(index + 1).padStart(2, '0');
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
    if (navigator.vibrate) navigator.vibrate(12);

    setTimeout(function () {
      var total = state.quiz.questions.length;
      if (state.current < total - 1) goQuestion(state.current + 1, 'next');
      else finishQuiz();
    }, 300);
  }

  function goQuestion(index, direction) {
    var card = $('question-card');
    card.classList.add(direction === 'next' ? 'slide-out-left' : 'slide-out-right');
    setTimeout(function () {
      state.current = index;
      renderQuestion(index, direction);
    }, 190);
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

    // 结果类型：最高分者，平分取定义顺序靠前者
    var best = null, bestVal = -1;
    Object.keys(state.quiz.results).forEach(function (key) {
      var v = scores[key] || 0;
      if (v >= bestVal) { bestVal = v; best = key; }
    });
    state.resultKey = best;

    // 综合分：基于每个选项的 charm 值（1-10）
    var totalCharm = 0, cnt = 0;
    state.quiz.questions.forEach(function (q, qi) {
      var opt = q.options[state.answers[qi]];
      if (!opt) return;
      totalCharm += (typeof opt.charm === 'number' ? opt.charm : 8);
      cnt++;
    });
    var avg = cnt ? totalCharm / cnt : 0;
    state.charmScore = Math.max(1, Math.min(100, Math.round(avg * 10)));

    // 维度分：由类型得分按权重推导
    state.dims = computeDims(state.charmScore);

    var played = parseInt(localStorage.getItem('played_' + state.quiz.id) || '0', 10);
    localStorage.setItem('played_' + state.quiz.id, String(played + 1));

    showScreen('loading');
    setTimeout(renderResult, 1100);
  }

  function computeDims(charmScore) {
    var q = state.quiz;
    if (!q.dimensions || !q.dimensions.length) return [];
    return q.dimensions.map(function (dim) {
      var actual = 0, max = 0;
      q.questions.forEach(function (qq, qi) {
        var bestOpt = 0;
        qq.options.forEach(function (opt) {
          var v = 0;
          Object.keys(dim.weights).forEach(function (k) {
            v += (opt.scores[k] || 0) * dim.weights[k];
          });
          if (v > bestOpt) bestOpt = v;
        });
        max += bestOpt;
        var chosen = qq.options[state.answers[qi]];
        if (chosen) {
          Object.keys(dim.weights).forEach(function (k) {
            actual += (chosen.scores[k] || 0) * dim.weights[k];
          });
        }
      });
      var ratio = max > 0 ? actual / max : 0.6;
      var score = Math.round(charmScore * (0.86 + ratio * 0.3));
      score = Math.max(1, Math.min(100, score));
      return { name: dim.name, score: score, ratio: ratio };
    });
  }

  /* ---------- 结果页 ---------- */
  function renderResult() {
    var q = state.quiz;
    var r = q.results[state.resultKey];

    $('result-badge').textContent = label('resultBadge', '测试结果');
    $('result-emoji').textContent = r.emoji || '';
    $('result-name').textContent = r.name;
    $('result-tagline').textContent = r.tagline ? '「' + r.tagline + '」' : '';
    $('result-desc').textContent = r.description;

    var traitsBox = $('result-traits');
    traitsBox.innerHTML = '';
    (r.traits || []).forEach(function (t) {
      var tag = document.createElement('span');
      tag.className = 'trait-tag';
      tag.textContent = t;
      traitsBox.appendChild(tag);
    });

    var skillsBox = $('result-skills');
    skillsBox.innerHTML = '';
    if (r.skills && r.skills.length) {
      var heading = document.createElement('div');
      heading.className = 'skills-heading';
      heading.textContent = label('skillsHeading', '详细解析');
      skillsBox.appendChild(heading);
      r.skills.forEach(function (s, i) {
        var item = document.createElement('div');
        item.className = 'skill-item';
        item.innerHTML =
          '<div class="skill-icon">0' + (i + 1) + '</div>' +
          '<div><div class="skill-name">' + s.name + '</div>' +
          '<div class="skill-desc">' + s.desc + '</div></div>';
        skillsBox.appendChild(item);
      });
    }

    if (r.soulmate) {
      $('result-soulmate').innerHTML =
        label('soulmatePrefix', '最匹配') + '：<b>' + r.soulmate + '</b>';
      $('result-soulmate').hidden = false;
    } else {
      $('result-soulmate').hidden = true;
    }

    // 评分模块：只有配置了分数才展示
    var block = $('score-block');
    if (q.dimensions && q.dimensions.length) {
      block.hidden = false;
      $('score-num').textContent = state.charmScore;
      $('score-caption').textContent = label('scoreCaption', '综合评分');

      var dimsBox = $('dims');
      dimsBox.innerHTML = '';
      state.dims.forEach(function (d) {
        var row = document.createElement('div');
        row.className = 'dim-row';
        row.innerHTML =
          '<div class="dim-head"><span>' + d.name + '</span><b>' + d.score + '</b></div>' +
          '<div class="dim-track"><div class="dim-fill"></div></div>';
        dimsBox.appendChild(row);
      });
      // 下一帧再触发宽度动画
      requestAnimationFrame(function () {
        var fills = dimsBox.querySelectorAll('.dim-fill');
        state.dims.forEach(function (d, i) {
          if (fills[i]) fills[i].style.width = d.score + '%';
        });
      });
    } else {
      block.hidden = true;
    }

    showScreen('result');
    var scroll = document.querySelector('.result-scroll');
    if (scroll) scroll.scrollTop = 0;
  }

  /* ---------- Canvas 工具 ---------- */
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

  /* ---------- 分享图（极简白底） ---------- */
  function generateShareImage() {
    var q = state.quiz;
    var r = q.results[state.resultKey];
    var share = q.share || {};
    var hasScore = !!(q.dimensions && q.dimensions.length);

    var W = 750, H = 1334;
    var canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    var ctx = canvas.getContext('2d');
    var INK = '#1c1c1c';
    var SUB = '#8b8680';
    var LINE = 'rgba(28,28,28,0.09)';
    var cx = W / 2;

    // 背景
    ctx.fillStyle = '#f7f5f2';
    ctx.fillRect(0, 0, W, H);

    // 顶部标题
    ctx.textAlign = 'center';
    ctx.fillStyle = SUB;
    ctx.font = '400 22px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText(share.slogan || q.title, cx, 62);

    // 主卡：先测量描述行数，无评分时按内容自适应高度，避免空白
    var cardX = 48, cardY = 96, cardW = W - 96;
    var innerW = cardW - 124;
    ctx.font = '400 21px "PingFang SC", sans-serif';
    var maxLines = hasScore ? 2 : 6;
    var allDescLines = wrapText(ctx, r.description, innerW);
    var descLines = allDescLines.slice(0, maxLines);
    if (allDescLines.length > maxLines) {
      descLines[maxLines - 1] = descLines[maxLines - 1].slice(0, -1) + '…';
    }
    var cardH = hasScore ? 880 : (350 + (descLines.length - 1) * 36 + 60);

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.05)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 8;
    roundRect(ctx, cardX, cardY, cardW, cardH, 20);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();

    // 徽章
    ctx.fillStyle = SUB;
    ctx.font = '400 19px "PingFang SC", sans-serif';
    ctx.fillText(label('shareBadge', '我的测试结果'), cx, cardY + 62);

    // emoji
    ctx.font = '76px sans-serif';
    ctx.fillText(r.emoji || '', cx, cardY + 150);

    // 名称
    ctx.fillStyle = INK;
    ctx.font = '600 46px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText(r.name, cx, cardY + 216);

    var y = cardY + 216;

    if (hasScore) {
      // 综合分
      ctx.textAlign = 'center';
      ctx.fillStyle = INK;
      ctx.font = '200 104px "PingFang SC", "Helvetica Neue", sans-serif';
      ctx.fillText(String(state.charmScore), cx - 16, y + 130);

      // /100
      ctx.fillStyle = SUB;
      ctx.font = '400 22px "PingFang SC", sans-serif';
      var numW = ctx.measureText(String(state.charmScore)).width;
      // 用固定偏移放右侧
      ctx.fillText('/100', cx + 70, y + 108);

      ctx.fillStyle = SUB;
      ctx.font = '400 17px "PingFang SC", sans-serif';
      ctx.fillText(label('scoreCaption', '综合评分'), cx, y + 170);

      // 维度
      var dimTop = y + 210;
      var barX = cardX + 62, barW = cardW - 124;
      state.dims.forEach(function (d, i) {
        var ly = dimTop + i * 56;
        ctx.textAlign = 'left';
        ctx.fillStyle = SUB;
        ctx.font = '400 20px "PingFang SC", sans-serif';
        ctx.fillText(d.name, barX, ly);

        ctx.textAlign = 'right';
        ctx.fillStyle = INK;
        ctx.font = '500 20px "PingFang SC", sans-serif';
        ctx.fillText(String(d.score), barX + barW, ly);

        ctx.fillStyle = LINE;
        ctx.fillRect(barX, ly + 12, barW, 3);
        ctx.fillStyle = INK;
        ctx.fillRect(barX, ly + 12, Math.round(barW * d.score / 100), 3);
      });

      y = dimTop + state.dims.length * 56 - 20;
    }

    // 分隔线
    ctx.fillStyle = LINE;
    ctx.fillRect(cardX + 62, y + 34, cardW - 124, 1);
    y += 34;

    // tagline
    ctx.textAlign = 'center';
    ctx.fillStyle = INK;
    ctx.font = '400 23px "PingFang SC", sans-serif';
    ctx.fillText(r.tagline ? '「' + r.tagline + '」' : '', cx, y + 52);

    // 描述（行数与省略号已在测量阶段处理）
    ctx.fillStyle = SUB;
    ctx.font = '400 21px "PingFang SC", sans-serif';
    descLines.forEach(function (line, i) {
      ctx.fillText(line, cx, y + 100 + i * 36);
    });

    // 二维码区：有评分时贴底，无评分时紧跟卡片下方
    var qrSize = 176;
    var qrY = hasScore ? (H - 286) : (cardY + cardH + 110);
    var qrX = 62;

    ctx.save();
    roundRect(ctx, qrX - 10, qrY - 10, qrSize + 20, qrSize + 20, 12);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();

    try {
      var qrUrl = share.url || location.href.split('#')[0];
      var qr = qrcode(0, 'M');
      qr.addData(qrUrl);
      qr.make();
      var qrImg = new Image();
      qrImg.src = qr.createDataURL(6, 2);
      qrImg.onload = function () { finishDraw(qrImg); };
      qrImg.onerror = function () { finishDraw(null); };
    } catch (e) {
      finishDraw(null);
    }

    function finishDraw(qrImg) {
      if (qrImg) ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

      ctx.textAlign = 'left';
      ctx.fillStyle = INK;
      ctx.font = '500 26px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillText(share.shareAsk || '你也来测测', 288, qrY + 56);

      ctx.fillStyle = SUB;
      ctx.font = '400 20px "PingFang SC", sans-serif';
      ctx.fillText(share.cta || '长按识别二维码', 288, qrY + 104);

      ctx.fillStyle = SUB;
      ctx.font = '400 17px "PingFang SC", sans-serif';
      ctx.fillText(share.hashtags || '', 288, qrY + 146);

      ctx.textAlign = 'center';
      ctx.fillStyle = SUB;
      ctx.font = '400 16px "PingFang SC", sans-serif';
      ctx.fillText(q.title, cx, H - 42);

      var url = canvas.toDataURL('image/png');
      $('share-img').src = url;
      $('share-modal').classList.add('open');

      try {
        var a = document.createElement('a');
        a.href = url;
        a.download = label('downloadName', '测试结果') + '-' + r.name + '.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } catch (e) { /* 移动端走长按保存 */ }
    }
  }

  /* ---------- 事件 ---------- */
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
    showScreen('home');   // 数据就绪后才显示首页，避免闪到别的测试
  }

  function showError() {
    var boot = $('screen-boot');
    if (boot) {
      boot.innerHTML = '<div class="boot-inner"><p style="font-size:14px;color:#8b8680;letter-spacing:1px">加载失败，请刷新重试</p></div>';
    }
  }

  function boot() {
    // 优先读独立 JSON；file:// 下 fetch 被拦截时回退内嵌数据
    fetch('data/' + QUIZ_ID + '.json')
      .then(function (res) {
        if (!res.ok) throw new Error('quiz not found');
        return res.json();
      })
      .then(init)
      .catch(function () {
        var fallback = window.__QUIZZES__ && window.__QUIZZES__[QUIZ_ID];
        if (fallback) init(fallback);
        else showError();
      });
  }

  boot();
})();
