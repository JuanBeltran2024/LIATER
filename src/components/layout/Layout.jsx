/**
 * Componente: Layout
 * Estructura contenedora (Wrapper) para las páginas internas de la plataforma.
 * Integra la barra lateral (Sidebar), la barra superior (Header) y define
 * un área dinámica donde se carga el contenido de cada página.
 */
import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import coreniusLogoColor from '@/assets/Corenius_Logo_Principal_Color.svg';

export default function Layout() {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setIsMobileSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="app-layout">
      
      {/* --- BARRA LATERAL (CON SOPORTE RESPONSIVE) --- */}
      <Sidebar 
        isOpenMobile={isMobileSidebarOpen} 
        onCloseMobile={() => setIsMobileSidebarOpen(false)} 
      />
      
      {/* --- CONTENEDOR PRINCIPAL --- */}
      <main className="main-content" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        
        {/* --- BARRA SUPERIOR (HEADER) --- */}
        <Header 
          onToggleSidebar={() => setIsMobileSidebarOpen(prev => !prev)}
          isSidebarOpen={isMobileSidebarOpen}
        />
        
        {/* --- ÁREA DINÁMICA DE CONTENIDO --- */}
        {/* El componente <Outlet /> de React Router es un "marcador de posición".
            Aquí es donde se insertarán automáticamente los componentes hijos (páginas)
            dependiendo de la URL actual (ej. Dashboard, Módulos, Profesores). */}
        <div className="page-content" style={{ flex: '1 0 auto' }}>
          <Outlet />
        </div>

        {/* --- PIE DE PÁGINA INTERNO PORTAL --- */}
        <footer style={{
          padding: '1.25rem 2rem',
          borderTop: '1px solid #E2E8F0',
          background: '#FFFFFF',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          fontSize: '0.78rem',
          color: '#64748B',
          marginTop: 'auto'
        }}>
          <div>
            © {new Date().getFullYear()} Laboratorio LIATER — Universidad Nacional de Colombia.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: '#94A3B8', fontWeight: 500 }}>Diseño y Desarrollo por</span>
            <a 
              href="https://www.corenius.com/" 
              target="_blank" 
              rel="noopener noreferrer" 
              title="Corenius | Transformación Digital"
              style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none', transition: 'transform 0.2s ease' }}
              onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <img src={coreniusLogoColor} alt="Corenius - Transformación Digital" style={{ height: '20px', objectFit: 'contain' }} />
            </a>
          </div>
        </footer>
        
      </main>
    </div>
  );
}
