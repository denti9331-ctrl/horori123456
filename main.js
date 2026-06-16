/* ================================================================
   main.js — 마리아나 해구
   ──────────────────────────────────────────────────────────────
   1. 커스텀 커서
   2. 배경 파티클 캔버스
   3. 버블 생성
   4. 수심층 인터랙티브 (데이터 + 렌더링)
   5. 압력 게이지 애니메이션
   6. 숫자 카운터 애니메이션
   7. 스크롤 Reveal
   8. 네비게이션 수심 카운터 + 스크롤 스타일
   ================================================================ */

/* ================================================================
   0. 히어로 버블 캔버스 (물방울 올라오기)
   ================================================================ */
(function initHeroBubbles() {
  const cv = document.getElementById('hero-bubble-canvas');
  if (!cv) return;
  const ctx = cv.getContext('2d');

  function resize() {
    cv.width  = cv.offsetWidth  || window.innerWidth;
    cv.height = cv.offsetHeight || window.innerHeight;
  }
  requestAnimationFrame(resize);
  window.addEventListener('resize', resize);

  let bubbles = [];

  function makeBubble(W, H, randomY) {
    const r = Math.random() * 4.5 + 0.8;
    return {
      x: Math.random() * W,
      y: randomY ? Math.random() * H : H + r * 2,
      r,
      spd:   Math.random() * 0.65 + 0.2,
      sway:  Math.random() * 1.2 - 0.6,
      phase: Math.random() * Math.PI * 2,
      freq:  Math.random() * 0.016 + 0.007,
      alpha: (r / 5.3) * (Math.random() * 0.32 + 0.1),
      grow:  Math.random() < 0.25 ? Math.random() * 0.003 : 0,
    };
  }

  function init() {
    const W = cv.width, H = cv.height;
    bubbles = Array.from({ length: 75 }, () => makeBubble(W, H, true));
  }
  init();
  window.addEventListener('resize', init);

  let t = 0;
  function draw() {
    requestAnimationFrame(draw);
    const W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);

    bubbles.forEach((b, i) => {
      b.y -= b.spd;
      b.x += Math.sin(t * b.freq + b.phase) * b.sway * 0.35;
      b.r += b.grow;
      if (b.y < -b.r * 3) { bubbles[i] = makeBubble(W, H, false); return; }

      /* 페이드 — 하단에서 나타나고 상단에서 사라짐 */
      let alpha = b.alpha;
      const fogTop = H * 0.6;
      if (b.y > fogTop) alpha *= Math.max(0, 1 - (b.y - fogTop) / (H - fogTop));
      if (b.y < H * 0.12) alpha *= b.y / (H * 0.12);

      ctx.save();
      ctx.shadowColor = 'rgba(80,210,190,0.55)';
      ctx.shadowBlur  = b.r * 2.8;

      /* 테두리 */
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(130,225,205,${alpha * 1.35})`;
      ctx.lineWidth   = b.r < 2.5 ? 0.5 : 0.75;
      ctx.stroke();

      /* 내부 그라디언트 */
      const g = ctx.createRadialGradient(
        b.x - b.r * 0.28, b.y - b.r * 0.28, b.r * 0.05,
        b.x, b.y, b.r
      );
      g.addColorStop(0, `rgba(170,235,220,${alpha * 0.3})`);
      g.addColorStop(0.5, `rgba(70,170,160,${alpha * 0.1})`);
      g.addColorStop(1, `rgba(30,110,120,${alpha * 0.03})`);
      ctx.fillStyle = g;
      ctx.fill();

      /* 하이라이트 */
      ctx.beginPath();
      ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200,245,235,${alpha * 0.5})`;
      ctx.fill();

      ctx.restore();
    });

    /* 수중 먼지 파티클 */
    if (t % 2 === 0) {
      for (let d = 0; d < 2; d++) {
        ctx.beginPath();
        ctx.arc(Math.random() * W, Math.random() * H, Math.random() * 1 + 0.2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(100,190,170,${Math.random() * 0.07 + 0.02})`;
        ctx.fill();
      }
    }
    t++;
  }
  draw();
})();



/* ================================================================
   1. 커스텀 커서
   ================================================================ */
(function initCursor() {
  const dot  = document.getElementById('cursor');
  const ring = document.getElementById('cursorRing');
  let mx = 0, my = 0, rx = 0, ry = 0;

  document.addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;
    dot.style.left = mx + 'px';
    dot.style.top  = my + 'px';
  });

  function animRing() {
    rx += (mx - rx) * 0.12;
    ry += (my - ry) * 0.12;
    ring.style.left = rx + 'px';
    ring.style.top  = ry + 'px';
    requestAnimationFrame(animRing);
  }
  animRing();
})();


/* ================================================================
   2. 파티클 캔버스
   ================================================================ */
(function initParticles() {
  const canvas = document.getElementById('particles');
  const ctx    = canvas.getContext('2d');

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const pts = Array.from({ length: 35 }, () => ({
    x:  Math.random() * canvas.width,
    y:  Math.random() * canvas.height,
    r:  Math.random() * 1.2 + 0.2,
    vx: (Math.random() - 0.5) * 0.15,
    vy: (Math.random() - 0.5) * 0.1,
    o:  Math.random() * 0.3 + 0.05,
  }));

  /* 20fps로 스로틀 */
  let lastPF = 0;
  function draw(now) {
    requestAnimationFrame(draw);
    if (now - lastPF < 50) return;
    lastPF = now;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pts.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,212,255,${p.o})`;
      ctx.fill();
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0)             p.x = canvas.width;
      if (p.x > canvas.width)  p.x = 0;
      if (p.y < 0)             p.y = canvas.height;
      if (p.y > canvas.height) p.y = 0;
    });
  }
  requestAnimationFrame(draw);
})();


/* ================================================================
   3. 버블
   ================================================================ */
(function initBubbles() {
  const bc = document.getElementById('bubbles');
  for (let i = 0; i < 8; i++) {
    const b = document.createElement('div');
    b.className = 'bubble';
    const s = Math.random() * 10 + 4;
    b.style.cssText = `
      width:${s}px; height:${s}px;
      left:${Math.random() * 100}%;
      animation-duration:${Math.random() * 12 + 8}s;
      animation-delay:${Math.random() * 8}s;
    `;
    bc.appendChild(b);
  }
})();


/* ================================================================
   4. 수심층 인터랙티브
   ================================================================ */

// ── 층 데이터 (텍스트·수치 수정은 여기서) ─────────────────────
const LAYER_DATA = [
  {
    zone:      'EPIPELAGIC ZONE · 투광층',
    depthRange:'0 – 200',
    unit:      'm  |  해수면 ~ 투광 하한',
    title:     '투광층 · Sunlit Zone',
    desc:      '태양복사에너지가 광합성에 충분한 수준(> 1% 표면 조도)으로 도달하는 구간입니다. 전체 해양 생물량의 약 90%가 집중되어 있으며, 식물플랑크톤·동물플랑크톤·어류·해양포유류의 주요 서식층입니다. 수온약층(thermocline)이 형성되기 시작하는 경계이기도 합니다.',
    stats: [
      { label: '광도',    value: '> 1% 표면'  },
      { label: '수온',    value: '15 – 30°C'  },
      { label: '수압',    value: '1 – 21 atm' },
    ],
    creatures: ['식물플랑크톤', '동물플랑크톤', '참다랑어', '혹등고래', '바다거북'],
  },
  {
    zone:      'MESOPELAGIC ZONE · 박광층',
    depthRange:'200 – 1,000',
    unit:      'm  |  황혼층 · Twilight Zone',
    title:     '박광층 · Twilight Zone',
    desc:      '광합성이 불가능할 정도로 조도가 감쇠하지만 희미한 빛이 잔존하는 전이층입니다. 일주 수직 이동(diel vertical migration)을 하는 어류·두족류가 밤에는 표층으로 올라가 먹이를 섭취하고, 낮에는 이 층으로 하강합니다. 산소 극소층(oxygen minimum zone)이 위치하며 생물발광이 처음 등장합니다.',
    stats: [
      { label: '광도',    value: '< 1% 표면'    },
      { label: '수온',    value: '4 – 15°C'     },
      { label: '수압',    value: '21 – 101 atm' },
    ],
    creatures: ['랜턴피시', '오징어류', '심해 새우', '해파리류', '수직이동 어류'],
  },
  {
    zone:      'BATHYPELAGIC ZONE · 무광층',
    depthRange:'1,000 – 4,000',
    unit:      'm  |  완전 암흑 · Midnight Zone',
    title:     '무광층 · Midnight Zone',
    desc:      '가시광선이 완전히 소멸하는 영구 암흑 구간입니다. 수온은 4°C 이하로 낮아지고 수압은 지표의 100배를 초과합니다. 생물들은 대부분 흑색·적색 체색을 띠며, 많은 종이 생물발광 기관(photophore)을 보유합니다. 먹이는 주로 상층에서 침강하는 해양 눈(marine snow)에 의존합니다.',
    stats: [
      { label: '광도',    value: '0 (완전 암흑)'  },
      { label: '수온',    value: '1 – 4°C'        },
      { label: '수압',    value: '101 – 408 atm'  },
    ],
    creatures: ['아귀류', '심해 오징어', '뱀파이어 오징어', '갈치류', '심해 꼬치고기'],
  },
  {
    zone:      'ABYSSOPELAGIC ZONE · 심해저층',
    depthRange:'4,000 – 6,000',
    unit:      'm  |  심해저 · Abyssal Zone',
    title:     '심해저층 · Abyssal Zone',
    desc:      '전체 해저 면적의 약 83%를 차지하는 평균적인 심해 구간입니다. 퇴적물이 두껍게 쌓인 심해저 평원(abyssal plain)이 펼쳐지며, 해양 눈 침강물과 유기 파편이 유일한 에너지원입니다. 열수공·냉수용출(cold seep)이 독립 생태계를 형성합니다.',
    stats: [
      { label: '광도',    value: '0'              },
      { label: '수온',    value: '1.5 – 3°C'      },
      { label: '수압',    value: '408 – 612 atm'  },
    ],
    creatures: ['불가사리류', '해삼류', '다모류', '크세노피오포어', '심해 가오리'],
  },
  {
    zone:      'HADOPELAGIC ZONE · 초심해층',
    depthRange:'6,000 – 8,000',
    unit:      'm  |  해구 전용 · Hadal Zone',
    title:     '초심해층 · Hadal Zone',
    desc:      '해구(trench)에서만 나타나는 가장 극단적인 층입니다. 전 해양 면적의 0.18%에 불과하지만 독자적인 생태 지역으로 분류됩니다. 이 구간의 생물은 고압 환경에서 막 유동성을 유지하기 위해 세포막 내 불포화 지방산 비율을 극대화하는 피에조적응(piezoadaptation)을 보입니다.',
    stats: [
      { label: '광도',    value: '0'              },
      { label: '수온',    value: '1 – 2°C'        },
      { label: '수압',    value: '612 – 816 atm'  },
    ],
    creatures: ['심해 등각류', '단각류(Amphipoda)', '다모류', '선형동물', '원생생물'],
  },
  {
    zone:      'TRENCH ZONE · 해구 심부',
    depthRange:'8,000 – 11,000',
    unit:      'm  |  마리아나 해구 전용 구간',
    title:     '해구 심부 · Deep Trench',
    desc:      '마리아나 해구 고유의 극심층 구간입니다. 수압은 800기압을 초과하며 단백질·지질·DNA의 구조적 안정성이 극도로 위협받는 환경입니다. 그럼에도 단각류 갑각류(Hirondellea gigas)가 대량 서식하며 유기 퇴적물을 분해합니다. 2019년 이 구간에서 마이크로플라스틱 오염이 확인되었습니다.',
    stats: [
      { label: '광도',    value: '0'               },
      { label: '수온',    value: '1 – 2°C'         },
      { label: '수압',    value: '816 – 1,087 atm' },
    ],
    creatures: ['Hirondellea gigas', 'Pseudoliparis swirei', '박테리아 매트', '심해 다모류'],
  },
  {
    zone:      'CHALLENGER DEEP · 챌린저 딥',
    depthRange:'11,034',
    unit:      'm  |  지구 표면 최저점',
    title:     "챌린저 딥 · Earth's Deepest Point",
    desc:      '북위 11°22′, 동경 142°35′ 인근에 위치한 지구 표면의 최저점입니다. 1875년 HMS 챌린저호가 처음 발견한 이래, 2019년 DSV 리미팅 팩터(Limiting Factor)가 10,928m를 기록하며 현행 최심 잠항 기록을 보유하고 있습니다. 저면은 박테리아·단각류가 서식하는 두꺼운 점토질 퇴적층으로 덮여 있으며, 놀랍게도 마이크로플라스틱 오염이 검출되었습니다.',
    stats: [
      { label: '확인 수심', value: '11,034m'       },
      { label: '수압',      value: '≈ 1,086 atm'   },
      { label: '수온',      value: '약 1°C'         },
    ],
    creatures: ['단각류 갑각류', '황산 환원 박테리아', '심해 원생생물', '마이크로플라스틱(오염)'],
  },
];

// 수심 바 마커 위치 (%)
const MARKER_POS = [2, 16, 32, 52, 70, 84, 97];

(function initDepthInteractive() {
  const panel    = document.getElementById('depthDetailPanel');
  const buttons  = document.querySelectorAll('.dl-btn');
  const markers  = document.querySelectorAll('.depth-marker');
  const markerDots = document.querySelectorAll('.marker-dot');
  const barFill  = document.getElementById('depthBar');

  if (!panel) return;

  /** 패널 HTML 빌드 */
  function buildPanel(d) {
    const statsHTML = d.stats.map(s => `
      <div class="ddp-stat">
        <div class="ddp-stat-label">${s.label}</div>
        <div class="ddp-stat-value">${s.value}</div>
      </div>`).join('');

    const tagsHTML = d.creatures.map(c =>
      `<span class="ddp-creature-tag">${c}</span>`
    ).join('');

    return `
      <div class="ddp-zone">${d.zone}</div>
      <div class="ddp-depth">${d.depthRange}</div>
      <div class="ddp-depth-unit">${d.unit}</div>
      <div class="ddp-title">${d.title}</div>
      <p class="ddp-desc">${d.desc}</p>
      <div class="ddp-stats">${statsHTML}</div>
      <div class="ddp-creatures">
        <div class="ddp-creatures-label">이 구간의 주요 생물군</div>
        <div class="ddp-creature-list">${tagsHTML}</div>
      </div>`;
  }

  /** 레이어 활성화 */
  function activate(idx) {
    // 버튼
    buttons.forEach((b, i) => b.classList.toggle('active', i === idx));
    // 마커 dot
    markerDots.forEach((d, i) => d.classList.toggle('active', i === idx));
    markers.forEach((m, i) => m.classList.toggle('active', i === idx));
    // 바 fill
    if (barFill) barFill.style.height = MARKER_POS[idx] + '%';
    // 패널
    panel.innerHTML = buildPanel(LAYER_DATA[idx]);
    panel.classList.remove('ddp-fade-in');
    void panel.offsetWidth; // reflow
    panel.classList.add('ddp-fade-in');
  }

  // 버튼 클릭
  buttons.forEach((btn, i) => btn.addEventListener('click', () => activate(i)));
  // 마커 클릭
  markers.forEach((m, i) => m.addEventListener('click', () => activate(i)));

  // 초기 렌더
  activate(0);

  // 수심 바 진입 시 fill 시작
  if (barFill) {
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          barFill.style.height = MARKER_POS[0] + '%';
          obs.unobserve(e.target);
        }
      });
    }, { threshold: 0.3 });
    obs.observe(barFill.parentElement);
  }
})();


/* ================================================================
   5. 압력 게이지 애니메이션
   ================================================================ */
(function initPressureGauge() {
  const arc    = document.getElementById('pressureArc');
  const needle = document.getElementById('pressureNeedle');
  if (!arc) return;

  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        let prog = 0;
        const total = 879;
        const interval = setInterval(() => {
          prog += total / 120;
          if (prog >= total) { prog = total; clearInterval(interval); }
          arc.setAttribute('stroke-dasharray', `${prog} ${total}`);
          const deg = -180 + (prog / total) * 360;
          needle.setAttribute('transform', `rotate(${deg} 200 200)`);
        }, 16);
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.3 });
  obs.observe(arc);
})();


/* ================================================================
   6. 숫자 카운터 애니메이션
   ================================================================ */
(function initCounters() {
  const els = document.querySelectorAll('.data-value[data-target]');
  if (!els.length) return;

  function animCounter(el, target, duration = 1800) {
    const start = performance.now();
    function update(now) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const cur = Math.floor(eased * target);
      el.textContent = cur.toLocaleString('ko-KR');
      if (t < 1) requestAnimationFrame(update);
      else el.textContent = target.toLocaleString('ko-KR');
    }
    requestAnimationFrame(update);
  }

  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        animCounter(e.target, parseInt(e.target.dataset.target, 10));
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.4 });

  els.forEach(el => obs.observe(el));
})();


/* ================================================================
   7. 스크롤 Reveal
   ================================================================ */
(function initReveal() {
  /* 일반 reveal */
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
})();


/* ================================================================
   7-b. 새 타임라인 — 지그재그 등장 + 수심 바 + 중앙선 채움
   ================================================================ */
(function initTimeline() {

  const MAX_DEPTH = 11034;
  const BAR_MAX_PX = 160; /* 수심 바 최대 너비 px */

  /* 중앙 수직선 fill */
  const lineFill = document.getElementById('tlLineFill');

  /* 아이템별 등장 + 바 애니메이션 */
  const items = document.querySelectorAll('.tl-item');
  if (!items.length) return;

  /* 중앙선 높이를 visible 아이템 수에 비례해 늘림 */
  function updateLine() {
    if (!lineFill) return;
    const total   = items.length;
    const visible = document.querySelectorAll('.tl-item.visible').length;
    const pct     = (visible / total) * 100;
    lineFill.style.height = pct + '%';
  }

  const tlObs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const item  = e.target;
      const depth = parseInt(item.dataset.depth, 10) || 0;
      const bar   = item.querySelector('.tl-depth-bar');

      /* 아이템 등장 */
      item.classList.add('visible');

      /* 수심 바 너비 계산 & 애니메이션 */
      if (bar) {
        const w = Math.round((depth / MAX_DEPTH) * BAR_MAX_PX);
        /* 약간 딜레이 후 확장 */
        setTimeout(() => { bar.style.width = w + 'px'; }, 200);
      }

      updateLine();
      tlObs.unobserve(item);
    });
  }, { threshold: 0.25 });

  items.forEach(el => tlObs.observe(el));

})();



/* ================================================================
   9. 배경 이미지 스크롤 패럴랙스
   ================================================================ */
(function initBgParallax() {
  const SPEED = 0.35; // 0~1, 낮을수록 느리게 내려감

  function update() {
    const scrollY   = window.scrollY;
    const maxScroll = document.body.scrollHeight - window.innerHeight;
    const pct       = maxScroll > 0 ? scrollY / maxScroll : 0;
    // 이미지 top 위치를 0% → SPEED*100% 범위로 이동
    const bgY = pct * SPEED * 100;
    document.body.style.backgroundPositionY = bgY + '%';
  }

  window.addEventListener('scroll', update, { passive: true });
  update();
})();

(function initNav() {
  const counter = document.getElementById('depthCounter');
  const nav     = document.getElementById('mainNav');
  const maxDepth = 11034;

  window.addEventListener('scroll', () => {
    const scrollPct = window.scrollY / (document.body.scrollHeight - window.innerHeight);
    const depth = Math.floor(scrollPct * maxDepth);
    if (counter) counter.textContent = depth.toLocaleString('ko-KR');
    if (nav) nav.classList.toggle('scrolled', window.scrollY > 60);
  });
})();