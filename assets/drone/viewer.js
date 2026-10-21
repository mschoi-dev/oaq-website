const $ = id => document.getElementById(id);
const viewer = $('drone'), app = $('app'), slider = $('fold');
const asset = name => new URL(name, import.meta.url).href;
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
// The approved Blender animation is sampled at 8 fps in this web export.
// Frames 25 and 76 are the deployed and folded endpoints used by the homepage.
const FIRST_FRAME = 25, LAST_FRAME = 76, FPS = 8;
const CYCLE_SECONDS = (LAST_FRAME - FIRST_FRAME) / FPS;
let ready = false, playing = false, phase = 0, direction = 1, hold = 0;
let last = 0, raf = 0, transition = null, activeView = 'overall', autoOrbit = false, followPreset = true;
let toastTimer, resizeTimer, loadTimeout;

const presets = {
  overall: {label: '전체 디자인', theta: 25, phi: 76, target: [0, .3476, 0], span: .84},
  side: {label: '측면 · Arm', theta: 90, phi: 86, target: [0, .3476, 0], span: .76},
  drive: {label: 'OAQ 드라이브', theta: 30, phi: 105, target: [0, .51, .015], span: .145},
  top: {label: '상부 형상', theta: 25, phi: 20, target: [0, .49, 0], span: .81}
};

function notify(message) {
  clearTimeout(toastTimer); $('toast').textContent = message; $('toast').classList.add('visible');
  toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 3000);
}
function setPhase(p) {
  phase = clamp(p); slider.value = String(Math.round(phase * 1000));
  const percent = Math.round(phase * 100);
  $('pose-percent').value = percent + '%'; slider.setAttribute('aria-valuetext', percent + '% 접힘');
  $('pose-label').textContent = phase < .001 ? '펼쳐진 상태' : phase > .999 ? '접힌 상태' : '접힘 중간 자세';
  if (ready) {
    viewer.currentTime = (FIRST_FRAME + (LAST_FRAME - FIRST_FRAME) * phase) / FPS;
    if (followPreset && (activeView === 'overall' || activeView === 'side')) frameView();
  }
  app.dataset.fold = phase.toFixed(4);
}
function setPlaying(value) {
  playing = value; last = 0;
  $('play').setAttribute('aria-pressed', String(playing));
  $('play-label').textContent = playing ? '일시 정지' : '동작 재생';
  $('play-icon').textContent = playing ? 'Ⅱ' : '▶';
  if (playing) { transition = null; hold = 0; if (phase >= 1) direction = -1; else if (phase <= 0) direction = 1; wake(); }
}
function tick(time) {
  raf = 0;
  const dt = last ? Math.min((time - last) / 1000, .05) : 0; last = time;
  if (transition) {
    transition.elapsed += dt;
    const p = clamp(transition.elapsed / transition.duration);
    setPhase(transition.start + (transition.end - transition.start) * p);
    if (p >= 1) transition = null;
  } else if (playing) {
    if (hold > 0) hold -= dt;
    else {
      const next = phase + direction * dt / CYCLE_SECONDS;
      setPhase(next);
      if ((direction > 0 && next >= 1) || (direction < 0 && next <= 0)) { direction *= -1; hold = .65; }
    }
  }
  if (autoOrbit) {
    const orbit = viewer.getCameraOrbit();
    viewer.cameraOrbit = (orbit.theta + dt * .12) + 'rad ' + orbit.phi + 'rad ' + orbit.radius + 'm';
  }
  if (playing || transition || autoOrbit) wake(); else last = 0;
}
function wake() { if (!raf && !document.hidden) raf = requestAnimationFrame(tick); }
function setOrbit(value) {
  autoOrbit = value; $('rotate').setAttribute('aria-pressed', String(value));
  if (value) { last = 0; wake(); }
}
function stopMotion() { transition = null; setPlaying(false); }
function moveTo(end) {
  stopMotion();
  if (reduced || Math.abs(end - phase) < .001) { setPhase(end); return; }
  transition = {start: phase, end, elapsed: 0, duration: Math.max(.35, Math.abs(end - phase) * CYCLE_SECONDS)};
  last = 0; wake();
}
function frameView() {
  const p = presets[activeView];
  const aspect = viewer.clientWidth / Math.max(1, viewer.clientHeight);
  const tanV = Math.tan(viewer.getFieldOfView() * Math.PI / 360);
  const foldingView = activeView === 'overall' || activeView === 'side';
  const height = foldingView ? p.span + (.48 - p.span) * phase : p.span;
  const distance = Math.max(height, p.span / aspect) / (2 * tanV);
  const target = [...p.target]; if (foldingView) target[1] += .13 * phase;
  viewer.cameraTarget = target.map(v => v + 'm').join(' ');
  const orbit = viewer.getCameraOrbit();
  viewer.cameraOrbit = autoOrbit ? orbit.theta + 'rad ' + orbit.phi + 'rad ' + distance + 'm' : p.theta + 'deg ' + p.phi + 'deg ' + distance + 'm';
}
function setView(name, snap = false) {
  if (!ready) return;
  activeView = name; followPreset = true; frameView(); const p = presets[name];
  document.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === name)));
  $('view-label').textContent = p.label;
  if (snap || reduced) viewer.jumpCameraToGoal();
}

slider.addEventListener('input', () => { stopMotion(); setPhase(Number(slider.value) / 1000); });
$('play').addEventListener('click', () => setPlaying(!playing));
$('deploy').addEventListener('click', () => moveTo(0));
$('stow').addEventListener('click', () => moveTo(1));
$('rotate').addEventListener('click', () => setOrbit(!autoOrbit));
$('reset').addEventListener('click', () => { setOrbit(false); setView('overall'); });
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => { setOrbit(false); setView(button.dataset.view); }));
viewer.addEventListener('pointerdown', () => setOrbit(false));
viewer.addEventListener('keydown', event => {
  if (event.code === 'Space' && ready) { event.preventDefault(); setPlaying(!playing); }
});
viewer.addEventListener('camera-change', event => {
  if (event.detail.source === 'user-interaction') {
    followPreset = false;
    $('view-label').textContent = '자유 시점';
    document.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed', 'false'));
  }
});
new ResizeObserver(() => {
  clearTimeout(resizeTimer); resizeTimer = setTimeout(() => setView(activeView, true), 180);
}).observe(viewer);
document.addEventListener('visibilitychange', () => {
  last = 0;
  if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else if (playing || transition || autoOrbit) wake();
});

$('fullscreen').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (app.requestFullscreen) await app.requestFullscreen();
    else notify('이 브라우저는 전체 화면을 지원하지 않습니다.');
  } catch { notify('브라우저 메뉴에서 전체 화면을 사용할 수 있습니다.'); }
});
document.addEventListener('fullscreenchange', () => {
  const full = Boolean(document.fullscreenElement);
  $('fullscreen').setAttribute('aria-pressed', String(full));
  $('fullscreen').setAttribute('aria-label', full ? '전체 화면 종료' : '전체 화면');
  $('fullscreen').title = full ? '전체 화면 종료' : '전체 화면';
});
$('share').addEventListener('click', async () => {
  const url = new URL('drone.html', location.href).href;
  try {
    if (navigator.share) { await navigator.share({title: 'OAQ Drone v1.0 — Interactive 3D', url}); return; }
    await navigator.clipboard.writeText(url); notify('공유 링크를 복사했습니다.');
  } catch (error) {
    if (error.name === 'AbortError') return;
    $('share-url').value = url; $('share-dialog').showModal(); $('share-url').select();
  }
});

function fallback() {
  if (app.dataset.error === 'true') return;
  clearTimeout(loadTimeout); ready = false; stopMotion(); setOrbit(false);
  app.dataset.ready = 'false'; app.dataset.error = 'true';
  $('loading').hidden = true; $('fallback').hidden = false;
  document.querySelectorAll('[data-view], #play, #fold, #deploy, #stow, #rotate, #reset').forEach(el => el.disabled = true);
}
async function initialize() {
  loadTimeout = setTimeout(fallback, 120000);
  try {
    await import('./model-viewer.min.js');
    customElements.get('model-viewer').dracoDecoderLocation = asset('draco/');
    viewer.addEventListener('progress', event => {
      const p = clamp(event.detail.totalProgress); $('load-progress').value = p;
      $('loading-label').textContent = p > .98 ? '표면과 동작을 준비하는 중' : '3D 모델을 불러오는 중 · ' + Math.round(p * 100) + '%';
    });
    viewer.addEventListener('error', fallback);
    viewer.addEventListener('load', async () => {
      try {
        if (app.dataset.error === 'true') return;
        if (!viewer.availableAnimations.includes('OAQ_Integrated_Lower_Arm_Fold')) throw new Error('Missing approved animation');
        viewer.animationName = 'OAQ_Integrated_Lower_Arm_Fold';
        await viewer.updateComplete; viewer.pause(); ready = true;
        setPhase(0); setView('overall', true);
        await viewer.updateComplete; viewer.jumpCameraToGoal();
        document.querySelectorAll('[data-view], #play, #fold, #deploy, #stow, #rotate, #reset').forEach(el => el.disabled = false);
        clearTimeout(loadTimeout); $('loading').hidden = true; app.dataset.ready = 'true';
      } catch { fallback(); }
    }, {once: true});
    viewer.src = asset('oaq-drone-web.glb?v=sensor64');
  } catch { fallback(); }
}
initialize();
