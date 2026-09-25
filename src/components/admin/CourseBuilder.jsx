import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { 
  Plus, Pencil, Trash2, ChevronDown, ChevronRight, 
  Video, Clock, X, Zap, FileText, Link2, Eye
} from 'lucide-react';
import { ConfirmModal, ActionBtns } from './AdminShared';
import { toLocalDatetimeString, parseLocalDatetime, formatShortDate } from '@/utils/dateUtils';
import AdminClassReinforcement from '@/components/admin/AdminClassReinforcement';
import TimePicker24h from '@/components/common/TimePicker24h';

// --- MODULE MODAL ---
function ModuleModal({ isOpen, onClose, onRefresh, programId, initialData, modules = [] }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [orderIndex, setOrderIndex] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setTitle(initialData?.title || '');
      setDescription(initialData?.description || '');
      setOrderIndex(initialData?.order_index || 1);
      setError('');
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!title || !programId) { setError('El titulo y el programa son obligatorios.'); return; }
    const parsedOrder = parseInt(orderIndex) || 0;
    if (modules.some(m => m.order_index === parsedOrder && m.id !== initialData?.id)) {
      setError(`Ya existe un modulo con el orden ${parsedOrder}.`);
      return;
    }
    setSubmitting(true);
    try {
      const payload = { title, description, order_index: parsedOrder, program_id: programId, diploma_id: programId };
      let query = initialData?.id
        ? supabase.from('modules').update(payload).eq('id', initialData.id)
        : supabase.from('modules').insert([payload]);
      const { error: opError } = await query;
      if (opError) throw opError;
      onRefresh(); onClose();
    } catch (err) { setError('Error al guardar modulo: ' + err.message); }
    finally { setSubmitting(false); }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div className="card" style={{ width: '100%', maxWidth: '450px', background: 'white', padding: '2rem', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
        <h3 style={{ marginBottom: '1.5rem', fontWeight: 700 }}>{initialData?.id ? 'Editar Modulo' : 'Crear Modulo'}</h3>
        {error && <div style={{ color: 'red', marginBottom: '1rem', fontSize: '0.85rem' }}>{error}</div>}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '0.85rem' }}>Titulo</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-color)', borderRadius: '4px' }} required />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '0.85rem' }}>Orden</label>
            <input type="number" value={orderIndex} onChange={e => setOrderIndex(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-color)', borderRadius: '4px' }} required />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '0.85rem' }}>Descripcion (opcional)</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-color)', borderRadius: '4px', minHeight: '80px' }} />
          </div>
          <button type="submit" disabled={submitting} className="btn btn-primary" style={{ marginTop: '1rem', width: '100%' }}>
            {submitting ? 'Guardando...' : 'Guardar Modulo'}
          </button>
        </form>
      </div>
    </div>
  );
}

// --- SESSION MODAL ---
function SessionModal({ isOpen, onClose, onRefresh, programId, initialData, modules = [], isCourse }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [orderIndex, setOrderIndex] = useState(1);
  const [moduleId, setModuleId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setTitle(initialData?.title || '');
      setDescription(initialData?.description || '');
      setOrderIndex(initialData?.order_index || 1);
      setModuleId(initialData?.module_id || (modules.length > 0 ? modules[0].id : ''));
      setError('');
    }
  }, [isOpen, initialData, modules]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!title || (!isCourse && !moduleId)) {
      setError(isCourse ? 'El titulo es obligatorio.' : 'El titulo y el modulo son obligatorios.');
      return;
    }
    setSubmitting(true);
    try {
      const effectiveModuleId = isCourse ? (moduleId || modules[0]?.id) : moduleId;
      const payload = { title, description, order_index: parseInt(orderIndex) || 0, program_id: programId };
      if (effectiveModuleId) payload.module_id = effectiveModuleId;
      if (initialData?.id) {
        const { error: e1 } = await supabase.from('sessions').update(payload).eq('id', initialData.id);
        if (e1) await supabase.from('subtopics').update(payload).eq('id', initialData.id);
      } else {
        const { error: e2 } = await supabase.from('sessions').insert([payload]);
        if (e2) await supabase.from('subtopics').insert([payload]);
      }
      onRefresh(); onClose();
    } catch (err) { setError('Error al guardar sesion: ' + err.message); }
    finally { setSubmitting(false); }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div className="card" style={{ width: '100%', maxWidth: '450px', background: 'white', padding: '2rem', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
        <h3 style={{ marginBottom: '1.5rem', fontWeight: 700 }}>{initialData?.id ? 'Editar Sesion' : 'Crear Sesion'}</h3>
        {error && <div style={{ color: 'red', marginBottom: '1rem', fontSize: '0.85rem' }}>{error}</div>}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '0.85rem' }}>Titulo</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-color)', borderRadius: '4px' }} required />
          </div>
          {!isCourse && (
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '0.85rem' }}>Modulo Asociado</label>
              <select value={moduleId} onChange={e => setModuleId(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
                {modules.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
              </select>
            </div>
          )}
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '0.85rem' }}>Orden</label>
            <input type="number" value={orderIndex} onChange={e => setOrderIndex(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-color)', borderRadius: '4px' }} required />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '0.85rem' }}>Descripcion</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-color)', borderRadius: '4px', minHeight: '80px' }} />
          </div>
          <button type="submit" disabled={submitting} className="btn btn-primary" style={{ marginTop: '1rem', width: '100%' }}>
            {submitting ? 'Guardando...' : 'Guardar Sesion'}
          </button>
        </form>
      </div>
    </div>
  );
}

// --- CLASS CREATE MODAL ---
function ClassCreateModal({ isOpen, onClose, onRefresh, programId, initialSessionId, sessions = [], teachers = [] }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [classDate, setClassDate] = useState('');
  const [duration, setDuration] = useState('');
  const [orderIndex, setOrderIndex] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setTitle(''); setDescription('');
      setSessionId(initialSessionId || sessions[0]?.id || '');
      setTeacherId(teachers[0]?.id || '');
      setClassDate(toLocalDatetimeString(new Date().toISOString()));
      setDuration(''); setOrderIndex(1); setError('');
    }
  }, [isOpen, initialSessionId, sessions, teachers]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!title || !sessionId || !teacherId) { setError('El titulo, sesion y profesor son obligatorios.'); return; }
    setSubmitting(true);
    try {
      const payload = {
        title, description, teacher_id: teacherId,
        class_date: parseLocalDatetime(classDate),
        duration: duration ? parseInt(duration) : null,
        order_index: parseInt(orderIndex) || 1, program_id: programId,
        subtopic_id: sessionId
      };
      const { error: err } = await supabase.from('class_sessions').insert([payload]);
      if (err) throw err;
      onRefresh(); onClose();
    } catch (err) {
      if (err.message?.includes('class_sessions_drive_folder_id_unique')) {
        setError('Esa carpeta de Google Drive ya está vinculada a otra clase. Cada clase debe tener su propia subcarpeta única en Google Drive o puedes dejarla en blanco.');
      } else {
        setError('Error al crear clase: ' + err.message);
      }
    }
    finally { setSubmitting(false); }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ width: '100%', maxWidth: '480px', background: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--navy)' }}>
          <h3 style={{ margin: 0, fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Video size={18} color="var(--gold)" /> Nueva Clase
          </h3>
          <button onClick={onClose} style={{ color: 'rgba(255,255,255,0.7)', background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {error && <div style={{ color: 'red', fontSize: '0.85rem', padding: '0.5rem', background: '#fef2f2', borderRadius: '4px' }}>{error}</div>}
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '0.85rem' }}>Titulo</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '4px' }} required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '0.85rem' }}>Sesion</label>
              <select value={sessionId} onChange={e => setSessionId(e.target.value)} style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
                {sessions.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '0.85rem' }}>Profesor</label>
              <select value={teacherId} onChange={e => setTeacherId(e.target.value)} style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
                {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 0.9fr 0.9fr', gap: '0.85rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '0.85rem' }}>Fecha</label>
              <input
                type="date"
                value={classDate ? classDate.split('T')[0] : ''}
                onChange={e => {
                  const time = classDate && classDate.includes('T') ? classDate.split('T')[1]?.substring(0, 5) : '18:00';
                  setClassDate(`${e.target.value}T${time}`);
                }}
                style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '4px' }}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '0.85rem' }}>Hora (24 hrs)</label>
              <TimePicker24h
                value={classDate && classDate.includes('T') ? classDate.split('T')[1]?.substring(0, 5) : '18:00'}
                onChange={newTime => {
                  const date = classDate ? classDate.split('T')[0] : new Date().toISOString().split('T')[0];
                  setClassDate(`${date}T${newTime}`);
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '0.85rem' }}>Dur. (min)</label>
              <input type="number" value={duration} onChange={e => setDuration(e.target.value)} style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '0.85rem' }}>Orden</label>
              <input type="number" value={orderIndex} onChange={e => setOrderIndex(e.target.value)} style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '4px' }} required />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '0.85rem' }}>Descripcion</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '4px', minHeight: '60px' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.5rem' }}>
            <button type="button" onClick={onClose} className="btn">Cancelar</button>
            <button type="submit" disabled={submitting} className="btn btn-primary">{submitting ? 'Creando...' : 'Crear Clase'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- CLASS EDIT DRAWER (3 tabs: General, Recursos, Actividad IA) ---
function ClassEditDrawer({ isOpen, onClose, onRefresh, programId, classData, sessions = [], teachers = [] }) {
  const [activeTab, setActiveTab] = useState('general');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [classDate, setClassDate] = useState('');
  const [duration, setDuration] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [presentationUrl, setPresentationUrl] = useState('');
  const [driveFolderId, setDriveFolderId] = useState('');
  const [orderIndex, setOrderIndex] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (isOpen && classData) {
      setTitle(classData.title || '');
      setDescription(classData.description || '');
      setSessionId(classData.session_id || classData.subtopic_id || sessions[0]?.id || '');
      setTeacherId(classData.teacher_id || teachers[0]?.id || '');
      setClassDate(classData.class_date ? toLocalDatetimeString(classData.class_date) : toLocalDatetimeString(new Date().toISOString()));
      setDuration(classData.duration || '');
      setVideoUrl(classData.video_url || '');
      setPresentationUrl(classData.presentation_url || '');
      setDriveFolderId(classData.drive_folder_id || '');
      setOrderIndex(classData.order_index || 1);
      setActiveTab('general');
      setError(''); setSuccess('');
    }
  }, [isOpen, classData]);

  if (!isOpen || !classData) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!title || !sessionId || !teacherId) { setError('El titulo, sesion y profesor son obligatorios.'); return; }
    setSubmitting(true);
    try {
      const payload = {
        title, description, teacher_id: teacherId,
        class_date: parseLocalDatetime(classDate),
        duration: duration ? parseInt(duration) : null,
        video_url: videoUrl || null, presentation_url: presentationUrl || null,
        drive_folder_id: driveFolderId.trim() || null,
        order_index: parseInt(orderIndex) || 1, program_id: programId,
        subtopic_id: sessionId
      };
      const { error: err } = await supabase.from('class_sessions').update(payload).eq('id', classData.id);
      if (err) throw err;
      setSuccess('Clase actualizada correctamente.');
      setTimeout(() => setSuccess(''), 2500);
      onRefresh();
    } catch (err) {
      if (err.message?.includes('class_sessions_drive_folder_id_unique')) {
        setError('Esa carpeta de Google Drive ya está vinculada a otra clase. Cada clase debe tener su propia subcarpeta única en Google Drive o puedes dejarla en blanco.');
      } else {
        setError('Error al guardar: ' + err.message);
      }
    }
    finally { setSubmitting(false); }
  };

  const TABS = [
    { id: 'general', label: 'General', icon: FileText },
    { id: 'recursos', label: 'Recursos y Grabacion', icon: Link2 },
    { id: 'actividad', label: 'Actividad IA', icon: Zap },
  ];

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 1000 }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: '620px', maxWidth: '95vw',
        background: 'white', zIndex: 1001, display: 'flex', flexDirection: 'column',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.15)', animation: 'slideInRight 0.3s ease-out'
      }}>
        <style>{`@keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>

        {/* Header */}
        <div style={{ padding: '1.25rem 1.5rem', background: 'var(--navy)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                <Video size={14} color="var(--gold)" />
                <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.55)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Editar Clase</span>
              </div>
              <h2 style={{ margin: 0, color: 'white', fontWeight: 800, fontSize: '1.05rem' }}>{title || 'Clase sin titulo'}</h2>
              <div style={{ fontSize: '0.76rem', color: 'rgba(255,255,255,0.45)', marginTop: '0.2rem' }}>{formatShortDate(classData.class_date)}</div>
            </div>
            <button onClick={onClose} style={{ color: 'rgba(255,255,255,0.65)', background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem' }}><X size={22} /></button>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: '2px solid var(--border-color)', background: '#fafafa', flexShrink: 0 }}>
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                flex: 1, padding: '0.85rem 0.4rem', fontWeight: 600, fontSize: '0.8rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                border: 'none', background: 'none', cursor: 'pointer',
                borderBottom: isActive ? '2px solid var(--gold-dark)' : '2px solid transparent',
                color: isActive ? 'var(--navy)' : 'var(--text-muted)',
                marginBottom: '-2px', transition: 'all 0.15s'
              }}>
                <Icon size={13} color={isActive ? 'var(--gold-dark)' : 'var(--text-muted)'} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>

          {/* GENERAL */}
          {activeTab === 'general' && (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              {error && <div style={{ color: '#b91c1c', background: '#fef2f2', padding: '0.6rem 0.8rem', borderRadius: '6px', fontSize: '0.84rem' }}>{error}</div>}
              {success && <div style={{ color: '#15803d', background: '#f0fdf4', padding: '0.6rem 0.8rem', borderRadius: '6px', fontSize: '0.84rem' }}>check {success}</div>}
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '0.84rem' }}>Titulo</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '6px' }} required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '0.84rem' }}>Sesion</label>
                  <select value={sessionId} onChange={e => setSessionId(e.target.value)} style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                    {sessions.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '0.84rem' }}>Profesor</label>
                  <select value={teacherId} onChange={e => setTeacherId(e.target.value)} style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                    {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 0.9fr 0.9fr', gap: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '0.84rem' }}>Fecha</label>
                  <input
                    type="date"
                    value={classDate ? classDate.split('T')[0] : ''}
                    onChange={e => {
                      const time = classDate && classDate.includes('T') ? classDate.split('T')[1]?.substring(0, 5) : '18:00';
                      setClassDate(`${e.target.value}T${time}`);
                    }}
                    style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '6px' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '0.84rem' }}>Hora (24 hrs)</label>
                  <TimePicker24h
                    value={classDate && classDate.includes('T') ? classDate.split('T')[1]?.substring(0, 5) : '18:00'}
                    onChange={newTime => {
                      const date = classDate ? classDate.split('T')[0] : new Date().toISOString().split('T')[0];
                      setClassDate(`${date}T${newTime}`);
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '0.84rem' }}>Dur. (min)</label>
                  <input type="number" value={duration} onChange={e => setDuration(e.target.value)} style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '6px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '0.84rem' }}>Orden</label>
                  <input type="number" value={orderIndex} onChange={e => setOrderIndex(e.target.value)} style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '6px' }} required />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '0.84rem' }}>Descripcion</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '6px', minHeight: '70px' }} />
              </div>
              <button type="submit" disabled={submitting} className="btn btn-primary" style={{ alignSelf: 'flex-start', padding: '0.65rem 1.5rem' }}>
                {submitting ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </form>
          )}

          {/* RECURSOS */}
          {activeTab === 'recursos' && (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {error && <div style={{ color: '#b91c1c', background: '#fef2f2', padding: '0.6rem 0.8rem', borderRadius: '6px', fontSize: '0.84rem' }}>{error}</div>}
              {success && <div style={{ color: '#15803d', background: '#f0fdf4', padding: '0.6rem 0.8rem', borderRadius: '6px', fontSize: '0.84rem' }}>✓ {success}</div>}
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '0.84rem' }}>URL de la Grabacion (Video)</label>
                <input type="url" value={videoUrl} onChange={e => setVideoUrl(e.target.value)} style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '6px' }} placeholder="https://youtube.com/... o Vimeo / Drive / Loom" />
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '3px' }}>Soporta YouTube, Vimeo, Google Drive y Loom. Se convierte a formato incrustable automaticamente.</div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '0.84rem' }}>URL de Presentacion (Slides / PDF)</label>
                <input type="url" value={presentationUrl} onChange={e => setPresentationUrl(e.target.value)} style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '6px' }} placeholder="https://..." />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '0.84rem', color: '#0369a1' }}>Carpeta de Google Drive (Automatizacion IA)</label>
                <input type="text" value={driveFolderId} onChange={e => setDriveFolderId(e.target.value)} style={{ width: '100%', padding: '0.6rem', border: '1px solid #7dd3fc', borderRadius: '6px', background: '#f0f9ff' }} placeholder="https://drive.google.com/drive/folders/... o ID de carpeta" />
                <div style={{ fontSize: '0.74rem', color: '#0284c7', marginTop: '3px' }}>Cuando la grabacion se sube a esta carpeta, el script la detecta y actualiza la URL automaticamente.</div>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.84rem', color: 'var(--navy)' }}>Recursos y Materiales de Estudio</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Sube PDFs a Drive, gestiona enlaces y previsualiza cómo lo ven los estudiantes.
                  </div>
                </div>
                {classData?.id && (
                  <Link
                    to={`/class/${classData.id}`}
                    style={{
                      background: 'var(--navy)',
                      color: 'white',
                      padding: '0.45rem 0.9rem',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      boxShadow: '0 2px 5px rgba(20,33,61,0.15)'
                    }}
                  >
                    <Eye size={13} color="var(--gold)" /> Gestionar en Vista de Clase
                  </Link>
                )}
              </div>

              <button type="submit" disabled={submitting} className="btn btn-primary" style={{ alignSelf: 'flex-start', padding: '0.65rem 1.5rem' }}>
                {submitting ? 'Guardando...' : 'Guardar Recursos'}
              </button>
            </form>
          )}

          {/* ACTIVIDAD IA */}
          {activeTab === 'actividad' && (
            <div>
              <div style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #14213D 100%)', borderRadius: '10px', padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <Zap size={20} color="var(--gold)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <div style={{ fontWeight: 700, color: 'white', fontSize: '0.95rem' }}>Actividad de Reforzamiento con IA</div>
                  <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.65)', marginTop: '0.2rem' }}>
                    Pega la transcripcion de la clase, genera preguntas con IA o agregaelas manualmente, luego publica la actividad para los estudiantes.
                  </div>
                </div>
              </div>
              <AdminClassReinforcement classId={classData.id} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// --- COURSE BUILDER ---
export default function CourseBuilder({ modules, sessions, classes, teachers, programId, isCourse, onRefresh }) {
  const [expandedModules, setExpandedModules] = useState({});
  const [expandedSessions, setExpandedSessions] = useState({});
  const [modals, setModals] = useState({ type: null, data: null, isOpen: false });
  const [editDrawer, setEditDrawer] = useState({ isOpen: false, classData: null });
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null, loading: false });

  const closeConfirm = () => setConfirmModal(prev => ({ ...prev, isOpen: false, loading: false }));
  const toggleModule = (id) => setExpandedModules(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleSession = (id) => setExpandedSessions(prev => ({ ...prev, [id]: !prev[id] }));
  const openCreateClass = (sessionId = null) => setModals({ type: 'class-create', data: { session_id: sessionId }, isOpen: true });
  const openEditClass = (cls) => setEditDrawer({ isOpen: true, classData: cls });

  const handleDeleteModule = (m) => {
    if (sessions.some(s => s.module_id === m.id)) {
      alert('No se puede eliminar: tiene sesiones asociadas.'); return;
    }
    setConfirmModal({ isOpen: true, title: 'Eliminar Modulo', message: `Eliminar "${m.title}"?`, loading: false,
      onConfirm: async () => { setConfirmModal(p => ({ ...p, loading: true })); await supabase.from('modules').delete().eq('id', m.id); closeConfirm(); onRefresh(); }
    });
  };

  const handleDeleteSession = (s) => {
    if (classes.some(c => c.session_id === s.id || c.subtopic_id === s.id)) {
      alert('No se puede eliminar: tiene clases asociadas.'); return;
    }
    setConfirmModal({ isOpen: true, title: 'Eliminar Sesion', message: `Eliminar "${s.title}"?`, loading: false,
      onConfirm: async () => {
        setConfirmModal(p => ({ ...p, loading: true }));
        await supabase.from('sessions').delete().eq('id', s.id);
        await supabase.from('subtopics').delete().eq('id', s.id);
        closeConfirm(); onRefresh();
      }
    });
  };

  const handleDeleteClass = (c) => {
    setConfirmModal({ isOpen: true, title: 'Eliminar Clase', message: `Eliminar "${c.title}"?`, loading: false,
      onConfirm: async () => { setConfirmModal(p => ({ ...p, loading: true })); await supabase.from('class_sessions').delete().eq('id', c.id); closeConfirm(); onRefresh(); }
    });
  };

  const sortedModules = [...modules].sort((a, b) => a.order_index - b.order_index);
  const getSessions = (modId) => sessions.filter(s => s.module_id === modId).sort((a, b) => a.order_index - b.order_index);
  const getClasses = (sessId) => classes.filter(c => c.session_id === sessId || c.subtopic_id === sessId).sort((a, b) => new Date(a.class_date) - new Date(b.class_date));

  return (
    <div style={{ animation: 'fadeSlideUp 0.35s ease-out' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--navy)', margin: 0 }}>Course Builder (Syllabus)</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.2rem 0 0 0' }}>Gestiona la estructura academica de forma jerarquica.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {!isCourse && (
            <button onClick={() => setModals({ type: 'module', data: null, isOpen: true })} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
              <Plus size={16} /> Modulo
            </button>
          )}
          <button onClick={() => setModals({ type: 'session', data: null, isOpen: true })} className="btn" style={{ background: 'white', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
            <Plus size={16} /> Sesion
          </button>
          <button onClick={() => openCreateClass(null)} className="btn" style={{ background: 'white', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
            <Plus size={16} /> Clase
          </button>
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
        {isCourse ? (
          <div style={{ padding: '1rem' }}>
            {[...sessions].sort((a, b) => a.order_index - b.order_index).map(session => (
              <SessionNode key={session.id} session={session} classes={getClasses(session.id)}
                isExpanded={expandedSessions[session.id]} onToggle={() => toggleSession(session.id)}
                onEditSession={() => setModals({ type: 'session', data: session, isOpen: true })}
                onDeleteSession={() => handleDeleteSession(session)}
                onAddClass={() => openCreateClass(session.id)}
                onEditClass={c => openEditClass(c)} onDeleteClass={c => handleDeleteClass(c)}
              />
            ))}
            {sessions.length === 0 && <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Aun no hay sesiones creadas en este curso.</p>}
          </div>
        ) : (
          <div style={{ padding: '1rem' }}>
            {sortedModules.map(module => (
              <div key={module.id} style={{ marginBottom: '1rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: '#f8fafc', borderBottom: expandedModules[module.id] ? '1px solid var(--border-color)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }} onClick={() => toggleModule(module.id)}>
                    {expandedModules[module.id] ? <ChevronDown size={18} color="var(--text-muted)" /> : <ChevronRight size={18} color="var(--text-muted)" />}
                    <div style={{ background: 'var(--navy)', color: 'white', fontSize: '0.75rem', fontWeight: 800, padding: '0.2rem 0.5rem', borderRadius: '4px' }}>M{module.order_index}</div>
                    <span style={{ fontWeight: 700, color: 'var(--navy)', fontSize: '1.05rem' }}>{module.title}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => setModals({ type: 'session', data: { module_id: module.id }, isOpen: true })} className="btn" style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem', background: 'white', border: '1px solid var(--border-color)' }}>+ Sesion</button>
                    <ActionBtns onEdit={() => setModals({ type: 'module', data: module, isOpen: true })} onDelete={() => handleDeleteModule(module)} />
                  </div>
                </div>
                {expandedModules[module.id] && (
                  <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'white' }}>
                    {getSessions(module.id).map(session => (
                      <SessionNode key={session.id} session={session} classes={getClasses(session.id)}
                        isExpanded={expandedSessions[session.id]} onToggle={() => toggleSession(session.id)}
                        onEditSession={() => setModals({ type: 'session', data: session, isOpen: true })}
                        onDeleteSession={() => handleDeleteSession(session)}
                        onAddClass={() => openCreateClass(session.id)}
                        onEditClass={c => openEditClass(c)} onDeleteClass={c => handleDeleteClass(c)}
                      />
                    ))}
                    {getSessions(module.id).length === 0 && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>No hay sesiones en este modulo.</p>}
                  </div>
                )}
              </div>
            ))}
            {sortedModules.length === 0 && <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Aun no hay modulos creados en este diplomado.</p>}
          </div>
        )}
      </div>

      <ModuleModal isOpen={modals.isOpen && modals.type === 'module'} onClose={() => setModals({ isOpen: false })} onRefresh={onRefresh} programId={programId} initialData={modals.data} modules={modules} />
      <SessionModal isOpen={modals.isOpen && modals.type === 'session'} onClose={() => setModals({ isOpen: false })} onRefresh={onRefresh} programId={programId} initialData={modals.data} modules={modules} isCourse={isCourse} />
      <ClassCreateModal isOpen={modals.isOpen && modals.type === 'class-create'} onClose={() => setModals({ isOpen: false })} onRefresh={onRefresh} programId={programId} initialSessionId={modals.data?.session_id} sessions={sessions} teachers={teachers} />
      <ClassEditDrawer isOpen={editDrawer.isOpen} onClose={() => setEditDrawer({ isOpen: false, classData: null })} onRefresh={onRefresh} programId={programId} classData={editDrawer.classData} sessions={sessions} teachers={teachers} />
      <ConfirmModal isOpen={confirmModal.isOpen} title={confirmModal.title} message={confirmModal.message} loading={confirmModal.loading} onConfirm={confirmModal.onConfirm} onClose={closeConfirm} />
    </div>
  );
}

// SESSION NODE
function SessionNode({ session, classes, isExpanded, onToggle, onEditSession, onDeleteSession, onAddClass, onEditClass, onDeleteClass }) {
  return (
    <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: '0.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: '#fdfdfd', borderBottom: isExpanded ? '1px solid var(--border-color)' : 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', flex: 1 }} onClick={onToggle}>
          {isExpanded ? <ChevronDown size={16} color="var(--text-muted)" /> : <ChevronRight size={16} color="var(--text-muted)" />}
          <div style={{ background: 'var(--gold-subtle)', color: 'var(--gold-dark)', fontSize: '0.7rem', fontWeight: 800, padding: '0.2rem 0.5rem', borderRadius: '4px' }}>S{session.order_index}</div>
          <span style={{ fontWeight: 600, color: 'var(--navy)', fontSize: '0.95rem' }}>{session.title}</span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', background: '#f1f5f9', padding: '0.1rem 0.5rem', borderRadius: '10px' }}>{classes.length} clase{classes.length !== 1 ? 's' : ''}</span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={onAddClass} className="btn" style={{ padding: '0.3rem 0.5rem', fontSize: '0.7rem', background: 'white', border: '1px solid var(--border-color)' }}>+ Clase</button>
          <ActionBtns onEdit={onEditSession} onDelete={onDeleteSession} />
        </div>
      </div>
      {isExpanded && (
        <div style={{ padding: '0.75rem 1rem 0.75rem 3rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'white' }}>
          {classes.map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0.8rem', background: 'var(--surface-light)', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Video size={15} color="var(--gold-dark)" />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--navy)' }}>{c.title}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span><Clock size={10} style={{ display: 'inline', marginRight: 2 }} />{formatShortDate(c.class_date)}</span>
                    {c.duration && <span>({c.duration} min)</span>}
                    {c.video_url && <span style={{ color: '#16a34a' }}>Grabacion OK</span>}
                    {c.drive_folder_id && <span style={{ color: '#0369a1' }}>Drive</span>}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <Link
                  to={`/class/${c.id}`}
                  title="Ver clase y gestionar materiales (Modo Admin)"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    padding: '0.3rem 0.65rem',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    background: '#ffffff',
                    color: 'var(--navy)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    textDecoration: 'none'
                  }}
                >
                  <Eye size={12} color="var(--gold-dark)" /> Ver Clase
                </Link>
                <button onClick={() => onEditClass(c)} title="Editar clase" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.65rem', fontSize: '0.72rem', fontWeight: 600, background: 'var(--navy)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                  <Pencil size={11} /> Editar
                </button>
                <button onClick={() => onDeleteClass(c)} style={{ padding: '0.3rem', background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          {classes.length === 0 && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>No hay clases en esta sesion.</p>}
        </div>
      )}
    </div>
  );
}
