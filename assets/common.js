/* 小虎乘法大冒險 共用程式：角色演出、音效、背景金幣、答題紀錄、飄分粒子
   三個玩法版本共用同一份，改這裡三版一起改 */

const $ = id => document.getElementById(id);

/* 數字變大之後要好讀：一萬以上用「萬」，其餘加千分位。
   後期怪物血量會到幾萬，一長串數字在小螢幕上完全看不出差別 */
function fmtN(n){
  n = Math.round(n || 0);
  if(n >= 100000000) return (n/100000000).toFixed(2).replace(/\.?0+$/,'') + '億';
  if(n >= 10000)     return (n/10000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/,'') + '萬';
  return n.toLocaleString('en-US');
}

/* ---------- 存檔位（2026-08-23 Steve：要像放置天堂那樣有「登入」） ----------
   那個遊戲的登入其實就是本地多存檔位＋選角畫面（`lineage_idle_save_1/2/3`），
   不是伺服器帳號，所以純前端就做得到。這裡把每一格的資料都加上 `_sN` 後綴：
   進度、答題統計、各遊戲最佳成績，每個角色各記各的。 */
const SLOT_KEY = 'mul99_slot';
const SLOT_MAX = 4;
function curSlot(){
  try{ const n = +localStorage.getItem(SLOT_KEY); return (n >= 1 && n <= SLOT_MAX) ? n : 1; }
  catch(e){ return 1; }
}
function setSlot(n){ try{ localStorage.setItem(SLOT_KEY, String(n)); }catch(e){} }
const sk = base => base + '_s' + curSlot();          // 這一格專用的 key
/* 舊玩家的資料（沒有 _sN 的那份）搬進第 1 格，只搬一次，不覆蓋已存在的 */
(function migrateOldSave(){
  try{
    for(const base of ['mul99_save', 'mul99_stats']){
      const old = localStorage.getItem(base);
      if(old && !localStorage.getItem(base + '_s1')) localStorage.setItem(base + '_s1', old);
    }
    for(let i = localStorage.length - 1; i >= 0; i--){
      const k = localStorage.key(i);
      if(k && k.startsWith('mul99_best_') && !/_s\d$/.test(k) && !localStorage.getItem(k + '_s1')){
        localStorage.setItem(k + '_s1', localStorage.getItem(k));
      }
    }
  }catch(e){}
})();

/* ---------- 答題紀錄（存這台電腦） ---------- */
const STORE_KEY = 'mul99_stats';
const Stats = {
  data: (() => { try{ return JSON.parse(localStorage.getItem(sk(STORE_KEY))) || {}; }catch(e){ return {}; } })(),
  mark(key, ok){
    const s = this.data[key] || (this.data[key] = {ok:0, bad:0});
    ok ? s.ok++ : s.bad++;
    try{ localStorage.setItem(sk(STORE_KEY), JSON.stringify(this.data)); }catch(e){}
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
  /* 兩種模式的紀錄要分開存：娛樂模式不用算數學，分數本來就衝得比較高，
     混在一起的話練習模式的紀錄永遠被蓋掉（Mode 定義在這支檔案後面，用的時候才會取到） */
  k(k){ return sk('mul99_best_' + ((typeof Mode !== 'undefined' && Mode.isArcade()) ? 'a_' : '') + k); },
  get(k){ try{ return +localStorage.getItem(this.k(k)) || 0; }catch(e){ return 0; } },
  set(k, v){ try{ if(v > this.get(k)) localStorage.setItem(this.k(k), v); }catch(e){} }
};

/* ---------- 存檔：關掉瀏覽器再打開也接得回來 ---------- */
/* ---------- 升級曲線（2026-08-23 改，參考放置天堂的做法） ----------
   原本是 `40 + 等級×35` 的直線，後期升級快得沒有成就感。改成三段：
   1. 前四級幾乎是秒升——新玩家頭幾分鐘一定要看到等級一直跳
   2. Lv5～34 固定 1.26 倍成長，穩定往上爬
   3. Lv35 之後改線性，才不會變成天文數字（參考站也是在 Lv70 改線性化）
   ⚠ 後期變慢一律靠「需求變高」，**不要調低打怪拿到的經驗**：
      拿到的變少玩家會覺得被扣，需求變高則是自然的難度曲線。 */
const MAX_LV = 200;                      // Steve 2026-08-23：開放到 200 級
const EXP_EARLY = [8, 22, 45, 80];       // Lv1→2、2→3、3→4、4→5
const EXP_MID_BASE = 80, EXP_MID_RATE = 1.20, EXP_MID_END = 30;   // 指數段到 Lv30
const EXP_S2_END = 100;                  // Lv30～100 一段、100 以上再一段
/* 斜率壓得比第一版低很多：Lv200 累計約 4,000 萬，配上怪物經驗隨關卡指數成長才打得到。
   算過 1.24/0.22/0.5 那組要 9.5 億，等於永遠練不完，那不是難度是絕望 */
function expReq(lv){                     // 從 lv 升到 lv+1 需要多少經驗
  if(lv >= MAX_LV) return Infinity;
  if(lv <= EXP_EARLY.length) return EXP_EARLY[lv - 1];
  if(lv < EXP_MID_END) return Math.round(EXP_MID_BASE * Math.pow(EXP_MID_RATE, lv - EXP_EARLY.length));
  const at30 = EXP_MID_BASE * Math.pow(EXP_MID_RATE, EXP_MID_END - EXP_EARLY.length);
  if(lv < EXP_S2_END) return Math.round(at30 * (1 + (lv - EXP_MID_END + 1) * 0.08));
  const at100 = at30 * (1 + (EXP_S2_END - EXP_MID_END + 1) * 0.08);
  return Math.round(at100 * (1 + (lv - EXP_S2_END + 1) * 0.10));
}

const SAVE_KEY = 'mul99_save';
const DEFAULT_SAVE = {
  lv:1, exp:0, gold:0, hero:'royal', pname:'',   // pname＝玩家自己取的名字，空的就用角色本名
  scroll:0,                                      // 強化卷軸：打怪會掉，也能用金幣買
  gear:{weapon:null, armor:null, charm:null},
  bag:[],
  round:1, wave:0,
  totalKill:0, playCount:0, lastPlay:''
};
const Save = {
  d: (() => {
    try{ return Object.assign({}, DEFAULT_SAVE, JSON.parse(localStorage.getItem(sk(SAVE_KEY))) || {}); }
    catch(e){ return Object.assign({}, DEFAULT_SAVE); }
  })(),
  put(){
    this.d.lastPlay = new Date().toISOString().slice(0,10);
    try{ localStorage.setItem(sk(SAVE_KEY), JSON.stringify(this.d)); }catch(e){}
    if(typeof Cloud !== 'undefined') Cloud.sync();     // 有登入就順便同步到雲端（節流）
  },
  /* 某一格的摘要，選角畫面用（不動目前這格的資料） */
  peek(n){
    try{
      const raw = localStorage.getItem(SAVE_KEY + '_s' + n);
      if(!raw) return null;
      return Object.assign({}, DEFAULT_SAVE, JSON.parse(raw));
    }catch(e){ return null; }
  },
  wipe(n){
    try{
      for(let i = localStorage.length - 1; i >= 0; i--){
        const k = localStorage.key(i);
        if(k && k.endsWith('_s' + n) && k.startsWith('mul99_')) localStorage.removeItem(k);
      }
    }catch(e){}
  },
  reset(){
    this.d = Object.assign({}, DEFAULT_SAVE, {gear:{weapon:null,armor:null,charm:null}, bag:[]});
    this.put();
  },
  needExp(){ return expReq(this.d.lv); },
  /* 基礎能力＋裝備加成 */
  power(){
    const g = this.d.gear, h = heroOf(this.d.hero);
    let atk = 8 + (this.d.lv-1)*2 + h.atk;
    let hp  = 100 + (this.d.lv-1)*12 + h.hp;
    let crit = 5 + h.crit, ult = 11 + h.ult;
    for(const k of ['weapon','armor','charm']){
      const it = g[k]; if(!it) continue;
      atk += gearStat(it,'atk'); hp += gearStat(it,'hp');
      crit += gearStat(it,'crit'); ult += gearStat(it,'ult');
    }
    return {atk, hp: Math.max(40, hp), crit, ult, spell: h.spell, hero: h};
  },
  addExp(n){
    if(this.d.lv >= MAX_LV){ this.d.exp = 0; this.put(); return 0; }
    this.d.exp += n;
    let ups = 0;
    while(this.d.lv < MAX_LV && this.d.exp >= this.needExp()){
      this.d.exp -= this.needExp(); this.d.lv++; ups++;
    }
    if(this.d.lv >= MAX_LV) this.d.exp = 0;
    this.put();
    return ups;
  }
};

/* ---------- 可選角色 ----------
   小虎姬有四格分解動作；其他三個是單張圖，攻擊動作用變形做 */
/* ---------- 職業（2026-08-23）----------
   分類**架構**參考線上遊戲的職業設計（前排耐打／遠程爆擊／法系爆發／技能流），
   但**名字全部自己取，不跟任何現有遊戲一樣**（Steve 2026-08-23 指定）。
   數值差異只是底，真正的特色在 trait：每個職業有一條**別人沒有的機制**。
   欄位說明：
     atk/hp/crit/ult 基礎數值差；spell＝魔法倍率
     gold＝金幣加成｜reduce＝受到傷害減免｜critBack＝爆擊回多少必殺
     spellEarly＝連擊魔法提早幾連觸發｜cdMul＝技能冷卻倍率｜scrollLuck＝卷軸多掉的機率 */
const HEROES = [
  {key:'royal',  name:'王者',      icon:'👑', img:'assets/fx_hero_ready.webp', frames:true,
   desc:'帶頭的那一個', buff:'金幣 +35%、卷軸更常掉',
   atk:2, hp:10, crit:2, ult:2, spell:1.1, gold:0.35, scrollLuck:1},   // scrollLuck 1＝掉落率翻倍
  {key:'knight', name:'鐵壁衛士',  icon:'🛡️', img:'assets/char_knight.webp',
   desc:'站在最前面的那個', buff:'受到傷害 -20%，被打會回必殺',
   atk:-1, hp:36, crit:0, ult:0, spell:1, reduce:0.20, hitUlt:10},
  {key:'elf',    name:'疾風獵手',  icon:'🏹', img:'assets/char_archer.webp',
   desc:'箭無虛發', buff:'爆擊 +15%，爆擊回必殺',
   atk:1, hp:-8, crit:15, ult:2, spell:1, critBack:8},
  {key:'mage',   name:'星辰術士',  icon:'🔮', img:'assets/char_mage.webp',
   desc:'魔法就是暴力', buff:'魔法 ×1.7，連擊魔法提早兩連',
   atk:-2, hp:-12, crit:0, ult:4, spell:1.7, spellEarly:2},
  {key:'dragon', name:'巨劍鬥士',  icon:'🐉', img:'assets/char_berserk.webp',
   desc:'又硬又痛', buff:'攻擊 +8、血量 +60，但技能比較慢',
   atk:8, hp:60, crit:0, ult:-2, spell:0.9, cdMul:1.3},
  {key:'sage',   name:'光影使者',  icon:'✨', img:'assets/char_sage.webp',
   desc:'技能不用等', buff:'技能冷卻 -35%，必殺充得快',
   atk:-2, hp:-4, crit:2, ult:8, spell:1.35, cdMul:0.65}
];
/* 舊存檔的角色代號要對到新職業，不然換版之後角色會被打回預設 */
const HERO_ALIAS = {tiger:'royal', archer:'elf', berserk:'dragon'};
const heroOf = k => HEROES.find(h => h.key === (HERO_ALIAS[k] || k)) || HEROES[0];
/* 畫面上要顯示的名字：玩家取過名字就用他的，沒取就用角色本名 */
function playerName(){
  const n = (Save.d.pname || '').trim();
  return n || heroOf(Save.d.hero).name;
}

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
/* ---------- 裝備強化（2026-08-23，天堂式的高風險高報酬） ----------
   每強化一級主屬性 +12%。前面幾級穩，後面越來越難，失敗只會掉級**不會消失**——
   小學生也在玩，裝備直接爆掉太傷。金幣終於有用途了。 */
/* 強化規則照《天堂》那套（Steve 2026-08-23 指定）：
   **+6 以前用強化卷軸一定成功，+7 開始失敗會爆炸，裝備直接消失。**
   所以 +6 是安全線，要不要往上賭是玩家自己的決定——這正是天堂最上癮的地方。 */
const ENH_MAX = 10;
const ENH_SAFE = 6;                     // 這一級（含）以前用卷軸必定成功
function enhLv(it){ return Math.max(0, Math.min(ENH_MAX, (it && it.enh) || 0)); }
/* 成功率：升到 +7 起才有失敗，而且失敗就是爆炸 */
function enhRate(lv){
  if(lv < ENH_SAFE) return 100;         // lv 是目前等級，要升到 lv+1
  return [60, 50, 40, 30][lv - ENH_SAFE] || 30;
}
/* 會不會爆：+7 開始，失敗就整件消失 */
function enhBoom(lv){ return lv >= ENH_SAFE; }
/* 卷軸之外還要一點金幣，越後面越貴 */
function enhCost(it){ return Math.round((20 + it.score * 0.25) * Math.pow(1.4, enhLv(it))); }
/* 強化倍率分兩段（Steve 2026-08-23）：
   安定值 +6 以內每級只加 12%（穩穩來）；**超過之後每一級都大跳，而且越往上跳越多**
   （+7 加 35%、+8 加 45%、+9 加 60%、+10 加 80%）。
   要冒爆炸的風險，回報就得一級比一級明顯，不然沒有人要賭。
     +6 ＝1.72 倍｜+7 ＝2.07｜+8 ＝2.52｜+9 ＝3.12｜+10＝3.92（是 +6 的 2.3 倍） */
const ENH_STEP_SAFE = 0.12;
const ENH_STEP_RISK = [0.35, 0.45, 0.60, 0.80];      // +7、+8、+9、+10 各自的增幅
function enhMult(lv){
  let m = 1 + Math.min(lv, ENH_SAFE) * ENH_STEP_SAFE;
  for(let i = 0; i < lv - ENH_SAFE; i++) m += ENH_STEP_RISK[i] || ENH_STEP_RISK[ENH_STEP_RISK.length-1];
  return m;
}
/* 算進強化倍率之後的數值 */
function gearStat(it, key){
  const base = it[key] || 0;
  if(!base) return 0;
  return Math.round(base * enhMult(enhLv(it)));
}
function gearScore(it){
  return gearStat(it,'atk')*3 + gearStat(it,'hp')*0.6 + gearStat(it,'crit')*2 + gearStat(it,'ult')*1.5;
}
function enhTag(it){ return enhLv(it) ? ' <span class="enh">+' + enhLv(it) + '</span>' : ''; }
function gearLine(it){
  const bits = [];
  if(it.atk) bits.push('攻擊 +' + gearStat(it,'atk'));
  if(it.hp)  bits.push('血量 +' + gearStat(it,'hp'));
  if(it.crit)bits.push('爆擊 +' + gearStat(it,'crit') + '%');
  if(it.ult) bits.push('必殺充能 +' + gearStat(it,'ult'));
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
  {f:'battle.html', n:'⚔️ 出擊'},
  {f:'gems.html', n:'💎 消消樂'},
  {f:'findnum.html', n:'🔢 找答案'},
  {f:'racing.html', n:'🏎️ 賽車'},
  {f:'memory.html', n:'🃏 翻牌'},
  {f:'cloudjump.html', n:'☁️ 跳跳'},
  {f:'bubble.html', n:'🐠 泡泡'}
];
/* 娛樂模式在標題後面掛一顆徽章，換頁也看得出現在在哪個模式 */
function modeBadge(){
  const h1 = document.querySelector('h1');
  if(!h1) return;
  let b = document.getElementById('modeBadge');
  if(!Mode.isArcade()){ b && b.remove(); return; }
  if(!b){
    b = document.createElement('span');
    b.id = 'modeBadge'; b.className = 'modebadge'; b.textContent = '娛樂模式';
    h1.after(b);
  }
}
function versionBar(current){
  const el = document.querySelector('.vers');
  if(!el) return;
  el.innerHTML = VERSIONS.map(v =>
    '<a href="' + v.f + '"' + (v.f === current ? ' class="on"' : '') + '>' + v.n + '</a>').join('');
}

/* ---------- 兩種模式（2026-08-22 Steve：大人玩不想在那邊答題） ----------
   practice＝練習模式（原本的，會出乘法題、答題紀錄進統計）
   arcade  ＝娛樂模式（不出題，改成純操作，不寫入答題統計）
   選擇存在 localStorage，八頁共用，換頁也記得。 */
const MODE_KEY = 'mul99_mode';
const MODE_PASSWORD = '5407';        // 娛樂模式的密碼（Steve 2026-08-23 指定）
const Mode = {
  get(){ try{ return localStorage.getItem(MODE_KEY) === 'arcade' ? 'arcade' : 'practice'; }catch(e){ return 'practice'; } },
  set(m){ try{ localStorage.setItem(MODE_KEY, m); }catch(e){} },
  isArcade(){ return this.get() === 'arcade'; },
  /* 在指定容器畫出「練習模式／娛樂模式」切換；onChange 回傳新模式。
     只放在大廳：Steve 2026-08-23 指定「一開始就要選好，不能在遊戲中隨意切換」 */
  bar(el, onChange){
    if(!el) return;
    el.className = 'modebar';
    el.innerHTML =
      '<button data-m="practice"><b>練習模式</b><small>會出算術題</small></button>' +
      '<button data-m="arcade"><b>娛樂模式</b><small>不出題，需要密碼</small></button>';
    const paint = () => [...el.children].forEach(b =>
      b.classList.toggle('on', b.dataset.m === Mode.get()));
    el.onclick = (e) => {
      const b = e.target.closest('button'); if(!b) return;
      const go = () => { Mode.set(b.dataset.m); paint(); onChange && onChange(Mode.get()); };
      if(b.dataset.m === 'arcade' && Mode.get() !== 'arcade') this.ask(go);   // 娛樂模式要密碼
      else go();
    };
    paint();
  },
  /* 遊戲頁只顯示現在是哪個模式，不給改（要改回大廳） */
  readonly(el){
    if(!el) return;
    el.className = 'modeshow';
    el.innerHTML = '<b>' + (Mode.isArcade() ? '娛樂模式' : '練習模式') + '</b>' +
                   '<span>要換模式請回大廳</span>';
  },
  /* 娛樂模式的密碼閘：小朋友該練習的時候不要自己切過去 */
  ask(onOk){
    const box = document.createElement('div');
    box.className = 'pwwrap';
    box.innerHTML =
      '<div class="pwbox">' +
        '<h3>娛樂模式需要密碼</h3>' +
        '<p>請家長或老師輸入密碼</p>' +
        '<input id="pwInput" type="password" inputmode="numeric" maxlength="8" autocomplete="off">' +
        '<div class="pwmsg" id="pwMsg"></div>' +
        '<div class="pwbtns"><button class="btn ghost" id="pwCancel">取 消</button>' +
        '<button class="btn" id="pwOk">確 定</button></div>' +
      '</div>';
    document.body.appendChild(box);
    const inp = box.querySelector('#pwInput');
    setTimeout(() => inp.focus(), 60);
    const close = () => box.remove();
    const check = () => {
      if(inp.value.trim() === MODE_PASSWORD){ close(); onOk(); }
      else{
        box.querySelector('#pwMsg').textContent = '密碼不對';
        inp.value = ''; inp.focus();
        box.querySelector('.pwbox').classList.remove('shake');
        void box.offsetWidth;
        box.querySelector('.pwbox').classList.add('shake');
      }
    };
    box.querySelector('#pwOk').onclick = check;
    box.querySelector('#pwCancel').onclick = close;
    inp.onkeydown = (e) => { if(e.key === 'Enter') check(); };
    box.onclick = (e) => { if(e.target === box) close(); };
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

/* ---------- 效能自動降級（2026-08-23 Steve：手機跟電腦玩起來都很卡） ----------
   每台機器的體質差很多，與其猜，不如量：連續掉幀就自己把吃效能的東西關掉。
   模式存 localStorage：auto（預設，會自己判斷）／high（全開）／low（一律精簡）。 */
const FX_KEY = 'mul99_fx';
const Fx = {
  get(){ try{ const v = localStorage.getItem(FX_KEY); return ['auto','high','low'].includes(v) ? v : 'auto'; }catch(e){ return 'auto'; } },
  set(v){ try{ localStorage.setItem(FX_KEY, v); }catch(e){} this.apply(); },
  low(){ return document.body.classList.contains('lowfx'); },
  apply(){
    const m = this.get();
    if(m === 'low')  document.body.classList.add('lowfx');
    if(m === 'high') document.body.classList.remove('lowfx');
    if(m === 'auto') this.watch();
  },
  /* 量測：連續 24 幀裡有一半以上超過 32ms（＝低於 30fps）就降級，只降不升，
     免得在邊界上一直來回切、畫面忽好忽壞更難看 */
  watch(){
    if(this._watching) return;
    this._watching = true;
    let last = performance.now(), bad = 0, n = 0;
    const step = (t) => {
      const dt = t - last; last = t;
      if(dt > 32) bad++;
      if(++n >= 24){
        if(bad >= 12 && !this.low()){
          document.body.classList.add('lowfx');
          this._watching = false;                 // 降過就不用再量了
          return;
        }
        n = 0; bad = 0;
      }
      if(this._watching) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
};
addEventListener('DOMContentLoaded', () => Fx.apply());

/* ---------- 雲端帳號（2026-08-23 Steve：帳號密碼不能放前端，一定要後端） ----------
   **帳號跟「小綸出題小幫手」(lunquiz) 共用同一套**（Steve 指定），
   後端在 ClaudeOnly 的 `school/lunquiz/worker`，遊戲存檔存在它的 D1（表 game_saves）。
   登入沿用它的 `/api/auth/*`，驗證走 `X-Session-Token` header。
   這支檔案裡**只會有 token**，密碼打完就送出去、不留在本機。 */
const Cloud = {
  API: 'https://linquiz-api.steve-edu711.workers.dev',
  GAME: 'mul99',
  TK: 'mul99_token', NM: 'mul99_user',
  token(){ try{ return localStorage.getItem(this.TK) || ''; }catch(e){ return ''; } },
  user(){ try{ return localStorage.getItem(this.NM) || ''; }catch(e){ return ''; } },
  logged(){ return !!this.token(); },
  _set(token, name){
    try{
      if(token){ localStorage.setItem(this.TK, token); localStorage.setItem(this.NM, name || ''); }
      else { localStorage.removeItem(this.TK); localStorage.removeItem(this.NM); }
    }catch(e){}
  },
  async req(path, opt){
    opt = opt || {};
    const headers = Object.assign({'Content-Type':'application/json'}, opt.headers || {});
    if(this.logged()) headers['X-Session-Token'] = this.token();
    const r = await fetch(this.API + path, {
      method: opt.method || 'GET', headers,
      body: opt.body ? JSON.stringify(opt.body) : undefined
    });
    let j = null;
    try{ j = await r.json(); }catch(e){}
    if(r.status === 401) this._set('');                 // token 過期就當作登出
    if(!j) throw new Error('連不到伺服器');
    if(j.error) throw new Error(j.error.message || '出錯了');   // lunquiz 的錯誤格式是 {error:{message}}
    return j;
  },
  async register(name, password){
    const j = await this.req('/api/auth/register', {method:'POST',
      body:{username:name, password, displayName:name, role:'student'}});
    this._set(j.token, (j.user && j.user.displayName) || name); return j;
  },
  async login(name, password){
    const j = await this.req('/api/auth/login', {method:'POST', body:{username:name, password}});
    this._set(j.token, (j.user && j.user.displayName) || name); return j;
  },
  async logout(){ this._set(''); },        // lunquiz 的 session 是簽章 token，沒有伺服器端撤銷
  slots(){ return this.req('/api/game/slots?game=' + this.GAME); },
  /* 把整包（進度＋答題統計＋各遊戲最佳成績）打成一份 */
  pack(){
    const best = {};
    try{
      for(let i = localStorage.length - 1; i >= 0; i--){
        const k = localStorage.key(i);
        if(k && k.startsWith('mul99_best_') && k.endsWith('_s' + curSlot())) best[k] = localStorage.getItem(k);
      }
    }catch(e){}
    return {save: Save.d, stats: Stats.data, best: best};
  },
  /* 從雲端拉下來覆蓋本機這一格 */
  async pull(slot){
    const j = await this.req('/api/game/save?game=' + this.GAME + '&slot=' + slot);
    if(!j.data) return false;
    const d = j.data;
    try{
      if(d.save)  localStorage.setItem(SAVE_KEY + '_s' + slot, JSON.stringify(d.save));
      if(d.stats) localStorage.setItem(STORE_KEY + '_s' + slot, JSON.stringify(d.stats));
      if(d.best)  for(const k in d.best) localStorage.setItem(k, d.best[k]);
    }catch(e){}
    return true;
  },
  async push(slot){
    if(!this.logged()) return false;
    await this.req('/api/game/save', {method:'POST',
      body:{game:this.GAME, slot: slot || curSlot(), data: this.pack()}});
    return true;
  },
  /* 存檔會很頻繁（每打一隻怪都存），節流：最多每 4 秒傳一次，離開頁面前補傳 */
  _t:null, _dirty:false,
  sync(){
    if(!this.logged()) return;
    this._dirty = true;
    if(this._t) return;
    this._t = setTimeout(() => {
      this._t = null;
      if(!this._dirty) return;
      this._dirty = false;
      this.push().catch(()=>{});
    }, 4000);
  },
  /* 關頁面前補傳一次。sendBeacon 沒辦法帶自訂 header（token 就送不出去），
     所以這裡用 keepalive fetch，關頁面之後請求仍會送完 */
  flush(){
    if(!this.logged() || !this._dirty) return;
    this._dirty = false;
    try{
      fetch(this.API + '/api/game/save', {
        method:'POST', keepalive:true,
        headers:{'Content-Type':'application/json', 'X-Session-Token': this.token()},
        body: JSON.stringify({game:this.GAME, slot:curSlot(), data:this.pack()})
      }).catch(()=>{});
    }catch(e){}
  }
};
addEventListener('pagehide', () => Cloud.flush());

/* ---------- 登入視窗（大廳用） ---------- */
function loginBox(onDone){
  const box = document.createElement('div');
  box.className = 'pwwrap';
  box.innerHTML =
    '<div class="pwbox loginbox">' +
      '<h3 id="lgTitle">登入</h3>' +
      '<p id="lgSub">跟「小綸出題小幫手」同一組帳號。登入後進度會存在雲端，換手機也接得回來</p>' +
      '<input id="lgName" maxlength="16" placeholder="帳號（英文或數字）" autocomplete="username">' +
      '<input id="lgPw" type="password" maxlength="32" placeholder="密碼" autocomplete="current-password">' +
      '<div class="pwmsg" id="lgMsg"></div>' +
      '<div class="pwbtns">' +
        '<button class="btn ghost" id="lgCancel">取 消</button>' +
        '<button class="btn" id="lgGo">登 入</button>' +
      '</div>' +
      '<button class="swap" id="lgSwap">還沒有帳號？註冊一個</button>' +
    '</div>';
  document.body.appendChild(box);
  let mode = 'login';
  const $$ = id => box.querySelector('#' + id);
  const msg = (t, ok) => { const m = $$('lgMsg'); m.textContent = t; m.style.color = ok ? 'var(--ok)' : 'var(--bad)'; };
  const close = () => box.remove();
  $$('lgSwap').onclick = () => {
    mode = mode === 'login' ? 'reg' : 'login';
    $$('lgTitle').textContent = mode === 'login' ? '登入' : '註冊新帳號';
    $$('lgSub').textContent = mode === 'login'
      ? '跟「小綸出題小幫手」同一組帳號。登入後進度會存在雲端，換手機也接得回來'
      : '帳號請用英文或數字。這組帳號在「小綸出題小幫手」也能用，請不要用你其他重要網站的密碼';
    $$('lgGo').textContent = mode === 'login' ? '登 入' : '註 冊';
    $$('lgSwap').textContent = mode === 'login' ? '還沒有帳號？註冊一個' : '已經有帳號了，改成登入';
    $$('lgPw').autocomplete = mode === 'login' ? 'current-password' : 'new-password';
    msg('');
  };
  $$('lgGo').onclick = async () => {
    const n = $$('lgName').value.trim(), p = $$('lgPw').value;
    if(!n || !p) return msg('帳號密碼都要填');
    $$('lgGo').disabled = true;
    msg('連線中…', true);
    try{
      if(mode === 'login') await Cloud.login(n, p);
      else await Cloud.register(n, p);
      msg('成功', true);
      setTimeout(() => { close(); onDone && onDone(); }, 350);
    }catch(e){
      msg(e.message || '出錯了');
      $$('lgGo').disabled = false;
    }
  };
  $$('lgCancel').onclick = close;
  box.onclick = (e) => { if(e.target === box) close(); };
  [$$('lgName'), $$('lgPw')].forEach(el => el.onkeydown = (e) => { if(e.key === 'Enter') $$('lgGo').click(); });
  setTimeout(() => $$('lgName').focus(), 60);
}
