import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard, Users, GraduationCap, BookOpen,
  ListTree, Video, FileText, Settings, ShieldAlert, ArrowLeft, Megaphone, Paperclip
} from 'lucide-react';
import { isClassLiveOrSoon, isClassActiveOrUpcoming } from '@/utils/dateUtils';

import AdminDashboard from '@/components/admin/AdminDashboard';
import AdminStudents from '@/components/admin/AdminStudents';
import AdminTeachers from '@/components/admin/AdminTeachers';
import AdminAnnouncements from '@/components/admin/AdminAnnouncements';
import AdminSettingsTab from '@/components/admin/AdminSettingsTab';
import CourseBuilder from '@/components/admin/CourseBuilder';
import AdminResources from '@/components/admin/AdminResources';
import './AdminPanel.css';

const TABS = [
  { id: 'resumen',    label: 'Resumen',       icon: <LayoutDashboard size={16} /> },
  { id: 'curriculum', label: 'Constructor',   icon: <ListTree size={16} /> },
  { id: 'recursos',   label: 'Material del Curso', icon: <Paperclip size={16} /> },
  { id: 'alumnos',    label: 'Alumnos',       icon: <Users size={16} /> },
  { id: 'profesores', label: 'Profesores',    icon: <GraduationCap size={16} /> },
  { id: 'anuncios',   label: 'Anuncios',      icon: <Megaphone size={16} /> },
  { id: 'configuracion', label: 'Configuración', icon: <Settings size={16} /> },
];

export default function AdminPanel() {
  const { currentUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { programId } = useParams();
  
  const queryParams = new URLSearchParams(location.search);
  const rawTab = queryParams.get('tab');
  // Redirigir pestañas viejas al constructor
  let tabFromUrl = rawTab;
  if (['subtemas', 'modulos', 'clases', 'sesiones'].includes(rawTab)) {
    tabFromUrl = 'curriculum';
  }
  
  const [activeTab, setActiveTab] = useState(tabFromUrl && TABS.some(t => t.id === tabFromUrl) ? tabFromUrl : 'resumen');
  const role = currentUser?.role;

  useEffect(() => {
    const currentRaw = queryParams.get('tab');
    let currentTab = currentRaw;
    if (['subtemas', 'modulos', 'clases', 'sesiones'].includes(currentRaw)) {
      currentTab = 'curriculum';
    }
    if (currentTab && currentTab !== activeTab && TABS.some(t => t.id === currentTab)) {
      setActiveTab(currentTab);
    }
  }, [location.search, activeTab]);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    navigate(`/dashboard/admin/${programId}?tab=${tabId}`, { replace: true });
  };

  const [data, setData] = useState({
    program: null,
    teachers: [], modules: [], sessions: [], classes: [], resources: [],
    upcomingClasses: [], enrolledStudents: [],
    counts: { usuarios: 0, profesores: 0, modulos: 0, sesiones: 0, subtemas: 0, clases: 0 }
  });
  
  const activeLiveClass = data.classes.find(c => isClassLiveOrSoon(c, 10));
  const activeLiveMeetUrl = activeLiveClass ? (activeLiveClass.meet_url || data.program?.meet_url) : null;

  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const refreshData = () => setRefreshTrigger(prev => prev + 1);

  const handleTogglePublish = async () => {
    if (!programId || !data.program) return;
    const currentlyPublished = data.program?.is_published !== false && data.program?.status !== 'draft';
    const nextState = !currentlyPublished;
    try {
      const updates = nextState
        ? { is_published: true, status: 'published' }
        : { is_published: false, status: 'draft' };
      const { error } = await supabase
        .from('diploma_programs')
        .update(updates)
        .eq('id', decodeURIComponent(programId).trim());
      if (error) throw error;
      refreshData();
    } catch (err) {
      console.error('Error al cambiar estado de publicación:', err);
    }
  };

  useEffect(() => {
    if (role !== 'admin') return;

    async function fetchAll() {
      if (!programId) return;
      setLoading(true);
      try {
        const cleanId = decodeURIComponent(programId).trim();

        // 1. Obtener datos del programa
        const { data: programData, error: progErr } = await supabase
          .from('diploma_programs')
          .select('*')
          .eq('id', cleanId)
          .maybeSingle();

        if (progErr) console.warn('Advertencia al consultar programa:', progErr);

        if (programData) {
          localStorage.setItem('activeProgramId', cleanId);
          if (programData.program_type) {
            localStorage.setItem('activeProgramType', programData.program_type);
          }
          window.dispatchEvent(new Event('programContextChanged'));
        }

        // 2. Consultar colecciones
        let teachersData = [], modulesData = [], sessionsData = [], classesData = [], enrolledData = [];

        try {
          const { data } = await supabase.from('modules').select('*').eq('program_id', cleanId).order('order_index', { ascending: true });
          modulesData = data || [];
        } catch {}

        try {
          const { data, error } = await supabase.from('sessions').select('*').eq('program_id', cleanId).order('order_index', { ascending: true });
          if (error) {
            const { data: oldData } = await supabase.from('subtopics').select('*').eq('program_id', cleanId).order('order_index', { ascending: true });
            sessionsData = oldData || [];
          } else {
            sessionsData = data || [];
          }
        } catch {
          try {
            const { data: oldData } = await supabase.from('subtopics').select('*').eq('program_id', cleanId).order('order_index', { ascending: true });
            sessionsData = oldData || [];
          } catch {}
        }

        try {
          const { data } = await supabase.from('class_sessions').select('*, teacher_profiles(name)').eq('program_id', cleanId).order('class_date', { ascending: true });
          classesData = data || [];
        } catch {}

        try {
          const { data } = await supabase.from('enrollments').select('*, users_profile(*), diploma_programs(title)').eq('program_id', cleanId);
          enrolledData = data || [];
        } catch {}

        try {
          const enrolledUserIds = new Set((enrolledData || []).map(e => e.student_id).filter(Boolean));
          const teacherIdsInClasses = new Set((classesData || []).map(c => c.teacher_id).filter(Boolean));

          const { data: allTeacherProfiles } = await supabase.from('teacher_profiles').select('*');
          if (allTeacherProfiles) {
            const userProfileMap = new Map();
            (enrolledData || []).forEach(e => {
              if (e.student_id && e.users_profile) {
                userProfileMap.set(e.student_id, e.users_profile);
              }
            });

            const matched = allTeacherProfiles.filter(t => enrolledUserIds.has(t.user_id) || teacherIdsInClasses.has(t.id));

            const missingUids = matched.map(t => t.user_id).filter(uid => uid && !userProfileMap.has(uid));
            if (missingUids.length > 0) {
              try {
                const { data: profiles } = await supabase
                  .from('users_profile')
                  .select('id, full_name, email, role, is_active, created_at, confirmation_sent_at, confirmed_at')
                  .in('id', missingUids);
                if (profiles) {
                  profiles.forEach(p => userProfileMap.set(p.id, p));
                }
              } catch {}
            }

            teachersData = matched.map(t => ({
              ...t,
              users_profile: userProfileMap.get(t.user_id) || t.users_profile || null
            }));
          }
        } catch {}

        const upcoming = classesData.filter(c => isClassActiveOrUpcoming(c)).slice(0, 6);

        setData({
          program: programData,
          teachers: teachersData,
          modules: modulesData,
          sessions: sessionsData,
          classes: classesData,
          upcomingClasses: upcoming,
          enrolledStudents: enrolledData,
          counts: {
            usuarios: enrolledData.length,
            profesores: teachersData.length,
            modulos: modulesData.length,
            sesiones: sessionsData.length,
            subtemas: sessionsData.length,
            clases: classesData.length,
          }
        });
      } catch (err) {
        console.error('Error cargando datos del panel admin:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchAll();
  }, [role, refreshTrigger, programId]);

  if (role !== 'admin') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem', color: 'var(--text-muted)' }}>
        <ShieldAlert size={48} color="#dc2626" />
        <h2 style={{ color: 'var(--text-dark)' }}>Acceso Denegado</h2>
        <p>Este panel es exclusivo para administradores.</p>
        <p>Cambia tu rol en la parte superior para acceder.</p>
      </div>
    );
  }

  if (!loading && !data.program) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)', animation: 'fadeSlideUp 0.35s ease-out' }}>
        <h2>Programa no encontrado</h2>
        <p style={{ marginTop: '0.5rem', marginBottom: '1.5rem' }}>El programa solicitado no existe o fue eliminado.</p>
        <Link to="/portal" className="btn btn-primary">
          <ArrowLeft size={16} /> Volver al Panorama General
        </Link>
      </div>
    );
  }

  const isCourse = data.program?.program_type === 'curso';

  const renderTab = () => {
    switch (activeTab) {
      case 'resumen':    return <AdminDashboard counts={data.counts} upcomingClasses={data.upcomingClasses} isCourse={isCourse} isPublished={data.program?.is_published !== false && data.program?.status !== 'draft'} onTabChange={handleTabChange} onTogglePublish={handleTogglePublish} activeLiveMeetUrl={activeLiveMeetUrl} activeLiveTitle={activeLiveClass?.title || null} />;
      case 'curriculum': return <CourseBuilder modules={data.modules} sessions={data.sessions} classes={data.classes} teachers={data.teachers} isCourse={isCourse} programId={programId} onRefresh={refreshData} />;
      case 'recursos':   return <AdminResources programId={programId} programTitle={data.program?.title} programClasses={data.classes} onRefresh={refreshData} />;
      case 'alumnos':    return <AdminStudents enrolledStudents={data.enrolledStudents} programId={programId} programTitle={data.program?.title} onRefresh={refreshData} />;
      case 'profesores': return <AdminTeachers teachers={data.teachers} loading={loading} onRefresh={refreshData} programId={programId} programTitle={data.program?.title} />;
      case 'anuncios':   return <AdminAnnouncements programId={programId} onRefresh={refreshData} />;
      case 'configuracion': return <AdminSettingsTab />;
      default:           return <AdminDashboard counts={data.counts} upcomingClasses={data.upcomingClasses} isCourse={isCourse} />;
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/portal" className="btn btn-outline" style={{ fontSize: '0.82rem', padding: '0.4rem 0.85rem' }}>
          <ArrowLeft size={14} /> Volver a Programas
        </Link>
      </div>

      <div className="page-header" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">Panel de Administración: {data.program?.title || 'Cargando...'}</h1>
          <p className="page-description">Gestiona todos los recursos y contenidos del {isCourse ? 'curso' : 'diplomado'} desde un solo lugar.</p>
        </div>
        {activeLiveMeetUrl && (
          <a
            href={activeLiveMeetUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              background: '#FCA311',
              color: '#14213D',
              padding: '0.45rem 1rem',
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontWeight: 700,
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              boxShadow: '0 2px 4px rgba(252,163,17,0.2)',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={e => e.currentTarget.style.transform = 'translateY(-1px)'}
            onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <Video size={16} /> Unirse a la sesión en vivo
          </a>
        )}
      </div>

      <div className="admin-tabs" style={{ background: 'white', borderRadius: 'var(--radius-lg)', padding: '0.5rem', display: 'flex', gap: '0.25rem', overflowX: 'auto', boxShadow: 'var(--shadow-sm)', marginBottom: '1.5rem' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            id={`admin-tab-${tab.id}`}
            className={`admin-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => handleTabChange(tab.id)}
            style={{
              padding: '0.75rem 1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              border: 'none',
              background: activeTab === tab.id ? 'var(--gold-subtle)' : 'transparent',
              color: activeTab === tab.id ? 'var(--gold-dark)' : 'var(--text-secondary)',
              fontWeight: activeTab === tab.id ? 700 : 500,
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap'
            }}
          >
            {React.cloneElement(tab.icon, { color: activeTab === tab.id ? 'var(--gold-dark)' : 'var(--text-muted)' })}
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Cargando datos del panel...
        </div>
      ) : (
        renderTab()
      )}
    </div>
  );
}
