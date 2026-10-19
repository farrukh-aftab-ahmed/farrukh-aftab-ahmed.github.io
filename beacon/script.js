/* ============================================================
   Farrukh Aftab Ahmed — Portfolio · page interactions
   (the light column + particles live in beacon.js)
   ============================================================ */
(() => {
'use strict';

const root = document.documentElement;
const hasG = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const MOTION = hasG && !RM;
const SVGNS = 'http://www.w3.org/2000/svg';
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

if (hasG) gsap.registerPlugin(ScrollTrigger);

const year = $('#year');
if (year) year.textContent = new Date().getFullYear();

/* ─── Navigation ─── */
const nav = $('#nav');
const burger = $('#burger');
function setMenu(open) {
    root.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.style.overflow = open ? 'hidden' : '';
}
burger.addEventListener('click', () => setMenu(!root.classList.contains('menu-open')));
$$('.mmenu a').forEach(a => a.addEventListener('click', () => setMenu(false)));
document.addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });

const navLinks = $$('.nav-links a');
const linked = navLinks.map(a => $(a.getAttribute('href'))).filter(Boolean);
function onScroll() {
    nav.classList.toggle('scrolled', window.scrollY > 24);
    let current = null;
    linked.forEach(s => { if (s.getBoundingClientRect().top <= window.innerHeight * 0.4) current = s; });
    navLinks.forEach(a => a.classList.toggle('active', !!current && a.getAttribute('href') === '#' + current.id));
}
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

/* ─── Copy email (reports only what actually happened) ─── */
const copyBtn = $('#copyEmail'), copyStatus = $('#copyStatus');
if (copyBtn) {
    const label = $('span', copyBtn);
    copyBtn.addEventListener('click', async () => {
        try {
            if (!navigator.clipboard) throw new Error('Clipboard unavailable');
            await navigator.clipboard.writeText('fury@outlook.com');
            label.textContent = 'Copied';
            copyStatus.textContent = 'Email address copied to your clipboard.';
        } catch (e) {
            copyStatus.textContent = "Couldn't copy automatically — the address is fury@outlook.com.";
        }
        setTimeout(() => { label.textContent = 'Copy email'; copyStatus.textContent = ''; }, 3200);
    });
}

/* ═══════════════════════════════════════════════════════════
   ILLUSTRATIONS (SVG, deterministic)
   ═══════════════════════════════════════════════════════════ */
function rng(seed) {
    return () => {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}
function el(tag, attrs, parent) {
    const n = document.createElementNS(SVGNS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
}

/* Capability 2 — signal pulses through a dark grid, with a heartbeat trace */
function buildPulses(svg) {
    const r = rng(21), W = 1200, H = 360, S = 40;
    const gG = el('g', {}, svg), gT = el('g', {}, svg), gD = el('g', {}, svg);
    for (let x = 0; x <= W; x += S) el('line', { class: 'p-grid', x1: x, y1: 0, x2: x, y2: H }, gG);
    for (let y = 0; y <= H; y += S) el('line', { class: 'p-grid', x1: 0, y1: y, x2: W, y2: y }, gG);
    for (let k = 0; k < 9; k++) {
        let x = 0, y = S * (1 + Math.floor(r() * (H / S - 1)));
        let d = `M${x} ${y}`;
        while (x < W) {
            x = Math.min(W, x + S * (2 + Math.floor(r() * 5)));
            d += ` H${x}`;
            if (x < W && r() > 0.35) {
                y = Math.max(S, Math.min(H - S, y + S * (r() > 0.5 ? 1 : -1) * (1 + Math.floor(r() * 2))));
                d += ` V${y}`;
            }
        }
        el('path', { class: 'p-trail', d }, gT);
        const p = el('path', { class: 'p-pulse', d, pathLength: 1000 }, gT);
        p.style.setProperty('--dur', (5 + r() * 5).toFixed(2) + 's');
        p.style.setProperty('--del', (-r() * 8).toFixed(2) + 's');
    }
    for (let k = 0; k < 22; k++) {
        const c = el('circle', { class: 'p-dot', cx: S * Math.floor(r() * (W / S)), cy: S * Math.floor(r() * (H / S)), r: 2 }, gD);
        c.style.setProperty('--del', (r() * 3).toFixed(2) + 's');
    }
    const beat = 'l14 -10 l12 22 l12 -96 l14 156 l14 -72';
    const ekg = el('path', { class: 'ekg', d: `M0 180 H300 ${beat} H700 ${beat} H1200` }, svg);
    if (!MOTION) return;
    const len = ekg.getTotalLength();
    ekg.style.strokeDasharray = len;
    gsap.fromTo(ekg, { strokeDashoffset: len }, { strokeDashoffset: 0, ease: 'none',
        scrollTrigger: { trigger: svg, start: 'top 85%', end: 'bottom 40%', scrub: 1 } });
}

/* Capability 3 — scattered points becoming a structured pattern */
function buildScatter(svg) {
    const r = rng(42), cols = 8, rows = 6, x0 = 50, y0 = 50, dx = 60, dy = 64;
    const gE = el('g', {}, svg), gH = el('g', {}, svg), gP = el('g', {}, svg);
    const grid = [], pts = [], halos = [];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) grid.push([x0 + i * dx, y0 + j * dy]);
    const edges = [];
    grid.forEach(([x, y], k) => {
        const i = k % cols, j = Math.floor(k / cols);
        if (i < cols - 1) edges.push(el('line', { class: 's-edge', x1: x, y1: y, x2: x + dx, y2: y }, gE));
        if (j < rows - 1) edges.push(el('line', { class: 's-edge', x1: x, y1: y, x2: x, y2: y + dy }, gE));
    });
    const keys = new Set([9, 20, 27, 35, 44]);
    grid.forEach(([x, y], k) => {
        if (keys.has(k)) halos.push(el('circle', { class: 's-halo', cx: x, cy: y, r: 14 }, gH));
        pts.push(el('circle', { class: 's-pt' + (keys.has(k) ? ' key' : ''), cx: x, cy: y, r: keys.has(k) ? 4.5 : 2.8 }, gP));
    });
    if (!MOTION) return;
    gsap.set(edges, { opacity: 0 });
    gsap.set(halos, { opacity: 0, transformOrigin: 'center' });
    const tl = gsap.timeline({ scrollTrigger: { trigger: svg, start: 'top 80%', end: 'center 40%', scrub: 1 } });
    pts.forEach((p, k) => {
        tl.from(p, { attr: { cx: 20 + r() * 480, cy: 20 + r() * 380 }, opacity: 0.35, duration: 1, ease: 'power2.inOut' }, r() * 0.25);
    });
    tl.to(edges, { opacity: 1, duration: 0.5, stagger: 0.006 }, 0.9)
      .to(halos, { opacity: 1, duration: 0.4, stagger: 0.08 }, 1.2);
}

const buildIf = (id, fn) => { const s = document.getElementById(id); if (s) fn(s); };
buildIf('pulseSvg', buildPulses);
buildIf('scatterSvg', buildScatter);

/* ═══════════════════════════════════════════════════════════
   MOTION
   ═══════════════════════════════════════════════════════════ */
if (!MOTION) return;

/* Hero reveal — restrained opacity + vertical position */
gsap.timeline({ defaults: { ease: 'power3.out' } })
    .from('.nav-in', { opacity: 0, duration: 1.2 }, 0.2)
    .from('.eyebrow', { opacity: 0, y: 16, duration: 1.1 }, 0.35)
    .from('.hero-title .ln', { opacity: 0, y: 34, duration: 1.4, stagger: 0.14 }, 0.5)
    .from('.hero-sub', { opacity: 0, y: 20, duration: 1.1 }, 1.05)
    .from('.hero-cta', { opacity: 0, y: 20, duration: 1.1 }, 1.2)
    .from('.claim', { opacity: 0, y: 16, duration: 1.1, stagger: 0.15 }, 1.45)
    .from('.scroll-ind', { opacity: 0, duration: 1 }, 2);

/* Hero hands over to the story */
const heroOut = { trigger: '.hero', start: 'top top', end: 'bottom 15%', scrub: true };
const mm = gsap.matchMedia();
mm.add('(min-width: 1240px)', () => {
    gsap.to('.hero-center', { y: -70, opacity: 0, ease: 'none', scrollTrigger: heroOut });
    gsap.to('.claims', { y: -30, opacity: 0, ease: 'none', scrollTrigger: { ...heroOut, start: '10% top' } });
});
mm.add('(max-width: 1239px)', () => {
    // hero is taller than the screen here: only fade the headline once it has scrolled well past
    gsap.to('.hero-center', { opacity: 0, ease: 'none', scrollTrigger: { trigger: '.hero-center', start: 'bottom 35%', end: 'bottom top', scrub: true } });
});
gsap.to('.beam-fallback', { opacity: 0.15, ease: 'none', scrollTrigger: heroOut });

/* Section content */
$$('[data-reveal]').forEach(n => gsap.from(n, { y: 28, opacity: 0, duration: 1.1, ease: 'power3.out',
    scrollTrigger: { trigger: n, start: 'top 88%' } }));
$$('[data-stagger]').forEach(n => gsap.from(n.children, { y: 24, opacity: 0, duration: 0.9, ease: 'power3.out', stagger: 0.08,
    scrollTrigger: { trigger: n, start: 'top 86%' } }));

/* Subtle parallax on illustrations */
$$('.cap-visual > .viz, .split-visual > .viz').forEach(v => gsap.fromTo(v, { y: 40 }, { y: -40, ease: 'none',
    scrollTrigger: { trigger: v, start: 'top bottom', end: 'bottom top', scrub: true } }));

/* Count-up */
$$('[data-count]').forEach(n => {
    const end = parseInt(n.dataset.count, 10), o = { v: 0 };
    n.textContent = '0';
    ScrollTrigger.create({ trigger: n, start: 'top 90%', once: true,
        onEnter: () => gsap.to(o, { v: end, duration: 1.8, ease: 'power3.out', onUpdate: () => { n.textContent = Math.round(o.v); } }) });
});

window.addEventListener('load', () => ScrollTrigger.refresh());
if (document.fonts) document.fonts.ready.then(() => ScrollTrigger.refresh());

})();
