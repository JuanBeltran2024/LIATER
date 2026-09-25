import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import {
  Paperclip, FileText, Presentation, ExternalLink, Code, Video,
  Eye, EyeOff, Search, Plus, Trash2, Edit3, FolderDown,
  Layers, Calendar, X, Check, Upload, Link as LinkIcon, RefreshCw, AlertCircle,
  Download, Lock
} from 'lucide-react';
import { getDownloadUrl, triggerResourceDownload } from '@/utils/resourceUtils';

/* ── HELPER: Formatear URL para embeber documentos de Google Drive ── */
function formatEmbedDocUrl(url) {
  if (!url) return '';
  let trimmed = url.trim();
  if (trimmed.includes('drive.google.com')) {
    if (trimmed.includes('/preview')) return trimmed;
    return trimmed.replace(/\/view.*$/, '/preview').replace(/\/edit.*$/, '/preview');
  }
  return trimmed;
}

/* ── HELPER: Ícono por tipo de recurso ── */
function getResourceIcon(type, size = 18) {
  switch (type) {
    case 'presentation':
      return <Presentation size={size} color="var(--gold-dark, #b45309)" />;
    case 'file':
    case 'pdf':
    case 'document':
      return <FileText size={size} color="#2563eb" />;
    case 'link':
      return <ExternalLink size={size} color="#16a34a" />;
    case 'code':
      return <Code size={size} color="#9333ea" />;
    case 'video':
      return <Video size={size} color="#dc2626" />;
    default:
      return <FileText size={size} color="#64748B" />;
  }
}

export default function AdminResources({ programId, programTitle, programClasses = [], onRefresh }) {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [scopeFilter, setScopeFilter] = useState('all'); // 'all' | 'general' | 'classes'
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedDoc, setSelectedDoc] = useState(null);

  // Modal de Subida / Edición
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'
  const [editingResource, setEditingResource] = useState(null);
  const [uploadMode, setUploadMode] = useState('file'); // 'file' | 'link'
  const [targetDestination, setTargetDestination] = useState('general'); // 'general' | classId
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState('file');
  const [formUrl, setFormUrl] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formAllowDownload, setFormAllowDownload] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');
  const [modalSuccess, setModalSuccess] = useState('');
  const fileInputRef = useRef(null);

  const fetchResources = async () => {
    if (!programId) return;
    try {
      setLoading(true);
      const classMap = {};
      (programClasses || []).forEach(c => {
        classMap[c.id] = c;
      });
      const classIds = Object.keys(classMap);

      const queryPromises = [];
      if (classIds.length > 0) {
        queryPromises.push(
          supabase.from('resources').select('*').in('class_id', classIds)
        );
      }
      queryPromises.push(
        supabase.from('resources').select('*').eq('program_id', programId)
      );

      const queryResults = await Promise.all(queryPromises);
      const resMap = new Map();
      queryResults.forEach(({ data, error }) => {
        if (error) console.warn('Aviso al consultar recursos en AdminResources:', error);
        (data || []).forEach(r => resMap.set(r.id, r));
      });

      const data = Array.from(resMap.values()).sort((a, b) => {
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      });

      const enriched = (data || []).map(r => {
        const isGen = !r.class_id || !classMap[r.class_id];
        const cls = !isGen ? classMap[r.class_id] : null;
        return {
          ...r,
          isGeneral: isGen,
          classTitle: isGen ? 'Contenido General del Curso' : (cls?.title || 'Clase'),
          classDate: cls?.class_date || null
        };
      });

      setResources(enriched);
    } catch (err) {
      console.error('Error al cargar recursos en AdminResources:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResources();
  }, [programId, programClasses]);

  const generalResources = useMemo(() => resources.filter(r => r.isGeneral), [resources]);
  const classResources = useMemo(() => resources.filter(r => !r.isGeneral), [resources]);
  const generalCount = generalResources.length;
  const classCount = classResources.length;

  const filteredResources = useMemo(() => {
    return resources.filter(r => {
      if (scopeFilter === 'general' && !r.isGeneral) return false;
      if (scopeFilter === 'classes' && r.isGeneral) return false;

      if (typeFilter !== 'all') {
        const t = r.resource_type || r.type;
        if (typeFilter === 'file') {
          if (t !== 'file' && t !== 'pdf' && t !== 'document') return false;
        } else if (t !== typeFilter) {
          return false;
        }
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = (r.title || '').toLowerCase().includes(q);
        const descMatch = (r.description || '').toLowerCase().includes(q);
        const classMatch = (r.classTitle || '').toLowerCase().includes(q);
        if (!titleMatch && !descMatch && !classMatch) return false;
      }

      return true;
    });
  }, [resources, scopeFilter, typeFilter, searchQuery]);

  const filteredGeneral = useMemo(() => filteredResources.filter(r => r.isGeneral), [filteredResources]);
  const filteredClass = useMemo(() => filteredResources.filter(r => !r.isGeneral), [filteredResources]);

  const handleOpenUpload = (defaultTarget = 'general') => {
    setModalMode('create');
    setEditingResource(null);
    setTargetDestination(defaultTarget);
    setUploadMode('file');
    setFormTitle('');
    setFormType('file');
    setFormUrl('');
    setFormDescription('');
    setFormAllowDownload(false);
    setSelectedFile(null);
    setModalError('');
    setModalSuccess('');
    setShowModal(true);
  };

  const handleOpenEdit = (r) => {
    setModalMode('edit');
    setEditingResource(r);
    setTargetDestination(r.class_id ? String(r.class_id) : 'general');
    setUploadMode('link');
    setFormTitle(r.title || '');
    setFormType(r.resource_type || r.type || 'file');
    setFormUrl(r.url || '');
    setFormDescription(r.description || '');
    setFormAllowDownload(Boolean(r.allow_download));
    setSelectedFile(null);
    setModalError('');
    setModalSuccess('');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setModalError('');
    setModalSuccess('');

    if (modalMode === 'edit') {
      if (!formTitle.trim()) {
        setModalError('El título es requerido.');
        return;
      }
      if (!formUrl.trim()) {
        setModalError('La URL es requerida.');
        return;
      }
      try {
        setIsSubmitting(true);
        const { error } = await supabase
          .from('resources')
          .update({
            title: formTitle.trim(),
            resource_type: formType,
            url: formUrl.trim(),
            description: formDescription.trim() || null,
            class_id: targetDestination === 'general' ? null : targetDestination,
            program_id: programId,
            allow_download: formAllowDownload
          })
          .eq('id', editingResource.id);

        if (error) throw error;
        setModalSuccess('✓ Recurso actualizado correctamente.');
        await fetchResources();
        if (onRefresh) onRefresh();
        setTimeout(() => setShowModal(false), 900);
      } catch (err) {
        setModalError('Error al actualizar: ' + (err.message || String(err)));
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // MODO CREACIÓN
    if (uploadMode === 'file') {
      if (!selectedFile) {
        setModalError('Selecciona un archivo PDF para subir.');
        return;
      }
      try {
        setIsSubmitting(true);
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('programId', programId);
        formData.append('classId', targetDestination === 'general' ? 'general' : targetDestination);
        formData.append('resourceType', formType === 'presentation' ? 'presentation' : 'file');
        formData.append('allowDownload', String(formAllowDownload));
        if (formTitle.trim()) formData.append('customTitle', formTitle.trim());

        const { data, error } = await supabase.functions.invoke('upload-pdf-drive', {
          body: formData,
        });

        if (error) {
          let msg = error.message;
          try {
            if (error.context && typeof error.context.json === 'function') {
              const body = await error.context.json();
              if (body?.error) msg = body.error;
            }
          } catch (_) {}
          throw new Error(msg);
        }
        if (data?.error) throw new Error(data.error);

        if (data?.resource?.id) {
          await supabase
            .from('resources')
            .update({
              description: formDescription.trim() || null,
              allow_download: formAllowDownload
            })
            .eq('id', data.resource.id);
        }

        setModalSuccess(`✓ Subido exitosamente: "${data.formattedFileName || selectedFile.name}"`);
        await fetchResources();
        if (onRefresh) onRefresh();
        setTimeout(() => setShowModal(false), 1200);
      } catch (err) {
        setModalError('Error al subir: ' + (err.message || String(err)));
      } finally {
        setIsSubmitting(false);
      }
    } else {
      if (!formTitle.trim()) {
        setModalError('El título es requerido.');
        return;
      }
      if (!formUrl.trim()) {
        setModalError('La URL es requerida.');
        return;
      }
      try {
        setIsSubmitting(true);
        const { error } = await supabase
          .from('resources')
          .insert([{
            program_id: programId,
            class_id: targetDestination === 'general' ? null : targetDestination,
            title: formTitle.trim(),
            resource_type: formType,
            url: formUrl.trim(),
            description: formDescription.trim() || null,
            provider: formUrl.includes('drive.google.com') ? 'drive' : 'link',
            is_visible: true,
            allow_download: formAllowDownload
          }]);

        if (error) throw error;
        setModalSuccess('✓ Recurso guardado correctamente.');
        await fetchResources();
        if (onRefresh) onRefresh();
        setTimeout(() => setShowModal(false), 900);
      } catch (err) {
        setModalError('Error al guardar: ' + (err.message || String(err)));
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleToggleAllowDownload = async (r) => {
    try {
      const nextState = !(r.allow_download ?? false);
      const { error } = await supabase
        .from('resources')
        .update({ allow_download: nextState })
        .eq('id', r.id);

      if (error) throw error;
      setResources(prev => prev.map(item => item.id === r.id ? { ...item, allow_download: nextState } : item));
      if (onRefresh) onRefresh();
    } catch (err) {
      alert('Error cambiando permiso de descarga: ' + (err.message || String(err)));
    }
  };

  const handleToggleVisibility = async (r) => {
    try {
      const nextState = r.is_visible === false ? true : false;
      const { error } = await supabase
        .from('resources')
        .update({ is_visible: nextState })
        .eq('id', r.id);

      if (error) throw error;
      setResources(prev => prev.map(item => item.id === r.id ? { ...item, is_visible: nextState } : item));
      if (onRefresh) onRefresh();
    } catch (err) {
      alert('Error cambiando visibilidad: ' + (err.message || String(err)));
    }
  };

  const handleDeleteResource = async (r) => {
    const isDrive = r.url?.includes('drive.google.com') || r.provider === 'drive';
    const confirmMsg = isDrive
      ? `¿Eliminar permanentemente "${r.title}"? También se eliminará el archivo en Google Drive.`
      : `¿Eliminar permanentemente "${r.title}"?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      if (isDrive) {
        let fileId = null;
        const match = (r.url || '').match(/[-\w]{25,}/);
        if (match) fileId = match[0];

        try {
          const deleteFormData = new FormData();
          deleteFormData.append('action', 'delete');
          if (fileId) deleteFormData.append('fileId', fileId);
          deleteFormData.append('resourceId', r.id);
          await supabase.functions.invoke('upload-pdf-drive', { body: deleteFormData });
        } catch (driveErr) {
          console.warn('Aviso: no se pudo sincronizar borrado con Drive:', driveErr);
        }
      }

      const { error } = await supabase.from('resources').delete().eq('id', r.id);
      if (error) throw error;

      setResources(prev => prev.filter(item => item.id !== r.id));
      if (onRefresh) onRefresh();
    } catch (err) {
      alert('Error al eliminar: ' + (err.message || String(err)));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeSlideUp 0.35s ease-out' }}>

      {/* ── ENCABEZADO CON MÉTRICAS Y ACCIONES ── */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '14px',
        padding: '1.25rem 1.5rem',
        border: '1px solid #E2E8F0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        boxShadow: '0 1px 3px rgba(20,33,61,0.03)'
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--navy, #14213D)' }}>
            Material y Recursos del Curso
          </h2>
          <p style={{ margin: '3px 0 0 0', fontSize: '0.84rem', color: '#64748B' }}>
            Gestiona guías transversales, presentaciones de clases, enlaces de interés y documentos de estudio.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          <Link
            to={`/resources/${programId}`}
            className="btn btn-outline"
            style={{ fontSize: '0.82rem', padding: '0.45rem 0.9rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Eye size={14} />
            <span>Ver Vista de Estudiantes</span>
          </Link>

          <button
            type="button"
            onClick={() => handleOpenUpload('general')}
            style={{
              background: 'var(--gold, #FCA311)',
              color: 'var(--navy, #14213D)',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.82rem',
              padding: '0.45rem 1rem',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              boxShadow: '0 2px 6px rgba(252, 163, 17, 0.3)',
              transition: 'all 0.15s ease'
            }}
            onMouseOver={e => e.currentTarget.style.transform = 'translateY(-1px)'}
            onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <Plus size={15} />
            <span>Subir Contenido General</span>
          </button>
        </div>
      </div>

      {/* ── TARJETAS DE CONTEO RÁPIDO ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <div style={{ background: '#FFFFFF', padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(20, 33, 61, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--navy, #14213D)' }}>
            <Paperclip size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--navy, #14213D)' }}>{resources.length}</div>
            <div style={{ fontSize: '0.76rem', color: '#64748B', fontWeight: 600 }}>Total de Recursos</div>
          </div>
        </div>

        <div style={{ background: '#FFFFFF', padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
            <FolderDown size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#2563eb' }}>{generalCount}</div>
            <div style={{ fontSize: '0.76rem', color: '#64748B', fontWeight: 600 }}>Contenido General</div>
          </div>
        </div>

        <div style={{ background: '#FFFFFF', padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--navy, #14213D)' }}>
            <Video size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--navy, #14213D)' }}>{classCount}</div>
            <div style={{ fontSize: '0.76rem', color: '#64748B', fontWeight: 600 }}>Materiales por Clase</div>
          </div>
        </div>
      </div>

      {/* ── BARRA DE BÚSQUEDA Y FILTROS ── */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '12px',
        padding: '1rem 1.25rem',
        border: '1px solid #E2E8F0',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem'
      }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 260px' }}>
            <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar por título, descripción o clase..."
              style={{
                width: '100%',
                padding: '0.55rem 0.85rem 0.55rem 2.25rem',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '0.84rem',
                outline: 'none',
                background: '#FAFBFD'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: 'Todo' },
              { id: 'general', label: `General (${generalCount})` },
              { id: 'classes', label: `Por Clases (${classCount})` }
            ].map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setScopeFilter(f.id)}
                style={{
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.45rem 0.85rem',
                  fontSize: '0.8rem',
                  fontWeight: scopeFilter === f.id ? 700 : 500,
                  background: scopeFilter === f.id ? 'var(--navy, #14213D)' : '#F1F5F9',
                  color: scopeFilter === f.id ? '#FFFFFF' : '#475569',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div style={{ marginLeft: 'auto' }}>
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              style={{
                padding: '0.45rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                fontSize: '0.8rem',
                background: '#FAFBFD',
                outline: 'none',
                color: 'var(--navy, #14213D)',
                fontWeight: 600
              }}
            >
              <option value="all">Todas las categorías</option>
              <option value="file">Documentos / Lecturas</option>
              <option value="presentation">Presentaciones</option>
              <option value="link">Enlaces Web</option>
              <option value="code">Código / Repos</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── LISTADO PRINCIPAL DE RECURSOS ── */}
      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#64748B' }}>
          Cargando materiales del curso...
        </div>
      ) : filteredGeneral.length === 0 && filteredClass.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3.5rem 1.5rem', background: '#FFFFFF', borderRadius: '12px', border: '1px dashed #CBD5E1' }}>
          <FolderDown size={36} color="#94A3B8" style={{ margin: '0 auto 0.75rem' }} />
          <h3 style={{ margin: '0 0 0.4rem 0', color: 'var(--navy, #14213D)' }}>No se encontraron recursos</h3>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748B' }}>
            {resources.length === 0 ? 'Empieza agregando material general o recursos para las clases del curso.' : 'Prueba ajustando los filtros de búsqueda.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

          {/* SECCIÓN 1: GENERAL */}
          {(scopeFilter === 'all' || scopeFilter === 'general') && (
            <div>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: '0.85rem', paddingBottom: '0.4rem', borderBottom: '2px solid rgba(252, 163, 17, 0.4)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FolderDown size={18} color="var(--gold-dark, #b45309)" />
                  <h3 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 800, color: 'var(--navy, #14213D)' }}>
                    Contenido General del Curso ({filteredGeneral.length})
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenUpload('general')}
                  className="btn btn-outline"
                  style={{ fontSize: '0.76rem', padding: '0.25rem 0.65rem' }}
                >
                  <Plus size={13} /> Agregar
                </button>
              </div>

              {filteredGeneral.length === 0 ? (
                <div style={{ padding: '1.25rem', background: '#FAFBFD', borderRadius: '10px', border: '1px dashed #CBD5E1', fontSize: '0.84rem', color: '#64748B' }}>
                  No hay contenido general registrado. Sube guías, enlaces de software o bibliografía transversal.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))', gap: '1rem' }}>
                  {filteredGeneral.map(r => (
                    <div
                      key={r.id}
                      style={{
                        background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0',
                        padding: '1.1rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '0.85rem',
                        opacity: r.is_visible === false ? 0.75 : 1
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                          <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 7px', borderRadius: '6px', background: '#FEF3C7', color: '#B45309' }}>
                            GENERAL
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            {r.allow_download ? (
                              <span style={{ fontSize: '0.66rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: '#DCFCE7', color: '#15803D', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                <Download size={10} /> Descargable
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.66rem', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', background: '#F1F5F9', color: '#64748B', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                <Lock size={10} /> Solo lectura
                              </span>
                            )}
                            {r.is_visible === false && (
                              <span style={{ fontSize: '0.66rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: '#FEE2E2', color: '#DC2626' }}>
                                Oculto
                              </span>
                            )}
                            <span style={{ fontSize: '0.68rem', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>
                              {r.resource_type || r.type}
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', marginTop: '0.35rem' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#F8FAFC', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {getResourceIcon(r.resource_type || r.type, 16)}
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '0.94rem', fontWeight: 700, color: 'var(--navy, #14213D)' }}>
                              {r.title}
                            </h4>
                            {r.description && (
                              <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748B', lineHeight: 1.4 }}>
                                {r.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.65rem', borderTop: '1px solid #F1F5F9', gap: '0.4rem' }}>
                        <button
                          type="button"
                          onClick={() => setSelectedDoc(r)}
                          style={{
                            background: 'var(--navy, #14213D)', color: '#FFFFFF', border: 'none',
                            borderRadius: '6px', padding: '0.35rem 0.75rem', fontSize: '0.76rem',
                            fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.35rem'
                          }}
                        >
                          <Eye size={12} color="var(--gold, #FCA311)" />
                          <span>Abrir</span>
                        </button>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <button
                            type="button"
                            onClick={() => handleToggleAllowDownload(r)}
                            title={r.allow_download ? 'Descarga permitida a estudiantes (Clic para bloquear)' : 'Descarga bloqueada a estudiantes (Clic para permitir)'}
                            style={{
                              background: r.allow_download ? '#DCFCE7' : '#F1F5F9',
                              border: `1px solid ${r.allow_download ? '#86EFAC' : '#E2E8F0'}`,
                              borderRadius: '6px', width: '28px', height: '28px',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              cursor: 'pointer', color: r.allow_download ? '#15803D' : '#94A3B8'
                            }}
                          >
                            <Download size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleVisibility(r)}
                            title={r.is_visible === false ? 'Mostrar a estudiantes' : 'Ocultar a estudiantes'}
                            style={{
                              background: r.is_visible === false ? '#FEF2F2' : '#F1F5F9',
                              border: 'none', borderRadius: '6px', width: '28px', height: '28px',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              cursor: 'pointer', color: r.is_visible === false ? '#DC2626' : '#64748B'
                            }}
                          >
                            {r.is_visible === false ? <EyeOff size={13} /> : <Eye size={13} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(r)}
                            title="Editar recurso"
                            style={{
                              background: '#F1F5F9', border: 'none', borderRadius: '6px',
                              width: '28px', height: '28px', display: 'flex', alignItems: 'center',
                              justifyContent: 'center', cursor: 'pointer', color: '#64748B'
                            }}
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteResource(r)}
                            title="Eliminar recurso"
                            style={{
                              background: '#F1F5F9', border: 'none', borderRadius: '6px',
                              width: '28px', height: '28px', display: 'flex', alignItems: 'center',
                              justifyContent: 'center', cursor: 'pointer', color: '#DC2626'
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SECCIÓN 2: POR CLASES */}
          {(scopeFilter === 'all' || scopeFilter === 'classes') && (
            <div>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: '0.85rem', paddingBottom: '0.4rem', borderBottom: '2px solid #E2E8F0'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Video size={18} color="var(--navy, #14213D)" />
                  <h3 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 800, color: 'var(--navy, #14213D)' }}>
                    Materiales por Clase ({filteredClass.length})
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenUpload((programClasses || [])[0]?.id || 'general')}
                  className="btn btn-outline"
                  style={{ fontSize: '0.76rem', padding: '0.25rem 0.65rem' }}
                >
                  <Plus size={13} /> Agregar
                </button>
              </div>

              {filteredClass.length === 0 ? (
                <div style={{ padding: '1.25rem', background: '#FAFBFD', borderRadius: '10px', border: '1px dashed #CBD5E1', fontSize: '0.84rem', color: '#64748B' }}>
                  No hay materiales asociados a clases específicas aún.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))', gap: '1rem' }}>
                  {filteredClass.map(r => (
                    <div
                      key={r.id}
                      style={{
                        background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0',
                        padding: '1.1rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '0.85rem',
                        opacity: r.is_visible === false ? 0.75 : 1
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                          <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 7px', borderRadius: '6px', background: '#F1F5F9', color: 'var(--navy, #14213D)' }}>
                            {r.classTitle}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            {r.allow_download ? (
                              <span style={{ fontSize: '0.66rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: '#DCFCE7', color: '#15803D', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                <Download size={10} /> Descargable
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.66rem', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', background: '#F1F5F9', color: '#64748B', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                <Lock size={10} /> Solo lectura
                              </span>
                            )}
                            {r.is_visible === false && (
                              <span style={{ fontSize: '0.66rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: '#FEE2E2', color: '#DC2626' }}>
                                Oculto
                              </span>
                            )}
                            <span style={{ fontSize: '0.68rem', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>
                              {r.resource_type || r.type}
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', marginTop: '0.35rem' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#F8FAFC', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {getResourceIcon(r.resource_type || r.type, 16)}
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '0.94rem', fontWeight: 700, color: 'var(--navy, #14213D)' }}>
                              {r.title}
                            </h4>
                            {r.description && (
                              <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748B', lineHeight: 1.4 }}>
                                {r.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.65rem', borderTop: '1px solid #F1F5F9', gap: '0.4rem' }}>
                        <button
                          type="button"
                          onClick={() => setSelectedDoc(r)}
                          style={{
                            background: 'var(--navy, #14213D)', color: '#FFFFFF', border: 'none',
                            borderRadius: '6px', padding: '0.35rem 0.75rem', fontSize: '0.76rem',
                            fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.35rem'
                          }}
                        >
                          <Eye size={12} color="var(--gold, #FCA311)" />
                          <span>Abrir</span>
                        </button>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <button
                            type="button"
                            onClick={() => handleToggleAllowDownload(r)}
                            title={r.allow_download ? 'Descarga permitida a estudiantes (Clic para bloquear)' : 'Descarga bloqueada a estudiantes (Clic para permitir)'}
                            style={{
                              background: r.allow_download ? '#DCFCE7' : '#F1F5F9',
                              border: `1px solid ${r.allow_download ? '#86EFAC' : '#E2E8F0'}`,
                              borderRadius: '6px', width: '28px', height: '28px',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              cursor: 'pointer', color: r.allow_download ? '#15803D' : '#94A3B8'
                            }}
                          >
                            <Download size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleVisibility(r)}
                            title={r.is_visible === false ? 'Mostrar a estudiantes' : 'Ocultar a estudiantes'}
                            style={{
                              background: r.is_visible === false ? '#FEF2F2' : '#F1F5F9',
                              border: 'none', borderRadius: '6px', width: '28px', height: '28px',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              cursor: 'pointer', color: r.is_visible === false ? '#DC2626' : '#64748B'
                            }}
                          >
                            {r.is_visible === false ? <EyeOff size={13} /> : <Eye size={13} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(r)}
                            title="Editar recurso"
                            style={{
                              background: '#F1F5F9', border: 'none', borderRadius: '6px',
                              width: '28px', height: '28px', display: 'flex', alignItems: 'center',
                              justifyContent: 'center', cursor: 'pointer', color: '#64748B'
                            }}
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteResource(r)}
                            title="Eliminar recurso"
                            style={{
                              background: '#F1F5F9', border: 'none', borderRadius: '6px',
                              width: '28px', height: '28px', display: 'flex', alignItems: 'center',
                              justifyContent: 'center', cursor: 'pointer', color: '#DC2626'
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* ── MODAL: SUBIR O EDITAR RECURSO ── */}
      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '1rem'
        }}>
          <div style={{
            background: '#FFFFFF', borderRadius: '16px', maxWidth: '520px', width: '100%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden', animation: 'scaleUp 0.2s ease-out'
          }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--navy, #14213D)' }}>
                  {modalMode === 'create' ? 'Agregar Recurso al Curso' : 'Editar Recurso'}
                </h3>
                <span style={{ fontSize: '0.78rem', color: '#64748B' }}>
                  {modalMode === 'create' ? 'Publica documentos o enlaces de interés.' : 'Modifica los datos del material.'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{ background: '#F1F5F9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B' }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {modalError && (
                <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#991B1B', padding: '0.65rem 0.85rem', borderRadius: '8px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <AlertCircle size={15} style={{ flexShrink: 0 }} />
                  <span>{modalError}</span>
                </div>
              )}
              {modalSuccess && (
                <div style={{ background: '#DCFCE7', border: '1px solid #86EFAC', color: '#166534', padding: '0.65rem 0.85rem', borderRadius: '8px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Check size={15} style={{ flexShrink: 0 }} />
                  <span>{modalSuccess}</span>
                </div>
              )}

              {/* DESTINO */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy, #14213D)', marginBottom: '0.4rem' }}>
                  Destino del Material <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <select
                  value={targetDestination}
                  onChange={e => setTargetDestination(e.target.value)}
                  style={{
                    width: '100%', padding: '0.6rem 0.85rem', borderRadius: '8px', border: '1px solid #CBD5E1',
                    fontSize: '0.84rem', fontWeight: 600, background: targetDestination === 'general' ? '#FFFBEB' : '#FAFBFD',
                    color: 'var(--navy, #14213D)', outline: 'none'
                  }}
                >
                  <option value="general">Contenido General del Curso (Aplica a todo el programa)</option>
                  {(programClasses || []).length > 0 && (
                    <optgroup label="Clases Específicas">
                      {programClasses.map(c => (
                        <option key={c.id} value={c.id}>
                          Clase: {c.title}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              {/* MODO (CREACIÓN) */}
              {modalMode === 'create' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy, #14213D)', marginBottom: '0.4rem' }}>
                    Método de Publicación
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => setUploadMode('file')}
                      style={{
                        padding: '0.6rem', borderRadius: '8px',
                        border: uploadMode === 'file' ? '2px solid var(--gold, #FCA311)' : '1px solid #CBD5E1',
                        background: uploadMode === 'file' ? 'rgba(252, 163, 17, 0.08)' : '#FAFBFD',
                        fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem'
                      }}
                    >
                      <Upload size={14} /> Subir PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => setUploadMode('link')}
                      style={{
                        padding: '0.6rem', borderRadius: '8px',
                        border: uploadMode === 'link' ? '2px solid var(--gold, #FCA311)' : '1px solid #CBD5E1',
                        background: uploadMode === 'link' ? 'rgba(252, 163, 17, 0.08)' : '#FAFBFD',
                        fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem'
                      }}
                    >
                      <LinkIcon size={14} /> Enlace o URL
                    </button>
                  </div>
                </div>
              )}

              {/* CATEGORÍA */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy, #14213D)', marginBottom: '0.4rem' }}>
                  Categoría
                </label>
                <select
                  value={formType}
                  onChange={e => setFormType(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.84rem', background: '#FAFBFD', outline: 'none' }}
                >
                  <option value="file">Documento / Lectura / Guía (PDF)</option>
                  <option value="presentation">Presentación / Diapositivas</option>
                  <option value="link">Enlace de Interés / Plataforma</option>
                  <option value="code">Código / Repositorio / Software</option>
                </select>
              </div>

              {/* DROPZONE ARCHIVO */}
              {modalMode === 'create' && uploadMode === 'file' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy, #14213D)', marginBottom: '0.4rem' }}>
                    Archivo PDF <span style={{ color: '#DC2626' }}>*</span>
                  </label>
                  <div
                    onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={e => {
                      e.preventDefault();
                      setIsDragOver(false);
                      if (e.dataTransfer.files?.[0]) setSelectedFile(e.dataTransfer.files[0]);
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: `2px dashed ${isDragOver ? 'var(--gold, #FCA311)' : '#CBD5E1'}`,
                      borderRadius: '10px', padding: '1.25rem', textAlign: 'center',
                      background: isDragOver ? 'rgba(252, 163, 17, 0.05)' : '#FAFBFD',
                      cursor: 'pointer', transition: 'all 0.15s ease'
                    }}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf"
                      style={{ display: 'none' }}
                      onChange={e => {
                        if (e.target.files?.[0]) setSelectedFile(e.target.files[0]);
                      }}
                    />
                    <Upload size={24} color={selectedFile ? 'var(--gold-dark, #b45309)' : '#94A3B8'} style={{ margin: '0 auto 0.4rem' }} />
                    {selectedFile ? (
                      <div>
                        <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--navy, #14213D)' }}>{selectedFile.name}</div>
                        <div style={{ fontSize: '0.74rem', color: '#64748B' }}>{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--navy, #14213D)' }}>Arrastra el PDF aquí o haz clic para examinar</div>
                        <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>Solo formato PDF (máx. 100MB)</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* URL ENLACE */}
              {(modalMode === 'edit' || uploadMode === 'link') && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy, #14213D)', marginBottom: '0.4rem' }}>
                    Enlace / URL Web <span style={{ color: '#DC2626' }}>*</span>
                  </label>
                  <input
                    type="url"
                    value={formUrl}
                    onChange={e => setFormUrl(e.target.value)}
                    placeholder="https://..."
                    style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.84rem', outline: 'none' }}
                  />
                </div>
              )}

              {/* TÍTULO */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy, #14213D)', marginBottom: '0.4rem' }}>
                  Título del Recurso {uploadMode === 'file' && <span style={{ fontWeight: 400, color: '#64748B' }}>(opcional, usa el nombre del archivo si está vacío)</span>}
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder="Ej: Guía de Laboratorio 1"
                  style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.84rem', outline: 'none' }}
                />
              </div>

              {/* DESCRIPCIÓN */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy, #14213D)', marginBottom: '0.4rem' }}>
                  Descripción o Instrucciones (opcional)
                </label>
                <textarea
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  placeholder="Información adicional para los estudiantes..."
                  rows={2}
                  style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.84rem', outline: 'none', resize: 'vertical' }}
                />
              </div>

              {/* PERMISO DE DESCARGA */}
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.84rem', color: 'var(--navy, #14213D)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formAllowDownload}
                      onChange={e => setFormAllowDownload(e.target.checked)}
                      style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--navy, #14213D)' }}
                    />
                    <span>Habilitar descarga a estudiantes</span>
                  </label>
                  <p style={{ margin: '0.2rem 0 0 1.5rem', fontSize: '0.74rem', color: '#64748B' }}>
                    {formAllowDownload 
                      ? '✓ Los estudiantes podrán descargar este archivo directamente a su equipo.'
                      : '✗ Modo seguro: los estudiantes solo podrán visualizar el material en la plataforma sin botón de descarga.'}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {formAllowDownload ? (
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#16A34A', background: '#DCFCE7', padding: '3px 8px', borderRadius: '6px' }}>
                      Descargable
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B', background: '#E2E8F0', padding: '3px 8px', borderRadius: '6px' }}>
                      Solo lectura
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn btn-outline"
                  style={{ fontSize: '0.82rem', padding: '0.5rem 1rem' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn btn-primary"
                  style={{ fontSize: '0.82rem', padding: '0.5rem 1.25rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                      <span>Procesando...</span>
                    </>
                  ) : (
                    <span>{modalMode === 'create' ? 'Publicar Recurso' : 'Guardar Cambios'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL VISOR SEGURO DE DOCUMENTO ── */}
      {selectedDoc && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(5px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 10000, padding: '1rem'
        }}>
          <div style={{
            background: '#FFFFFF', borderRadius: '16px', width: '92vw', maxWidth: '1100px', height: '88vh',
            display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{
              padding: '0.85rem 1.25rem', borderBottom: '1px solid #E2E8F0',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FAFBFD'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: 'var(--navy, #14213D)' }}>
                  {selectedDoc.title}
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                  {selectedDoc.isGeneral ? 'Contenido General del Curso' : selectedDoc.classTitle}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => triggerResourceDownload(selectedDoc.url, selectedDoc.title)}
                  title="Descargar archivo en tu equipo"
                  style={{
                    background: 'var(--navy, #14213D)', color: '#FFFFFF', border: 'none',
                    borderRadius: '8px', padding: '0.4rem 0.85rem', fontSize: '0.78rem',
                    fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.35rem'
                  }}
                >
                  <Download size={14} color="var(--gold, #FCA311)" />
                  <span>Descargar</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDoc(null)}
                  style={{ background: '#F1F5F9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={17} />
                </button>
              </div>
            </div>
            <div style={{ flex: 1, position: 'relative', background: '#0F172A' }}>
              {/* Bloqueador invisible sobre la esquina superior derecha para inhabilitar el botón de redirección/pop-out de Google Drive */}
              <div 
                style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  width: '80px',
                  height: '60px',
                  zIndex: 25,
                  background: 'transparent',
                  cursor: 'default'
                }}
                title=""
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
              />

              <iframe
                src={formatEmbedDocUrl(selectedDoc.url)}
                title={selectedDoc.title || 'Visor de Documento'}
                style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                sandbox="allow-scripts allow-same-origin allow-forms"
                allow="autoplay"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
