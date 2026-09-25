import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import {
  ArrowLeft, Award, CheckCircle2, Clock, TrendingUp,
  BookOpen, AlertCircle, BarChart2, Star, ChevronRight
} from 'lucide-react';

/* ─────────────────────────────────────────────────────
   HELPERS — usando variables CSS del sistema LIATER
   Paleta: --navy, --gold, --green-600, --warning, --error
───────────────────────────────────────────────────── */
function scoreTheme(score) {
  if (score === null || score === undefined) return { color: 'var(--text-muted)', bg: 'var(--surface-light)', border: 'var(--border-color)' };
  if (score >= 70) return { color: 'var(--green-600)', bg: 'var(--green-subtle)', border: 'var(--green-400)' };
  if (score >= 50) return { color: 'var(--warning)',   bg: 'var(--gold-subtle)',  border: 'var(--gold-light)' };
  return              { color: 'var(--error)',          bg: 'rgba(220,38,38,0.07)', border: 'rgba(220,38,38,0.3)' };
}

function ScoreBadge({ score }) {
  const theme = scoreTheme(score);
  const label = score >= 70 ? '✓ Aprobado' : score >= 50 ? '~ En proceso' : '✗ Repasar';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
      padding: '0.2rem 0.65rem', borderRadius: '999px',
      background: theme.bg, color: theme.color, border: `1px solid ${theme.border}`,
      fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap'
    }}>
      {label}
    </span>
  );
}

function StatCard({ icon, label, value, sub, color = 'var(--navy)', bgColor = 'rgba(20,33,61,0.06)' }) {
  return (
    <div style={{
      background: 'var(--white)', border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-lg)', padding: '1.25rem 1.5rem',
      display: 'flex', alignItems: 'center', gap: '1rem',
      boxShadow: 'var(--shadow-xs)'
    }}>
      <div style={{
        width: '48px', height: '48px', borderRadius: 'var(--radius-md)',
        background: bgColor, display: 'flex', alignItems: 'center',
        justifyContent: 'center', flexShrink: 0
      }}>
        {icon}
      </div>
      <div>
        <p style={{ fontSize: '1.75rem', fontWeight: 800, color, lineHeight: 1, margin: 0 }}>{value}</p>
        <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--navy)', margin: '0.2rem 0 0 0' }}>{label}</p>
        {sub && <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: '0.1rem 0 0 0' }}>{sub}</p>}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   COMPONENTE PRINCIPAL
───────────────────────────────────────────────────── */
export default function MisResultados() {
  const { programId } = useParams();
  const { currentUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [programTitle, setProgramTitle] = useState('');
  const [results, setResults] = useState([]);
  const [stats, setStats] = useState({ total: 0, completed: 0, pending: 0, average: 0, best: 0 });

  const cleanProgramId = programId
    ? decodeURIComponent(programId).replace(/\s+/g, '-').trim()
    : '';

  useEffect(() => {
    async function load() {
      if (!cleanProgramId || !currentUser?.id) { setLoading(false); return; }
      try {
        setLoading(true);

        // 1. Título del programa
        const { data: prog } = await supabase
          .from('diploma_programs')
          .select('title')
          .eq('id', cleanProgramId)
          .maybeSingle();
        setProgramTitle(prog?.title || 'Programa');

        // 2. Todas las clases del programa
        const { data: classes } = await supabase
          .from('class_sessions')
          .select('id, title, class_date')
          .eq('program_id', cleanProgramId)
          .order('class_date', { ascending: true });

        if (!classes || classes.length === 0) { setLoading(false); return; }

        const classIds = classes.map(c => c.id);

        // 3. Actividades publicadas de esas clases
        const { data: activities } = await supabase
          .from('class_activities')
          .select('id, title, class_id, is_mandatory')
          .eq('is_published', true)
          .in('class_id', classIds);

        if (!activities || activities.length === 0) { setLoading(false); return; }

        const activityIds = activities.map(a => a.id);

        // 4. Intentos completados — ordenados desc para tomar el mejor
        const { data: attempts } = await supabase
          .from('activity_attempts')
          .select('id, activity_id, score, completed_at, status')
          .eq('student_id', currentUser.id)
          .eq('status', 'completed')
          .in('activity_id', activityIds)
          .order('score', { ascending: false });

        const attemptIds = (attempts || []).map(a => a.id).filter(Boolean);
        let attemptAnswersMap = {};

        if (attemptIds.length > 0) {
          const { data: ansData } = await supabase
            .from('attempt_answers')
            .select('attempt_id, is_correct')
            .in('attempt_id', attemptIds);

          if (ansData && ansData.length > 0) {
            ansData.forEach(ans => {
              if (!attemptAnswersMap[ans.attempt_id]) {
                attemptAnswersMap[ans.attempt_id] = { total: 0, correct: 0 };
              }
              attemptAnswersMap[ans.attempt_id].total++;
              if (ans.is_correct) {
                attemptAnswersMap[ans.attempt_id].correct++;
              }
            });
          }
        }

        // Mapa: activity_id → mejor intento (primero en lista ordenada desc)
        const bestAttemptMap = {};
        (attempts || []).forEach(att => {
          let realScore = att.score;
          const ansStats = attemptAnswersMap[att.id];
          if (ansStats && ansStats.total > 0) {
            realScore = Math.round((ansStats.correct / ansStats.total) * 100);
            // Sincronizar con Supabase si el puntaje guardado difiere del real
            if (realScore !== att.score) {
              supabase.from('activity_attempts').update({ score: realScore }).eq('id', att.id).then(() => {});
            }
          }

          const processedAtt = { ...att, score: realScore };

          if (!bestAttemptMap[att.activity_id] || processedAtt.score > bestAttemptMap[att.activity_id].score) {
            bestAttemptMap[att.activity_id] = processedAtt;
          }
        });

        const classMap = {};
        classes.forEach(c => { classMap[c.id] = c; });

        // 5. Lista enriquecida
        const enriched = activities.map(act => {
          const cls = classMap[act.class_id] || {};
          const attempt = bestAttemptMap[act.id] || null;
          return {
            activityId: act.id,
            activityTitle: act.title || 'Actividad de Reforzamiento',
            classId: act.class_id,
            classTitle: cls.title || 'Clase',
            classDate: cls.class_date,
            isMandatory: act.is_mandatory,
            attempt,
            score: attempt?.score ?? null,
            completedAt: attempt?.completed_at ?? null,
            status: attempt ? 'completada' : 'pendiente'
          };
        }).sort((a, b) => {
          if (a.classDate && b.classDate) return new Date(b.classDate) - new Date(a.classDate);
          return 0;
        });

        // 6. Estadísticas
        const completed = enriched.filter(r => r.status === 'completada');
        const scores = completed.map(r => r.score).filter(s => s !== null);
        const avg  = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
        const best = scores.length > 0 ? Math.max(...scores) : 0;

        setResults(enriched);
        setStats({ total: enriched.length, completed: completed.length, pending: enriched.length - completed.length, average: avg, best });

      } catch (err) {
        console.error('Error loading results:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [cleanProgramId, currentUser?.id]);

  /* ── SKELETON ── */
  if (loading) {
    return (
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1rem 0', animation: 'fadeSlideUp 0.35s ease-out' }}>
        <div className="skeleton" style={{ width: '140px', height: '20px', marginBottom: '1rem' }} />
        <div className="skeleton" style={{ width: '60%', height: '36px', marginBottom: '2rem' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: '88px', borderRadius: 'var(--radius-lg)' }} />)}
        </div>
        {[1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: '72px', borderRadius: 'var(--radius-md)', marginBottom: '0.75rem' }} />)}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', animation: 'fadeSlideUp 0.35s ease-out' }}>

      {/* BREADCRUMB */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <Link to={`/dashboard/${cleanProgramId}`} className="btn btn-outline" style={{ fontSize: '0.82rem', padding: '0.4rem 0.85rem' }}>
          <ArrowLeft size={14} /> Volver al Panel
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
          <ChevronRight size={14} />
          <Link to="/portal" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Mis Programas</Link>
          <ChevronRight size={14} />
          <Link to={`/dashboard/${cleanProgramId}`} style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>{programTitle}</Link>
          <ChevronRight size={14} />
          <span style={{ color: 'var(--navy)', fontWeight: 700 }}>Mis Resultados</span>
        </div>
      </div>

      {/* ENCABEZADO */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--navy)', margin: '0 0 0.3rem 0', lineHeight: 1.2 }}>
          Mis Resultados
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
          Actividades de reforzamiento · <strong style={{ color: 'var(--navy)' }}>{programTitle}</strong>
        </p>
      </div>

      {/* MÉTRICAS — paleta del sistema */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <StatCard
          icon={<CheckCircle2 size={22} color="var(--green-600)" />}
          label="Completadas"
          value={`${stats.completed}/${stats.total}`}
          sub={`${stats.pending} pendiente${stats.pending !== 1 ? 's' : ''}`}
          color="var(--green-600)"
          bgColor="var(--green-subtle)"
        />
        <StatCard
          icon={<TrendingUp size={22} color="var(--gold-dark)" />}
          label="Nota Promedio"
          value={stats.completed > 0 ? `${stats.average}%` : '—'}
          sub={stats.completed > 0 ? (stats.average >= 70 ? 'Buen rendimiento' : 'Sigue practicando') : 'Sin completar aún'}
          color={stats.completed > 0 ? scoreTheme(stats.average).color : 'var(--text-muted)'}
          bgColor="var(--gold-subtle)"
        />
        <StatCard
          icon={<Star size={22} color="var(--gold-dark)" />}
          label="Mejor Nota"
          value={stats.completed > 0 ? `${stats.best}%` : '—'}
          sub={stats.completed > 0 ? 'Tu mayor puntaje' : 'Sin completar aún'}
          color={stats.completed > 0 ? scoreTheme(stats.best).color : 'var(--text-muted)'}
          bgColor="var(--gold-subtle)"
        />
        <StatCard
          icon={<BarChart2 size={22} color="var(--navy)" />}
          label="Actividades Totales"
          value={stats.total}
          sub="en este programa"
          color="var(--navy)"
          bgColor="rgba(20,33,61,0.06)"
        />
      </div>

      {/* LISTA DE RESULTADOS */}
      {results.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '4rem 2rem',
          background: 'rgba(20,33,61,0.02)', borderRadius: 'var(--radius-lg)',
          border: '1px dashed var(--border-color)'
        }}>
          <BarChart2 size={40} color="var(--navy)" style={{ opacity: 0.2, marginBottom: '1rem' }} />
          <h3 style={{ color: 'var(--navy)', fontWeight: 700, margin: '0 0 0.5rem 0' }}>Sin actividades registradas</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: 0 }}>
            Este programa aún no tiene actividades de reforzamiento publicadas.
          </p>
        </div>
      ) : (
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--navy)', marginBottom: '1rem' }}>
            Detalle por Actividad
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {results.map(r => {
              const th = scoreTheme(r.score);
              const isCompleted = r.status === 'completada';
              return (
                <Link
                  key={r.activityId}
                  to={`/class/${r.classId}`}
                  style={{ textDecoration: 'none' }}
                >
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '1rem',
                    padding: '1rem 1.25rem',
                    background: 'var(--white)',
                    border: `1px solid var(--border-color)`,
                    borderLeft: `4px solid ${isCompleted ? th.color : 'var(--gold)'}`,
                    borderRadius: 'var(--radius-md)',
                    transition: 'var(--transition-fast)',
                    cursor: 'pointer'
                  }}
                    onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
                    onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    {/* ÍCONO DE ESTADO */}
                    <div style={{
                      width: '38px', height: '38px', borderRadius: 'var(--radius-md)', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: isCompleted ? th.bg : 'var(--gold-subtle)'
                    }}>
                      {isCompleted
                        ? <Award size={18} color={th.color} />
                        : <Clock size={18} color="var(--gold-dark)" />
                      }
                    </div>

                    {/* INFO PRINCIPAL */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.2rem' }}>
                        <span style={{ fontWeight: 700, color: 'var(--navy)', fontSize: '0.9rem' }}>
                          {r.activityTitle}
                        </span>
                        {r.isMandatory && (
                          <span style={{
                            fontSize: '0.65rem', fontWeight: 700,
                            color: 'var(--gold-dark)', background: 'var(--gold-subtle)',
                            padding: '0.1rem 0.4rem', borderRadius: '999px',
                            border: '1px solid var(--gold-light)'
                          }}>
                            OBLIGATORIA
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <BookOpen size={12} /> {r.classTitle}
                        {r.classDate && (
                          <> · {new Date(r.classDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}</>
                        )}
                      </span>
                    </div>

                    {/* RESULTADO */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      {isCompleted ? (
                        <>
                          <p style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 0.15rem 0', color: th.color }}>
                            {r.score}%
                          </p>
                          <ScoreBadge score={r.score} />
                          {r.completedAt && (
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>
                              {new Date(r.completedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                            </p>
                          )}
                        </>
                      ) : (
                        <span style={{
                          fontSize: '0.78rem', fontWeight: 700,
                          color: 'var(--gold-dark)', background: 'var(--gold-subtle)',
                          padding: '0.25rem 0.65rem', borderRadius: '999px',
                          border: '1px solid var(--gold-light)'
                        }}>
                          Pendiente
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* TIP INFORMATIVO */}
          <div style={{
            marginTop: '1.5rem', padding: '1rem 1.25rem',
            background: 'var(--surface-light)', border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)', display: 'flex', gap: '0.75rem', alignItems: 'flex-start'
          }}>
            <AlertCircle size={16} color="var(--text-muted)" style={{ flexShrink: 0, marginTop: '0.1rem' }} />
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
              Se muestra el <strong>mejor intento</strong> por actividad. Haz clic en cualquier fila para ir a la clase y ver o volver a intentar la actividad si está disponible.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
