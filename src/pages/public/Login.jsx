import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import liaterLogo from '@/assets/liater-logo.png';
import unalPillLogo from '@/assets/unal-pill-logo.png';
import coreniusLogoWhite from '@/assets/Corenius_Logo_Blanco.svg';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (result.success) {
      navigate('/portal');
    } else {
      setError(result.message);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
      boxSizing: 'border-box',
      background: 'linear-gradient(135deg, #14213D 0%, #000000 100%)',
    }}>
      {/* Card Blanca Independiente de Login */}
      <div style={{
        width: '100%',
        maxWidth: '400px',
        background: 'rgba(255, 255, 255, 0.98)',
        borderRadius: '1.25rem',
        boxShadow: '0 24px 64px rgba(0, 0, 0, 0.40)',
        padding: '1.35rem 2rem 1.15rem',
        position: 'relative',
        zIndex: 1,
        animation: 'fadeSlideUp 0.45s cubic-bezier(0.4, 0, 0.2, 1) both',
        border: '1px solid rgba(252, 163, 17, 0.15)',
        display: 'flex',
        flexDirection: 'column',
      }}>

        {/* Logo LIATER */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '0.85rem' }}>
          <img
            src={liaterLogo}
            alt="LIATER"
            style={{
              height: '95px',
              objectFit: 'contain',
            }}
          />
          <p style={{ color: '#6b7280', fontSize: '0.78rem', fontWeight: 600, marginTop: '0.2rem' }}>
            Portal Educativo
          </p>
        </div>

        {/* Línea dorada decorativa */}
        <div style={{ height: '2px', background: 'linear-gradient(90deg, transparent, #FCA311, transparent)', marginBottom: '1.15rem', borderRadius: '9999px' }} />

        {error && (
          <div style={{
            backgroundColor: '#fef2f2', color: '#dc2626',
            padding: '0.55rem 0.85rem', borderRadius: '0.5rem',
            marginBottom: '0.85rem', fontSize: '0.82rem',
            textAlign: 'center', border: '1px solid #fca5a5', fontWeight: 500,
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600, fontSize: '0.82rem', color: '#14213D' }}>
              Correo Electrónico
            </label>
            <input
              type="email"
              placeholder="usuario@unal.edu.co"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              style={{
                width: '100%', padding: '0.62rem 0.85rem',
                borderRadius: '0.5rem', border: '1.5px solid #e0e0e0',
                fontSize: '0.88rem', background: '#fafafa', color: '#000',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600, fontSize: '0.82rem', color: '#14213D' }}>
              Contraseña
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              style={{
                width: '100%', padding: '0.62rem 0.85rem',
                borderRadius: '0.5rem', border: '1.5px solid #e0e0e0',
                fontSize: '0.88rem', background: '#fafafa', color: '#000',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: '0.25rem', width: '100%', padding: '0.72rem',
              borderRadius: '0.5rem',
              background: loading ? '#e0e0e0' : '#FCA311',
              color: loading ? '#9ca3af' : '#000',
              fontWeight: 800, fontSize: '0.9rem',
              border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.25s ease',
              boxShadow: loading ? 'none' : '0 4px 18px rgba(252,163,17,0.40)',
              letterSpacing: '0.04em',
            }}
            onMouseOver={(e) => { if (!loading) { e.currentTarget.style.background = '#d98a00'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
            onMouseOut={(e) => { e.currentTarget.style.background = loading ? '#e0e0e0' : '#FCA311'; e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            {loading ? 'Verificando...' : 'Iniciar Sesión →'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '0.9rem' }}>
          <Link to="/"
            style={{ color: '#9ca3af', fontSize: '0.78rem', fontWeight: 500, transition: 'color 0.2s' }}
            onMouseOver={(e) => e.currentTarget.style.color = '#FCA311'}
            onMouseOut={(e) => e.currentTarget.style.color = '#9ca3af'}
          >
            ← Volver al Inicio
          </Link>
        </div>
      </div>

      {/* Institucional UNAL Independiente Fuera de la Tarjeta */}
      <div style={{
        marginTop: '0.85rem',
        zIndex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.25rem',
        animation: 'fadeIn 0.5s ease both',
      }}>
        <img
          src={unalPillLogo}
          alt="UNAL - Universidad Nacional de Colombia"
          style={{
            height: '92px',
            maxWidth: '310px',
            objectFit: 'contain',
            filter: 'drop-shadow(0 4px 18px rgba(0,0,0,0.5))',
          }}
        />
        <span style={{ color: 'rgba(255, 255, 255, 0.70)', fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.05em' }}>
          UNIVERSIDAD NACIONAL DE COLOMBIA
        </span>
        <span style={{ color: 'rgba(255, 255, 255, 0.40)', fontSize: '0.68rem', fontWeight: 400 }}>
          © {new Date().getFullYear()} Laboratorio LIATER
        </span>
      </div>

      {/* Firma de Corenius discreta y elegante en la esquina inferior derecha con enlace */}
      <a 
        href="https://www.corenius.com/"
        target="_blank"
        rel="noopener noreferrer"
        title="Corenius | Transformación Digital"
        style={{
          position: 'absolute',
          bottom: '1.25rem',
          right: '1.75rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.45rem',
          zIndex: 10,
          opacity: 0.75,
          textDecoration: 'none',
          cursor: 'pointer',
          transition: 'all 0.2s ease'
        }}
        onMouseOver={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
        onMouseOut={(e) => { e.currentTarget.style.opacity = '0.75'; e.currentTarget.style.transform = 'translateY(0)'; }}
      >
        <span style={{ color: 'rgba(255, 255, 255, 0.45)', fontSize: '0.68rem', fontWeight: 500 }}>
          Desarrollo por
        </span>
        <img
          src={coreniusLogoWhite}
          alt="Corenius - Transformación Digital"
          style={{ height: '18px', objectFit: 'contain' }}
        />
      </a>
    </div>
  );
}
