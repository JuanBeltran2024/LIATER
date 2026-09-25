import React, { useState } from 'react';
import { Trash2, X, AlertTriangle, Megaphone, Calendar, User } from 'lucide-react';
import { formatShortDate } from '@/utils/dateUtils';

export default function DeleteAnnouncementModal({ isOpen, onClose, announcement, onConfirm }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !announcement) return null;

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    setError('');
    try {
      await onConfirm(announcement.id);
      onClose();
    } catch (err) {
      console.error('Error al eliminar comunicado:', err);
      setError(err.message || 'No se pudo eliminar el comunicado.');
    } finally {
      setDeleting(false);
    }
  };

  const tag = announcement.tag || 'general';
  const tagColor = tag === 'urgent' 
    ? { bg: '#fee2e2', text: '#dc2626', border: '#fca5a5', label: 'Urgente' }
    : tag === 'info'
    ? { bg: '#dbeafe', text: '#2563eb', border: '#bfdbfe', label: 'Informativo' }
    : { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1', label: 'General' };

  const isGlobal = !announcement.program_id;
  const programTitle = announcement.diploma_programs?.title || (isGlobal ? 'Global (Toda la institución)' : 'Programa específico');
  const authorName = announcement.teacher_profiles?.name || 'Administración';

  return (
    <div 
      style={{ 
        position: 'fixed', 
        inset: 0, 
        background: 'rgba(15, 23, 42, 0.65)', 
        backdropFilter: 'blur(4px)', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        zIndex: 1300, 
        padding: '1rem' 
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !deleting) onClose();
      }}
    >
      <div 
        style={{ 
          width: '100%', 
          maxWidth: '480px', 
          background: 'white', 
          borderRadius: '16px', 
          overflow: 'hidden', 
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)', 
          animation: 'fadeSlideUp 0.25s ease-out' 
        }}
      >
        <style>{`
          @keyframes fadeSlideUp {
            from { opacity: 0; transform: translateY(12px) scale(0.98); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
        `}</style>

        {/* Header Premium con temática de alerta institucional */}
        <div 
          style={{ 
            background: 'linear-gradient(135deg, var(--navy, #14213d) 0%, #1e293b 100%)', 
            padding: '1.25rem 1.5rem', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            color: 'white', 
            borderBottom: '2px solid rgba(239, 68, 68, 0.4)' 
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div 
              style={{ 
                width: '38px', 
                height: '38px', 
                borderRadius: '10px', 
                background: 'rgba(239, 68, 68, 0.18)', 
                border: '1px solid rgba(239, 68, 68, 0.4)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}
            >
              <Trash2 size={19} color="#ef4444" />
            </div>
            <div>
              <div style={{ fontSize: '0.68rem', color: '#f87171', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Comunicaciones · LIATER
              </div>
              <h3 style={{ margin: 0, color: 'white', fontWeight: 800, fontSize: '1.05rem' }}>
                Eliminar Comunicado
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={deleting}
            style={{ 
              color: 'rgba(255,255,255,0.7)', 
              background: 'rgba(255,255,255,0.08)', 
              border: 'none', 
              borderRadius: '6px', 
              width: '30px', 
              height: '30px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              cursor: 'pointer', 
              transition: 'all 0.15s ease' 
            }}
            onMouseOver={e => e.currentTarget.style.color = 'white'}
            onMouseOut={e => e.currentTarget.style.color = 'rgba(255,255,255,0.7)'}
          >
            <X size={18} />
          </button>
        </div>

        {/* Cuerpo del Modal */}
        <div style={{ padding: '1.5rem' }}>
          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.84rem', marginBottom: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <AlertTriangle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {/* Tarjeta del Anuncio a Eliminar */}
          <div 
            style={{ 
              background: 'var(--cream, #F8FAFC)', 
              border: '1px solid var(--border-color, #E2E8F0)', 
              borderRadius: '12px', 
              padding: '1rem', 
              marginBottom: '1.25rem' 
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flex: 1, minWidth: 0 }}>
                <Megaphone size={16} color="var(--navy)" style={{ flexShrink: 0 }} />
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {announcement.title}
                </h4>
              </div>
              <span 
                style={{ 
                  fontSize: '0.72rem', 
                  fontWeight: 700, 
                  padding: '0.2rem 0.55rem', 
                  borderRadius: '999px', 
                  background: tagColor.bg, 
                  color: tagColor.text, 
                  border: `1px solid ${tagColor.border}`,
                  whiteSpace: 'nowrap'
                }}
              >
                {tagColor.label}
              </span>
            </div>

            {announcement.body && (
              <p 
                style={{ 
                  margin: '0 0 0.75rem 0', 
                  fontSize: '0.82rem', 
                  color: 'var(--text-secondary, #475569)', 
                  display: '-webkit-box', 
                  WebkitLineClamp: 2, 
                  WebkitBoxOrient: 'vertical', 
                  overflow: 'hidden', 
                  lineHeight: '1.35' 
                }}
              >
                {announcement.body}
              </p>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', fontSize: '0.76rem', color: 'var(--text-muted, #64748b)', paddingTop: '0.5rem', borderTop: '1px dashed #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <User size={13} /> {authorName}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Calendar size={13} /> {formatShortDate(announcement.created_at)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginLeft: 'auto', fontWeight: 600, color: 'var(--navy)' }}>
                {programTitle}
              </div>
            </div>
          </div>

          {/* Bloque de Advertencia */}
          <div 
            style={{ 
              background: '#fff1f2', 
              border: '1px solid #ffe4e6', 
              borderRadius: '10px', 
              padding: '0.9rem 1rem', 
              display: 'flex', 
              alignItems: 'flex-start', 
              gap: '0.65rem', 
              marginBottom: '1.5rem' 
            }}
          >
            <AlertTriangle size={17} color="#e11d48" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '0.83rem', color: '#9f1239', lineHeight: '1.4' }}>
              <strong>Esta acción no se puede deshacer.</strong> El comunicado será eliminado permanentemente y dejará de estar visible para la comunidad.
            </div>
          </div>

          {/* Botones de Acción */}
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={deleting}
              style={{
                padding: '0.65rem 1.25rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color, #cbd5e1)',
                background: '#f8fafc',
                color: 'var(--text-secondary, #334155)',
                fontWeight: 600,
                fontSize: '0.88rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseOver={e => e.currentTarget.style.background = '#e2e8f0'}
              onMouseOut={e => e.currentTarget.style.background = '#f8fafc'}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              style={{
                padding: '0.65rem 1.35rem',
                borderRadius: '8px',
                border: 'none',
                background: '#dc2626',
                color: 'white',
                fontWeight: 700,
                fontSize: '0.88rem',
                cursor: deleting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                boxShadow: '0 2px 8px rgba(220, 38, 38, 0.3)',
                transition: 'all 0.15s ease',
                opacity: deleting ? 0.75 : 1
              }}
              onMouseOver={e => !deleting && (e.currentTarget.style.background = '#b91c1c')}
              onMouseOut={e => !deleting && (e.currentTarget.style.background = '#dc2626')}
            >
              <Trash2 size={16} />
              {deleting ? 'Eliminando...' : 'Eliminar Anuncio'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
