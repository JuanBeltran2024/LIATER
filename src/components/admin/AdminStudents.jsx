import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { X, CheckCircle, Plus, Trash2, Eye, UserPlus, Search, Users, Calendar, AlertCircle } from 'lucide-react';
import { formatShortDate } from '@/utils/dateUtils';
import { ConfirmModal } from './AdminShared';
import { Link } from 'react-router-dom';

/* ────────────────────────────────────
   DRAWER — Inscribir Alumnos
──────────────────────────────────── */
export function EnrollStudentDrawer({ programId, programTitle, enrolledStudents, onClose, onRefresh }) {
  const [allStudents, setAllStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [enrolling, setEnrolling] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');

  const enrolledIds = new Set(
    enrolledStudents
      .filter(e => e.users_profile?.role === 'student')
      .map(e => e.student_id || e.users_profile?.id)
  );

  useEffect(() => {
    async function fetchStudents() {
      try {
        const { data, error } = await supabase
          .from('users_profile')
          .select('id, full_name, email, role, is_active')
          .eq('role', 'student')
          .order('full_name', { ascending: true });
        if (error) throw error;
        setAllStudents(data || []);
      } catch (err) {
        console.error('Error cargando estudiantes:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchStudents();
  }, []);

  const unenrolled = allStudents.filter(s => !enrolledIds.has(s.id));
  const filtered = unenrolled.filter(s => {
    const term = searchTerm.toLowerCase();
    return s.full_name?.toLowerCase().includes(term) || s.email?.toLowerCase().includes(term);
  });

  const handleEnroll = async (student) => {
    setEnrolling(student.id);
    setSuccessMsg('');
    try {
      const { error } = await supabase.from('enrollments').insert([{
        student_id: student.id,
        program_id: programId,
      }]);
      if (error) throw error;
      setSuccessMsg(`✓ ${student.full_name} inscrito correctamente.`);
      setAllStudents(prev => prev.filter(s => s.id !== student.id));
      if (onRefresh) onRefresh();
    } catch (err) {
      alert('Error al inscribir: ' + err.message);
    } finally {
      setEnrolling(null);
    }
  };

  const getInitials = (name) => {
    const parts = (name || '').trim().split(' ');
    return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'AL';
  };

  return (
    <>
      <div 
        onClick={onClose} 
        style={{ 
          position: 'fixed', 
          inset: 0, 
          backgroundColor: 'rgba(15, 23, 42, 0.6)', 
          backdropFilter: 'blur(4px)',
          zIndex: 1000,
          animation: 'fadeIn 0.2s ease-out'
        }} 
      />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: '480px', maxWidth: '92vw',
        background: '#FFFFFF', zIndex: 1001, display: 'flex', flexDirection: 'column',
        boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.18)', animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>
        <style>{`
          @keyframes slideInRight { 
            from { transform: translateX(100%); } 
            to { transform: translateX(0); } 
          }
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
        `}</style>
        
        {/* Header Drawer */}
        <div style={{ 
          padding: '1.4rem 1.6rem', 
          background: 'linear-gradient(135deg, var(--navy, #14213D) 0%, #1e3a5f 100%)', 
          flexShrink: 0, 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          borderBottom: '1px solid rgba(255,255,255,0.1)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.25rem' }}>
              <UserPlus size={15} color="var(--gold, #FCA311)" />
              <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.7)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Inscribir Alumno
              </span>
            </div>
            <h2 style={{ margin: 0, color: '#FFFFFF', fontWeight: 800, fontSize: '1.1rem', lineHeight: 1.25 }}>
              {programTitle || 'Programa'}
            </h2>
          </div>
          <button 
            onClick={onClose} 
            style={{ 
              color: 'rgba(255,255,255,0.75)', 
              background: 'rgba(255,255,255,0.1)', 
              border: 'none', 
              borderRadius: '8px',
              cursor: 'pointer', 
              padding: '0.45rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease'
            }}
            onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
            onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Drawer */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          {successMsg && (
            <div style={{ 
              background: '#DCFCE7', 
              color: '#166534', 
              border: '1px solid #86EFAC',
              padding: '0.75rem 1rem', 
              borderRadius: '8px', 
              fontSize: '0.84rem', 
              fontWeight: 600,
              marginBottom: '1rem', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem', 
              flexShrink: 0 
            }}>
              <CheckCircle size={16} color="#166534" /> {successMsg}
            </div>
          )}

          {/* Search Input in Drawer */}
          <div style={{ position: 'relative', marginBottom: '1.25rem', flexShrink: 0 }}>
            <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Buscar estudiante por nombre o correo..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ 
                width: '100%', 
                padding: '0.7rem 1rem 0.7rem 2.5rem', 
                border: '1px solid #CBD5E1', 
                borderRadius: '8px', 
                fontSize: '0.86rem',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s ease'
              }}
              onFocus={e => e.currentTarget.style.borderColor = 'var(--gold, #FCA311)'}
              onBlur={e => e.currentTarget.style.borderColor = '#CBD5E1'}
            />
          </div>

          <div style={{ overflowY: 'auto', flex: 1, paddingRight: '0.25rem' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748B' }}>
                <div style={{ width: '28px', height: '28px', border: '3px solid #E2E8F0', borderTopColor: 'var(--gold, #FCA311)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 0.75rem' }} />
                <span style={{ fontSize: '0.85rem' }}>Cargando estudiantes...</span>
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem 1.5rem', background: '#F8FAFC', borderRadius: '12px', border: '1px dashed #CBD5E1' }}>
                <Users size={32} color="#94A3B8" style={{ margin: '0 auto 0.65rem' }} />
                <p style={{ color: '#475569', margin: 0, fontSize: '0.86rem', fontWeight: 600 }}>
                  {unenrolled.length === 0
                    ? 'Todos los estudiantes de la plataforma ya están inscritos en este programa.'
                    : 'No se encontraron estudiantes con ese término de búsqueda.'}
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {filtered.map(student => (
                  <div 
                    key={student.id} 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between', 
                      padding: '0.85rem 1rem', 
                      border: '1px solid #E2E8F0', 
                      borderRadius: '10px', 
                      background: '#FFFFFF',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseOver={e => e.currentTarget.style.borderColor = '#CBD5E1'}
                    onMouseOut={e => e.currentTarget.style.borderColor = '#E2E8F0'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                      <div style={{
                        width: '36px', height: '36px', borderRadius: '50%',
                        background: 'var(--navy, #14213D)', color: 'var(--gold, #FCA311)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.75rem', fontWeight: 700, flexShrink: 0
                      }}>
                        {getInitials(student.full_name)}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--navy, #14213D)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {student.full_name || 'Sin nombre'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {student.email}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleEnroll(student)}
                      disabled={enrolling === student.id}
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        padding: '0.45rem 0.85rem',
                        background: 'var(--navy, #14213D)',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: enrolling === student.id ? 'not-allowed' : 'pointer',
                        whiteSpace: 'nowrap',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseOver={e => { if (enrolling !== student.id) e.currentTarget.style.background = '#000000'; }}
                      onMouseOut={e => { if (enrolling !== student.id) e.currentTarget.style.background = 'var(--navy, #14213D)'; }}
                    >
                      <Plus size={14} /> {enrolling === student.id ? 'Inscribiendo...' : 'Inscribir'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/* ────────────────────────────────────
   TAB PRINCIPAL — Alumnos Inscritos
──────────────────────────────────── */
function AuthStatusBadge({ status }) {
  const isActive = status === 'active';
  return (
    <span style={{ 
      background: isActive ? '#DCFCE7' : '#FEE2E2', 
      color: isActive ? '#166534' : '#991B1B', 
      fontSize: '0.75rem', 
      fontWeight: 700, 
      padding: '0.3rem 0.75rem', 
      borderRadius: '20px', 
      whiteSpace: 'nowrap', 
      border: `1px solid ${isActive ? '#86EFAC' : '#FCA5A5'}`,
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.35rem'
    }}>
      <span style={{
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        background: isActive ? '#16A34A' : '#DC2626'
      }} />
      {isActive ? 'Activo' : 'Inactivo'}
    </span>
  );
}

export default function AlumnosTab({ enrolledStudents = [], programId, programTitle, onRefresh }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showEnrollDrawer, setShowEnrollDrawer] = useState(false);
  const [studentToUnenroll, setStudentToUnenroll] = useState(null);
  const [unenrolling, setUnenrolling] = useState(false);

  const onlyStudents = enrolledStudents.filter(e => e.users_profile?.role === 'student');

  const filtered = onlyStudents.filter(e => {
    if (!e.users_profile) return false;
    const term = searchTerm.toLowerCase();
    return (
      (e.users_profile.full_name || '').toLowerCase().includes(term) ||
      (e.users_profile.email || '').toLowerCase().includes(term)
    );
  });

  const handleConfirmUnenroll = async () => {
    if (!studentToUnenroll) return;
    setUnenrolling(true);
    try {
      const { error } = await supabase
        .from('enrollments')
        .delete()
        .eq('id', studentToUnenroll.id);

      if (error) throw error;
      setStudentToUnenroll(null);
      if (onRefresh) onRefresh();
    } catch (err) {
      alert('Error al desvincular alumno: ' + err.message);
    } finally {
      setUnenrolling(false);
    }
  };

  const getInitials = (name) => {
    const parts = (name || '').trim().split(' ');
    return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'AL';
  };

  return (
    <div style={{ animation: 'fadeSlideUp 0.35s ease-out' }}>
      
      {/* HEADER SECTION: TITULO + BUSCADOR + BOTON */}
      <div style={{
        marginBottom: '1.5rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--navy, #14213D)' }}>
              Alumnos Inscritos
            </h2>
            <span style={{
              background: 'rgba(20, 33, 61, 0.08)',
              color: 'var(--navy, #14213D)',
              fontSize: '0.78rem',
              fontWeight: 800,
              padding: '2px 9px',
              borderRadius: '12px'
            }}>
              {filtered.length}
            </span>
          </div>
          <p style={{ color: '#64748B', fontSize: '0.84rem', margin: '4px 0 0 0' }}>
            Estudiantes que actualmente tienen acceso y matrícula activa en este programa.
          </p>
        </div>

        {/* BARRA DE ACCIONES SUPERIOR */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* BUSCADOR */}
          <div style={{ position: 'relative', minWidth: '260px' }}>
            <Search size={15} color="#94A3B8" style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Buscar por nombre o correo..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '0.55rem 1rem 0.55rem 2.3rem',
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                fontSize: '0.84rem',
                background: '#FFFFFF',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s ease'
              }}
              onFocus={e => e.currentTarget.style.borderColor = 'var(--gold, #FCA311)'}
              onBlur={e => e.currentTarget.style.borderColor = '#CBD5E1'}
            />
            {searchTerm && (
              <button 
                type="button"
                onClick={() => setSearchTerm('')}
                style={{ position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* BOTON INSCRIBIR */}
          <button
            type="button"
            onClick={() => setShowEnrollDrawer(true)}
            style={{
              fontSize: '0.84rem',
              padding: '0.55rem 1.15rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              background: 'var(--navy, #14213D)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 700,
              boxShadow: '0 2px 6px rgba(20, 33, 61, 0.15)',
              transition: 'all 0.15s ease'
            }}
            onMouseOver={e => e.currentTarget.style.background = '#000000'}
            onMouseOut={e => e.currentTarget.style.background = 'var(--navy, #14213D)'}
          >
            <Plus size={16} /> Inscribir Alumno
          </button>
        </div>
      </div>

      {/* CONTENEDOR TABLA PREMIUM */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '12px',
        border: '1px solid #E2E8F0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        overflow: 'hidden'
      }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          textAlign: 'left',
          tableLayout: 'fixed'
        }}>
          {/* DEFINICION DE ANCHO DE COLUMNAS */}
          <colgroup>
            <col style={{ width: '42%' }} />
            <col style={{ width: '22%' }} />
            <col style={{ width: '22%' }} />
            <col style={{ width: '14%' }} />
          </colgroup>

          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              <th style={{ padding: '0.9rem 1.25rem', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#475569' }}>
                Alumno
              </th>
              <th style={{ padding: '0.9rem 1.25rem', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#475569' }}>
                Estado de Cuenta
              </th>
              <th style={{ padding: '0.9rem 1.25rem', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#475569' }}>
                Fecha de Inscripción
              </th>
              <th style={{ padding: '0.9rem 1.25rem', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#475569', textAlign: 'right' }}>
                Acciones
              </th>
            </tr>
          </thead>

          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: '3.5rem 1.5rem', textAlign: 'center', color: '#64748B' }}>
                  <Users size={36} color="#CBD5E1" style={{ margin: '0 auto 0.75rem' }} />
                  <div style={{ fontWeight: 700, color: 'var(--navy, #14213D)', fontSize: '0.95rem', marginBottom: '0.25rem' }}>
                    {searchTerm ? 'No se encontraron alumnos' : 'No hay alumnos inscritos'}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#64748B', maxWidth: '380px', margin: '0 auto' }}>
                    {searchTerm 
                      ? 'Prueba con otro término de búsqueda o limpia el filtro.' 
                      : 'Inscribe estudiantes a este programa usando el botón "+ Inscribir Alumno".'}
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((enroll, idx) => {
                const user = enroll.users_profile || {};
                const isLast = idx === filtered.length - 1;

                return (
                  <tr 
                    key={enroll.id} 
                    style={{
                      borderBottom: isLast ? 'none' : '1px solid #F1F5F9',
                      transition: 'background 0.15s ease'
                    }}
                    onMouseOver={e => e.currentTarget.style.background = '#F8FAFC'}
                    onMouseOut={e => e.currentTarget.style.background = '#FFFFFF'}
                  >
                    {/* ALUMNO */}
                    <td style={{ padding: '1rem 1.25rem', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                        <div style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '50%',
                          background: 'var(--navy, #14213D)',
                          color: 'var(--gold, #FCA311)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: '0.78rem',
                          flexShrink: 0,
                          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                        }}>
                          {getInitials(user.full_name)}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--navy, #14213D)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {user.full_name || 'Sin nombre registrado'}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {user.email || '—'}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* ESTADO */}
                    <td style={{ padding: '1rem 1.25rem', verticalAlign: 'middle' }}>
                      <AuthStatusBadge status={user.is_active !== false ? 'active' : 'inactive'} />
                    </td>

                    {/* FECHA */}
                    <td style={{ padding: '1rem 1.25rem', verticalAlign: 'middle' }}>
                      <span style={{ fontSize: '0.84rem', color: '#475569', fontWeight: 500 }}>
                        {formatShortDate(enroll.created_at)}
                      </span>
                    </td>

                    {/* ACCIONES */}
                    <td style={{ padding: '1rem 1.25rem', verticalAlign: 'middle', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.45rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <Link
                          to={`/users`}
                          title="Ver perfil completo en Gestión de Usuarios"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '32px',
                            height: '32px',
                            borderRadius: '7px',
                            background: '#F8FAFC',
                            color: 'var(--navy, #14213D)',
                            border: '1px solid #CBD5E1',
                            textDecoration: 'none',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseOver={e => { e.currentTarget.style.background = '#EEF2F6'; e.currentTarget.style.borderColor = '#94A3B8'; }}
                          onMouseOut={e => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.borderColor = '#CBD5E1'; }}
                        >
                          <Eye size={15} />
                        </Link>

                        <button
                          type="button"
                          onClick={() => setStudentToUnenroll(enroll)}
                          title="Desvincular alumno del programa"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '32px',
                            height: '32px',
                            borderRadius: '7px',
                            background: '#FEF2F2',
                            color: '#DC2626',
                            border: '1px solid #FECACA',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseOver={e => { e.currentTarget.style.background = '#FEE2E2'; e.currentTarget.style.borderColor = '#FCA5A5'; }}
                          onMouseOut={e => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.borderColor = '#FECACA'; }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* DRAWER DE INSCRIPCION */}
      {showEnrollDrawer && (
        <EnrollStudentDrawer
          programId={programId}
          programTitle={programTitle}
          enrolledStudents={enrolledStudents}
          onClose={() => setShowEnrollDrawer(false)}
          onRefresh={() => { setShowEnrollDrawer(false); if (onRefresh) onRefresh(); }}
        />
      )}

      {/* MODAL DE CONFIRMACION PARA DESVINCULAR */}
      <ConfirmModal
        isOpen={!!studentToUnenroll}
        title="Desvincular Alumno"
        message={`¿Estás seguro de que deseas desvincular a "${studentToUnenroll?.users_profile?.full_name}" de este programa?`}
        note="El alumno perderá el acceso a las clases, grabaciones y actividades de este curso."
        confirmText="Desvincular Alumno"
        cancelText="Cancelar"
        loading={unenrolling}
        onConfirm={handleConfirmUnenroll}
        onClose={() => setStudentToUnenroll(null)}
      />
    </div>
  );
}
