import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Plus, Pencil, Trash2, X, Megaphone, Send } from 'lucide-react';
import { formatShortDate } from '@/utils/dateUtils';
import DeleteAnnouncementModal from '@/components/common/DeleteAnnouncementModal';
import '@/pages/admin/AdminPanel.css'; // Reusing admin styles

export default function Communications() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('announcements')
        .select('*, teacher_profiles(name), diploma_programs(title)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAnnouncements(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const handleEdit = (a) => {
    setSelectedAnnouncement(a);
    setShowModal(true);
  };

  const handleCreate = () => {
    setSelectedAnnouncement(null);
    setShowModal(true);
  };

  const handleDelete = (a) => {
    setConfirmDelete(a);
  };

  const handleConfirmDelete = async (id) => {
    const { error } = await supabase.from('announcements').delete().eq('id', id);
    if (error) throw error;
    fetchAnnouncements();
  };

  const getTargetLabel = (role, hasProgram) => {
    switch(role) {
      case 'student': return 'Solo Estudiantes';
      case 'teacher': return 'Solo Profesores';
      default: return hasProgram ? 'Todos en el Programa' : 'Toda la Institución';
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', animation: "fadeSlideUp 0.35s ease-out" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.75rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 900, color: "var(--navy)", margin: 0 }}>Comunicaciones</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.87rem", marginTop: "0.25rem" }}>Envía y administra anuncios globales o por programa.</p>
        </div>
        <button
          onClick={handleCreate}
          style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "var(--navy)", color: "white", border: "none", borderRadius: "10px", padding: "0.7rem 1.25rem", fontWeight: 700, fontSize: "0.9rem", cursor: "pointer", boxShadow: "0 4px 12px rgba(20,33,61,0.25)" }}
        >
          <Megaphone size={17} /> Nuevo Comunicado
        </button>
      </div>

      <div className="admin-table-wrapper" style={{ background: "white", borderRadius: "12px", border: "1px solid var(--border-color)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
        {loading ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando comunicaciones...</div>
        ) : announcements.length === 0 ? (
          <div style={{ padding: '4rem 2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Megaphone size={28} color="#94a3b8" />
            </div>
            <div>
              <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--navy)', fontSize: '1.1rem' }}>Aún no hay anuncios</h3>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '400px' }}>Mantén a la institución informada. Los anuncios globales y de programa que crees aparecerán aquí.</p>
            </div>
            <button onClick={handleCreate} style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "#f8fafc", color: "var(--navy)", border: "1px solid var(--border-color)", borderRadius: "8px", padding: "0.5rem 1rem", fontWeight: 600, fontSize: "0.85rem", cursor: "pointer", marginTop: '0.5rem' }}>
              <Plus size={15} /> Crear Comunicado
            </button>
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Título</th>
                <th>Publicado por</th>
                <th>Alcance</th>
                <th>Etiqueta</th>
                <th>Fecha</th>
                <th style={{ width: '100px', textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {announcements.map(a => (
                <tr key={a.id} style={{ transition: "background 0.15s" }}>
                  <td style={{ fontWeight: 600, color: 'var(--navy)' }}>{a.title}</td>
                  <td>{a.teacher_profiles?.name || 'Administración'}</td>
                  <td>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, background: '#f1f5f9', color: '#475569', padding: '0.25rem 0.6rem', borderRadius: '12px' }}>
                      {a.program_id ? a.diploma_programs?.title || 'Específico' : 'Global (Todos)'}
                    </span>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px', paddingLeft: '4px' }}>
                      {getTargetLabel(a.target_role, !!a.program_id)}
                    </div>
                  </td>
                  <td>
                    <span style={{
                      fontSize: '0.75rem', fontWeight: 700, padding: '0.25rem 0.6rem', borderRadius: '12px',
                      backgroundColor: (a.tag || 'general') === 'urgent' ? '#fee2e2' : (a.tag || 'general') === 'info' ? '#dbeafe' : '#f8fafc',
                      color: (a.tag || 'general') === 'urgent' ? '#dc2626' : (a.tag || 'general') === 'info' ? '#2563eb' : '#64748b',
                      border: '1px solid',
                      borderColor: (a.tag || 'general') === 'urgent' ? '#fca5a5' : (a.tag || 'general') === 'info' ? '#bfdbfe' : 'transparent'
                    }}>
                      {(a.tag || 'general').charAt(0).toUpperCase() + (a.tag || 'general').slice(1)}
                    </span>
                  </td>
                  <td style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{formatShortDate(a.created_at)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                      {!a.teacher_id && (
                        <button onClick={() => handleEdit(a)} title="Editar" style={{ display: "flex", alignItems: "center", gap: "0.25rem", padding: "0.3rem 0.65rem", background: "var(--navy)", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.75rem", fontWeight: 600 }}>
                          <Pencil size={12} /> Editar
                        </button>
                      )}
                      <button onClick={() => handleDelete(a)} title="Eliminar" style={{ padding: "0.3rem 0.6rem", background: "#fef2f2", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: "6px", cursor: "pointer", fontSize: "0.75rem", fontWeight: 700 }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <GlobalAnnouncementDrawer 
          announcement={selectedAnnouncement} 
          onClose={() => setShowModal(false)} 
          onRefresh={fetchAnnouncements}
        />
      )}

      {/* MODAL DE CONFIRMACIÓN DE ELIMINACIÓN */}
      <DeleteAnnouncementModal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        announcement={confirmDelete}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

function GlobalAnnouncementDrawer({ announcement, onClose, onRefresh }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tag, setTag] = useState('general');
  const [targetRole, setTargetRole] = useState('all');
  const [programId, setProgramId] = useState('');
  const [programs, setPrograms] = useState([]);
  const [sendEmail, setSendEmail] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadPrograms() {
      const { data } = await supabase.from('diploma_programs').select('id, title').eq('is_published', true);
      if (data) setPrograms(data);
    }
    loadPrograms();
  }, []);

  useEffect(() => {
    if (announcement) {
      setTitle(announcement.title || '');
      setBody(announcement.body || '');
      setTag(announcement.tag || 'general');
      setTargetRole(announcement.target_role || 'all');
      setProgramId(announcement.program_id || '');
    }
  }, [announcement]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || !body) {
      setError('El título y el mensaje son obligatorios.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        title,
        body,
        tag,
        target_role: targetRole,
        program_id: programId || null
      };

      let newAnnouncementId = null;

      if (announcement?.id) {
        const { error: updateErr } = await supabase.from('announcements').update(payload).eq('id', announcement.id);
        if (updateErr) throw updateErr;
        newAnnouncementId = announcement.id;
      } else {
        const { data, error: insertErr } = await supabase.from('announcements').insert([payload]).select().single();
        if (insertErr) throw insertErr;
        newAnnouncementId = data?.id;
      }

      if (sendEmail && newAnnouncementId) {
        // Trigger edge function (Optional, assumed it handles global announcements via target_role)
        const { error: funcErr } = await supabase.functions.invoke('send-announcement', {
          body: { announcement_id: newAnnouncementId }
        });
        if (funcErr) {
          console.error('Email send failed:', funcErr);
        }
      }

      onRefresh();
      onClose();
    } catch (err) {
      setError('Error al guardar anuncio: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 1000 }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: '480px', maxWidth: '95vw',
        background: 'white', zIndex: 1001, display: 'flex', flexDirection: 'column',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.15)', animation: 'slideInRight 0.3s ease-out'
      }}>
        <style>{`@keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
        
        {/* Header */}
        <div style={{ padding: '1.25rem 1.5rem', background: 'var(--navy)', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
              <Megaphone size={14} color="var(--gold)" />
              <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.55)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {announcement ? 'Editar Comunicado' : 'Nuevo Comunicado'}
              </span>
            </div>
            <h2 style={{ margin: 0, color: 'white', fontWeight: 800, fontSize: '1.05rem' }}>{title || 'Escribe un título...'}</h2>
          </div>
          <button onClick={onClose} style={{ color: 'rgba(255,255,255,0.65)', background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem' }}><X size={22} /></button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {error && <div style={{ color: '#b91c1c', background: '#fef2f2', padding: '0.6rem 0.8rem', borderRadius: '6px', fontSize: '0.84rem' }}>{error}</div>}
            
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '0.84rem' }}>Título del Comunicado</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '6px' }} required placeholder="Ej: Mantenimiento de la plataforma..." />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '0.84rem' }}>Importancia</label>
                <select value={tag} onChange={e => setTag(e.target.value)} style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                  <option value="general">General</option>
                  <option value="info">Informativo</option>
                  <option value="urgent">Urgente</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '0.84rem' }}>Alcance (Programa o Global)</label>
                <select value={programId} onChange={e => setProgramId(e.target.value)} style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                  <option value="">Global (Toda la Institución)</option>
                  {programs.map(p => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '0.84rem' }}>Audiencia (A quién va dirigido)</label>
                <select value={targetRole} onChange={e => setTargetRole(e.target.value)} style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                  <option value="all">Toda la Escuela</option>
                  <option value="student">Solo Estudiantes</option>
                  <option value="teacher">Solo Profesores</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '0.84rem' }}>Mensaje</label>
              <textarea value={body} onChange={e => setBody(e.target.value)} style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '6px', minHeight: '180px' }} required placeholder="Escribe aquí el contenido del anuncio..." />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <input type="checkbox" id="sendEmail" checked={sendEmail} onChange={e => setSendEmail(e.target.checked)} style={{ width: '1.2rem', height: '1.2rem', cursor: 'pointer' }} />
              <label htmlFor="sendEmail" style={{ fontSize: '0.85rem', color: 'var(--navy)', fontWeight: 600, cursor: 'pointer', margin: 0, display: 'flex', flexDirection: 'column' }}>
                Enviar notificación por correo electrónico
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400, marginTop: '2px' }}>Se notificará a todos los usuarios que formen parte de la audiencia seleccionada.</span>
              </label>
            </div>

            <button type="submit" disabled={submitting} style={{ padding: "0.75rem", marginTop: "0.5rem", borderRadius: "8px", border: "none", background: "var(--navy)", color: "white", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
              {submitting ? 'Publicando...' : announcement ? 'Guardar Cambios' : (
                <>
                  <Send size={15} /> Publicar Comunicado
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
