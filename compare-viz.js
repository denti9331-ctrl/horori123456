(function(){
  const canvas = document.getElementById('compare-canvas');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');

  canvas.width  = 900;
  canvas.height = 520;

  const DATA = [
    { label:'에베레스트', sub:'Mt. Everest', val:8849,  dir:'up',   color:'#c8a96e', unit:'8,849m' },
    { label:'챌린저 딥',  sub:'Challenger Deep', val:11034, dir:'down', color:'#2eb8c8', unit:'11,034m' },
    { label:'후지산',     sub:'Mt. Fuji',    val:3776,  dir:'up',   color:'#7fa8be', unit:'3,776m' },
    { label:'그랜드캐니언',sub:'Grand Canyon',val:1857,  dir:'down', color:'#9b6be8', unit:'1,857m' },
  ];

  const MAX = 12000;
  let progress = 0;
  let animating = false;

  function ease(t){ return t<0.5 ? 2*t*t : -1+(4-2*t)*t; }

  function draw(p){
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0,0,W,H);

    /* 배경 */
    const bg = ctx.createLinearGradient(0,0,0,H);
    bg.addColorStop(0,'#020c14');
    bg.addColorStop(1,'#000508');
    ctx.fillStyle = bg;
    ctx.fillRect(0,0,W,H);

    /* 해수면 */
    const seaY = H * 0.4;
    ctx.save();
    ctx.strokeStyle = 'rgba(46,184,200,0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([8,6]);
    ctx.beginPath(); ctx.moveTo(40,seaY); ctx.lineTo(W-40,seaY); ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = '10px "Source Code Pro",monospace';
    ctx.fillStyle = 'rgba(46,184,200,0.5)';
    ctx.textAlign = 'center';
    ctx.fillText('── 해수면 · Sea Level ──', W/2, seaY-10);
    ctx.restore();

    /* 막대 */
    const colW = (W-80) / DATA.length;

    DATA.forEach((d,i)=>{
      const cx = 40 + colW*i + colW/2;
      const barW = colW * 0.38;
      const maxH = H * 0.52;
      const barH = maxH * (d.val/MAX) * ease(p);

      const startY = seaY;
      const endY   = d.dir==='up' ? seaY - barH : seaY + barH;

      /* 막대 그라디언트 */
      const grad = ctx.createLinearGradient(cx,startY,cx,endY);
      grad.addColorStop(0, d.color+'88');
      grad.addColorStop(1, d.color+'ff');

      ctx.save();
      ctx.shadowColor = d.color;
      ctx.shadowBlur  = 12;
      ctx.fillStyle   = grad;
      ctx.fillRect(cx-barW/2, Math.min(startY,endY), barW, barH);
      ctx.restore();

      /* 라벨 */
      const labelY = d.dir==='up' ? endY-16 : endY+20;
      ctx.save();
      ctx.font = 'bold 11px "Source Code Pro",monospace';
      ctx.fillStyle = d.color;
      ctx.textAlign = 'center';
      ctx.fillText(d.unit, cx, labelY);
      ctx.font = '12px "Raleway",sans-serif';
      ctx.fillStyle = '#c8dde8';
      ctx.fillText(d.label, cx, seaY + (d.dir==='up' ? 20 : -8));
      ctx.font = '9px "Source Code Pro",monospace';
      ctx.fillStyle = '#3d6678';
      ctx.fillText(d.sub, cx, seaY + (d.dir==='up' ? 34 : -22));
      ctx.restore();
    });
  }

  /* 즉시 배경 그리기 */
  draw(0);

  /* 섹션 진입시 애니메이션 */
  function start(){
    if(animating) return;
    animating = true;
    progress  = 0;
    const t0  = performance.now();
    const dur = 1600;
    function frame(now){
      progress = Math.min((now-t0)/dur, 1);
      draw(progress);
      if(progress < 1) requestAnimationFrame(frame);
      else animating = false;
    }
    requestAnimationFrame(frame);
  }

  const section = document.getElementById('compare');
  if(section){
    new IntersectionObserver(e=>{
      if(e[0].isIntersecting){
        /* 크기 다시 맞추고 시작 */
        const wrap = canvas.parentElement;
        if(wrap){
          const r = wrap.getBoundingClientRect();
          if(r.width>0)  canvas.width  = r.width;
          if(r.height>0) canvas.height = r.height;
        }
        start();
      }
    },{threshold:0.01}).observe(section);
  }

  window.addEventListener('resize',()=>{
    const wrap = canvas.parentElement;
    if(wrap){
      const r = wrap.getBoundingClientRect();
      if(r.width>0)  canvas.width  = r.width;
      if(r.height>0) canvas.height = r.height;
    }
    draw(progress);
  });
})();
