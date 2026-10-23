/* MAEGNAS-local integration: no external library, account, or navigation data. */
(()=>{'use strict';
const root=document.getElementById('magnav');if(!root)return;
const $=id=>document.getElementById(id),frame=$('mn-frame'),stage=$('mn-stage'),layout=root.querySelector('.mn-layout');
const CHANNEL='maegnas-magnav-v1',reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let ready=false,started=false,active=false,mode=reduced?'explore':'story',orbit=false,progress=0,timer=0,raf=0,lastState=null,loadAt=0;
root.dataset.mode=mode;root.dataset.ready='false';root.dataset.orbit='false';
const clamp=x=>Math.max(0,Math.min(1,x));
function send(command,value){if(ready)frame.contentWindow.postMessage({channel:CHANNEL,type:'command',command,value},location.origin);}
function fail(message){root.dataset.failed='true';$('mn-loading').hidden=true;$('mn-failure').hidden=false;$('mn-failure').querySelector('p').textContent=message;}
function load(){if(started)return;started=true;loadAt=performance.now();root.dataset.started='true';$('mn-loading').hidden=false;$('mn-failure').hidden=true;frame.src=frame.dataset.src;timer=setTimeout(()=>fail('Loading is taking longer than expected. Retry or open the full experience.'),90000);}
function showStage(){requestAnimationFrame(()=>window.scrollTo({top:scrollY+layout.getBoundingClientRect().top-82,behavior:reduced?'instant':'smooth'}));}
function setMode(value,focus=false){mode=value;root.dataset.mode=mode;$('mn-story').setAttribute('aria-pressed',mode==='story');$('mn-explore').setAttribute('aria-pressed',mode==='explore');$('mn-manual').hidden=mode!=='explore';orbit=false;root.dataset.orbit='false';$('mn-camera').setAttribute('aria-pressed','false');frame.tabIndex=-1;send('mode',mode);$('mn-hint').textContent=mode==='story'?'Scroll to move through the flight. Or choose a chapter.':reduced?'Reduced motion: choose a chapter, move the slider, or press Play.':'Use the controls below. Enable Orbit camera to drag or zoom the aircraft.';if(mode==='story')measure();if(focus)showStage();}
function chapter(p){root.querySelectorAll('.mn-step').forEach((el,i)=>el.classList.toggle('active',i===(p<.22?0:p<.55?1:p<.84?2:3)));}
function measure(){raf=0;if(mode!=='story')return;const top=parseFloat(getComputedStyle(stage).top)||82;const travel=Math.max(1,layout.offsetHeight-stage.offsetHeight);progress=clamp((top-layout.getBoundingClientRect().top)/travel);root.dataset.progress=progress.toFixed(4);chapter(progress);send('story',progress);}
function wake(){if(!raf)raf=requestAnimationFrame(measure);}
function jump(p){load();progress=p;chapter(p);if(mode==='story'&&!reduced){const top=parseFloat(getComputedStyle(stage).top)||82;const travel=Math.max(1,layout.offsetHeight-stage.offsetHeight);window.scrollTo({top:scrollY+layout.getBoundingClientRect().top+travel*p-top,behavior:'smooth'});}else{send('story',p);send('mode','explore');showStage();}}
window.addEventListener('message',event=>{
 if(event.source!==frame.contentWindow||event.origin!==location.origin||event.data?.channel!==CHANNEL)return;
 const m=event.data;
 if(m.type==='ready'){ready=true;clearTimeout(timer);root.dataset.ready='true';root.dataset.loadMs=Math.round(performance.now()-loadAt);$('mn-failure').hidden=true;send('active',active&&!document.hidden);send('mode',mode);if(mode==='story')measure();else send('story',progress);if(mode==='explore')send('mode','explore');return;}
 if(m.type==='error'){clearTimeout(timer);fail(m.message||'This browser could not start WebGL 2. Try Chrome or Edge.');return;}
 if(m.type!=='state')return;lastState=m.state;const s=lastState;root.dataset.outcome=s.outcome||'';root.dataset.motion=s.motion;root.dataset.loss=String(s.time>=31.2);
 $('mn-signal').textContent=s.time<31.2?'GPS AVAILABLE':s.blend>.95?'INS + MAGNAV':'GPS UNAVAILABLE · INS ONLY';
 $('mn-ins').innerHTML=(s.reveal?s.error.toFixed(2):'—')+'<small> km</small>';$('mn-mag').innerHTML=(s.reveal&&s.magEnabled&&s.time>=31.2?s.corrected.toFixed(2):'—')+'<small> km</small>';
 $('mn-goal-distance').textContent=s.goalDistance.toFixed(2)+' km';$('mn-goal-unguided').textContent=s.unguidedDistance.toFixed(2)+' km';$('mn-guidance').setAttribute('aria-pressed',s.guidance);$('mn-guidance').textContent=s.guidance?'Return motion on':'Return motion off';$('mn-arrival').setAttribute('aria-pressed',s.view==='arrival');$('mn-follow').setAttribute('aria-pressed',s.view==='flight');
 $('mn-route-key').hidden=s.startDistance===null;$('mn-turn-status').textContent=s.startDistance===null?'Follow the aircraft · watch its distance to arrival':`Turn started ${s.startDistance.toFixed(2)} km → now ${s.goalDistance.toFixed(2)} km`;$('mn-turn-progress').style.width=(s.returnProgress*100)+'%';
 const firstResult=!!s.outcome&&$('mn-result').hidden;$('mn-result').hidden=!s.outcome;if(firstResult&&mode==='explore')showStage();$('mn-result-title').textContent=s.outcome==='success'?'목표 완수':'실패';$('mn-result-en').textContent=s.outcome==='success'?'DESTINATION REACHED':'DESTINATION MISSED';$('mn-result-detail').textContent=s.outcome==='success'?'목표 지점에 도착했습니다. 비행을 종료합니다.':`목표까지 ${s.goalDistance.toFixed(2)} km 남은 상태로 비행이 종료되었습니다.`;
 for(const id of ['mn-correct','mn-guidance'])$(id).disabled=!!s.outcome;

 $('mn-caption').textContent=s.outcome?(s.outcome==='success'?'Destination reached. Flight stopped. Replay to try another scenario.':'Destination missed. Flight stopped. Replay and enable MagNav to compare.'):s.time<10.2?'The flight starts on the runway.':s.time<31.2?'GPS still provides a position reference.':!s.reveal?'The view alone does not reveal accumulated error.':s.blend>.95?(s.guidance?(s.motion==='return'?'Banking onto the return path. Watch the distance decrease.':'Position estimate corrected. The aircraft continues from its current position.'):'The estimate is corrected. Route preview is off.'):s.magEnabled?'Observing the field → comparing the map → correcting the estimate.':'Without an external reference, the estimated and actual positions diverge.';
 $('mn-play').textContent=s.playing?'Pause flight':s.outcome?'Replay flight':'Play flight';$('mn-play').setAttribute('aria-label',$('mn-play').textContent);
 $('mn-truth').setAttribute('aria-pressed',s.reveal);$('mn-truth').textContent=s.reveal?'Hide true position':'Reveal true position';$('mn-correct').setAttribute('aria-pressed',s.magEnabled);$('mn-correct').textContent=s.magEnabled?'Disable MagNav':'Enable MagNav';
 if(document.activeElement!==$('mn-time'))$('mn-time').value=s.time;$('mn-clock').textContent=Math.round(s.time/120*100)+'%';
});
$('mn-explore').onclick=()=>{load();setMode('explore',true);};$('mn-story').onclick=()=>{load();if(reduced){jump(0);$('mn-hint').textContent='Reduced motion is on. Choose the chapter buttons to advance.';}else setMode('story');};
$('mn-play').onclick=()=>send('play');$('mn-truth').onclick=()=>send('truth');$('mn-correct').onclick=()=>send('correct');$('mn-time').oninput=e=>send('seek',Number(e.target.value));
$('mn-restart').onclick=()=>{setMode('explore');send('restart');showStage();};$('mn-follow').onclick=()=>send('follow');
$('mn-guidance').onclick=()=>send('guidance');$('mn-arrival').onclick=()=>send('arrival');
$('mn-camera').onclick=()=>{orbit=!orbit;root.dataset.orbit=String(orbit);$('mn-camera').setAttribute('aria-pressed',orbit);frame.tabIndex=orbit?0:-1;$('mn-hint').textContent=orbit?'Camera active: drag to orbit, wheel to zoom. Turn Orbit camera off to scroll over the scene.':'Page scrolling is active over the scene.';};
$('mn-retry').onclick=()=>{clearTimeout(timer);ready=false;started=false;root.dataset.ready='false';frame.removeAttribute('src');load();};
root.querySelectorAll('[data-mn-jump]').forEach(b=>b.onclick=()=>jump(Number(b.dataset.mnJump)));
new IntersectionObserver(entries=>{if(entries[0].isIntersecting)load();},{rootMargin:'500px 0px'}).observe(stage);
new IntersectionObserver(entries=>{active=entries[0].isIntersecting;send('active',active&&!document.hidden);},{threshold:.02}).observe(root.querySelector('.mn-screen'));
document.addEventListener('visibilitychange',()=>send('active',active&&!document.hidden));
window.addEventListener('scroll',wake,{passive:true});window.addEventListener('resize',wake,{passive:true});
const hero=document.querySelector('.hero'),video=hero?.querySelector('video');if(video)new IntersectionObserver(es=>{if(es[0].isIntersecting&&!reduced)video.play().catch(()=>{});else video.pause();}).observe(hero);
setMode(mode);chapter(0);
window.__MAEGNAS_MAGNAV={snapshot:()=>({ready,started,active,mode,orbit,progress,loadMs:Number(root.dataset.loadMs)||null,state:lastState}),jump,setMode};
})();
document.getElementById('mn-airfield').onclick=()=>document.getElementById('mn-frame').contentWindow.postMessage({channel:'maegnas-magnav-v1',type:'command',command:'airfield'},location.origin);
