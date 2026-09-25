import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { LogOut, User, Shield, Menu, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchStudentStreak } from '@/services/activityService';

import liaterLogoDark from '@/assets/liater-logo-dark.png';

export default function Header({ onToggleSidebar, isSidebarOpen }) {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [streak, setStreak] = useState(0);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getRoleLabel = (role) => {
    if (role === 'admin') return 'Administrador';
    if (role === 'teacher') return 'Docente UNAL';
    return 'Estudiante';
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name
      .trim()
      .split(/\s+/)
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  useEffect(() => {
    const loadStreak = async () => {
      if (currentUser && currentUser.role === 'student') {
        const result = await fetchStudentStreak(currentUser.id);
        if (!result.error) {
          setStreak(result.streak);
        }
      }
    };
    
    loadStreak();

    // Actualizar racha si el estudiante completa una actividad en esta sesión
    const handleActivityCompleted = () => {
      loadStreak();
    };
    window.addEventListener('activityCompleted', handleActivityCompleted);
    return () => window.removeEventListener('activityCompleted', handleActivityCompleted);
  }, [currentUser]);

  return (
    <header className="app-header" style={{
      background: '#FFFFFF',
      borderBottom: '1px solid #E2E8F0',
      boxShadow: '0 1px 4px rgba(20, 33, 61, 0.04)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {/* BOTÓN HAMBURGUESA MÓVIL */}
        <button
          type="button"
          className="mobile-menu-btn"
          onClick={onToggleSidebar}
          aria-label="Abrir menú de navegación"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--navy, #14213D)',
            padding: '0.45rem',
            borderRadius: '8px',
            transition: 'background 0.15s ease'
          }}
        >
          {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        {/* IDENTIDAD INSTITUCIONAL SUPERIOR */}
        <div 
          className="header-title" 
          onClick={() => navigate('/portal')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', cursor: 'pointer' }}
        >
          <img src={liaterLogoDark} alt="LIATER" style={{ height: '56px', objectFit: 'contain', transition: 'height 0.2s ease' }} />
          <div style={{ height: '40px', width: '1.5px', background: '#E2E8F0' }} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--navy, #14213D)', lineHeight: 1.2 }}>
              Portal Educativo <span style={{ color: 'var(--gold, #FCA311)' }}>LIATER</span>
            </span>
            <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700, letterSpacing: '0.05em', marginTop: '2px' }}>
              UNIVERSIDAD NACIONAL DE COLOMBIA
            </span>
          </div>
        </div>
      </div>

      {currentUser && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          
          {/* Racha de Estudio (Estudiantes) */}
          {(currentUser.role === 'student') && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.35rem', 
              background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
              padding: '0.35rem 0.75rem', 
              borderRadius: '999px',
              border: '1px solid #fde68a',
              boxShadow: '0 2px 6px rgba(252, 163, 17, 0.15)',
              color: '#d97706',
              fontWeight: 800,
              fontSize: '0.85rem'
            }}
            title={streak > 0 ? `¡Sigue así! Has estudiado ${streak} semana(s) seguida(s).` : "¡Completa una actividad para iniciar tu racha!"}
            >
              <span style={{ fontSize: '1rem', filter: streak === 0 ? 'grayscale(100%) opacity(0.5)' : 'none' }}>🔥</span>
              <span>{streak > 0 ? `${streak} semana${streak > 1 ? 's' : ''}` : '¡Inicia tu racha!'}</span>
            </div>
          )}

          {/* PERFIL DOCENTE / USUARIO CON REDIRECCIÓN DIRECTA A /perfil */}
          <div 
            className="header-profile" 
            onClick={() => navigate('/perfil')}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.85rem', 
              cursor: 'pointer',
              padding: '0.35rem 0.65rem',
              borderRadius: '12px',
              transition: 'all 0.18s ease'
            }}
            onMouseOver={e => e.currentTarget.style.background = '#F8FAFC'}
            onMouseOut={e => e.currentTarget.style.background = 'transparent'}
            title="Ver y editar mi perfil"
          >
            <div className="profile-info" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span 
                className="profile-name"
                style={{ 
                  fontWeight: 800, 
                  fontSize: '0.9rem', 
                  color: 'var(--navy, #14213D)', 
                  lineHeight: 1.2,
                  textTransform: 'capitalize' 
                }}
              >
                {currentUser.name || currentUser.email}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '2px' }}>
                <span 
                  style={{ 
                    fontSize: '0.72rem', 
                    fontWeight: 800,
                    background: currentUser.role === 'teacher' ? '#DCFCE7' : (currentUser.role === 'admin' ? '#FEE2E2' : '#F1F5F9'),
                    color: currentUser.role === 'teacher' ? '#007A2E' : (currentUser.role === 'admin' ? '#DC2626' : 'var(--navy, #14213D)'),
                    padding: '1px 7px',
                    borderRadius: '6px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px'
                  }}
                >
                  <span style={{ 
                    width: '5px', 
                    height: '5px', 
                    borderRadius: '50%', 
                    background: currentUser.role === 'teacher' ? '#007A2E' : (currentUser.role === 'admin' ? '#DC2626' : '#14213D') 
                  }}></span>
                  {getRoleLabel(currentUser.role)}
                </span>
              </div>
            </div>

            {currentUser.avatar ? (
              <img 
                src={currentUser.avatar} 
                alt="Profile" 
                className="profile-avatar" 
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '2px solid var(--gold, #FCA311)',
                  boxShadow: '0 2px 8px rgba(20, 33, 61, 0.12)'
                }}
              />
            ) : (
              <div 
                className="profile-avatar-initials"
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  background: 'var(--navy, #14213D)',
                  color: 'var(--gold, #FCA311)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  border: '2px solid var(--gold, #FCA311)',
                  boxShadow: '0 2px 8px rgba(252, 163, 17, 0.2)',
                  flexShrink: 0
                }}
              >
                {getInitials(currentUser.name || currentUser.email)}
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
