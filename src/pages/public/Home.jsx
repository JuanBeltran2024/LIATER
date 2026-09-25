import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import PublicNavbar from '@/components/layout/PublicNavbar';
import PublicFooter from '@/components/layout/PublicFooter';
import LiaterHeroAnimation from '@/components/home/LiaterHeroAnimation';

export default function Home() {
  const navigate = useNavigate();
  const [featuredModules, setFeaturedModules] = useState([]);
  const [loadingModules, setLoadingModules] = useState(true);

  useEffect(() => {
    async function fetchFeatured() {
      try {
        // Obtenemos los programas y la cantidad de inscritos (enrollments)
        const { data, error } = await supabase
          .from('diploma_programs')
          .select('*, enrollments(count)');
        
        if (error) throw error;
        
        // Ordenamos en memoria por cantidad de inscritos (descendente)
        const sortedPrograms = (data || []).sort((a, b) => {
          const countA = a.enrollments?.[0]?.count || 0;
          const countB = b.enrollments?.[0]?.count || 0;
          return countB - countA;
        });

        // Tomamos los 3 más populares
        setFeaturedModules(sortedPrograms.slice(0, 3));
      } catch (err) {
        console.error('Error al cargar programas destacados:', err.message);
        // Fallback en caso de que falle la relación de enrollments
        try {
          const fallback = await supabase.from('diploma_programs').select('*').limit(3);
          if (fallback.data) setFeaturedModules(fallback.data);
        } catch (fallbackErr) {
          console.warn('Fallback de programas destacados también falló:', fallbackErr);
        }
      } finally {
        setLoadingModules(false);
      }
    }
    fetchFeatured();
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', overflowX: 'hidden' }}>
      <PublicNavbar />

      {/* --- HERO SECTION --- */}
      <section style={{
        position: 'relative',
        minHeight: '92vh',
        display: 'flex',
        alignItems: 'center',
        padding: '7.5rem 2rem 4.5rem',
        background: 'linear-gradient(135deg, var(--navy) 0%, #0a1122 100%)',
        color: 'var(--white)',
        overflow: 'hidden'
      }}>
        {/* Decorative ambient gradients */}
        <div style={{
          position: 'absolute', width: '600px', height: '600px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(252,163,17,0.15) 0%, transparent 60%)',
          top: '-150px', right: '-100px', pointerEvents: 'none'
        }} />
        <div style={{
          position: 'absolute', width: '450px', height: '450px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(56,189,248,0.12) 0%, transparent 60%)',
          bottom: '-100px', left: '-100px', pointerEvents: 'none'
        }} />

        <div className="container" style={{
          position: 'relative',
          zIndex: 1,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          alignItems: 'center',
          gap: '3.5rem',
          maxWidth: '1240px',
          width: '100%',
          margin: '0 auto'
        }}>
          {/* Columna Izquierda: Textos y Acciones */}
          <div style={{ animation: 'fadeSlideUp 0.6s cubic-bezier(0.4, 0, 0.2, 1) both' }}>
            <span className="badge badge-gold" style={{ marginBottom: '1.25rem', padding: '0.4rem 1rem', fontSize: '0.85rem' }}>
              Plataforma Educativa Oficial
            </span>
            <h1 style={{ 
              fontSize: 'clamp(2.4rem, 4.5vw, 3.8rem)', 
              fontWeight: 800, 
              lineHeight: 1.12, 
              letterSpacing: '-0.03em',
              marginBottom: '1.35rem'
            }}>
              Transforma tu futuro con el <span style={{ color: 'var(--gold)' }}>Laboratorio LIATER</span>
            </h1>
            <p style={{ 
              fontSize: 'clamp(1rem, 1.8vw, 1.15rem)', 
              color: 'rgba(255, 255, 255, 0.82)', 
              lineHeight: 1.65,
              maxWidth: '560px',
              marginBottom: '2.25rem'
            }}>
              Accede a formación tecnológica de alto nivel, desarrolla habilidades prácticas y avanza en tu carrera con nuestros diplomados y cursos especializados.
            </p>
            
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <button 
                onClick={() => navigate('/login')}
                className="btn btn-gold"
                style={{ padding: '0.85rem 2rem', fontSize: '1.02rem', boxShadow: '0 8px 24px rgba(252, 163, 17, 0.35)' }}
              >
                Iniciar Sesión
              </button>
              <a 
                href="#programas"
                className="btn"
                style={{ 
                  padding: '0.85rem 2rem', 
                  fontSize: '1.02rem',
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: 'var(--white)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  backdropFilter: 'blur(10px)'
                }}
                onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.18)'; }}
                onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'; }}
              >
                Explorar Programas
              </a>
            </div>
          </div>

          {/* Columna Derecha: Animación Tecnológica Interactiva LIATER */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', animation: 'fadeIn 0.9s ease both' }}>
            <LiaterHeroAnimation />
          </div>
        </div>
      </section>

      {/* --- PROGRAMAS DESTACADOS --- */}
      <section id="programas" style={{ padding: '6rem 0', background: 'var(--bg-color)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <h2 style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--navy)', marginBottom: '1rem' }}>Programas Destacados</h2>
            <p style={{ color: 'var(--text-muted)', maxWidth: '600px', margin: '0 auto', fontSize: '1.1rem' }}>
              Descubre nuestros diplomados y cursos más populares, diseñados para brindarte experiencia práctica e inmediata en el sector tecnológico.
            </p>
          </div>

          <div className="grid-3">
            {loadingModules ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="card skeleton" style={{ height: '240px' }}></div>
              ))
            ) : featuredModules.length > 0 ? (
              featuredModules.map((mod, idx) => {
                const tag = mod.program_type === 'diploma' ? 'Diplomado' : (mod.program_type === 'course' ? 'Curso Corto' : 'Programa');
                
                return (
                  <div key={mod.id} className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="badge badge-primary">{tag}</span>
                    </div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--navy)' }}>{mod.title}</h3>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', flexGrow: 1 }}>
                      {mod.description || 'Explora el contenido de este programa.'}
                    </p>
                    <button 
                      onClick={() => navigate('/login')}
                      className="btn btn-outline" 
                      style={{ width: '100%', justifyContent: 'center' }}
                    >
                      Ver Detalles →
                    </button>
                  </div>
                );
              })
            ) : (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--text-muted)' }}>
                No hay programas destacados disponibles en este momento.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* --- BENEFICIOS (POR QUÉ LIATER) --- */}
      <section id="beneficios" style={{ padding: '6rem 0', background: 'var(--white)' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '4rem', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--navy)', marginBottom: '1.5rem', lineHeight: 1.2 }}>
                Impulsa tu carrera con metodología de vanguardia
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginBottom: '2rem', lineHeight: 1.7 }}>
                Nuestro enfoque se basa en el aprendizaje práctico y la resolución de problemas reales. Al ser parte de LIATER, te unes a una comunidad de innovación respaldada por la Universidad Nacional.
              </p>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {[
                  'Instructores expertos y altamente capacitados',
                  'Acceso a herramientas y recursos de última generación',
                  'Certificación avalada por la institución',
                ].map((item, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontWeight: 500, color: 'var(--text-dark)' }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--gold-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gold-dark)', flexShrink: 0 }}>
                      ✓
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            
            <div style={{ position: 'relative' }}>
              <div style={{ 
                background: 'linear-gradient(135deg, var(--gray) 0%, #f0f0f0 100%)', 
                borderRadius: 'var(--radius-2xl)', 
                aspectRatio: '4/3',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: 'var(--shadow-lg)'
              }}>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gray-dark)' }}>
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                    <line x1="8" y1="21" x2="16" y2="21"></line>
                    <line x1="12" y1="17" x2="12" y2="21"></line>
                  </svg>
                </div>
              </div>
              <div style={{
                position: 'absolute', bottom: '-20px', left: '-20px', 
                background: 'var(--white)', padding: '1.5rem', 
                borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-md)',
                display: 'flex', alignItems: 'center', gap: '1rem'
              }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--green-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--green-700)', fontSize: '1.5rem', fontWeight: 800 }}>
                  +
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--navy)' }}>Metodología</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>100% Práctica</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- ESTADÍSTICAS --- */}
      <section style={{ padding: '5rem 0', background: 'var(--navy)', color: 'var(--white)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.05, backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }}></div>
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '3rem', textAlign: 'center' }}>
            {[
              { num: '+500', label: 'Estudiantes Activos' },
              { num: '20+', label: 'Módulos Especializados' },
              { num: '15', label: 'Proyectos de Laboratorio' },
              { num: '100%', label: 'Compromiso de Calidad' }
            ].map((stat, idx) => (
              <div key={idx}>
                <div style={{ fontSize: '3rem', fontWeight: 800, color: 'var(--gold)', marginBottom: '0.5rem', lineHeight: 1 }}>
                  {stat.num}
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 500, color: 'rgba(255,255,255,0.8)' }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
