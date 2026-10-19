const section = document.querySelector('.drone-scroll');
if (section) initialize(section);

function initialize(section) {
  const stage = section.querySelector('.drone-stage');
  const viewer = section.querySelector('.drone-model');
  const video = section.querySelector('.drone-video');
  const progress = section.querySelector('.drone-progress i');
  const cue = section.querySelector('.drone-cue');
  const status = section.querySelector('.drone-loading');
  const asset = name => new URL(name, import.meta.url).href;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  let track = [], ready = false, started = false, mode = '3d';
  let target = 0, current = 0, last = 0, raf = 0, lastApply = -1, videoTarget = 0;
  section.dataset.ready = 'false';

  function sample(p) {
    let hi = track.findIndex(r => r.p >= p);
    if (hi < 0) hi = track.length - 1;
    const a = track[Math.max(0, hi - 1)], b = track[hi];
    const u = a === b ? 0 : (p - a.p) / (b.p - a.p);
    const mix = (x, y) => x + (y - x) * u;
    return {
      frame: mix(a.source_frame, b.source_frame),
      theta: mix(a.theta, b.theta), phi: mix(a.phi, b.phi),
      target: a.target.map((v, i) => mix(v, b.target[i])),
      extent: a.extent.map((v, i) => mix(v, b.extent[i]))
    };
  }

  function syncVideo() {
    if (!ready || mode !== 'video' || video.seeking) return;
    const time = clamp(videoTarget, 0, Math.max(0, video.duration - 1 / 24));
    if (Math.abs(video.currentTime - time) > .025) video.currentTime = time;
  }
  video.addEventListener('seeked', syncVideo);

  function apply(p, force = false) {
    progress.style.transform = `scaleX(${p})`;
    cue.style.opacity = String(clamp(1 - p * 15));
    section.dataset.progress = p.toFixed(5);
    if (!ready) return;
    if (mode === 'video') {
      videoTarget = p * Math.max(0, video.duration - 1 / 24);
      syncVideo(); return;
    }
    if (!track.length || (!force && Math.abs(p - lastApply) < .00001)) return;
    lastApply = p;
    const r = sample(p), aspect = stage.clientWidth / stage.clientHeight;
    // model-viewer widens the vertical field of view in portrait layouts.
    // Use the effective FOV to avoid fitting the narrow viewport twice.
    const tanV = Math.tan(viewer.getFieldOfView() * Math.PI / 360), tanH = tanV * aspect;
    const [xmin, xmax, ymin, ymax, zmax] = r.extent;
    const fit = Math.max(Math.max(Math.abs(xmin), Math.abs(xmax)) / (tanH * .84),
      Math.max(Math.abs(ymin), Math.abs(ymax)) / (tanV * .82)) + zmax;
    viewer.cameraTarget = r.target.map(v => `${v}m`).join(' ');
    viewer.cameraOrbit = `${r.theta}deg ${r.phi}deg ${fit * 1.035}m`;
    // The exported animation retains frame 1 at 1/8 second.
    viewer.currentTime = clamp(r.frame / 8, 0, viewer.duration);
  }

  function tick(t) {
    raf = 0;
    const dt = last ? Math.min((t - last) / 1000, .1) : 1 / 60;
    last = t;
    current = reduced ? target : current + (target - current) * (1 - Math.exp(-dt * 13));
    if (Math.abs(current - target) < .00001) current = target;
    apply(current);
    if (current !== target) wake(); else last = 0;
  }
  function wake() { if (!raf) raf = requestAnimationFrame(tick); }
  function measure() {
    const top = parseFloat(getComputedStyle(stage).top) || 0;
    const travel = section.offsetHeight - stage.offsetHeight;
    target = clamp((top - section.getBoundingClientRect().top) / Math.max(1, travel));
    wake();
  }
  function unavailable() {
    status.replaceChildren();
    const link = document.createElement('a');
    link.href = asset('fallback.mp4'); link.textContent = 'Watch the product film';
    status.append(link);
  }
  function activateVideo() {
    if (mode === 'video') return;
    mode = 'video'; ready = false;
    section.dataset.mode = mode; section.dataset.ready = 'false';
    viewer.removeAttribute('src');
    video.addEventListener('loadedmetadata', () => {
      ready = true; section.dataset.ready = 'true'; apply(current, true);
    }, {once: true});
    video.addEventListener('error', unavailable, {once: true});
    video.src = asset('fallback.mp4'); video.load();
  }

  async function start() {
    if (started) return;
    started = true; section.dataset.started = 'true';
    if (navigator.connection?.saveData || new URLSearchParams(location.search).get('fallback') === 'video') {
      activateVideo(); return;
    }
    try {
      const [, response] = await Promise.all([import('./model-viewer.min.js'), fetch(asset('motion.json'))]);
      if (!response.ok) throw new Error('Motion unavailable');
      track = await response.json();
      customElements.get('model-viewer').dracoDecoderLocation = asset('draco/');
      viewer.addEventListener('error', activateVideo);
      viewer.addEventListener('load', async () => {
        if (mode !== '3d') return;
        viewer.animationName = viewer.availableAnimations[0];
        await viewer.updateComplete;
        viewer.pause(); ready = true; apply(current, true);
        await viewer.updateComplete; viewer.jumpCameraToGoal();
        requestAnimationFrame(() => {
          apply(current, true); section.dataset.ready = 'true'; status.textContent = ''; wake();
        });
      }, {once: true});
      section.dataset.mode = mode;
      viewer.src = asset('oaq-drone-web.glb?v=sensor64');
    } catch { activateVideo(); }
  }

  addEventListener('scroll', measure, {passive: true});
  addEventListener('resize', () => {
    // Let model-viewer update its responsive camera before refitting the scene.
    lastApply = -1; measure();
    requestAnimationFrame(() => requestAnimationFrame(() => apply(current, true)));
  }, {passive: true});
  measure();
  // Keep the 3D payload out of the initial homepage download.
  const observer = new IntersectionObserver(entries => {
    if (entries.some(e => e.isIntersecting)) { observer.disconnect(); start(); }
  }, {rootMargin: '1200px 0px'});
  observer.observe(section);
}
