/* ============================================================
   Farrukh Aftab Ahmed — Portfolio v3
   A 3D avatar at a laptop that follows the visitor's cursor.

   Seven head renders (a turnaround from left to right) sit on the
   laptop body; the head blends between neighbouring angles as the
   cursor moves, with a nod, tilt, breathing and lean for life.
   ============================================================ */
(() => {
'use strict';

const root = document.documentElement;
const hasG = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

$('#year').textContent = new Date().getFullYear();

/* ─── Nav ─── */
const nav = $('#nav'), menuBtn = $('#menuBtn');
const setMenu = open => {
    root.classList.toggle('menu-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
};
menuBtn.addEventListener('click', () => setMenu(!root.classList.contains('menu-open')));
$$('.menu a').forEach(a => a.addEventListener('click', () => setMenu(false)));
document.addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });
window.addEventListener('scroll', () => nav.classList.toggle('scrolled', window.scrollY > 20), { passive: true });

/* ─── Cursor dot ─── */
const dot = $('#cursorDot');
if (FINE) {
    root.classList.add('has-cursor');
    window.addEventListener('pointermove', e => { dot.style.transform = `translate3d(${e.clientX}px,${e.clientY}px,0)`; }, { passive: true });
    document.addEventListener('pointerover', e => dot.classList.toggle('big', !!e.target.closest('a,button')));
}

/* ═══════════════════════════════════════════════════════════
   BEHAVIOUR — where the avatar looks, and what it says
   ═══════════════════════════════════════════════════════════ */
const hero = $('#top'), stage = $('#stage'), bubble = $('#bubble'), explore = $('#explore');
const st = {
    tx: 0, ty: 0,                // cursor target, -1..1 around the avatar's head
    pose: 'center',              // visitor side: 'left' | 'center' | 'right'
    frame: 3, target: 3,         // head angle along the turnaround, 0..6
    pitch: 0, lean: 0, last: 0
};
// frame-rate independent easing: fraction of the way to the target after dt seconds
const approach = (dt, tau) => (RM ? 1 : 1 - Math.exp(-dt / tau));
let lastMove = 0, centerSince = 0, heroVisible = true, zone = '', zoneSide = '';

const LINES = {
    start: FINE ? "Move your cursor — I'll follow it." : "Tap left or right — I'll look.",
    left: 'Anyone over here on the left?',
    right: 'Oh — someone on the right!',
    near: 'Closer… right to the middle.',
    greet: "Hey, caught you! 👋 Let me show you what I build.",
    idle: 'Still there? Move around — I’m watching.'
};
function say(key, side = '') {
    if (zone === key && zoneSide === side) return;
    zone = key; zoneSide = side;
    bubble.textContent = LINES[key];
    bubble.classList.toggle('right', side === 'right');
    bubble.classList.remove('pop'); void bubble.offsetWidth; bubble.classList.add('pop');
}
say('start');

function aimAt(x, y) {
    const r = stage.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height * 0.3;
    st.tx = clamp((x - cx) / (window.innerWidth * 0.4), -1, 1);
    st.ty = clamp((y - cy) / (window.innerHeight * 0.5), -1, 1);
    lastMove = performance.now();
}
if (FINE) window.addEventListener('pointermove', e => { if (heroVisible) aimAt(e.clientX, e.clientY); }, { passive: true });
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
    const p = st.pose;
    if (p !== 'left' && st.tx < -0.42) st.pose = 'left';
    else if (p !== 'right' && st.tx > 0.42) st.pose = 'right';
    else if (p === 'left' && st.tx > -0.3) st.pose = 'center';
    else if (p === 'right' && st.tx < 0.3) st.pose = 'center';

    const inCenter = Math.abs(st.tx) < 0.16 && (lastMove || !FINE);
    if (inCenter) { if (!centerSince) centerSince = now; } else centerSince = 0;
    const greeting = !!centerSince && now - centerSince > 700;
    explore.classList.toggle('show', greeting);

    if (greeting) say('greet');
    else if (lastMove && !(FINE && idleFor > 7000)) {
        if (st.pose === 'left') say('left', 'left');
        else if (st.pose === 'right') say('right', 'right');
        else say('near', st.tx > 0 ? 'right' : 'left');
    }

    // head angle: settle on the nearest of the 7 renders (with hysteresis so it
    // doesn't flicker on a boundary), sweeping through the ones in between
    const want = clamp(MID + st.tx * MID * 1.15, 0, FRAMES - 1);
    if (Math.abs(want - st.target) > 0.62) st.target = Math.round(want);
    st.frame += (st.target - st.frame) * approach(dt, 0.09);
    if (Math.abs(st.target - st.frame) < 0.004) st.frame = st.target;

    // a little nod when greeting, and a slight chin lift/drop toward the cursor
    const nod = greeting ? Math.sin(now / 230) * Math.max(0, 1 - (now - centerSince - 700) / 1100) : 0;
    st.pitch += (clamp(st.ty, -1, 1) * 0.6 + nod - st.pitch) * approach(dt, 0.25);
    st.lean += (st.tx - st.lean) * approach(dt, 0.35);
}

/* ═══════════════════════════════════════════════════════════
   RENDERER — a 7-angle head turnaround on the laptop body

   heads.webp holds seven aligned head renders, from looking at the
   visitor's left to their right, drawn over body.webp. The head rests
   on one render and sweeps through the in-between angles when the
   cursor moves, with only a brief blend at each switch.
   ═══════════════════════════════════════════════════════════ */
const FRAMES = 7, MID = (FRAMES - 1) / 2;
// in the 688×960 body image (pixels)
const AV = { size: [688, 960], cell: [312, 435], at: [189, 49], neck: [345, 470] };

function startAvatar(canvas, body, sheet) {
    const ctx = canvas.getContext('2d');
    const head = document.createElement('canvas'), hctx = head.getContext('2d');
    let k = 1;
    const resize = () => {
        const r = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.max(1, Math.round(r.width * dpr));
        canvas.height = Math.max(1, Math.round(r.height * dpr));
        k = canvas.width / AV.size[0];
        head.width = Math.ceil(AV.cell[0] * k);
        head.height = Math.ceil(AV.cell[1] * k);
        last = '';
    };
    let last = '';
    resize();
    window.addEventListener('resize', resize);
    root.classList.add('avatar-on');

    const [cw, ch] = AV.cell;
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
        const key = `${i}|${m.toFixed(3)}|${tilt.toFixed(4)}|${dy.toFixed(2)}|${canvas.width}`;
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
            canvas.style.transform = `perspective(1200px) rotateY(${st.lean * 3}deg) translateY(${b * -50}px) scale(${1 + b * 0.6}, ${1 + b})`;
        }
    })(performance.now());
}

(async function startHero() {
    const load = src => new Promise((ok, bad) => { const im = new Image(); im.onload = () => ok(im); im.onerror = bad; im.src = src; });
    try {
        const [body, sheet] = await Promise.all([load('../body.webp?v=2'), load('../heads.webp?v=2')]);
        startAvatar($('#faceCanvas'), body, sheet);
    } catch (e) {
        // the still front-facing image stays; keep the bubble and greeting alive
        (function frame(now) { requestAnimationFrame(frame); if (heroVisible) update(now); })(performance.now());
    }
})();

/* ═══════════════════════════════════════════════════════════
   SCROLL REVEALS
   ═══════════════════════════════════════════════════════════ */
if (hasG && !RM) {
    gsap.registerPlugin(ScrollTrigger);
    gsap.from('.name span', { y: 40, opacity: 0, duration: 1.2, ease: 'power3.out', stagger: 0.12, delay: 0.1 });
    gsap.from('.role, .hero-meta', { y: 16, opacity: 0, duration: 1, ease: 'power3.out', delay: 0.45 });
    gsap.from('.portrait, .halo', { y: 80, opacity: 0, duration: 1.4, ease: 'power3.out', delay: 0.2 });
    $$('[data-reveal]').forEach(el => gsap.from(el, { y: 32, opacity: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%' } }));
    $$('[data-stagger]').forEach(el => gsap.from(el.children, { y: 28, opacity: 0, duration: 0.9, ease: 'power3.out', stagger: 0.08, scrollTrigger: { trigger: el, start: 'top 88%' } }));
    // About statement: words ink in as it scrolls through the view, highlights sweep on
    const statement = $('#statement');
    if (statement) {
        const words = [];
        const split = node => {
            for (const child of Array.from(node.childNodes)) {
                if (child.nodeType === 3) {
                    const frag = document.createDocumentFragment();
                    child.textContent.split(/(\s+)/).forEach(part => {
                        if (!part) return;
                        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
                        const w = document.createElement('span');
                        w.textContent = part;
                        words.push(w);
                        frag.appendChild(w);
                    });
                    node.replaceChild(frag, child);
                } else if (child.nodeType === 1) split(child);
            }
        };
        split(statement);
        gsap.fromTo(words, { opacity: 0.16 }, {
            opacity: 1, ease: 'none', stagger: 0.1,
            scrollTrigger: { trigger: statement, start: 'top 82%', end: 'bottom 48%', scrub: 0.6 }
        });
        $$('em, .hl', statement).forEach(el => ScrollTrigger.create({ trigger: el, start: 'top 62%', onEnter: () => el.classList.add('lit') }));
    }
    $$('[data-count]').forEach(n => {
        const end = parseInt(n.dataset.count, 10), o = { v: 0 };
        n.textContent = '0';
        ScrollTrigger.create({ trigger: n, start: 'top 92%', once: true, onEnter: () => gsap.to(o, { v: end, duration: 1.6, ease: 'power3.out', onUpdate: () => { n.textContent = Math.round(o.v); } }) });
    });
} else root.classList.add('no-anim');   // highlights shown statically
})();
