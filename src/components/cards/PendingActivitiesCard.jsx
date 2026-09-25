import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Clock, AlertCircle, FileText, CheckCircle2, Video, Bell, ChevronRight, RefreshCw, Award, User, BookOpen, Megaphone } from 'lucide-react';
import { formatShortDate } from '@/utils/dateUtils';
import { fetchStudentPendingActivities } from '@/services/activityService';

/**
 * Componente: PendingActivitiesCard
 * Muestra las actividades pendientes reales del estudiante y los últimos 3-5 anuncios publicados
 * con etiquetas (emojis), curso al que pertenecen, profesor y fecha de publicación.
 */
export default function PendingActivitiesCard({ studentId }) {
  const [activities, setActivities] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('pendings'); // 'pendings' | 'announcements'
  const [hasReadAnnouncements, setHasReadAnnouncements] = useState(false);

  const loadPending = useCallback(async () => {
    if (!studentId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    const { activities: actData, announcements: annData, error: err } = await fetchStudentPendingActivities(studentId, 4);

    if (err) {
      setError(err);
    } else {
      setActivities(actData || []);
      setAnnouncements(annData || []);
    }
    setLoading(false);
  }, [studentId]);

  useEffect(() => {
    loadPending();

    const handleSync = () => {
      loadPending();
    };

    window.addEventListener('activityCompleted', handleSync);
    window.addEventListener('storage', handleSync);

    return () => {
      window.removeEventListener('activityCompleted', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [loadPending]);

  const getUrgencyStyles = (urgency) => {
    switch (urgency) {
      case 'overdue':
        return {
          badgeBg: '#fef2f2',
          badgeColor: '#dc2626',
          borderColor: '#ef4444',
          label: 'Vencida'
        };
      case 'today':
        return {
          badgeBg: '#fffbe6',
          badgeColor: '#d97706',
          borderColor: '#fca311',
          label: 'Hoy'
        };
      case 'upcoming':
      default:
        return {
          badgeBg: '#eff6ff',
          badgeColor: 'var(--navy)',
          borderColor: 'var(--navy)',
          label: 'Próxima'
        };
    }
  };

  const getAnnouncementTagConfig = (tag) => {
    switch (tag) {
      case 'urgent':
        return {
          emoji: '🔴',
          label: 'Urgente',
          color: '#991b1b',
          bg: '#fee2e2',
          borderColor: '#ef4444',
          cardBg: 'linear-gradient(135deg, #fff5f5 0%, #ffffff 100%)'
        };
      case 'info':
        return {
          emoji: '📌',
          label: 'Informativo',
          color: '#1d4ed8',
          bg: '#dbeafe',
          borderColor: '#3b82f6',
          cardBg: 'linear-gradient(135deg, #f0f7ff 0%, #ffffff 100%)'
        };
      case 'general':
      default:
        return {
          emoji: '📢',
          label: 'General',
          color: 'var(--navy)',
          bg: '#EEF2F8',
          borderColor: 'var(--navy)',
          cardBg: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)'
        };
    }
  };

  const renderIcon = (type) => {
    switch (type) {
      case 'Sesión en vivo':
        return <Video size={16} color="var(--navy)" />;
      case 'Entrega':
        return <FileText size={16} color="var(--navy)" />;
      case 'Cuestionario':
      case 'Actividad de Reforzamiento':
      case 'Reforzamiento':
        return <Award size={16} color="#d97706" />;
      default:
        return <Bell size={16} color="var(--navy)" />;
    }
  };

  const pendingsList = activities.filter(a => a.type !== 'Anuncio importante');
  const reinforcementCount = pendingsList.filter(a => a.type.includes('Reforzamiento') || a.type === 'Cuestionario').length;
  const displayAnnouncements = announcements.slice(0, 5);

  return (
    <div className="card static-card" style={{ padding: '1.5rem' }}>
      {/* ENCABEZADO DE LA TARJETA */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h3 style={{ fontSize: '1.05rem', color: 'var(--navy)', fontWeight: 700, margin: 0 }}>
          Pendientes y Avisos
        </h3>
        <Link to="/pendientes" style={{ fontSize: '0.82rem', color: 'var(--gold-dark)', fontWeight: 700, textDecoration: 'none' }}>
          Ver todos
        </Link>
      </div>

      {/* PESTAÑAS (TABS) CON ANIMACIÓN */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', background: 'rgba(0,0,0,0.04)', padding: '0.3rem', borderRadius: '10px' }}>
        <button
          onClick={() => setActiveTab('pendings')}
          style={{
            flex: 1,
            padding: '0.45rem 0.5rem',
            border: 'none',
            borderRadius: '8px',
            background: activeTab === 'pendings' ? '#ffffff' : 'transparent',
            color: activeTab === 'pendings' ? 'var(--navy)' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: '0.82rem',
            cursor: 'pointer',
            boxShadow: activeTab === 'pendings' ? '0 3px 10px rgba(0,0,0,0.08)' : 'none',
            transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
            transform: activeTab === 'pendings' ? 'scale(1.02)' : 'scale(1)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.35rem'
          }}
          onMouseOver={e => {
            if (activeTab !== 'pendings') {
              e.currentTarget.style.background = 'rgba(255,255,255,0.5)';
              e.currentTarget.style.transform = 'scale(1.02)';
            }
          }}
          onMouseOut={e => {
            if (activeTab !== 'pendings') {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.transform = 'scale(1)';
            }
          }}
          onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.96)'; }}
        >
          <span>Pendientes</span>
          {reinforcementCount > 0 && (
            <span 
              title="Tienes actividades de reforzamiento sin realizar"
              style={{
                background: '#fffbe6',
                color: '#b45309',
                border: '1px solid #fca311',
                padding: '0.1rem 0.45rem',
                borderRadius: '999px',
                fontSize: '0.68rem',
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.2rem'
              }}
            >
              <Award size={11} color="#b45309" />
              {reinforcementCount}
            </span>
          )}
        </button>
        <button
          onClick={() => {
            setActiveTab('announcements');
            setHasReadAnnouncements(true);
          }}
          style={{
            flex: 1,
            padding: '0.45rem 0.5rem',
            border: 'none',
            borderRadius: '8px',
            background: activeTab === 'announcements' ? '#ffffff' : 'transparent',
            color: activeTab === 'announcements' ? 'var(--navy)' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: '0.82rem',
            cursor: 'pointer',
            boxShadow: activeTab === 'announcements' ? '0 3px 10px rgba(0,0,0,0.08)' : 'none',
            transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
            transform: activeTab === 'announcements' ? 'scale(1.02)' : 'scale(1)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.35rem'
          }}
          onMouseOver={e => {
            if (activeTab !== 'announcements') {
              e.currentTarget.style.background = 'rgba(255,255,255,0.5)';
              e.currentTarget.style.transform = 'scale(1.02)';
            }
          }}
          onMouseOut={e => {
            if (activeTab !== 'announcements') {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.transform = 'scale(1)';
            }
          }}
          onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.96)'; }}
        >
          <span>Anuncios</span>
          {displayAnnouncements.length > 0 && (
            <span 
              style={{ 
                background: !hasReadAnnouncements ? 'var(--navy)' : 'rgba(20,33,61,0.1)', 
                color: !hasReadAnnouncements ? '#ffffff' : 'var(--navy)', 
                borderRadius: '999px', 
                padding: '0.1rem 0.45rem', 
                fontSize: '0.68rem', 
                fontWeight: 800 
              }}
            >
              {displayAnnouncements.length}
            </span>
          )}
        </button>
      </div>

      {/* ESTADO DE CARGA SKELETON */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', padding: '0.6rem 0' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#e2e8f0', flexShrink: 0 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flexGrow: 1 }}>
                <div style={{ width: '80%', height: '14px', background: '#cbd5e1', borderRadius: '4px' }} />
                <div style={{ width: '50%', height: '12px', background: '#e2e8f0', borderRadius: '4px' }} />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        /* ESTADO DE ERROR CON BOTÓN REINTENTAR */
        <div style={{ padding: '0.85rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#dc2626', fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button
            onClick={loadPending}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#dc2626', color: '#ffffff', border: 'none', padding: '0.35rem 0.75rem', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', width: 'fit-content' }}
          >
            <RefreshCw size={12} /> Reintentar
          </button>
        </div>
      ) : activeTab === 'announcements' ? (
        /* =============================================================
           VISTA DE ANUNCIOS: ÚLTIMOS 3 A 5 PUBLICADOS CON DETALLES COMPLETOS
           ============================================================= */
        displayAnnouncements.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '1.5rem 0.5rem' }}>
            <Megaphone size={36} color="var(--text-muted)" style={{ marginBottom: '0.6rem', opacity: 0.6 }} />
            <h4 style={{ fontSize: '0.95rem', color: 'var(--navy)', fontWeight: 700, margin: '0 0 0.25rem 0' }}>
              No hay anuncios recientes
            </h4>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
              Los comunicados y avisos de tus profesores aparecerán aquí.
            </p>
          </div>
        ) : (
          <div key="announcements-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', animation: 'fadeSlideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1) both' }}>
            {displayAnnouncements.map((ann) => {
              const tagConfig = getAnnouncementTagConfig(ann.tag);

              return (
                <div
                  key={ann.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.45rem',
                    padding: '0.9rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    background: tagConfig.cardBg,
                    border: '1px solid rgba(20, 33, 61, 0.1)',
                    borderLeft: `4px solid ${tagConfig.borderColor}`,
                    boxShadow: '0 2px 8px rgba(20, 33, 61, 0.04)',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                  }}
                  onMouseOver={e => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(20, 33, 61, 0.08)';
                  }}
                  onMouseOut={e => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(20, 33, 61, 0.04)';
                  }}
                >
                  {/* CABECERA DEL ANUNCIO: ETIQUETA / EMOJI + CURSO PERTENECIENTE */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {/* ETIQUETA / EMOJI DEL TIPO DE ANUNCIO */}
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        padding: '0.18rem 0.55rem',
                        borderRadius: '999px',
                        background: tagConfig.bg,
                        color: tagConfig.color,
                        border: `1px solid ${tagConfig.borderColor}30`
                      }}
                    >
                      <span>{tagConfig.emoji}</span>
                      <span>{tagConfig.label}</span>
                    </span>

                    {/* CURSO O PROGRAMA DE ORIGEN */}
                    <span
                      title={ann.programTitle}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        color: 'var(--navy)',
                        background: 'rgba(20, 33, 61, 0.06)',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '6px',
                        maxWidth: '180px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      <BookOpen size={11} color="var(--navy)" style={{ flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{ann.programTitle}</span>
                    </span>
                  </div>

                  {/* TÍTULO DEL ANUNCIO */}
                  <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--navy)', margin: 0, lineHeight: 1.35 }}>
                    {ann.title}
                  </h4>

                  {/* CUERPO DEL MENSAJE (SI EXISTE) */}
                  {ann.body && (
                    <p style={{ fontSize: '0.81rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>
                      {ann.body}
                    </p>
                  )}

                  {/* PIE DE TARJETA: PROFESOR EMISOR Y FECHA DE PUBLICACIÓN */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginTop: '0.2rem', paddingTop: '0.4rem', borderTop: '1px dashed rgba(20, 33, 61, 0.08)', fontSize: '0.72rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                    {/* PROFESOR QUE LO SUBIÓ */}
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600, color: 'var(--navy)' }}>
                      <User size={12} color="var(--gold-dark)" />
                      <span>{ann.isAdmin ? ann.teacherName : `Prof. ${ann.teacherName}`}</span>
                    </span>

                    {/* FECHA DE PUBLICACIÓN */}
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Clock size={11} />
                      <span>{formatShortDate(ann.date)}</span>
                    </span>
                  </div>

                  {/* ENLACE OPCIONAL AL CURSO ACTIVO */}
                  {ann.programId && (
                    <Link
                      to={`/dashboard/${ann.programId}`}
                      onClick={() => {
                        localStorage.setItem('activeProgramId', ann.programId);
                        window.dispatchEvent(new Event('programContextChanged'));
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        color: 'var(--gold-dark)',
                        textDecoration: 'none',
                        marginTop: '0.15rem',
                        alignSelf: 'flex-start'
                      }}
                    >
                      <span>Ir al programa</span>
                      <ChevronRight size={13} />
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* =============================================================
           VISTA DE ACTIVIDADES PENDIENTES (REFORZAMIENTO, CLASES, ENTREGAS)
           ============================================================= */
        pendingsList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '1.5rem 0.5rem' }}>
            <CheckCircle2 size={38} color="var(--green-600)" style={{ marginBottom: '0.6rem', opacity: 0.85 }} />
            <h4 style={{ fontSize: '0.95rem', color: 'var(--navy)', fontWeight: 700, margin: '0 0 0.25rem 0' }}>
              No tienes actividades próximas.
            </h4>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
              Estás al día con tus reforzamientos y clases.
            </p>
          </div>
        ) : (
          <div key="pendings-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', animation: 'fadeSlideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1) both' }}>
            {pendingsList.slice(0, 4).map((item) => {
              const urgencyStyle = getUrgencyStyles(item.urgency);

              return (
                <Link
                  key={item.id}
                  to={item.link}
                  onClick={() => {
                    if (item.programId) {
                      localStorage.setItem('activeProgramId', item.programId);
                      window.dispatchEvent(new Event('programContextChanged'));
                    }
                  }}
                  style={{
                    display: 'flex',
                    gap: '0.85rem',
                    alignItems: 'center',
                    padding: '0.85rem 0.95rem',
                    borderRadius: 'var(--radius-md)',
                    background: '#ffffff',
                    border: '1px solid rgba(20, 33, 61, 0.08)',
                    borderLeft: `4px solid ${urgencyStyle.borderColor}`,
                    boxShadow: '0 4px 12px rgba(20, 33, 61, 0.04)',
                    textDecoration: 'none',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                  }}
                  onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(20, 33, 61, 0.08)'; }}
                  onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(20, 33, 61, 0.04)'; }}
                >
                  {/* ICONO COMPACTO CON COLOR DE URGENCIA */}
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: urgencyStyle.badgeBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                    {renderIcon(item.type)}
                  </div>

                  {/* DETALLES DE LA ACTIVIDAD */}
                  <div style={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        {item.type}
                      </span>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '0.15rem 0.45rem', borderRadius: '999px', background: urgencyStyle.badgeBg, color: urgencyStyle.badgeColor }}>
                        {item.statusLabel || urgencyStyle.label}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                      <h4 style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--navy)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.title}
                      </h4>
                      {item.classCount > 1 && (
                        <span style={{
                          padding: '0.06rem 0.42rem',
                          borderRadius: '4px',
                          background: '#e2e8f0',
                          color: '#1e293b',
                          fontSize: '0.66rem',
                          fontWeight: 700,
                          flexShrink: 0
                        }}>
                          {item.classCount} clases
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.programTitle}
                      </span>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.3rem',
                        fontSize: '0.72rem', 
                        color: (item.urgency === 'today' || item.urgency === 'overdue') ? urgencyStyle.borderColor : 'var(--text-muted)',
                        fontWeight: (item.urgency === 'today' || item.urgency === 'overdue') ? 700 : 500
                      }}>
                        <span>
                          {item.type === 'Sesión en vivo' || item.type === 'Clase hoy'
                            ? (item.timeRange
                                ? `Próxima sesión: ${formatShortDate(item.date).split(',')[0]}, ${item.timeRange}`
                                : `Próxima sesión: ${formatShortDate(item.date)}`)
                            : `Cierra: ${formatShortDate(item.date)}`}
                        </span>
                        {(item.urgency === 'today' || item.urgency === 'overdue') && (
                          <span style={{ 
                            display: 'inline-flex',
                            alignItems: 'center',
                            background: urgencyStyle.badgeBg,
                            color: urgencyStyle.badgeColor,
                            padding: '0.1rem 0.4rem',
                            borderRadius: '4px',
                            fontSize: '0.65rem',
                            fontWeight: 800,
                            border: `1px solid ${urgencyStyle.borderColor}`,
                            textTransform: 'uppercase'
                          }}>
                            {item.urgency === 'today' ? '🔥 ¡Hoy!' : '⚠️ Vencida'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <ChevronRight size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                </Link>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

