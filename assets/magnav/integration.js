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
function chart(s){const canvas=$('mn-chart'),r=canvas.getBoundingClientRect();if(r.width<1)return;const w=r.width,h=r.height,dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);const c=canvas.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);const samples=s.samples,max=Math.max(.5,...samples.flatMap(q=>[q.error,q.crossTrack,q.insOnly||0]))*1.15,t0=Math.max(0,s.time-65),scaleT=Math.max(30,s.time-t0);
 c.strokeStyle='#ffffff12';c.lineWidth=1;for(let i=0;i<4;i++){const y=10+(h-25)*i/3;c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}
 for(const [name,color]of [['crossTrack','#e1edf3'],['error',s.magEnabled?'#91e2cd':s.navigationSource==='gps'?'#ee8c94':'#efbb7a'],['insOnly',s.comparisonSource==='gps'?'#ee8c94aa':'#efbd8388']]){c.beginPath();c.setLineDash(name==='insOnly'?[4,3]:[]);samples.filter(q=>q.t>=t0&&q[name]!==null&&q[name]!==undefined).forEach((q,i)=>{const x=(q.t-t0)/scaleT*w,y=h-15-q[name]/max*(h-25);i?c.lineTo(x,y):c.moveTo(x,y);});c.lineWidth=2;c.strokeStyle=color;c.stroke();}
 c.font='8px Arial';c.fillStyle='#8ea5ae';c.fillText(`${max.toFixed(1)} km`,4,9);c.fillText('지금',w-19,h-2);canvas.setAttribute('aria-label',`현재 위치 오차 ${s.error.toFixed(2)} km, 목표 경로 이탈 ${s.crossTrack.toFixed(2)} km`);
}
function update(s){
 lastState=s;const loss=s.gpsLost,sea=s.openOcean,selected=s.navigationSource||'ins',phase=s.gpsPhase||'healthy',jam=phase==='jammed',spoof=phase==='spoofed';
 Object.assign(stage.dataset,{ready:'true',view:s.view,mode:selected,baseIns:'true',gpsPhase:phase,gpsDisabled:String(jam),scenario:s.scenario,comparisonSource:s.comparisonSource||'',cameraDirection:s.cameraDirection,coastVisible:String(s.coastVisible),falseGpsTarget:JSON.stringify(s.falseGpsTarget),runwayCount:String(s.runwayCount),motion:s.mode,time:s.time.toFixed(2),playing:String(s.playing),position:JSON.stringify(s.position),estimate:JSON.stringify(s.estimate),error:String(s.error),crossTrack:String(s.crossTrack),tracePoints:String(s.tracePoints),openOcean:String(sea),gear:String(s.gear),departureStage:s.departureStage,comparisonPosition:JSON.stringify(s.comparisonPosition),insOnly:String(s.insOnly),groundContacts:JSON.stringify(s.groundContacts),heading:String(s.heading),bank:String(s.bank),aileronAngle:String(s.aileronAngle),archivedComparisons:String(s.archivedComparisons),cameraAzimuth:String(s.cameraAzimuth),cameraElevation:String(s.cameraElevation),cameraDistance:String(s.cameraDistance),cameraPosition:JSON.stringify(s.cameraPosition),cameraPhase:s.cameraPhase,navigationBlend:String(s.navigationBlend),displayPixels:String(s.displayPixels),renderFps:String(s.renderFps),gpsLost:String(loss)});
 for(const value of ['jamming','spoofing']){$('mn-'+value).disabled=false;$('mn-'+value).setAttribute('aria-pressed',String(s.scenario===value));}
 const gpsComparison=s.comparisonSource==='gps',comparisonLabel=gpsComparison?'오염 GPS를 계속 사용했다면':'INS만 유지했다면';text('mn-comparison-label',comparisonLabel);text('mn-comparison-legend',gpsComparison?'┄ 오염 GPS 비교':'┄ INS 비교');
 if(phase!==lastLoss){warningUntil=phase==='healthy'?0:performance.now()+5500;lastLoss=phase;}
 $('mn-warning').hidden=phase==='healthy'||performance.now()>warningUntil;
 $('mn-warning').querySelector('span').textContent=jam?'JAMMING · GPS 수신 불가':'SPOOFING · GPS 거짓 위치 수신';
 const aid=selected==='gps'?'INS + GPS':selected==='quantum'?'INS + Quantum':'INS only';
 text('mn-signal',jam?'JAMMING · GPS 수신 불가' :spoof?`⚠ SPOOFING · ${aid}`:`GPS 수신 정상 · ${aid}`);
 $('mn-gps').disabled=jam;$('mn-gps').setAttribute('aria-disabled',String(jam));$('mn-gps').setAttribute('aria-pressed',selected==='gps');$('mn-gps').title=jam?'재밍 중에는 GPS를 추가할 수 없습니다.':spoof?'오염된 GPS 정보를 추가해 오차를 비교합니다.':'INS에 GPS 기준을 추가합니다.';
 text('mn-gps-status',jam?'수신 불가':spoof?'거짓 위치 · 선택 가능':'위성 기준 추가');
 $('mn-ins').setAttribute('aria-pressed','true');$('mn-ins').dataset.only=String(selected==='ins');$('mn-ins').title='보조 항법을 끄고 INS만 사용';$('mn-quantum').setAttribute('aria-pressed',selected==='quantum');
 $('mn-overview').disabled=!sea;$('mn-overview').setAttribute('aria-pressed',s.view==='overview');$('mn-follow').setAttribute('aria-pressed',s.view==='flight');
 text('mn-play',s.playing?'Ⅱ 일시정지':'▶ 재생');text('mn-clock',`${String(Math.floor(s.time/60)).padStart(2,'0')}:${String(Math.floor(s.time%60)).padStart(2,'0')}`);
 text('mn-nav-title',aid);$('mn-ins-comparison').hidden=s.insOnly===null;text('mn-ins-distance',s.insOnly===null?'—':`${s.insOnly.toFixed(2)} km`);$('mn-error').innerHTML=`${s.error.toFixed(2)} <em>km</em>`;$('mn-cross').innerHTML=`${s.crossTrack.toFixed(2)} <em>km</em>`;
 text('mn-error-note',selected==='gps'&&spoof?'오염된 GPS를 더한 추정 위치 오차':s.magEnabled?'Quantum 보정 후의 잔여 추정 오차':loss?'INS만으로 누적되는 추정 오차':'출발 위치에서 초기화한 INS');
 let title,note;
 if(!sea){title='기체 디테일 · 이륙 · 기어 수납';note='카메라가 기체를 따라 측면과 하부를 둘러봅니다.';}
 else if(!loss){title='해상 진입 · GPS 정상';note='선택한 위험 상황은 먼바다에 진입한 뒤 시작됩니다.';}
 else if(jam&&!s.magEnabled){title='JAMMING · GPS 수신 불가';note='GPS 없이 INS가 동작합니다. Quantum을 추가해 경로 복귀 효과를 비교하세요.';}
 else if(selected==='gps'&&spoof){title='INS + GPS · 오염된 보조 정보';note='빨간 위치와 유도점은 GPS의 거짓 정보입니다. 흰 점선은 실제 목표 경로입니다.';}
 else if(s.magEnabled){const phrases={armed:['Quantum 기준 준비','INS에 독립적인 자기 기준을 추가합니다.'],matching:['01 · 추정 위치 보정','위치를 보정한 뒤 목표 경로로 선회합니다.'],returning:['02 · 목표 경로로 복귀','기체가 기울며 부드럽게 항로에 합류합니다.'],following:['03 · INS + Quantum · 경로 유지','변하는 오차를 보정하며 목표 경로를 유지합니다.']};[title,note]=phrases[s.mode]||phrases.armed;}
 else{title=spoof?'INS only · 오염 GPS 미사용':'INS only · 오차 누적';note=spoof?'GPS를 추가하면 거짓 정보로 더 크게 이탈하는 모습을 비교할 수 있습니다.':'INS 오차가 조금씩 누적됩니다. 보조 기준을 추가해 비교하세요.';}
 text('mn-recovery-title',title);text('mn-recovery-note',note);
 text('mn-caption',!loss?'INS 항상 사용 · 정면 → 기체 한 바퀴·기어 수납 → 바다를 향한 후미 → 항법뷰':jam&&!s.magEnabled?'재밍: GPS 수신 차단 · INS에 Quantum을 추가해 비교하세요.':selected==='gps'?'INS + GPS · 빨간 표시: 거짓 위치·유도점 · 흰 점선: 실제 목표 경로':s.magEnabled?gpsComparison?'민트: Quantum 보정 · 반투명 빨강: 오염 GPS를 계속 사용한 경우':'민트: Quantum 보정 · 반투명 주황: INS만 유지한 경우':'INS 항상 사용 · + GPS 또는 + Quantum을 선택하세요. 다시 누르면 보조 기준이 꺼집니다.');
 text('mn-scene-caption',!sea?'기체 중심 연속 촬영 · 랜딩기어 수납':s.view==='overview'?'목표 경로와 항법 보조 비교':'기체 추적');chart(s);
}

window.addEventListener('message',e=>{if(e.source!==frame.contentWindow||e.origin!==location.origin||e.data?.channel!==CHANNEL)return;if(e.data.type==='ready'){ready=true;$('mn-loading').hidden=true;$('mn-failure').hidden=true;clearTimeout(loadTimer);if(location.hash==='#magnav')showStage();sync();}else if(e.data.type==='state')update(e.data.state);else if(e.data.type==='error'){$('mn-loading').hidden=true;$('mn-failure').hidden=false;}});
for(const value of ['jamming','spoofing'])$('mn-'+value).onclick=()=>send('scenario',value);
$('mn-play').onclick=()=>{wantPlay=!lastState?.playing;send('playing',wantPlay);};
$('mn-gps').onclick=()=>{if(lastState?.gpsPhase!=='jammed')send('nav',lastState?.navigationSource==='gps'?'ins':'gps');};$('mn-ins').onclick=()=>send('nav','ins');$('mn-quantum').onclick=()=>send('nav',lastState?.navigationSource==='quantum'?'ins':'quantum');
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
