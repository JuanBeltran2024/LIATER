import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Calendar, BookOpen, ArrowLeft, CheckCircle, Clock } from 'lucide-react';
import { formatShortDate } from '@/utils/dateUtils';
import { fetchUpcomingPrograms } from '@/services/programService';

export default function UpcomingPrograms() {
  const { currentUser } = useAuth();
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadUpcoming = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Consultar hasta 12 programas próximos para la página de catálogo
      const { programs: data, error: err } = await fetchUpcomingPrograms(currentUser?.id, 12);
      if (err) throw err;
      setPrograms(data || []);
    } catch (e) {
      console.error('Error al cargar catálogo de próximos programas:', e);
      setError('No se pudo cargar la lista de próximos programas.');
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    loadUpcoming();
  }, [loadUpcoming]);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1rem' }}>
      {/* HEADER DE LA PÁGINA DE PRÓXIMOS PROGRAMAS */}
      <div style={{ marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <Link to="/portal" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--navy)', textDecoration: 'none', fontWeight: 600, fontSize: '0.88rem' }}>
          <ArrowLeft size={16} /> Volver a Mis Programas
        </Link>
        <h1 style={{ color: 'var(--navy)', fontSize: '2rem', fontWeight: 700, margin: 0 }}>
          Próxima Oferta Académica
        </h1>
        <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.95rem' }}>
          Explora la oferta académica de diplomados, cursos y talleres con inscripciones abiertas o fechas de inicio cercanas.
        </p>
      </div>

      {/* ERRORES CON REINTENTO */}
      {error && (
        <div className="card" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '1.25rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{error}</span>
          <button onClick={loadUpcoming} className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.82rem' }}>Reintentar</button>
        </div>
      )}

      {/* SKELETON LOADER */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card" style={{ height: '320px', padding: 0, overflow: 'hidden' }}>
              <div style={{ width: '100%', height: '140px', background: '#e2e8f0' }} />
              <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <div style={{ width: '70px', height: '16px', background: '#cbd5e1', borderRadius: '999px' }} />
                <div style={{ width: '90%', height: '20px', background: '#cbd5e1', borderRadius: '4px' }} />
                <div style={{ width: '100%', height: '14px', background: '#e2e8f0', borderRadius: '4px' }} />
              </div>
            </div>
          ))}
        </div>
      ) : programs.length === 0 ? (
        /* ESTADO VACÍO */
        <div className="card" style={{ textAlign: 'center', padding: '4rem 1.5rem', background: '#ffffff', border: '1px dashed var(--border-color)' }}>
          <Calendar size={48} color="var(--navy)" style={{ opacity: 0.4, marginBottom: '1rem' }} />
          <h3 style={{ fontSize: '1.15rem', color: 'var(--navy)', fontWeight: 700, marginBottom: '0.5rem' }}>No hay próxima oferta académica</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', maxWidth: '450px', margin: '0 auto 1.5rem auto' }}>
            En este momento no hay nuevos diplomados ni cursos pendientes de apertura. Por favor regresa más adelante.
          </p>
          <Link to="/portal" className="btn btn-primary">Regresar al Portal</Link>
        </div>
      ) : (
        /* LISTADO DE PROGRAMAS PRÓXIMOS */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {programs.map((dip) => {
            const isOpen = dip.enrollment_start_date || dip.status === 'published';
            const isCourse = dip.program_type === 'curso';

            return (
              <div key={dip.id} className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#ffffff', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)' }}>
                {/* PORTADA */}
                <div style={{ width: '100%', aspectRatio: '16 / 9', background: 'var(--navy)', position: 'relative' }}>
                  {dip.image_url ? (
                    <img src={dip.image_url} alt={`Portada de ${dip.title}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', background: isCourse ? 'linear-gradient(135deg, #14213D 0%, #FCA311 100%)' : 'linear-gradient(135deg, #14213D 0%, #007a2e 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <BookOpen size={36} color="#ffffff" />
                    </div>
                  )}
                </div>

                {/* CONTENIDO */}
                <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <span className={isCourse ? 'badge badge-green' : 'badge badge-navy'} style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase' }}>
                      {isCourse ? 'Curso Corto' : 'Diplomado'}
                    </span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: isOpen ? 'var(--green-700)' : 'var(--gold-dark)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      {isOpen ? <CheckCircle size={12} /> : <Clock size={12} />}
                      {isOpen ? 'Inscripciones abiertas' : 'Próximamente'}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '1.05rem', color: 'var(--navy)', fontWeight: 700, marginBottom: '0.5rem' }}>{dip.title}</h3>
                  <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', flexGrow: 1, marginBottom: '1rem', lineHeight: '1.45' }}>
                    {dip.description || 'Sin descripción disponible.'}
                  </p>

                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={14} color="var(--navy)" />
                    <span>Inicio: <strong>{dip.start_date ? formatShortDate(dip.start_date) : 'Próximamente'}</strong></span>
                  </div>

                  <div style={{ marginTop: 'auto' }}>
                    <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center', padding: '0.6rem', fontSize: '0.85rem', fontWeight: 600 }}>
                      Ver detalles
                    </button>
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
