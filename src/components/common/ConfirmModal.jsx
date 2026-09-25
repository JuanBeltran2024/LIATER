import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2, X, Info } from 'lucide-react';

/**
 * ConfirmModal: Modal de confirmación estilizado para sustituir alert() / window.confirm()
 * Renderizado en document.body mediante React Portal.
 */
export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirmar Acción",
  message = "¿Estás seguro de que deseas realizar esta acción?",
  note,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  isDanger = true,
  loading = false
}) {
  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        animation: 'fadeIn 0.2s ease-out',
        padding: '1rem'
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '460px',
          background: '#ffffff',
          borderRadius: 'var(--radius-lg, 16px)',
          padding: '1.75rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
          position: 'relative',
          animation: 'fadeSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          border: '1px solid var(--border-color, #e2e8f0)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* BOTÓN CERRAR */}
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            background: 'none',
            border: 'none',
            color: 'var(--text-muted, #64748b)',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s'
          }}
        >
          <X size={20} />
        </button>

        {/* ENCABEZADO CON ICONO */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: isDanger ? '#fef2f2' : '#eff6ff',
              color: isDanger ? '#dc2626' : 'var(--navy, #14213d)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            {isDanger ? <Trash2 size={24} color="#dc2626" /> : <Info size={24} />}
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--navy, #14213d)', lineHeight: 1.3 }}>
              {title}
            </h3>
            <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.88rem', color: 'var(--text-secondary, #475569)', lineHeight: 1.45 }}>
              {message}
            </p>
          </div>
        </div>

        {/* NOTA O ADVERTENCIA EXTRA */}
        {note && (
          <div
            style={{
              background: isDanger ? '#fffbe6' : '#f8fafc',
              border: isDanger ? '1px solid #fde68a' : '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              marginBottom: '1.25rem',
              fontSize: '0.82rem',
              color: isDanger ? '#92400e' : '#334155',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.5rem'
            }}
          >
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px', color: isDanger ? '#d97706' : '#64748b' }} />
            <span>{note}</span>
          </div>
        )}

        {/* BOTONES DE ACCIÓN */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: note ? 0 : '1.25rem' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="btn btn-outline"
            style={{
              padding: '0.55rem 1.1rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              borderRadius: '8px'
            }}
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="btn"
            style={{
              padding: '0.55rem 1.15rem',
              fontSize: '0.85rem',
              fontWeight: 700,
              borderRadius: '8px',
              background: isDanger ? '#dc2626' : 'var(--navy, #14213d)',
              color: '#ffffff',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              boxShadow: isDanger ? '0 2px 4px rgba(220, 38, 38, 0.25)' : 'none',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'Procesando...' : confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

