/* ================================================================
   terrain3d.js — 마리아나 해구 와이어프레임 v2
   ──────────────────────────────────────────────────────────────
   · 해구를 훨씬 깊고 좁게 모델링 (수직 절벽 느낌)
   · 하강 버튼: 카메라가 해구 내부 통로를 따라 실제로 내려감
   · 하강 경로: 표면 → 해구 입구 → 수직 하강 → 바닥 → 부상
   · 물결 인터랙션 유지
   · 30fps + 화면 밖 중단
   ================================================================ */

(function initTerrain3D() {

  if (typeof THREE === 'undefined') { setTimeout(initTerrain3D, 500); return; }

  const container = document.getElementById('terrain3d-canvas');
  if (!container) return;

  const W = container.clientWidth  || 800;
  const H = container.clientHeight || 520;

  /* ================================================================
     SCENE / CAMERA / RENDERER
     ================================================================ */
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x010810);
  scene.fog = new THREE.FogExp2(0x010810, 0.014);

  const camera = new THREE.PerspectiveCamera(62, W/H, 0.1, 600);
  camera.position.set(0, 38, 70);
  camera.lookAt(0, -4, 0);

  const renderer = new THREE.WebGLRenderer({ antialias:false, powerPreference:'low-power' });
  renderer.setSize(W, H);
  renderer.setPixelRatio(1);
  container.appendChild(renderer.domElement);

  window.addEventListener('resize', () => {
    const nw=container.clientWidth, nh=container.clientHeight;
    camera.aspect=nw/nh; camera.updateProjectionMatrix();
    renderer.setSize(nw, nh);
  });

  /* ================================================================
     PERLIN NOISE (fBm)
     ================================================================ */
  const _P = Array.from({length:256},(_,i)=>i).sort(()=>Math.random()-.5);
  const perm = [..._P,..._P];
  const fade = t => t*t*t*(t*(t*6-15)+10);
  const lerp = (a,b,t) => a+t*(b-a);
  const grad = (h,x,y) => { const u=h<2?x:y,v=h<2?y:x; return((h&1)?-u:u)+((h&2)?-v:v); };
  function noise2(x,y){
    const X=Math.floor(x)&255, Y=Math.floor(y)&255;
    x-=Math.floor(x); y-=Math.floor(y);
    const u=fade(x),v=fade(y),a=perm[X]+Y,b=perm[X+1]+Y;
    return lerp(lerp(grad(perm[a],x,y),grad(perm[b],x-1,y),u),
                lerp(grad(perm[a+1],x,y-1),grad(perm[b+1],x-1,y-1),u),v);
  }
  function fbm(x,y,oct=5){
    let v=0,amp=0.5,freq=1,mx=0;
    for(let i=0;i<oct;i++){ v+=noise2(x*freq,y*freq)*amp; mx+=amp; amp*=0.48; freq*=2.2; }
    return v/mx;
  }

  /* ================================================================
     지형 파라미터 — 훨씬 극적으로
     ================================================================ */
  const SEG          = 100;   // 더 세밀한 격자
  const SIZE         = 140;   // 더 넓은 지형
  const BASE_Y       = -2;
  const TERRAIN_AMP  = 10;    // 지형 굴곡 높이
  const TRENCH_DEEP  = 55;    // ★ 훨씬 깊은 해구 (이전 20 → 55)
  const TRENCH_W     = 4.5;   // 좁은 해구 폭
  const TRENCH_LEN   = 52;    // 해구 길이
  const CLIFF_SHARP  = 3.0;   // 절벽 날카로움 (높을수록 수직)

  const baseHeights  = new Float32Array((SEG+1)*(SEG+1));
  let   minY = Infinity, maxY = -Infinity;

  for(let iz=0;iz<=SEG;iz++){
    for(let ix=0;ix<=SEG;ix++){
      const wx = (ix/SEG - 0.5)*SIZE;
      const wz = (iz/SEG - 0.5)*SIZE;
      let y = fbm(wx*0.032, wz*0.032, 5)*TERRAIN_AMP + BASE_Y;

      /* 해구 — 가우시안보다 더 날카로운 프로파일 */
      if(Math.abs(wz) < TRENCH_LEN*0.5){
        const wFac = 1 - Math.pow(Math.abs(wz)/(TRENCH_LEN*0.5), 0.6);
        /* 날카로운 V자 + 평평한 바닥 */
        const dx   = Math.abs(wx);
        const trenchProfile =
          dx < TRENCH_W*0.3
            ? 1.0                                              // 바닥 (평평)
            : dx < TRENCH_W
              ? Math.pow(1-(dx-TRENCH_W*0.3)/(TRENCH_W*0.7), CLIFF_SHARP)  // 절벽
              : 0;

        y -= TRENCH_DEEP * trenchProfile * wFac;

        /* 챌린저 딥 — 중심에서 추가로 더 깊게 */
        if(Math.abs(wz) < 5 && dx < 2.0){
          const cdFac = (1-dx/2.0)*(1-Math.abs(wz)/5.0);
          y -= 12 * cdFac * cdFac;   // 이전보다 훨씬 깊게
        }
      }

      baseHeights[iz*(SEG+1)+ix] = y;
      if(y < minY) minY = y;
      if(y > maxY) maxY = y;
    }
  }

  /* ================================================================
     격자 라인 생성 (가로+세로, 대각선 없음)
     ================================================================ */
  const liveHeights = new Float32Array(baseHeights);

  function getH(ix,iz){ return liveHeights[iz*(SEG+1)+ix]; }
  function vx(ix){ return (ix/SEG - 0.5)*SIZE; }
  function vz(iz){ return (iz/SEG - 0.5)*SIZE; }

  const positions = [];
  const colorsArr = [];
  const vertMap   = [];  // 포지션 배열 인덱스 → (ix,iz)

  const cSurface = new THREE.Color(0x00e5ff);
  const cMid     = new THREE.Color(0x0044aa);
  const cDeep    = new THREE.Color(0x001133);
  const cTrench  = new THREE.Color(0x00ffd0);

  function depthColor(y){
    const t = (y - minY)/(maxY - minY);
    const c = new THREE.Color();
    if(t < 0.08)       c.lerpColors(cTrench, cDeep,    t/0.08);
    else if(t < 0.35)  c.lerpColors(cDeep,   cMid,     (t-0.08)/0.27);
    else               c.lerpColors(cMid,     cSurface, (t-0.35)/0.65);
    return c;
  }

  function pushVert(ix, iz){
    const y = getH(ix, iz);
    vertMap.push({ix, iz});
    positions.push(vx(ix), y, vz(iz));
    const c = depthColor(y);
    colorsArr.push(c.r, c.g, c.b);
  }

  /* 가로선 */
  for(let iz=0;iz<=SEG;iz++)
    for(let ix=0;ix<SEG;ix++){ pushVert(ix,iz); pushVert(ix+1,iz); }
  /* 세로선 */
  for(let ix=0;ix<=SEG;ix++)
    for(let iz=0;iz<SEG;iz++){ pushVert(ix,iz); pushVert(ix,iz+1); }

  const posArr = new Float32Array(positions);
  const colArr = new Float32Array(colorsArr);

  const geo     = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(posArr, 3);
  const colAttr = new THREE.BufferAttribute(colArr, 3);
  posAttr.setUsage(THREE.DynamicDrawUsage);
  colAttr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', posAttr);
  geo.setAttribute('color',    colAttr);

  const mat = new THREE.LineBasicMaterial({
    vertexColors: true, transparent:true, opacity:0.82,
  });
  const wireframe = new THREE.LineSegments(geo, mat);
  scene.add(wireframe);

  /* ================================================================
     챌린저 딥 마커 + 수직 빛기둥
     ================================================================ */
  const cdY = minY;

  /* 발광 구 */
  const cdMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.7, 10, 10),
    new THREE.MeshBasicMaterial({ color:0x00ffd0 })
  );
  cdMesh.position.set(0, cdY+0.6, 0);
  scene.add(cdMesh);

  /* 수직 빛기둥 — 해구 바닥에서 위로 */
  const beamGeo = new THREE.CylinderGeometry(0.15, 0.5, Math.abs(cdY)*0.7, 8, 1, true);
  const beamMat = new THREE.MeshBasicMaterial({
    color:0x00ffd0, transparent:true, opacity:0.06, side:THREE.DoubleSide,
  });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.position.set(0, cdY*0.35, 0);
  scene.add(beam);

  /* 링 */
  function makeRing(r, col, y=0){
    const pts=[];
    for(let i=0;i<=64;i++){const a=(i/64)*Math.PI*2; pts.push(Math.cos(a)*r,0,Math.sin(a)*r);}
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts),3));
    const m = new THREE.LineLoop(g, new THREE.LineBasicMaterial({color:col,transparent:true,opacity:0.65}));
    m.position.set(0, cdY+y, 0);
    return m;
  }
  const ring1 = makeRing(1.5, 0x00ffd0, 0.6);
  const ring2 = makeRing(2.8, 0x00d4ff, 0.6);
  scene.add(ring1, ring2);

  /* 라벨 스프라이트 */
  const lc = document.createElement('canvas');
  lc.width=512; lc.height=96;
  const lctx = lc.getContext('2d');
  lctx.font='bold 26px monospace'; lctx.fillStyle='#00ffd0'; lctx.textAlign='center';
  lctx.fillText('CHALLENGER DEEP · 11,034m',256,36);
  lctx.font='16px monospace'; lctx.fillStyle='#6ba8c8';
  lctx.fillText('1,086 atm  ·  약 1°C',256,64);
  const lSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map:new THREE.CanvasTexture(lc), transparent:true }));
  lSprite.scale.set(16, 3, 1);
  lSprite.position.set(0, cdY+7, 0);
  scene.add(lSprite);

  /* ================================================================
     물결 시스템
     ================================================================ */
  const ripples = [];

  function addRipple(wx, wz, strength=1.2){
    ripples.push({ wx, wz, t:0, strength, maxT:1.8 });
    if(ripples.length > 6) ripples.shift();
  }

  const raycaster   = new THREE.Raycaster();
  const mouse2D     = new THREE.Vector2(-9999,-9999);
  const groundPlane = new THREE.Plane(new THREE.Vector3(0,1,0), 2);
  const intersectPt = new THREE.Vector3();
  let mouseWX=0, mouseWZ=0, mouseOnCanvas=false;

  function updateMouseWorld(e){
    const rect = renderer.domElement.getBoundingClientRect();
    mouse2D.x =  ((e.clientX-rect.left)/rect.width )*2-1;
    mouse2D.y = -((e.clientY-rect.top) /rect.height)*2+1;
    raycaster.setFromCamera(mouse2D, camera);
    raycaster.ray.intersectPlane(groundPlane, intersectPt);
    const inv = new THREE.Matrix4().copy(wireframe.matrixWorld).invert();
    const loc = intersectPt.clone().applyMatrix4(inv);
    mouseWX = loc.x; mouseWZ = loc.z;
  }

  const el = renderer.domElement;
  el.addEventListener('mousemove', e=>{ mouseOnCanvas=true; updateMouseWorld(e); });
  el.addEventListener('mouseleave',()=>{ mouseOnCanvas=false; });
  el.addEventListener('click', e=>{ updateMouseWorld(e); addRipple(mouseWX, mouseWZ, 1.8); });

  /* ================================================================
     높이 업데이트 (물결 적용)
     ================================================================ */
  const tmpColor = new THREE.Color();

  function updateHeights(time){
    for(let iz=0;iz<=SEG;iz++){
      for(let ix=0;ix<=SEG;ix++){
        const wx=vx(ix), wz=vz(iz);
        const base = baseHeights[iz*(SEG+1)+ix];
        let dy=0;

        /* 호버 물결 */
        if(mouseOnCanvas){
          const dx=wx-mouseWX, dz=wz-mouseWZ;
          const dist=Math.sqrt(dx*dx+dz*dz);
          if(dist<22){
            const n=dist/22;
            dy += Math.sin(n*Math.PI*3-time*4)*Math.exp(-n*2.5)*1.6*(1-n);
          }
        }
        /* 클릭 파문 */
        for(const r of ripples){
          const dx=wx-r.wx, dz=wz-r.wz;
          const dist=Math.sqrt(dx*dx+dz*dz);
          const front=r.t*26, width=9;
          const diff=dist-front;
          if(Math.abs(diff)<width){
            dy += Math.cos(diff/width*Math.PI)*r.strength*3.0*Math.exp(-r.t*1.1);
          }
        }
        liveHeights[iz*(SEG+1)+ix] = base+dy;
      }
    }

    const pa=posAttr.array, ca=colAttr.array;
    for(let vi=0;vi<vertMap.length;vi++){
      const {ix,iz}=vertMap[vi];
      const y=liveHeights[iz*(SEG+1)+ix];
      pa[vi*3+1]=y;
      const base=baseHeights[iz*(SEG+1)+ix];
      const delta=y-base;
      if(Math.abs(delta)>0.06){
        tmpColor.copy(depthColor(base));
        tmpColor.lerp(new THREE.Color(0x00ffd0), Math.min(Math.abs(delta)/4,1)*0.75);
        ca[vi*3]=tmpColor.r; ca[vi*3+1]=tmpColor.g; ca[vi*3+2]=tmpColor.b;
      } else {
        const c=depthColor(base);
        ca[vi*3]=c.r; ca[vi*3+1]=c.g; ca[vi*3+2]=c.b;
      }
    }
    posAttr.needsUpdate=true;
    colAttr.needsUpdate=true;
  }

  /* ================================================================
     ★ 하강 카메라 경로 (핵심 개선)
     카메라가 실제로 해구 내부로 내려가는 경로
     ================================================================ */
  const trenchFloor = cdY + 1.5;   // 바닥 Y

  // 카메라 경로 웨이포인트 [position, lookAt]
  const DIVE_PATH = [
    // 0: 시작 (수면 위 조감)
    { pos: new THREE.Vector3(0, 38, 70),  look: new THREE.Vector3(0, -4, 0)  },
    // 1: 해구 상공 (기울여서 내려다봄)
    { pos: new THREE.Vector3(0, 22, 20),  look: new THREE.Vector3(0, -8, 0)  },
    // 2: 해구 입구 진입
    { pos: new THREE.Vector3(0, 2,  8),   look: new THREE.Vector3(0, -15, 0) },
    // 3: 수직 하강 중 (해구 벽이 양옆)
    { pos: new THREE.Vector3(0, trenchFloor*0.35, 3), look: new THREE.Vector3(0, trenchFloor*0.6, 0) },
    // 4: 챌린저 딥 바닥 도달
    { pos: new THREE.Vector3(0, trenchFloor+3, 2),    look: new THREE.Vector3(0, trenchFloor, 0)     },
    // 5: 바닥에서 수평 탐색
    { pos: new THREE.Vector3(2, trenchFloor+2.5, 4),  look: new THREE.Vector3(0, trenchFloor, 0)     },
    // 6: 부상 시작
    { pos: new THREE.Vector3(0, 2, 8),    look: new THREE.Vector3(0, -4, 0)  },
    // 7: 수면 복귀
    { pos: new THREE.Vector3(0, 38, 70),  look: new THREE.Vector3(0, -4, 0)  },
  ];

  const DIVE_LABELS = [
    '',
    '해구 진입 중…',
    '수심 200m — 빛이 사라집니다',
    '수심 5,000m — 완전한 암흑',
    '수심 11,034m — 챌린저 딥 도달',
    '지구 최심부 탐색 중',
    '부상 시작…',
    '',
  ];

  let isDiving   = false;
  let diveT      = 0;        // 0~1 전체 진행도
  let diveSegIdx = 0;        // 현재 구간 인덱스
  let diveSegT   = 0;        // 구간 내 진행도 0~1

  /* 구간별 소요 시간 (합 = 1) */
  const SEG_DURATION = [0.1, 0.12, 0.15, 0.22, 0.12, 0.1, 0.1, 0.09];

  /* ================================================================
     드래그 회전 / 줌
     ================================================================ */
  let drag=false, prevMX=0;
  let rotY=0, targetRotY=0;
  let camDist=70, targetDist=70;

  el.style.cursor='grab';
  el.addEventListener('mousedown', e=>{ drag=true; prevMX=e.clientX; el.style.cursor='crosshair'; });
  window.addEventListener('mouseup',()=>{ drag=false; el.style.cursor='grab'; });
  window.addEventListener('mousemove', e=>{ if(!drag)return; targetRotY+=(e.clientX-prevMX)*0.007; prevMX=e.clientX; });
  el.addEventListener('wheel', e=>{ targetDist=Math.max(25,Math.min(130,targetDist+e.deltaY*0.06)); e.preventDefault(); },{passive:false});

  let prevTX=0;
  el.addEventListener('touchstart', e=>{ prevTX=e.touches[0].clientX; },{passive:true});
  el.addEventListener('touchmove',  e=>{ targetRotY+=(e.touches[0].clientX-prevTX)*0.007; prevTX=e.touches[0].clientX; e.preventDefault(); },{passive:false});

  /* ================================================================
     버튼 제어
     ================================================================ */
  const diveBtn  = document.getElementById('terrain-dive-btn');
  const wireBtn  = document.getElementById('terrain-wire-btn');
  const resetBtn = document.getElementById('terrain-reset-btn');

  /* 수심 표시 레이블 */
  let depthLabel = document.getElementById('terrain-depth-label');
  if(!depthLabel){
    depthLabel = document.createElement('div');
    depthLabel.id = 'terrain-depth-label';
    depthLabel.style.cssText = `
      position:absolute; bottom:24px; left:50%; transform:translateX(-50%);
      font-family:'Source Code Pro',monospace; font-size:11px;
      letter-spacing:3px; color:#00ffd0; pointer-events:none;
      text-shadow:0 0 12px #00ffd0; opacity:0;
      transition:opacity .5s;
    `;
    container.style.position='relative';
    container.appendChild(depthLabel);
  }

  function startDive(){
    if(isDiving) return;
    isDiving=true; diveT=0; diveSegIdx=0; diveSegT=0;
    if(diveBtn){ diveBtn.textContent='하강 중…'; diveBtn.disabled=true; }
    depthLabel.style.opacity='1';
  }

  if(diveBtn)  diveBtn.addEventListener('click', startDive);
  if(wireBtn)  wireBtn.addEventListener('click', ()=>{
    mat.opacity = mat.opacity>0.4 ? 0.18 : 0.82;
    wireBtn.textContent = mat.opacity>0.4 ? '와이어 OFF' : '와이어 ON';
  });
  if(resetBtn) resetBtn.addEventListener('click', ()=>{
    targetRotY=0; targetDist=70; isDiving=false;
    diveSegIdx=0; diveSegT=0; ripples.length=0;
    camera.position.copy(DIVE_PATH[0].pos);
    camera.lookAt(DIVE_PATH[0].look);
    depthLabel.style.opacity='0';
    if(diveBtn){ diveBtn.textContent='챌린저 딥 하강'; diveBtn.disabled=false; }
  });

  /* ================================================================
     가시성 + 30fps
     ================================================================ */
  let isVisible=false;
  const section=document.getElementById('terrain3d');
  if(section) new IntersectionObserver(e=>{ isVisible=e[0].isIntersecting; },{threshold:0.05}).observe(section);

  let lastFrame=0;
  const INTERVAL=1000/30;

  /* ================================================================
     이징
     ================================================================ */
  function easeInOut(t){ return t<0.5 ? 2*t*t : -1+(4-2*t)*t; }
  function easeCubic(t){ return t*t*(3-2*t); }
  function easeInCubic(t){ return t*t*t; }

  /* ================================================================
     애니메이션 루프
     ================================================================ */
  let time=0;

  function animate(now){
    requestAnimationFrame(animate);
    if(!isVisible) return;
    if(now-lastFrame<INTERVAL) return;
    const dt=(now-lastFrame)/1000;
    lastFrame=now;
    time+=dt;

    /* 파문 시간 진행 */
    for(let i=ripples.length-1;i>=0;i--){
      ripples[i].t+=dt;
      if(ripples[i].t>ripples[i].maxT) ripples.splice(i,1);
    }

    /* 높이 업데이트 */
    updateHeights(time);

    /* 챌린저 딥 발광 펄스 */
    const p=0.55+0.45*Math.sin(time*2.4);
    ring1.material.opacity = 0.3+0.5*p;
    ring2.material.opacity = 0.2+0.4*(1-p);
    ring1.scale.setScalar(1+0.3*Math.sin(time*1.8));
    ring2.scale.setScalar(1+0.3*Math.sin(time*1.8+Math.PI));
    cdMesh.material.color.setHSL(0.48, 1.0, 0.35+0.2*p);
    beam.material.opacity = 0.04+0.04*p;

    /* ── 카메라 제어 ─────────────────────────────────────── */
    if(!isDiving){
      /* 자동 회전 + 드래그 */
      if(!drag) targetRotY+=0.0018;
      rotY    +=(targetRotY-rotY)*0.07;
      camDist +=(targetDist-camDist)*0.07;

      wireframe.rotation.y = ring1.rotation.y = ring2.rotation.y = cdMesh.rotation.y = rotY;

      camera.position.set(
        Math.sin(rotY)*camDist,
        28,
        Math.cos(rotY)*camDist
      );
      camera.lookAt(0, -2, 0);

    } else {
      /* ── 하강 애니메이션 ───────────────────────────────── */
      const segDur = SEG_DURATION[diveSegIdx] || 0.1;
      diveSegT += dt / (segDur * 9.0);  // 전체 약 9초

      if(diveSegT >= 1){
        diveSegT = 0;
        diveSegIdx++;

        if(diveSegIdx >= DIVE_PATH.length - 1){
          /* 완료 */
          isDiving=false; diveSegIdx=0;
          camera.position.copy(DIVE_PATH[0].pos);
          camera.lookAt(DIVE_PATH[0].look);
          depthLabel.style.opacity='0';
          if(diveBtn){ diveBtn.textContent='챌린저 딥 하강'; diveBtn.disabled=false; }
          return;
        }
      }

      /* 두 웨이포인트 사이 보간 */
      const from = DIVE_PATH[diveSegIdx];
      const to   = DIVE_PATH[diveSegIdx+1];

      /* 구간 성격에 따라 이징 선택 */
      let et;
      if(diveSegIdx===2||diveSegIdx===3) et = easeInCubic(diveSegT); // 하강 시 가속
      else if(diveSegIdx===5||diveSegIdx===6) et = easeInOut(diveSegT); // 부상 시 부드럽게
      else et = easeCubic(diveSegT);

      camera.position.lerpVectors(from.pos, to.pos, et);

      /* lookAt도 보간 */
      const lookPos = new THREE.Vector3().lerpVectors(from.look, to.look, et);
      camera.lookAt(lookPos);

      /* 수심 레이블 업데이트 */
      if(DIVE_LABELS[diveSegIdx]){
        const depthM = Math.round(
          (diveSegIdx<4 ? diveSegIdx/3 : (7-diveSegIdx)/3) * 11034
        );
        depthLabel.textContent = `${DIVE_LABELS[diveSegIdx]}`;
      }

      /* 깊이 따라 와이어 색상 변화 (더 깊어질수록 민트 강해짐) */
      const depthRatio = clamp01((-camera.position.y) / Math.abs(trenchFloor));
      mat.opacity = 0.55 + depthRatio * 0.4;
    }

    renderer.render(scene, camera);
  }

  function clamp01(v){ return Math.max(0,Math.min(1,v)); }

  requestAnimationFrame(animate);

})();