import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { X, CheckCircle, Plus, Trash2, GraduationCap, MapPin, Phone, Eye, UserPlus, Search, Users, AlertCircle } from 'lucide-react';
import { ConfirmModal } from './AdminShared';
import { Link } from 'react-router-dom';

// Helper to safely parse JSON from the bio field if it exists
const parseTeacherMeta = (teacher) => {
  let meta = { 
    bio: teacher.bio || 'Sin biografía proporcionada.', 
    role: teacher.area || 'Profesor', 
    phone: '', 
    country: '', 
    experience: '' 
  };
  
  try {
    if (teacher.bio && typeof teacher.bio === 'string' && teacher.bio.trim().startsWith('{')) {
      const parsed = JSON.parse(teacher.bio);
      if (parsed.bio) meta.bio = parsed.bio;
      if (parsed.title_role) meta.role = parsed.title_role;
      if (parsed.phone) meta.phone = parsed.phone;
      if (parsed.country) meta.country = parsed.country;
      if (parsed.experience) meta.experience = parsed.experience;
    }
  } catch (e) {
    // Ignore JSON parse error, fallback to raw string
  }
  return meta;
};

const getInitials = (name) => {
  const parts = (name || '').trim().split(' ');
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'PR';
};

/* ────────────────────────────────────
   DRAWER — Asignar Profesor
──────────────────────────────────── */
export function AssignTeacherDrawer({ programId, programTitle, assignedTeachers, onClose, onRefresh }) {
  const [allTeachers, setAllTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [assigning, setAssigning] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');

  const assignedUserIds = new Set(assignedTeachers.map(t => t.user_id));

  useEffect(() => {
    async function fetchTeachers() {
      try {
        const { data, error } = await supabase
          .from('teacher_profiles')
          .select('*')
          .order('name', { ascending: true });
        if (error) throw error;
        setAllTeachers(data || []);
      } catch (err) {
        console.error('Error cargando profesores:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchTeachers();
  }, []);

  const unassigned = allTeachers.filter(t => !assignedUserIds.has(t.user_id));
  const filtered = unassigned.filter(t => {
    const term = searchTerm.toLowerCase();
    const meta = parseTeacherMeta(t);
    return t.name?.toLowerCase().includes(term) || meta.role.toLowerCase().includes(term);
  });

  const handleAssign = async (teacher) => {
    setAssigning(teacher.id);
    setSuccessMsg('');
    try {
      const { error } = await supabase.from('enrollments').insert([{
        student_id: teacher.user_id,
        program_id: programId,
      }]);
      if (error) throw error;
      setSuccessMsg(`✓ Profesor ${teacher.name} asignado correctamente.`);
      setAllTeachers(prev => prev.filter(t => t.id !== teacher.id));
      if (onRefresh) onRefresh();
    } catch (err) {
      alert('Error al asignar profesor: ' + err.message);
    } finally {
      setAssigning(null);
    }
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
        
        {/* Header */}
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
                Asignar Profesor
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

        {/* Content */}
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
              placeholder="Buscar profesor por nombre o especialidad..."
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
                <span style={{ fontSize: '0.85rem' }}>Cargando profesores...</span>
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem 1.5rem', background: '#F8FAFC', borderRadius: '12px', border: '1px dashed #CBD5E1' }}>
                <GraduationCap size={32} color="#94A3B8" style={{ margin: '0 auto 0.65rem' }} />
                <p style={{ color: '#475569', margin: 0, fontSize: '0.86rem', fontWeight: 600 }}>
                  {unassigned.length === 0
                    ? 'Todos los profesores registrados ya están asignados a este programa.'
                    : 'No se encontraron profesores con ese término de búsqueda.'}
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {filtered.map(teacher => {
                  const meta = parseTeacherMeta(teacher);
                  return (
                    <div 
                      key={teacher.id} 
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
                        {teacher.photo || teacher.photo_url ? (
                          <img src={teacher.photo || teacher.photo_url} alt={teacher.name} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                        ) : (
                          <div style={{
                            width: '36px', height: '36px', borderRadius: '50%',
                            background: 'var(--navy, #14213D)', color: 'var(--gold, #FCA311)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.75rem', fontWeight: 700, flexShrink: 0
                          }}>
                            {getInitials(teacher.name)}
                          </div>
                        )}
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--navy, #14213D)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {teacher.name}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {meta.role}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAssign(teacher)}
                        disabled={assigning === teacher.id}
                        style={{
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          padding: '0.45rem 0.85rem',
                          background: 'var(--navy, #14213D)',
                          color: '#FFFFFF',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: assigning === teacher.id ? 'not-allowed' : 'pointer',
                          whiteSpace: 'nowrap',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          transition: 'background 0.15s ease'
                        }}
                        onMouseOver={e => { if (assigning !== teacher.id) e.currentTarget.style.background = '#000000'; }}
                        onMouseOut={e => { if (assigning !== teacher.id) e.currentTarget.style.background = 'var(--navy, #14213D)'; }}
                      >
                        <Plus size={14} /> {assigning === teacher.id ? 'Asignando...' : 'Asignar'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// Helper to check invitation expiry
function isInviteExpired(user) {
  if (!user || user.is_active) return false;
  if (!user.confirmation_sent_at && !user.created_at) return false;
  const sentDate = new Date(user.confirmation_sent_at || user.created_at);
  const diffHours = (Date.now() - sentDate.getTime()) / (1000 * 60 * 60);
  return diffHours >= 24;
}

function getInviteHoursRemaining(user) {
  if (!user || user.is_active) return null;
  const sentDate = new Date(user.confirmation_sent_at || user.created_at);
  const expiryTime = sentDate.getTime() + 24 * 60 * 60 * 1000;
  const remainingMs = expiryTime - Date.now();
  if (remainingMs <= 0) return null;
  const hours = Math.floor(remainingMs / (1000 * 60 * 60));
  const mins = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `~${hours}h restantes`;
  return `${mins}m restantes`;
}

function AuthStatusBadge({ user }) {
  if (user) {
    let finalStatus = "active";
    let customLabel = null;

    if (user.is_active) {
      finalStatus = "active";
    } else if (user.is_active === false) {
      const expired = isInviteExpired(user);
      if (expired) {
        finalStatus = "expired";
      } else {
        finalStatus = "pending";
        const rem = getInviteHoursRemaining(user);
        if (rem) customLabel = `Invitación (${rem})`;
      }
    }

    const map = {
      active:   { bg: "#d1fae5", color: "#065f46", border: "#86efac", label: "Activo" },
      pending:  { bg: "#fef3c7", color: "#92400e", border: "#fde68a", label: customLabel || "Invitación Vigente" },
      expired:  { bg: "#fee2e2", color: "#991b1b", border: "#fca5a5", label: "Invitación Expirada" },
      inactive: { bg: "#f1f5f9", color: "#64748b", border: "#cbd5e1", label: "Inactivo" },
    };
    const s = map[finalStatus] || map.active;
    return (
      <span style={{
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
        fontSize: "0.74rem",
        fontWeight: 700,
        padding: "0.25rem 0.65rem",
        borderRadius: "20px",
        whiteSpace: "nowrap",
        display: "inline-flex",
        alignItems: "center",
        gap: "0.35rem"
      }}>
        <span style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: finalStatus === "expired" ? "#dc2626" : finalStatus === "pending" ? "#d97706" : finalStatus === "active" ? "#16a34a" : "#64748b",
          display: "inline-block"
        }} />
        {s.label}
      </span>
    );
  }

  return (
    <span style={{
      background: "#d1fae5",
      color: "#065f46",
      border: "1px solid #86efac",
      fontSize: "0.74rem",
      fontWeight: 700,
      padding: "0.25rem 0.65rem",
      borderRadius: "20px",
      whiteSpace: "nowrap",
      display: "inline-flex",
      alignItems: "center",
      gap: "0.35rem"
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#16a34a", display: "inline-block" }} />
      Activo
    </span>
  );
}

/* ────────────────────────────────────────────────────────
   TAB PRINCIPAL — Profesores (Supabase)
──────────────────────────────────────────────────────── */
export default function ProfesoresTab({ teachers = [], loading, onRefresh, programId, programTitle }) {
  const [showAssignDrawer, setShowAssignDrawer] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [teacherToUnassign, setTeacherToUnassign] = useState(null);
  const [unassigning, setUnassigning] = useState(false);

  const filteredTeachers = teachers.filter(t => {
    const term = searchTerm.toLowerCase();
    const meta = parseTeacherMeta(t);
    return t.name?.toLowerCase().includes(term) || meta.role.toLowerCase().includes(term);
  });

  const handleConfirmUnassignTeacher = async () => {
    if (!teacherToUnassign) return;
    setUnassigning(true);
    try {
      const { error } = await supabase
        .from('enrollments')
        .delete()
        .eq('program_id', programId)
        .eq('student_id', teacherToUnassign.user_id);

      if (error) throw error;
      setTeacherToUnassign(null);
      if (onRefresh) onRefresh();
    } catch (err) {
      alert('Error al desvincular profesor: ' + err.message);
    } finally {
      setUnassigning(false);
    }
  };

  return (
    <div style={{ animation: 'fadeSlideUp 0.35s ease-out' }}>
      
      {/* HEADER SECTION */}
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
              Profesores del Programa
            </h2>
            <span style={{
              background: 'rgba(20, 33, 61, 0.08)',
              color: 'var(--navy, #14213D)',
              fontSize: '0.78rem',
              fontWeight: 800,
              padding: '2px 9px',
              borderRadius: '12px'
            }}>
              {filteredTeachers.length}
            </span>
          </div>
          <p style={{ color: '#64748B', fontSize: '0.84rem', margin: '4px 0 0 0' }}>
            Directorio de docentes y facilitadores vinculados a este programa.
          </p>
        </div>

        {/* BARRA DE ACCIONES */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* BUSCADOR */}
          <div style={{ position: 'relative', minWidth: '260px' }}>
            <Search size={15} color="#94A3B8" style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Buscar por nombre o rol..."
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

          {/* BOTON ASIGNAR */}
          <button
            type="button"
            onClick={() => setShowAssignDrawer(true)}
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
            <Plus size={16} /> Asignar Profesor
          </button>
        </div>
      </div>

      {/* TABLA DE PROFESORES */}
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
          <colgroup>
            <col style={{ width: '30%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '12%' }} />
          </colgroup>

          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              <th style={{ padding: '0.9rem 1.25rem', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#475569' }}>
                Profesor
              </th>
              <th style={{ padding: '0.9rem 1.25rem', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#475569' }}>
                Especialidad / Rol
              </th>
              <th style={{ padding: '0.9rem 1.25rem', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#475569' }}>
                Estado
              </th>
              <th style={{ padding: '0.9rem 1.25rem', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#475569' }}>
                Contacto
              </th>
              <th style={{ padding: '0.9rem 1.25rem', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#475569', textAlign: 'right' }}>
                Acciones
              </th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ padding: '3.5rem 1.5rem', textAlign: 'center', color: '#64748B' }}>
                  <div style={{ width: '28px', height: '28px', border: '3px solid #E2E8F0', borderTopColor: 'var(--gold, #FCA311)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 0.75rem' }} />
                  <span style={{ fontSize: '0.85rem' }}>Cargando profesores...</span>
                </td>
              </tr>
            ) : filteredTeachers.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '3.5rem 1.5rem', textAlign: 'center', color: '#64748B' }}>
                  <GraduationCap size={36} color="#CBD5E1" style={{ margin: '0 auto 0.75rem' }} />
                  <div style={{ fontWeight: 700, color: 'var(--navy, #14213D)', fontSize: '0.95rem', marginBottom: '0.25rem' }}>
                    {searchTerm ? 'No se encontraron profesores' : 'No hay profesores asignados'}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#64748B', maxWidth: '380px', margin: '0 auto' }}>
                    {searchTerm 
                      ? 'Prueba con otro término de búsqueda.' 
                      : 'Asigna profesores a este programa usando el botón "+ Asignar Profesor".'}
                  </div>
                </td>
              </tr>
            ) : (
              filteredTeachers.map((t, idx) => {
                const meta = parseTeacherMeta(t);
                const isLast = idx === filteredTeachers.length - 1;

                return (
                  <tr 
                    key={t.id} 
                    style={{
                      borderBottom: isLast ? 'none' : '1px solid #F1F5F9',
                      transition: 'background 0.15s ease'
                    }}
                    onMouseOver={e => e.currentTarget.style.background = '#F8FAFC'}
                    onMouseOut={e => e.currentTarget.style.background = '#FFFFFF'}
                  >
                    {/* PROFESOR */}
                    <td style={{ padding: '1rem 1.25rem', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                        {t.photo || t.photo_url ? (
                          <img src={t.photo || t.photo_url} alt={t.name} style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }} />
                        ) : (
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
                            {getInitials(t.name)}
                          </div>
                        )}
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--navy, #14213D)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {t.name || 'Sin nombre'}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {meta.bio}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* ESPECIALIDAD / ROL */}
                    <td style={{ padding: '1rem 1.25rem', verticalAlign: 'middle' }}>
                      <span style={{ 
                        fontSize: '0.84rem', 
                        color: 'var(--navy, #14213D)', 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '0.45rem', 
                        fontWeight: 600,
                        background: '#EFF6FF',
                        border: '1px solid #BFDBFE',
                        padding: '0.25rem 0.65rem',
                        borderRadius: '8px'
                      }}>
                        <GraduationCap size={14} color="var(--gold, #FCA311)" /> {meta.role}
                      </span>
                    </td>

                    {/* ESTADO */}
                    <td style={{ padding: '1rem 1.25rem', verticalAlign: 'middle' }}>
                      <AuthStatusBadge user={t.users_profile} />
                    </td>

                    {/* CONTACTO */}
                    <td style={{ padding: '1rem 1.25rem', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        {meta.country && (
                          <span style={{ fontSize: '0.78rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <MapPin size={12} color="#64748B" /> {meta.country}
                          </span>
                        )}
                        {meta.phone && (
                          <span style={{ fontSize: '0.78rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <Phone size={12} color="#64748B" /> {meta.phone}
                          </span>
                        )}
                        {!meta.country && !meta.phone && (
                          <span style={{ fontSize: '0.78rem', color: '#94A3B8' }}>No registrado</span>
                        )}
                      </div>
                    </td>

                    {/* ACCIONES */}
                    <td style={{ padding: '1rem 1.25rem', verticalAlign: 'middle', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.45rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <Link
                          to={`/users`}
                          title="Ver perfil completo en Gestión Global"
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
                          onClick={() => setTeacherToUnassign(t)}
                          title="Desvincular profesor del programa"
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

      {/* DRAWER ASIGNAR */}
      {showAssignDrawer && (
        <AssignTeacherDrawer
          programId={programId}
          programTitle={programTitle}
          assignedTeachers={teachers}
          onClose={() => setShowAssignDrawer(false)}
          onRefresh={() => { setShowAssignDrawer(false); if (onRefresh) onRefresh(); }}
        />
      )}

      {/* CONFIRMAR DESVINCULACION */}
      <ConfirmModal
        isOpen={!!teacherToUnassign}
        title="Desvincular Profesor"
        message={`¿Estás seguro de que deseas desvincular al profesor "${teacherToUnassign?.name}" de este programa?`}
        note="El profesor ya no podrá gestionar las clases ni actividades de este programa."
        confirmText="Desvincular Profesor"
        cancelText="Cancelar"
        loading={unassigning}
        onConfirm={handleConfirmUnassignTeacher}
        onClose={() => setTeacherToUnassign(null)}
      />
    </div>
  );
}
