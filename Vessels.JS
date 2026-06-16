/* ================================================================
   vessels.js
   1. 탐사선 플립 카드 (클릭 뒤집기)
   2. 생물발광 마우스 트레일 (전체 페이지)
   ================================================================ */

/* ================================================================
   1. 탐사선 플립 카드
   ================================================================ */
(function initVesselCards() {

  const cards = document.querySelectorAll('.vessel-card');
  if (!cards.length) return;

  cards.forEach(card => {
    /* 클릭 → 뒤집기 */
    card.addEventListener('click', () => {
      card.classList.toggle('flipped');
    });

    /* 뒤집힌 카드 바깥 클릭 시 닫기 */
    document.addEventListener('click', e => {
      if (!card.contains(e.target)) {
        card.classList.remove('flipped');
      }
    });
  });

})();


/* ================================================================
   2. 생물발광 마우스 트레일
   ================================================================ */
(function initBioTrail() {

  /* 전용 캔버스 생성 — 페이지 전체 오버레이 */
  const cv = document.createElement('canvas');
  cv.id = 'bio-trail-canvas';
  cv.style.cssText = `
    position: fixed; inset: 0; z-index: 9990;
    pointer-events: none;
    opacity: 1;
  `;
  document.body.appendChild(cv);

  const ctx = cv.getContext('2d');

  function resize() {
    cv.width  = window.innerWidth;
    cv.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  /* ── 트레일 파티클 풀 ──────────────────────────────────── */
  const MAX_PARTICLES = 120;
  const particles = [];

  let mouseX = -999, mouseY = -999;
  let lastX  = -999, lastY  = -999;
  let speed  = 0;

  document.addEventListener('mousemove', e => {
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    speed = Math.sqrt(dx*dx + dy*dy);
    lastX = mouseX = e.clientX;
    lastY = mouseY = e.clientY;

    /* 속도에 비례해서 파티클 생성 */
    const count = Math.min(Math.floor(speed * 0.35), 6);
    for (let i = 0; i < count; i++) {
      spawnParticle(
        mouseX + (Math.random() - 0.5) * 4,
        mouseY + (Math.random() - 0.5) * 4,
        speed
      );
    }
  });

  function spawnParticle(x, y, spd) {
    if (particles.length >= MAX_PARTICLES) particles.shift();

    /* 빠를수록 크고 밝게 */
    const size    = Math.random() * 3 + 1 + Math.min(spd * 0.08, 4);
    const life    = 0.6 + Math.random() * 0.6;
    const hue     = 170 + Math.random() * 40;   /* 청록~민트 */
    const bright  = 60  + Math.random() * 30;

    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 1.2,
      vy: (Math.random() - 0.5) * 1.2 - 0.4,
      size,
      life,
      maxLife: life,
      hue, bright,
      alpha: 0.85,
    });
  }

  /* ── 렌더 루프 ─────────────────────────────────────────── */
  let lastFrame = 0;
  const INTERVAL = 1000 / 40; /* 40fps — 가볍게 */

  function draw(now) {
    requestAnimationFrame(draw);
    if (now - lastFrame < INTERVAL) return;
    const dt = (now - lastFrame) / 1000;
    lastFrame = now;

    ctx.clearRect(0, 0, cv.width, cv.height);

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }

      p.x  += p.vx;
      p.y  += p.vy;
      p.vy -= 0.02; /* 가벼운 부력 */

      const lifeRatio = p.life / p.maxLife;  /* 1→0 */
      const alpha     = lifeRatio * p.alpha;

      /* 코어 */
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.shadowColor = `hsla(${p.hue},100%,${p.bright}%,0.8)`;
      ctx.shadowBlur  = p.size * 4;
      ctx.fillStyle   = `hsla(${p.hue},100%,${p.bright}%,1)`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * lifeRatio, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      /* 확산 글로우 */
      ctx.save();
      ctx.globalAlpha = alpha * 0.25;
      ctx.fillStyle   = `hsla(${p.hue},100%,${p.bright}%,1)`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * lifeRatio * 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  requestAnimationFrame(draw);

})();