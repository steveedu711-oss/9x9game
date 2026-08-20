/* 鎖住手機的縮放：小朋友玩的時候手指常常不小心把畫面放大。
   預設就是鎖住的，右下角有一顆鈕可以自己解開（選擇存在這台手機）。
   做法分兩層：
   - touch-action:manipulation 停掉「連點兩下放大」，這個不會吃掉一般的點擊
   - gesturestart/gesturechange 與兩指以上的 touchmove 直接擋掉＝停掉「兩指捏開」
   刻意不用 JS 去攔雙擊（會連遊戲的快速連點一起吃掉），交給 CSS 處理。 */
(function(){
  var KEY = 'mul99_lockzoom';
  var on = true;
  try{ on = localStorage.getItem(KEY) !== '0'; }catch(e){}

  function setViewport(){
    var m = document.querySelector('meta[name="viewport"]');
    if(!m){
      m = document.createElement('meta');
      m.name = 'viewport';
      document.head.appendChild(m);
    }
    m.content = on
      ? 'width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover'
      : 'width=device-width,initial-scale=1,viewport-fit=cover';
  }
  function apply(){
    setViewport();
    document.documentElement.style.touchAction = on ? 'manipulation' : '';
    var b = document.getElementById('zoomLockBtn');
    if(b){
      b.textContent = on ? '🔒' : '🔓';
      var t = on ? '畫面已鎖定，點一下可以解開' : '畫面可以縮放，點一下鎖回去';
      b.title = t; b.setAttribute('aria-label', t);
      b.className = 'zoomlock' + (on ? ' on' : '');
    }
  }
  function block(e){ if(on) e.preventDefault(); }

  document.addEventListener('gesturestart',  block, {passive:false});
  document.addEventListener('gesturechange', block, {passive:false});
  document.addEventListener('gestureend',    block, {passive:false});
  document.addEventListener('touchmove', function(e){
    if(on && e.touches && e.touches.length > 1) e.preventDefault();
  }, {passive:false});

  function build(){
    var css = document.createElement('style');
    css.textContent =
      '.zoomlock{position:fixed;right:10px;bottom:10px;z-index:60;width:44px;height:44px;' +
      'border-radius:50%;border:1px solid #573a7d;background:#241638e6;color:#ffe9a8;' +
      'font-size:19px;line-height:1;cursor:pointer;backdrop-filter:blur(6px);' +
      'box-shadow:0 6px 18px #0009;opacity:.55;transition:opacity .2s,transform .15s}' +
      '.zoomlock:hover{opacity:1}.zoomlock:active{transform:scale(.92)}' +
      '.zoomlock.on{opacity:.75}' +
      '.zoomtip{position:fixed;right:60px;bottom:18px;z-index:60;padding:7px 12px;border-radius:12px;' +
      'background:#241638e6;border:1px solid #573a7d;color:#f6efff;font-size:12px;font-weight:700;' +
      'white-space:nowrap;box-shadow:0 6px 18px #0009;opacity:0;transform:translateX(8px);' +
      'transition:opacity .25s,transform .25s;pointer-events:none}' +
      '.zoomtip.on{opacity:1;transform:none}' +
      '@media (min-width:900px){.zoomlock,.zoomtip{display:none}}';
    document.head.appendChild(css);

    var btn = document.createElement('button');
    btn.id = 'zoomLockBtn';
    btn.type = 'button';
    var tip = document.createElement('div');
    tip.className = 'zoomtip';
    tip.id = 'zoomLockTip';

    btn.addEventListener('click', function(){
      on = !on;
      try{ localStorage.setItem(KEY, on ? '1' : '0'); }catch(e){}
      apply();
      tip.textContent = on ? '畫面鎖定了，不會被放大' : '可以自己縮放畫面了';
      tip.classList.add('on');
      clearTimeout(tip._t);
      tip._t = setTimeout(function(){ tip.classList.remove('on'); }, 1800);
    });

    document.body.appendChild(btn);
    document.body.appendChild(tip);
    apply();
  }

  setViewport();
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
