/* ================= Hero character — turns to look at your cursor =================
   heads.webp holds seven aligned head renders (looking from the visitor's left to
   their right), drawn over body.webp. The head rests on one render and sweeps
   through the in-between angles as the cursor moves, with only a brief blend at
   each switch, plus a nod, tilt, breathing and lean. */
(function () {
  const stage = document.getElementById('avatarStage');
  if (!stage) return;
  const canvas = stage.querySelector('canvas'), bubble = document.getElementById('avatarBubble');
  const hero = document.getElementById('hero'), root = document.documentElement;
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const approach = (dt, tau) => (RM ? 1 : 1 - Math.exp(-dt / tau));

  const FRAMES = 7, MID = (FRAMES - 1) / 2;
  // in the 688×960 body image (pixels)
  const AV = { size: [688, 960], cell: [312, 435], at: [189, 49], neck: [345, 470] };

  /* ---------- behaviour ---------- */
  const st = { tx: 0, ty: 0, side: 'center', frame: MID, target: MID, pitch: 0, lean: 0, last: 0 };
  let lastMove = 0, centerSince = 0, heroVisible = true, zone = '', zoneSide = '';
  const LINES = {
    start: FINE ? 'move your cursor — I’ll follow it' : 'watch me look around',
    left: 'someone over on the left?',
    right: 'oh — someone on the right!',
    near: 'closer… right to the middle',
    greet: 'hey, caught you! 👋 scroll to see my work',
    idle: 'still there? I’m watching 👀'
  };
  function say(key, side) {
    side = side || '';
    if (zone === key && zoneSide === side) return;
    zone = key; zoneSide = side;
    bubble.textContent = LINES[key];
    bubble.classList.toggle('right', side === 'right');
    bubble.classList.remove('pop'); void bubble.offsetWidth; bubble.classList.add('pop');
  }
  say('start');

  function aimAt(x, y) {
    const r = canvas.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height * 0.3;
    st.tx = clamp((x - cx) / (innerWidth * 0.4), -1, 1);
    st.ty = clamp((y - cy) / (innerHeight * 0.5), -1, 1);
    lastMove = performance.now();
  }
  if (FINE) addEventListener('pointermove', e => { if (heroVisible) aimAt(e.clientX, e.clientY); }, { passive: true });
  else hero.addEventListener('pointerdown', e => aimAt(e.clientX, e.clientY));
  new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting; }).observe(hero);

  function update(now) {
    const dt = st.last ? Math.min((now - st.last) / 1000, 0.25) : 0.016;
    st.last = now;
    const idleFor = now - lastMove;
    if (!FINE && idleFor > 2600) {
      // touch: a self-running tour — left, right, then a greeting
      const t = (now / 1000) % 9;
      st.tx = t < 3 ? -0.85 : t < 6 ? 0.85 : 0;
      st.ty = 0;
    } else if (FINE && lastMove && idleFor > 7000) {
      st.tx = Math.sin(now / 1600) * 0.3;
      st.ty = 0;
      say('idle');
    }

    // which side the visitor is on, with hysteresis so the bubble doesn't flicker
    const p = st.side;
    if (p !== 'left' && st.tx < -0.42) st.side = 'left';
    else if (p !== 'right' && st.tx > 0.42) st.side = 'right';
    else if (p === 'left' && st.tx > -0.3) st.side = 'center';
    else if (p === 'right' && st.tx < 0.3) st.side = 'center';

    const inCenter = Math.abs(st.tx) < 0.16 && (lastMove || !FINE);
    if (inCenter) { if (!centerSince) centerSince = now; } else centerSince = 0;
    const greeting = !!centerSince && now - centerSince > 700;

    if (greeting) say('greet');
    else if (lastMove && !(FINE && idleFor > 7000)) {
      if (st.side === 'left') say('left', 'left');
      else if (st.side === 'right') say('right', 'right');
      else say('near', st.tx > 0 ? 'right' : 'left');
    }

    // head angle: settle on the nearest render (hysteresis), sweeping through the ones between
    const want = clamp(MID + st.tx * MID * 1.15, 0, FRAMES - 1);
    if (Math.abs(want - st.target) > 0.62) st.target = Math.round(want);
    st.frame += (st.target - st.frame) * approach(dt, 0.09);
    if (Math.abs(st.target - st.frame) < 0.004) st.frame = st.target;

    // a little nod when greeting, and a slight chin lift/drop toward the cursor
    const nod = greeting ? Math.sin(now / 230) * Math.max(0, 1 - (now - centerSince - 700) / 1100) : 0;
    st.pitch += (clamp(st.ty, -1, 1) * 0.6 + nod - st.pitch) * approach(dt, 0.25);
    st.lean += (st.tx - st.lean) * approach(dt, 0.35);
  }

  /* ---------- renderer ---------- */
  function start(body, sheet) {
    const ctx = canvas.getContext('2d');
    const head = document.createElement('canvas'), hctx = head.getContext('2d');
    const [cw, ch] = AV.cell;
    let k = 1, last = '';
    const resize = () => {
      const r = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(r.width * dpr));
      canvas.height = Math.max(1, Math.round(r.height * dpr));
      k = canvas.width / AV.size[0];
      head.width = Math.ceil(cw * k);
      head.height = Math.ceil(ch * k);
      last = '';
    };
    resize();
    addEventListener('resize', resize);
    root.classList.add('avatar-on');

    (function frame(now) {
      requestAnimationFrame(frame);
      if (!heroVisible || document.hidden) return;
      update(now);

      const f = st.frame, i = Math.min(Math.floor(f), FRAMES - 2);
      // neighbouring renders only blend for an instant mid-switch, so no double image lingers
      let m = clamp((f - i - 0.35) / 0.3, 0, 1);
      m = m * m * (3 - 2 * m);
      const tilt = st.lean * -0.025 + st.pitch * 0.01;
      const dy = st.pitch * 5;
      const key = i + '|' + m.toFixed(3) + '|' + tilt.toFixed(4) + '|' + dy.toFixed(2) + '|' + canvas.width;
      if (key !== last) {
        last = key;
        // exact blend of two premultiplied images: (1-m)·A + m·B
        hctx.clearRect(0, 0, head.width, head.height);
        hctx.globalCompositeOperation = 'source-over';
        hctx.globalAlpha = 1 - m;
        hctx.drawImage(sheet, i * cw, 0, cw, ch, 0, 0, cw * k, ch * k);
        hctx.globalCompositeOperation = 'lighter';
        hctx.globalAlpha = m;
        hctx.drawImage(sheet, (i + 1) * cw, 0, cw, ch, 0, 0, cw * k, ch * k);
        hctx.globalCompositeOperation = 'source-over';
        hctx.globalAlpha = 1;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(body, 0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.translate(AV.neck[0] * k, AV.neck[1] * k);
        ctx.rotate(tilt);
        ctx.translate(-AV.neck[0] * k, -AV.neck[1] * k + dy * k);
        ctx.drawImage(head, AV.at[0] * k, AV.at[1] * k);
        ctx.restore();
      }
      if (!RM) {
        const b = Math.sin(now / 1150) * 0.005;
        canvas.style.transform = 'perspective(1200px) rotateY(' + (st.lean * 3) + 'deg) translateY(' + (b * -50) + 'px) scale(' + (1 + b * 0.6) + ',' + (1 + b) + ')';
      }
    })(performance.now());
  }

  const load = src => new Promise((ok, bad) => { const im = new Image(); im.onload = () => ok(im); im.onerror = bad; im.src = src; });
  Promise.all([load('body.webp?v=2'), load('heads.webp?v=2')])
    .then(([body, sheet]) => start(body, sheet))
    .catch(() => {
      // the still image stays; keep the bubble alive
      (function frame(now) { requestAnimationFrame(frame); if (heroVisible) update(now); })(performance.now());
    });
})();
