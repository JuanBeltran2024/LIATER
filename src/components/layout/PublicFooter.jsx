import { Link } from 'react-router-dom';
import unalPillLogo from '@/assets/unal-pill-logo.png';
import liaterLogoWhite from '@/assets/liater-logo-white.png';
import coreniusLogoWhite from '@/assets/Corenius_Logo_Blanco.svg';

export default function PublicFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer style={{
      background: 'var(--navy)',
      color: 'rgba(255, 255, 255, 0.7)',
      padding: '4rem 2rem 2rem',
      borderTop: '1px solid rgba(255, 255, 255, 0.1)'
    }}>
      <div className="container" style={{ maxWidth: '1200px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '3rem',
          marginBottom: '3rem'
        }}>
          {/* Columna 1: Logos e info principal */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <img 
              src={liaterLogoWhite} 
              alt="LIATER" 
              style={{ height: '60px', width: 'fit-content', objectFit: 'contain' }} 
            />
            <p style={{ fontSize: '0.9rem', lineHeight: 1.6, maxWidth: '300px' }}>
              Portal Académico oficial para la gestión de cursos y diplomados. Transformando la educación tecnológica a través del aprendizaje práctico.
            </p>
          </div>

          {/* Columna 2: Enlaces Rápidos */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h4 style={{ color: 'var(--white)', fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Enlaces Rápidos</h4>
            <a href="#inicio" style={{ color: 'inherit', textDecoration: 'none', transition: 'color 0.2s' }} onMouseOver={(e) => e.target.style.color = 'var(--gold)'} onMouseOut={(e) => e.target.style.color = 'inherit'}>Inicio</a>
            <a href="#modulos" style={{ color: 'inherit', textDecoration: 'none', transition: 'color 0.2s' }} onMouseOver={(e) => e.target.style.color = 'var(--gold)'} onMouseOut={(e) => e.target.style.color = 'inherit'}>Explorar Módulos</a>
            <a href="#beneficios" style={{ color: 'inherit', textDecoration: 'none', transition: 'color 0.2s' }} onMouseOver={(e) => e.target.style.color = 'var(--gold)'} onMouseOut={(e) => e.target.style.color = 'inherit'}>Beneficios</a>
            <Link to="/login" style={{ color: 'inherit', textDecoration: 'none', transition: 'color 0.2s' }} onMouseOver={(e) => e.target.style.color = 'var(--gold)'} onMouseOut={(e) => e.target.style.color = 'inherit'}>Iniciar Sesión</Link>
          </div>

          {/* Columna 3: Contacto institucional */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h4 style={{ color: 'var(--white)', fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Contacto Institucional</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'flex-start' }}>
               <img
                  src={unalPillLogo}
                  alt="UNAL - Universidad Nacional de Colombia"
                  style={{
                    height: '60px',
                    objectFit: 'contain',
                    filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))',
                  }}
                />
                <span style={{ fontSize: '0.85rem', fontWeight: 500, letterSpacing: '0.02em', color: 'var(--white)' }}>
                  UNIVERSIDAD NACIONAL DE COLOMBIA
                </span>
            </div>
          </div>
        </div>

        {/* Bottom Line con Crédito Corenius */}
        <div style={{
          paddingTop: '2rem',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1.25rem',
          fontSize: '0.85rem'
        }}>
          <div>
            <p style={{ margin: 0 }}>© {currentYear} Laboratorio LIATER — Universidad Nacional de Colombia.</p>
            <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.35rem' }}>
              <span style={{ cursor: 'pointer', transition: 'color 0.2s', fontSize: '0.78rem' }} onMouseOver={(e) => e.target.style.color = 'var(--gold)'} onMouseOut={(e) => e.target.style.color = 'inherit'}>Términos de Servicio</span>
              <span style={{ cursor: 'pointer', transition: 'color 0.2s', fontSize: '0.78rem' }} onMouseOver={(e) => e.target.style.color = 'var(--gold)'} onMouseOut={(e) => e.target.style.color = 'inherit'}>Política de Privacidad</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span style={{ fontSize: '0.78rem', color: 'rgba(255, 255, 255, 0.55)', fontWeight: 500 }}>
              Diseño y Desarrollo por
            </span>
            <a 
              href="https://www.corenius.com/" 
              target="_blank" 
              rel="noopener noreferrer"
              title="Corenius | Transformación Digital"
              style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none', transition: 'transform 0.2s ease' }}
              onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <img 
                src={coreniusLogoWhite} 
                alt="Corenius - Transformación Digital" 
                style={{ height: '24px', objectFit: 'contain', opacity: 0.95, transition: 'opacity 0.2s' }} 
                onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
                onMouseOut={(e) => e.currentTarget.style.opacity = '0.95'}
              />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
