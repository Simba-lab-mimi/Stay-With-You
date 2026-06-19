import { useEffect, useRef, memo } from 'react';

// Extremely subtle palette — soft lavender + ice-blue + near-white
const DEFAULT_COLORS = [
  'rgba(200, 195, 255, 0.48)',
  'rgba(185, 215, 255, 0.42)',
  'rgba(215, 210, 255, 0.38)',
  'rgba(255, 255, 255,  0.58)',
  'rgba(205, 200, 255, 0.44)',
  'rgba(220, 215, 255, 0.34)',
  'rgba(195, 228, 255, 0.40)',
  'rgba(240, 238, 255, 0.52)',
];

function rand(lo, hi) { return Math.random() * (hi - lo) + lo; }

function Ballpit({
  count        = 150,
  gravity      = 0.5,
  followCursor = true,
  colors       = DEFAULT_COLORS,
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let dpr  = window.devicePixelRatio || 1;
    let logW = window.innerWidth;
    let logH = window.innerHeight;

    function applySize() {
      dpr  = window.devicePixelRatio || 1;
      logW = window.innerWidth;
      logH = window.innerHeight;
      canvas.width  = logW * dpr;
      canvas.height = logH * dpr;
      canvas.style.width  = logW + 'px';
      canvas.style.height = logH + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    applySize();

    // ── Physics constants ──────────────────────────────────
    const DAMPING     = 0.984;   // velocity decay each tick
    const RESTITUTION = 0.62;    // energy kept on collision
    const MAX_SPEED   = 5.5;
    const ATTRACT_R   = 200;     // cursor influence radius (px)
    const ATTRACT_K   = 0.055;   // cursor pull strength
    const GRAVITY_K   = 0.038;   // gravity scale factor

    // ── Balls ──────────────────────────────────────────────
    const balls = Array.from({ length: count }, () => {
      const r = rand(5, 17);
      return {
        x:  rand(r, logW - r),
        y:  rand(r, logH - r),
        vx: rand(-1.2, 1.2),
        vy: rand(-1.2, 1.2),
        r,
        color: colors[Math.floor(Math.random() * colors.length)],
      };
    });

    const mouse = { x: logW * 0.5, y: logH * 0.4 };
    let rafId;

    // ── Animation loop ─────────────────────────────────────
    function tick() {
      ctx.clearRect(0, 0, logW, logH);

      // 1. Update velocities
      for (let i = 0; i < balls.length; i++) {
        const b = balls[i];

        if (followCursor) {
          const dx = mouse.x - b.x;
          const dy = mouse.y - b.y;
          const d  = Math.sqrt(dx * dx + dy * dy) || 1;
          if (d < ATTRACT_R) {
            const f = (1 - d / ATTRACT_R) * ATTRACT_K;
            b.vx += (dx / d) * f;
            b.vy += (dy / d) * f;
          }
        }

        b.vy += gravity * GRAVITY_K;
        b.vx *= DAMPING;
        b.vy *= DAMPING;

        // clamp speed
        const sp = Math.hypot(b.vx, b.vy);
        if (sp > MAX_SPEED) { const s = MAX_SPEED / sp; b.vx *= s; b.vy *= s; }

        // integrate position
        b.x += b.vx;
        b.y += b.vy;

        // wall bounce
        if (b.x - b.r < 0)    { b.x = b.r;       b.vx =  Math.abs(b.vx) * RESTITUTION; }
        if (b.x + b.r > logW) { b.x = logW - b.r; b.vx = -Math.abs(b.vx) * RESTITUTION; }
        if (b.y - b.r < 0)    { b.y = b.r;       b.vy =  Math.abs(b.vy) * RESTITUTION; }
        if (b.y + b.r > logH) { b.y = logH - b.r; b.vy = -Math.abs(b.vy) * RESTITUTION; }
      }

      // 2. Ball–ball elastic collisions (O(n²), fine for ≤200 balls)
      for (let i = 0; i < balls.length; i++) {
        for (let j = i + 1; j < balls.length; j++) {
          const a = balls[i], b = balls[j];
          const dx   = b.x - a.x, dy = b.y - a.y;
          const dSq  = dx * dx + dy * dy;
          const minD = a.r + b.r;
          if (dSq >= minD * minD) continue;

          const d  = Math.sqrt(dSq) || 0.01;
          const nx = dx / d, ny = dy / d;

          // separate overlapping balls
          const push = (minD - d) * 0.5;
          a.x -= nx * push; a.y -= ny * push;
          b.x += nx * push; b.y += ny * push;

          // impulse along normal
          const imp = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
          if (imp > 0) {
            a.vx -= imp * nx * RESTITUTION;
            a.vy -= imp * ny * RESTITUTION;
            b.vx += imp * nx * RESTITUTION;
            b.vy += imp * ny * RESTITUTION;
          }
        }
      }

      // 3. Draw
      for (const b of balls) {
        // main sphere
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fillStyle = b.color;
        ctx.fill();

        // specular highlight (gives 3-D depth without gradient cost)
        ctx.beginPath();
        ctx.arc(b.x - b.r * 0.22, b.y - b.r * 0.28, b.r * 0.40, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.20)';
        ctx.fill();
      }

      rafId = requestAnimationFrame(tick);
    }

    // ── Event listeners ────────────────────────────────────
    const onResize    = () => applySize();
    const onMouseMove = (e) => { mouse.x = e.clientX; mouse.y = e.clientY; };
    const onTouch     = (e) => { mouse.x = e.touches[0].clientX; mouse.y = e.touches[0].clientY; };

    window.addEventListener('resize',    onResize);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('touchmove', onTouch, { passive: true });

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize',    onResize);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove', onTouch);
    };
  }, []); // empty deps: physics engine is fully self-contained

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position:      'fixed',
        top:           0,
        left:          0,
        pointerEvents: 'none',
        zIndex:        0,
      }}
    />
  );
}

// memo() prevents ANY re-render when parent state changes — critical for perf
export default memo(Ballpit);
