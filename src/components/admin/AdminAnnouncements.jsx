import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Plus, Pencil, Trash2, X, Megaphone } from 'lucide-react';
import { RoleBadge, StatusBadge, TypeBadge, Initials, ActionBtns, LoadingRow, EmptyRow, ConfirmModal } from './AdminShared';
import { toLocalDatetimeString, parseLocalDatetime, formatShortDate } from '@/utils/dateUtils';
import DeleteAnnouncementModal from '@/components/common/DeleteAnnouncementModal';

export default function AnunciosTab({ programId }) {
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
        .select('*, teacher_profiles(name)')
        .eq('program_id', programId)
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

  return (
    <div>
      <div className="admin-table-header">
        <h2 className="admin-table-title">Todos los Anuncios ({announcements.length})</h2>
        <button onClick={handleCreate} className="btn btn-primary" style={{ padding: '0.5rem 1rem' }}>
          <Plus size={16} style={{ marginRight: '0.25rem' }} /> Nuevo Anuncio
        </button>
      </div>

      <div className="admin-table-wrapper">
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando anuncios...</div>
        ) : announcements.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No hay anuncios publicados.</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Título</th>
                <th>Publicado por</th>
                <th>Etiqueta</th>
                <th>Alcance</th>
                <th>Fecha</th>
                <th style={{ width: '100px', textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {announcements.map(a => (
                <tr key={a.id}>
                  <td style={{ fontWeight: 500 }}>{a.title}</td>
                  <td>{a.teacher_profiles?.name || 'Administración'}</td>
                  <td>
                    <span className={`role-badge`} style={{
                      backgroundColor: a.tag === 'urgent' ? '#fee2e2' : a.tag === 'info' ? '#dbeafe' : '#f1f5f9',
                      color: a.tag === 'urgent' ? '#dc2626' : a.tag === 'info' ? '#2563eb' : '#64748b'
                    }}>
                      {a.tag}
                    </span>
                  </td>
                  <td>
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                      backgroundColor: a.target_role === 'student' ? '#f3e8ff' : a.target_role === 'teacher' ? '#ffedd5' : '#e2e8f0',
                      color: a.target_role === 'student' ? '#7e22ce' : a.target_role === 'teacher' ? '#c2410c' : '#475569',
                      whiteSpace: 'nowrap'
                    }}>
                      {a.target_role === 'student' ? 'Estudiantes' : a.target_role === 'teacher' ? 'Profesores' : 'Todos'}
                    </span>
                  </td>
                  <td>{formatShortDate(a.created_at)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      {!a.teacher_id && (
                        <button onClick={() => handleEdit(a)} className="action-btn" title="Editar"><Pencil size={15} /></button>
                      )}
                      <button onClick={() => handleDelete(a)} className="action-btn action-delete" title="Eliminar"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <AnnouncementDrawer 
          announcement={selectedAnnouncement} 
          onClose={() => setShowModal(false)} 
          onRefresh={fetchAnnouncements}
          programId={programId}
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

// --- ANNOUNCEMENT DRAWER ---
function AnnouncementDrawer({ announcement, onClose, onRefresh, programId }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tag, setTag] = useState('general');
  const [targetRole, setTargetRole] = useState('all');
  const [sendEmail, setSendEmail] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (announcement) {
      setTitle(announcement.title || '');
      setBody(announcement.body || '');
      setTag(announcement.tag || 'general');
      setTargetRole(announcement.target_role || 'all');
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
        program_id: programId
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
        // Trigger edge function
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
        position: 'fixed', top: 0, right: 0, bottom: 0, width: '450px', maxWidth: '90vw',
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
                {announcement ? 'Editar Anuncio' : 'Nuevo Anuncio'}
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
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '0.84rem' }}>Título del Anuncio</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '6px' }} required placeholder="Ej: Clase de hoy cancelada..." />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '0.84rem' }}>Etiqueta (Nivel de Importancia)</label>
              <select value={tag} onChange={e => setTag(e.target.value)} style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                <option value="general">General</option>
                <option value="info">Informativo</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '0.84rem' }}>Audiencia (Para quién es este anuncio)</label>
              <select value={targetRole} onChange={e => setTargetRole(e.target.value)} style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                <option value="all">Todos los participantes del programa</option>
                <option value="student">Solo Estudiantes del programa</option>
                <option value="teacher">Solo Profesores del programa</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '0.84rem' }}>Mensaje</label>
              <textarea value={body} onChange={e => setBody(e.target.value)} style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '6px', minHeight: '150px' }} required placeholder="Escribe aquí el contenido del anuncio..." />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <input type="checkbox" id="sendEmail" checked={sendEmail} onChange={e => setSendEmail(e.target.checked)} style={{ width: '1.2rem', height: '1.2rem' }} />
              <label htmlFor="sendEmail" style={{ fontSize: '0.85rem', color: 'var(--navy)', fontWeight: 600, cursor: 'pointer', margin: 0, display: 'flex', flexDirection: 'column' }}>
                Enviar notificación por correo electrónico
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400, marginTop: '2px' }}>Notificará a los estudiantes correspondientes.</span>
              </label>
            </div>

            <button type="submit" disabled={submitting} className="btn btn-primary" style={{ padding: '0.75rem', marginTop: '1rem' }}>
              {submitting ? 'Guardando...' : announcement ? 'Guardar Cambios' : 'Publicar Anuncio'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}