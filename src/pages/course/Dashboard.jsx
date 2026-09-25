import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import { calculateProgramProgressDetails } from '@/services/programService';
import { isClassLiveOrSoon, isClassActiveOrUpcoming, safeFormatTime, safeFormatDate } from '@/utils/dateUtils';
import {
  PlayCircle, BookOpen, Calendar, CalendarPlus, Video, Clock, User, Megaphone,
  ArrowRight, ArrowLeft, ChevronRight, MessageSquare, Award,
  CheckCircle2, TrendingUp, BarChart2, AlertTriangle, Layers,
  Paperclip, Home, ListTree, Users
} from 'lucide-react';

/* ─────────────────────────────────────────────────────
   HELPER: Enlace para agregar evento a Google Calendar
───────────────────────────────────────────────────── */
function getGoogleCalendarUrl(cls, programTitle) {
  if (!cls?.class_date) return null;
  try {
    const startDate = new Date(cls.class_date);
    if (isNaN(startDate.getTime())) return null;
    const durationMinutes = Number(cls.duration) || 90;
    const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);

    const formatUtc = (d) => d.toISOString().replace(/-|:|\.\d+/g, '');
    const dates = `${formatUtc(startDate)}/${formatUtc(endDate)}`;

    const title = encodeURIComponent(`${cls.title || 'Clase en vivo'} | ${programTitle || 'LIATER UNAL'}`);
    const details = encodeURIComponent(
      `Sesión en vivo: ${cls.title}\nDocente: ${cls.teacher_profiles?.name || 'Profesor'}\nPlataforma: Portal Educativo LIATER - Universidad Nacional de Colombia\nEnlace de acceso: ${cls.meet_url || 'https://liater.unal.edu.co'}`
    );
    const location = encodeURIComponent(cls.meet_url || 'Online - Portal LIATER');

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&location=${location}`;
  } catch (err) {
    console.error('Error generating Google Calendar URL:', err);
    return null;
  }
}

/* ─────────────────────────────────────────────────────
   HELPER: Enlace de Google Calendar para una SESIÓN (agrupa sus clases)
───────────────────────────────────────────────────── */
function getSessionGoogleCalendarUrl(session, programTitle, fallbackMeetUrl) {
  if (!session?.startDate) return null;
  try {
    const startDate = session.startDate;
    if (isNaN(startDate.getTime())) return null;
    const endDate = session.endDate && !isNaN(session.endDate.getTime())
      ? session.endDate
      : new Date(startDate.getTime() + 90 * 60 * 1000);

    const formatUtc = (d) => d.toISOString().replace(/-|:|\.\d+/g, '');
    const dates = `${formatUtc(startDate)}/${formatUtc(endDate)}`;

    const title = encodeURIComponent(`${session.title || 'Sesión en vivo'} | ${programTitle || 'LIATER UNAL'}`);

    const classLines = (session.classes || []).map(c => {
      const time = safeFormatTime(c.class_date);
      return `• ${c.title}${time ? ` (${time} hs)` : ''}`;
    }).join('\n');

    const details = encodeURIComponent(
      `🏛️ PORTAL EDUCATIVO LIATER — UNAL\n` +
      (programTitle ? `📚 Programa: ${programTitle}\n` : '') +
      `📌 Sesión: ${session.title}\n` +
      ((session.classes && session.classes.length > 1) ? `\n📋 Clases comprendidas (${session.classes.length}):\n${classLines}\n` : '') +
      `\n👨‍🏫 Docente(s): ${session.teachers || 'Profesor'}\n` +
      `🔗 Enlace de acceso: ${session.meetUrl || fallbackMeetUrl || 'https://liater.unal.edu.co'}\n` +
      `🌐 Aula Virtual LIATER`
    );
    const location = encodeURIComponent(session.meetUrl || fallbackMeetUrl || 'Online - Portal LIATER');

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&location=${location}`;
  } catch (err) {
    console.error('Error generating Google Calendar URL for session:', err);
    return null;
  }
}

/* ─────────────────────────────────────────────────────
   HELPER: Agrupar clases próximas en sesiones
───────────────────────────────────────────────────── */
function groupClassesIntoSessions(classes = [], sessionMap = {}) {
  if (!Array.isArray(classes) || classes.length === 0) return [];

  const activeOrUpcoming = classes.filter(c => isClassActiveOrUpcoming(c));
  if (activeOrUpcoming.length === 0) return [];

  const groups = new Map();

  activeOrUpcoming.forEach(c => {
    // Si la clase tiene subtopic_id, se agrupa por ese ID de sesión; si no, por el id de la clase
    const key = c.subtopic_id ? `session_${c.subtopic_id}` : `class_${c.id}`;

    if (!groups.has(key)) {
      const sessionTitle = (c.subtopic_id && sessionMap[c.subtopic_id])
        ? sessionMap[c.subtopic_id]
        : (c.sessionTitle || c.title);

      groups.set(key, {
        id: key,
        sessionId: c.subtopic_id || null,
        title: sessionTitle,
        classes: [],
        earliestTime: c.class_date ? new Date(c.class_date).getTime() : Infinity
      });
    }

    const group = groups.get(key);
    group.classes.push(c);
    const cTime = c.class_date ? new Date(c.class_date).getTime() : Infinity;
    if (cTime < group.earliestTime) {
      group.earliestTime = cTime;
    }
  });

  const result = Array.from(groups.values()).sort((a, b) => a.earliestTime - b.earliestTime);

  return result.map(session => {
    session.classes.sort((a, b) => {
      const tA = a.class_date ? new Date(a.class_date).getTime() : 0;
      const tB = b.class_date ? new Date(b.class_date).getTime() : 0;
      return tA - tB;
    });

    const firstClass = session.classes[0];
    const lastClass = session.classes[session.classes.length - 1];

    const rawStart = firstClass?.class_date ? new Date(firstClass.class_date) : null;
    const startDate = (rawStart && !isNaN(rawStart.getTime())) ? rawStart : null;
    let endDate = null;
    if (lastClass?.class_date) {
      const rawEnd = new Date(lastClass.class_date);
      if (!isNaN(rawEnd.getTime())) {
        const durationMin = Number(lastClass.duration) || 90;
        endDate = new Date(rawEnd.getTime() + durationMin * 60 * 1000);
      }
    }

    const teacherNames = Array.from(new Set(
      session.classes.map(c => c.teacher_profiles?.name).filter(Boolean)
    ));

    const liveClass = session.classes.find(c => isClassLiveOrSoon(c, 10));
    const meetUrl = liveClass?.meet_url || firstClass?.meet_url || null;

    return {
      ...session,
      startDate,
      endDate,
      teachers: teacherNames.join(', '),
      isLiveNow: !!liveClass,
      liveClass,
      meetUrl,
      firstClass
    };
  });
}

/* ─────────────────────────────────────────────────────
   HELPER: Fila de contenido de clase con estado riguroso
───────────────────────────────────────────────────── */
function ClassRow({ cls, activityInfo }) {
  const hasRecording = !!cls.video_url;
  const classDate = cls.class_date ? new Date(cls.class_date) : null;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  const isToday = classDate && classDate >= todayStart && classDate <= todayEnd;
  const isPast = classDate && classDate < todayStart;

  // Determinación rigurosa del estado para máxima consistencia pedagógica
  const hasActivity = !!activityInfo?.has;
  const isActivityCompleted = hasActivity && activityInfo?.completed;
  const isActivityPending = hasActivity && !activityInfo?.completed && (isPast || hasRecording || isToday);

  let badgeConfig = null;

  if (isActivityCompleted) {
    // Si completó y aprobó la actividad de reforzamiento
    badgeConfig = {
      bg: 'var(--green-subtle, #f0fdf4)',
      color: 'var(--green-600, #16a34a)',
      border: '1px solid var(--green-400, #86efac)',
      label: '✓ Completada'
    };
  } else if (isActivityPending) {
    // Si la clase ya ocurrió o es hoy pero aún no realiza la actividad
    badgeConfig = {
      bg: '#fffbeb',
      color: '#b45309',
      border: '1px solid #fde68a',
      label: '⚠️ Actividad pendiente'
    };
  } else if (isToday) {
    // Clase programada para hoy
    badgeConfig = {
      bg: '#fee2e2',
      color: '#dc2626',
      border: '1px solid #fca5a5',
      label: '🔴 Hoy en vivo'
    };
  } else if (hasRecording) {
    // Grabación lista para estudiar
    badgeConfig = {
      bg: 'var(--gold-subtle, #fef9ec)',
      color: 'var(--gold-dark, #b45309)',
      border: '1px solid rgba(252, 163, 17, 0.4)',
      label: '▶ Grabación lista'
    };
  } else if (isPast) {
    // Ya se dictó en vivo pero aún no se ha subido la grabación
    badgeConfig = {
      bg: '#f1f5f9',
      color: '#475569',
      border: '1px solid #cbd5e1',
      label: '⏳ Grabación pendiente'
    };
  } else {
    // Clase futura en el calendario
    badgeConfig = {
      bg: '#f8fafc',
      color: '#64748b',
      border: '1px solid #e2e8f0',
      label: '🗓️ Programada'
    };
  }

  return (
    <Link
      to={`/class/${cls.id}`}
      style={{ textDecoration: 'none' }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.85rem',
        padding: '0.8rem 1rem',
        border: '1px solid var(--border-color)',
        borderLeft: `4px solid ${isActivityCompleted ? 'var(--green-600, #16a34a)' : hasRecording ? 'var(--gold, #fca311)' : isToday ? '#dc2626' : 'var(--navy)'}`,
        borderRadius: 'var(--radius-md)',
        background: isToday ? '#fff8f8' : 'var(--white)',
        transition: 'var(--transition-fast)',
        cursor: 'pointer'
      }}
        onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.borderColor = 'var(--navy-light)'; }}
        onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'var(--border-color)'; }}
      >
        {/* Icono de recurso / estado */}
        <div style={{
          width: '36px', height: '36px', borderRadius: 'var(--radius-sm)', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: isActivityCompleted
            ? 'var(--green-subtle, #f0fdf4)'
            : hasRecording
              ? 'var(--gold-subtle, #fef9ec)'
              : isToday
                ? '#fee2e2'
                : 'rgba(20,33,61,0.05)'
        }}>
          {isActivityCompleted ? (
            <CheckCircle2 size={17} color="var(--green-600, #16a34a)" />
          ) : hasRecording ? (
            <PlayCircle size={17} color="var(--gold-dark, #b45309)" />
          ) : isToday ? (
            <Video size={17} color="#dc2626" />
          ) : (
            <Video size={17} color="var(--gray-dark, #64748b)" />
          )}
        </div>

        {/* Información de la Clase */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 700, color: 'var(--navy)', fontSize: '0.88rem',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {cls.title}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.2rem', flexWrap: 'wrap' }}>
            {cls.sessionTitle && (
              <span style={{
                fontSize: '0.72rem',
                color: 'var(--gold-dark, #b45309)',
                fontWeight: 700,
                background: 'var(--gold-subtle, #fef9ec)',
                padding: '0.08rem 0.45rem',
                borderRadius: '4px',
                border: '1px solid rgba(252, 163, 17, 0.25)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}>
                <Layers size={11} color="var(--gold-dark, #b45309)" />
                {cls.sessionTitle}
              </span>
            )}
            <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              {cls.sessionTitle ? '· ' : ''}
              {safeFormatDate(classDate, 'Sin fecha')}
            </p>
            {cls.teacher_profiles?.name && (
              <span style={{ fontSize: '0.72rem', color: 'var(--navy)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                · <User size={11} color="var(--gold-dark)" /> {cls.teacher_profiles.name}
              </span>
            )}
          </div>
        </div>

        {/* Badge de estado riguroso */}
        {badgeConfig && (
          <span style={{
            fontSize: '0.68rem', fontWeight: 700, flexShrink: 0,
            padding: '0.2rem 0.55rem', borderRadius: '999px',
            background: badgeConfig.bg,
            color: badgeConfig.color,
            border: badgeConfig.border,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem'
          }}>
            {badgeConfig.label}
          </span>
        )}

        <ChevronRight size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
      </div>
    </Link>
  );
}

/* ─────────────────────────────────────────────────────
   COMPONENTE PRINCIPAL
───────────────────────────────────────────────────── */
export default function Dashboard() {
  const { programId } = useParams();
  const { currentUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [hasNewAnnouncements, setHasNewAnnouncements] = useState(false);
  const [activityStats, setActivityStats] = useState({ completedCount: 0, totalCount: 0, averageScore: 0 });
  const [recentClasses, setRecentClasses] = useState([]);

  const [dashboardData, setDashboardData] = useState({
    diplomaTitle: 'Programa Académico',
    programType: 'diplomado',
    modulesCount: 0,
    sessionsCount: 0,
    totalClassesCount: 0,
    upcomingClasses: [],
    sessionMap: {},
    latestRecordings: [],
    firstModuleId: null,
    announcements: [],
    meetUrl: null
  });

  const cleanProgramId = programId
    ? decodeURIComponent(programId).replace(/\s+/g, '-').trim()
    : '';
  const seenAnnouncementsKey = `seen_announcements_${programId}`;
  const [, setTimeTick] = useState(0);

  // Actualizador periódico cada 30 segundos para recalcular ventana de 10 min en tiempo real
  useEffect(() => {
    const timer = setInterval(() => setTimeTick(t => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    async function fetchDashboardData() {
      if (!cleanProgramId) { setLoading(false); return; }
      try {
        setLoading(true);
        const todayStartIso = new Date(new Date().setHours(0,0,0,0)).toISOString();

        // ─── BLOQUE 1: consultas independientes en paralelo ───
        const [
          { data: diplomaData },
          { data: modulesData },
          { data: upcomingData },
          { data: announcementsData },
          { data: allClassesData },
          sessionsRes,
          { count: totalClassesCount }
        ] = await Promise.all([
          supabase
            .from('diploma_programs')
            .select('title, program_type, is_published, status, meet_url')
            .eq('id', cleanProgramId)
            .maybeSingle(),
          supabase
            .from('modules')
            .select('id')
            .eq('program_id', cleanProgramId)
            .order('order_index', { ascending: true }),
          supabase
            .from('class_sessions')
            .select('id, title, class_date, duration, video_url, meet_url, subtopic_id, teacher_profiles(name)')
            .eq('program_id', cleanProgramId)
            .gte('class_date', todayStartIso)
            .order('class_date', { ascending: true })
            .limit(30),
          supabase
            .from('announcements')
            .select('*, teacher_profiles(name)')
            .eq('program_id', cleanProgramId)
            .order('created_at', { ascending: false })
            .limit(5),
          supabase
            .from('class_sessions')
            .select('id, title, class_date, duration, video_url, meet_url, subtopic_id, teacher_profiles(name)')
            .eq('program_id', cleanProgramId)
            .order('class_date', { ascending: true, nullsFirst: false }),
          supabase
            .from('subtopics')
            .select('id, title, module_id, order_index')
            .eq('program_id', cleanProgramId),
          supabase
            .from('class_sessions')
            .select('id', { count: 'exact', head: true })
            .eq('program_id', cleanProgramId)
        ]);

        const isPublished = diplomaData
          ? (diplomaData.is_published !== false
              && diplomaData.status !== 'draft'
              && diplomaData.status !== 'disabled')
          : true;
        const freshAnnouncements = isPublished ? (announcementsData || []) : [];

        // Conteo y mapeo de sesiones
        let programSessions = sessionsRes?.data || [];
        if (programSessions.length === 0 && modulesData && modulesData.length > 0) {
          const modIds = modulesData.map(m => m.id);
          const { data: modSessions } = await supabase
            .from('subtopics')
            .select('id, title, module_id, order_index')
            .in('module_id', modIds);
          programSessions = modSessions || [];
        }

        const sessionMap = {};
        programSessions.forEach(s => {
          if (s.id && s.title) sessionMap[s.id] = s.title;
        });

        const calculatedSessionsCount = programSessions.length || 0;

        const mappedUpcoming = (upcomingData || []).map(c => ({
          ...c,
          sessionTitle: sessionMap[c.subtopic_id] || null
        }));

        setDashboardData({
          diplomaTitle: diplomaData?.title || 'Programa Académico',
          programType: diplomaData?.program_type || 'diplomado',
          meetUrl: diplomaData?.meet_url || null,
          isPublished,
          modulesCount: modulesData?.length || 0,
          sessionsCount: calculatedSessionsCount,
          totalClassesCount: totalClassesCount || (allClassesData?.length || 0),
          upcomingClasses: isPublished ? mappedUpcoming : [],
          sessionMap,
          latestRecordings: [],
          firstModuleId: modulesData?.[0]?.id || null,
          announcements: freshAnnouncements
        });

        // Anuncios no leídos
        if (freshAnnouncements.length > 0) {
          const seenId = localStorage.getItem(seenAnnouncementsKey);
          if (seenId !== String(freshAnnouncements[0]?.id)) setHasNewAnnouncements(true);
        }

        // ─── BLOQUE 2: dependencias en paralelo ───
        const secondaryResults = await Promise.all([
          // 2a. Progreso real del estudiante
          currentUser?.id
            ? calculateProgramProgressDetails(cleanProgramId, currentUser.id)
            : Promise.resolve({ percentage: 0, totalClasses: 0, completedClassesValue: 0 }),

          // 2b. Actividades publicadas del programa (para stats globales + mapeo de clases)
          (async () => {
            const { data: progClasses } = await supabase
              .from('class_sessions')
              .select('id')
              .eq('program_id', cleanProgramId);

            const allProgClassIds = (progClasses || []).map(c => c.id);
            if (allProgClassIds.length === 0) return { activities: [], attempts: [] };

            const { data: acts } = await supabase
              .from('class_activities')
              .select('id, class_id, is_mandatory')
              .eq('is_published', true)
              .in('class_id', allProgClassIds);

            const actIds = (acts || []).map(a => a.id);
            if (actIds.length === 0 || !currentUser?.id) return { activities: acts || [], attempts: [] };

            const { data: atts } = await supabase
              .from('activity_attempts')
              .select('id, activity_id, score, status')
              .eq('student_id', currentUser.id)
              .eq('status', 'completed')
              .in('activity_id', actIds);

            const attIds = (atts || []).map(a => a.id).filter(Boolean);
            let attAnsMap = {};
            if (attIds.length > 0) {
              const { data: ans } = await supabase.from('attempt_answers').select('attempt_id, is_correct').in('attempt_id', attIds);
              if (ans && ans.length > 0) {
                ans.forEach(a => {
                  if (!attAnsMap[a.attempt_id]) attAnsMap[a.attempt_id] = { total: 0, correct: 0 };
                  attAnsMap[a.attempt_id].total++;
                  if (a.is_correct) attAnsMap[a.attempt_id].correct++;
                });
              }
            }

            return { activities: acts || [], attempts: atts || [], attAnsMap };
          })()
        ]);

        const [progressDetails, activityData] = secondaryResults;
        setProgress(progressDetails?.percentage || 0);

        // Calcular estadísticas de actividades
        const { activities, attempts, attAnsMap } = activityData;
        if (activities.length > 0) {
          // Mejor intento por actividad
          const bestByActivity = {};
          (attempts || []).forEach(att => {
            let realScore = att.score;
            const ansStats = attAnsMap ? attAnsMap[att.id] : null;
            if (ansStats && ansStats.total > 0) {
              realScore = Math.round((ansStats.correct / ansStats.total) * 100);
            }
            if (!bestByActivity[att.activity_id] || realScore > bestByActivity[att.activity_id]) {
              bestByActivity[att.activity_id] = realScore;
            }
          });
          const completedIds = new Set(Object.keys(bestByActivity));
          const scores = Object.values(bestByActivity);
          const avg = scores.length > 0
            ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
            : 0;

          setActivityStats({
            completedCount: completedIds.size,
            totalCount: activities.length,
            averageScore: avg
          });

          // Mapear estado por class_id para la lista de clases
          const activityByClass = {};
          activities.forEach(act => {
            activityByClass[act.class_id] = {
              has: true,
              completed: completedIds.has(act.id)
            };
          });

          const nowTime = new Date().getTime();
          const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

          const classesWithMeta = (allClassesData || []).map(c => {
            const act = activityByClass[c.id];
            const hasActivity = !!act?.has;
            const isCompleted = hasActivity && !!act?.completed;
            const hasRecording = !!c.video_url;
            const classTime = c.class_date ? new Date(c.class_date).getTime() : null;
            const isOlderThan3Days = classTime ? (nowTime - classTime) > THREE_DAYS_MS : false;

            // Se oculta del tablón prioritario si:
            // 1. Ya completó y aprobó la actividad
            // 2. Ya tiene grabación, NO tiene actividad, y ya pasaron más de 3 días desde la clase
            const shouldHide = isCompleted || (hasRecording && !hasActivity && isOlderThan3Days);

            return {
              ...c,
              sessionTitle: sessionMap[c.subtopic_id] || null,
              activityInfo: act || null,
              shouldHide
            };
          });

          // Priorizar clases activas (no completadas ni archivadas tras 3 días)
          const activeClasses = classesWithMeta.filter(c => !c.shouldHide);
          const displayClasses = activeClasses.length > 0 ? activeClasses.slice(0, 6) : classesWithMeta.slice(0, 6);
          setRecentClasses(displayClasses);
        } else {
          const nowTime = new Date().getTime();
          const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

          const classesWithMeta = (allClassesData || []).map(c => {
            const hasRecording = !!c.video_url;
            const classTime = c.class_date ? new Date(c.class_date).getTime() : null;
            const isOlderThan3Days = classTime ? (nowTime - classTime) > THREE_DAYS_MS : false;
            const shouldHide = hasRecording && isOlderThan3Days;

            return {
              ...c,
              sessionTitle: sessionMap[c.subtopic_id] || null,
              activityInfo: null,
              shouldHide
            };
          });

          const activeClasses = classesWithMeta.filter(c => !c.shouldHide);
          const displayClasses = activeClasses.length > 0 ? activeClasses.slice(0, 6) : classesWithMeta.slice(0, 6);
          setRecentClasses(displayClasses);
        }

        // Contexto global del Sidebar
        localStorage.setItem('activeProgramId', cleanProgramId);
        if (diplomaData?.program_type) {
          localStorage.setItem('activeProgramType', diplomaData.program_type);
        }
        window.dispatchEvent(new Event('programContextChanged'));

      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchDashboardData();
  }, [programId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── AGRUPACIÓN DE CLASES PRÓXIMAS EN SESIONES (Hook incondicional al nivel superior) ──
  const safeUpcomingClasses = Array.isArray(dashboardData.upcomingClasses) ? dashboardData.upcomingClasses : [];
  const upcomingSessions = useMemo(() => {
    return groupClassesIntoSessions(safeUpcomingClasses, dashboardData.sessionMap || {});
  }, [safeUpcomingClasses, dashboardData.sessionMap]);

  /* ── SKELETON ── */
  if (loading) {
    return (
      <div style={{ width: '100%', padding: '1rem 0' }}>
        <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between' }}>
          <div className="skeleton" style={{ width: '150px', height: '30px' }} />
          <div className="skeleton" style={{ width: '180px', height: '30px' }} />
        </div>
        <div className="skeleton" style={{ width: '100%', height: '100px', borderRadius: 'var(--radius-lg)', marginBottom: '1.5rem' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: '88px', borderRadius: 'var(--radius-md)' }} />)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          <div className="skeleton" style={{ height: '260px', borderRadius: 'var(--radius-lg)' }} />
          <div className="skeleton" style={{ height: '260px', borderRadius: 'var(--radius-lg)' }} />
        </div>
      </div>
    );
  }

  const {
    diplomaTitle, programType, isPublished, modulesCount, sessionsCount,
    totalClassesCount, upcomingClasses, firstModuleId, announcements, meetUrl,
    sessionMap
  } = dashboardData;

  const isCourse = programType === 'curso';

  // ── LÓGICA DE CLASE EN VIVO Y CLASE PROGRAMADA HOY ──
  const nowTime = Date.now();
  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  const todayEnd   = new Date(); todayEnd.setHours(23,59,59,999);

  // 1. Si hay alguna clase EN VIVO en este momento (o en ventana de 10 min previos hasta fin de transmisión)
  const activeLiveClass = safeUpcomingClasses.find(c => isClassLiveOrSoon(c, 10));
  const activeLiveMeetUrl = activeLiveClass ? (activeLiveClass.meet_url || meetUrl) : null;

  // 2. Si no hay clase en vivo, buscar la próxima clase programada para HOY que aún no haya iniciado
  const upcomingClassToday = !activeLiveClass ? safeUpcomingClasses.find(c => {
    if (c.video_url) return false;
    const d = c.class_date ? new Date(c.class_date) : null;
    if (!d || d < todayStart || d > todayEnd) return false;
    return d.getTime() > nowTime;
  }) : null;

  // Banner principal:
  // - Si hay clase en vivo activa: destacamos ESA clase en vivo con botón "Entrar a la Clase"
  // - Si no hay clase en vivo pero sí una clase futura hoy: destacamos la próxima clase
  // - Si todas las de hoy ya concluyeron y no hay en vivo: classToday es null y no muestra aviso desfasado
  const classToday = activeLiveClass || upcomingClassToday;
  const isClassTodayLive = !!activeLiveClass;
  const classTodayMeetUrl = activeLiveMeetUrl || (upcomingClassToday ? (upcomingClassToday.meet_url || meetUrl) : null);

  // Lista de 'Próximas Sesiones en Vivo' depurada (máximo 3 sesiones)
  const visibleUpcomingSessions = upcomingSessions.slice(0, 3);

  return (
    <div style={{ animation: 'fadeSlideUp 0.35s ease-out' }}>

      {/* ── BREADCRUMB + BOTÓN CLASE EN VIVO (Solo visible 10 min antes o durante transmisión) ── */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Link to="/portal" className="btn btn-outline" style={{ fontSize: '0.82rem', padding: '0.4rem 0.85rem' }}>
            <ArrowLeft size={14} /> Volver
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 500 }}>
            <ChevronRight size={14} />
            <Link to="/portal" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}
              onMouseOver={e => e.currentTarget.style.color = 'var(--navy)'}
              onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted)'}>
              Mis Programas
            </Link>
            <ChevronRight size={14} />
            <span style={{ color: 'var(--navy)', fontWeight: 700, whiteSpace: 'nowrap',
              overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>
              {diplomaTitle}
            </span>
          </div>
        </div>

        {activeLiveMeetUrl && (
          <a href={activeLiveMeetUrl} target="_blank" rel="noreferrer" style={{
            background: '#dc2626', color: '#ffffff',
            padding: '0.5rem 1.1rem', borderRadius: '8px',
            fontSize: '0.85rem', fontWeight: 700, textDecoration: 'none',
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            boxShadow: '0 2px 8px rgba(220,38,38,0.3)',
            animation: 'pulse 2s ease-in-out infinite'
          }}>
            <Video size={16} /> Clase en Vivo — Entrar Ahora
          </a>
        )}
      </div>

      {/* ── ALERTA PROGRAMA DESHABILITADO ── */}
      {!isPublished && (
        <div className="card" style={{ background: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b', padding: '1.5rem', marginBottom: '1.5rem', textAlign: 'center' }}>
          <AlertTriangle size={24} style={{ marginBottom: '0.5rem' }} />
          <h3 style={{ margin: '0 0 0.5rem 0', fontWeight: 800, color: '#991b1b' }}>Este programa se encuentra inhabilitado</h3>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#7f1d1d' }}>
            La administración ha suspendido temporalmente el acceso a los contenidos y clases.
          </p>
        </div>
      )}

      {/* ── ENCABEZADO ── */}
      <div className="page-header" style={{ marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
          <span className={`badge ${isCourse ? 'badge-gold' : 'badge-primary'}`} style={{ fontSize: '0.74rem', padding: '0.2rem 0.6rem' }}>
            {isCourse ? 'Curso Corto' : 'Diplomado'}
          </span>
        </div>
        <h1 className="page-title" style={{ fontSize: '1.9rem', lineHeight: 1.2 }}>{diplomaTitle}</h1>
        <p className="page-description" style={{ marginTop: '0.35rem' }}>
          Tu panel de control &nbsp;·&nbsp; {isCourse
            ? `${sessionsCount || 'Varias'} ${sessionsCount === 1 ? 'sesión' : 'sesiones'} · ${totalClassesCount || recentClasses.length} ${totalClassesCount === 1 ? 'clase' : 'clases'}`
            : `${modulesCount} ${modulesCount === 1 ? 'módulo' : 'módulos'} · ${totalClassesCount || recentClasses.length} ${totalClassesCount === 1 ? 'clase' : 'clases'}`
          }
        </p>
      </div>

      {/* ── BARRA DE PESTAÑAS DEL CURSO (NAVEGACIÓN INTEGRADA) ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        marginBottom: '1.75rem',
        overflowX: 'auto',
        paddingBottom: '4px',
        borderBottom: '1px solid var(--border-color)',
        scrollbarWidth: 'none'
      }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.55rem 1.1rem',
            borderRadius: '8px 8px 0 0',
            fontSize: '0.84rem',
            fontWeight: 700,
            background: 'var(--navy, #14213D)',
            color: '#FFFFFF',
            borderBottom: '3px solid var(--gold, #FCA311)',
            whiteSpace: 'nowrap'
          }}
        >
          <Home size={15} /> Resumen
        </div>
        <Link
          to={isCourse ? `/syllabus/${cleanProgramId}` : `/modules/${cleanProgramId}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.55rem 1rem',
            borderRadius: '8px 8px 0 0',
            fontSize: '0.84rem',
            fontWeight: 600,
            textDecoration: 'none',
            background: '#F1F5F9',
            color: 'var(--navy)',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap'
          }}
          onMouseOver={e => e.currentTarget.style.background = '#E2E8F0'}
          onMouseOut={e => e.currentTarget.style.background = '#F1F5F9'}
        >
          {isCourse ? <ListTree size={15} /> : <BookOpen size={15} />}
          {isCourse ? 'Sesiones' : 'Módulos'}
        </Link>
        <Link
          to={`/resources/${cleanProgramId}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.55rem 1rem',
            borderRadius: '8px 8px 0 0',
            fontSize: '0.84rem',
            fontWeight: 600,
            textDecoration: 'none',
            background: '#F1F5F9',
            color: 'var(--navy)',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap'
          }}
          onMouseOver={e => e.currentTarget.style.background = '#E2E8F0'}
          onMouseOut={e => e.currentTarget.style.background = '#F1F5F9'}
        >
          <Paperclip size={15} color="var(--gold-dark, #b45309)" /> Recursos y Materiales
        </Link>
        <Link
          to={`/resultados/${cleanProgramId}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.55rem 1rem',
            borderRadius: '8px 8px 0 0',
            fontSize: '0.84rem',
            fontWeight: 600,
            textDecoration: 'none',
            background: '#F1F5F9',
            color: 'var(--navy)',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap'
          }}
          onMouseOver={e => e.currentTarget.style.background = '#E2E8F0'}
          onMouseOut={e => e.currentTarget.style.background = '#F1F5F9'}
        >
          <BarChart2 size={15} /> Mis Resultados
        </Link>
        <Link
          to={`/teachers/${cleanProgramId}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.55rem 1rem',
            borderRadius: '8px 8px 0 0',
            fontSize: '0.84rem',
            fontWeight: 600,
            textDecoration: 'none',
            background: '#F1F5F9',
            color: 'var(--navy)',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap'
          }}
          onMouseOver={e => e.currentTarget.style.background = '#E2E8F0'}
          onMouseOut={e => e.currentTarget.style.background = '#F1F5F9'}
        >
          <Users size={15} /> Profesores
        </Link>
      </div>

      {/* ── BANNER CLASE HOY (EN VIVO O PROGRAMADA) ── */}
      {classToday && (
        isClassTodayLive ? (
          <div style={{
            background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
            borderRadius: 'var(--radius-lg)', padding: '1.25rem 1.5rem',
            marginBottom: '1.75rem', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem',
            boxShadow: '0 4px 20px rgba(220,38,38,0.25)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <div style={{
                width: '42px', height: '42px', borderRadius: '10px',
                background: 'rgba(255,255,255,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Video size={20} color="#ffffff" />
              </div>
              <div>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.72rem', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 0.15rem 0' }}>
                  Clase en vivo — EN TRANSMISIÓN
                </p>
                <p style={{ color: '#ffffff', fontWeight: 700, fontSize: '0.95rem', margin: 0 }}>
                  {classToday.title}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.2rem', flexWrap: 'wrap' }}>
                  {classToday.class_date && (
                    <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.78rem', margin: 0 }}>
                      {safeFormatTime(classToday.class_date)} hs
                    </p>
                  )}
                  {classToday.teacher_profiles?.name && (
                    <p style={{ color: 'rgba(255,255,255,0.95)', fontSize: '0.78rem', margin: 0, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <User size={12} color="#ffffff" /> Prof. {classToday.teacher_profiles.name}
                    </p>
                  )}
                </div>
              </div>
            </div>
            {classTodayMeetUrl && (
              <a href={classTodayMeetUrl} target="_blank" rel="noreferrer" style={{
                background: '#ffffff', color: '#dc2626',
                padding: '0.6rem 1.25rem', borderRadius: '8px',
                fontWeight: 800, fontSize: '0.88rem', textDecoration: 'none',
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)', flexShrink: 0
              }}>
                <Video size={15} /> Entrar a la Clase
              </a>
            )}
          </div>
        ) : (
          <div style={{
            background: 'linear-gradient(135deg, var(--navy) 0%, #1e2e52 100%)',
            borderRadius: 'var(--radius-lg)', padding: '1.15rem 1.5rem',
            marginBottom: '1.75rem', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem',
            border: '1px solid rgba(252,163,17,0.25)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '10px',
                background: 'var(--gold-subtle)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Calendar size={20} color="var(--gold-dark)" />
              </div>
              <div>
                <p style={{ color: 'var(--gold)', fontSize: '0.72rem', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 0.15rem 0' }}>
                  Clase programada para HOY
                </p>
                <p style={{ color: '#ffffff', fontWeight: 700, fontSize: '0.95rem', margin: 0 }}>
                  {classToday.title}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.2rem', flexWrap: 'wrap' }}>
                  {classToday.class_date && (
                    <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.78rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Clock size={12} color="var(--gold)" />
                      Inicio: {safeFormatTime(classToday.class_date)} hs
                    </p>
                  )}
                  {classToday.teacher_profiles?.name && (
                    <p style={{ color: 'rgba(255,255,255,0.95)', fontSize: '0.78rem', margin: 0, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <User size={12} color="var(--gold)" /> Prof. {classToday.teacher_profiles.name}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
              background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.9)',
              border: '1px solid rgba(255,255,255,0.12)',
              padding: '0.45rem 0.9rem', borderRadius: '8px',
              fontSize: '0.78rem', fontWeight: 600
            }}>
              <Clock size={13} color="var(--gold)" /> El botón de ingreso se activará 10 min antes
            </div>
          </div>
        )
      )}

      {/* ── 4 MÉTRICAS CLAVE ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {/* Progreso */}
        <div style={{ background: 'linear-gradient(135deg, var(--navy) 0%, #1e2e52 100%)', borderRadius: 'var(--radius-lg)', padding: '1.2rem 1.4rem', color: 'white' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
            <TrendingUp size={18} color="var(--gold)" />
            <span style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--gold)' }}>{progress}%</span>
          </div>
          <div style={{ height: '4px', background: 'rgba(255,255,255,0.15)', borderRadius: '999px', marginBottom: '0.5rem', overflow: 'hidden' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: 'var(--gold)', borderRadius: '999px', transition: 'width 1s ease' }} />
          </div>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.76rem', fontWeight: 600, margin: 0 }}>Progreso general</p>
        </div>

        {/* Actividades completadas */}
        <div style={{ background: '#ffffff', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '1.2rem 1.4rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
            <CheckCircle2 size={18} color="#16a34a" />
            <span style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--navy)', lineHeight: 1 }}>
              {activityStats.completedCount}<span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>/{activityStats.totalCount}</span>
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.76rem', fontWeight: 600, margin: 0 }}>
            Actividades completadas
          </p>
        </div>

        {/* Nota promedio */}
        <div style={{ background: 'var(--white)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '1.2rem 1.4rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
            <Award size={18} color="var(--gold-dark)" />
            <span style={{ fontSize: '1.6rem', fontWeight: 800,
              color: activityStats.completedCount > 0
                ? (activityStats.averageScore >= 70 ? 'var(--green-600)' : activityStats.averageScore >= 50 ? 'var(--warning)' : 'var(--error)')
                : 'var(--text-muted)',
              lineHeight: 1 }}>
              {activityStats.completedCount > 0 ? `${activityStats.averageScore}%` : '—'}
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.76rem', fontWeight: 600, margin: 0 }}>
            Nota promedio
          </p>
        </div>

        {/* Clases disponibles */}
        <div style={{ background: '#ffffff', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '1.2rem 1.4rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
            <BookOpen size={18} color="var(--gold-dark)" />
            <span style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--navy)', lineHeight: 1 }}>
              {recentClasses.filter(c => !!c.video_url).length}
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.76rem', fontWeight: 600, margin: 0 }}>
            Grabaciones disponibles
          </p>
        </div>
      </div>

      {/* ── GRID PRINCIPAL: LISTA DE CLASES + PRÓXIMAS EN VIVO ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>

        {/* CLASES DEL PROGRAMA */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div style={{ width: '34px', height: '34px', borderRadius: 'var(--radius-md)', background: 'var(--gold-subtle, #fef9ec)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Video size={16} color="var(--gold-dark)" />
              </div>
              <h2 style={{ fontSize: '1.05rem', margin: 0, fontWeight: 700, color: 'var(--navy)' }}>
                {isCourse ? 'Contenido del Curso' : 'Contenido del Diplomado'}
              </h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <Link to={`/resources/${cleanProgramId}`}
                style={{ fontSize: '0.78rem', color: 'var(--navy)', fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <Paperclip size={12} color="var(--gold-dark)" /> Recursos
              </Link>
              <Link to={isCourse ? `/syllabus/${cleanProgramId}` : `/modules/${cleanProgramId}`}
                style={{ fontSize: '0.78rem', color: 'var(--gold-dark)', fontWeight: 700, textDecoration: 'none' }}>
                {isCourse ? 'Ver sesiones →' : 'Ver módulos →'}
              </Link>
            </div>
          </div>

          {recentClasses.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
              {recentClasses.slice(0, 6).map(cls => (
                <ClassRow key={cls.id} cls={cls} activityInfo={cls.activityInfo} />
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem', background: 'rgba(20,33,61,0.02)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-color)' }}>
              <BookOpen size={30} color="var(--navy)" style={{ opacity: 0.25, marginBottom: '0.5rem' }} />
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
                Aún no hay clases registradas.
              </p>
            </div>
          )}

          {/* CTA continuar */}
          <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
            {isCourse ? (
              <Link to={`/syllabus/${cleanProgramId}`} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                <BookOpen size={16} /> Ver sesiones del curso
              </Link>
            ) : firstModuleId ? (
              <Link to={`/module/${firstModuleId}`} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                <PlayCircle size={16} />
                {progress === 0 ? 'Comenzar diplomado' : progress === 100 ? 'Revisar contenido' : 'Continuar aprendiendo'}
              </Link>
            ) : (
              <Link to={`/modules/${cleanProgramId}`} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                <BookOpen size={16} /> Ver módulos del diplomado
              </Link>
            )}
          </div>
        </div>

        {/* PRÓXIMAS SESIONES EN VIVO */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div style={{ width: '34px', height: '34px', borderRadius: 'var(--radius-md)', background: 'rgba(20,33,61,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Calendar size={16} color="var(--navy)" />
              </div>
              <h2 style={{ fontSize: '1.05rem', margin: 0, fontWeight: 700, color: 'var(--navy)' }}>Próximas Sesiones en Vivo</h2>
            </div>
            <Link to={isCourse ? `/syllabus/${cleanProgramId}` : `/modules/${cleanProgramId}`}
              style={{ fontSize: '0.78rem', color: 'var(--gold-dark)', fontWeight: 700, textDecoration: 'none' }}>
              {isCourse ? 'Ver sesiones →' : 'Ver módulos →'}
            </Link>
          </div>

          {visibleUpcomingSessions.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {visibleUpcomingSessions.map(session => {
                const sessionDate = session.startDate;
                const isToday = sessionDate && sessionDate >= todayStart && sessionDate <= todayEnd;
                const tomorrowEnd = new Date(todayEnd); tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
                const isTomorrow = sessionDate && sessionDate > todayEnd && sessionDate <= tomorrowEnd;
                const urgencyLabel = isToday ? 'HOY' : isTomorrow ? 'MAÑANA' : null;
                const isLiveNow = session.isLiveNow;
                const sessionMeet = session.meetUrl || meetUrl;
                const googleCalUrl = getSessionGoogleCalendarUrl(session, dashboardData.diplomaTitle, meetUrl);
                const classCount = session.classes.length;

                // Formateo de fecha y hora
                const dateStr = safeFormatDate(sessionDate, 'Fecha por confirmar');
                const startTimeStr = safeFormatTime(sessionDate);
                const endTimeStr = (session.endDate && classCount > 1)
                  ? safeFormatTime(session.endDate)
                  : null;
                const timeDisplay = endTimeStr ? `${startTimeStr} - ${endTimeStr} hs` : (startTimeStr ? `${startTimeStr} hs` : '');

                return (
                  <div key={session.id} style={{
                    padding: '0.85rem 1rem',
                    border: `1px solid ${isLiveNow ? '#fca5a5' : isToday ? 'rgba(220,38,38,0.2)' : isTomorrow ? '#fcd34d' : 'var(--border-color)'}`,
                    borderLeft: `4px solid ${isLiveNow ? '#dc2626' : isToday ? '#e11d48' : isTomorrow ? '#d97706' : 'var(--navy)'}`,
                    borderRadius: 'var(--radius-md)',
                    background: isLiveNow ? '#fff5f5' : isToday ? '#fff8f8' : isTomorrow ? '#fffbeb' : 'var(--surface-light)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
                          <h4 style={{ fontWeight: 700, color: 'var(--navy)', margin: 0, fontSize: '0.88rem' }}>
                            {session.title}
                          </h4>
                          {classCount > 1 && (
                            <span style={{
                              padding: '0.08rem 0.45rem', borderRadius: '4px',
                              background: '#e2e8f0', color: '#1e293b',
                              fontSize: '0.66rem', fontWeight: 700, flexShrink: 0
                            }}>
                              {classCount} clases
                            </span>
                          )}
                          {isLiveNow ? (
                            <span style={{
                              padding: '0.08rem 0.45rem', borderRadius: '999px',
                              background: '#dc2626', color: '#ffffff',
                              fontSize: '0.63rem', fontWeight: 800, flexShrink: 0,
                              animation: 'pulse 2s ease-in-out infinite'
                            }}>
                              EN VIVO
                            </span>
                          ) : urgencyLabel && (
                            <span style={{
                              padding: '0.08rem 0.45rem', borderRadius: '999px',
                              background: isToday ? '#fee2e2' : '#fffbe6',
                              color: isToday ? '#dc2626' : '#d97706',
                              fontSize: '0.63rem', fontWeight: 800, flexShrink: 0
                            }}>
                              {urgencyLabel}
                            </span>
                          )}
                        </div>

                        <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <Clock size={11} />
                          <span>{dateStr}{timeDisplay ? `, ${timeDisplay}` : ''}</span>
                        </p>

                        {session.teachers && (
                          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.74rem', color: 'var(--navy)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <User size={11} color="var(--gold-dark)" /> Prof. {session.teachers}
                          </p>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
                        {googleCalUrl && (
                          <a
                            href={googleCalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Añadir a Google Calendar"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: '0.35rem 0.55rem',
                              borderRadius: 'var(--radius-sm, 6px)',
                              background: '#ffffff',
                              border: '1px solid #cbd5e1',
                              color: 'var(--navy)',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              textDecoration: 'none',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                              gap: '0.25rem'
                            }}
                            onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--gold-dark)'; e.currentTarget.style.background = '#f8fafc'; }}
                            onMouseOut={e => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.background = '#ffffff'; }}
                          >
                            <CalendarPlus size={13} color="var(--gold-dark)" />
                            <span style={{ fontSize: '0.68rem' }}>Calendar</span>
                          </a>
                        )}
                        {isLiveNow && sessionMeet ? (
                          <a href={sessionMeet} target="_blank" rel="noreferrer" className="btn btn-primary"
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.72rem', flexShrink: 0, background: '#dc2626', border: 'none', fontWeight: 700 }}>
                            <Video size={12} /> Entrar
                          </a>
                        ) : (
                          <Link to={session.firstClass ? `/class/${session.firstClass.id}` : '#'} className="btn btn-outline"
                            style={{ padding: '0.35rem 0.7rem', fontSize: '0.72rem', flexShrink: 0, fontWeight: 600 }}>
                            {classCount > 1 ? 'Ver clases' : 'Detalle'}
                          </Link>
                        )}
                      </div>
                    </div>

                    {/* Desglose interactivo si la sesión tiene múltiples clases */}
                    {classCount > 1 && (
                      <div style={{ marginTop: '0.55rem', paddingTop: '0.5rem', borderTop: '1px dashed #cbd5e1' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.3rem' }}>
                          <Layers size={11} color="var(--navy)" />
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                            Clases de esta sesión:
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                          {session.classes.map(c => {
                            const cTime = safeFormatTime(c.class_date);
                            const cIsLive = isClassLiveOrSoon(c, 10);
                            return (
                              <Link
                                key={c.id}
                                to={`/class/${c.id}`}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                  padding: '0.2rem 0.5rem',
                                  borderRadius: '5px',
                                  background: cIsLive ? '#fee2e2' : '#ffffff',
                                  border: `1px solid ${cIsLive ? '#dc2626' : '#cbd5e1'}`,
                                  color: cIsLive ? '#dc2626' : 'var(--navy)',
                                  fontSize: '0.72rem',
                                  fontWeight: 600,
                                  textDecoration: 'none',
                                  transition: 'all 0.15s ease'
                                }}
                                onMouseOver={e => {
                                  if (!cIsLive) {
                                    e.currentTarget.style.borderColor = 'var(--gold-dark)';
                                    e.currentTarget.style.background = '#f8fafc';
                                  }
                                }}
                                onMouseOut={e => {
                                  if (!cIsLive) {
                                    e.currentTarget.style.borderColor = '#cbd5e1';
                                    e.currentTarget.style.background = '#ffffff';
                                  }
                                }}
                              >
                                <Video size={10} color={cIsLive ? '#dc2626' : 'var(--gold-dark)'} />
                                <span>{c.title}</span>
                                {cTime && <span style={{ color: cIsLive ? '#dc2626' : 'var(--text-muted)', fontSize: '0.67rem' }}>({cTime})</span>}
                                {cIsLive && <span style={{ fontSize: '0.58rem', background: '#dc2626', color: '#fff', borderRadius: '3px', padding: '0.05rem 0.25rem', fontWeight: 800 }}>EN VIVO</span>}
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem', background: 'rgba(20,33,61,0.02)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-color)' }}>
              <Calendar size={30} color="var(--navy)" style={{ opacity: 0.25, marginBottom: '0.5rem' }} />
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
                No hay sesiones en vivo programadas próximamente.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── TABLÓN DE ANUNCIOS ── */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-md)', background: 'rgba(20,33,61,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            <Megaphone size={18} color="var(--navy)" />
            {hasNewAnnouncements && (
              <span style={{ position: 'absolute', top: '-3px', right: '-3px', width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444', border: '2px solid white' }} />
            )}
          </div>
          <h2 style={{ fontSize: '1.05rem', margin: 0, fontWeight: 700, color: 'var(--navy)' }}>Tablón de Anuncios</h2>
          {hasNewAnnouncements && (
            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#dc2626', background: '#fee2e2', padding: '0.15rem 0.5rem', borderRadius: '999px' }}>
              Nuevos
            </span>
          )}
          {announcements.length > 0 && (
            <button
              onClick={() => { localStorage.setItem(seenAnnouncementsKey, String(announcements[0]?.id)); setHasNewAnnouncements(false); }}
              style={{ marginLeft: 'auto', fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer' }}>
              {announcements.length} {announcements.length === 1 ? 'anuncio' : 'anuncios'}
            </button>
          )}
        </div>

        {(() => {
          const TAG = {
            general: { label: 'General',     emoji: '📢', color: '#14213D', bg: '#EEF2F8', border: '#14213D' },
            info:    { label: 'Informativo', emoji: '📌', color: '#1d4ed8', bg: '#dbeafe', border: '#3b82f6' },
            urgent:  { label: 'Urgente',     emoji: '🔴', color: '#991b1b', bg: '#fee2e2', border: '#ef4444' }
          };
          return announcements.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {announcements.map(a => {
                const cfg = TAG[a.tag] || TAG.general;
                return (
                  <div key={a.id} style={{
                    padding: '1rem 1.25rem', borderRadius: '0 10px 10px 0',
                    border: '1px solid var(--border-color)', borderLeft: `4px solid ${cfg.border}`,
                    backgroundColor: 'var(--surface-light)', transition: 'box-shadow 0.15s'
                  }}
                    onMouseOver={e => e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.07)'}
                    onMouseOut={e => e.currentTarget.style.boxShadow = 'none'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.4rem' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.6rem', borderRadius: '999px', background: cfg.bg, color: cfg.color, fontSize: '0.7rem', fontWeight: 700 }}>
                        {cfg.emoji} {cfg.label}
                      </span>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        {a.created_at ? new Date(a.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) : ''}
                      </span>
                    </div>
                    <h4 style={{ fontWeight: 700, color: 'var(--navy)', margin: '0 0 0.35rem 0', fontSize: '0.92rem' }}>{a.title}</h4>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 0.5rem 0', whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{a.body}</p>
                    <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', fontWeight: 500, borderTop: '1px solid var(--border-color)', paddingTop: '0.4rem' }}>
                      Publicado por: <strong>{a.teacher_profiles?.name ? (a.teacher_profiles.name.toLowerCase().includes('admin') ? a.teacher_profiles.name : `Prof. ${a.teacher_profiles.name}`) : 'Administración Académica'}</strong>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', background: 'var(--surface-light)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-color)' }}>
              <Megaphone size={36} color="var(--navy)" style={{ opacity: 0.2, marginBottom: '1rem' }} />
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
                No hay anuncios recientes.
              </p>
            </div>
          );
        })()}
      </div>

      {/* ── ACCESOS RÁPIDOS ── */}
      <h2 style={{ fontSize: '1.15rem', marginBottom: '1rem', fontWeight: 700, color: 'var(--navy)' }}>Accesos Rápidos</h2>
      <div className="grid-3" style={{ marginBottom: '2rem' }}>

        {/* Ver temario / sesiones */}
        <Link to={isCourse ? `/syllabus/${cleanProgramId}` : `/modules/${cleanProgramId}`}
          className="card"
          style={{ display: 'flex', alignItems: 'center', gap: '1rem', textDecoration: 'none', transition: 'all 0.2s ease', border: '1px solid var(--border-color)' }}
          onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(20,33,61,0.08)'; e.currentTarget.style.borderColor = 'var(--gold)'; }}
          onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.borderColor = 'var(--border-color)'; }}>
          <div style={{ padding: '0.85rem', backgroundColor: 'var(--gold-subtle)', color: 'var(--gold-dark)', borderRadius: 'var(--radius-md)' }}>
            <BookOpen size={22} />
          </div>
          <div style={{ flex: 1 }}>
            <h4 style={{ fontWeight: 700, color: 'var(--navy)', fontSize: '0.92rem', margin: '0 0 0.2rem 0' }}>{isCourse ? 'Ver Sesiones' : 'Ver Módulos'}</h4>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
              {isCourse ? 'Explora las sesiones y clases del curso' : 'Módulos y sesiones del diplomado'}
            </p>
          </div>
          <ArrowRight size={16} color="var(--text-muted)" />
        </Link>

        {/* Mis Resultados */}
        <Link to={`/resultados/${cleanProgramId}`}
          className="card"
          style={{ display: 'flex', alignItems: 'center', gap: '1rem', textDecoration: 'none', transition: 'var(--transition)', border: '1px solid var(--border-color)' }}
          onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.borderColor = 'var(--gold)'; }}
          onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.borderColor = 'var(--border-color)'; }}>
          <div style={{ padding: '0.85rem', backgroundColor: 'var(--gold-subtle)', color: 'var(--gold-dark)', borderRadius: 'var(--radius-md)', position: 'relative' }}>
            <BarChart2 size={22} />
            {activityStats.completedCount > 0 && (
              <span style={{ position: 'absolute', top: '-4px', right: '-4px', width: '16px', height: '16px', borderRadius: '50%', background: 'var(--gold)', color: 'var(--navy)', fontSize: '0.6rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--white)' }}>
                {activityStats.completedCount}
              </span>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <h4 style={{ fontWeight: 700, color: 'var(--navy)', fontSize: '0.92rem', margin: '0 0 0.2rem 0' }}>Mis Resultados</h4>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
              {activityStats.completedCount > 0
                ? `${activityStats.completedCount} completadas · Promedio ${activityStats.averageScore}%`
                : 'Ver actividades de reforzamiento'}
            </p>
          </div>
          <ArrowRight size={16} color="var(--text-muted)" />
        </Link>

        {/* Cuerpo Docente */}
        <Link to={`/teachers/${cleanProgramId}`}
          className="card"
          style={{ display: 'flex', alignItems: 'center', gap: '1rem', textDecoration: 'none', transition: 'all 0.2s ease', border: '1px solid var(--border-color)' }}
          onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(20,33,61,0.08)'; e.currentTarget.style.borderColor = 'var(--navy-light)'; }}
          onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.borderColor = 'var(--border-color)'; }}>
          <div style={{ padding: '0.85rem', backgroundColor: 'rgba(20,33,61,0.08)', color: 'var(--navy)', borderRadius: 'var(--radius-md)' }}>
            <User size={22} />
          </div>
          <div style={{ flex: 1 }}>
            <h4 style={{ fontWeight: 700, color: 'var(--navy)', fontSize: '0.92rem', margin: '0 0 0.2rem 0' }}>Cuerpo Docente</h4>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>Conoce a tus profesores</p>
          </div>
          <ArrowRight size={16} color="var(--text-muted)" />
        </Link>
      </div>

    </div>
  );
}
