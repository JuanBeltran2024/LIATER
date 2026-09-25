import { useEffect, useRef } from 'react';

/**
 * LightningBrandCanvas
 *
 * Dibuja el nombre del laboratorio con una descarga eléctrica
 * que lo envuelve de forma continua (sin parpadeo), como una
 * corriente orbitando el texto en espiral.
 */
export default function LightningBrandCanvas({
  line1 = 'LABORATORIO DE INVESTIGACIÓN EN ALTA',
  line2 = 'TENSIÓN Y ENERGÍAS RENOVABLES',
  width = 430,
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const DPR = window.devicePixelRatio || 1;

    // ── Tipografía y dimensiones ────────────────────────────────────────────
    const fontSize  = 13;
    const lineH     = fontSize * 1.38;
    const textLines = line2 ? [line1, line2] : [line1];
    const padX      = 30;   // espacio horizontal para el rayo fuera del texto
    const padY      = 28;   // espacio vertical para el rayo arriba y abajo

    const W = width;
    // Medimos el ancho real del texto para hacer la elipse exacta
    const tmpCtx = document.createElement('canvas').getContext('2d');
    tmpCtx.font = `800 ${fontSize}px 'Inter','Outfit',sans-serif`;
    const maxTextW = Math.max(...textLines.map(l => tmpCtx.measureText(l).width));
    const textH    = textLines.length * lineH;
    const H        = Math.ceil(textH + padY * 2);

    canvas.width        = W * DPR;
    canvas.height       = H * DPR;
    canvas.style.width  = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.scale(DPR, DPR);

    // ── Elipse que rodea el texto ───────────────────────────────────────────
    const cx = W / 2;           // centro X del canvas
    const cy = H / 2;           // centro Y
    const rx = maxTextW / 2 + padX;   // radio horizontal de la elipse
    const ry = textH   / 2 + padY * 0.7;   // radio vertical

    // ── Pre-generamos offsets de fase por punto (ruido "frozen") ─────────────
    const N_POINTS = 160;          // puntos de muestreo en la elipse
    const N_HARMONICS = 3;         // cuántas ondas sinusoidales superponer
    // Para cada punto: array de [frecuencia, amplitude, velocidad, fase]
    const harmonics = Array.from({ length: N_HARMONICS }, (_, h) => ({
      freq  : 3 + h * 2.5,         // frecuencia espacial (oscilaciones por vuelta)
      amp   : 6 - h * 1.5,         // amplitud de desplazamiento en px
      speed : 0.8 + h * 0.55,      // velocidad angular (rad/s @ 60fps)
      phase : Math.random() * Math.PI * 2,
    }));

    // Ramificaciones: pequeñas chispas que salen y entran
    const N_SPARKS = 6;
    const sparks = Array.from({ length: N_SPARKS }, () => ({
      t      : Math.random(),       // posición 0-1 en la elipse
      tSpeed : 0.0015 + Math.random() * 0.002, // velocidad de desplazamiento
      len    : 10 + Math.random() * 18,
      angle  : (Math.random() - 0.5) * Math.PI * 0.4,
      alpha  : 0.3 + Math.random() * 0.5,
    }));

    // ── Helpers ────────────────────────────────────────────────────────────
    // Punto en la elipse + desplazamiento radial dado el tiempo t (0..1)
    function ellipsePoint(t, time) {
      const angle = t * Math.PI * 2;
      // base sobre la elipse
      const bx = cx + rx * Math.cos(angle);
      const by = cy + ry * Math.sin(angle);
      // vector normal (hacia afuera)
      const nx = Math.cos(angle);
      const ny = Math.sin(angle);
      // suma de armónicos para el desplazamiento radial
      let d = 0;
      for (const h of harmonics) {
        d += h.amp * Math.sin(h.freq * angle + h.speed * time + h.phase);
      }
      return [bx + nx * d, by + ny * d];
    }

    // ── Dibuja el arco eléctrico completo ──────────────────────────────────
    function drawArc(time) {
      const pts = [];
      for (let i = 0; i <= N_POINTS; i++) {
        pts.push(ellipsePoint(i / N_POINTS, time));
      }

      // --- Glow exterior (naranja-dorado) ---
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
      ctx.strokeStyle = 'rgba(255, 120, 0, 0.45)';
      ctx.lineWidth   = 7;
      ctx.lineJoin    = 'round';
      ctx.stroke();

      // --- Núcleo blanco nítido ---
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
      ctx.strokeStyle = 'rgba(255, 255, 220, 0.92)';
      ctx.lineWidth   = 1.4;
      ctx.lineJoin    = 'round';
      ctx.stroke();

      return pts;
    }

    // ── Dibuja las chispas que orbitan ────────────────────────────────────
    function drawSparks(time) {
      sparks.forEach(spark => {
        spark.t = (spark.t + spark.tSpeed) % 1;
        const [bx, by] = ellipsePoint(spark.t, time);
        const angle    = spark.t * Math.PI * 2;
        // dirección radial + rotación propia
        const dir = angle + spark.angle + time * 0.5;
        const ex  = bx + Math.cos(dir) * spark.len;
        const ey  = by + Math.sin(dir) * spark.len * 0.5;

        // glow
        ctx.beginPath();
        ctx.moveTo(bx, by); ctx.lineTo(ex, ey);
        ctx.strokeStyle = `rgba(255, 110, 0, ${spark.alpha * 0.5})`;
        ctx.lineWidth   = 3; ctx.lineCap = 'round'; ctx.stroke();
        // núcleo
        ctx.beginPath();
        ctx.moveTo(bx, by); ctx.lineTo(ex, ey);
        ctx.strokeStyle = `rgba(255, 255, 200, ${spark.alpha})`;
        ctx.lineWidth   = 0.9; ctx.lineCap = 'round'; ctx.stroke();
      });
    }

    // ── Dibuja el texto ────────────────────────────────────────────────────
    function drawText() {
      ctx.save();
      ctx.font         = `800 ${fontSize}px 'Inter','Outfit',sans-serif`;
      ctx.fillStyle    = '#FFFFFF';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      const startY = cy - ((textLines.length - 1) * lineH) / 2;
      textLines.forEach((line, i) => {
        ctx.fillText(line, cx, startY + i * lineH);
      });
      ctx.restore();
    }

    // ── Loop de animación ─────────────────────────────────────────────────
    let animId;
    let t = 0;

    const render = () => {
      t += 0.018;   // velocidad de flujo del rayo (aumentar = más rápido)
      ctx.clearRect(0, 0, W, H);
      drawArc(t);
      drawSparks(t);
      drawText();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [width, line1, line2]);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', pointerEvents: 'none' }}
    />
  );
}
