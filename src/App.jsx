/**
 * Archivo principal de rutas de la aplicación.
 * Define la estructura de navegación utilizando React Router con Code-Splitting optimizado.
 */
import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';

// --- Importación de Componentes de Layout ---
import Layout from './components/layout/Layout';
import ProtectedRoute from './components/layout/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';

// Listener para interceptar tokens de invitación o recuperación en el hash (#) y redirigir a /update-password
function AuthHashListener() {
  const navigate = useNavigate();
  const location = useLocation();

  React.useEffect(() => {
    const hash = window.location.hash || '';
    if (hash && (hash.includes('type=invite') || hash.includes('type=recovery') || hash.includes('type=signup') || hash.includes('error_code='))) {
      if (location.pathname !== '/update-password') {
        navigate(`/update-password${hash}`, { replace: true });
      }
    }
  }, [location.pathname, navigate]);

  return null;
}

// --- Importación de Páginas con React.lazy para Code-Splitting por Dominio ---

// 1. Públicas y Autenticación
const Home = React.lazy(() => import('./pages/public/Home'));
const Login = React.lazy(() => import('./pages/public/Login'));
const UpdatePassword = React.lazy(() => import('./pages/public/UpdatePassword'));
const Support = React.lazy(() => import('./pages/public/Support'));

// 2. Portal General del Usuario
const Portal = React.lazy(() => import('./pages/portal/Portal'));
const Profile = React.lazy(() => import('./pages/portal/Profile'));
const UpcomingPrograms = React.lazy(() => import('./pages/portal/UpcomingPrograms'));
const Communications = React.lazy(() => import('./pages/portal/Communications'));

// 3. Entorno de Curso / Diplomado
const Dashboard = React.lazy(() => import('./pages/course/Dashboard'));
const ModulesList = React.lazy(() => import('./pages/course/ModulesList'));
const ModuleDetail = React.lazy(() => import('./pages/course/ModuleDetail'));
const ClassDetail = React.lazy(() => import('./pages/course/ClassDetail'));
const Teachers = React.lazy(() => import('./pages/course/Teachers'));
const CourseResources = React.lazy(() => import('./pages/course/CourseResources'));
const SyllabusRedirector = React.lazy(() => import('./pages/course/SyllabusRedirector'));
const PendingActivities = React.lazy(() => import('./pages/course/PendingActivities'));
const MisResultados = React.lazy(() => import('./pages/course/MisResultados'));

// 4. Paneles de Gestión Administrativa y Docente
const AdminPanel = React.lazy(() => import('./pages/admin/AdminPanel'));
const UserManagement = React.lazy(() => import('./pages/admin/UserManagement'));
const TeacherPanel = React.lazy(() => import('./pages/teacher/TeacherPanel'));

// --- Importación de Estilos Globales ---
import './App.css';

function PageFallback() {
  return (
    <div style={{
      minHeight: '60vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.85rem',
      padding: '2rem'
    }}>
      <div style={{
        width: '36px',
        height: '36px',
        border: '3px solid rgba(11, 21, 40, 0.1)',
        borderTopColor: 'var(--gold-dark, #cca352)',
        borderRadius: '50%',
        animation: 'liaterSpin 0.75s linear infinite'
      }} />
      <style>{`@keyframes liaterSpin { to { transform: rotate(360deg); } }`}</style>
      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted, #64748b)', letterSpacing: '0.3px' }}>
        Cargando sección...
      </span>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AuthHashListener />
        <Suspense fallback={<PageFallback />}>
          <Routes>
            {/* --- RUTAS PÚBLICAS --- */}
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/update-password" element={<UpdatePassword />} />
            
            {/* --- RUTAS PRIVADAS (PLATAFORMA) --- */}
            <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route path="/portal" element={<Portal />} />
              <Route path="/perfil" element={<Profile />} />
              <Route path="/soporte" element={<Support />} />
              <Route path="/proximos-programas" element={<UpcomingPrograms />} />
              <Route path="/pendientes" element={<PendingActivities />} />
              <Route path="/resultados/:programId" element={<MisResultados />} />
              
              <Route path="/dashboard/:programId" element={<ProtectedRoute allowedRoles={['student']}><Dashboard /></ProtectedRoute>} />
              <Route path="/dashboard/profesor/:programId" element={<ProtectedRoute allowedRoles={['teacher']}><TeacherPanel /></ProtectedRoute>} />
              <Route path="/dashboard/admin/:programId" element={<ProtectedRoute allowedRoles={['admin']}><AdminPanel /></ProtectedRoute>} />
              
              <Route path="/modules/:programId" element={<ModulesList />} />
              <Route path="/syllabus/:programId" element={<SyllabusRedirector />} />
              <Route path="/module/:id" element={<ModuleDetail />} />
              <Route path="/class/*" element={<ClassDetail />} />
              <Route path="/teachers/:programId" element={<Teachers />} />
              <Route path="/resources/:programId" element={<CourseResources />} />
              <Route path="/recursos/:programId" element={<CourseResources />} />
              <Route path="/users" element={<ProtectedRoute allowedRoles={['admin']}><UserManagement /></ProtectedRoute>} />
              <Route path="/communications" element={<ProtectedRoute allowedRoles={['admin']}><Communications /></ProtectedRoute>} />
            </Route>
            
            {/* Ruta por defecto */}
            <Route path="*" element={<Navigate to="/portal" replace />} />
          </Routes>
        </Suspense>
      </Router>
    </AuthProvider>
  );
}

export default App;
