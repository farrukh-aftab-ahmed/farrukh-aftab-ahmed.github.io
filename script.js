/* ============================================================
   Farrukh Aftab Ahmed — Particle Portfolio
   Interactive constellation particle system + GSAP animations
   ============================================================ */

const G = typeof gsap !== 'undefined';
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const MOB = window.innerWidth < 769;

document.addEventListener('DOMContentLoaded', () => {
    if (!G) document.documentElement.classList.add('no-gsap');
    initParticles();
    initLenis();
    initCursor();
    initTypewriter();
    initProgress();
    initNavScroll();
    initBurger();
    if (G && !REDUCED) {
        gsap.registerPlugin(ScrollTrigger);
        initHero();
        initReveals();
        initAboutWords();
        initTimeline();
        initCountUp();
        initContactTitle();
        window.addEventListener('load', () => ScrollTrigger.refresh());
    } else {
        document.querySelectorAll('.reveal,.anim-up').forEach(e => { e.classList.add('vis'); e.classList.add('show'); });
        plainCount();
    }
});

/* ═══════════════════════════════════════════════════════════
   PARTICLE CONSTELLATION SYSTEM
   ═══════════════════════════════════════════════════════════ */
function initParticles() {
    const canvas = document.getElementById('particleCanvas');
    if (!canvas || REDUCED) return;
    const ctx = canvas.getContext('2d');

    const COLORS = [
        { r: 99, g: 102, b: 241 },   // indigo
        { r: 129, g: 140, b: 248 },   // lighter indigo
        { r: 34, g: 211, b: 238 },    // cyan
        { r: 167, g: 139, b: 250 },   // violet
        { r: 244, g: 114, b: 182 },   // pink (rare)
    ];

    let W, H;
    const mouse = { x: -9999, y: -9999, radius: 160 };
    const particles = [];
    const trails = [];
    const LINK_DIST = 130;
    const LINK_DIST_SQ = LINK_DIST * LINK_DIST;
    let COUNT = MOB ? 120 : 380;
    let lastMx = -9999, lastMy = -9999;

    function resize() {
        W = canvas.width = window.innerWidth;
        H = canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', () => { resize(); adjustCount(); });

    function adjustCount() {
        const ideal = MOB ? 120 : Math.min(420, Math.floor((W * H) / 5200));
        while (particles.length < ideal) particles.push(makeP());
        while (particles.length > ideal) particles.pop();
        COUNT = particles.length;
    }

    function makeP() {
        const c = COLORS[Math.floor(Math.random() * COLORS.length)];
        const depth = Math.random();              // 0 = far, 1 = near
        return {
            x: Math.random() * W,
            y: Math.random() * H,
            vx: (Math.random() - 0.5) * 0.35,
            vy: (Math.random() - 0.5) * 0.35,
            baseSize: 0.6 + depth * 2.2,
            size: 0.6 + depth * 2.2,
            r: c.r, g: c.g, b: c.b,
            alpha: 0.15 + depth * 0.5,
            baseAlpha: 0.15 + depth * 0.5,
            pulse: Math.random() * Math.PI * 2,
            depth
        };
    }

    for (let i = 0; i < COUNT; i++) particles.push(makeP());

    // Mouse
    window.addEventListener('mousemove', e => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
        // Spawn trail particles on movement
        const dx = mouse.x - lastMx;
        const dy = mouse.y - lastMy;
        if (dx * dx + dy * dy > 100) {
            trails.push({
                x: mouse.x, y: mouse.y,
                size: Math.random() * 2.5 + 1,
                alpha: 0.7,
                r: COLORS[0].r, g: COLORS[0].g, b: COLORS[0].b,
                life: 1
            });
            lastMx = mouse.x; lastMy = mouse.y;
        }
    });
    window.addEventListener('mouseleave', () => { mouse.x = -9999; mouse.y = -9999; });

    // ─── Physics update ───
    function update() {
        for (let i = 0; i < COUNT; i++) {
            const p = particles[i];

            // Mouse repulsion
            const dx = p.x - mouse.x;
            const dy = p.y - mouse.y;
            const distSq = dx * dx + dy * dy;
            if (distSq < mouse.radius * mouse.radius && distSq > 0) {
                const dist = Math.sqrt(distSq);
                const force = (mouse.radius - dist) / mouse.radius;
                const fx = (dx / dist) * force * 1.2;
                const fy = (dy / dist) * force * 1.2;
                p.vx += fx;
                p.vy += fy;
                // Glow near cursor
                p.alpha = Math.min(p.baseAlpha + force * 0.5, 1);
                p.size = p.baseSize + force * 2;
            } else {
                p.alpha += (p.baseAlpha - p.alpha) * 0.05;
                p.size += (p.baseSize - p.size) * 0.05;
            }

            // Velocity + damping
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= 0.985;
            p.vy *= 0.985;

            // Pulse
            p.pulse += 0.015;
            p.size += Math.sin(p.pulse) * 0.3;

            // Wrap around edges
            if (p.x < -20) p.x = W + 20;
            if (p.x > W + 20) p.x = -20;
            if (p.y < -20) p.y = H + 20;
            if (p.y > H + 20) p.y = -20;
        }

        // Trail decay
        for (let i = trails.length - 1; i >= 0; i--) {
            trails[i].life -= 0.025;
            trails[i].alpha = trails[i].life * 0.6;
            trails[i].size *= 0.97;
            if (trails[i].life <= 0) trails.splice(i, 1);
        }
    }

    // ─── Render ───
    function draw() {
        ctx.clearRect(0, 0, W, H);

        // Mouse ambient glow
        if (mouse.x > 0 && mouse.y > 0) {
            const grad = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, mouse.radius * 1.2);
            grad.addColorStop(0, 'rgba(99,102,241,0.08)');
            grad.addColorStop(0.5, 'rgba(34,211,238,0.03)');
            grad.addColorStop(1, 'rgba(99,102,241,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(mouse.x, mouse.y, mouse.radius * 1.2, 0, Math.PI * 2);
            ctx.fill();
        }

        // Connection lines
        for (let i = 0; i < COUNT; i++) {
            const a = particles[i];
            for (let j = i + 1; j < COUNT; j++) {
                const b = particles[j];
                const dx = a.x - b.x;
                const dy = a.y - b.y;
                const distSq = dx * dx + dy * dy;
                if (distSq < LINK_DIST_SQ) {
                    const dist = Math.sqrt(distSq);
                    const opacity = (1 - dist / LINK_DIST) * 0.12;

                    // Lines near mouse glow brighter + colored
                    const mx = (a.x + b.x) / 2;
                    const my = (a.y + b.y) / 2;
                    const md = Math.sqrt((mx - mouse.x) ** 2 + (my - mouse.y) ** 2);
                    let lineAlpha = opacity;
                    let r = 99, g = 102, bl = 241;
                    if (md < mouse.radius * 1.5) {
                        const boost = 1 - md / (mouse.radius * 1.5);
                        lineAlpha += boost * 0.15;
                        r = Math.round(99 + (34 - 99) * boost);
                        g = Math.round(102 + (211 - 102) * boost);
                        bl = Math.round(241 + (238 - 241) * boost);
                    }

                    ctx.beginPath();
                    ctx.moveTo(a.x, a.y);
                    ctx.lineTo(b.x, b.y);
                    ctx.strokeStyle = `rgba(${r},${g},${bl},${lineAlpha})`;
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            }
        }

        // Trail particles
        for (const t of trails) {
            ctx.beginPath();
            ctx.arc(t.x, t.y, t.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${t.r},${t.g},${t.b},${t.alpha})`;
            ctx.fill();
        }

        // Particles
        for (const p of particles) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, Math.max(p.size, 0.3), 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${p.alpha})`;
            ctx.fill();
        }
    }

    function loop() {
        update();
        draw();
        requestAnimationFrame(loop);
    }
    loop();
    adjustCount();
}

/* ═══════════════════════════════════════════════════════════
   LENIS SMOOTH SCROLL
   ═══════════════════════════════════════════════════════════ */
let lenis = null;
function initLenis() {
    if (typeof Lenis === 'undefined' || REDUCED) { fallbackAnchors(); return; }
    lenis = new Lenis({ duration: 1.12, smoothWheel: true, lerp: 0.09 });
    if (G) {
        lenis.on('scroll', ScrollTrigger.update);
        gsap.ticker.add(t => lenis.raf(t * 1000));
        gsap.ticker.lagSmoothing(0);
    } else {
        (function r(t) { lenis.raf(t); requestAnimationFrame(r); })(performance.now());
    }
    document.querySelectorAll('a[href^="#"]').forEach(a =>
        a.addEventListener('click', e => {
            const tgt = document.querySelector(a.getAttribute('href'));
            if (tgt) { e.preventDefault(); lenis.scrollTo(tgt, { offset: -60 }); }
        })
    );
}
function fallbackAnchors() {
    document.querySelectorAll('a[href^="#"]').forEach(a =>
        a.addEventListener('click', e => {
            const t = document.querySelector(a.getAttribute('href'));
            if (t) { e.preventDefault(); t.scrollIntoView({ behavior: 'smooth' }); }
        })
    );
}

/* ═══════════════════════════════════════════════════════════
   CURSOR DOT
   ═══════════════════════════════════════════════════════════ */
function initCursor() {
    const dot = document.getElementById('curDot');
    if (!dot || window.matchMedia('(hover:none)').matches) return;
    window.addEventListener('mousemove', e => {
        dot.style.transform = `translate(${e.clientX - 3}px,${e.clientY - 3}px)`;
    });
}

/* ═══════════════════════════════════════════════════════════
   TYPEWRITER
   ═══════════════════════════════════════════════════════════ */
function initTypewriter() {
    const el = document.getElementById('typewriter');
    if (!el) return;
    const titles = ['AI Systems Architect', 'Senior Software Designer', 'Technical Lead', 'Computer Vision Engineer', 'Published Researcher', 'Full-Stack Developer'];
    let ti = 0, ci = 0, del = false;
    function step() {
        const cur = titles[ti];
        if (!del) { el.textContent = cur.substring(0, ++ci); if (ci === cur.length) { setTimeout(() => { del = true; step(); }, 1800); return; } setTimeout(step, 50); }
        else { el.textContent = cur.substring(0, --ci); if (ci === 0) { del = false; ti = (ti + 1) % titles.length; setTimeout(step, 300); return; } setTimeout(step, 25); }
    }
    setTimeout(step, 600);
}

/* ═══════════════════════════════════════════════════════════
   SCROLL PROGRESS
   ═══════════════════════════════════════════════════════════ */
function initProgress() {
    const bar = document.getElementById('progress');
    if (!bar) return;
    window.addEventListener('scroll', () => {
        bar.style.width = (scrollY / (document.documentElement.scrollHeight - innerHeight) * 100) + '%';
    }, { passive: true });
}

/* ═══════════════════════════════════════════════════════════
   NAV
   ═══════════════════════════════════════════════════════════ */
function initNavScroll() {
    const nav = document.getElementById('nav');
    const links = document.querySelectorAll('.nav-a');
    const secs = document.querySelectorAll('section[id]');
    window.addEventListener('scroll', () => {
        nav.classList.toggle('scrolled', scrollY > 50);
        let cur = '';
        secs.forEach(s => { if (scrollY >= s.offsetTop - 150) cur = s.id; });
        links.forEach(l => l.classList.toggle('active', l.getAttribute('href') === '#' + cur));
    }, { passive: true });
}
function initBurger() {
    const btn = document.getElementById('burger');
    const lnk = document.getElementById('navLinks');
    if (!btn || !lnk) return;
    btn.addEventListener('click', () => { lnk.classList.toggle('open'); btn.classList.toggle('on'); });
    lnk.querySelectorAll('.nav-a').forEach(a => a.addEventListener('click', () => { lnk.classList.remove('open'); btn.classList.remove('on'); }));
}

/* ═══════════════════════════════════════════════════════════
   HERO INTRO
   ═══════════════════════════════════════════════════════════ */
function initHero() {
    // Split title into chars
    document.querySelectorAll('.hero-name [data-split]').forEach(line => {
        const txt = line.textContent;
        line.innerHTML = '';
        for (const c of txt) {
            const s = document.createElement('span');
            s.className = 'ch';
            s.textContent = c === ' ' ? ' ' : c;
            if (c === ' ') s.style.width = '0.3em';
            line.appendChild(s);
        }
    });

    const chars = gsap.utils.toArray('.name-line .ch');
    const ups = gsap.utils.toArray('.anim-up');

    const tl = gsap.timeline({ defaults: { ease: 'power4.out' }, delay: 0.1 });
    tl.to(chars, { y: 0, opacity: 1, duration: 0.9, stagger: 0.022 }, 0);

    ups.forEach(el => {
        const d = parseFloat(el.dataset.delay || 0) * 0.12 + 0.5;
        tl.to(el, { opacity: 1, y: 0, duration: 0.7 }, d);
        el.classList.add('show');
    });

    // Hero parallax fade on scroll
    gsap.to('.hero-content', { yPercent: -22, opacity: 0, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to('.hero-metrics', { yPercent: -12, opacity: 0, ease: 'none', scrollTrigger: { trigger: '.hero', start: '55% top', end: 'bottom top', scrub: true } });
}

/* ═══════════════════════════════════════════════════════════
   SCROLL REVEALS
   ═══════════════════════════════════════════════════════════ */
function initReveals() {
    gsap.utils.toArray('.reveal').forEach(el => {
        gsap.fromTo(el, { y: 40, opacity: 0 }, {
            y: 0, opacity: 1, duration: 0.8, ease: 'power3.out',
            scrollTrigger: { trigger: el, start: 'top 86%' },
            onStart: () => el.classList.add('vis')
        });
    });
    // Staggered grids
    ['.proj-grid', '.sk-grid', '.achv-row', '.badge-row'].forEach(sel => {
        const g = document.querySelector(sel);
        if (!g) return;
        gsap.fromTo(g.children, { y: 34, opacity: 0 }, {
            y: 0, opacity: 1, duration: 0.65, ease: 'power3.out', stagger: 0.06,
            scrollTrigger: { trigger: g, start: 'top 82%' }
        });
    });
}

/* ═══════════════════════════════════════════════════════════
   ABOUT — WORD-BY-WORD SCROLL HIGHLIGHT
   ═══════════════════════════════════════════════════════════ */
function initAboutWords() {
    const el = document.getElementById('aboutText');
    if (!el) return;
    const raw = el.textContent.trim();
    el.innerHTML = raw.split(/\s+/).map(w => `<span class="w">${w}</span>`).join(' ');
    const words = el.querySelectorAll('.w');
    const tl = gsap.timeline({
        scrollTrigger: { trigger: el, start: 'top 72%', end: 'bottom 38%', scrub: 0.4 }
    });
    words.forEach((w, i) => tl.to(w, { className: 'w lit', duration: 0.04 }, i * 0.04));
}

/* ═══════════════════════════════════════════════════════════
   TIMELINE
   ═══════════════════════════════════════════════════════════ */
function initTimeline() {
    const fill = document.getElementById('tlFill');
    const tl = document.querySelector('.timeline');
    if (!fill || !tl) return;
    gsap.to(fill, { height: '100%', ease: 'none', scrollTrigger: { trigger: tl, start: 'top 60%', end: 'bottom 75%', scrub: 0.4 } });
    gsap.utils.toArray('.tl-entry').forEach(e => ScrollTrigger.create({ trigger: e, start: 'top 70%', once: true, onEnter: () => e.classList.add('in') }));
}

/* ═══════════════════════════════════════════════════════════
   CONTACT TITLE — SPLIT TEXT
   ═══════════════════════════════════════════════════════════ */
function initContactTitle() {
    const el = document.getElementById('ctaTitle');
    if (!el) return;
    const txt = el.textContent;
    el.innerHTML = '';
    for (const c of txt) {
        const s = document.createElement('span');
        s.className = 'ch';
        s.textContent = c === ' ' ? ' ' : c;
        el.appendChild(s);
    }
    gsap.to(el.querySelectorAll('.ch'), {
        y: 0, opacity: 1, duration: 0.7, ease: 'power4.out', stagger: 0.018,
        scrollTrigger: { trigger: el, start: 'top 80%' }
    });
}

/* ═══════════════════════════════════════════════════════════
   COUNT UP
   ═══════════════════════════════════════════════════════════ */
function initCountUp() {
    document.querySelectorAll('[data-count]').forEach(el => {
        const end = parseInt(el.dataset.count, 10);
        const o = { v: 0 };
        ScrollTrigger.create({ trigger: el, start: 'top 92%', once: true,
            onEnter: () => gsap.to(o, { v: end, duration: 2, ease: 'power2.out', onUpdate: () => el.textContent = Math.round(o.v) })
        });
    });
}
function plainCount() {
    const io = new IntersectionObserver(ents => {
        ents.forEach(e => {
            if (!e.isIntersecting) return;
            const el = e.target, end = parseInt(el.dataset.count, 10), t0 = performance.now();
            (function t(n) { const p = Math.min((n - t0) / 1800, 1); el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(t); })(t0);
            io.unobserve(el);
        });
    }, { threshold: 0.5 });
    document.querySelectorAll('[data-count]').forEach(el => io.observe(el));
}
