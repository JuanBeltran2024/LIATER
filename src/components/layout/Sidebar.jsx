/**
 * Componente: Sidebar
 * Representa la barra lateral de navegación de la plataforma LMS.
 * Dark navy design con logo LIATER y acentos dorados.
 */
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  Home, BookOpen, Users, LogOut, Settings, LayoutDashboard,
  GraduationCap, UserCircle, HelpCircle, ListTree, ArrowLeft,
  Video, FileText, Megaphone, CalendarDays, MessageSquare, BarChart2,
  Paperclip
} from 'lucide-react';
import unalPillLogo from '@/assets/unal-pill-logo.png';

export default function Sidebar({ isOpenMobile, onCloseMobile }) {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const role = currentUser?.role;
  
  const [activeProgramId, setActiveProgramId] = useState(localStorage.getItem('activeProgramId') || '');
  const [activeProgramType, setActiveProgramType] = useState(localStorage.getItem('activeProgramType') || 'diplomado');

  useEffect(() => {
    const handleStorageChange = () => {
      setActiveProgramId(localStorage.getItem('activeProgramId') || '');
      setActiveProgramType(localStorage.getItem('activeProgramType') || 'diplomado');
    };

    window.addEventListener('programContextChanged', handleStorageChange);
    
    // Sincronizar en caso de que cambie la ruta y el storage haya sido actualizado sin evento
    handleStorageChange();

    return () => {
      window.removeEventListener('programContextChanged', handleStorageChange);
    };
  }, [location.pathname]);

  // Lista de rutas donde NO se debe mostrar el menú específico del curso
  const globalRoutes = ['/portal', '/perfil', '/soporte', '/users', '/communications'];
  const isGlobalRoute = globalRoutes.includes(location.pathname);

  const handleLogout = () => {
    if (onCloseMobile) onCloseMobile();
    logout();
    navigate('/login');
  };

  const handleNavClick = (path) => {
    if (onCloseMobile) onCloseMobile();
    if (path) navigate(path);
  };

  return (
    <>
      {isOpenMobile && (
        <div 
          className="sidebar-backdrop"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}
      <aside className={`sidebar ${isOpenMobile ? 'mobile-open' : ''}`}>

        {/* --- SECCIÓN 1: Logo UNAL --- */}
        <div 
          className="sidebar-logo" 
          onClick={() => handleNavClick('/portal')} 
          style={{ 
            padding: '1.25rem 1rem 1rem 1rem', 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            cursor: 'pointer',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
          }}
        >
        <img 
          src={unalPillLogo} 
          alt="Universidad Nacional de Colombia" 
          className="sidebar-logo-img" 
          style={{ width: '100%', maxWidth: '200px', height: 'auto', maxHeight: '110px', objectFit: 'contain' }} 
        />
        <span style={{ 
          fontSize: '0.64rem', 
          color: 'rgba(255, 255, 255, 0.45)', 
          fontWeight: 700, 
          letterSpacing: '0.06em', 
          textTransform: 'uppercase', 
          marginTop: '0.5rem',
          textAlign: 'center' 
        }}>
          Facultad de Ingeniería · LIATER
        </span>
      </div>

      {/* --- SECCIÓN 2: Menú de Navegación Principal --- */}
      <nav className="sidebar-nav">

        {/* --- MENÚ PROFESOR (GLOBAL O CONTEXTUAL DE CURSO) --- */}
        {role === 'teacher' ? (
          (() => {
            const isTeacherCourse = location.pathname.startsWith('/dashboard/profesor/');
            const teacherProgId = isTeacherCourse ? location.pathname.split('/dashboard/profesor/')[1]?.split('?')[0]?.split('/')[0] : null;
            const currentTab = new URLSearchParams(location.search).get('tab') || 'resumen';

            if (isTeacherCourse && teacherProgId) {
              return (
                <>
                  <button
                    type="button"
                    onClick={() => navigate('/portal')}
                    className="nav-item back-to-portal-btn"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      padding: '0.55rem 0.85rem',
                      borderRadius: 'var(--radius-md, 6px)',
                      background: 'rgba(255, 255, 255, 0.08)',
                      color: 'var(--white, #FFFFFF)',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      marginBottom: '1.25rem',
                      cursor: 'pointer',
                      width: '100%',
                      textAlign: 'left',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseOver={e => {
                      e.currentTarget.style.background = 'rgba(252, 163, 17, 0.18)';
                      e.currentTarget.style.borderColor = 'var(--gold)';
                      e.currentTarget.style.color = 'var(--gold)';
                    }}
                    onMouseOut={e => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                      e.currentTarget.style.color = 'var(--white, #FFFFFF)';
                    }}
                  >
                    <ArrowLeft size={16} />
                    <span>Volver al Portal</span>
                  </button>

                  <div className="sidebar-section-label">HERRAMIENTAS DEL CURSO</div>

                  <NavLink
                    to={`/dashboard/profesor/${teacherProgId}?tab=resumen`}
                    className={() => currentTab === 'resumen' ? 'nav-item active' : 'nav-item'}
                    aria-current={currentTab === 'resumen' ? 'page' : undefined}
                  >
                    <BookOpen size={18} />
                    <span>Panorama del Curso</span>
                  </NavLink>

                  <NavLink
                    to={`/dashboard/profesor/${teacherProgId}?tab=clases`}
                    className={() => currentTab === 'clases' ? 'nav-item active' : 'nav-item'}
                    aria-current={currentTab === 'clases' ? 'page' : undefined}
                  >
                    <Video size={18} />
                    <span>Mis Clases</span>
                  </NavLink>

                  <NavLink
                    to={`/dashboard/profesor/${teacherProgId}?tab=recursos`}
                    className={() => currentTab === 'recursos' ? 'nav-item active' : 'nav-item'}
                    aria-current={currentTab === 'recursos' ? 'page' : undefined}
                  >
                    <Paperclip size={18} />
                    <span>Material del Curso</span>
                  </NavLink>

                  <NavLink
                    to={`/dashboard/profesor/${teacherProgId}?tab=reforzamiento`}
                    className={() => currentTab === 'reforzamiento' ? 'nav-item active' : 'nav-item'}
                    aria-current={currentTab === 'reforzamiento' ? 'page' : undefined}
                  >
                    <GraduationCap size={18} />
                    <span>Reforzamiento IA</span>
                  </NavLink>

                  <NavLink
                    to={`/dashboard/profesor/${teacherProgId}?tab=dudas`}
                    className={() => currentTab === 'dudas' ? 'nav-item active' : 'nav-item'}
                    aria-current={currentTab === 'dudas' ? 'page' : undefined}
                  >
                    <MessageSquare size={18} />
                    <span>Dudas y Consultas</span>
                  </NavLink>

                  <NavLink
                    to={`/dashboard/profesor/${teacherProgId}?tab=anuncios`}
                    className={() => currentTab === 'anuncios' ? 'nav-item active' : 'nav-item'}
                    aria-current={currentTab === 'anuncios' ? 'page' : undefined}
                  >
                    <Megaphone size={18} />
                    <span>Anuncios</span>
                  </NavLink>

                  <NavLink
                    to={`/dashboard/profesor/${teacherProgId}?tab=estudiantes`}
                    className={() => currentTab === 'estudiantes' ? 'nav-item active' : 'nav-item'}
                    aria-current={currentTab === 'estudiantes' ? 'page' : undefined}
                  >
                    <Users size={18} />
                    <span>Estudiantes</span>
                  </NavLink>

                  <div className="sidebar-divider" />
                  <div className="sidebar-section-label">CUENTA</div>

                  <NavLink 
                    to="/perfil" 
                    className={() => location.pathname === '/perfil' ? 'nav-item active' : 'nav-item'}
                    aria-current={location.pathname === '/perfil' ? 'page' : undefined}
                  >
                    <UserCircle size={18} />
                    <span>Mi perfil</span>
                  </NavLink>

                  <NavLink 
                    to="/soporte" 
                    className={() => location.pathname === '/soporte' ? 'nav-item active' : 'nav-item'}
                    aria-current={location.pathname === '/soporte' ? 'page' : undefined}
                  >
                    <HelpCircle size={18} />
                    <span>Soporte técnico</span>
                  </NavLink>
                </>
              );
            }

            return (
              <>
                <div className="sidebar-section-label">INICIO</div>
                <NavLink
                  to="/portal"
                  className={() => {
                    const isInicio = location.pathname === '/portal' && (!location.search || (!location.search.includes('tab=programas') && !location.search.includes('tab=agenda') && !location.search.includes('tab=consultas')));
                    return isInicio ? 'nav-item active' : 'nav-item';
                  }}
                  aria-current={(location.pathname === '/portal' && (!location.search || (!location.search.includes('tab=programas') && !location.search.includes('tab=agenda') && !location.search.includes('tab=consultas')))) ? 'page' : undefined}
                  end
                >
                  <Home size={18} />
                  <span>Inicio docente</span>
                </NavLink>

                <NavLink
                  to="/portal?tab=programas"
                  className={() => {
                    const isProgramas = location.pathname === '/portal' && location.search.includes('tab=programas');
                    return isProgramas ? 'nav-item active' : 'nav-item';
                  }}
                  aria-current={(location.pathname === '/portal' && location.search.includes('tab=programas')) ? 'page' : undefined}
                >
                  <BookOpen size={18} />
                  <span>Mis programas</span>
                </NavLink>

                <NavLink
                  to="/portal?tab=consultas"
                  className={() => {
                    const isConsultas = (location.pathname === '/portal' && location.search.includes('tab=consultas')) || location.pathname === '/consultas';
                    return isConsultas ? 'nav-item active' : 'nav-item';
                  }}
                  aria-current={((location.pathname === '/portal' && location.search.includes('tab=consultas')) || location.pathname === '/consultas') ? 'page' : undefined}
                >
                  <MessageSquare size={18} />
                  <span>Bandeja de consultas</span>
                </NavLink>

                <NavLink
                  to="/portal?tab=agenda"
                  className={() => {
                    const isAgenda = (location.pathname === '/portal' && location.search.includes('tab=agenda')) || location.pathname === '/pendientes';
                    return isAgenda ? 'nav-item active' : 'nav-item';
                  }}
                  aria-current={((location.pathname === '/portal' && location.search.includes('tab=agenda')) || location.pathname === '/pendientes') ? 'page' : undefined}
                >
                  <CalendarDays size={18} />
                  <span>Agenda</span>
                </NavLink>

                <div className="sidebar-divider" />
                <div className="sidebar-section-label">CUENTA</div>

                <NavLink 
                  to="/perfil" 
                  className={() => {
                    const isPerfil = location.pathname === '/perfil';
                    return isPerfil ? 'nav-item active' : 'nav-item';
                  }}
                  aria-current={location.pathname === '/perfil' ? 'page' : undefined}
                >
                  <UserCircle size={18} />
                  <span>Mi perfil</span>
                </NavLink>

                <NavLink 
                  to="/soporte" 
                  className={() => {
                    const isSoporte = location.pathname === '/soporte';
                    return isSoporte ? 'nav-item active' : 'nav-item';
                  }}
                  aria-current={location.pathname === '/soporte' ? 'page' : undefined}
                >
                  <HelpCircle size={18} />
                  <span>Soporte técnico</span>
                </NavLink>
              </>
            );
          })()
        ) : (
          <>
            {/* --- ENLACES GLOBALES (ESTUDIANTE / ADMIN) --- */}
            {(isGlobalRoute || role === 'admin') && (
              <>
                <div className="sidebar-section-label">Principal</div>
                <NavLink
                  to="/portal"
                  className={({isActive}) => (isActive || (role === 'admin' && location.pathname.startsWith('/dashboard/admin'))) ? 'nav-item active' : 'nav-item'}
                >
                  <LayoutDashboard size={18} />
                  <span>{role === 'admin' ? 'Panorama General' : 'Mis Programas'}</span>
                </NavLink>

                {role === 'admin' && (
                  <>
                    <NavLink
                      to="/users"
                      className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}
                    >
                      <Users size={18} />
                      <span>Gestión de Usuarios</span>
                    </NavLink>

                    <NavLink
                      to="/communications"
                      className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}
                    >
                      <Megaphone size={18} />
                      <span>Comunicaciones</span>
                    </NavLink>
                  </>
                )}

                <div className="sidebar-divider" />
                <div className="sidebar-section-label">Cuenta</div>

                <NavLink to="/perfil" className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}>
                  <UserCircle size={18} />
                  <span>Mi Perfil</span>
                </NavLink>

                <NavLink to="/soporte" className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}>
                  <HelpCircle size={18} />
                  <span>Soporte Técnico</span>
                </NavLink>
              </>
            )}

            {/* --- SEPARADOR VISUAL PARA MENÚ DE CURSO --- */}
            {(!isGlobalRoute && role !== 'admin') && (
              <div className="sidebar-section-label">
                Menú del Curso
              </div>
            )}

            {/* MUESTRA LAS OPCIONES DEL CURSO SOLO SI NO ESTÁ EN EL PORTAL GLOBAL (Y NO ES ADMIN) */}
            {(!isGlobalRoute && role !== 'admin') && (
              <>
                {/* --- ENLACES ESTUDIANTE --- */}
                {role === 'student' && (
                  <>
                    <NavLink to={`/dashboard/${activeProgramId}`} className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'} end>
                      <Home size={18} />
                      <span>Inicio {activeProgramType === 'curso' ? 'del Curso' : 'del Diplomado'}</span>
                    </NavLink>
                    {activeProgramType !== 'curso' ? (
                      <NavLink to={`/modules/${activeProgramId}`} className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}>
                        <BookOpen size={18} />
                        <span>Módulos</span>
                      </NavLink>
                    ) : (
                      <NavLink to={`/syllabus/${activeProgramId}`} className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}>
                        <ListTree size={18} />
                        <span>Sesiones</span>
                      </NavLink>
                    )}
                    <NavLink to={`/resources/${activeProgramId}`} className={({isActive}) => (isActive || location.pathname.startsWith('/resources/') || location.pathname.startsWith('/recursos/')) ? 'nav-item active' : 'nav-item'}>
                      <Paperclip size={18} />
                      <span>Recursos de Estudio</span>
                    </NavLink>
                    <NavLink to={`/resultados/${activeProgramId}`} className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}>
                      <BarChart2 size={18} />
                      <span>Mis Resultados</span>
                    </NavLink>
                    <NavLink to={`/teachers/${activeProgramId}`} className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}>
                      <Users size={18} />
                      <span>Profesores</span>
                    </NavLink>
                  </>
                )}
              </>
            )}
          </>
        )}

      </nav>

      {/* --- SECCIÓN 3: Pie de la barra lateral --- */}
      <div className="sidebar-footer" style={{ padding: '0.85rem 0.75rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <button 
          className="logout-btn" 
          onClick={handleLogout}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.65rem',
            padding: '0.65rem 1rem',
            borderRadius: '10px',
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: 'rgba(255, 255, 255, 0.85)',
            fontWeight: 700,
            fontSize: '0.84rem',
            cursor: 'pointer',
            transition: 'all 0.18s ease'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
            e.currentTarget.style.color = '#fca5a5';
            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.35)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.85)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
          }}
        >
          <LogOut size={16} />
          <span>Cerrar Sesión</span>
        </button>
      </div>

    </aside>
    </>
  );
}
