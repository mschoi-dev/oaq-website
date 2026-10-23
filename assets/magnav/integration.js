(()=>{'use strict';
const $=id=>document.getElementById(id),section=$('magnav');if(!section)return;
const stage=$('mn-stage'),frame=$('mn-frame'),CHANNEL='maegnas-magnav-v1',reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let ready=false,active=false,started=false,wantPlay=!reduced,orbit=false,lastState=null,lastLoss=false,warningUntil=0,lastOutcome='',loadTimer;
const send=(command,value)=>{if(frame.contentWindow)frame.contentWindow.postMessage({channel:CHANNEL,type:'command',command,value},location.origin);};
const text=(id,value)=>$(id).textContent=value;
function load(){if(frame.hasAttribute('src'))return;frame.src=frame.dataset.src;clearTimeout(loadTimer);loadTimer=setTimeout(()=>{if(!ready){$('mn-loading').hidden=true;$('mn-failure').hidden=false;}},60000);}
function syncPlayback(){if(!ready)return;send('active',active&&!document.hidden);if(active&&!document.hidden){if(!started){started=true;send('mode','explore');}send('playing',wantPlay);}}
new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting))load();},{rootMargin:'500px'}).observe(stage);
new IntersectionObserver(entries=>{active=entries[0].isIntersecting&&entries[0].intersectionRatio>.65;syncPlayback();},{threshold:[0,.25,.65,1]}).observe(stage);
document.addEventListener('visibilitychange',syncPlayback);
function showStage(){if(document.fullscreenElement||stage.classList.contains('mn-expanded'))return;const top=stage.getBoundingClientRect().top+scrollY-78;window.scrollTo({top,behavior:'instant'});}
function clearWarning(){warningUntil=0;lastLoss=false;$('mn-warning').hidden=true;}
function drawRoutes(route){if(!route)return;const canvas=$('mn-route-map'),r=canvas.getBoundingClientRect();if(r.width<1||r.height<1)return;const w=r.width,h=r.height,dpr=Math.min(devicePixelRatio||1,2);if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}const c=canvas.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);
 const ended=!!lastState?.outcome,rotate=p=>[p[0]*.82-p[1]*.572,p[0]*.572+p[1]*.82],sets=[route.without,route.with,route.flown,[route.goal,route.current,...(ended?[]:[route.estimate])]],all=sets.flat().map(rotate);let xmin=Infinity,xmax=-Infinity,ymin=Infinity,ymax=-Infinity;for(const p of all){xmin=Math.min(xmin,p[0]);xmax=Math.max(xmax,p[0]);ymin=Math.min(ymin,p[1]);ymax=Math.max(ymax,p[1]);}const margin=Math.min(23,w*.10),scale=Math.min((w-2*margin)/(xmax-xmin||1),(h-2*margin)/(ymax-ymin||1));const xy=p=>{const q=rotate(p);return [w/2+(q[0]-(xmin+xmax)/2)*scale,h/2+(q[1]-(ymin+ymax)/2)*scale];};
 c.strokeStyle='#a9d6dd10';c.lineWidth=1;c.beginPath();for(let x=15;x<w;x+=25){c.moveTo(x,0);c.lineTo(x,h);}for(let y=10;y<h;y+=25){c.moveTo(0,y);c.lineTo(w,y);}c.stroke();
 const line=(points,color,dash,width)=>{if(points.length<2)return;c.beginPath();points.forEach((p,i)=>i?c.lineTo(...xy(p)):c.moveTo(...xy(p)));c.strokeStyle=color;c.lineWidth=width;c.setLineDash(dash);c.lineJoin='round';c.stroke();c.setLineDash([]);};
 line(route.without,'#f4b66d',[4,4],2);line(route.with,route.preview?'#8de6c899':'#8de6c8',route.preview?[2,3]:[],2.4);line(route.flown,'#e9f7ff',[],1.4);if(!ended)line([route.current,route.estimate],'#efb67877',[2,3],1);
 const dot=(p,color,label,radius=3)=>{const [x,y]=xy(p);c.fillStyle=color;c.beginPath();c.arc(x,y,radius,0,Math.PI*2);c.fill();if(label){c.font='9px Arial, sans-serif';c.textAlign=x>w*.7?'right':'left';c.fillText(label,x+(x>w*.7?-7:7),y-7);}};
 dot(route.without[0],'#9eb8c2','출발',2.5);dot(route.without.at(-1),'#f4b66d','미사용',3);dot(route.goal,'#96efd0','목표',4);const g=xy(route.goal);c.strokeStyle='#94dfc9';c.beginPath();c.arc(...g,7,0,Math.PI*2);c.stroke();dot(route.current,'#f3fbff','',4);if(!ended){const estimate=xy(route.estimate);c.strokeStyle='#eeb779';c.strokeRect(estimate[0]-3,estimate[1]-3,6,6);}
 canvas.dataset.flownPoints=route.flown.length;canvas.dataset.preview=String(route.preview);canvas.setAttribute('aria-label',`전체 경로 비교. 주황색 점선과 끝점: MagNav 미사용. 초록색: ${route.preview?'MagNav 예상 복귀':'MagNav 복귀'}. 흰색: 실제 비행 경로. 하얀 점: 현재 위치.${ended?'':' 주황색 사각형: INS 추정 위치.'}`);
}
function update(s){lastState=s;const loss=s.time>=31.2,outcome=s.outcome||'';stage.dataset.outcome=outcome;stage.dataset.playing=String(s.playing);stage.dataset.time=s.time.toFixed(2);stage.dataset.position=JSON.stringify(s.routes?.current);stage.dataset.view=s.view;stage.dataset.reference=JSON.stringify(s.reference);stage.dataset.deviation=String(s.deviation);stage.dataset.tracePoints=String(s.tracePoints);stage.dataset.phase=outcome?'ended':loss?(s.magEnabled?'correcting':'gps-lost'):'departing';
 if(loss&&!lastLoss&&!outcome){warningUntil=performance.now()+6500;}if(!loss)warningUntil=0;lastLoss=loss;$('mn-warning').hidden=outcome||!loss||performance.now()>warningUntil;
 const signal=$('mn-signal');signal.dataset.lost=String(loss);signal.textContent=outcome?'비행 종료':!loss?'● GPS 정상':s.magEnabled?(s.process<1?'GPS 두절 · 자기장 패턴 비교 중':'GPS 두절 · MagNav 보정 중'):'⚠ GPS 두절 · INS 단독';
 text('mn-play',s.playing?'Ⅱ 일시정지':outcome?'▶ 다시 재생':'▶ 재생');$('mn-play').setAttribute('aria-label',s.playing?'비행 일시정지':'비행 재생');
 $('mn-correct').setAttribute('aria-pressed',s.magEnabled);text('mn-correct',s.magEnabled?'OAQ MagNav 켜짐 ✓':'OAQ MagNav 켜기 ↗');$('mn-correct').disabled=!!outcome;
 text('mn-ins',`${s.error.toFixed(2)} km`);text('mn-mag',!s.magEnabled?'꺼짐':!loss?'대기':`${s.corrected.toFixed(2)} km`);
 text('mn-goal-distance',`${s.goalDistance.toFixed(2)} km`);text('mn-goal-unguided',`${s.unguidedDistance.toFixed(2)} km`);text('mn-map-mag',s.routes?.preview?'┄ MagNav 예상':'━ MagNav 경로');text('mn-map-title',outcome?'최종 비행 경로':'전체 경로 비교');
 const caption=outcome?(outcome==='success'?'목표에 도착했습니다. 다시하기로 미사용 결과와 비교해보세요.':'목표에 도착하지 못했습니다. 다시하기 후 OAQ MagNav를 켜보세요.'):
 !loss?'활주로에서 자동 출발합니다. GPS가 끊기면 OAQ MagNav를 켜보세요.':!s.magEnabled?(s.view==='overview'?'GPS가 끊겼습니다. 점선은 원래 경로입니다. 선명한 실제 기체와 반투명 계획 기체를 비교하고 MagNav를 켜보세요.':'GPS가 끊겼습니다. 상공 보기에서 원래 경로와 실제 위치를 비교하거나 OAQ MagNav를 켜보세요.'):s.process<1?'지금까지 관측한 자기장 패턴과 지도를 비교하고 있습니다.':'기체가 부드럽게 선회하며 목표로 돌아갑니다. 목표까지의 거리를 확인하세요.';
 text('mn-caption',caption);text('mn-scene-caption',s.view==='airfield'?'해안 비행장 · 공항 보기':outcome?'최종 실제 위치 · 비행 궤적과 목표 거리':!loss?(s.time<10?'활주로 출발':'이륙 · 먼바다로 이동'):s.motion==='return'?'OAQ MagNav · 목표로 복귀 중':(s.view==='overview'?`실제 위치 ↔ 원래 경로 ${s.deviation.toFixed(2)} km`:'GPS 없는 비행 · 누적되는 오차'));
 text('mn-turn-status',s.startDistance===null?(outcome?'미사용 경로의 끝점과 목표를 비교해보세요.':'흰 점: 실제 위치 · □: INS 추정 위치'):`보정 시작 ${s.startDistance.toFixed(2)} → 현재 ${s.goalDistance.toFixed(2)} km`);
 $('mn-time').value=s.time;$('mn-time').disabled=!!outcome;text('mn-clock',`${Math.round(s.time/120*100)}%`);
 for(const [id,view]of [['mn-overview','overview'],['mn-follow','flight'],['mn-arrival','arrival'],['mn-airfield','airfield']])$(id).setAttribute('aria-pressed',s.view===view);
 $('mn-result').hidden=!outcome;$('mn-result').dataset.outcome=outcome;text('mn-result-title',outcome==='success'?'목표 완수':'실패');text('mn-result-en',outcome==='success'?'MISSION COMPLETE':'MISSION FAILED');text('mn-result-detail',outcome==='success'?'비행 종료 · 목표에 도착했습니다.':`비행 종료 · 목표까지 ${s.goalDistance.toFixed(2)} km`);
 if(outcome&&!lastOutcome)wantPlay=false;lastOutcome=outcome;drawRoutes(s.routes);
}
window.addEventListener('message',e=>{if(e.source!==frame.contentWindow||e.origin!==location.origin||e.data?.channel!==CHANNEL)return;if(e.data.type==='ready'){ready=true;stage.dataset.ready='true';$('mn-loading').hidden=true;$('mn-failure').hidden=true;clearTimeout(loadTimer);if(['#magnav','#mn-stage'].includes(location.hash))showStage();syncPlayback();}else if(e.data.type==='state')update(e.data.state);else if(e.data.type==='error'){$('mn-loading').hidden=true;$('mn-failure').hidden=false;}});
$('mn-play').onclick=()=>{if(!ready)return;if(lastState?.outcome){wantPlay=true;clearWarning();send('restart');}else{wantPlay=!lastState?.playing;send('playing',wantPlay);}};
$('mn-correct').onclick=()=>{wantPlay=true;send('correct');};
$('mn-restart').onclick=()=>{wantPlay=true;clearWarning();send('restart');};
$('mn-time').oninput=e=>{wantPlay=false;send('seek',Number(e.target.value));showStage();};
$('mn-overview').onclick=()=>{orbit=false;stage.dataset.orbit='false';$('mn-camera').setAttribute('aria-pressed','false');text('mn-camera','회전');send('overview');};$('mn-follow').onclick=()=>send('follow');$('mn-arrival').onclick=()=>send('arrival');$('mn-airfield').onclick=()=>{wantPlay=false;clearWarning();send('airfield');};
$('mn-camera').onclick=()=>{if(lastState?.view==='overview')send('follow');orbit=!orbit;stage.dataset.orbit=String(orbit);$('mn-camera').setAttribute('aria-pressed',orbit);text('mn-camera',orbit?'회전 중':'회전');frame.tabIndex=orbit?0:-1;};
$('mn-retry').onclick=()=>{ready=false;started=false;stage.dataset.ready='false';$('mn-loading').hidden=false;$('mn-failure').hidden=true;frame.removeAttribute('src');load();};
function fullLabel(){const full=document.fullscreenElement||stage.classList.contains('mn-expanded');text('mn-fullscreen',full?'화면 복귀 ↙':'전체 화면 ⛶');$('mn-fullscreen').setAttribute('aria-label',full?'전체 화면 종료':'비행 화면 전체 화면으로 보기');}
$('mn-fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(stage.classList.contains('mn-expanded'))stage.classList.remove('mn-expanded');else if(stage.requestFullscreen)await stage.requestFullscreen();else stage.classList.add('mn-expanded');}catch{stage.classList.toggle('mn-expanded');}fullLabel();};
document.addEventListener('fullscreenchange',()=>{fullLabel();if(!document.fullscreenElement)requestAnimationFrame(()=>requestAnimationFrame(showStage));});document.addEventListener('keydown',e=>{if(e.key==='Escape'){stage.classList.remove('mn-expanded');fullLabel();}});
stage.addEventListener('click',e=>{if(e.target.closest('.mn-controls button'))showStage();});
new ResizeObserver(()=>{if(lastState)drawRoutes(lastState.routes);}).observe($('mn-route-map'));
document.querySelectorAll('[data-mn-jump]').forEach(b=>b.onclick=()=>{showStage();wantPlay=false;const p=Number(b.dataset.mnJump);clearWarning();send('seek',p===0?0:p<.5?55:p<1?80:108);if(p>=.7){wantPlay=true;send('mag',true);}else send('mag',false);});
document.querySelectorAll('a[href="#magnav"],a[href="#mn-stage"]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();history.replaceState(null,'','#mn-stage');showStage();}));
if(['#magnav','#mn-stage'].includes(location.hash))requestAnimationFrame(showStage);
})();
