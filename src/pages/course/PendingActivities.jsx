import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { fetchStudentPendingActivities } from '@/services/activityService';
import { formatShortDate } from '@/utils/dateUtils';
import { Clock, AlertCircle, FileText, CheckCircle2, Video, Bell, ChevronRight, RefreshCw, Calendar, User, BookOpen, Award } from 'lucide-react';

/**
 * Página: PendingActivities
 * Muestra el listado completo de actividades pendientes del estudiante autenticado y anuncios publicados.
 * Ruta: /pendientes
 */
export default function PendingActivities() {
  const { currentUser } = useAuth();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterType, setFilterType] = useState('Todos');

  const loadActivities = useCallback(async () => {
    if (!currentUser?.id) return;
    setLoading(true);
    setError(null);

    const { activities: data, announcements: annData, error: err } = await fetchStudentPendingActivities(currentUser.id, null);

    if (err) {
      setError(err);
    } else {
      setActivities([...(data || [])]);
    }
    setLoading(false);
  }, [currentUser?.id]);

  useEffect(() => {
    loadActivities();

    const handleSync = () => {
      loadActivities();
    };

    window.addEventListener('activityCompleted', handleSync);
    window.addEventListener('storage', handleSync);

    return () => {
      window.removeEventListener('activityCompleted', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [loadActivities]);

  const filteredActivities = activities.filter(act => {
    if (filterType === 'Todos') return true;
    if (filterType === 'Entregas') return act.type === 'Entrega';
    if (filterType === 'Cuestionarios') return act.type === 'Cuestionario' || act.type === 'Actividad de Reforzamiento' || act.type === 'Reforzamiento';
    if (filterType === 'Clases') return act.type === 'Sesión en vivo' || act.type === 'Clase hoy';
    return true;
  });

  const getUrgencyStyles = (urgency) => {
    switch (urgency) {
      case 'overdue':
        return { badgeBg: '#fef2f2', badgeColor: '#dc2626', borderColor: '#ef4444', label: 'Vencida' };
      case 'today':
      case 'tomorrow':
        return { badgeBg: '#fffbe6', badgeColor: '#d97706', borderColor: '#fca311', label: urgency === 'today' ? 'Hoy' : 'Mañana' };
      case 'upcoming':
      default:
        return { badgeBg: '#eff6ff', badgeColor: 'var(--navy)', borderColor: 'var(--navy)', label: 'Próxima' };
    }
  };



  const renderIcon = (type) => {
    switch (type) {
      case 'Sesión en vivo': return <Video size={18} color="var(--navy)" />;
      case 'Entrega': return <FileText size={18} color="var(--navy)" />;
      case 'Cuestionario':
      case 'Actividad de Reforzamiento':
      case 'Reforzamiento':
        return <Award size={18} color="#d97706" />;
      default: return <Bell size={18} color="var(--navy)" />;
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '1rem 1rem 3rem 1rem' }}>
      {/* HEADER PRINCIPAL */}
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--navy)', margin: 0 }}>
          Todas las actividades y avisos
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.94rem', margin: '0.35rem 0 0 0' }}>
          Revisa tus actividades de reforzamiento, clases en vivo y comunicados de tus profesores.
        </p>
      </div>

      {/* FILTROS TIPO PASTILLA */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.75rem', overflowX: 'auto' }} className="hide-scrollbar">
        {['Todos', 'Cuestionarios', 'Clases'].map(type => (
          <button
            key={type}
            onClick={() => setFilterType(type)}
            style={{
              background: filterType === type ? 'var(--navy)' : '#f1f5f9',
              color: filterType === type ? '#ffffff' : 'var(--text-muted)',
              padding: '0.5rem 1.25rem',
              borderRadius: '999px',
              fontSize: '0.86rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s'
            }}
          >
            {type}
          </button>
        ))}
      </div>

      {/* ESTADO DE CARGA */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card" style={{ padding: '1.25rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#e2e8f0' }} />
              <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ width: '60%', height: '16px', background: '#cbd5e1', borderRadius: '4px' }} />
                <div style={{ width: '40%', height: '14px', background: '#e2e8f0', borderRadius: '4px' }} />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div style={{ padding: '1.25rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
          <button
            onClick={loadActivities}
            style={{ background: '#dc2626', color: '#ffffff', border: 'none', padding: '0.4rem 0.85rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
          >
            <RefreshCw size={14} /> Reintentar
          </button>
        </div>
      ) : filteredActivities.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '4rem 1.5rem', background: '#ffffff', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-lg)' }}>
          <CheckCircle2 size={54} color="var(--green-600)" style={{ marginBottom: '1rem', opacity: 0.85 }} />
          <h3 style={{ fontSize: '1.2rem', color: 'var(--navy)', fontWeight: 700, marginBottom: '0.5rem' }}>
            No hay elementos en esta sección
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '420px', margin: '0 auto' }}>
            Estás al día con tus actividades y no tienes avisos pendientes.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredActivities.map((item) => {
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
                className="card"
                style={{
                  display: 'flex',
                  gap: '1rem',
                  alignItems: 'flex-start',
                  padding: '1.25rem',
                  background: '#ffffff',
                  borderLeft: `5px solid ${urgencyStyle.borderColor}`,
                  borderTop: '1px solid var(--border-color)',
                  borderRight: '1px solid var(--border-color)',
                  borderBottom: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-lg)',
                  textDecoration: 'none',
                  boxShadow: 'var(--shadow-sm)',
                  transition: 'all 0.25s ease'
                }}
                onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
                onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
              >
                <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid var(--border-color)', marginTop: '0.2rem' }}>
                  {renderIcon(item.type)}
                </div>

                <div style={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                      <>
                        <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                          {item.type}
                        </span>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '999px', background: urgencyStyle.badgeBg, color: urgencyStyle.badgeColor }}>
                          {item.statusLabel || urgencyStyle.label}
                        </span>
                      </>

                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--navy)', background: 'rgba(20,33,61,0.06)', padding: '0.15rem 0.5rem', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <BookOpen size={12} /> {item.programTitle}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--navy)', margin: 0 }}>
                      {item.title}
                    </h3>
                    {item.classCount > 1 && (
                      <span style={{
                        padding: '0.08rem 0.5rem',
                        borderRadius: '4px',
                        background: '#e2e8f0',
                        color: '#1e293b',
                        fontSize: '0.72rem',
                        fontWeight: 700
                      }}>
                        {item.classCount} clases
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', fontSize: '0.78rem', color: 'var(--text-secondary)', flexWrap: 'wrap', marginTop: '0.2rem' }}>
                    {item.teacherName && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, color: 'var(--navy)' }}>
                        <User size={13} color="var(--gold-dark)" /> Prof. {item.teacherName}
                      </span>
                    )}
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={13} /> {item.type === 'Sesión en vivo' || item.type === 'Clase hoy'
                        ? (item.timeRange
                            ? `Programada para: ${formatShortDate(item.date).split(',')[0]}, ${item.timeRange}`
                            : `Programada para: ${formatShortDate(item.date)}`)
                        : `Publicado el ${formatShortDate(item.date)}`}
                    </span>
                  </div>
                </div>

                <ChevronRight size={20} color="var(--text-muted)" style={{ flexShrink: 0, alignSelf: 'center' }} />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
