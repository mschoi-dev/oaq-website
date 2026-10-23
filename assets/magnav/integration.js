(()=>{'use strict';
const $=id=>document.getElementById(id),stage=$('mn-stage'),frame=$('mn-frame'),CHANNEL='maegnas-magnav-v1';if(!stage)return;
let ready=false,active=false,wantPlay=!matchMedia('(prefers-reduced-motion: reduce)').matches,lastState=null,lastLoss=false,warningUntil=0,loadTimer;
const send=(command,value)=>frame.contentWindow?.postMessage({channel:CHANNEL,type:'command',command,value},location.origin);
const text=(id,value)=>$(id).textContent=value;
function load(){if(frame.hasAttribute('src'))return;frame.src=frame.dataset.src;loadTimer=setTimeout(()=>{if(!ready){$('mn-loading').hidden=true;$('mn-failure').hidden=false;}},60000);}
function sync(){if(!ready)return;send('active',active&&!document.hidden);if(active&&!document.hidden)send('playing',wantPlay);}
new IntersectionObserver(e=>{if(e.some(x=>x.isIntersecting))load();},{rootMargin:'500px'}).observe(stage);
new IntersectionObserver(e=>{active=e[0].intersectionRatio>.60;sync();},{threshold:[0,.25,.6,1]}).observe(stage);
document.addEventListener('visibilitychange',sync);
function showStage(){if(document.fullscreenElement||stage.classList.contains('mn-expanded'))return;window.scrollTo({top:stage.getBoundingClientRect().top+scrollY-78,behavior:'instant'});}
function chart(s){const canvas=$('mn-chart'),r=canvas.getBoundingClientRect();if(r.width<1)return;const w=r.width,h=r.height,dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);const c=canvas.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);const samples=s.samples,max=Math.max(.5,...samples.flatMap(q=>[q.error,q.crossTrack]))*1.15,t0=Math.max(0,s.time-65),scaleT=Math.max(30,s.time-t0);
 c.strokeStyle='#ffffff12';c.lineWidth=1;for(let i=0;i<4;i++){const y=10+(h-25)*i/3;c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}
 for(const [name,color]of [['crossTrack','#e1edf3'],['error',s.magEnabled?'#91e2cd':'#efbb7a']]){c.beginPath();samples.filter(q=>q.t>=t0).forEach((q,i)=>{const x=(q.t-t0)/scaleT*w,y=h-15-q[name]/max*(h-25);i?c.lineTo(x,y):c.moveTo(x,y);});c.lineWidth=2;c.strokeStyle=color;c.stroke();}
 c.font='8px Arial';c.fillStyle='#8ea5ae';c.fillText(`${max.toFixed(1)} km`,4,9);c.fillText('지금',w-19,h-2);canvas.setAttribute('aria-label',`현재 위치 오차 ${s.error.toFixed(2)} km, 목표 경로 이탈 ${s.crossTrack.toFixed(2)} km`);
}
function update(s){lastState=s;const loss=s.time>=31.2,sea=s.time>=36;Object.assign(stage.dataset,{ready:'true',view:s.view,mode:s.magEnabled?'quantum':'ins',motion:s.mode,time:s.time.toFixed(2),playing:String(s.playing),position:JSON.stringify(s.position),estimate:JSON.stringify(s.estimate),error:String(s.error),crossTrack:String(s.crossTrack),tracePoints:String(s.tracePoints),openOcean:String(sea)});
 if(loss&&!lastLoss)warningUntil=performance.now()+5500;if(!loss)warningUntil=0;lastLoss=loss;$('mn-warning').hidden=!loss||performance.now()>warningUntil;
 text('mn-signal',!loss?'● 초기 위치 확보 · 이륙':s.magEnabled?'GPS 두절 · Quantum Navigation':'⚠ GPS 두절 · INS only');
 $('mn-ins').setAttribute('aria-pressed',!s.magEnabled);$('mn-quantum').setAttribute('aria-pressed',s.magEnabled);$('mn-overview').disabled=!sea;$('mn-overview').setAttribute('aria-pressed',s.view==='overview');$('mn-follow').setAttribute('aria-pressed',s.view==='flight');
 text('mn-play',s.playing?'Ⅱ 일시정지':'▶ 재생');text('mn-clock',`${String(Math.floor(s.time/60)).padStart(2,'0')}:${String(Math.floor(s.time%60)).padStart(2,'0')}`);
 text('mn-nav-title',s.magEnabled?'Quantum Navigation':'INS 단독');$('mn-error').innerHTML=`${s.error.toFixed(2)} <em>km</em>`;$('mn-cross').innerHTML=`${s.crossTrack.toFixed(2)} <em>km</em>`;
 text('mn-error-note',!loss?'초기 위치를 확보하고 출발합니다.':s.magEnabled?'Quantum 보정을 적용한 현재 추정 위치':'INS가 추정한 위치와 실제 위치의 차이');
 const phase=!loss?'departure':s.mode,phrases={departure:['활주로 → 먼바다','출발 후 바다 위에서 항법을 비교합니다.'],ins:['INS 단독 · 오차 누적','추정상 항로를 따라가도 실제 기체는 벗어납니다.'],armed:['Quantum 준비','GPS 두절 이후 보정을 시작합니다.'],matching:['01 · 위치 추정 보정','먼저 추정 위치를 실제 위치에 가깝게 보정합니다.'],returning:['02 · 목표 경로로 복귀','현재 위치에서 부드럽게 선회하여 항로에 합류합니다.'],following:['03 · 경로 유지 중','도착으로 종료하지 않고 목표 경로를 계속 따라갑니다.']},copy=phrases[phase]||phrases.ins;
 text('mn-recovery-title',copy[0]);text('mn-recovery-note',copy[1]);text('mn-caption',!sea?'활주로 출발 후 먼바다 상공 비교로 전환합니다.':s.magEnabled?'위치 보정 → 경로 복귀 → 경로 유지. INS only로 다시 전환해 차이를 확인하세요.':'선명한 기체는 실제 위치, 반투명 기체는 INS 추정 위치입니다. Quantum Navigation을 선택해보세요.');
 text('mn-scene-caption',!sea?'활주로 출발 · 이륙':s.view==='overview'?'먼바다 · 실제 위치와 추정 위치 비교':'먼바다 · 기체 추적');chart(s);
}
window.addEventListener('message',e=>{if(e.source!==frame.contentWindow||e.origin!==location.origin||e.data?.channel!==CHANNEL)return;if(e.data.type==='ready'){ready=true;$('mn-loading').hidden=true;$('mn-failure').hidden=true;clearTimeout(loadTimer);if(location.hash==='#magnav')showStage();sync();}else if(e.data.type==='state')update(e.data.state);else if(e.data.type==='error'){$('mn-loading').hidden=true;$('mn-failure').hidden=false;}});
$('mn-play').onclick=()=>{wantPlay=!lastState?.playing;send('playing',wantPlay);};
$('mn-ins').onclick=()=>send('nav','ins');$('mn-quantum').onclick=()=>send('nav','quantum');
$('mn-restart').onclick=()=>{wantPlay=true;lastLoss=false;send('restart');};$('mn-cruise').onclick=()=>{wantPlay=true;send('cruise');};
$('mn-overview').onclick=()=>send('overview');$('mn-follow').onclick=()=>send('follow');
$('mn-retry').onclick=()=>{ready=false;$('mn-loading').hidden=false;$('mn-failure').hidden=true;frame.removeAttribute('src');load();};
function fullLabel(){text('mn-fullscreen',document.fullscreenElement||stage.classList.contains('mn-expanded')?'화면 복귀 ↙':'전체 화면 ⛶');}
$('mn-fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(stage.classList.contains('mn-expanded'))stage.classList.remove('mn-expanded');else await stage.requestFullscreen();}catch{stage.classList.toggle('mn-expanded');}fullLabel();};document.addEventListener('fullscreenchange',fullLabel);
document.addEventListener('keydown',e=>{if(e.key==='Escape'){stage.classList.remove('mn-expanded');fullLabel();}});
new ResizeObserver(()=>{if(lastState)chart(lastState);}).observe($('mn-chart'));
stage.addEventListener('click',e=>{if(e.target.closest('.mn-controls button'))requestAnimationFrame(showStage);});
document.querySelectorAll('[data-mn-jump]').forEach(b=>b.onclick=()=>{showStage();wantPlay=true;const v=Number(b.dataset.mnJump);send(v===0?'restart':'cruise');if(v>=.7)send('nav','quantum');});
document.querySelectorAll('a[href="#magnav"]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();history.replaceState(null,'','#magnav');showStage();}));if(location.hash==='#magnav')requestAnimationFrame(showStage);
})();
