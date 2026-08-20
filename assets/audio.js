/* 背景音樂與音量設定（八頁共用，放在 common.js 之後載入）
   - 音樂：Juhani Junkala「Retro Game Music Pack」，CC0（公有領域，不用標示）
   - 點擊音：Kenney UI Audio，CC0
   - 設定存 mul99_audio，換頁、關掉重開都記得
   瀏覽器規定「使用者還沒動作前不准自動播放」，所以第一次點畫面才會真的出聲。 */
(function(){
  const KEY = 'mul99_audio';
  const DEF = {bgm:true, bgmVol:0.32, sfx:true, sfxVol:0.85};
  let cfg = Object.assign({}, DEF);
  try{ cfg = Object.assign({}, DEF, JSON.parse(localStorage.getItem(KEY)) || {}); }catch(e){}

  /* 讓 common.js 那些現場合成的音效吃得到音量設定 */
  window.__audio = {
    get sfx(){ return cfg.sfx ? cfg.sfxVol : 0; },
    get bgm(){ return cfg.bgm ? cfg.bgmVol : 0; },
    /* 音樂是用 new Audio() 建的、不在 DOM 裡，留一個查狀態的出口方便驗證與除錯 */
    state(){
      if(!bgmEl) return null;
      return {src:(bgmEl.currentSrc || bgmEl.src).split('/').pop(), paused:bgmEl.paused,
              t:+bgmEl.currentTime.toFixed(2), vol:+bgmEl.volume.toFixed(2), loop:bgmEl.loop};
    }
  };
  const save = () => { try{ localStorage.setItem(KEY, JSON.stringify(cfg)); }catch(e){} };

  /* ---------- 背景音樂 ---------- */
  const track = /battle\.html/.test(location.pathname) ? 'assets/bgm_battle.ogg' : 'assets/bgm_main.ogg';
  let bgmEl = null;
  function bgm(){
    if(!bgmEl){
      bgmEl = new Audio();
      bgmEl.src = track;          // 到這一刻才開始下載，一進站不會先吞掉音樂檔
      bgmEl.loop = true;
      bgmEl.preload = 'none';
      bgmEl.volume = cfg.bgmVol;
    }
    return bgmEl;
  }
  function playBgm(){
    if(!cfg.bgm) return;
    const a = bgm();
    a.volume = cfg.bgmVol;
    const p = a.play();
    if(p && p.catch) p.catch(()=>{});   // 還沒互動過會被擋，等下一次點擊再試
  }
  function stopBgm(){ if(bgmEl){ bgmEl.pause(); } }

  /* ---------- 短音效 ---------- */
  const CLIPS = {click:'assets/sfx_click.ogg', pop:'assets/sfx_pop.ogg', sw:'assets/sfx_switch.ogg'};
  const pool = {};
  function clip(name){
    if(!cfg.sfx) return;
    let a = pool[name];
    if(!a){ a = pool[name] = new Audio(CLIPS[name]); }
    try{
      const one = a.cloneNode();      // 連點也不會互相打斷
      one.volume = cfg.sfxVol * .6;
      one.play().catch(()=>{});
    }catch(e){}
  }
  window.Sfx2 = {
    click: () => clip('click'),
    pop:   () => clip('pop'),
    sw:    () => clip('sw')
  };
  /* 按鈕、難度、遊戲卡按下去都有回饋音，各頁不用自己接 */
  document.addEventListener('pointerdown', e => {
    const t = e.target.closest('button,.btn,.lv,.game,.hcard,.vers a,.plat,.cd');
    if(!t) return;
    if(t.id === 'audioBtn' || t.closest('#audioPanel')) return;
    (t.classList.contains('lv') || t.classList.contains('vers')) ? clip('sw') : clip('click');
  }, {passive:true});

  /* 第一次互動就把音樂開起來 */
  function kick(){
    playBgm();
    if(bgmEl && !bgmEl.paused){
      document.removeEventListener('pointerdown', kick);
      document.removeEventListener('keydown', kick);
    }
  }
  document.addEventListener('pointerdown', kick, {passive:true});
  document.addEventListener('keydown', kick);
  /* 切到別的分頁就先停，回來再繼續 */
  document.addEventListener('visibilitychange', () => {
    if(document.hidden) stopBgm();
    else if(cfg.bgm) playBgm();
  });

  /* ---------- 設定面板 ---------- */
  function build(){
    const css = document.createElement('style');
    css.textContent =
      '.audiobtn{position:fixed;right:10px;bottom:62px;z-index:60;width:44px;height:44px;border-radius:50%;' +
      'border:1px solid #573a7d;background:#241638e6;color:#ffe9a8;font-size:19px;line-height:1;cursor:pointer;' +
      'backdrop-filter:blur(6px);box-shadow:0 6px 18px #0009;opacity:.62;transition:opacity .2s,transform .15s}' +
      '.audiobtn:hover{opacity:1}.audiobtn:active{transform:scale(.92)}' +
      '#audioPanel{position:fixed;right:10px;bottom:112px;z-index:61;width:min(224px,calc(100vw - 20px));' +
      'box-sizing:border-box;padding:14px;border-radius:16px;' +
      'background:#1d1230f2;border:1px solid #573a7d;box-shadow:0 14px 36px #000b;backdrop-filter:blur(8px);' +
      'display:none;color:#f6efff;font-family:inherit}' +
      '#audioPanel.on{display:block;animation:apIn .22s cubic-bezier(.2,1.5,.4,1)}' +
      '@keyframes apIn{from{opacity:0;transform:translateY(8px) scale(.96)}}' +
      '#audioPanel h4{font-size:12px;color:#f6c453;letter-spacing:2px;margin-bottom:10px;font-weight:800}' +
      '.arow{display:flex;align-items:center;gap:8px;margin-bottom:10px}' +
      '.arow:last-of-type{margin-bottom:0}' +
      '.arow label{font-size:12px;font-weight:700;flex:none;width:52px}' +
      '.arow input[type=range]{flex:1;min-width:0;accent-color:#f6c453;height:22px;margin:0}' +
      '.atog{flex:none;width:40px;height:26px;border-radius:99px;border:1px solid #573a7d;background:#2a1a40;' +
      'position:relative;cursor:pointer;transition:background .2s}' +
      '.atog i{position:absolute;top:2px;left:2px;width:20px;height:20px;border-radius:50%;background:#a894c4;' +
      'transition:transform .2s,background .2s}' +
      '.atog.on{background:linear-gradient(180deg,#ffe9a8,#f6c453)}' +
      '.atog.on i{transform:translateX(14px);background:#3a2400}' +
      '#audioPanel .src{font-size:10px;color:#a894c4;line-height:1.6;margin-top:10px;' +
      'border-top:1px solid #ffffff1a;padding-top:8px}';
    document.head.appendChild(css);

    const btn = document.createElement('button');
    btn.className = 'audiobtn';
    btn.id = 'audioBtn';
    btn.type = 'button';
    btn.title = btn.ariaLabel = '聲音設定';

    const panel = document.createElement('div');
    panel.id = 'audioPanel';
    panel.innerHTML =
      '<h4>聲音</h4>' +
      '<div class="arow"><label>音樂</label>' +
        '<div class="atog" id="tgBgm"><i></i></div>' +
        '<input type="range" id="volBgm" min="0" max="100"></div>' +
      '<div class="arow"><label>音效</label>' +
        '<div class="atog" id="tgSfx"><i></i></div>' +
        '<input type="range" id="volSfx" min="0" max="100"></div>' +
      '<div class="src">音樂 Juhani Junkala、音效 Kenney，都是 CC0 公有領域</div>';

    document.body.append(btn, panel);

    const tgBgm = panel.querySelector('#tgBgm'), tgSfx = panel.querySelector('#tgSfx');
    const volBgm = panel.querySelector('#volBgm'), volSfx = panel.querySelector('#volSfx');

    function paint(){
      btn.textContent = (cfg.bgm || cfg.sfx) ? '🔊' : '🔇';
      tgBgm.classList.toggle('on', cfg.bgm);
      tgSfx.classList.toggle('on', cfg.sfx);
      volBgm.value = Math.round(cfg.bgmVol * 100);
      volSfx.value = Math.round(cfg.sfxVol * 100);
      volBgm.disabled = !cfg.bgm;
      volSfx.disabled = !cfg.sfx;
    }
    btn.onclick = () => { panel.classList.toggle('on'); };
    document.addEventListener('pointerdown', e => {
      if(!panel.classList.contains('on')) return;
      if(e.target.closest('#audioPanel') || e.target.closest('#audioBtn')) return;
      panel.classList.remove('on');
    }, {passive:true});

    tgBgm.onclick = () => {
      cfg.bgm = !cfg.bgm; save(); paint();
      cfg.bgm ? playBgm() : stopBgm();
    };
    tgSfx.onclick = () => { cfg.sfx = !cfg.sfx; save(); paint(); if(cfg.sfx) clip('click'); };
    volBgm.oninput = () => { cfg.bgmVol = volBgm.value/100; if(bgmEl) bgmEl.volume = cfg.bgmVol; };
    volBgm.onchange = () => { save(); playBgm(); };
    volSfx.oninput = () => { cfg.sfxVol = volSfx.value/100; };
    volSfx.onchange = () => { save(); clip('click'); };

    paint();
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
