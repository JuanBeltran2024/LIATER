import React, { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { BookOpen, User, Users, GraduationCap, Plus, X, Upload, Trash2, Eye, EyeOff, MessageSquareText, CalendarClock, ChevronRight, CalendarDays, CheckCircle2, Archive, RefreshCw, MessageSquare, ArrowRight, Video, Clock, Sparkles, Layers, Bell, ExternalLink, ShieldCheck, AlertCircle, ArrowUpRight, CalendarPlus } from 'lucide-react';
import { formatShortDate, isClassLiveOrSoon, getGoogleCalendarUrl } from '@/utils/dateUtils';
import { uploadProgramCover, fetchUpcomingPrograms, calculateProgramProgress } from '@/services/programService';
import { updateDoubtStatus } from '@/services/doubtService';
import PendingActivitiesCard from '@/components/cards/PendingActivitiesCard';

/* ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
   SUB-COMPONENTE: Portal de Estudiante
Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */
function StudentPortal({ getDiplomadoLink }) {
  const { currentUser } = useAuth();
  const [activeFilter, setActiveFilter] = useState('Todos');
  const filters = ['Todos', 'Diplomados', 'Cursos Cortos', 'Talleres'];
  const [diplomas, setDiplomas] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados para el bloque de Próximos Programas
  const [upcomingPrograms, setUpcomingPrograms] = useState([]);
  const [upcomingLoading, setUpcomingLoading] = useState(true);
  const [upcomingError, setUpcomingError] = useState(null);

  const loadUpcoming = useCallback(async () => {
    setUpcomingLoading(true);
    setUpcomingError(null);
    try {
      const { programs: data, error: err } = await fetchUpcomingPrograms(currentUser?.id, 3);
      if (err) throw err;
      setUpcomingPrograms(data || []);
    } catch (err) {
      console.error('Error fetching upcoming programs:', err);
      setUpcomingError('No se pudieron cargar los próximos programas.');
    } finally {
      setUpcomingLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    async function fetchDiplomas() {
      if (!currentUser?.id) return;
      try {
        setLoading(true);
        const { data: enrollData, error } = await supabase
          .from('enrollments')
          .select('diploma_programs(*)')
          .eq('student_id', currentUser.id)
          .order('created_at', { ascending: false });
          
        if (error) throw error;
        const enrolledDiplomas = (enrollData || []).map(enr => enr.diploma_programs).filter(Boolean);

        // Obtener progreso para cada diplomado usando la nueva lógica basada en actividades de reforzamiento
        if (enrolledDiplomas.length > 0) {
          const now = new Date();
          const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
          const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

          // Buscar clases programadas para hoy
          const { data: todayClasses } = await supabase
            .from('class_sessions')
            .select('program_id, meet_url, class_date, duration, video_url')
            .in('program_id', enrolledDiplomas.map(d => d.id))
            .gte('class_date', todayStart)
            .lt('class_date', todayEnd);

          const diplomasWithProgress = await Promise.all(
            enrolledDiplomas.map(async (dip) => {
              const progress = await calculateProgramProgress(dip.id, currentUser.id);
              const liveClass = todayClasses?.find(c => c.program_id === dip.id && isClassLiveOrSoon(c, 10));
              const liveUrl = liveClass ? (liveClass.meet_url || dip.meet_url) : null;
              return { ...dip, progress, liveUrl };
            })
          );
          setDiplomas(diplomasWithProgress);
        } else {
          setDiplomas([]);
        }
      } catch (err) {
        console.error('Error fetching diplomas:', err);
      } finally {
        setLoading(false);
      }
    }

    if (currentUser?.id) {
      fetchDiplomas();
      loadUpcoming();
    }
  }, [currentUser?.id, loadUpcoming]);

  const getButtonLabel = (progress) => {
    if (progress === 0) return 'Comenzar';
    if (progress === 100) return 'Revisar contenido';
    return 'Continuar';
  };

  // Destino dinámico: si ya inició, ir directo a módulos; si no, al dashboard de bienvenida
  const getContinueLink = (dip) => {
    if (dip.progress > 0) return `/modules/${dip.id}`;
    return getDiplomadoLink(dip.id);
  };

  const getBadgeLabel = (type) => {
    if (type === 'curso') return 'Curso Corto';
    if (type === 'taller') return 'Taller';
    return 'Diplomado';
  };

  // Saludo contextual
  const studentName = currentUser?.full_name || currentUser?.user_metadata?.full_name || currentUser?.name || '';
  const firstName = studentName.split(' ')[0] || 'Estudiante';
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';
  const todayLabel = now.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
  const programWithClassToday = diplomas.find(d => d.liveUrl);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* ══ SALUDO CONTEXTUAL HERO ══ */}
      <div style={{
        background: 'linear-gradient(135deg, var(--navy) 0%, #1e2e52 100%)',
        borderRadius: 'var(--radius-lg)',
        padding: '1.5rem 2rem',
        marginBottom: '1.75rem',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        boxShadow: '0 4px 20px rgba(20,33,61,0.12)'
      }}>
        <div>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 0.2rem 0' }}>
            {todayLabel}
          </p>
          <h1 style={{ color: '#ffffff', fontSize: '1.75rem', fontWeight: 800, margin: 0, lineHeight: 1.2 }}>
            {greeting}, {firstName}
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.88rem', margin: '0.4rem 0 0 0' }}>
            {diplomas.length > 0
              ? `Tienes ${diplomas.length} ${diplomas.length === 1 ? 'programa activo' : 'programas activos'}.`
              : 'No tienes programas activos aún.'}
          </p>
        </div>
        {programWithClassToday && (
          <a
            href={programWithClassToday.liveUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: 'var(--gold)',
              color: 'var(--navy)',
              padding: '0.65rem 1.25rem',
              borderRadius: '999px',
              fontWeight: 800,
              fontSize: '0.88rem',
              textDecoration: 'none',
              boxShadow: '0 4px 16px rgba(252,163,17,0.35)',
              flexShrink: 0,
              animation: 'pulse 2s ease-in-out infinite'
            }}
          >
            <Video size={16} /> Clase en vivo hoy · Unirse
          </a>
        )}
      </div>

      <div className="portal-layout">
        {/* 1. TARJETA DE PENDIENTES Y PRÓXIMAS FECHAS */}
        <div className="mobile-order-pending desktop-sidebar-pending">
          <PendingActivitiesCard studentId={currentUser?.id} />
        </div>

        {/* 2. COLUMNA PRINCIPAL CON FILTROS Y REJILLA */}
        <div className="portal-main mobile-order-main">
        {/* FILTROS TIPO PASTILLA */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', overflowX: 'auto', paddingBottom: '0.3rem', background: 'rgba(255,255,255,0.4)', padding: '0.35rem', borderRadius: '9999px', backdropFilter: 'blur(10px)', width: 'fit-content', scrollbarWidth: 'none', msOverflowStyle: 'none' }} className="hide-scrollbar">
          {filters.map(filter => {
            const isActive = activeFilter === filter;
            return (
              <button 
                key={filter}
                onClick={() => setActiveFilter(filter)}
                style={{ 
                  background: isActive ? 'var(--navy)' : 'transparent', 
                  color: isActive ? '#ffffff' : 'var(--navy)', 
                  padding: '0.5rem 1.25rem', 
                  borderRadius: '9999px', 
                  fontSize: '0.86rem', 
                  fontWeight: 700, 
                  cursor: 'pointer', 
                  border: 'none', 
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  boxShadow: isActive ? '0 4px 12px rgba(20,33,61,0.2)' : 'none',
                  transform: isActive ? 'scale(1.02)' : 'scale(1)'
                }}
                onMouseOver={e => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'rgba(20, 33, 61, 0.08)';
                    e.currentTarget.style.transform = 'scale(1.04)';
                  }
                }}
                onMouseOut={e => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.transform = 'scale(1)';
                  }
                }}
                onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.95)'; }}
              >
                {filter}
              </button>
            );
          })}
        </div>

        {/* REJILLA DE TARJETAS DE PROGRAMA */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>
          
          {/* ESTADO DE CARGA SKELETON */}
          {loading ? (
            Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="card" style={{ padding: 0, overflow: 'hidden', minHeight: '300px' }}>
                <div style={{ width: '100%', aspectRatio: '16 / 9', background: 'rgba(0,0,0,0.05)', animation: 'pulse 1.5s infinite' }} />
                <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ width: '80px', height: '18px', borderRadius: '999px', background: 'rgba(0,0,0,0.06)' }} />
                  <div style={{ width: '90%', height: '22px', borderRadius: '4px', background: 'rgba(0,0,0,0.06)' }} />
                  <div style={{ width: '100%', height: '8px', borderRadius: '999px', background: 'rgba(0,0,0,0.04)', marginTop: '0.5rem' }} />
                  <div style={{ width: '100%', height: '42px', borderRadius: 'var(--radius-md)', background: 'rgba(0,0,0,0.05)', marginTop: 'auto' }} />
                </div>
              </div>
            ))
          ) : diplomas.length === 0 ? (
            /* ESTADO VACÍO CUANDO NO HAY PROGRAMAS */
            <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4.5rem 2rem', borderRadius: 'var(--radius-lg)', background: 'linear-gradient(to bottom, #ffffff, #f8fafc)', border: '1px dashed #cbd5e1' }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(20,33,61,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
                <BookOpen size={40} color="var(--navy)" style={{ opacity: 0.5 }} />
              </div>
              <h3 style={{ fontSize: '1.25rem', color: 'var(--navy)', fontWeight: 800, marginBottom: '0.75rem' }}>No estás inscrito en ningún programa</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '420px', margin: '0 auto 1.5rem auto', lineHeight: 1.5 }}>
                Parece que aún no tienes cursos o diplomados activos. Explora nuestra oferta académica e inicia tu aprendizaje.
              </p>
              <Link to="/proximos-programas" className="btn btn-outline" style={{ display: 'inline-flex', padding: '0.6rem 1.25rem', fontWeight: 700 }}>
                Explorar Catálogo
              </Link>
            </div>
          ) : (
            /* LISTA DE TARJETAS DE PROGRAMAS ENROLADOS */
            diplomas.filter(d =>
              activeFilter === 'Todos' ||
              (activeFilter === 'Diplomados' && (d.program_type === 'diplomado' || !d.program_type)) ||
              (activeFilter === 'Cursos Cortos' && d.program_type === 'curso') ||
              (activeFilter === 'Talleres' && d.program_type === 'taller')
            ).map(dip => {
              const isCourse = dip.program_type === 'curso';
              const isPublished = dip.is_published !== false && dip.status !== 'draft' && dip.status !== 'disabled';
              const progress = dip.progress || 0;
              const buttonText = getButtonLabel(progress);
              const badgeText = getBadgeLabel(dip.program_type);

              return (
                <div 
                  key={dip.id} 
                  className="card" 
                  style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    padding: 0, 
                    overflow: 'hidden', 
                    opacity: isPublished ? 1 : 0.88,
                    transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
                    cursor: 'default',
                    border: '1px solid var(--border-color)',
                    boxShadow: '0 2px 8px rgba(20,33,61,0.04)'
                  }}
                  onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 24px rgba(20,33,61,0.1)'; e.currentTarget.style.borderColor = 'var(--navy-light)'; }}
                  onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(20,33,61,0.04)'; e.currentTarget.style.borderColor = 'var(--border-color)'; }}
                >
                  {/* 1. IMAGEN DE PORTADA DESTACADA Y AMPLIA (ALTURA 200PX CON BADGE SOBREPUESTO) */}
                  <div style={{ width: '100%', height: '200px', overflow: 'hidden', position: 'relative', background: 'var(--navy)' }}>
                    {/* BADGES SOBREPUESTOS EN LA IMAGEN */}
                    <div style={{ position: 'absolute', top: '0.5rem', left: '0.5rem', zIndex: 2, display: 'flex', gap: '0.35rem' }}>
                      <span className={isCourse ? 'badge badge-green' : 'badge badge-navy'} style={{ fontSize: '0.66rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', backdropFilter: 'blur(8px)', boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}>
                        {badgeText}
                      </span>
                      {!isPublished && (
                        <span className="badge" style={{ backgroundColor: 'rgba(239, 68, 68, 0.9)', color: '#ffffff', fontSize: '0.66rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', backdropFilter: 'blur(8px)' }}>
                          INHABILITADO
                        </span>
                      )}
                    </div>

                    {/* INDICADOR DE CLASE PROGRAMADA PARA HOY (ESQUINA DERECHA DE LA PORTADA) */}
                    {dip.liveUrl && isPublished && (
                      <a 
                        href={dip.liveUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        title="Ver enlace de la clase programada para hoy"
                        style={{
                          position: 'absolute',
                          top: '0.6rem',
                          right: '0.6rem',
                          zIndex: 3,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          background: 'rgba(20, 33, 61, 0.92)',
                          color: 'var(--gold)',
                          padding: '0.35rem 0.75rem',
                          borderRadius: '999px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          textDecoration: 'none',
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                          letterSpacing: '0.03em',
                          backdropFilter: 'blur(8px)',
                          transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
                          border: '1px solid rgba(252, 163, 17, 0.5)'
                        }}
                        onMouseOver={e => {
                          e.currentTarget.style.transform = 'scale(1.05)';
                          e.currentTarget.style.borderColor = 'var(--gold)';
                          e.currentTarget.style.boxShadow = '0 0 14px rgba(252, 163, 17, 0.4)';
                        }}
                        onMouseOut={e => {
                          e.currentTarget.style.transform = 'scale(1)';
                          e.currentTarget.style.borderColor = 'rgba(252, 163, 17, 0.5)';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
                        }}
                        onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.96)'; }}
                      >
                        <CalendarDays size={13} color="var(--gold)" />
                        <span>Clase Hoy · Unirse ➔</span>
                      </a>
                    )}

                    {dip.image_url ? (
                      <img 
                        src={dip.image_url} 
                        alt={`Portada de ${dip.title}`}
                        onError={(e) => { 
                          e.target.style.display = 'none'; 
                          if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex'; 
                        }}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', filter: isPublished ? 'none' : 'grayscale(60%)' }} 
                      />
                    ) : null}
                    
                    {/* Fallback cuando no hay imagen o falla la carga */}
                    <div style={{ 
                      display: dip.image_url ? 'none' : 'flex', 
                      width: '100%', 
                      height: '100%', 
                      background: isCourse ? 'linear-gradient(135deg, #14213D 0%, #1d3557 60%, #FCA311 100%)' : 'linear-gradient(135deg, #14213D 0%, #1a2c50 60%, #007a2e 100%)',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0.75rem',
                      boxSizing: 'border-box'
                    }}>
                      <BookOpen size={24} color={isCourse ? 'var(--gold)' : '#ffffff'} style={{ marginBottom: '0.2rem', opacity: 0.9 }} />
                      <span style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.08em', color: isCourse ? 'var(--gold)' : '#a7f3d0', textTransform: 'uppercase' }}>
                        LIATER UNAL
                      </span>
                    </div>
                  </div>

                  {/* CUERPO COMPACTO DE LA TARJETA */}
                  <div style={{ padding: '0.9rem 1rem 1rem 1rem', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                    
                    {/* 3. TÍTULO DEL PROGRAMA */}
                    <h3 style={{ fontSize: '0.98rem', color: 'var(--navy)', fontWeight: 700, marginBottom: '0.75rem', lineHeight: '1.3', minHeight: '2.6rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {dip.title}
                    </h3>

                    {/* 5. FILA DE TEXTO PROGRESO Y PORCENTAJE */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', marginBottom: '0.3rem', fontWeight: 700, color: 'var(--navy)' }}>
                      <span>Progreso</span>
                      <span>{progress}%</span>
                    </div>

                    {/* 6. BARRA DE PROGRESO */}
                    <div style={{ width: '100%', height: '5px', background: 'rgba(0,0,0,0.06)', borderRadius: '999px', overflow: 'hidden', marginBottom: '0.85rem', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)' }}>
                      <div style={{ 
                        width: `${progress}%`, 
                        height: '100%', 
                        background: progress === 100 ? 'var(--green-600)' : 'var(--navy)', 
                        borderRadius: '999px',
                        transition: 'width 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
                        boxShadow: progress > 0 ? '0 0 10px rgba(20,33,61,0.5)' : 'none'
                      }} />
                    </div>
                    

                    {/* 7. BOTÓN PRINCIPAL CON TEXTO SEGÚN EL AVANCE */}
                    {isPublished ? (
                      <Link 
                        onClick={() => { 
                          localStorage.setItem('activeProgramId', dip.id); 
                          localStorage.setItem('activeProgramType', dip.program_type); 
                        }} 
                        to={getContinueLink(dip)} 
                        className="btn btn-primary" 
                        style={{ 
                          textAlign: 'center', 
                          width: '100%', 
                          justifyContent: 'center', 
                          padding: '0.5rem 0.85rem', 
                          fontWeight: 700, 
                          fontSize: '0.82rem',
                          borderRadius: 'var(--radius-md)',
                          boxShadow: 'var(--shadow-sm)'
                        }}
                      >
                        {buttonText} →
                      </Link>
                    ) : (
                      <button 
                        disabled
                        style={{ 
                          textAlign: 'center', 
                          width: '100%', 
                          padding: '0.65rem', 
                          fontWeight: 700, 
                          fontSize: '0.88rem',
                          borderRadius: 'var(--radius-md)',
                          background: '#cbd5e1',
                          color: '#64748b',
                          border: 'none',
                          cursor: 'not-allowed'
                        }}
                      >
                        Programa Inhabilitado
                      </button>
                    )}

                  </div>
                </div>
              );
            })
          )}
        </div>
        </div>

        {/* 3. BLOQUE DE PRÓXIMOS PROGRAMAS */}
        <div className="mobile-order-upcoming desktop-sidebar-upcoming">
        <div className="card static-card" style={{ padding: '1.35rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.1rem' }}>
            <h3 style={{ fontSize: '1.05rem', color: 'var(--navy)', fontWeight: 700, margin: 0 }}>Próximos programas</h3>
            <Link to="/proximos-programas" style={{ fontSize: '0.82rem', color: 'var(--gold-dark)', fontWeight: 700, textDecoration: 'none' }}>
              Ver todos
            </Link>
          </div>

          {/* SKELETON LOADER */}
          {upcomingLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <div style={{ width: '80px', height: '56px', borderRadius: '6px', background: '#e2e8f0', flexShrink: 0 }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flexGrow: 1 }}>
                    <div style={{ width: '50px', height: '12px', background: '#cbd5e1', borderRadius: '999px' }} />
                    <div style={{ width: '90%', height: '14px', background: '#cbd5e1', borderRadius: '4px' }} />
                    <div style={{ width: '60%', height: '12px', background: '#e2e8f0', borderRadius: '4px' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : upcomingError ? (
            /* ERROR Y REINTENTO */
            <div style={{ padding: '0.75rem', background: '#fef2f2', borderRadius: '6px', color: '#dc2626', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <span>{upcomingError}</span>
              <button 
                onClick={loadUpcoming} 
                style={{ background: '#dc2626', color: '#ffffff', border: 'none', padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600, width: 'fit-content' }}
              >
                Reintentar
              </button>
            </div>
          ) : upcomingPrograms.length === 0 ? (
            /* ESTADO VACÍO DISCRETO */
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(20,33,61,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.5rem auto' }}>
                <CalendarDays size={20} color="var(--text-muted)" style={{ opacity: 0.6 }} />
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0, fontWeight: 500 }}>
                No hay nuevos programas próximos por el momento.
              </p>
            </div>
          ) : (
            /* LISTADO COMPACTO HASTA 3 ELEMENTOS */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {upcomingPrograms.map(prog => {
                const isOpen = prog.enrollment_start_date || prog.status === 'published';
                const isCourse = prog.program_type === 'curso';

                return (
                  <div key={prog.id} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    {/* MINIATURA COMPACTA (80px x 56px) */}
                    <div style={{ width: '80px', height: '56px', borderRadius: '6px', overflow: 'hidden', background: 'var(--navy)', flexShrink: 0, position: 'relative' }}>
                      {prog.image_url ? (
                        <img 
                          src={prog.image_url} 
                          alt={`Portada de ${prog.title}`}
                          onError={(e) => {
                            e.target.style.display = 'none';
                            if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                          }}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                      ) : null}
                      <div style={{ display: prog.image_url ? 'none' : 'flex', width: '100%', height: '100%', background: isCourse ? 'linear-gradient(135deg, #14213D 0%, #FCA311 100%)' : 'linear-gradient(135deg, #14213D 0%, #007a2e 100%)', alignItems: 'center', justifyContent: 'center' }}>
                        <BookOpen size={20} color="#ffffff" />
                      </div>
                    </div>

                    {/* DETALLES DEL PROGRAMA */}
                    <div style={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--navy)', textTransform: 'uppercase' }}>
                          {isCourse ? 'Curso' : 'Diplomado'}
                        </span>
                        <span style={{ fontSize: '0.66rem', fontWeight: 600, color: isOpen ? 'var(--green-700)' : 'var(--gold-dark)' }}>
                          • {isOpen ? 'Inscripciones abiertas' : 'Próximamente'}
                        </span>
                      </div>

                      <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--navy)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {prog.title}
                      </h4>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.15rem' }}>
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          {prog.start_date ? formatShortDate(prog.start_date) : 'Por definir'}
                        </span>
                        <Link to="/proximos-programas" style={{ fontSize: '0.74rem', color: 'var(--navy)', fontWeight: 700, textDecoration: 'none' }}>
                          Ver detalles →
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        </div>{/* cierre portal-layout */}
      </div>{/* cierre wrapper externo */}
    </div>
  );
}

/* Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
   SUB-COMPONENTE: Portal de Profesor
Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */
function TeacherPortal({ getDiplomadoLink }) {
  const { currentUser } = useAuth();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const activeTab = searchParams.get('tab') || 'inicio'; // 'inicio' | 'programas' | 'agenda' | 'consultas'

  const [classes, setClasses] = useState([]);
  const [diplomas, setDiplomas] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [teacherName, setTeacherName] = useState('');
  const [counts, setCounts] = useState({ doubts: 0, upcomingClasses: 0, activePrograms: 0 });
  const [loading, setLoading] = useState(true);
  const [adminAnnouncements, setAdminAnnouncements] = useState([]);
  const [showAllAdminAnn, setShowAllAdminAnn] = useState(false);

  // Estados para filtro en "Mis programas" y "Bandeja de consultas"
  const [activeFilter, setActiveFilter] = useState('Todos');
  const filters = ['Todos', 'Diplomados', 'Cursos Cortos', 'Talleres'];
  const [doubtStatusFilter, setDoubtStatusFilter] = useState('todos');
  const [agendaFilter, setAgendaFilter] = useState('todas');

  const handleStatusChange = async (doubtId, newStatus) => {
    setQuestions(prev => {
      const updated = prev.map(q => q.id === doubtId ? { ...q, status: newStatus } : q);
      setCounts(cPrev => ({
        ...cPrev,
        doubts: updated.filter(d => d.status === 'enviada' || d.status === 'revisada').length
      }));
      return updated;
    });
    await updateDoubtStatus(doubtId, newStatus);
  };

  useEffect(() => {
    async function fetchTeacherData() {
      if (!currentUser?.id) return;
      try {
        const { data: profileData } = await supabase
          .from('teacher_profiles')
          .select('id, name, user_id')
          .eq('user_id', currentUser.id)
          .maybeSingle();

        const name = profileData?.name || currentUser?.full_name || currentUser?.name || currentUser?.user_metadata?.full_name || 'Profesor';
        setTeacherName(name);

        let teacherDiplomas = [];
        const { data: enrollData } = await supabase
          .from('enrollments')
          .select('diploma_programs(*)')
          .eq('student_id', currentUser.id)
          .order('created_at', { ascending: false });
          
        let fetchedDiplomas = (enrollData || []).map(enr => enr.diploma_programs).filter(Boolean);

        // Incluir programas donde el profesor tiene clases asignadas directamente
        if (profileData?.id) {
          const { data: classRows } = await supabase
            .from('class_sessions')
            .select('program_id, diploma_programs(*)')
            .eq('teacher_id', profileData.id);

          const classDiplomas = (classRows || []).map(r => r.diploma_programs).filter(Boolean);
          const seenProgIds = new Set(fetchedDiplomas.map(d => d.id));
          classDiplomas.forEach(cd => {
            if (!seenProgIds.has(cd.id)) {
              seenProgIds.add(cd.id);
              fetchedDiplomas.push(cd);
            }
          });
        }

        if (fetchedDiplomas.length > 0) {
          const now = new Date();
          const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
          const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

          const { data: todayClasses } = await supabase
            .from('class_sessions')
            .select('program_id, meet_url, class_date, duration, video_url')
            .in('program_id', fetchedDiplomas.map(d => d.id))
            .gte('class_date', todayStart)
            .lt('class_date', todayEnd);

          teacherDiplomas = fetchedDiplomas.map(dip => {
            const liveClass = todayClasses?.find(c => c.program_id === dip.id && isClassLiveOrSoon(c, 10));
            const liveUrl = liveClass ? (liveClass.meet_url || dip.meet_url) : null;
            return { ...dip, liveUrl };
          });
        } else {
          teacherDiplomas = [];
        }
        setDiplomas(teacherDiplomas);

        let teacherClasses = [];
        let doubtsCount = 0;
        let doubtsData = [];

        const teacherIds = [profileData?.id, profileData?.user_id, currentUser?.id].filter(Boolean);
        const teacherProgramIds = teacherDiplomas.map(p => p.id).filter(Boolean);

        let classQuery = supabase
          .from('class_sessions')
          .select('*, diploma_programs(id, title, program_type, description), sessions(modules(diploma_programs(id, title, program_type, description))), subtopics(modules(diploma_programs(id, title, program_type, description)))')
          .order('class_date', { ascending: true });

        const orConditions = [];
        teacherIds.forEach(id => orConditions.push(`teacher_id.eq.${id}`));
        teacherProgramIds.forEach(pid => orConditions.push(`program_id.eq.${pid}`));

        if (orConditions.length > 0) {
          classQuery = classQuery.or(orConditions.join(','));
        }

        let { data: classData, error: classErr } = await classQuery;
        
        if (classErr) {
          // Fallback en caso de incompatibilidad con join de sessions/subtopics
          const fallbackQuery = supabase
            .from('class_sessions')
            .select('*, diploma_programs(id, title, program_type, description)')
            .order('class_date', { ascending: true });
          if (orConditions.length > 0) {
            const { data: fbData } = await fallbackQuery.or(orConditions.join(','));
            classData = fbData;
          } else {
            const { data: fbData } = await fallbackQuery;
            classData = fbData;
          }
        }
        
        if (classData) {
          const seen = new Set();
          teacherClasses = classData.filter(c => {
            if (seen.has(c.id)) return false;
            seen.add(c.id);
            const prog = c.diploma_programs || c.sessions?.modules?.diploma_programs || c.subtopics?.modules?.diploma_programs;
            if (prog && (prog.is_published === false || prog.status === 'draft' || prog.status === 'disabled')) {
              return false;
            }
            return true;
          });
        }
        setClasses(teacherClasses);

        try {
          const { data: qData, error: qErr } = await supabase
            .from('class_doubts')
            .select(`
              *,
              class_sessions (
                id,
                title
              ),
              diploma_programs (
                id,
                title,
                is_published,
                status
              ),
              users_profile:student_id (
                id,
                full_name,
                email
              )
            `)
            .order('created_at', { ascending: false });

          if (qErr) console.error('Error al obtener class_doubts:', qErr);

          doubtsData = (qData || []).filter(d => {
            const prog = d.diploma_programs;
            if (prog && (prog.is_published === false || prog.status === 'draft' || prog.status === 'disabled')) {
              return false;
            }
            return true;
          });
          doubtsCount = doubtsData.filter(d => d.status === 'enviada' || d.status === 'revisada').length;
        } catch (e) {
          console.error('Error querying class_doubts:', e);
          doubtsCount = 0;
          doubtsData = [];
        }
        setQuestions(doubtsData);

        try {
          const oneWeekAgo = new Date();
          oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
          
          const { data: annData, error: annErr } = await supabase
            .from('announcements')
            .select('*, diploma_programs(id, title), teacher_profiles(id, name)')
            .is('teacher_id', null)
            .gte('created_at', oneWeekAgo.toISOString())
            .order('created_at', { ascending: false });
            
          if (!annErr && annData) {
            const filtered = annData.filter(ann => {
              if (ann.is_global || !ann.program_id) return true; // Global
              // Si es de un programa, validar que el profesor pertenezca a el y el rol destino
              if (teacherProgramIds.includes(ann.program_id)) {
                return ann.target_role === 'teacher' || ann.target_role === 'all';
              }
              return false;
            });
            setAdminAnnouncements(filtered);
          }
        } catch (e) {
          console.error('Error fetching admin announcements', e);
        }

        const nowTime = new Date();
        const upcomingCount = teacherClasses.filter(c => {
          const classEndTime = new Date(new Date(c.class_date).getTime() + (parseInt(c.duration) || 120) * 60000);
          return classEndTime >= nowTime;
        }).length;
        const activeProgramsCount = teacherDiplomas.filter(p => p.is_published !== false && p.status !== 'draft' && p.status !== 'disabled').length;

        setCounts({
          doubts: doubtsCount,
          upcomingClasses: upcomingCount,
          activePrograms: activeProgramsCount
        });
      } catch (err) {
        console.error('Error fetching teacher portal data', err);
      } finally {
        setLoading(false);
      }
    }
    fetchTeacherData();
  }, [currentUser]);

  const now = new Date();
  const upcomingClassesList = classes
    .filter(c => {
      const classEndTime = new Date(new Date(c.class_date).getTime() + (parseInt(c.duration) || 120) * 60000);
      return classEndTime >= now;
    })
    .sort((a, b) => new Date(a.class_date) - new Date(b.class_date));
  const upcomingClasses = upcomingClassesList;

  // Próxima clase única (la futura más cercana)
  const nextClass = upcomingClassesList.length > 0 ? upcomingClassesList[0] : null;

  let nextClassDay = '';
  let nextClassMonth = '';
  let nextClassTimeStr = '';
  let nextClassProgTitle = '';
  let nextClassModuleName = '';
  let nextClassProgId = '';

  if (nextClass) {
    const d = new Date(nextClass.class_date);
    nextClassDay = d.getDate();
    nextClassMonth = d.toLocaleString('es-ES', { month: 'short' });
    nextClassTimeStr = d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false, hourCycle: 'h23' });
    nextClassProgTitle = nextClass.diploma_programs?.title || nextClass.sessions?.modules?.diploma_programs?.title || nextClass.subtopics?.modules?.diploma_programs?.title || 'Programa asignado';
    nextClassModuleName = nextClass.sessions?.modules?.title || nextClass.subtopics?.modules?.title || nextClass.module_name || '';
    nextClassProgId = nextClass.diploma_programs?.id || nextClass.sessions?.modules?.diploma_programs?.id || nextClass.subtopics?.modules?.diploma_programs?.id || nextClass.program_id;
  }

  // Filtrado para la vista "Mis Programas"
  const filteredDiplomas = diplomas.filter(p => {
    if (activeFilter === 'Diplomados') return p.program_type !== 'curso' && p.program_type !== 'taller';
    if (activeFilter === 'Cursos Cortos') return p.program_type === 'curso';
    if (activeFilter === 'Talleres') return p.program_type === 'taller';
    return true;
  });

  // -------------------------------------------------------------------
  // -------------------------------------------------------------------
  // VISTA 2: MIS PROGRAMAS (tab=programas) - Rediseñado de Alta Fidelidad
  // -------------------------------------------------------------------
  if (activeTab === 'programas') {
    const countDiplomados = diplomas.filter(p => p.program_type !== 'curso' && p.program_type !== 'taller').length;
    const countCursos = diplomas.filter(p => p.program_type === 'curso').length;
    const countTalleres = diplomas.filter(p => p.program_type === 'taller').length;
    const filterCounts = {
      'Todos': diplomas.length,
      'Diplomados': countDiplomados,
      'Cursos Cortos': countCursos,
      'Talleres': countTalleres
    };

    return (
      <div style={{ animation: 'fadeSlideUp 0.35s ease-out', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
        
        {/* ── HERO BANNER INSTITUCIONAL ── */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          padding: '1.75rem 2rem',
          border: '1px solid #E2E8F0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.25rem',
          boxShadow: '0 1px 3px rgba(20, 33, 61, 0.03)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '6px', flexWrap: 'wrap' }}>
              <span style={{
                background: '#F1F5F9',
                color: 'var(--navy, #14213D)',
                fontSize: '0.74rem',
                fontWeight: 800,
                padding: '3px 10px',
                borderRadius: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}>
                🏛️ GESTIÓN ACADÉMICA · PORTAL DOCENTE UNAL
              </span>
              <span style={{
                background: '#DCFCE7',
                color: '#007A2E',
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '10px'
              }}>
                ● Asignaciones Activas
              </span>
            </div>

            <h1 style={{ color: 'var(--navy, #14213D)', fontSize: '1.65rem', fontWeight: 800, margin: 0, lineHeight: 1.25 }}>
              Mis Programas Asignados
            </h1>
            <p style={{ color: 'var(--text-muted, #64748B)', fontSize: '0.9rem', margin: '6px 0 0 0', fontWeight: 400, maxWidth: '650px', lineHeight: 1.45 }}>
              Administra tus diplomados, prepara tus sesiones de clase y acompaña el progreso académico de tus estudiantes.
            </p>
          </div>

          <div style={{
            background: '#F8FAFC',
            padding: '0.75rem 1.15rem',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            gap: '0.85rem'
          }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'rgba(20,33,61,0.06)',
              color: 'var(--navy, #14213D)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <BookOpen size={18} />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748B)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Total Asignados
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--navy, #14213D)' }}>
                {diplomas.length} {diplomas.length === 1 ? 'Programa' : 'Programas'}
              </div>
            </div>
          </div>
        </div>

        {/* ── FILTROS POR CATEGORÍA CON CONTEOS DINÁMICOS ── */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {filters.map(filter => {
            const count = filterCounts[filter] || 0;
            const isActive = activeFilter === filter;

            return (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                style={{
                  padding: '0.5rem 1.1rem',
                  borderRadius: '9999px',
                  border: isActive ? '1.5px solid var(--navy, #14213D)' : '1px solid #E2E8F0',
                  background: isActive ? 'var(--navy, #14213D)' : '#FFFFFF',
                  color: isActive ? '#FFFFFF' : 'var(--navy, #14213D)',
                  fontWeight: 700,
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  boxShadow: isActive ? '0 3px 10px rgba(20,33,61,0.15)' : 'none',
                  transition: 'all 0.18s ease'
                }}
                onMouseOver={e => {
                  if (!isActive) {
                    e.currentTarget.style.borderColor = 'var(--gold, #FCA311)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }
                }}
                onMouseOut={e => {
                  if (!isActive) {
                    e.currentTarget.style.borderColor = '#E2E8F0';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }
                }}
              >
                <span>{filter}</span>
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  padding: '1px 6px',
                  borderRadius: '8px',
                  background: isActive ? 'rgba(255,255,255,0.2)' : '#F1F5F9',
                  color: isActive ? '#FFFFFF' : 'var(--text-muted, #64748B)'
                }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── GRILLA DE PROGRAMAS ASIGNADOS ── */}
        {loading ? (
          <div style={{ padding: '3rem 2rem', textAlign: 'center', background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
            <p style={{ color: 'var(--text-muted, #64748B)', margin: 0 }}>Cargando programas académicos...</p>
          </div>
        ) : filteredDiplomas.length === 0 ? (
          <div style={{ padding: '3.5rem 2rem', textAlign: 'center', background: '#FFFFFF', borderRadius: '16px', border: '1px dashed #CBD5E1' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
              <BookOpen size={28} color="var(--navy, #14213D)" style={{ opacity: 0.4 }} />
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--navy, #14213D)', margin: '0 0 0.35rem 0' }}>
              No tienes programas en esta categoría
            </h3>
            <p style={{ color: 'var(--text-muted, #64748B)', fontSize: '0.88rem', margin: '0 0 1rem 0' }}>
              Cuando la coordinación académica te asigne un programa de este tipo, aparecerá aquí.
            </p>
            <button
              onClick={() => setActiveFilter('Todos')}
              style={{
                background: 'var(--navy, #14213D)',
                color: '#FFFFFF',
                border: 'none',
                padding: '0.5rem 1.15rem',
                fontWeight: 700,
                fontSize: '0.82rem',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              Ver todos los programas ({diplomas.length})
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
            {filteredDiplomas.map(program => {
              // Métricas reales para este programa
              const progClasses = classes.filter(c => 
                (c.diploma_programs?.id === program.id) || 
                (c.sessions?.modules?.diploma_programs?.id === program.id) || 
                (c.subtopics?.modules?.diploma_programs?.id === program.id) || 
                (c.program_id === program.id)
              );
              const progClassCount = progClasses.length;
              
              const startOfToday = new Date();
              startOfToday.setHours(0, 0, 0, 0);
              const progUpcomingClass = progClasses
                .filter(c => new Date(c.class_date) >= startOfToday)
                .sort((a, b) => new Date(a.class_date) - new Date(b.class_date))[0];

              let progNextClassStr = 'Pendiente asignar';
              if (progUpcomingClass) {
                const d = new Date(progUpcomingClass.class_date);
                const day = d.getDate();
                const month = d.toLocaleString('es-ES', { month: 'short' });
                const time = d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false, hourCycle: 'h23' });
                progNextClassStr = `${day} ${month} · ${time} hrs`;
              } else if (progClassCount > 0) {
                progNextClassStr = '✓ Clases concluidas';
              }

              const coverImg = program.cover_image_url || program.image_url;
              const link = getDiplomadoLink(program.id);
              const isDisabled = program.is_published === false || program.status === 'draft' || program.status === 'disabled';

              return (
                <div 
                  key={program.id} 
                  style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    padding: 0, 
                    overflow: 'hidden', 
                    border: '1px solid #E2E8F0', 
                    borderRadius: '16px',
                    background: '#FFFFFF',
                    boxShadow: '0 1px 3px rgba(20, 33, 61, 0.03)',
                    transition: 'all 220ms cubic-bezier(0.16, 1, 0.3, 1)'
                  }}
                  onMouseOver={e => {
                    e.currentTarget.style.transform = 'translateY(-3px)';
                    e.currentTarget.style.boxShadow = '0 10px 28px rgba(20, 33, 61, 0.09)';
                    e.currentTarget.style.borderColor = 'var(--gold, #FCA311)';
                  }}
                  onMouseOut={e => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(20, 33, 61, 0.03)';
                    e.currentTarget.style.borderColor = '#E2E8F0';
                  }}
                >
                  {/* Portada visual superior estilizada (125px) */}
                  <div style={{ 
                    height: '125px', 
                    background: coverImg 
                      ? `linear-gradient(to bottom, rgba(20,33,61,0.25), rgba(20,33,61,0.85)), url(${coverImg}) center/cover no-repeat` 
                      : 'linear-gradient(135deg, var(--navy, #14213D) 0%, #1e3a5f 100%)', 
                    padding: '0.9rem 1.1rem',
                    display: 'flex', 
                    alignItems: 'flex-start', 
                    justifyContent: 'space-between', 
                    position: 'relative' 
                  }}>
                    <span style={{ 
                      background: 'rgba(252,163,17,0.95)', 
                      color: 'var(--navy, #14213D)', 
                      padding: '3px 9px', 
                      borderRadius: '8px', 
                      fontSize: '0.7rem', 
                      fontWeight: 800, 
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
                    }}>
                      {program.program_type === 'curso' ? '📘 Curso Corto' : (program.program_type === 'taller' ? '🛠️ Taller' : '🏛️ Diplomado UNAL')}
                    </span>
                    
                    {isDisabled ? (
                      <span style={{ 
                        background: '#FEE2E2', 
                        color: '#DC2626', 
                        padding: '3px 8px', 
                        borderRadius: '8px', 
                        fontSize: '0.68rem', 
                        fontWeight: 800,
                        textTransform: 'uppercase' 
                      }}>
                        Inhabilitado
                      </span>
                    ) : (
                      <span style={{ 
                        background: '#DCFCE7', 
                        color: '#007A2E', 
                        padding: '3px 8px', 
                        borderRadius: '8px', 
                        fontSize: '0.68rem', 
                        fontWeight: 800,
                        boxShadow: '0 2px 6px rgba(0,0,0,0.12)'
                      }}>
                        ● Asignado
                      </span>
                    )}
                  </div>
                  
                  {/* Cuerpo de la tarjeta */}
                  <div style={{ padding: '1.4rem', display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'space-between', gap: '1.1rem' }}>
                    <div>
                      <h3 style={{ fontSize: '1.12rem', color: 'var(--navy, #14213D)', fontWeight: 800, margin: '0 0 0.45rem 0', lineHeight: 1.35 }}>
                        {program.title}
                      </h3>
                      <p style={{ margin: 0, color: 'var(--text-muted, #64748B)', fontSize: '0.82rem', lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {program.description || 'Programa de formación académica especializada del Laboratorio LIATER.'}
                      </p>
                    </div>

                    {/* Métricas docentes compactas */}
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(2, 1fr)', 
                      gap: '0.75rem', 
                      background: '#F8FAFC', 
                      border: '1px solid #E2E8F0', 
                      borderRadius: '10px', 
                      padding: '0.8rem 1rem'
                    }}>
                      <div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted, #64748B)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Clases Asignadas
                        </div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--navy, #14213D)', marginTop: '2px' }}>
                          {progClassCount}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted, #64748B)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Próxima Sesión
                        </div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: progUpcomingClass ? 'var(--navy, #14213D)' : 'var(--text-muted, #64748B)', marginTop: '4px' }}>
                          {progNextClassStr}
                        </div>
                      </div>
                    </div>

                    {/* ACCIONES Y BOTONES */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {/* ACCESO RÁPIDO A CLASE EN VIVO (Si aplica) */}
                      {program.liveUrl && (
                        <a 
                          href={program.liveUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            gap: '0.45rem',
                            width: '100%', 
                            padding: '0.55rem 1rem', 
                            fontWeight: 800, 
                            fontSize: '0.84rem',
                            borderRadius: '8px',
                            background: 'var(--gold, #FCA311)',
                            color: 'var(--navy, #14213D)',
                            textDecoration: 'none',
                            boxShadow: '0 3px 10px rgba(252,163,17,0.3)'
                          }}
                        >
                          <Video size={16} /> Entrar a Sesión en Vivo
                        </a>
                      )}

                      {/* Botón de Acción Principal */}
                      <Link 
                        to={link} 
                        style={{ 
                          background: 'var(--navy, #14213D)', 
                          color: '#FFFFFF', 
                          border: 'none', 
                          textAlign: 'center', 
                          width: '100%', 
                          padding: '0.65rem 1rem', 
                          fontWeight: 700, 
                          fontSize: '0.86rem', 
                          borderRadius: '8px', 
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.45rem',
                          textDecoration: 'none',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseOver={e => e.currentTarget.style.background = '#000000'}
                        onMouseOut={e => e.currentTarget.style.background = 'var(--navy, #14213D)'}
                      >
                        <span>Entrar al Panel del Curso</span>
                        <ArrowRight size={14} color="var(--gold, #FCA311)" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }


  // -------------------------------------------------------------------
  // -------------------------------------------------------------------
  // VISTA 3: AGENDA (tab=agenda) - Rediseñado de Alta Fidelidad
  // -------------------------------------------------------------------
  if (activeTab === 'agenda') {
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const classesThisWeek = upcomingClasses.filter(c => new Date(c.class_date) <= in7Days);
    const classesThisMonth = upcomingClasses.filter(c => new Date(c.class_date) <= in30Days);

    let displayAgendaClasses = upcomingClasses;
    if (agendaFilter === 'semana') displayAgendaClasses = classesThisWeek;
    if (agendaFilter === 'mes') displayAgendaClasses = classesThisMonth;

    return (
      <div style={{ animation: 'fadeSlideUp 0.35s ease-out', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
        
        {/* ── HERO BANNER INSTITUCIONAL ── */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          padding: '1.75rem 2rem',
          border: '1px solid #E2E8F0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.25rem',
          boxShadow: '0 1px 3px rgba(20, 33, 61, 0.03)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '6px', flexWrap: 'wrap' }}>
              <span style={{
                background: '#F1F5F9',
                color: 'var(--navy, #14213D)',
                fontSize: '0.74rem',
                fontWeight: 800,
                padding: '3px 10px',
                borderRadius: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}>
                🏛️ CRONOGRAMA ACADÉMICO · PORTAL DOCENTE UNAL
              </span>
              <span style={{
                background: upcomingClasses.length > 0 ? '#DCFCE7' : '#F1F5F9',
                color: upcomingClasses.length > 0 ? '#007A2E' : '#64748B',
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '10px'
              }}>
                {upcomingClasses.length > 0 ? `● ${upcomingClasses.length} Sesiones Programadas` : '● Sin Clases Pendientes'}
              </span>
            </div>

            <h1 style={{ color: 'var(--navy, #14213D)', fontSize: '1.65rem', fontWeight: 800, margin: 0, lineHeight: 1.25 }}>
              Agenda de Clases y Sesiones
            </h1>
            <p style={{ color: 'var(--text-muted, #64748B)', fontSize: '0.9rem', margin: '6px 0 0 0', fontWeight: 400, maxWidth: '650px', lineHeight: 1.45 }}>
              Consulta tu programación sincrónica, conéctate a las aulas virtuales y gestiona el material pedagógico.
            </p>
          </div>

          <div style={{
            background: '#F8FAFC',
            padding: '0.75rem 1.15rem',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            gap: '0.85rem'
          }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'rgba(20,33,61,0.06)',
              color: 'var(--navy, #14213D)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <CalendarClock size={18} />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748B)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Próximos 7 Días
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--navy, #14213D)' }}>
                {classesThisWeek.length} {classesThisWeek.length === 1 ? 'Clase' : 'Clases'}
              </div>
            </div>
          </div>
        </div>

        {/* ── FILTROS TEMPORALES TIPO PÍLDORA ── */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {[
            { id: 'todas', label: 'Todas las Próximas', count: upcomingClasses.length },
            { id: 'semana', label: '⏱️ Próximos 7 Días', count: classesThisWeek.length },
            { id: 'mes', label: '🗓️ Próximos 30 Días', count: classesThisMonth.length },
          ].map(f => {
            const isActive = agendaFilter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setAgendaFilter(f.id)}
                style={{
                  padding: '0.5rem 1.1rem',
                  borderRadius: '9999px',
                  border: isActive ? '1.5px solid var(--navy, #14213D)' : '1px solid #E2E8F0',
                  background: isActive ? 'var(--navy, #14213D)' : '#FFFFFF',
                  color: isActive ? '#FFFFFF' : 'var(--navy, #14213D)',
                  fontWeight: 700,
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  boxShadow: isActive ? '0 3px 10px rgba(20,33,61,0.15)' : 'none',
                  transition: 'all 0.18s ease'
                }}
                onMouseOver={e => {
                  if (!isActive) {
                    e.currentTarget.style.borderColor = 'var(--gold, #FCA311)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }
                }}
                onMouseOut={e => {
                  if (!isActive) {
                    e.currentTarget.style.borderColor = '#E2E8F0';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }
                }}
              >
                <span>{f.label}</span>
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  padding: '1px 6px',
                  borderRadius: '8px',
                  background: isActive ? 'rgba(255,255,255,0.2)' : '#F1F5F9',
                  color: isActive ? '#FFFFFF' : 'var(--text-muted, #64748B)'
                }}>
                  {f.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── LISTADO DE SESIONES O ESTADO VACÍO ── */}
        {loading ? (
          <div style={{ padding: '3rem 2rem', textAlign: 'center', background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
            <p style={{ color: 'var(--text-muted, #64748B)', margin: 0 }}>Cargando agenda académica...</p>
          </div>
        ) : displayAgendaClasses.length === 0 ? (
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #E2E8F0',
            padding: '3.5rem 2rem',
            textAlign: 'center',
            boxShadow: '0 1px 3px rgba(20, 33, 61, 0.03)'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: '#F8FAFC',
              color: 'var(--navy, #14213D)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem',
              border: '1px solid #E2E8F0'
            }}>
              <CalendarClock size={30} style={{ opacity: 0.5 }} />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--navy, #14213D)', margin: '0 0 0.4rem 0' }}>
              No tienes clases programadas en este período
            </h3>
            <p style={{ color: 'var(--text-muted, #64748B)', fontSize: '0.9rem', maxWidth: '500px', margin: '0 auto 1.5rem auto', lineHeight: 1.5 }}>
              Las nuevas sesiones que te asigne la coordinación académica aparecerán aquí organizadas cronológicamente.
            </p>
            <Link 
              to="/portal?tab=programas" 
              style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '0.45rem', 
                background: 'var(--navy, #14213D)', 
                color: '#FFFFFF', 
                padding: '0.55rem 1.2rem', 
                borderRadius: '8px', 
                fontSize: '0.84rem', 
                fontWeight: 700, 
                textDecoration: 'none',
                transition: 'all 0.15s ease'
              }}
              onMouseOver={e => e.currentTarget.style.background = '#000000'}
              onMouseOut={e => e.currentTarget.style.background = 'var(--navy, #14213D)'}
            >
              <BookOpen size={15} /> Ver mis programas
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {displayAgendaClasses.map(cls => {
              const d = new Date(cls.class_date);
              const day = d.getDate();
              const month = d.toLocaleString('es-ES', { month: 'short' });
              const timeStr = d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false, hourCycle: 'h23' });
              const progTitle = cls.diploma_programs?.title || cls.sessions?.modules?.diploma_programs?.title || cls.subtopics?.modules?.diploma_programs?.title || 'Programa asignado';
              const progId = cls.diploma_programs?.id || cls.sessions?.modules?.diploma_programs?.id || cls.subtopics?.modules?.diploma_programs?.id || cls.program_id;
              
              const isLive = isClassLiveOrSoon(cls, 10);
              const isToday = new Date().toDateString() === d.toDateString();
              const meetUrl = cls.meet_url || cls.diploma_programs?.meet_url;

              return (
                <div 
                  key={cls.id} 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    padding: '1.4rem 1.6rem', 
                    background: '#FFFFFF', 
                    borderRadius: '16px', 
                    border: isLive ? '1.5px solid var(--gold, #FCA311)' : '1px solid #E2E8F0',
                    boxShadow: isLive ? '0 4px 16px rgba(252,163,17,0.15)' : '0 1px 3px rgba(20, 33, 61, 0.03)',
                    gap: '1.5rem', 
                    flexWrap: 'wrap',
                    transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)'
                  }}
                  onMouseOver={e => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(20, 33, 61, 0.07)';
                    if (!isLive) e.currentTarget.style.borderColor = 'var(--gold, #FCA311)';
                  }}
                  onMouseOut={e => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = isLive ? '0 4px 16px rgba(252,163,17,0.15)' : '0 1px 3px rgba(20, 33, 61, 0.03)';
                    if (!isLive) e.currentTarget.style.borderColor = '#E2E8F0';
                  }}
                >
                  {/* CALENDARIO MINIATURA ESTILIZADO */}
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '12px',
                    background: isLive ? 'var(--gold, #FCA311)' : 'var(--navy, #14213D)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '0 2px 8px rgba(20, 33, 61, 0.12)'
                  }}>
                    <span style={{
                      fontSize: '0.68rem',
                      color: isLive ? 'var(--navy, #14213D)' : 'var(--gold, #FCA311)',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      {month}
                    </span>
                    <span style={{
                      fontSize: '1.45rem',
                      color: isLive ? 'var(--navy, #14213D)' : '#FFFFFF',
                      fontWeight: 800,
                      lineHeight: 1
                    }}>
                      {day}
                    </span>
                  </div>

                  {/* INFORMACIÓN CENTRAL DE LA CLASE */}
                  <div style={{ flex: '1 1 280px', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: '0.74rem',
                        color: 'var(--gold-dark, #b45309)',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em'
                      }}>
                        🏛️ {progTitle}
                      </span>
                      {isLive ? (
                        <span style={{
                          background: '#FEE2E2',
                          color: '#DC2626',
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          padding: '2px 7px',
                          borderRadius: '6px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#DC2626' }}></span>
                          EN VIVO AHORA
                        </span>
                      ) : isToday ? (
                        <span style={{
                          background: '#DCFCE7',
                          color: '#007A2E',
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          padding: '2px 7px',
                          borderRadius: '6px'
                        }}>
                          ● HOY
                        </span>
                      ) : null}
                    </div>

                    <h3 style={{ margin: 0, color: 'var(--navy, #14213D)', fontSize: '1.15rem', fontWeight: 800, lineHeight: 1.3 }}>
                      {cls.title}
                    </h3>

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.85rem',
                      color: 'var(--text-muted, #64748B)',
                      fontSize: '0.82rem',
                      flexWrap: 'wrap',
                      marginTop: '2px'
                    }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 700, color: 'var(--navy, #14213D)' }}>
                        <Clock size={13} color="var(--gold, #FCA311)" /> {timeStr} hrs
                      </span>
                      <span>•</span>
                      <span>⏱️ Duración: {cls.duration || 90} min</span>
                      {meetUrl && (
                        <>
                          <span>•</span>
                          <span style={{ color: '#007A2E', fontWeight: 700 }}>🌐 Aula Virtual Google Meet</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* ACCIONES DIRECTAS */}
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* BOTÓN EN VIVO DIRECTO (Si aplica o tiene meetUrl) */}
                    {(isLive || meetUrl) && (
                      <a 
                        href={meetUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                          background: isLive ? 'var(--gold, #FCA311)' : '#F1F5F9',
                          color: 'var(--navy, #14213D)',
                          fontWeight: 800,
                          fontSize: '0.82rem',
                          padding: '0.55rem 1rem',
                          borderRadius: '8px',
                          textDecoration: 'none',
                          boxShadow: isLive ? '0 3px 10px rgba(252,163,17,0.3)' : 'none',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseOver={e => {
                          if (!isLive) e.currentTarget.style.background = '#E2E8F0';
                        }}
                        onMouseOut={e => {
                          if (!isLive) e.currentTarget.style.background = '#F1F5F9';
                        }}
                      >
                        <Video size={15} />
                        <span>{isLive ? 'Unirse a Clase' : 'Abrir Meet'}</span>
                      </a>
                    )}

                    {/* BOTÓN GESTIÓN EN PROGRAMA */}
                    <Link 
                      to={getDiplomadoLink(progId)} 
                      style={{ 
                        background: 'var(--navy, #14213D)', 
                        color: '#FFFFFF', 
                        fontWeight: 700, 
                        fontSize: '0.82rem', 
                        padding: '0.55rem 1.1rem', 
                        borderRadius: '8px', 
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        textDecoration: 'none',
                        transition: 'all 0.15s ease',
                        whiteSpace: 'nowrap'
                      }}
                      onMouseOver={e => e.currentTarget.style.background = '#000000'}
                      onMouseOut={e => e.currentTarget.style.background = 'var(--navy, #14213D)'}
                    >
                      <span>Gestionar Clase</span>
                      <ArrowRight size={13} color="var(--gold, #FCA311)" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------------
  // -------------------------------------------------------------------
  // VISTA 4: BANDEJA DE CONSULTAS (tab=consultas) - Rediseñado de Alta Fidelidad
  // -------------------------------------------------------------------
  if (activeTab === 'consultas') {
    // 1. Filtrar solo dudas PENDIENTES ('enviada' o 'revisada')
    const pendingQuestions = questions.filter(q => q.status === 'enviada' || q.status === 'revisada');

    // 2. Contadores
    const countTotalPending = pendingQuestions.length;
    const countNew = pendingQuestions.filter(q => q.status === 'enviada').length;
    const countRevised = pendingQuestions.filter(q => q.status === 'revisada').length;

    // 3. Aplicar sub-filtro de los 3 indicadores ('pendientes', 'enviadas', 'revisadas')
    let displayQuestions = pendingQuestions.filter(q => {
      if (doubtStatusFilter === 'enviada') return q.status === 'enviada';
      if (doubtStatusFilter === 'revisada') return q.status === 'revisada';
      return true;
    });

    // 4. Ordenar: Primero dudas nuevas ('enviada'), luego revisadas ('revisada')
    displayQuestions.sort((a, b) => {
      if (a.status === 'enviada' && b.status !== 'enviada') return -1;
      if (a.status !== 'enviada' && b.status === 'enviada') return 1;
      
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA;
    });

    return (
      <div style={{ animation: 'fadeSlideUp 0.35s ease-out', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
        
        {/* ── HERO BANNER INSTITUCIONAL ── */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          padding: '1.75rem 2rem',
          border: '1px solid #E2E8F0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.25rem',
          boxShadow: '0 1px 3px rgba(20, 33, 61, 0.03)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '6px', flexWrap: 'wrap' }}>
              <span style={{
                background: '#F1F5F9',
                color: 'var(--navy, #14213D)',
                fontSize: '0.74rem',
                fontWeight: 800,
                padding: '3px 10px',
                borderRadius: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}>
                🏛️ BANDEJA DE CONSULTAS · PORTAL DOCENTE UNAL
              </span>
              <span style={{
                background: countTotalPending === 0 ? '#DCFCE7' : '#FEF3C7',
                color: countTotalPending === 0 ? '#007A2E' : '#92400E',
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '10px'
              }}>
                {countTotalPending === 0 ? '● Al Día' : `● ${countTotalPending} Pendientes`}
              </span>
            </div>

            <h1 style={{ color: 'var(--navy, #14213D)', fontSize: '1.65rem', fontWeight: 800, margin: 0, lineHeight: 1.25 }}>
              Bandeja de Consultas Académicas
            </h1>
            <p style={{ color: 'var(--text-muted, #64748B)', fontSize: '0.9rem', margin: '6px 0 0 0', fontWeight: 400, maxWidth: '650px', lineHeight: 1.45 }}>
              Atiende y gestiona las dudas formuladas por los estudiantes en tus diplomados y clases asignadas.
            </p>
          </div>

          <div style={{
            background: '#F8FAFC',
            padding: '0.75rem 1.15rem',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            gap: '0.85rem'
          }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: countNew > 0 ? '#FEF3C7' : 'rgba(20,33,61,0.06)',
              color: countNew > 0 ? '#92400E' : 'var(--navy, #14213D)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <MessageSquareText size={18} />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748B)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Nuevas Consultas
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--navy, #14213D)' }}>
                {countNew} {countNew === 1 ? 'Nueva' : 'Nuevas'}
              </div>
            </div>
          </div>
        </div>

        {/* ── 3 INDICADORES / FILTROS MODULARES (KPIs) ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          
          {/* INDICADOR 1: PENDIENTES */}
          <div
            onClick={() => setDoubtStatusFilter('pendientes')}
            style={{
              padding: '1.2rem 1.35rem',
              borderRadius: '14px',
              cursor: 'pointer',
              background: '#FFFFFF',
              border: (doubtStatusFilter === 'pendientes' || doubtStatusFilter === 'todos') ? '2px solid var(--navy, #14213D)' : '1px solid #E2E8F0',
              boxShadow: (doubtStatusFilter === 'pendientes' || doubtStatusFilter === 'todos') ? '0 4px 14px rgba(20,33,61,0.1)' : '0 1px 3px rgba(20, 33, 61, 0.03)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.18s ease'
            }}
            onMouseOver={e => {
              if (doubtStatusFilter !== 'pendientes' && doubtStatusFilter !== 'todos') {
                e.currentTarget.style.borderColor = 'var(--gold, #FCA311)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }
            }}
            onMouseOut={e => {
              if (doubtStatusFilter !== 'pendientes' && doubtStatusFilter !== 'todos') {
                e.currentTarget.style.borderColor = '#E2E8F0';
                e.currentTarget.style.transform = 'translateY(0)';
              }
            }}
          >
            <div>
              <div style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-muted, #64748B)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Todas las Pendientes
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--navy, #14213D)', lineHeight: 1.1, marginTop: '4px' }}>
                {countTotalPending}
              </div>
            </div>
            <div style={{
              width: '40px', height: '40px', borderRadius: '10px',
              background: 'rgba(20,33,61,0.06)', color: 'var(--navy, #14213D)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <MessageSquare size={18} />
            </div>
          </div>

          {/* INDICADOR 2: NUEVAS */}
          <div
            onClick={() => setDoubtStatusFilter('enviada')}
            style={{
              padding: '1.2rem 1.35rem',
              borderRadius: '14px',
              cursor: 'pointer',
              background: '#FFFFFF',
              border: doubtStatusFilter === 'enviada' ? '2px solid var(--gold, #FCA311)' : '1px solid #E2E8F0',
              boxShadow: doubtStatusFilter === 'enviada' ? '0 4px 14px rgba(252,163,17,0.2)' : '0 1px 3px rgba(20, 33, 61, 0.03)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.18s ease'
            }}
            onMouseOver={e => {
              if (doubtStatusFilter !== 'enviada') {
                e.currentTarget.style.borderColor = 'var(--gold, #FCA311)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }
            }}
            onMouseOut={e => {
              if (doubtStatusFilter !== 'enviada') {
                e.currentTarget.style.borderColor = '#E2E8F0';
                e.currentTarget.style.transform = 'translateY(0)';
              }
            }}
          >
            <div>
              <div style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-muted, #64748B)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Nuevas sin Atender
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: countNew > 0 ? '#92400E' : 'var(--navy, #14213D)', lineHeight: 1.1, marginTop: '4px' }}>
                {countNew}
              </div>
            </div>
            <div style={{
              width: '40px', height: '40px', borderRadius: '10px',
              background: countNew > 0 ? '#FEF3C7' : '#F1F5F9', color: countNew > 0 ? '#92400E' : 'var(--text-muted, #64748B)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Sparkles size={18} />
            </div>
          </div>

          {/* INDICADOR 3: REVISADAS */}
          <div
            onClick={() => setDoubtStatusFilter('revisada')}
            style={{
              padding: '1.2rem 1.35rem',
              borderRadius: '14px',
              cursor: 'pointer',
              background: '#FFFFFF',
              border: doubtStatusFilter === 'revisada' ? '2px solid #007A2E' : '1px solid #E2E8F0',
              boxShadow: doubtStatusFilter === 'revisada' ? '0 4px 14px rgba(0,122,46,0.15)' : '0 1px 3px rgba(20, 33, 61, 0.03)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.18s ease'
            }}
            onMouseOver={e => {
              if (doubtStatusFilter !== 'revisada') {
                e.currentTarget.style.borderColor = 'var(--gold, #FCA311)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }
            }}
            onMouseOut={e => {
              if (doubtStatusFilter !== 'revisada') {
                e.currentTarget.style.borderColor = '#E2E8F0';
                e.currentTarget.style.transform = 'translateY(0)';
              }
            }}
          >
            <div>
              <div style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-muted, #64748B)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                En Proceso / Revisadas
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--navy, #14213D)', lineHeight: 1.1, marginTop: '4px' }}>
                {countRevised}
              </div>
            </div>
            <div style={{
              width: '40px', height: '40px', borderRadius: '10px',
              background: '#DCFCE7', color: '#007A2E',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <CheckCircle2 size={18} />
            </div>
          </div>

        </div>

        {/* ── LISTADO DE DUDAS O ESTADO VACÍO DE ÉXITO ── */}
        {loading ? (
          <div style={{ padding: '3rem 2rem', textAlign: 'center', background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
            <p style={{ color: 'var(--text-muted, #64748B)', margin: 0 }}>Cargando consultas de estudiantes...</p>
          </div>
        ) : displayQuestions.length === 0 ? (
          /* ESTADO POSITIVO DE ÉXITO (AL DÍA) */
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #E2E8F0',
            padding: '3.5rem 2rem',
            textAlign: 'center',
            boxShadow: '0 1px 3px rgba(20, 33, 61, 0.03)'
          }}>
            <div style={{
              width: '68px',
              height: '68px',
              borderRadius: '50%',
              background: '#DCFCE7',
              color: '#007A2E',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem',
              boxShadow: '0 4px 12px rgba(0, 122, 46, 0.12)'
            }}>
              <ShieldCheck size={34} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--navy, #14213D)', margin: '0 0 0.4rem 0' }}>
              ¡Todo al día con tus estudiantes!
            </h3>
            <p style={{ color: 'var(--text-muted, #64748B)', fontSize: '0.9rem', maxWidth: '520px', margin: '0 auto 1.5rem auto', lineHeight: 1.5 }}>
              No tienes dudas pendientes por responder en esta sección. Las nuevas consultas que formulen los alumnos en tus diplomados se sincronizarán aquí automáticamente.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link 
                to="/portal?tab=programas" 
                style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '0.45rem', 
                  background: 'var(--navy, #14213D)', 
                  color: '#FFFFFF', 
                  padding: '0.55rem 1.2rem', 
                  borderRadius: '8px', 
                  fontSize: '0.84rem', 
                  fontWeight: 700, 
                  textDecoration: 'none',
                  transition: 'all 0.15s ease'
                }}
                onMouseOver={e => e.currentTarget.style.background = '#000000'}
                onMouseOut={e => e.currentTarget.style.background = 'var(--navy, #14213D)'}
              >
                <BookOpen size={15} /> Ver mis programas
              </Link>
              <Link 
                to="/portal?tab=agenda" 
                style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '0.45rem', 
                  background: '#F8FAFC', 
                  color: 'var(--navy, #14213D)', 
                  border: '1px solid #E2E8F0',
                  padding: '0.55rem 1.2rem', 
                  borderRadius: '8px', 
                  fontSize: '0.84rem', 
                  fontWeight: 700, 
                  textDecoration: 'none',
                  transition: 'all 0.15s ease'
                }}
                onMouseOver={e => e.currentTarget.style.background = '#F1F5F9'}
                onMouseOut={e => e.currentTarget.style.background = '#F8FAFC'}
              >
                <CalendarDays size={15} color="var(--gold, #FCA311)" /> Ver agenda de clases
              </Link>
            </div>
          </div>
        ) : (
          /* FILAS DE DUDAS PENDIENTES */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {displayQuestions.map(q => {
              const isNueva = q.status === 'enviada';
              const progId = q.program_id || q.diploma_programs?.id;
              const programLink = getDiplomadoLink ? `${getDiplomadoLink(progId)}?tab=dudas&doubtId=${q.id}` : `/dashboard/profesor/${progId}?tab=dudas&doubtId=${q.id}`;

              return (
                <div 
                  key={q.id} 
                  style={{ 
                    padding: '1.4rem 1.6rem', 
                    background: '#FFFFFF', 
                    borderRadius: '16px', 
                    border: '1px solid #E2E8F0',
                    boxShadow: '0 1px 3px rgba(20, 33, 61, 0.03)',
                    transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.9rem'
                  }}
                  onMouseOver={e => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(20, 33, 61, 0.07)';
                    e.currentTarget.style.borderColor = 'var(--gold, #FCA311)';
                  }}
                  onMouseOut={e => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(20, 33, 61, 0.03)';
                    e.currentTarget.style.borderColor = '#E2E8F0';
                  }}
                >
                  {/* CABECERA DE LA DUDA */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                      <span 
                        style={{ 
                          fontSize: '0.72rem', 
                          fontWeight: 800, 
                          padding: '3px 10px', 
                          borderRadius: '8px', 
                          background: isNueva ? '#FEF3C7' : '#EFF6FF', 
                          color: isNueva ? '#92400E' : '#1D4ED8', 
                          border: isNueva ? '1px solid #FDE68A' : '1px solid #BFDBFE', 
                          whiteSpace: 'nowrap' 
                        }}
                      >
                        {isNueva ? '🔴 Nueva Consulta' : '⏳ En Proceso'}
                      </span>
                      <h3 style={{ margin: 0, fontWeight: 800, color: 'var(--navy, #14213D)', fontSize: '1.05rem', lineHeight: 1.35 }}>
                        {q.subject || 'Consulta de estudiante'}
                      </h3>
                    </div>

                    {q.created_at && (
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted, #64748B)', fontWeight: 600 }}>
                        {new Date(q.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>

                  {/* CUERPO / MENSAJE DEL ESTUDIANTE */}
                  <div style={{
                    background: '#F8FAFC',
                    padding: '0.85rem 1.1rem',
                    borderRadius: '10px',
                    border: '1px solid #F1F5F9'
                  }}>
                    <p style={{ 
                      color: '#334155', 
                      fontSize: '0.88rem', 
                      margin: 0, 
                      lineHeight: 1.5,
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      "{q.description}"
                    </p>
                  </div>

                  {/* PIE DE METADATOS Y ACCIONES */}
                  <div 
                    style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      flexWrap: 'wrap', 
                      gap: '0.75rem', 
                      paddingTop: '0.5rem', 
                      borderTop: '1px solid #F1F5F9', 
                      fontSize: '0.8rem', 
                      color: 'var(--text-muted, #64748B)' 
                    }}
                  >
                    <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 800, color: 'var(--navy, #14213D)' }}>
                        📖 {q.class_sessions?.title || 'Clase asignada'}
                      </span>
                      <span>•</span>
                      <span style={{ color: 'var(--gold-dark, #d4a017)', fontWeight: 700 }}>
                        🏛️ {q.diploma_programs?.title || 'Programa'}
                      </span>
                      <span>•</span>
                      <span>
                        Estudiante: <strong style={{ color: 'var(--navy, #14213D)' }}>{q.users_profile?.full_name || 'Estudiante'}</strong>
                      </span>
                    </div>

                    {/* BOTÓN RESPONDER */}
                    <Link
                      to={programLink}
                      style={{
                        background: 'var(--navy, #14213D)',
                        color: '#FFFFFF',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        padding: '0.45rem 1rem',
                        borderRadius: '8px',
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        transition: 'all 0.15s ease',
                        whiteSpace: 'nowrap'
                      }}
                      onMouseOver={e => e.currentTarget.style.background = '#000000'}
                      onMouseOut={e => e.currentTarget.style.background = 'var(--navy, #14213D)'}
                    >
                      <span>Atender en el Aula</span>
                      <ArrowRight size={13} color="var(--gold, #FCA311)" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------------
  // -------------------------------------------------------------------
  // VISTA 1: INICIO DOCENTE (default / tab=inicio) - Rediseñado de Alta Fidelidad
  // -------------------------------------------------------------------
  const todayFormatted = new Date().toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return (
    <div style={{ animation: 'fadeSlideUp 0.35s ease-out', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* ── BLOQUE 1: HERO BANNER INSTITUCIONAL ── */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        padding: '1.75rem 2rem',
        border: '1px solid #E2E8F0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1.25rem',
        boxShadow: '0 1px 3px rgba(20, 33, 61, 0.03)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '6px', flexWrap: 'wrap' }}>
            <span style={{
              background: '#F1F5F9',
              color: 'var(--navy, #14213D)',
              fontSize: '0.74rem',
              fontWeight: 800,
              padding: '3px 10px',
              borderRadius: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.04em'
            }}>
              🏛️ Portal Docente LIATER · UNAL
            </span>
            <span style={{
              background: '#DCFCE7',
              color: '#007A2E',
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '10px'
            }}>
              ● Modo Activo
            </span>
          </div>

          <h1 style={{ color: 'var(--navy, #14213D)', fontSize: '1.65rem', fontWeight: 800, margin: 0, lineHeight: 1.25, textTransform: 'capitalize' }}>
            Hola, {teacherName || 'Profesor'}
          </h1>
          <p style={{ color: 'var(--text-muted, #64748B)', fontSize: '0.9rem', margin: '6px 0 0 0', fontWeight: 400, maxWidth: '650px', lineHeight: 1.45 }}>
            Centro de mando docente: Consulta tus sesiones, atiende las consultas de tus estudiantes y gestiona tus diplomados asignados.
          </p>
        </div>

        <div style={{
          background: '#F8FAFC',
          padding: '0.65rem 1rem',
          borderRadius: '10px',
          border: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          color: 'var(--navy, #14213D)',
          fontSize: '0.82rem',
          fontWeight: 600,
          textTransform: 'capitalize'
        }}>
          <CalendarDays size={15} color="var(--gold, #FCA311)" />
          <span>{todayFormatted}</span>
        </div>
      </div>

      {/* ── BLOQUE 2: TRES TARJETAS DE KPIS OPERATIVOS ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '1.25rem'
      }}>
        {/* TARJETA 1: DUDAS POR REVISAR */}
        <Link
          to="/portal?tab=consultas"
          className="teacher-summary-card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '14px',
            padding: '1.4rem',
            boxShadow: '0 1px 3px rgba(20, 33, 61, 0.03)',
            textDecoration: 'none',
            color: 'inherit',
            transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
            minHeight: '160px',
            cursor: 'pointer'
          }}
          onMouseOver={e => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(20, 33, 61, 0.08)';
            e.currentTarget.style.borderColor = 'var(--gold, #FCA311)';
          }}
          onMouseOut={e => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(20, 33, 61, 0.03)';
            e.currentTarget.style.borderColor = '#E2E8F0';
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-muted, #64748B)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Dudas de Alumnos
              </span>
              <div style={{
                width: '38px', height: '38px', borderRadius: '10px',
                background: counts.doubts > 0 ? '#FEF3C7' : '#EFF6FF',
                color: counts.doubts > 0 ? '#92400E' : '#1D4ED8',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <MessageSquareText size={18} />
              </div>
            </div>
            {loading ? (
              <div style={{ width: '48px', height: '36px', background: '#F1F5F9', borderRadius: '4px', animation: 'pulse 1.5s infinite' }} />
            ) : (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.65rem' }}>
                <div style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--navy, #14213D)', lineHeight: 1 }}>
                  {counts.doubts}
                </div>
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '10px',
                  background: counts.doubts === 0 ? '#DCFCE7' : '#FEF3C7',
                  color: counts.doubts === 0 ? '#007A2E' : '#92400E'
                }}>
                  {counts.doubts === 0 ? '✓ Al día' : '⚠️ Requieren atención'}
                </span>
              </div>
            )}
          </div>
          
          <div style={{ marginTop: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.84rem', fontWeight: 700, color: 'var(--navy, #14213D)', borderTop: '1px solid #F1F5F9', paddingTop: '0.75rem' }}>
            <span>Revisar bandeja de dudas</span>
            <ChevronRight size={16} color="var(--gold, #FCA311)" />
          </div>
        </Link>

        {/* TARJETA 2: CLASES PRÓXIMAS */}
        <Link
          to="/portal?tab=agenda"
          className="teacher-summary-card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '14px',
            padding: '1.4rem',
            boxShadow: '0 1px 3px rgba(20, 33, 61, 0.03)',
            textDecoration: 'none',
            color: 'inherit',
            transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
            minHeight: '160px',
            cursor: 'pointer'
          }}
          onMouseOver={e => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(20, 33, 61, 0.08)';
            e.currentTarget.style.borderColor = 'var(--gold, #FCA311)';
          }}
          onMouseOut={e => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(20, 33, 61, 0.03)';
            e.currentTarget.style.borderColor = '#E2E8F0';
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-muted, #64748B)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Próximas Sesiones
              </span>
              <div style={{
                width: '38px', height: '38px', borderRadius: '10px',
                background: 'rgba(252,163,17,0.14)',
                color: 'var(--gold, #FCA311)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <CalendarClock size={18} />
              </div>
            </div>
            {loading ? (
              <div style={{ width: '48px', height: '36px', background: '#F1F5F9', borderRadius: '4px', animation: 'pulse 1.5s infinite' }} />
            ) : (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.65rem' }}>
                <div style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--navy, #14213D)', lineHeight: 1 }}>
                  {counts.upcomingClasses}
                </div>
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '10px',
                  background: '#F1F5F9',
                  color: 'var(--navy, #14213D)'
                }}>
                  Próximos 7 días
                </span>
              </div>
            )}
          </div>
          
          <div style={{ marginTop: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.84rem', fontWeight: 700, color: 'var(--navy, #14213D)', borderTop: '1px solid #F1F5F9', paddingTop: '0.75rem' }}>
            <span>Ver agenda y calendario</span>
            <ChevronRight size={16} color="var(--gold, #FCA311)" />
          </div>
        </Link>

        {/* TARJETA 3: PROGRAMAS ACTIVOS */}
        <Link
          to="/portal?tab=programas"
          className="teacher-summary-card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '14px',
            padding: '1.4rem',
            boxShadow: '0 1px 3px rgba(20, 33, 61, 0.03)',
            textDecoration: 'none',
            color: 'inherit',
            transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
            minHeight: '160px',
            cursor: 'pointer'
          }}
          onMouseOver={e => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(20, 33, 61, 0.08)';
            e.currentTarget.style.borderColor = 'var(--gold, #FCA311)';
          }}
          onMouseOut={e => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(20, 33, 61, 0.03)';
            e.currentTarget.style.borderColor = '#E2E8F0';
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-muted, #64748B)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Programas Asignados
              </span>
              <div style={{
                width: '38px', height: '38px', borderRadius: '10px',
                background: 'rgba(20,33,61,0.06)',
                color: 'var(--navy, #14213D)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <BookOpen size={18} />
              </div>
            </div>
            {loading ? (
              <div style={{ width: '48px', height: '36px', background: '#F1F5F9', borderRadius: '4px', animation: 'pulse 1.5s infinite' }} />
            ) : (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.65rem' }}>
                <div style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--navy, #14213D)', lineHeight: 1 }}>
                  {counts.activePrograms}
                </div>
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '10px',
                  background: '#DCFCE7',
                  color: '#007A2E'
                }}>
                  Diplomados activos
                </span>
              </div>
            )}
          </div>
          
          <div style={{ marginTop: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.84rem', fontWeight: 700, color: 'var(--navy, #14213D)', borderTop: '1px solid #F1F5F9', paddingTop: '0.75rem' }}>
            <span>Gestionar mis programas</span>
            <ChevronRight size={16} color="var(--gold, #FCA311)" />
          </div>
        </Link>
      </div>

      {/* ── BLOQUE 3: SESIÓN DESTACADA / PRÓXIMA CLASE ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
          <h2 style={{ color: 'var(--navy, #14213D)', fontSize: '1.15rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Video size={18} color="var(--gold, #FCA311)" /> Tu Próxima Sesión
          </h2>
          {nextClass && (
            <Link to="/portal?tab=agenda" style={{ color: 'var(--gold-dark, #d4a017)', fontSize: '0.82rem', fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px' }}>
              Ver agenda completa <ChevronRight size={14} />
            </Link>
          )}
        </div>

        {loading ? (
          <div style={{ padding: '2rem', background: '#FFFFFF', borderRadius: '14px', border: '1px solid #E2E8F0', textAlign: 'center', color: 'var(--text-muted, #64748B)' }}>
            Cargando próxima sesión...
          </div>
        ) : !nextClass ? (
          /* ESTADO SIN CLASES */
          <div style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '16px',
            padding: '2.5rem 2rem',
            textAlign: 'center',
            boxShadow: '0 1px 3px rgba(20, 33, 61, 0.03)'
          }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
              <CalendarDays size={28} color="var(--navy, #14213D)" style={{ opacity: 0.4 }} />
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--navy, #14213D)', margin: '0 0 0.35rem 0' }}>
              No tienes sesiones próximas agendadas
            </h3>
            <p style={{ color: 'var(--text-muted, #64748B)', fontSize: '0.88rem', margin: '0 0 1.25rem 0', maxWidth: '440px', marginLeft: 'auto', marginRight: 'auto' }}>
              Cuando la coordinación académica programe una nueva clase en tus diplomados, aparecerá aquí con acceso directo.
            </p>
            <Link
              to="/portal?tab=programas"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                background: 'var(--navy, #14213D)',
                color: '#FFFFFF',
                padding: '0.55rem 1.25rem',
                fontWeight: 700,
                fontSize: '0.85rem',
                borderRadius: '8px',
                textDecoration: 'none',
                transition: 'all 0.15s ease'
              }}
              onMouseOver={e => e.currentTarget.style.background = '#000000'}
              onMouseOut={e => e.currentTarget.style.background = 'var(--navy, #14213D)'}
            >
              <BookOpen size={15} /> Explorar mis programas
            </Link>
          </div>
        ) : (
          /* TARJETA DE PRÓXIMA CLASE */
          <div
            style={{
              background: '#FFFFFF',
              border: '1.5px solid #E2E8F0',
              borderRadius: '16px',
              padding: '1.5rem 1.75rem',
              boxShadow: '0 2px 8px rgba(20, 33, 61, 0.04)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1.5rem',
              flexWrap: 'wrap',
              transition: 'all 200ms ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flex: '1 1 300px' }}>
              {/* BLOQUE DE FECHA TIPO CALENDARIO */}
              <div style={{
                width: '68px',
                height: '68px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, var(--navy, #14213D) 0%, #1e3a5f 100%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 4px 10px rgba(20, 33, 61, 0.15)'
              }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--gold, #FCA311)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {nextClassMonth}
                </span>
                <span style={{ fontSize: '1.6rem', color: '#FFFFFF', fontWeight: 800, lineHeight: 1 }}>
                  {nextClassDay}
                </span>
              </div>

              {/* INFORMACIÓN DE LA CLASE */}
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: '0.72rem',
                    color: 'var(--gold, #FCA311)',
                    background: 'rgba(252,163,17,0.12)',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '6px',
                    textTransform: 'uppercase'
                  }}>
                    {nextClassProgTitle}
                  </span>
                  {nextClassModuleName && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748B)', fontWeight: 600 }}>
                      › {nextClassModuleName}
                    </span>
                  )}
                  {isClassLiveOrSoon(nextClass, 10) && (
                    <span style={{
                      background: '#FEE2E2', color: '#DC2626',
                      fontSize: '0.7rem', fontWeight: 800, padding: '1px 6px',
                      borderRadius: '10px', border: '1px solid rgba(220,38,38,0.3)'
                    }}>
                      🔴 EN VIVO
                    </span>
                  )}
                </div>

                <h3 style={{ margin: '0 0 0.4rem 0', color: 'var(--navy, #14213D)', fontSize: '1.15rem', fontWeight: 800, lineHeight: 1.3 }}>
                  {nextClass.title}
                </h3>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--text-muted, #64748B)', fontSize: '0.82rem', flexWrap: 'wrap' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={13} color="var(--navy, #14213D)" />
                    {nextClassTimeStr} hrs
                  </span>
                  {nextClass.duration && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <CalendarClock size={13} color="var(--navy, #14213D)" />
                      {nextClass.duration} min
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* ACCIONES A LA DERECHA */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0, flexWrap: 'wrap' }}>
              {/* Botón Agendar en Google Calendar */}
              {getGoogleCalendarUrl(nextClass, nextClassProgTitle, currentUser?.full_name) && (
                <a
                  href={getGoogleCalendarUrl(nextClass, nextClassProgTitle, currentUser?.full_name)}
                  target="_blank"
                  rel="noreferrer"
                  title="Agendar esta sesión en Google Calendar"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    background: '#FFFFFF',
                    color: 'var(--navy, #14213D)',
                    border: '1.5px solid var(--border-color, #E2E8F0)',
                    padding: '0.6rem 1.1rem',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '0.84rem',
                    textDecoration: 'none',
                    transition: 'all 0.15s ease',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                  }}
                  onMouseOver={e => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.borderColor = '#CBD5E1'; }}
                  onMouseOut={e => { e.currentTarget.style.background = '#FFFFFF'; e.currentTarget.style.borderColor = 'var(--border-color, #E2E8F0)'; }}
                >
                  <CalendarPlus size={15} color="var(--gold-dark, #b45309)" />
                  <span>Agendar en Calendar</span>
                </a>
              )}
              {isClassLiveOrSoon(nextClass, 10) && (nextClass.meet_url || diplomas.find(d => d.id === nextClassProgId)?.meet_url) ? (
                <a
                  href={nextClass.meet_url || diplomas.find(d => d.id === nextClassProgId)?.meet_url}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
                    background: 'var(--gold, #FCA311)', color: 'var(--navy, #14213D)',
                    padding: '0.6rem 1.25rem', borderRadius: '8px', fontWeight: 800,
                    fontSize: '0.86rem', textDecoration: 'none',
                    boxShadow: '0 4px 14px rgba(252,163,17,0.35)'
                  }}
                >
                  <Video size={16} /> Entrar a Clase en Vivo
                </a>
              ) : (
                <Link
                  to={getDiplomadoLink(nextClassProgId)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
                    background: 'var(--navy, #14213D)', color: '#FFFFFF',
                    padding: '0.6rem 1.25rem', borderRadius: '8px', fontWeight: 700,
                    fontSize: '0.84rem', textDecoration: 'none', transition: 'all 0.15s ease'
                  }}
                  onMouseOver={e => e.currentTarget.style.background = '#000000'}
                  onMouseOut={e => e.currentTarget.style.background = 'var(--navy, #14213D)'}
                >
                  <Eye size={15} /> Preparar y Gestionar Clase
                </Link>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── BLOQUE 4 (NUEVA FUNCIONALIDAD): MIS PROGRAMAS ASIGNADOS (Acceso Directo 1-Clic) ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h2 style={{ color: 'var(--navy, #14213D)', fontSize: '1.15rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Layers size={18} color="var(--gold, #FCA311)" /> Mis Programas Asignados
            </h2>
            <p style={{ color: 'var(--text-muted, #64748B)', fontSize: '0.82rem', margin: '3px 0 0 0' }}>
              Acceso directo de 1 clic al panel de gestión y contenidos de tus diplomados.
            </p>
          </div>
          {diplomas.length > 0 && (
            <Link to="/portal?tab=programas" style={{ color: 'var(--gold-dark, #d4a017)', fontSize: '0.82rem', fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px' }}>
              Ver todos ({diplomas.length}) <ChevronRight size={14} />
            </Link>
          )}
        </div>

        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted, #64748B)' }}>
            Cargando diplomados...
          </div>
        ) : diplomas.length === 0 ? (
          <div style={{ padding: '2rem', background: '#FFFFFF', borderRadius: '14px', border: '1px dashed #CBD5E1', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted, #64748B)', fontSize: '0.88rem', margin: 0 }}>
              No tienes programas asignados actualmente.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
            {diplomas.map(program => {
              const progClasses = classes.filter(c => 
                (c.diploma_programs?.id === program.id) || 
                (c.sessions?.modules?.diploma_programs?.id === program.id) || 
                (c.subtopics?.modules?.diploma_programs?.id === program.id) || 
                (c.program_id === program.id)
              );
              const link = getDiplomadoLink(program.id);

              return (
                <div
                  key={program.id}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: '0 1px 3px rgba(20, 33, 61, 0.03)',
                    transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)'
                  }}
                  onMouseOver={e => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(20, 33, 61, 0.08)';
                    e.currentTarget.style.borderColor = 'var(--gold, #FCA311)';
                  }}
                  onMouseOut={e => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(20, 33, 61, 0.03)';
                    e.currentTarget.style.borderColor = '#E2E8F0';
                  }}
                >
                  {/* CABECERA CON BANNER O GRADIENTE */}
                  <div style={{
                    background: program.cover_image_url
                      ? `linear-gradient(to bottom, rgba(20,33,61,0.3), rgba(20,33,61,0.85)), url(${program.cover_image_url}) center/cover no-repeat`
                      : 'linear-gradient(135deg, var(--navy, #14213D) 0%, #1e3a5f 100%)',
                    height: '90px',
                    padding: '0.85rem 1.1rem',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between'
                  }}>
                    <span style={{
                      background: 'rgba(252,163,17,0.9)',
                      color: 'var(--navy, #14213D)',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: '8px',
                      textTransform: 'uppercase'
                    }}>
                      {program.program_type === 'curso' ? '📘 Curso Corto' : '🏛️ Diplomado UNAL'}
                    </span>
                    <span style={{
                      background: 'rgba(255,255,255,0.2)',
                      color: '#FFFFFF',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '8px',
                      backdropFilter: 'blur(4px)'
                    }}>
                      {progClasses.length} {progClasses.length === 1 ? 'Clase' : 'Clases'}
                    </span>
                  </div>

                  {/* CUERPO DE LA TARJETA */}
                  <div style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1rem' }}>
                    <div>
                      <h3 style={{ margin: '0 0 0.4rem 0', color: 'var(--navy, #14213D)', fontSize: '1.05rem', fontWeight: 800, lineHeight: 1.35 }}>
                        {program.title}
                      </h3>
                      <p style={{ margin: 0, color: 'var(--text-muted, #64748B)', fontSize: '0.82rem', lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {program.description || 'Programa de formación académica especializada del Laboratorio LIATER.'}
                      </p>
                    </div>

                    {/* BOTON DIRECTO DE ENTRADA */}
                    <Link
                      to={link}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.45rem',
                        background: 'var(--navy, #14213D)',
                        color: '#FFFFFF',
                        padding: '0.55rem 1rem',
                        borderRadius: '8px',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        textDecoration: 'none',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseOver={e => e.currentTarget.style.background = '#000000'}
                      onMouseOut={e => e.currentTarget.style.background = 'var(--navy, #14213D)'}
                    >
                      <span>Entrar al Panel del Curso</span>
                      <ArrowRight size={14} color="var(--gold, #FCA311)" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── BLOQUE 5: AVISOS DE ADMINISTRACIÓN ── */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
          <h2 style={{ color: 'var(--navy, #14213D)', fontSize: '1.15rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Bell size={18} color="var(--gold, #FCA311)" /> Avisos de Administración
          </h2>
          {adminAnnouncements.length > 3 && (
            <button 
              onClick={() => setShowAllAdminAnn(!showAllAdminAnn)}
              style={{ color: 'var(--gold-dark, #d4a017)', fontSize: '0.82rem', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              {showAllAdminAnn ? 'Ver menos' : `Ver todos (${adminAnnouncements.length})`}
              <ChevronRight size={14} style={{ transform: showAllAdminAnn ? 'rotate(-90deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>
          )}
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-muted, #64748B)', fontSize: '0.85rem' }}>Cargando avisos...</p>
        ) : adminAnnouncements.length === 0 ? (
          <div style={{ padding: '2rem 1.5rem', textAlign: 'center', background: '#FFFFFF', borderRadius: '14px', border: '1px dashed #CBD5E1' }}>
            <p style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-muted, #64748B)', margin: 0 }}>
              No hay avisos recientes de la administración académica.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
            {(showAllAdminAnn ? adminAnnouncements : adminAnnouncements.slice(0, 3)).map(ann => {
              const dateObj = new Date(ann.created_at);
              const isGlobal = ann.is_global || (!ann.program_id && !ann.teacher_id);
              
              let scopeLabel = 'Toda la Institución';
              if (ann.program_id) {
                if (ann.target_role === 'student') scopeLabel = 'Estudiantes del Programa';
                else if (ann.target_role === 'teacher') scopeLabel = 'Profesores del Programa';
                else scopeLabel = 'Todos en el Programa';
              } else {
                if (ann.target_role === 'student') scopeLabel = 'Todos los Estudiantes';
                else if (ann.target_role === 'teacher') scopeLabel = 'Todos los Profesores';
              }

              const programName = ann.diploma_programs?.title || 'Anuncio Global';
              const programLink = ann.program_id ? getDiplomadoLink(ann.program_id) : '#';

              let tagStyle = { color: 'var(--navy, #14213D)', bg: '#F1F5F9', icon: '📢', label: 'General' };
              if (ann.tag === 'urgent') tagStyle = { color: '#991B1B', bg: '#FEE2E2', icon: '🔴', label: 'Urgente' };
              else if (ann.tag === 'info') tagStyle = { color: '#1D4ED8', bg: '#DBEAFE', icon: '📌', label: 'Informativo' };

              return (
                <div
                  key={ann.id}
                  style={{
                    padding: '1.35rem',
                    borderRadius: '14px',
                    border: '1px solid #E2E8F0',
                    background: '#FFFFFF',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.85rem',
                    boxShadow: '0 1px 3px rgba(20, 33, 61, 0.03)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: '0.7rem', fontWeight: 700, padding: '2px 7px', borderRadius: '6px',
                        background: isGlobal ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.12)',
                        color: isGlobal ? '#DC2626' : '#D97706', textTransform: 'uppercase'
                      }}>
                        {scopeLabel}
                      </span>
                      {ann.tag && (
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 7px', borderRadius: '6px', background: tagStyle.bg, color: tagStyle.color, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {tagStyle.icon} {tagStyle.label}
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted, #64748B)' }}>
                      {dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                    </span>
                  </div>
                  
                  <div>
                    <h4 style={{ margin: '0 0 0.35rem 0', fontSize: '1rem', fontWeight: 800, color: 'var(--navy, #14213D)' }}>
                      {ann.title}
                    </h4>
                    <p style={{ margin: 0, fontSize: '0.84rem', color: '#475569', lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {ann.body}
                    </p>
                  </div>
                  
                  <div style={{ marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.74rem' }}>
                    <span style={{ color: 'var(--text-muted, #64748B)', fontWeight: 600, maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {programName}
                    </span>
                    {ann.program_id && (
                      <Link to={`${programLink}?tab=anuncios`} style={{ color: 'var(--gold-dark, #d4a017)', fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        Ver <ArrowRight size={12} />
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}


/* ─────────────────────────────────────────────────────────────────────────────
   SUB-COMPONENTE: Portal de Administrador
───────────────────────────────────────────────────────────────────────────── */
function AdminPortal({ getDiplomadoLink }) {
  const { currentUser } = useAuth();
  const [counts, setCounts] = useState({ students: 0, teachers: 0, programs: 0 });
  const [diplomas, setDiplomas] = useState([]);
  const [recentUsers, setRecentUsers] = useState([]);
  
  // Estados para el Modal de Crear Programa
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [newProgram, setNewProgram] = useState({ title: '', description: '', program_type: 'diplomado' });

  // Estados para imagen de portada
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);

  // Habilitar / Inhabilitar un programa
  const handleTogglePublish = async (programId, currentPublishedState) => {
    const nextState = !currentPublishedState;
    try {
      const { error: updateError } = await supabase
        .from('diploma_programs')
        .update({ 
          is_published: nextState, 
          status: nextState ? 'published' : 'draft' 
        })
        .eq('id', programId);

      if (updateError) throw updateError;

      setDiplomas(prev => prev.map(p => 
        p.id === programId ? { ...p, is_published: nextState, status: nextState ? 'published' : 'draft' } : p
      ));
    } catch (err) {
      console.error('Error al cambiar estado del programa:', err);
      alert('No se pudo cambiar el estado del programa. Inténtalo de nuevo.');
    }
  };

  // Eliminar un programa y todo su contenido asociado
  const handleDeleteProgram = async (program) => {
    const confirmed = window.confirm(`¿Estás seguro de que deseas eliminar permanentemente el programa "${program.title}"?\n\nEsta acción no se puede deshacer y borrará TODOS sus módulos, clases, tareas, inscripciones y contenido asociado.`);
    if (!confirmed) return;

    try {
      // 1. Eliminar inscripciones vinculadas
      await supabase.from('enrollments').delete().eq('diploma_id', program.id);

      // 2. Eliminar tareas y cuestionarios vinculados
      try {
        await supabase.from('assignments').delete().eq('program_id', program.id);
        await supabase.from('quizzes').delete().eq('program_id', program.id);
      } catch {
        // Ignorar si las tablas aún no tienen registros
      }

      // 3. Eliminar clases del programa
      await supabase.from('class_sessions').delete().eq('program_id', program.id);

      // 4. Eliminar sesiones y módulos del programa (cascada a sesiones y clases)
      await supabase.from('sessions').delete().eq('program_id', program.id);
      await supabase.from('subtopics').delete().eq('program_id', program.id);
      await supabase.from('modules').delete().eq('program_id', program.id);
      await supabase.from('modules').delete().eq('diploma_id', program.id);

      // 5. Eliminar el registro principal en diploma_programs
      const { error: deleteError } = await supabase
        .from('diploma_programs')
        .delete()
        .eq('id', program.id);

      if (deleteError) throw deleteError;

      setDiplomas(prev => prev.filter(p => p.id !== program.id));
      setCounts(prev => ({ ...prev, programs: Math.max(0, prev.programs - 1) }));
    } catch (err) {
      console.error('Error al eliminar el programa y su contenido:', err);
      alert('Hubo un error al intentar eliminar el programa.');
    }
  };

  useEffect(() => {
    async function fetchData() {
      // Counts
      const pStudents = supabase.from('users_profile').select('*', { count: 'exact', head: true }).eq('role', 'student');
      const pTeachers = supabase.from('users_profile').select('*', { count: 'exact', head: true }).eq('role', 'teacher');
      const pPrograms = supabase.from('diploma_programs').select('*', { count: 'exact', head: true });
      
      const [resS, resT, resP] = await Promise.all([pStudents, pTeachers, pPrograms]);
      setCounts({ students: resS.count || 0, teachers: resT.count || 0, programs: resP.count || 0 });

      // Diplomas list
      const { data: dData } = await supabase.from('diploma_programs').select('*').order('created_at', { ascending: false });
      
      let diplomasData = dData || [];
      if (diplomasData.length > 0) {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

        const { data: todayClasses } = await supabase
          .from('class_sessions')
          .select('program_id, meet_url, class_date, duration, video_url')
          .in('program_id', diplomasData.map(d => d.id))
          .gte('class_date', todayStart)
          .lt('class_date', todayEnd);

        diplomasData = diplomasData.map(dip => {
          const liveClass = todayClasses?.find(c => c.program_id === dip.id && isClassLiveOrSoon(c, 10));
          const liveUrl = liveClass ? (liveClass.meet_url || dip.meet_url) : null;
          return { ...dip, liveUrl };
        });
      }
      setDiplomas(diplomasData);

      // Recent users
      const { data: rData } = await supabase.from('users_profile').select('*').order('created_at', { ascending: false }).limit(5);
      setRecentUsers(rData || []);
    }
    fetchData();
  }, []);

  const handleCreateProgram = async (e) => {
    e.preventDefault();
    if (!newProgram.title.trim()) {
      setError('El título es obligatorio.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      // 1. Crear el programa base en diploma_programs
      const { data: progData, error: progError } = await supabase
        .from('diploma_programs')
        .insert([{ 
          title: newProgram.title, 
          description: newProgram.description, 
          program_type: newProgram.program_type 
        }])
        .select()
        .single();

      if (progError) throw progError;

      // 2. Subir imagen de portada si se seleccionó un archivo
      if (coverFile && progData?.id) {
        const { publicUrl, error: uploadErr } = await uploadProgramCover(coverFile, progData.id);
        if (uploadErr) {
          console.error("Advertencia al subir portada:", uploadErr);
        } else if (publicUrl) {
          await supabase
            .from('diploma_programs')
            .update({ image_url: publicUrl })
            .eq('id', progData.id);
          progData.image_url = publicUrl;
        }
      }

      // 3. Si es un curso, creamos un Módulo Invisible
      if (newProgram.program_type === 'curso') {
        const { error: modError } = await supabase
          .from('modules')
          .insert([{
            program_id: progData.id,
            title: `Módulo General - ${progData.title}`,
            description: 'Módulo contenedor automático para curso corto',
            order_index: 0
          }]);
        if (modError) console.error("Error creando módulo por defecto para el curso:", modError);
      }

      setDiplomas([progData, ...diplomas]);
      setCounts(prev => ({ ...prev, programs: prev.programs + 1 }));
      setShowModal(false);
      setNewProgram({ title: '', description: '', program_type: 'diplomado' });
      setCoverFile(null);
      setCoverPreview(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const _getRoleLabel = (role) => {
    if (role === 'admin') return 'Administrador';
    if (role === 'teacher') return 'Profesor';
    return 'Estudiante';
  };

  const _getInitials = (name) => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.25rem', animation: 'fadeSlideUp 0.35s ease-out' }}>
      
      {/* HEADER DE BIENVENIDA HERO EN AZUL OSCURO INSTITUCIONAL (#14213D) */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        flexWrap: 'wrap', 
        gap: '1.25rem',
        padding: '1.75rem 2rem',
        background: 'linear-gradient(135deg, #14213D 0%, #1A2B4C 100%)',
        borderRadius: '16px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 10px 25px -5px rgba(20, 33, 61, 0.25), 0 8px 10px -6px rgba(20, 33, 61, 0.2)',
        color: '#FFFFFF',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Glow sutil de acento */}
        <div style={{
          position: 'absolute',
          top: '-40px',
          right: '-40px',
          width: '180px',
          height: '180px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(252, 163, 17, 0.18) 0%, rgba(20, 33, 61, 0) 70%)',
          pointerEvents: 'none'
        }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.45rem' }}>
            <span style={{ 
              fontSize: '0.72rem', 
              fontWeight: 800, 
              padding: '3px 10px', 
              borderRadius: '20px', 
              background: 'rgba(252, 163, 17, 0.2)', 
              color: '#FCA311', 
              textTransform: 'uppercase', 
              letterSpacing: '0.06em',
              border: '1px solid rgba(252, 163, 17, 0.3)'
            }}>
              Administración Global
            </span>
            <span style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.4)' }}>•</span>
            <span style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.7)', fontWeight: 500 }}>
              {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#FFFFFF', margin: 0, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Panel de Control LIATER
          </h1>
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.88rem', color: 'rgba(255, 255, 255, 0.82)', lineHeight: 1.4 }}>
            ¡Hola, {currentUser?.full_name?.split(' ')[0] || 'Administrador'}! Bienvenido a tu centro de supervisión de programas, profesores y estudiantes.
          </p>
        </div>
      </div>

      {/* BLOQUE 1: MÉTRICAS GLOBALES ADMIN (KPIS — accionables) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
        
        {/* Total Estudiantes → /users */}
        <Link to="/users" style={{ textDecoration: 'none' }}>
          <div style={{
            background: '#FFFFFF', borderRadius: '14px', padding: '1.4rem 1.5rem',
            border: '1px solid #E2E8F0', boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.05)',
            display: 'flex', alignItems: 'center', gap: '1.25rem',
            position: 'relative', overflow: 'hidden', cursor: 'pointer',
            transition: 'box-shadow 0.2s, transform 0.2s'
          }}
            onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px -4px rgba(15,23,42,0.12)'; }}
            onMouseOut={e  => { e.currentTarget.style.transform = 'translateY(0)';    e.currentTarget.style.boxShadow = '0 4px 20px -2px rgba(15,23,42,0.05)'; }}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, #14213D, #2563EB)' }} />
            <div style={{ width: '52px', height: '52px', borderRadius: '12px', background: 'rgba(20, 33, 61, 0.07)', color: '#14213D', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Users size={24} />
            </div>
            <div>
              <span style={{ fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748B' }}>Total Estudiantes</span>
              <div style={{ fontSize: '2.1rem', fontWeight: 800, color: '#14213D', lineHeight: 1.1, marginTop: '0.15rem' }}>{counts.students}</div>
            </div>
          </div>
        </Link>

        {/* Programas Creados → scroll al catálogo */}
        <a href="#admin-catalogos" style={{ textDecoration: 'none' }}>
          <div style={{
            background: '#FFFFFF', borderRadius: '14px', padding: '1.4rem 1.5rem',
            border: '1px solid #E2E8F0', boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.05)',
            display: 'flex', alignItems: 'center', gap: '1.25rem',
            position: 'relative', overflow: 'hidden', cursor: 'pointer',
            transition: 'box-shadow 0.2s, transform 0.2s'
          }}
            onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px -4px rgba(15,23,42,0.12)'; }}
            onMouseOut={e  => { e.currentTarget.style.transform = 'translateY(0)';    e.currentTarget.style.boxShadow = '0 4px 20px -2px rgba(15,23,42,0.05)'; }}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, #4F46E5, #06B6D4)' }} />
            <div style={{ width: '52px', height: '52px', borderRadius: '12px', background: 'rgba(79, 70, 229, 0.08)', color: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <BookOpen size={24} />
            </div>
            <div>
              <span style={{ fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748B' }}>Programas Creados</span>
              <div style={{ fontSize: '2.1rem', fontWeight: 800, color: '#14213D', lineHeight: 1.1, marginTop: '0.15rem' }}>{counts.programs}</div>
            </div>
          </div>
        </a>

        {/* Profesores → /users */}
        <Link to="/users" style={{ textDecoration: 'none' }}>
          <div style={{
            background: '#FFFFFF', borderRadius: '14px', padding: '1.4rem 1.5rem',
            border: '1px solid #E2E8F0', boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.05)',
            display: 'flex', alignItems: 'center', gap: '1.25rem',
            position: 'relative', overflow: 'hidden', cursor: 'pointer',
            transition: 'box-shadow 0.2s, transform 0.2s'
          }}
            onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px -4px rgba(15,23,42,0.12)'; }}
            onMouseOut={e  => { e.currentTarget.style.transform = 'translateY(0)';    e.currentTarget.style.boxShadow = '0 4px 20px -2px rgba(15,23,42,0.05)'; }}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, #FCA311, #F59E0B)' }} />
            <div style={{ width: '52px', height: '52px', borderRadius: '12px', background: 'rgba(252, 163, 17, 0.12)', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <GraduationCap size={24} />
            </div>
            <div>
              <span style={{ fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748B' }}>Profesores</span>
              <div style={{ fontSize: '2.1rem', fontWeight: 800, color: '#14213D', lineHeight: 1.1, marginTop: '0.15rem' }}>{counts.teachers}</div>
            </div>
          </div>
        </Link>

      </div>

      {/* BLOQUE 1.5: ACCESOS RÁPIDOS GLOBALES */}
      <div style={{ background: '#FFFFFF', borderRadius: '14px', padding: '1.25rem 1.5rem', border: '1px solid #E2E8F0', boxShadow: '0 4px 20px -2px rgba(15,23,42,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748B' }}>Accesos Rápidos</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>

          {/* Nuevo Programa */}
          <button
            onClick={() => { setNewProgram({ title: '', description: '', program_type: 'diplomado' }); setShowModal(true); }}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.85rem',
              padding: '0.9rem 1.1rem', borderRadius: '10px',
              background: 'rgba(20,33,61,0.05)', border: '1px solid #E2E8F0',
              cursor: 'pointer', textAlign: 'left', transition: 'all 0.18s'
            }}
            onMouseOver={e => { e.currentTarget.style.background = 'rgba(20,33,61,0.09)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseOut={e  => { e.currentTarget.style.background = 'rgba(20,33,61,0.05)'; e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            <div style={{ width: 36, height: 36, borderRadius: '8px', background: '#14213D', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Plus size={18} color="#FCA311" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.87rem', color: '#14213D' }}>Nuevo Programa</div>
              <div style={{ fontSize: '0.74rem', color: '#64748B', marginTop: 2 }}>Crear diplomado o curso</div>
            </div>
          </button>

          {/* Gestión de Usuarios */}
          <Link to="/users" style={{ textDecoration: 'none' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.85rem',
              padding: '0.9rem 1.1rem', borderRadius: '10px',
              background: 'rgba(252,163,17,0.07)', border: '1px solid #FDE68A',
              cursor: 'pointer', transition: 'all 0.18s'
            }}
              onMouseOver={e => { e.currentTarget.style.background = 'rgba(252,163,17,0.13)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseOut={e  => { e.currentTarget.style.background = 'rgba(252,163,17,0.07)'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <div style={{ width: 36, height: 36, borderRadius: '8px', background: '#FCA311', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Users size={18} color="#14213D" />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.87rem', color: '#14213D' }}>Gestión de Usuarios</div>
                <div style={{ fontSize: '0.74rem', color: '#64748B', marginTop: 2 }}>Ver y administrar cuentas</div>
              </div>
            </div>
          </Link>

          {/* Comunicaciones */}
          <Link to="/communications" style={{ textDecoration: 'none' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.85rem',
              padding: '0.9rem 1.1rem', borderRadius: '10px',
              background: 'rgba(79,70,229,0.06)', border: '1px solid #C7D2FE',
              cursor: 'pointer', transition: 'all 0.18s'
            }}
              onMouseOver={e => { e.currentTarget.style.background = 'rgba(79,70,229,0.11)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseOut={e  => { e.currentTarget.style.background = 'rgba(79,70,229,0.06)'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <div style={{ width: 36, height: 36, borderRadius: '8px', background: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <MessageSquare size={18} color="#FFFFFF" />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.87rem', color: '#14213D' }}>Comunicaciones</div>
                <div style={{ fontSize: '0.74rem', color: '#64748B', marginTop: 2 }}>Anuncios y mensajes globales</div>
              </div>
            </div>
          </Link>

        </div>
      </div>

      {/* BLOQUE PRINCIPAL: CATÁLOGOS + SIDEBAR */}
      <div id="admin-catalogos" />
      <div className="portal-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: '2rem', alignItems: 'start' }}>
        <div className="portal-main" style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
          
          {/* SECCIÓN 1: DIPLOMADOS */}
          <div style={{ 
            background: '#FFFFFF', 
            borderRadius: '16px', 
            padding: '1.75rem', 
            border: '1px solid #E2E8F0', 
            boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.04)' 
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid #F1F5F9' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', color: '#14213D', margin: 0, fontWeight: 800 }}>
                  Catálogo de Diplomados
                </h2>
                <span style={{ fontSize: '0.82rem', color: '#64748B', fontWeight: 500, marginTop: '3px', display: 'block' }}>
                  Programas de formación integral estructurados en módulos temáticos y clases interactivas.
                </span>
              </div>
              <span style={{ 
                fontSize: '0.75rem', 
                fontWeight: 700, 
                padding: '4px 10px', 
                borderRadius: '20px', 
                background: 'rgba(252, 163, 17, 0.12)', 
                color: '#B45309' 
              }}>
                {diplomas.filter(d => d.program_type !== 'curso').length} Registrados
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
              {diplomas.filter(d => d.program_type !== 'curso').map(dip => {
                const isPublished = dip.is_published !== false && dip.status !== 'draft';

                return (
                  <div 
                    key={dip.id} 
                    style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      background: '#FFFFFF', 
                      border: '1.5px solid #CBD5E1', 
                      borderRadius: '14px',
                      padding: '1.35rem', 
                      boxShadow: '0 4px 12px rgba(15, 23, 42, 0.06), 0 1px 3px rgba(15, 23, 42, 0.04)',
                      position: 'relative',
                      overflow: 'hidden',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.borderColor = '#94A3B8';
                      e.currentTarget.style.boxShadow = '0 8px 22px rgba(15, 23, 42, 0.10)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.borderColor = '#CBD5E1';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(15, 23, 42, 0.06), 0 1px 3px rgba(15, 23, 42, 0.04)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    {/* Indicador de acento superior */}
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: isPublished ? '#FCA311' : '#CBD5E1' }} />

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', marginTop: '2px' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', background: '#14213D', color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Diplomado
                      </span>
                      <span style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '5px', 
                        fontSize: '0.72rem', 
                        fontWeight: 700, 
                        padding: '3px 8px', 
                        borderRadius: '20px', 
                        background: isPublished ? '#DCFCE7' : '#F1F5F9', 
                        color: isPublished ? '#15803D' : '#64748B' 
                      }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: isPublished ? '#16A34A' : '#94A3B8' }} />
                        {isPublished ? 'Activo' : 'Inhabilitado'}
                      </span>
                    </div>

                    <h3 style={{ fontSize: '1.05rem', marginBottom: '0.45rem', color: '#14213D', lineHeight: '1.35', fontWeight: 700 }}>
                      {dip.title}
                    </h3>
                    <p style={{ 
                      color: '#64748B', 
                      fontSize: '0.82rem', 
                      marginBottom: '1.25rem', 
                      flexGrow: 1, 
                      lineHeight: 1.45,
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {dip.description || 'Sin descripción detallada.'}
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid #F1F5F9' }}>
                      <Link
                        onClick={() => {
                          localStorage.setItem('activeProgramId', dip.id);
                          localStorage.setItem('activeProgramType', dip.program_type);
                          window.dispatchEvent(new Event('programContextChanged'));
                        }}
                        to={getDiplomadoLink(dip.id)}
                        className="btn btn-gold"
                        style={{ 
                          textAlign: 'center', 
                          width: '100%', 
                          justifyContent: 'center', 
                          padding: '0.6rem', 
                          fontWeight: 700, 
                          borderRadius: '8px', 
                          fontSize: '0.85rem',
                          background: '#FCA311',
                          color: '#14213D',
                          boxShadow: '0 2px 8px rgba(252, 163, 17, 0.25)'
                        }}
                      >
                        Administrar →
                      </Link>

                      {/* BOTONES DE INHABILITAR / ELIMINAR */}
                      <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                        <button
                          type="button"
                          onClick={() => handleTogglePublish(dip.id, isPublished)}
                          title={isPublished ? 'Inhabilitar programa (ocultar de estudiantes)' : 'Habilitar programa'}
                          style={{
                            flex: 1,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                            padding: '0.45rem 0.5rem', borderRadius: '7px',
                            fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                            background: isPublished ? '#FFFBEB' : '#EFF6FF',
                            color: isPublished ? '#B45309' : '#1D4ED8',
                            border: isPublished ? '1px solid #FDE68A' : '1px solid #BFDBFE',
                            transition: 'all 0.2s'
                          }}
                        >
                          {isPublished ? <EyeOff size={13} /> : <Eye size={13} />}
                          <span>{isPublished ? 'Inhabilitar' : 'Habilitar'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteProgram(dip)}
                          title="Eliminar programa permanentemente"
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                            padding: '0.45rem 0.65rem', borderRadius: '7px',
                            fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                            background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA',
                            transition: 'all 0.2s'
                          }}
                        >
                          <Trash2 size={13} />
                          <span>Eliminar</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Tarjeta de Crear Diplomado */}
              <div
                onClick={() => { setNewProgram({...newProgram, program_type: 'diplomado'}); setShowModal(true); }}
                style={{ textDecoration: 'none', cursor: 'pointer' }}
              >
                <div style={{
                  display: 'flex', flexDirection: 'column', border: '2px dashed #94A3B8',
                  borderRadius: '14px', background: '#F8FAFC', padding: '1.5rem',
                  alignItems: 'center', justifyContent: 'center', color: '#14213D',
                  height: '100%', minHeight: '210px', transition: 'all 0.2s ease',
                  textAlign: 'center'
                }}
                onMouseOver={(e) => { e.currentTarget.style.borderColor = '#FCA311'; e.currentTarget.style.background = '#FFFDF5'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseOut={(e) => { e.currentTarget.style.borderColor = '#94A3B8'; e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                  <div style={{ width: '46px', height: '46px', borderRadius: '50%', background: '#14213D', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.75rem', color: '#FCA311' }}>
                    <Plus size={22} />
                  </div>
                  <span style={{ fontWeight: 800, fontSize: '0.92rem', color: '#14213D' }}>Crear Nuevo Diplomado</span>
                  <span style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '4px' }}>Agregar programa modular</span>
                </div>
              </div>
            </div>
          </div>

          {/* SECCIÓN 2: CURSOS CORTOS */}
          <div style={{ 
            background: '#FFFFFF', 
            borderRadius: '16px', 
            padding: '1.75rem', 
            border: '1px solid #E2E8F0', 
            boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.04)' 
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid #F1F5F9' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', color: '#14213D', margin: 0, fontWeight: 800 }}>
                  Catálogo de Cursos Cortos
                </h2>
                <span style={{ fontSize: '0.82rem', color: '#64748B', fontWeight: 500, marginTop: '3px', display: 'block' }}>
                  Programas especializados y de temario continuo diseñados para un aprendizaje dinámico y práctico.
                </span>
              </div>
              <span style={{ 
                fontSize: '0.75rem', 
                fontWeight: 700, 
                padding: '4px 10px', 
                borderRadius: '20px', 
                background: 'rgba(20, 33, 61, 0.08)', 
                color: '#14213D' 
              }}>
                {diplomas.filter(d => d.program_type === 'curso').length} Registrados
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
              {diplomas.filter(d => d.program_type === 'curso').map(dip => {
                const isPublished = dip.is_published !== false && dip.status !== 'draft';

                return (
                  <div 
                    key={dip.id} 
                    style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      background: '#FFFFFF', 
                      border: '1.5px solid #CBD5E1', 
                      borderRadius: '14px',
                      padding: '1.35rem', 
                      boxShadow: '0 4px 12px rgba(15, 23, 42, 0.06), 0 1px 3px rgba(15, 23, 42, 0.04)',
                      position: 'relative',
                      overflow: 'hidden',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.borderColor = '#94A3B8';
                      e.currentTarget.style.boxShadow = '0 8px 22px rgba(15, 23, 42, 0.10)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.borderColor = '#CBD5E1';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(15, 23, 42, 0.06), 0 1px 3px rgba(15, 23, 42, 0.04)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    {/* Indicador de acento superior */}
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: isPublished ? '#14213D' : '#CBD5E1' }} />

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', marginTop: '2px' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', background: '#F1F5F9', color: '#14213D', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Curso Corto
                      </span>
                      <span style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '5px', 
                        fontSize: '0.72rem', 
                        fontWeight: 700, 
                        padding: '3px 8px', 
                        borderRadius: '20px', 
                        background: isPublished ? '#DCFCE7' : '#F1F5F9', 
                        color: isPublished ? '#15803D' : '#64748B' 
                      }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: isPublished ? '#16A34A' : '#94A3B8' }} />
                        {isPublished ? 'Activo' : 'Inhabilitado'}
                      </span>
                    </div>

                    <h3 style={{ fontSize: '1.05rem', marginBottom: '0.45rem', color: '#14213D', lineHeight: '1.35', fontWeight: 700 }}>
                      {dip.title}
                    </h3>
                    <p style={{ 
                      color: '#64748B', 
                      fontSize: '0.82rem', 
                      marginBottom: '1.25rem', 
                      flexGrow: 1, 
                      lineHeight: 1.45,
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {dip.description || 'Sin descripción detallada.'}
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid #F1F5F9' }}>
                      
                      {/* ACCESO RÁPIDO A CLASE EN VIVO (Si aplica) */}
                      {dip.liveUrl && (
                        <a 
                          href={dip.liveUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            gap: '0.4rem',
                            width: '100%', 
                            padding: '0.45rem 1rem', 
                            fontWeight: 700, 
                            fontSize: '0.85rem',
                            borderRadius: '6px',
                            background: '#FCA311',
                            color: '#14213D',
                            textDecoration: 'none',
                            boxShadow: '0 2px 4px rgba(252,163,17,0.2)',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseOver={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                          onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
                        >
                          <Video size={16} /> Unirse a la sesión en vivo
                        </a>
                      )}

                      <Link
                        onClick={() => {
                          localStorage.setItem('activeProgramId', dip.id);
                          localStorage.setItem('activeProgramType', dip.program_type);
                          window.dispatchEvent(new Event('programContextChanged'));
                        }}
                        to={getDiplomadoLink(dip.id)}
                        className="btn btn-navy"
                        style={{ 
                          textAlign: 'center', 
                          width: '100%', 
                          justifyContent: 'center', 
                          padding: '0.6rem', 
                          fontWeight: 700, 
                          borderRadius: '8px', 
                          fontSize: '0.85rem',
                          background: '#14213D',
                          color: '#FFFFFF',
                          boxShadow: '0 2px 8px rgba(20, 33, 61, 0.25)'
                        }}
                      >
                        Administrar →
                      </Link>

                      {/* BOTONES DE INHABILITAR / ELIMINAR */}
                      <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                        <button
                          type="button"
                          onClick={() => handleTogglePublish(dip.id, isPublished)}
                          title={isPublished ? 'Inhabilitar programa (ocultar de estudiantes)' : 'Habilitar programa'}
                          style={{
                            flex: 1,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                            padding: '0.45rem 0.5rem', borderRadius: '7px',
                            fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                            background: isPublished ? '#FFFBEB' : '#EFF6FF',
                            color: isPublished ? '#B45309' : '#1D4ED8',
                            border: isPublished ? '1px solid #FDE68A' : '1px solid #BFDBFE',
                            transition: 'all 0.2s'
                          }}
                        >
                          {isPublished ? <EyeOff size={13} /> : <Eye size={13} />}
                          <span>{isPublished ? 'Inhabilitar' : 'Habilitar'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteProgram(dip)}
                          title="Eliminar programa permanentemente"
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                            padding: '0.45rem 0.65rem', borderRadius: '7px',
                            fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                            background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA',
                            transition: 'all 0.2s'
                          }}
                        >
                          <Trash2 size={13} />
                          <span>Eliminar</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Tarjeta de Crear Curso */}
              <div
                onClick={() => { setNewProgram({...newProgram, program_type: 'curso'}); setShowModal(true); }}
                style={{ textDecoration: 'none', cursor: 'pointer' }}
              >
                <div style={{
                  display: 'flex', flexDirection: 'column', border: '2px dashed #94A3B8',
                  borderRadius: '14px', background: '#F8FAFC', padding: '1.5rem',
                  alignItems: 'center', justifyContent: 'center', color: '#14213D',
                  height: '100%', minHeight: '210px', transition: 'all 0.2s ease',
                  textAlign: 'center'
                }}
                onMouseOver={(e) => { e.currentTarget.style.borderColor = '#14213D'; e.currentTarget.style.background = '#F0F4FA'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseOut={(e) => { e.currentTarget.style.borderColor = '#94A3B8'; e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                  <div style={{ width: '46px', height: '46px', borderRadius: '50%', background: '#14213D', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.75rem', color: '#FFFFFF' }}>
                    <Plus size={22} />
                  </div>
                  <span style={{ fontWeight: 800, fontSize: '0.92rem', color: '#14213D' }}>Crear Nuevo Curso</span>
                  <span style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '4px' }}>Agregar curso corto directo</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SIDEBAR: USUARIOS RECIENTES CON ESTILO EXECUTIVE FEED */}
        <div className="portal-sidebar">
          <div style={{ 
            background: '#FFFFFF', 
            borderRadius: '16px', 
            padding: '1.5rem', 
            border: '1px solid #E2E8F0', 
            boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.04)',
            position: 'sticky',
            top: '1.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', paddingBottom: '0.85rem', borderBottom: '1px solid #F1F5F9' }}>
              <h3 style={{ fontSize: '1.05rem', color: '#14213D', margin: 0, fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Users size={18} color="#14213D" /> Usuarios Recientes
              </h3>
              <Link
                to="/users"
                style={{
                  fontSize: '0.76rem', fontWeight: 700, color: '#14213D',
                  textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4,
                  padding: '0.25rem 0.6rem', borderRadius: '20px',
                  background: 'rgba(20,33,61,0.06)', border: '1px solid #E2E8F0',
                  transition: 'background 0.15s'
                }}
                onMouseOver={e => e.currentTarget.style.background = 'rgba(20,33,61,0.12)'}
                onMouseOut={e  => e.currentTarget.style.background = 'rgba(20,33,61,0.06)'}
              >
                Ver todos <ArrowRight size={12} />
              </Link>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {recentUsers.map(user => {
                const isProf = user.role === 'teacher';
                const isAdminUser = user.role === 'admin';
                const roleBadgeStyle = isAdminUser
                  ? { bg: '#EFF6FF', color: '#1E40AF', label: 'Admin' }
                  : isProf
                  ? { bg: '#FEF3C7', color: '#B45309', label: 'Profesor' }
                  : { bg: '#ECFDF5', color: '#047857', label: 'Estudiante' };

                return (
                  <div key={user.id} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.85rem', 
                    padding: '0.75rem 0.85rem', 
                    borderRadius: '10px', 
                    background: '#F8FAFC', 
                    border: '1px solid #F1F5F9',
                    transition: 'all 0.2s'
                  }}>
                    <div style={{ 
                      width: '36px', 
                      height: '36px', 
                      borderRadius: '50%', 
                      background: isAdminUser ? '#14213D' : (isProf ? '#FCA311' : '#E2E8F0'), 
                      color: isAdminUser ? '#FFFFFF' : (isProf ? '#14213D' : '#334155'), 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      fontWeight: 800, 
                      fontSize: '0.75rem', 
                      flexShrink: 0 
                    }}>
                      {_getInitials(user.full_name || user.email)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#14213D', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {user.full_name || user.email}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {user.email}
                      </div>
                    </div>
                    <span style={{ 
                      fontSize: '0.68rem', 
                      fontWeight: 800, 
                      padding: '2px 8px', 
                      borderRadius: '12px', 
                      background: roleBadgeStyle.bg, 
                      color: roleBadgeStyle.color,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      flexShrink: 0
                    }}>
                      {roleBadgeStyle.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>

      {/* MODAL CREAR PROGRAMA */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '100%', maxWidth: '450px', background: 'white', padding: '2rem', position: 'relative' }}>
            <button onClick={() => setShowModal(false)} style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
              <X size={20} />
            </button>
            <h3 style={{ marginBottom: '1.5rem', fontWeight: 700 }}>Crear Nuevo Programa</h3>
            
            {error && <div style={{ color: 'red', marginBottom: '1rem', fontSize: '0.85rem' }}>{error}</div>}
            
            <form onSubmit={handleCreateProgram} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '0.85rem' }}>Tipo de Programa</label>
                <select 
                  value={newProgram.program_type} 
                  onChange={e => setNewProgram({...newProgram, program_type: e.target.value})}
                  style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '4px' }}
                >
                  <option value="diplomado">Diplomado (Estructura con Módulos)</option>
                  <option value="curso">Curso Corto (Solo Temas y Clases)</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '0.85rem' }}>Título del Programa</label>
                <input 
                  type="text" 
                  value={newProgram.title} 
                  onChange={e => setNewProgram({...newProgram, title: e.target.value})} 
                  placeholder="Ej: Curso de Energía Solar"
                  style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '4px' }} 
                  required 
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '0.85rem' }}>Descripción (Opcional)</label>
                <textarea 
                  value={newProgram.description} 
                  onChange={e => setNewProgram({...newProgram, description: e.target.value})} 
                  rows={3}
                  style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '4px' }} 
                />
              </div>

              {/* CAMPO DE IMAGEN DE PORTADA */}
              <div>
                <label htmlFor="create-program-cover-input" style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '0.85rem' }}>
                  Imagen de Portada (Opcional)
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {coverPreview ? (
                    <div style={{ position: 'relative', width: '100%', height: '120px', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                      <img src={coverPreview} alt="Vista previa de la portada del programa" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button
                        type="button"
                        onClick={() => { setCoverFile(null); setCoverPreview(null); }}
                        style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(220, 38, 38, 0.9)', color: 'white', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                        aria-label="Eliminar imagen seleccionada"
                        title="Eliminar imagen"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ) : (
                    <label 
                      htmlFor="create-program-cover-input" 
                      tabIndex={0}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); document.getElementById('create-program-cover-input')?.click(); } }}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem', border: '1.5px dashed var(--border-color)', borderRadius: '4px', cursor: 'pointer', background: '#f8fafc', color: 'var(--text-muted)', fontSize: '0.84rem' }}
                    >
                      <Upload size={16} />
                      <span>Cargar portada (JPG, PNG, WebP máx 5MB)</span>
                    </label>
                  )}
                  <input
                    id="create-program-cover-input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    style={{ display: 'none' }}
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
                        setError('Formato no válido. Selecciona únicamente imágenes JPG, PNG o WebP.');
                        return;
                      }
                      if (file.size > 5 * 1024 * 1024) {
                        setError('El archivo seleccionado excede el tamaño máximo permitido de 5MB.');
                        return;
                      }
                      setError('');
                      setCoverFile(file);
                      setCoverPreview(URL.createObjectURL(file));
                    }}
                  />
                </div>
              </div>
              
              <button type="submit" disabled={submitting} className="btn btn-primary" style={{ marginTop: '1rem', width: '100%', padding: '0.75rem' }}>
                {submitting ? 'Creando programa e imagen...' : 'Crear Programa'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}


/* Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
   COMPONENTE PRINCIPAL
Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */
export default function Portal() {
  const { currentUser } = useAuth();
  const role = currentUser?.role;

  const getDiplomadoLink = (programId) => {
    if (role === 'admin') return `/dashboard/admin/${programId}`;
    if (role === 'teacher') return `/dashboard/profesor/${programId}`;
    return `/dashboard/${programId}`; // Estudiante
  };

  return (
    <div style={{ padding: '1rem 1rem 2.5rem 1rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* HEADER PRINCIPAL COMPARTIDO (Solo estudiantes; Profesores y Admins tienen su propio banner personalizado) */}
      {role === 'student' && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ color: 'var(--navy)', fontSize: '2.25rem', fontWeight: 800, margin: 0, lineHeight: 1.2 }}>
            Mis Programas
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: '0.35rem 0 0 0', fontWeight: 400 }}>
            Continúa tu formación y revisa tus próximos compromisos.
          </p>
        </div>
      )}

      {/* RENDERIZADO DINÁMICO SEGÚN ROL */}
      {role === 'admin' && <AdminPortal getDiplomadoLink={getDiplomadoLink} />}
      {role === 'teacher' && <TeacherPortal getDiplomadoLink={getDiplomadoLink} />}
      {role === 'student' && <StudentPortal getDiplomadoLink={getDiplomadoLink} />}
      {/* Fallback por seguridad si no hay rol */}
      {!role && <StudentPortal getDiplomadoLink={getDiplomadoLink} />}
    </div>
  );
}







