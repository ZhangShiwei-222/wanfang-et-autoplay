// ==UserScript==
// @name         万方科研诚信培训 - 后台自动刷课
// @name:zh-CN   万方科研诚信培训 - 后台自动刷课
// @namespace    https://cx.wanfangdata.com.cn/e-training/
// @version      1.5.0
// @description  防切页暂停 + 自动播放 + 倍速 + 静音开关 + 播完自动下一节，支持后台挂机
// @author       Boss
// @match        https://cx.wanfangdata.com.cn/e-training/*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @noframes
// @license      MIT
// ==/UserScript==

(function () {
  'use strict';

  /* ================= 配置持久化 ================= */
  const store = {
    get(key, def) {
      try {
        if (typeof GM_getValue === 'function') {
          const v = GM_getValue(key);
          return v === undefined || v === null ? def : v;
        }
      } catch (e) {}
      try {
        const v = localStorage.getItem('wf_et_' + key);
        return v === null ? def : JSON.parse(v);
      } catch (e) { return def; }
    },
    set(key, val) {
      try {
        if (typeof GM_setValue === 'function') { GM_setValue(key, val); return; }
      } catch (e) {}
      try { localStorage.setItem('wf_et_' + key, JSON.stringify(val)); } catch (e) {}
    }
  };

  const CFG = {
    enabled: store.get('enabled', true),      // 总开关
    antiPause: store.get('antiPause', true),  // 防切页
    autoPlay: store.get('autoPlay', true),    // 自动播放
    autoNext: store.get('autoNext', true),    // 自动下一节
    autoNextDelay: store.get('autoNextDelay', 2), // 播完后延时切节（秒）
    speed: store.get('speed', 1),             // 倍速
    mute: store.get('mute', false),           // 静音（默认关 = 有声）
    showPanel: store.get('showPanel', true),  // 显示悬浮面板
  };

  const save = () => {
    store.set('enabled', CFG.enabled);
    store.set('antiPause', CFG.antiPause);
    store.set('autoPlay', CFG.autoPlay);
    store.set('autoNext', CFG.autoNext);
    store.set('autoNextDelay', CFG.autoNextDelay);
    store.set('speed', CFG.speed);
    store.set('mute', CFG.mute);
    store.set('showPanel', CFG.showPanel);
  };

  const log = (...a) => console.log('%c[万方刷课]', 'color:#4DBA87;font-weight:bold', ...a);

  /* ================= 1. 防切页（仅拦截 visibilitychange 事件，最小干预） ================= */
  function installAntiPause() {
    if (!CFG.antiPause) return;
    window.addEventListener('visibilitychange', (e) => {
      if (!CFG.antiPause) return;
      e.stopImmediatePropagation();
      e.stopPropagation();
    }, true);
    log('防切页已启用');
  }

  /* ================= 2. 播放器操作 ================= */
  function findVideo() {
    return document.querySelector('video.prism-player') || document.querySelector('video');
  }

  function applySpeed(video) {
    if (!video) return;
    try {
      if (video.playbackRate !== CFG.speed) {
        video.playbackRate = CFG.speed;
        video.defaultPlaybackRate = CFG.speed;
      }
    } catch (e) {}
  }

  // 应用静音设置：mute=true 强制静音；false 恢复有声。每秒校准，对抗播放器重置。
  function applyMute(video) {
    if (!video) return;
    try { video.muted = CFG.mute; } catch (e) {}
  }

  function tryPlay(video) {
    if (!video || !CFG.autoPlay) return;
    if (!video.paused) return;
    const p = video.play();
    if (p && p.catch) {
      p.catch(() => {
        // 有声自动播放被浏览器拦截 → 临时静音起播（保证能播起来）
        // 下一秒 applyMute 会按 CFG.mute 校正：默认 false 会恢复有声
        try { video.muted = true; } catch (e) {}
        const p2 = video.play();
        if (p2 && p2.catch) p2.catch(() => {});
      });
    }
  }

  /* ================= 3. 自动下一节 ================= */
  function goNext() {
    const btn = document.querySelector('.right .next');
    if (btn) {
      btn.click();
      log('自动切换到下一节');
      return true;
    }
    const spans = [];
    document.querySelectorAll('.children-item').forEach((item) => {
      item.querySelectorAll('span').forEach((sp) => {
        if (!sp.classList.contains('num') && sp.textContent.trim()) spans.push(sp);
      });
    });
    const cur = spans.findIndex((sp) => sp.classList.contains('checked'));
    if (cur >= 0 && spans[cur + 1]) {
      spans[cur + 1].click();
      log('自动切换到下一节（课程树）');
      return true;
    }
    log('已是最后一节');
    return false;
  }

  /* ================= 4. 主循环 ================= */
  let handledVideo = null;
  let nextTimer = null;

  function handleVideo(video) {
    if (!video || handledVideo === video) return;
    handledVideo = video;

    applySpeed(video);
    applyMute(video);

    video.addEventListener('playing', () => { applySpeed(video); applyMute(video); }, true);
    video.addEventListener('canplay', () => { tryPlay(video); }, true);

    video.addEventListener('ended', () => {
      log('当前节播放结束');
      if (CFG.autoNext && CFG.enabled) {
        if (nextTimer) clearTimeout(nextTimer);
        nextTimer = setTimeout(() => {
          nextTimer = null;
          if (CFG.enabled) goNext();
        }, CFG.autoNextDelay * 1000);
      }
    });

    tryPlay(video);
    log('已接管播放器');
  }

  /* 检测播放器是否缺失（返回提示文本，不写 DOM） */
  let missCount = 0;
  function playerMissingText(video) {
    const isLearnPage = /courselearn|courselive|livelearn|\/video/.test(location.href);
    const hasBar = !!document.querySelector('.right .next, .right .last');
    if (isLearnPage && hasBar && !video) {
      missCount++;
    } else {
      missCount = 0;
      return '';
    }
    if (missCount >= 20) {
      return '⚠ 未检测到播放器。若视频一直不出现，多为阿里云播放器SDK(g.alicdn.com)加载失败（网络/代理问题，与本脚本无关）。可关闭脚本强刷对比，或 F12→Network 搜 aliplayer 看是否有失败请求。';
    }
    return '';
  }

  /* ================= 5. 面板 ================= */
  let panel = null;
  let lastWarn = '';
  let lastProg = '';

  function buildPanel() {
    if (panel) return panel;
    panel = document.createElement('div');
    panel.id = 'wf-et-panel';
    panel.innerHTML = `
      <div class="wf-et-head">
        <span class="wf-et-title">万方刷课</span>
        <button class="wf-et-fold" title="折叠">—</button>
      </div>
      <div class="wf-et-body">
        <div class="wf-et-warn" id="wf-et-warn" style="display:none"></div>
        <div class="wf-et-row"><span class="wf-et-k">总开关</span><label class="wf-et-sw"><input type="checkbox" id="wf-et-enabled"><i></i></label></div>
        <div class="wf-et-row"><span class="wf-et-k">防切页</span><label class="wf-et-sw"><input type="checkbox" id="wf-et-antiPause"><i></i></label></div>
        <div class="wf-et-row"><span class="wf-et-k">自动下一节</span><label class="wf-et-sw"><input type="checkbox" id="wf-et-autoNext"><i></i></label></div>
        <div class="wf-et-row"><span class="wf-et-k">静音</span><label class="wf-et-sw"><input type="checkbox" id="wf-et-mute"><i></i></label></div>
        <div class="wf-et-row"><span class="wf-et-k">倍速</span>
          <div class="wf-et-speeds" id="wf-et-speeds">
            ${[1, 1.25, 1.5, 2, 4, 8].map(s => `<button data-s="${s}" class="${s === CFG.speed ? 'on' : ''}">${s}x</button>`).join('')}
          </div>
        </div>
        <div class="wf-et-row"><span class="wf-et-k">进度</span><span class="wf-et-prog" id="wf-et-prog">--:-- / --:--</span></div>
        <button class="wf-et-next" id="wf-et-next">下一节 ▶</button>
        <p class="wf-et-tip">提示：系统按「真实学习时长」判定完成（约90%），1倍速后台挂机最稳。</p>
      </div>
    `;
    document.body.appendChild(panel);

    const $ = (id) => panel.querySelector('#' + id);
    const bind = (id, cfgKey, after) => {
      const el = $(id);
      if (!el) return;
      el.checked = CFG[cfgKey];
      el.onchange = (e) => { CFG[cfgKey] = e.target.checked; save(); if (after) after(); };
    };
    bind('wf-et-enabled', 'enabled');
    bind('wf-et-antiPause', 'antiPause');
    bind('wf-et-autoNext', 'autoNext');
    bind('wf-et-mute', 'mute', () => applyMute(findVideo()));

    $('wf-et-next').onclick = () => goNext();
    panel.querySelectorAll('#wf-et-speeds button').forEach((b) => {
      b.onclick = () => {
        CFG.speed = parseFloat(b.dataset.s); save();
        panel.querySelectorAll('#wf-et-speeds button').forEach(x => x.classList.remove('on'));
        b.classList.add('on');
        applySpeed(findVideo());
      };
    });

    let folded = false;
    panel.querySelector('.wf-et-fold').onclick = () => {
      folded = !folded;
      panel.querySelector('.wf-et-body').style.display = folded ? 'none' : '';
      panel.querySelector('.wf-et-fold').textContent = folded ? '+' : '—';
    };

    makeDraggable(panel, panel.querySelector('.wf-et-head'));
    return panel;
  }

  function makeDraggable(el, handle) {
    let sx, sy, ox, oy, dragging = false;
    handle.style.cursor = 'move';
    handle.addEventListener('mousedown', (e) => {
      dragging = true;
      sx = e.clientX; sy = e.clientY;
      const r = el.getBoundingClientRect();
      ox = r.left; oy = r.top;
      e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      el.style.left = (ox + e.clientX - sx) + 'px';
      el.style.top = (oy + e.clientY - sy) + 'px';
      el.style.right = 'auto';
    });
    document.addEventListener('mouseup', () => { dragging = false; });
  }

  function fmt(t) {
    if (!t || !isFinite(t)) return '--:--';
    const m = Math.floor(t / 60), s = Math.floor(t % 60);
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  // 面板 DOM 更新（幂等：内容不变则不写）
  function refreshPanel(video, warnText) {
    if (!panel) return;
    if (warnText !== lastWarn) {
      lastWarn = warnText;
      const w = panel.querySelector('#wf-et-warn');
      if (w) {
        w.textContent = warnText;
        w.style.display = warnText ? 'block' : 'none';
      }
    }
    const progText = video ? (fmt(video.currentTime) + ' / ' + fmt(video.duration)) : '--:-- / --:--';
    if (progText !== lastProg) {
      lastProg = progText;
      const prog = panel.querySelector('#wf-et-prog');
      if (prog) prog.textContent = progText;
    }
  }

  /* ================= 诊断 ================= */
  function diagnose() {
    const v = document.querySelector('video');
    const containers = [...document.querySelectorAll('[id^="inPlayer"]')].map(el => el.id);
    console.log('%c[万方刷课·诊断]', 'color:#e67e22;font-weight:bold', {
      video元素: v ? { readyState: v.readyState, paused: v.paused, muted: v.muted, currentTime: v.currentTime, duration: v.duration, src: (v.currentSrc || '').slice(0, 100) } : '不存在',
      播放器容器: containers.length ? containers : '不存在',
      hidden: document.hidden,
      visibilityState: document.visibilityState,
      页面URL: location.href,
    });
    log('诊断信息已输出，可截图反馈');
  }

  /* ================= 样式 ================= */
  const CSS = `
    #wf-et-panel{position:fixed;right:16px;bottom:16px;z-index:2147483647;width:250px;background:#1e293b;color:#e2e8f0;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.35);font:12px/1.5 -apple-system,"PingFang SC","Microsoft YaHei",sans-serif;overflow:hidden}
    #wf-et-panel .wf-et-head{display:flex;align-items:center;justify-content:space-between;padding:9px 12px;background:#0f172a;user-select:none}
    #wf-et-panel .wf-et-title{font-weight:700;color:#4DBA87}
    #wf-et-panel .wf-et-fold{background:none;border:none;color:#94a3b8;font-size:14px;cursor:pointer;line-height:1}
    #wf-et-panel .wf-et-body{padding:10px 12px}
    #wf-et-panel .wf-et-warn{display:none;margin:0 0 8px;padding:7px 9px;background:#7c2d12;color:#fed7aa;border-radius:7px;font-size:11px;line-height:1.5}
    #wf-et-panel .wf-et-row{display:flex;align-items:center;justify-content:space-between;margin:7px 0}
    #wf-et-panel .wf-et-k{color:#94a3b8}
    #wf-et-panel .wf-et-sw input{display:none}
    #wf-et-panel .wf-et-sw i{display:inline-block;width:32px;height:18px;background:#475569;border-radius:9px;position:relative;transition:.2s;cursor:pointer}
    #wf-et-panel .wf-et-sw i::after{content:"";position:absolute;left:2px;top:2px;width:14px;height:14px;background:#fff;border-radius:50%;transition:.2s}
    #wf-et-panel .wf-et-sw input:checked+i{background:#4DBA87}
    #wf-et-panel .wf-et-sw input:checked+i::after{left:16px}
    #wf-et-panel .wf-et-speeds{display:flex;flex-wrap:wrap;gap:4px;max-width:160px}
    #wf-et-panel .wf-et-speeds button{background:#334155;color:#cbd5e1;border:none;border-radius:5px;padding:2px 8px;font-size:11px;cursor:pointer}
    #wf-et-panel .wf-et-speeds button.on{background:#4DBA87;color:#fff}
    #wf-et-panel .wf-et-next{width:100%;margin-top:6px;padding:7px 0;background:#4DBA87;color:#fff;border:none;border-radius:7px;cursor:pointer;font-weight:700}
    #wf-et-panel .wf-et-next:hover{background:#3fae76}
    #wf-et-panel .wf-et-prog{color:#e2e8f0;font-variant-numeric:tabular-nums}
    #wf-et-panel .wf-et-tip{margin:8px 0 0;color:#64748b;font-size:11px;line-height:1.5}
  `;

  /* ================= 启动 ================= */
  function boot() {
    installAntiPause();

    const applyStyle = () => {
      if (typeof GM_addStyle === 'function') { try { GM_addStyle(CSS); return; } catch (e) {} }
      const st = document.createElement('style');
      st.textContent = CSS;
      (document.head || document.documentElement).appendChild(st);
    };
    applyStyle();

    const onReady = () => {
      if (CFG.showPanel && document.body) buildPanel();

      // 唯一主循环：低频轮询，纯只读 + 幂等写面板，杜绝自触发循环
      const tick = () => {
        if (!CFG.enabled) return;
        const v = findVideo();
        if (v) {
          if (handledVideo !== v) handleVideo(v);
          applySpeed(v);
          applyMute(v);
        } else {
          handledVideo = null;
        }
        refreshPanel(v, playerMissingText(v));
      };
      setInterval(tick, 1000);
      log('v1.5.0 已启动');
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', onReady, { once: true });
    } else {
      onReady();
    }
  }

  /* 菜单命令 */
  try {
    if (typeof GM_registerMenuCommand === 'function') {
      GM_registerMenuCommand('万方刷课：开关总开关', () => { CFG.enabled = !CFG.enabled; save(); log('总开关:', CFG.enabled); });
      GM_registerMenuCommand('万方刷课：手动下一节', () => goNext());
      GM_registerMenuCommand('万方刷课：诊断（输出到控制台）', () => diagnose());
    }
  } catch (e) {}

  boot();
})();
