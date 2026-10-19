/* ============================================================
   Section scenes (Canvas 2D, hand-rolled 3D projection)
   · Globe — connected systems sphere with travelling light
   · City  — Safe City grid: cameras detect vehicles, send light to the platform
   ============================================================ */
(() => {
'use strict';

const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;
const hasG = typeof window.gsap !== 'undefined';
const TAU = Math.PI * 2;

function rng(seed) {
    return () => {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}
const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const clamp01 = v => Math.max(0, Math.min(1, v));

/* Shared canvas stage: sizing, visibility, pointer, reveal, loop */
function stage(canvas, draw) {
    const ctx = canvas.getContext('2d');
    const st = { w: 0, h: 0, t: 0, dt: 0, visible: false, reveal: (RM || !hasG) ? 1 : 0, px: 0, py: 0, tpx: 0, tpy: 0 };
    function size() {
        const r = canvas.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        st.w = r.width; st.h = r.height;
        canvas.width = Math.max(1, Math.round(r.width * dpr));
        canvas.height = Math.max(1, Math.round(r.height * dpr));
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    size();
    if ('ResizeObserver' in window) new ResizeObserver(size).observe(canvas);
    else window.addEventListener('resize', size);

    let revealed = st.reveal === 1;
    new IntersectionObserver(([e]) => {
        st.visible = e.isIntersecting;
        if (e.isIntersecting && !revealed) {
            revealed = true;
            gsap.to(st, { reveal: 1, duration: 2.6, ease: 'power2.inOut' });
        }
    }, { threshold: 0.12 }).observe(canvas);

    if (FINE && !RM) {
        const host = canvas.parentElement;
        host.addEventListener('pointermove', e => {
            const r = canvas.getBoundingClientRect();
            st.tpx = ((e.clientX - r.left) / r.width) * 2 - 1;
            st.tpy = ((e.clientY - r.top) / r.height) * 2 - 1;
        });
        host.addEventListener('pointerleave', () => { st.tpx = 0; st.tpy = 0; });
    }

    let last = performance.now();
    (function loop(now) {
        requestAnimationFrame(loop);
        st.dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        if (!st.visible || document.hidden) return;
        if (RM) st.dt = 0;
        st.t += st.dt;
        st.px += (st.tpx - st.px) * 0.05;
        st.py += (st.tpy - st.py) * 0.05;
        draw(ctx, st);
    })(last);
}

/* ═══════════════════════════════════════════════════════════
   GLOBE — "Everything connected"
   ═══════════════════════════════════════════════════════════ */
function createGlobe(canvas) {
    const r = rng(11);
    const N = 180;
    const pts = [], scat = [];
    for (let i = 0; i < N; i++) {
        const y = 1 - (i / (N - 1)) * 2, rad = Math.sqrt(1 - y * y), th = i * 2.399963;
        pts.push([Math.cos(th) * rad, y, Math.sin(th) * rad]);
        const u = r() * TAU, v = Math.acos(2 * r() - 1), d = 1.7 + r() * 1.5;
        scat.push([Math.sin(v) * Math.cos(u) * d, Math.cos(v) * d, Math.sin(v) * Math.sin(u) * d]);
    }
    const key = new Set(), edges = [], adj = pts.map(() => []);
    pts.forEach((p, i) => {
        pts.map((q, j) => [j, (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2])
            .filter(([j]) => j !== i).sort((a, b) => a[1] - b[1]).slice(0, 3)
            .forEach(([j]) => {
                const k = i < j ? i + '-' + j : j + '-' + i;
                if (!key.has(k)) { key.add(k); edges.push([i, j]); adj[i].push(j); adj[j].push(i); }
            });
    });
    const hubDefs = [['Cameras', [-0.62, 0.5, 0.6]], ['Models', [0.18, 0.78, 0.6]], ['Services', [0.8, 0.12, 0.58]], ['Alerts', [0.55, 0.55, -0.62]],
        ['PACS', [-0.82, -0.28, 0.5]], ['APIs', [0.3, -0.6, 0.74]], ['Data', [-0.25, -0.82, -0.5]]];
    const hubs = hubDefs.map(([label, d]) => {
        const l = Math.hypot(...d);
        let best = 0, bd = -2;
        pts.forEach((p, i) => { const dot = (p[0] * d[0] + p[1] * d[1] + p[2] * d[2]) / l; if (dot > bd) { bd = dot; best = i; } });
        return { i: best, label };
    });
    const hubSet = new Set(hubs.map(h => h.i));

    const packets = Array.from({ length: 26 }, () => {
        const a = Math.floor(r() * N);
        return { a, b: adj[a][Math.floor(r() * adj[a].length)], p: r(), sp: 0.55 + r() * 0.7 };
    });

    const ring = (tiltX, tiltZ, radius) => Array.from({ length: 120 }, (_, k) => {
        const a = (k / 120) * TAU;
        let x = Math.cos(a) * radius, y = 0, z = Math.sin(a) * radius;
        let y1 = y * Math.cos(tiltX) - z * Math.sin(tiltX), z1 = y * Math.sin(tiltX) + z * Math.cos(tiltX);
        let x2 = x * Math.cos(tiltZ) - y1 * Math.sin(tiltZ), y2 = x * Math.sin(tiltZ) + y1 * Math.cos(tiltZ);
        return [x2, y2, z1];
    });
    const rings = [ring(1.15, 0.35, 1.32), ring(1.45, -0.6, 1.5)];

    stage(canvas, (ctx, st) => {
        const { w, h } = st;
        ctx.clearRect(0, 0, w, h);
        const e = ease(clamp01(st.reveal));
        const R = Math.min(w, h) * 0.33, cx = w / 2, cy = h / 2;
        const yaw = st.t * 0.14 + st.px * 0.5, pitch = -0.3 + st.py * 0.25;
        const cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
        const project = (x, y, z) => {
            const x1 = x * cyw - z * syw, z1 = x * syw + z * cyw;
            const y1 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
            const k = 3.4 / (3.4 - z2);
            return [cx + x1 * R * k, cy - y1 * R * k, (z2 + 1) / 2, k];
        };

        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.5);
        g.addColorStop(0, `rgba(255,179,71,${0.13 * e})`);
        g.addColorStop(0.55, `rgba(255,179,71,${0.04 * e})`);
        g.addColorStop(1, 'rgba(255,179,71,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);

        const P = pts.map((p, i) => {
            const s = scat[i];
            return project(s[0] + (p[0] - s[0]) * e, s[1] + (p[1] - s[1]) * e, s[2] + (p[2] - s[2]) * e);
        });

        // orbit rings
        ctx.lineWidth = 1;
        rings.forEach((rg, ri) => {
            const RP = rg.map(q => project(q[0], q[1], q[2]));
            for (let k = 0; k < RP.length; k++) {
                const a = RP[k], b = RP[(k + 1) % RP.length];
                const d = (a[2] + b[2]) / 2;
                ctx.strokeStyle = `rgba(255,200,130,${(0.03 + 0.16 * d * d) * e})`;
                ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
            }
            const k = Math.floor(((st.t * (ri ? 0.06 : 0.09)) % 1) * RP.length);
            const sat = RP[k];
            ctx.fillStyle = `rgba(255,224,160,${(0.3 + 0.7 * sat[2]) * e})`;
            ctx.beginPath(); ctx.arc(sat[0], sat[1], 2.2, 0, TAU); ctx.fill();
        });

        // mesh
        for (const [a, b] of edges) {
            const d = (P[a][2] + P[b][2]) / 2;
            ctx.strokeStyle = `rgba(255,179,71,${(0.03 + 0.32 * d * d) * e})`;
            ctx.beginPath(); ctx.moveTo(P[a][0], P[a][1]); ctx.lineTo(P[b][0], P[b][1]); ctx.stroke();
        }
        for (let i = 0; i < N; i++) {
            if (hubSet.has(i)) continue;
            const p = P[i], d = p[2];
            ctx.fillStyle = `rgba(255,205,140,${0.18 + 0.7 * d})`;
            const s = (0.7 + 1.5 * d) * p[3];
            ctx.fillRect(p[0] - s / 2, p[1] - s / 2, s, s);
        }

        // light packets travelling across the network
        ctx.globalCompositeOperation = 'lighter';
        for (const k of packets) {
            k.p += k.sp * st.dt;
            if (k.p >= 1) {
                k.p = 0; k.a = k.b;
                const nb = adj[k.a];
                k.b = nb[Math.floor(Math.random() * nb.length)];
            }
            const A = P[k.a], B = P[k.b];
            const d = (A[2] + B[2]) / 2;
            const hx = A[0] + (B[0] - A[0]) * k.p, hy = A[1] + (B[1] - A[1]) * k.p;
            const tp = Math.max(0, k.p - 0.35);
            const tx = A[0] + (B[0] - A[0]) * tp, ty = A[1] + (B[1] - A[1]) * tp;
            const lg = ctx.createLinearGradient(tx, ty, hx, hy);
            lg.addColorStop(0, 'rgba(255,224,160,0)');
            lg.addColorStop(1, `rgba(255,224,160,${(0.25 + 0.75 * d) * e})`);
            ctx.strokeStyle = lg; ctx.lineWidth = 1.6;
            ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
            ctx.fillStyle = `rgba(255,240,210,${(0.3 + 0.7 * d) * e})`;
            ctx.beginPath(); ctx.arc(hx, hy, 1.6 + d, 0, TAU); ctx.fill();
        }

        // hubs with labels
        ctx.lineWidth = 1;
        ctx.font = '500 10px Inter, system-ui, sans-serif';
        ctx.textBaseline = 'middle';
        for (const hb of hubs) {
            const p = P[hb.i], d = p[2];
            const pulse = 0.5 + 0.5 * Math.sin(st.t * 1.6 + hb.i);
            const halo = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], 22);
            halo.addColorStop(0, `rgba(255,179,71,${(0.25 + 0.3 * pulse) * d * e})`);
            halo.addColorStop(1, 'rgba(255,179,71,0)');
            ctx.fillStyle = halo;
            ctx.beginPath(); ctx.arc(p[0], p[1], 22, 0, TAU); ctx.fill();
            ctx.fillStyle = `rgba(255,236,200,${(0.35 + 0.65 * d) * e})`;
            ctx.beginPath(); ctx.arc(p[0], p[1], 3.4, 0, TAU); ctx.fill();
            const la = clamp01((d - 0.42) / 0.4) * e;
            if (la > 0.01) {
                ctx.globalCompositeOperation = 'source-over';
                const sd = p[0] > w * 0.68 ? -1 : 1;
                ctx.strokeStyle = `rgba(255,224,160,${0.5 * la})`;
                ctx.beginPath(); ctx.moveTo(p[0] + 6 * sd, p[1] - 6); ctx.lineTo(p[0] + 18 * sd, p[1] - 18); ctx.lineTo(p[0] + 26 * sd, p[1] - 18); ctx.stroke();
                ctx.fillStyle = `rgba(248,244,236,${0.9 * la})`;
                ctx.textAlign = sd > 0 ? 'left' : 'right';
                ctx.fillText(hb.label.toUpperCase().split('').join(String.fromCharCode(8202)), p[0] + 30 * sd, p[1] - 18);
                ctx.textAlign = 'left';
                ctx.globalCompositeOperation = 'lighter';
            }
        }
        ctx.globalCompositeOperation = 'source-over';
    });
}

/* ═══════════════════════════════════════════════════════════
   CITY — Islamabad Safe City, at a glance
   ═══════════════════════════════════════════════════════════ */
function createCity(canvas) {
    const r = rng(5);
    const G = 6, H = 2.3;
    const buildings = [];
    for (let bx = -G; bx < G; bx++) for (let bz = -G; bz < G; bz++) {
        const x = bx + 0.5, z = bz + 0.5;
        if (Math.abs(x) < 1.6 && Math.abs(z) < 1.6) continue;
        if (r() < 0.62) buildings.push({ x, z, s: 0.3 + r() * 0.12, h: 0.12 + Math.pow(r(), 2.2) * 1.05, delay: r() * 0.5 });
    }
    const cams = [], used = new Set();
    while (cams.length < 22) {
        const x = Math.floor(r() * (2 * G - 1)) - G + 1, z = Math.floor(r() * (2 * G - 1)) - G + 1;
        if (Math.abs(x) <= 1 && Math.abs(z) <= 1) continue;
        if (used.has(x + ',' + z)) continue;
        used.add(x + ',' + z);
        cams.push({ x, z, base: r() * TAU, flash: 0, cool: r() * 3, id: String(Math.floor(r() * 380) + 12).padStart(3, '0') });
    }
    const cars = Array.from({ length: 46 }, () => ({
        axis: r() < 0.5 ? 0 : 1, lane: Math.floor(r() * (2 * G - 1)) - G + 1,
        pos: r() * 2 * G - G, dir: r() < 0.5 ? -1 : 1, sp: 0.45 + r() * 0.55
    }));
    const packets = [], pulses = [], tags = [];
    let hubFlash = 0;

    stage(canvas, (ctx, st) => {
        const { w, h, dt, t } = st;
        ctx.clearRect(0, 0, w, h);
        const e = ease(clamp01(st.reveal));
        const yaw = t * 0.06 + st.px * 0.35 + 0.5, pitch = 0.96 + st.py * 0.06;
        const cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
        const D = 15, F = Math.min(w, h * 1.1) * 0.74 * D / (2 * G);
        const cx = w / 2, cy = h * 0.56;
        const project = (x, y, z) => {
            const xr = x * cyw - z * syw, zr = x * syw + z * cyw;
            const y1 = y * cp + zr * sp, z1 = zr * cp - y * sp;
            const k = F / (D + z1);
            return [cx + xr * k, cy - y1 * k, z1];
        };
        const fog = z => 0.25 + 0.75 * clamp01(1 - (z + G) / (2 * G) * 0.85);

        // ground glow around the platform
        const base = project(0, 0, 0);
        const gg = ctx.createRadialGradient(base[0], base[1], 0, base[0], base[1], w * 0.42);
        gg.addColorStop(0, `rgba(255,179,71,${0.16 * e})`);
        gg.addColorStop(1, 'rgba(255,179,71,0)');
        ctx.fillStyle = gg; ctx.fillRect(0, 0, w, h);

        // streets
        ctx.lineWidth = 1;
        for (let i = -G; i <= G; i++) {
            for (const [a, b] of [[[i, 0, -G], [i, 0, G]], [[-G, 0, i], [G, 0, i]]]) {
                const A = project(...a), B = project(...b);
                const lg = ctx.createLinearGradient(A[0], A[1], B[0], B[1]);
                const main = i === 0 ? 2 : 1;
                lg.addColorStop(0, `rgba(255,190,110,${0.05 * main * fog(A[2]) * e})`);
                lg.addColorStop(1, `rgba(255,190,110,${0.05 * main * fog(B[2]) * e})`);
                ctx.strokeStyle = lg;
                ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke();
            }
        }

        // camera fields of view (on the ground)
        for (const c of cams) {
            c.flash = Math.max(0, c.flash - dt * 1.1);
            c.cool -= dt;
            const ang = c.base + Math.sin(t * 0.5 + c.base) * 0.7;
            const pts = [project(c.x, 0, c.z)];
            for (let k = -4; k <= 4; k++) {
                const a = ang + k * 0.1;
                pts.push(project(c.x + Math.cos(a) * 0.62, 0, c.z + Math.sin(a) * 0.62));
            }
            const fg = ctx.createRadialGradient(pts[0][0], pts[0][1], 0, pts[0][0], pts[0][1], 40);
            fg.addColorStop(0, `rgba(255,179,71,${(0.1 + c.flash * 0.35) * e})`);
            fg.addColorStop(1, 'rgba(255,179,71,0)');
            ctx.fillStyle = fg;
            ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
            for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]);
            ctx.closePath(); ctx.fill();
        }

        // vehicles + detection
        ctx.globalCompositeOperation = 'lighter';
        for (const v of cars) {
            v.pos += v.dir * v.sp * dt;
            if (v.pos > G) v.pos = -G; else if (v.pos < -G) v.pos = G;
            const off = v.dir * 0.07;
            const x = v.axis ? v.lane + off : v.pos, z = v.axis ? v.pos : v.lane + off;
            const tx = v.axis ? x : v.pos - v.dir * 0.3, tz = v.axis ? v.pos - v.dir * 0.3 : z;
            const A = project(tx, 0.02, tz), B = project(x, 0.02, z);
            const f = fog(B[2]) * e;
            const lg = ctx.createLinearGradient(A[0], A[1], B[0], B[1]);
            lg.addColorStop(0, 'rgba(255,215,160,0)');
            lg.addColorStop(1, `rgba(255,215,160,${0.75 * f})`);
            ctx.strokeStyle = lg; ctx.lineWidth = 1.6;
            ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke();
            ctx.fillStyle = `rgba(255,236,205,${0.9 * f})`;
            ctx.beginPath(); ctx.arc(B[0], B[1], 1.4, 0, TAU); ctx.fill();
            if (e > 0.9) {
                for (const c of cams) {
                    if (c.cool > 0) continue;
                    if ((c.x - x) ** 2 + (c.z - z) ** 2 < 0.1) {
                        c.flash = 1; c.cool = 2.4 + Math.random() * 2.6;
                        packets.push({ x: c.x, z: c.z, p: 0 });
                        tags.push({ x: c.x, z: c.z, text: 'CAM-' + c.id, life: 1.6 });
                        break;
                    }
                }
            }
        }
        ctx.globalCompositeOperation = 'source-over';

        // buildings — painter's order, back faces culled
        const sorted = buildings.map(b => ({ b, d: project(b.x, 0, b.z)[2] })).sort((a, c) => c.d - a.d);
        for (const { b } of sorted) {
            const grow = ease(clamp01(e * 1.5 - b.delay));
            if (grow <= 0.01) continue;
            const hh = b.h * grow, s = b.s;
            const bt = [[-s, -s], [s, -s], [s, s], [-s, s]].map(([dx, dz]) => project(b.x + dx, 0, b.z + dz));
            const tp = [[-s, -s], [s, -s], [s, s], [-s, s]].map(([dx, dz]) => project(b.x + dx, hh, b.z + dz));
            const area = q => { let a = 0; for (let k = 0; k < q.length; k++) { const p1 = q[k], p2 = q[(k + 1) % q.length]; a += (p2[0] - p1[0]) * (p2[1] + p1[1]); } return a; };
            const topSign = Math.sign(area(tp));
            const f = fog(bt[0][2]);
            const faces = [[bt[0], bt[1], tp[1], tp[0]], [bt[1], bt[2], tp[2], tp[1]], [bt[2], bt[3], tp[3], tp[2]], [bt[3], bt[0], tp[0], tp[3]]];
            for (const q of faces) {
                if (Math.sign(area(q)) !== topSign) continue;
                ctx.fillStyle = 'rgba(14,11,8,0.94)';
                ctx.strokeStyle = `rgba(255,190,110,${0.16 * f})`;
                ctx.beginPath(); q.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath();
                ctx.fill(); ctx.stroke();
            }
            ctx.fillStyle = `rgba(30,22,13,0.96)`;
            ctx.strokeStyle = `rgba(255,200,130,${0.32 * f})`;
            ctx.beginPath(); tp.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath();
            ctx.fill(); ctx.stroke();
        }

        ctx.globalCompositeOperation = 'lighter';

        // camera nodes
        for (const c of cams) {
            const p = project(c.x, 0.05, c.z);
            const f = fog(p[2]) * e;
            if (c.flash > 0) {
                const hg = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], 18);
                hg.addColorStop(0, `rgba(255,200,120,${0.6 * c.flash * f})`);
                hg.addColorStop(1, 'rgba(255,179,71,0)');
                ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(p[0], p[1], 18, 0, TAU); ctx.fill();
            }
            ctx.fillStyle = `rgba(255,224,160,${(0.55 + 0.45 * c.flash) * f})`;
            ctx.beginPath(); ctx.arc(p[0], p[1], 2 + c.flash * 1.6, 0, TAU); ctx.fill();
        }

        // the platform beacon
        const top = project(0, H, 0), beamTop = project(0, H + 1.1, 0);
        hubFlash = Math.max(0, hubFlash - dt * 1.4);
        for (const [lw, a] of [[14, 0.05], [6, 0.12], [2, 0.55]]) {
            const bg = ctx.createLinearGradient(base[0], base[1], beamTop[0], beamTop[1]);
            bg.addColorStop(0, `rgba(255,224,160,${a * (1 + hubFlash) * e})`);
            bg.addColorStop(0.7, `rgba(255,179,71,${a * 0.6 * e})`);
            bg.addColorStop(1, 'rgba(255,179,71,0)');
            ctx.strokeStyle = bg; ctx.lineWidth = lw; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(base[0], base[1]); ctx.lineTo(beamTop[0], beamTop[1]); ctx.stroke();
        }
        ctx.lineCap = 'butt';

        // ground pulses at the platform base
        for (let k = pulses.length - 1; k >= 0; k--) {
            const pl = pulses[k];
            pl.r += dt * 1.1;
            if (pl.r > 2) { pulses.splice(k, 1); continue; }
            ctx.strokeStyle = `rgba(255,190,110,${(1 - pl.r / 2) * 0.55 * e})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let s = 0; s <= 40; s++) {
                const a = (s / 40) * TAU, p = project(Math.cos(a) * pl.r, 0, Math.sin(a) * pl.r);
                s ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
            }
            ctx.stroke();
        }

        // detections travelling to the platform
        for (let k = packets.length - 1; k >= 0; k--) {
            const pk = packets[k];
            pk.p += dt / 1.35;
            if (pk.p >= 1) { packets.splice(k, 1); pulses.push({ r: 0.1 }); hubFlash = 1; continue; }
            const at = u => {
                const v = 1 - u;
                const x = v * v * pk.x + 2 * v * u * pk.x * 0.5;
                const y = 2 * v * u * (H + 1.2) + u * u * H;
                const z = v * v * pk.z + 2 * v * u * pk.z * 0.5;
                return project(x, y, z);
            };
            let prev = at(Math.max(0, pk.p - 0.22));
            for (let s = 1; s <= 8; s++) {
                const u = Math.max(0, pk.p - 0.22 + (0.22 * s) / 8);
                const cur = at(u);
                ctx.strokeStyle = `rgba(255,214,150,${(s / 8) * 0.8 * e})`;
                ctx.lineWidth = 0.6 + (s / 8) * 1.6;
                ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(cur[0], cur[1]); ctx.stroke();
                prev = cur;
            }
            ctx.fillStyle = `rgba(255,244,220,${e})`;
            ctx.beginPath(); ctx.arc(prev[0], prev[1], 2.2, 0, TAU); ctx.fill();
        }

        // platform node
        const ng = ctx.createRadialGradient(top[0], top[1], 0, top[0], top[1], 34);
        ng.addColorStop(0, `rgba(255,214,150,${(0.55 + 0.45 * hubFlash) * e})`);
        ng.addColorStop(1, 'rgba(255,179,71,0)');
        ctx.fillStyle = ng; ctx.beginPath(); ctx.arc(top[0], top[1], 34, 0, TAU); ctx.fill();
        ctx.fillStyle = `rgba(255,248,232,${e})`;
        ctx.beginPath(); ctx.arc(top[0], top[1], 4 + hubFlash * 2, 0, TAU); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';

        // labels
        ctx.font = '500 10px Inter, system-ui, sans-serif';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = `rgba(248,244,236,${0.85 * e})`;
        ctx.fillText('PLATFORM', top[0] + 16, top[1] - 2);
        for (let k = tags.length - 1; k >= 0; k--) {
            const tg = tags[k];
            tg.life -= dt;
            if (tg.life <= 0) { tags.splice(k, 1); continue; }
            const p = project(tg.x, 0.45, tg.z);
            const right = p[0] > w - 80;
            ctx.textAlign = right ? 'right' : 'left';
            ctx.fillStyle = `rgba(255,224,160,${clamp01(tg.life / 0.6) * 0.9 * e})`;
            ctx.fillText(tg.text, p[0] + (right ? -8 : 8), p[1] - 8);
            ctx.textAlign = 'left';
        }
    });
}

const globe = document.getElementById('globeCanvas');
const city = document.getElementById('cityCanvas');
if (globe && globe.getContext) createGlobe(globe);
if (city && city.getContext) createCity(city);
})();
