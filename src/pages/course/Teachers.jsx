import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { Globe, User, Award, BookOpen } from 'lucide-react';

export default function Teachers() {
  const { programId } = useParams();
  const [teachersList, setTeachersList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTeachers() {
      try {
        if (programId) {
          const cleanProgramId = decodeURIComponent(programId).replace(/\s+/g, '-').trim();
          const { data: progData } = await supabase
            .from('diploma_programs')
            .select('program_type')
            .eq('id', cleanProgramId)
            .maybeSingle();

          localStorage.setItem('activeProgramId', cleanProgramId);
          if (progData?.program_type) {
            localStorage.setItem('activeProgramType', progData.program_type);
          }
          window.dispatchEvent(new Event('programContextChanged'));

          const { data: enrollData } = await supabase
            .from('enrollments')
            .select('student_id')
            .eq('program_id', cleanProgramId);

          const { data: classData } = await supabase
            .from('class_sessions')
            .select('teacher_id')
            .eq('program_id', cleanProgramId);

          const enrolledUserIds = new Set((enrollData || []).map(e => e.student_id).filter(Boolean));
          const teacherIdsInClasses = new Set((classData || []).map(c => c.teacher_id).filter(Boolean));

          const { data: allTeachers, error } = await supabase
            .from('teacher_profiles')
            .select('*');

          if (error) throw error;

          const assigned = (allTeachers || []).filter(t => enrolledUserIds.has(t.user_id) || teacherIdsInClasses.has(t.id));
          setTeachersList(assigned);
        } else {
          const { data, error } = await supabase
            .from('teacher_profiles')
            .select('*');
          
          if (error) throw error;
          setTeachersList(data || []);
        }
      } catch (err) {
        console.error('Error fetching teachers:', err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchTeachers();
  }, [programId]);

  if (loading) {
    return (
      <div style={{ width: '100%', padding: '1rem 0' }}>
        <div className="skeleton" style={{ width: '250px', height: '36px', marginBottom: '1rem' }}></div>
        <div className="skeleton" style={{ width: '180px', height: '20px', marginBottom: '2rem' }}></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '2rem' }}>
          <div className="skeleton" style={{ width: '100%', height: '300px', borderRadius: 'var(--radius-lg)' }}></div>
          <div className="skeleton" style={{ width: '100%', height: '300px', borderRadius: 'var(--radius-lg)' }}></div>
          <div className="skeleton" style={{ width: '100%', height: '300px', borderRadius: 'var(--radius-lg)' }}></div>
        </div>
      </div>
    );
  }

  if (teachersList.length === 0) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        <h2>Aún no hay profesores registrados</h2>
        <p>Los perfiles de los docentes aparecerán aquí pronto.</p>
      </div>
    );
  }

  return (
    <div style={{ animation: 'fadeSlideUp 0.35s ease-out' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ color: 'var(--navy)', fontSize: '2.25rem', fontWeight: 800, margin: 0, lineHeight: 1.2 }}>
          Cuerpo Docente
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: '0.35rem 0 0 0' }}>
          Conoce a los expertos que te acompañarán durante tu formación.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
        {teachersList.map(teacher => {
          let bioText = teacher.bio || '';
          let expText = teacher.experience || '';
          let roleText = teacher.title_role || 'Profesor Titular';

          if (bioText && typeof bioText === 'string' && bioText.trim().startsWith('{') && bioText.trim().endsWith('}')) {
            try {
              const parsed = JSON.parse(bioText);
              if (parsed && typeof parsed === 'object') {
                bioText = parsed.bio !== undefined ? parsed.bio : bioText;
                expText = parsed.experience !== undefined ? parsed.experience : expText;
                roleText = parsed.title_role !== undefined ? parsed.title_role : roleText;
              }
            } catch (e) {
              // mantener texto plano
            }
          }

          const teacherInitials = teacher.name ? teacher.name.charAt(0).toUpperCase() : 'P';

          return (
            <div 
              key={teacher.id} 
              className="card" 
              style={{ 
                padding: '1.75rem', 
                background: 'var(--white)', 
                border: '1px solid var(--border-color)', 
                borderTop: '4px solid var(--gold)',
                borderRadius: 'var(--radius-lg)',
                display: 'flex', 
                flexDirection: 'column', 
                gap: '1.25rem',
                boxShadow: '0 4px 14px rgba(20, 33, 61, 0.05)',
                transition: 'all 200ms ease-in-out'
              }}
            >
              {/* CABECERA: AVATAR Y NOMBRE */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                {teacher.photo_url || teacher.photo ? (
                  <img 
                    src={teacher.photo_url || teacher.photo} 
                    alt={teacher.name} 
                    style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--gold)', flexShrink: 0 }} 
                  />
                ) : (
                  <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gold)', fontWeight: 800, fontSize: '1.5rem', flexShrink: 0, border: '2px solid var(--gold)' }}>
                    {teacherInitials}
                  </div>
                )}
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--navy)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {teacher.name || 'Profesor'}
                  </h3>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '0.15rem' }}>
                    {roleText}
                  </div>
                </div>
              </div>

              {/* ESPECIALIDAD */}
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.35rem' }}>
                  Especialidad
                </div>
                {teacher.area && teacher.area.trim() ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: '#e0f2fe', color: '#0369a1', padding: '0.3rem 0.75rem', borderRadius: '9999px', fontSize: '0.8rem', fontWeight: 700 }}>
                    <Award size={14} />
                    {teacher.area}
                  </span>
                ) : (
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic', opacity: 0.7 }}>
                    Especialidad no especificada
                  </span>
                )}
              </div>

              {/* BIOGRAFÍA */}
              <div style={{ borderTop: '1px solid #edf2f7', paddingTop: '1rem' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.35rem' }}>
                  Biografía
                </div>
                <p style={{ fontSize: '0.85rem', color: bioText && bioText.trim() ? 'var(--navy)' : 'var(--text-muted)', margin: 0, lineHeight: 1.5, fontStyle: bioText && bioText.trim() ? 'normal' : 'italic' }}>
                  {bioText && bioText.trim() ? bioText : 'Sin biografía disponible.'}
                </p>
              </div>

              {/* FORMACIÓN Y TRAYECTORIA (SI EXISTE) */}
              {expText && expText.trim() ? (
                <div style={{ borderTop: '1px solid #edf2f7', paddingTop: '1rem' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.35rem' }}>
                    Formación y Trayectoria
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--navy)', margin: 0, lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                    {expText}
                  </p>
                </div>
              ) : null}

              {/* ENLACES / LINKEDIN (SI EXISTE) */}
              {(teacher.linkedin_url || teacher.linkedin) && String(teacher.linkedin_url || teacher.linkedin).trim().length > 0 && (
                <div style={{ borderTop: '1px solid #edf2f7', paddingTop: '1rem', marginTop: 'auto' }}>
                  <a 
                    href={teacher.linkedin_url || teacher.linkedin} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="btn" 
                    style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      justify: 'center', 
                      gap: '0.5rem', 
                      padding: '0.5rem 1rem', 
                      background: 'var(--bg-light)', 
                      color: 'var(--navy)', 
                      borderRadius: '8px', 
                      fontWeight: 700, 
                      fontSize: '0.82rem',
                      textDecoration: 'none',
                      border: '1px solid var(--border-color)'
                    }}
                  >
                    <Globe size={16} /> LinkedIn
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
