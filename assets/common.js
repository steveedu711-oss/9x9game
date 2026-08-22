/* 小虎乘法大冒險 共用程式：角色演出、音效、背景金幣、答題紀錄、飄分粒子
   三個玩法版本共用同一份，改這裡三版一起改 */

const $ = id => document.getElementById(id);

/* ---------- 答題紀錄（存這台電腦） ---------- */
const STORE_KEY = 'mul99_stats';
const Stats = {
  data: (() => { try{ return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }catch(e){ return {}; } })(),
  mark(key, ok){
    const s = this.data[key] || (this.data[key] = {ok:0, bad:0});
    ok ? s.ok++ : s.bad++;
    try{ localStorage.setItem(STORE_KEY, JSON.stringify(this.data)); }catch(e){}
  },
  weak(n){
    return Object.entries(this.data).filter(([,v]) => v.bad > 0)
      .sort((a,b) => b[1].bad - a[1].bad).slice(0, n || 6);
  },
  weakHTML(n){
    const w = this.weak(n);
    return w.length ? w.map(([k,v]) => '<li>' + k + ' <i>錯 ' + v.bad + '</i></li>').join('')
                    : '<li>目前沒有答錯紀錄，很厲害</li>';
  }
};
/* 最佳成績（每個版本各自一筆） */
const Best = {
  get(k){ try{ return +localStorage.getItem('mul99_best_' + k) || 0; }catch(e){ return 0; } },
  set(k, v){ try{ if(v > this.get(k)) localStorage.setItem('mul99_best_' + k, v); }catch(e){} }
};

/* ---------- 存檔：關掉瀏覽器再打開也接得回來 ---------- */
const SAVE_KEY = 'mul99_save';
const DEFAULT_SAVE = {
  lv:1, exp:0, gold:0, hero:'tiger',
  gear:{weapon:null, armor:null, charm:null},
  bag:[],
  round:1, wave:0,
  totalKill:0, playCount:0, lastPlay:''
};
const Save = {
  d: (() => {
    try{ return Object.assign({}, DEFAULT_SAVE, JSON.parse(localStorage.getItem(SAVE_KEY)) || {}); }
    catch(e){ return Object.assign({}, DEFAULT_SAVE); }
  })(),
  put(){
    this.d.lastPlay = new Date().toISOString().slice(0,10);
    try{ localStorage.setItem(SAVE_KEY, JSON.stringify(this.d)); }catch(e){}
  },
  reset(){
    this.d = Object.assign({}, DEFAULT_SAVE, {gear:{weapon:null,armor:null,charm:null}, bag:[]});
    this.put();
  },
  needExp(){ return 40 + this.d.lv * 35; },
  /* 基礎能力＋裝備加成 */
  power(){
    const g = this.d.gear, h = heroOf(this.d.hero);
    let atk = 8 + (this.d.lv-1)*2 + h.atk;
    let hp  = 100 + (this.d.lv-1)*12 + h.hp;
    let crit = 5 + h.crit, ult = 11 + h.ult;
    for(const k of ['weapon','armor','charm']){
      const it = g[k]; if(!it) continue;
      atk += it.atk||0; hp += it.hp||0; crit += it.crit||0; ult += it.ult||0;
    }
    return {atk, hp: Math.max(40, hp), crit, ult, spell: h.spell, hero: h};
  },
  addExp(n){
    this.d.exp += n;
    let ups = 0;
    while(this.d.exp >= this.needExp()){ this.d.exp -= this.needExp(); this.d.lv++; ups++; }
    this.put();
    return ups;
  }
};

/* ---------- 可選角色 ----------
   小虎姬有四格分解動作；其他三個是單張圖，攻擊動作用變形做 */
const HEROES = [
  {key:'tiger',  name:'小虎姬',   icon:'🐯', img:'assets/fx_hero_ready.webp', frames:true,
   desc:'什麼都會一點', atk:2,  hp:0,   crit:0,  ult:0, spell:1},
  {key:'mage',   name:'星星法師', icon:'🔮', img:'assets/char_mage.webp',
   desc:'魔法特別強',   atk:-1, hp:-10, crit:0,  ult:3, spell:1.45},
  {key:'knight', name:'勇氣騎士', icon:'🛡️', img:'assets/char_knight.webp',
   desc:'很耐打',       atk:-1, hp:32,  crit:0,  ult:0, spell:1},
  {key:'archer', name:'神射手',   icon:'🏹', img:'assets/char_archer.webp',
   desc:'常常爆擊',     atk:0,  hp:-6,  crit:12, ult:2, spell:1},
  {key:'berserk', name:'狂戰小虎', icon:'⚔️', img:'assets/char_berserk.webp',
   desc:'打得重但脆',   atk:6,  hp:-24, crit:6,  ult:4, spell:0.85},
  {key:'sage',    name:'魔導小虎', icon:'✨', img:'assets/char_sage.webp',
   desc:'魔法連發',     atk:-3, hp:-4,  crit:0,  ult:7, spell:1.7}
];
const heroOf = k => HEROES.find(h => h.key === k) || HEROES[0];

/* ---------- 裝備 ---------- */
const RARITY = [
  {k:'普通', c:'#cbd5e1', mul:1.0,  w:52},
  {k:'精良', c:'#6ea8ff', mul:1.45, w:28},
  {k:'稀有', c:'#c084fc', mul:2.0,  w:14},
  {k:'傳說', c:'#f6c453', mul:2.9,  w:6}
];
const GEAR_KINDS = [
  {slot:'weapon', icon:'🗡️', names:['虎牙法杖','烈焰長杖','碎星錘','風之短刃','雷紋權杖'], main:'atk'},
  {slot:'armor',  icon:'🛡️', names:['虎紋護甲','石心胸鎧','花繡披風','鱗光戰袍','守心軟甲'], main:'hp'},
  {slot:'charm',  icon:'📿', names:['幸運鈴鐺','貓瞳墜飾','金幣護符','疾風羽飾','虎魂符'],  main:'crit'}
];
function rollRarity(bonus){
  const list = RARITY.map(r => ({...r, w: r.w * (r.mul > 1.3 ? (1 + (bonus||0)) : 1)}));
  const tw = list.reduce((a,r)=>a+r.w,0);
  let x = Math.random()*tw;
  for(const r of list){ x -= r.w; if(x<=0) return r; }
  return RARITY[0];
}
function rollGear(level, bonus){
  const kind = GEAR_KINDS[(Math.random()*GEAR_KINDS.length)|0];
  const r = rollRarity(bonus);
  const base = 1 + level*0.6;
  const it = {
    id: Date.now() + '_' + ((Math.random()*1e6)|0),
    slot: kind.slot, icon: kind.icon,
    name: kind.names[(Math.random()*kind.names.length)|0],
    rarity: r.k, color: r.c,
    atk:0, hp:0, crit:0, ult:0
  };
  if(kind.main === 'atk') it.atk = Math.max(1, Math.round(base*2.2*r.mul));
  if(kind.main === 'hp')  it.hp  = Math.max(3, Math.round(base*9*r.mul));
  if(kind.main === 'crit'){ it.crit = Math.max(1, Math.round(base*1.6*r.mul)); }
  // 稀有度高的多帶一條副屬性
  if(r.mul >= 1.45){
    const sub = ['atk','hp','ult'][(Math.random()*3)|0];
    if(sub === 'atk') it.atk += Math.max(1, Math.round(base*0.9*r.mul));
    if(sub === 'hp')  it.hp  += Math.max(2, Math.round(base*4*r.mul));
    if(sub === 'ult') it.ult += Math.max(1, Math.round(base*1.2*r.mul));
  }
  it.score = it.atk*3 + it.hp*0.6 + it.crit*2 + it.ult*1.5;
  return it;
}
function gearLine(it){
  const bits = [];
  if(it.atk) bits.push('攻擊 +' + it.atk);
  if(it.hp)  bits.push('血量 +' + it.hp);
  if(it.crit)bits.push('爆擊 +' + it.crit + '%');
  if(it.ult) bits.push('必殺充能 +' + it.ult);
  return bits.join('　');
}

/* ---------- 音效（WebAudio 現場合成，不用外部檔案） ---------- */
let _ac = null;
/* 音量設定由 assets/audio.js 提供（沒載入時就當作全開） */
function sfxGain(){ const a = window.__audio; return a ? a.sfx : 1; }
function beep(freq, dur, type, gain){
  try{
    _ac = _ac || new (window.AudioContext || window.webkitAudioContext)();
    const o = _ac.createOscillator(), g = _ac.createGain();
    o.type = type || 'triangle'; o.frequency.value = freq;
    const gv = (gain || .12) * sfxGain();
    if(gv <= 0) return;
    g.gain.setValueAtTime(gv, _ac.currentTime);
    g.gain.exponentialRampToValueAtTime(.0001, _ac.currentTime + dur);
    o.connect(g); g.connect(_ac.destination);
    o.start(); o.stop(_ac.currentTime + dur);
  }catch(e){}
}
const Sfx = {
  ok:   n => beep(520 + Math.min(n||0,8)*70, .18, 'triangle', .10),
  bad:  () => { beep(180,.22,'sawtooth',.09); setTimeout(()=>beep(120,.22,'sawtooth',.07), 70); },
  next: () => { beep(660,.12,'sine',.09); setTimeout(()=>beep(880,.16,'sine',.09), 110); },
  win:  () => { [523,659,784,1046].forEach((f,i)=>setTimeout(()=>beep(f,.22,'sine',.09), i*110)); },
  lose: () => { beep(392,.2,'sine',.09); setTimeout(()=>beep(294,.32,'sine',.09), 190); },
  tick: () => beep(300,.05,'square',.05),
  /* 打擊音：低頻悶響＋高頻碎裂，兩層疊起來才有份量 */
  hit: (crit) => {
    try{
      _ac = _ac || new (window.AudioContext || window.webkitAudioContext)();
      const t = _ac.currentTime;
      // 低頻：頻率快速下滑，像重擊
      const o = _ac.createOscillator(), g = _ac.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(crit ? 220 : 160, t);
      o.frequency.exponentialRampToValueAtTime(40, t + .18);
      const gv = (crit ? .3 : .22) * sfxGain();
      if(gv <= 0) return;
      g.gain.setValueAtTime(gv, t);
      g.gain.exponentialRampToValueAtTime(.0001, t + .2);
      o.connect(g); g.connect(_ac.destination); o.start(t); o.stop(t + .22);
      // 高頻：白噪音短爆，做碎裂感
      const len = Math.floor(_ac.sampleRate * .09);
      const buf = _ac.createBuffer(1, len, _ac.sampleRate);
      const data = buf.getChannelData(0);
      for(let i=0;i<len;i++) data[i] = (Math.random()*2-1) * Math.pow(1 - i/len, 2.5);
      const n = _ac.createBufferSource(); n.buffer = buf;
      const ng = _ac.createGain(); ng.gain.value = (crit ? .22 : .14) * sfxGain();
      const hp = _ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1400;
      n.connect(hp); hp.connect(ng); ng.connect(_ac.destination); n.start(t);
    }catch(e){}
  },
  hurt: () => {
    try{
      _ac = _ac || new (window.AudioContext || window.webkitAudioContext)();
      const t = _ac.currentTime;
      const o = _ac.createOscillator(), g = _ac.createGain();
      o.type = 'square';
      o.frequency.setValueAtTime(300, t);
      o.frequency.exponentialRampToValueAtTime(70, t + .25);
      const gv = .16 * sfxGain();
      if(gv <= 0) return;
      g.gain.setValueAtTime(gv, t);
      g.gain.exponentialRampToValueAtTime(.0001, t + .28);
      o.connect(g); g.connect(_ac.destination); o.start(t); o.stop(t + .3);
    }catch(e){}
  }
};

/* ---------- 角色演出 ---------- */
const CHEER = ['答對了！','好快！','就是這個！','再來一題！','厲害～','保持下去！'];
const OOPS  = ['再看清楚一點','沒關係，再試一次','慢慢來就好'];
const HERO_IMG = {idle:'assets/princess.webp', cheer:'assets/hero_cheer.webp', oops:'assets/hero_oops.webp'};
const CAT_IMG  = {jump:'assets/cat_jump.webp', wink:'assets/cat_wink.webp'};
const _have = {};
for(const src of [...Object.values(HERO_IMG), ...Object.values(CAT_IMG)]){
  const im = new Image();
  im.onload = () => { _have[src] = true; };
  im.src = src;
}
let _heroTimer = null, _catTimer = null;
const Char = {
  setHero(kind){
    const el = $('hero'); if(!el) return;
    const src = HERO_IMG[kind];
    if(_have[src]) el.src = src;
    clearTimeout(_heroTimer);
    if(kind !== 'idle') _heroTimer = setTimeout(()=>this.setHero('idle'), 1400);
  },
  say(text){
    const el = $('say'); if(!el) return;
    el.textContent = text;
    el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
    clearTimeout(el._t);
    el._t = setTimeout(()=>el.classList.remove('on'), 1600);
  },
  react(ok, big, text){
    const h = $('hero');
    if(h){
      h.classList.remove('react','shake','glow'); void h.offsetWidth;
      h.classList.add(ok ? 'react' : 'shake');
      if(ok && big) h.classList.add('glow');
      setTimeout(()=>h.classList.remove('glow'), 1400);
    }
    if(ok && big){ this.setHero('cheer'); this.say(text || CHEER[(Math.random()*CHEER.length)|0]); }
    if(!ok){ this.setHero('oops'); this.say(text || OOPS[(Math.random()*OOPS.length)|0]); }
  },
  cat(big){
    const c = $('cat'); if(!c) return;
    const src = big ? CAT_IMG.wink : CAT_IMG.jump;
    if(_have[src]) c.src = src; else if(!_have[CAT_IMG.jump]) return;
    c.classList.add('on');
    if(big){ c.classList.remove('big'); void c.offsetWidth; c.classList.add('big'); }
    clearTimeout(_catTimer);
    _catTimer = setTimeout(()=>c.classList.remove('on','big'), big ? 1500 : 900);
  }
};

/* ---------- 特效 ---------- */
function floatText(host, rect, text, color){
  const f = document.createElement('div');
  f.className = 'float'; f.textContent = text;
  if(color) f.style.color = color;
  const hr = host.getBoundingClientRect();
  f.style.left = (rect.left - hr.left + rect.width/2 - 16) + 'px';
  f.style.top  = (rect.top - hr.top) + 'px';
  host.appendChild(f);
  setTimeout(()=>f.remove(), 900);
}
function sparks(host, rect, n, color){
  const hr = host.getBoundingClientRect();
  for(let i=0;i<(n||12);i++){
    const s = document.createElement('div');
    s.className = 'spark';
    const ang = Math.random()*Math.PI*2, dist = 26 + Math.random()*46;
    s.style.setProperty('--dx', Math.cos(ang)*dist + 'px');
    s.style.setProperty('--dy', Math.sin(ang)*dist + 'px');
    s.style.background = color || '#ffe9a8';
    s.style.left = (rect.left - hr.left + rect.width/2) + 'px';
    s.style.top  = (rect.top - hr.top + rect.height/2) + 'px';
    host.appendChild(s);
    setTimeout(()=>s.remove(), 700);
  }
}
function rollTo(el, from, to, ms){
  const t0 = performance.now();
  (function step(now){
    const k = Math.min(1, (now - t0) / (ms || 400));
    el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1-k, 3)));
    if(k < 1) requestAnimationFrame(step);
  })(t0);
}
/* 背景金幣 */
function startCoins(){
  setInterval(()=>{
    if(document.querySelectorAll('.coin').length > 14) return;
    const c = document.createElement('div');
    c.className = 'coin';
    c.style.left = (Math.random()*100) + 'vw';
    const dur = 5 + Math.random()*5;
    c.style.animationDuration = dur + 's';
    c.style.width = c.style.height = (12 + Math.random()*16) + 'px';
    document.body.appendChild(c);
    setTimeout(()=>c.remove(), dur*1000 + 200);
  }, 650);
}
/* 版本切換列 */
const VERSIONS = [
  {f:'index.html',  n:'🏠 大廳'},
  {f:'battle.html', n:'⚔️ 打怪'},
  {f:'gems.html', n:'💎 消消樂'},
  {f:'findnum.html', n:'🔢 找答案'},
  {f:'racing.html', n:'🏎️ 賽車'},
  {f:'memory.html', n:'🃏 翻牌'},
  {f:'cloudjump.html', n:'☁️ 跳跳'},
  {f:'bubble.html', n:'🐠 泡泡'}
];
function versionBar(current){
  const el = document.querySelector('.vers');
  if(!el) return;
  el.innerHTML = VERSIONS.map(v =>
    '<a href="' + v.f + '"' + (v.f === current ? ' class="on"' : '') + '>' + v.n + '</a>').join('');
}

/* ---------- 兩種模式（2026-08-22 Steve：大人玩不想在那邊答題） ----------
   practice＝練習模式（原本的，會出乘法題、答題紀錄進統計）
   arcade  ＝純玩模式（不出題，改成純操作，不寫入答題統計）
   選擇存在 localStorage，八頁共用，換頁也記得。 */
const MODE_KEY = 'mul99_mode';
const Mode = {
  get(){ try{ return localStorage.getItem(MODE_KEY) === 'arcade' ? 'arcade' : 'practice'; }catch(e){ return 'practice'; } },
  set(m){ try{ localStorage.setItem(MODE_KEY, m); }catch(e){} },
  isArcade(){ return this.get() === 'arcade'; },
  /* 在指定容器畫出「練習模式／純玩模式」切換；onChange 回傳新模式 */
  bar(el, onChange){
    if(!el) return;
    el.className = 'modebar';
    el.innerHTML =
      '<button data-m="practice"><b>練習模式</b><small>會出算術題</small></button>' +
      '<button data-m="arcade"><b>純玩模式</b><small>不出題，純操作</small></button>';
    const paint = () => [...el.children].forEach(b =>
      b.classList.toggle('on', b.dataset.m === Mode.get()));
    el.onclick = (e) => {
      const b = e.target.closest('button'); if(!b) return;
      Mode.set(b.dataset.m); paint();
      onChange && onChange(Mode.get());
    };
    paint();
  }
};

/* ---------- 題型（2026-08-22 Steve：不要只有九九乘法，低年級要 20 以內加減） ----------
   八頁共用同一份出題器，換頁也記得選過的題型。
   Stats 的 key 直接用算式（「7＋8」「12－5」「5×3」），三種題型的統計自然分開。 */
const TOPIC_KEY = 'mul99_topic';
const TOPICS = {
  mul:    {n:'九九乘法', d:'2×2 到 9×9'},
  add:    {n:'加法',     d:'20 以內'},
  sub:    {n:'減法',     d:'20 以內，不會出負數'},
  addsub: {n:'加減混合', d:'20 以內'},
  all:    {n:'全部混合', d:'加減乘一起來'}
};
const Topic = {
  get(){ try{ const t = localStorage.getItem(TOPIC_KEY); return TOPICS[t] ? t : 'mul'; }catch(e){ return 'mul'; } },
  set(t){ try{ localStorage.setItem(TOPIC_KEY, t); }catch(e){} },
  name(){ return TOPICS[this.get()].n; },
  isMul(){ return this.get() === 'mul'; },
  /* 畫出題型選單；onChange 回傳新題型 */
  bar(el, onChange){
    if(!el) return;
    el.className = 'topicbar';
    el.innerHTML = Object.keys(TOPICS).map(k =>
      '<button data-t="' + k + '">' + TOPICS[k].n + '<b>' + TOPICS[k].d + '</b></button>').join('');
    const paint = () => [...el.children].forEach(b => b.classList.toggle('on', b.dataset.t === Topic.get()));
    el.onclick = (e) => {
      const b = e.target.closest('button'); if(!b) return;
      Topic.set(b.dataset.t); paint(); onChange && onChange(Topic.get());
    };
    paint();
  }
};
/* 出一題。weak＝這隻怪害怕的乘法表（只有乘法題用得到，別的題型忽略）
   回傳 {a, b, op, ans, text, key, weak}；text 已經是可以直接放進畫面的字串 */
function makeQ(weak){
  let t = Topic.get();
  if(t === 'addsub') t = Math.random() < .5 ? 'add' : 'sub';
  if(t === 'all')    t = ['add','sub','mul'][(Math.random()*3)|0];
  let a, b, op, ans;
  if(t === 'add'){
    a = 1 + (Math.random()*15|0);
    b = 1 + (Math.random()*(20 - a)|0);
    op = '＋'; ans = a + b;
  }else if(t === 'sub'){
    a = 3 + (Math.random()*18|0);          // 被減數 3～20
    b = 1 + (Math.random()*(a - 1)|0);     // 減數比它小，答案不會是負的
    op = '－'; ans = a - b;
  }else{
    const w = weak && weak.length ? weak : null;
    a = (w && Math.random() < .7) ? w[(Math.random()*w.length)|0] : 2 + (Math.random()*8|0);
    b = 2 + (Math.random()*8|0);
    op = '×'; ans = a * b;
  }
  const isWeak = !!(op === '×' && weak && (weak.includes(a) || weak.includes(b)));
  return {a, b, op, ans, text: a + ' ' + op + ' ' + b, key: a + op + b, weak:isWeak, kind:t};
}
/* 幫一題湊出 n 個選項（含正解），數字都不重複也不會是負的 */
function makeOptions(q, n){
  n = n || 4;
  const cand = new Set([q.ans]);
  const near = q.op === '×'
    ? [q.a*(q.b+1), q.a*(q.b-1), (q.a+1)*q.b, (q.a-1)*q.b, q.ans+q.a, q.ans-q.b, q.ans+2, q.ans-3]
    : [q.ans+1, q.ans-1, q.ans+2, q.ans-2, q.ans+3, q.ans-3, q.ans+10, q.ans-10];
  for(const v of near.sort(()=>Math.random()-.5)){
    if(v >= 0 && !cand.has(v)) cand.add(v);
    if(cand.size >= n) break;
  }
  let extra = 1;
  while(cand.size < n){ if(!cand.has(q.ans + extra)) cand.add(q.ans + extra); extra++; }
  return [...cand].slice(0, n).sort(()=>Math.random()-.5);
}
