import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import liaterLogo from '@/assets/liater-logo.png';
import liaterLogoWhite from '@/assets/liater-logo-white.png';
import unalPillLogo from '@/assets/unal-pill-logo.png';
import unalPillNavyLogo from '@/assets/unal-pill-navy-logo.png';

export default function PublicNavbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 100,
      padding: '0.85rem 1.5rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      background: isScrolled || isMobileMenuOpen ? 'rgba(255, 255, 255, 0.98)' : 'rgba(20, 33, 61, 0.35)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      boxShadow: isScrolled || isMobileMenuOpen ? '0 4px 20px rgba(0, 0, 0, 0.08)' : 'none',
      transition: 'all 0.3s ease',
      borderBottom: isScrolled || isMobileMenuOpen ? '1px solid rgba(20, 33, 61, 0.08)' : '1px solid rgba(255, 255, 255, 0.1)',
    }}>
      {/* LADO IZQUIERDO: LOGOS INSTITUCIONALES */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
        <a href="https://unal.edu.co" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center' }}>
          <img 
            src={isScrolled || isMobileMenuOpen ? unalPillNavyLogo : unalPillLogo} 
            alt="Universidad Nacional de Colombia" 
            style={{ 
              height: '52px', 
              objectFit: 'contain',
              transition: 'all 0.3s ease' 
            }} 
          />
        </a>
        
        <div style={{ 
          width: '1px', 
          height: '38px', 
          background: isScrolled || isMobileMenuOpen ? 'rgba(20, 33, 61, 0.15)' : 'rgba(255, 255, 255, 0.3)',
          transition: 'background 0.3s ease'
        }}></div>

        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', textDecoration: 'none' }}>
          <img
            src={isScrolled || isMobileMenuOpen ? liaterLogo : liaterLogoWhite}
            alt="LIATER"
            style={{
              height: '42px',
              objectFit: 'contain',
              transition: 'all 0.3s ease'
            }}
          />
          <span
            className={isScrolled || isMobileMenuOpen ? 'liater-electric-text-scrolled' : 'liater-electric-text'}
            style={{
              fontSize: '0.82rem',
              maxWidth: '380px',
              whiteSpace: 'normal',
              lineHeight: 1.25,
              display: 'inline-block'
            }}
          >
            Laboratorio de Investigación en Alta Tensión<br />y Energías Renovables
          </span>
        </Link>
      </div>

      {/* LADO DERECHO (DESKTOP): ENLACES Y LOGIN */}
      <div className="public-nav-desktop" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        <a 
          href="#programas" 
          style={{ 
            color: isScrolled ? 'var(--text-secondary)' : 'var(--white)', 
            fontWeight: 600, 
            fontSize: '0.88rem',
            transition: 'color 0.3s ease',
            textDecoration: 'none'
          }}
          onMouseOver={(e) => e.currentTarget.style.color = 'var(--gold)'}
          onMouseOut={(e) => e.currentTarget.style.color = isScrolled ? 'var(--text-secondary)' : 'var(--white)'}
        >
          Explorar Programas
        </a>
        <a 
          href="#beneficios" 
          style={{ 
            color: isScrolled ? 'var(--text-secondary)' : 'var(--white)', 
            fontWeight: 600, 
            fontSize: '0.88rem',
            transition: 'color 0.3s ease',
            textDecoration: 'none'
          }}
          onMouseOver={(e) => e.currentTarget.style.color = 'var(--gold)'}
          onMouseOut={(e) => e.currentTarget.style.color = isScrolled ? 'var(--text-secondary)' : 'var(--white)'}
        >
          Beneficios
        </a>
        
        <button
          onClick={() => navigate('/login')}
          className="btn btn-gold"
          style={{
            padding: '0.5rem 1.25rem',
            fontSize: '0.86rem',
            fontWeight: 700,
            boxShadow: isScrolled ? 'var(--shadow-gold)' : '0 4px 15px rgba(0,0,0,0.3)',
          }}
        >
          Iniciar Sesión
        </button>
      </div>

      {/* BOTÓN HAMBURGUESA (MÓVIL) */}
      <button
        type="button"
        className="public-nav-mobile-toggle"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        aria-label="Abrir menú de navegación"
        style={{
          display: 'none',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: isScrolled || isMobileMenuOpen ? 'var(--navy, #14213D)' : '#FFFFFF',
          padding: '0.4rem',
          borderRadius: '8px'
        }}
      >
        {isMobileMenuOpen ? <X size={26} /> : <Menu size={26} />}
      </button>

      {/* MENÚ MÓVIL DESPLEGABLE */}
      {isMobileMenuOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          background: '#FFFFFF',
          borderBottom: '1px solid #E2E8F0',
          padding: '1.25rem 1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          boxShadow: '0 12px 24px rgba(0,0,0,0.12)',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <a 
            href="#programas" 
            onClick={() => setIsMobileMenuOpen(false)}
            style={{ 
              color: 'var(--navy, #14213D)', 
              fontWeight: 700, 
              fontSize: '0.95rem',
              padding: '0.5rem 0',
              textDecoration: 'none',
              borderBottom: '1px solid #F1F5F9'
            }}
          >
            Explorar Programas
          </a>
          <a 
            href="#beneficios" 
            onClick={() => setIsMobileMenuOpen(false)}
            style={{ 
              color: 'var(--navy, #14213D)', 
              fontWeight: 700, 
              fontSize: '0.95rem',
              padding: '0.5rem 0',
              textDecoration: 'none',
              borderBottom: '1px solid #F1F5F9'
            }}
          >
            Beneficios
          </a>
          
          <button
            onClick={() => { setIsMobileMenuOpen(false); navigate('/login'); }}
            className="btn btn-gold"
            style={{
              width: '100%',
              padding: '0.75rem',
              fontSize: '0.9rem',
              fontWeight: 800,
              marginTop: '0.5rem'
            }}
          >
            Iniciar Sesión
          </button>
        </div>
      )}

      <style>{`
        @media (max-width: 900px) {
          .public-nav-desktop {
            display: none !important;
          }
          .public-nav-mobile-toggle {
            display: flex !important;
          }
        }
        @media (max-width: 600px) {
          .liater-electric-text, .liater-electric-text-scrolled {
            display: none !important;
          }
        }
      `}</style>
    </nav>
  );
}
