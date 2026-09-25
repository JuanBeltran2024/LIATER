import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import {
  Paperclip, FileText, Presentation, ExternalLink, Code, Download,
  Eye, Search, Filter, BookOpen, Video, ArrowLeft, ArrowRight,
  Layers, Calendar, Clock, ChevronRight, X, Check, Copy,
  Sparkles, Home, BarChart2, Users, ListTree, FolderDown,
  Plus, Trash2, Edit3, EyeOff, Upload, Link as LinkIcon, Folder,
  AlertCircle, RefreshCw, Info, Lock
} from 'lucide-react';
import { triggerResourceDownload } from '@/utils/resourceUtils';

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
      return <Paperclip size={size} color="var(--navy, #14213D)" />;
  }
}

/* ── HELPER: Etiqueta legible por tipo ── */
function getResourceTypeLabel(type) {
  switch (type) {
    case 'presentation': return 'Presentación / Diapositivas';
    case 'file':
    case 'pdf':
    case 'document': return 'Documento / Lectura';
    case 'link': return 'Enlace de Interés';
    case 'code': return 'Código / Repositorio';
    case 'video': return 'Video / Grabación';
    default: return 'Material de Estudio';
  }
}

/* ── HELPER: Formatear etiqueta combinada de Sesión y Clase ── */
function formatSessionAndClass(sessionTitle, classTitle) {
  const cTitle = classTitle ? classTitle.trim() : '';
  const sTitle = sessionTitle ? sessionTitle.trim() : '';

  if (!sTitle) {
    if (!cTitle) return 'Clase';
    return cTitle.toLowerCase().startsWith('clase') ? cTitle : `Clase: ${cTitle}`;
  }

  const sessionPart = sTitle.toLowerCase().startsWith('sesi') ? sTitle : `Sesión: ${sTitle}`;
  const classPart = cTitle.toLowerCase().startsWith('clase') ? cTitle : `Clase: ${cTitle}`;

  return `${sessionPart} · ${classPart}`;
}

export default function CourseResources() {
  const { programId } = useParams();
  const { currentUser } = useAuth();
  const fileInputRef = useRef(null);

  const cleanProgramId = programId ? decodeURIComponent(programId).replace(/\s+/g, '-').trim() : '';

  const role = currentUser?.role;
  const canManage = role === 'admin' || role === 'teacher';

  const [loading, setLoading] = useState(true);
  const [programTitle, setProgramTitle] = useState('Programa Académico');
  const [programType, setProgramType] = useState('diplomado');
  const [resources, setResources] = useState([]);
  const [classesList, setClassesList] = useState([]);
  const [sessionsList, setSessionsList] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);

  // Filtros y Búsqueda
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'presentation' | 'file' | 'link' | 'code'
  const [sessionFilter, setSessionFilter] = useState('all'); // 'all' | 'general' | sessionId
  const [copiedId, setCopiedId] = useState(null);

  // Modal de Subida / Edición de Recursos
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'
  const [editingResource, setEditingResource] = useState(null);
  const [uploadMode, setUploadMode] = useState('file'); // 'file' (Drive) | 'link'
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

  // Cargar recursos y clases
  const fetchCourseResources = async () => {
    if (!cleanProgramId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // 1. Obtener información del programa
      const { data: progData } = await supabase
        .from('diploma_programs')
        .select('id, title, program_type')
        .eq('id', cleanProgramId)
        .maybeSingle();

      if (progData) {
        setProgramTitle(progData.title || 'Programa Académico');
        setProgramType(progData.program_type || 'diplomado');
        localStorage.setItem('activeProgramId', cleanProgramId);
        if (progData.program_type) {
          localStorage.setItem('activeProgramType', progData.program_type);
        }
        window.dispatchEvent(new Event('programContextChanged'));
      }

      // 2. Obtener todas las clases del programa
      let classesData = [];
      const classMap = {};
      const availableClasses = [];

      try {
        const { data: cData, error: cErr } = await supabase
          .from('class_sessions')
          .select('*')
          .eq('program_id', cleanProgramId)
          .order('order_index', { ascending: true, nullsFirst: false });

        if (cErr) {
          console.warn('Aviso al consultar class_sessions:', cErr);
          const { data: fallbackData } = await supabase
            .from('class_sessions')
            .select('id, title, class_date, order_index, subtopic_id')
            .eq('program_id', cleanProgramId)
            .order('order_index', { ascending: true, nullsFirst: false });
          classesData = fallbackData || [];
        } else {
          classesData = cData || [];
        }
      } catch (e) {
        console.warn('Excepción al consultar clases:', e);
      }

      // 2.1 Obtener módulos del programa (para vincular sesiones si vienen por módulo)
      let modulesData = [];
      const modMap = {};
      try {
        const { data: mData } = await supabase
          .from('modules')
          .select('id, title, order_index')
          .eq('program_id', cleanProgramId)
          .order('order_index', { ascending: true });
        modulesData = mData || [];
        modulesData.forEach(m => {
          modMap[String(m.id)] = m.title;
        });
      } catch {}

      const modIds = modulesData.map(m => m.id);

      // 2.2 Obtener sesiones del programa (tanto de subtopics como de sessions)
      const sessionsMap = new Map();

      // Intento A: subtopics por program_id
      try {
        const { data: subProg } = await supabase
          .from('subtopics')
          .select('id, title, order_index, module_id')
          .eq('program_id', cleanProgramId)
          .order('order_index', { ascending: true });
        (subProg || []).forEach(s => {
          sessionsMap.set(String(s.id), {
            id: String(s.id),
            title: s.title || 'Sesión sin título',
            orderIndex: s.order_index ?? 999,
            moduleId: s.module_id,
            moduleTitle: s.module_id ? (modMap[String(s.module_id)] || null) : null,
            classIds: new Set()
          });
        });
      } catch {}

      // Intento B: subtopics por module_id
      if (modIds.length > 0) {
        try {
          const { data: subMod } = await supabase
            .from('subtopics')
            .select('id, title, order_index, module_id')
            .in('module_id', modIds)
            .order('order_index', { ascending: true });
          (subMod || []).forEach(s => {
            if (!sessionsMap.has(String(s.id))) {
              sessionsMap.set(String(s.id), {
                id: String(s.id),
                title: s.title || 'Sesión sin título',
                orderIndex: s.order_index ?? 999,
                moduleId: s.module_id,
                moduleTitle: s.module_id ? (modMap[String(s.module_id)] || null) : null,
                classIds: new Set()
              });
            }
          });
        } catch {}
      }

      // Intento C: sessions por program_id (si existe la tabla sessions)
      try {
        const { data: sProg } = await supabase
          .from('sessions')
          .select('id, title, order_index, module_id')
          .eq('program_id', cleanProgramId)
          .order('order_index', { ascending: true });
        (sProg || []).forEach(s => {
          if (!sessionsMap.has(String(s.id))) {
            sessionsMap.set(String(s.id), {
              id: String(s.id),
              title: s.title || 'Sesión sin título',
              orderIndex: s.order_index ?? 999,
              moduleId: s.module_id,
              moduleTitle: s.module_id ? (modMap[String(s.module_id)] || null) : null,
              classIds: new Set()
            });
          }
        });
      } catch {}

      // Intento D: IDs de sesión referenciados directamente por las clases cargadas
      const referencedSessionIds = Array.from(new Set(
        classesData
          .map(c => c.subtopic_id ? String(c.subtopic_id) : (c.session_id ? String(c.session_id) : null))
          .filter(id => id && !sessionsMap.has(String(id)))
      ));

      if (referencedSessionIds.length > 0) {
        try {
          const { data: missingSubs } = await supabase
            .from('subtopics')
            .select('id, title, order_index, module_id')
            .in('id', referencedSessionIds);
          (missingSubs || []).forEach(s => {
            sessionsMap.set(String(s.id), {
              id: String(s.id),
              title: s.title || 'Sesión sin título',
              orderIndex: s.order_index ?? 999,
              moduleId: s.module_id,
              moduleTitle: s.module_id ? (modMap[String(s.module_id)] || null) : null,
              classIds: new Set()
            });
          });
        } catch {}

        try {
          const { data: missingSess } = await supabase
            .from('sessions')
            .select('id, title, order_index, module_id')
            .in('id', referencedSessionIds);
          (missingSess || []).forEach(s => {
            if (!sessionsMap.has(String(s.id))) {
              sessionsMap.set(String(s.id), {
                id: String(s.id),
                title: s.title || 'Sesión sin título',
                orderIndex: s.order_index ?? 999,
                moduleId: s.module_id,
                moduleTitle: s.module_id ? (modMap[String(s.module_id)] || null) : null,
                classIds: new Set()
              });
            }
          });
        } catch {}
      }

      // 2.3 Mapear clases vinculándolas con sus sesiones
      classesData.forEach(cls => {
        const sId = cls.subtopic_id ? String(cls.subtopic_id) : (cls.session_id ? String(cls.session_id) : null);
        const sessionObj = sId ? sessionsMap.get(sId) : null;
        const sTitle = sessionObj?.title || null;
        const mTitle = sessionObj?.moduleTitle || (cls.module_id ? modMap[String(cls.module_id)] : null);

        if (sId && sessionObj) {
          sessionObj.classIds.add(cls.id);
        }

        classMap[cls.id] = {
          id: cls.id,
          title: cls.title || 'Clase sin título',
          class_date: cls.class_date,
          order_index: cls.order_index,
          sessionId: sId,
          sessionTitle: sTitle,
          moduleTitle: mTitle,
        };

        availableClasses.push({
          id: cls.id,
          title: cls.title || 'Clase sin título',
          date: cls.class_date,
          orderIndex: cls.order_index,
          sessionId: sId,
          sessionTitle: sTitle
        });
      });

      setClassesList(availableClasses);
      const availableSessions = Array.from(sessionsMap.values()).sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
      setSessionsList(availableSessions);

      // 3. Obtener tanto los recursos vinculados a las clases como los recursos generales del curso
      // Se ejecutan en paralelo evitando .or() con in.() ya que la sintaxis de comas rompe el parser de PostgREST
      const classIds = Object.keys(classMap);
      const queryPromises = [];

      // A) Recursos de clases
      if (classIds.length > 0) {
        let qClasses = supabase
          .from('resources')
          .select('*')
          .in('class_id', classIds);
        if (!canManage) {
          qClasses = qClasses.or('is_visible.is.null,is_visible.eq.true');
        }
        queryPromises.push(qClasses);
      }

      // B) Recursos generales del programa
      let qProgram = supabase
        .from('resources')
        .select('*')
        .eq('program_id', cleanProgramId);
      if (!canManage) {
        qProgram = qProgram.or('is_visible.is.null,is_visible.eq.true');
      }
      queryPromises.push(qProgram);

      const queryResults = await Promise.all(queryPromises);

      const resourcesMap = new Map();
      queryResults.forEach(({ data, error }) => {
        if (error) {
          console.warn('Aviso al consultar recursos:', error);
        }
        (data || []).forEach(r => {
          resourcesMap.set(r.id, r);
        });
      });

      const resData = Array.from(resourcesMap.values()).sort((a, b) => {
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      });

      // Enriquecer cada recurso con indicación de si es General o de Clase y su Sesión
      const enriched = resData.map(r => {
        const isGen = !r.class_id || !classMap[r.class_id];
        const cls = (!isGen && classMap[r.class_id]) ? classMap[r.class_id] : null;

        return {
          ...r,
          isGeneral: isGen,
          classId: isGen ? null : r.class_id,
          classTitle: isGen ? 'Contenido General del Curso' : (cls?.title || 'Clase'),
          classDate: cls?.class_date || null,
          sessionId: cls?.sessionId || null,
          sessionTitle: cls?.sessionTitle || null,
          moduleTitle: cls?.moduleTitle || null,
        };
      });

      setResources(enriched);

    } catch (err) {
      console.error('Error fetching course resources:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourseResources();
  }, [cleanProgramId, canManage]);

  // Contadores
  const generalResources = useMemo(() => resources.filter(r => r.isGeneral), [resources]);
  const classResources = useMemo(() => resources.filter(r => !r.isGeneral), [resources]);

  const counts = useMemo(() => {
    return {
      all: resources.length,
      general: generalResources.length,
      presentation: resources.filter(r => (r.resource_type || r.type) === 'presentation').length,
      file: resources.filter(r => {
        const t = r.resource_type || r.type;
        return t === 'file' || t === 'pdf' || t === 'document';
      }).length,
      link: resources.filter(r => (r.resource_type || r.type) === 'link').length,
      code: resources.filter(r => (r.resource_type || r.type) === 'code').length,
    };
  }, [resources, generalResources]);

  // Filtrado de recursos
  const filteredResources = useMemo(() => {
    return resources.filter(res => {
      // Filtro por tipo
      if (typeFilter !== 'all') {
        const actualType = res.resource_type || res.type;
        if (typeFilter === 'file') {
          if (actualType !== 'file' && actualType !== 'pdf' && actualType !== 'document') return false;
        } else if (actualType !== typeFilter) {
          return false;
        }
      }

      // Filtro por sesión o general
      if (sessionFilter === 'general') {
        if (!res.isGeneral) return false;
      } else if (sessionFilter !== 'all') {
        const targetSession = sessionsList.find(s => String(s.id) === String(sessionFilter));
        const matchesSessionId = res.sessionId && String(res.sessionId) === String(sessionFilter);
        const matchesClassInSession = targetSession && targetSession.classIds && targetSession.classIds.has(res.classId);
        if (!matchesSessionId && !matchesClassInSession) {
          return false;
        }
      }

      // Filtro por texto de búsqueda
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const titleMatch = (res.title || '').toLowerCase().includes(query);
        const descMatch = (res.description || '').toLowerCase().includes(query);
        const classMatch = (res.classTitle || '').toLowerCase().includes(query);
        const sessionMatch = (res.sessionTitle || '').toLowerCase().includes(query);
        const moduleMatch = (res.moduleTitle || '').toLowerCase().includes(query);
        if (!titleMatch && !descMatch && !classMatch && !sessionMatch && !moduleMatch) {
          return false;
        }
      }

      return true;
    });
  }, [resources, typeFilter, sessionFilter, searchQuery, sessionsList]);

  const filteredGeneral = useMemo(() => filteredResources.filter(r => r.isGeneral), [filteredResources]);
  const filteredClass = useMemo(() => filteredResources.filter(r => !r.isGeneral), [filteredResources]);

  const handleCopyLink = (url, id) => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // ── ABRIR MODAL PARA SUBIR / EDITAR ──
  const handleOpenUpload = (defaultDestination = 'general') => {
    setModalMode('create');
    setEditingResource(null);
    setTargetDestination(defaultDestination);
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

  const handleOpenEdit = (res) => {
    setModalMode('edit');
    setEditingResource(res);
    setTargetDestination(res.classId ? String(res.classId) : 'general');
    setUploadMode('link');
    setFormTitle(res.title || '');
    setFormType(res.resource_type || res.type || 'file');
    setFormUrl(res.url || '');
    setFormDescription(res.description || '');
    setFormAllowDownload(Boolean(res.allow_download));
    setSelectedFile(null);
    setModalError('');
    setModalSuccess('');
    setShowModal(true);
  };

  // ── SUBMIT DEL MODAL (CREAR / EDITAR) ──
  const handleSubmitResource = async (e) => {
    e.preventDefault();
    setModalError('');
    setModalSuccess('');

    if (modalMode === 'edit') {
      if (!formTitle.trim()) {
        setModalError('Por favor ingresa un título para el recurso.');
        return;
      }
      if (!formUrl.trim()) {
        setModalError('Por favor proporciona la URL del recurso.');
        return;
      }

      try {
        setIsSubmitting(true);
        const targetClassId = targetDestination === 'general' ? null : targetDestination;
        const updatePayload = {
          title: formTitle.trim(),
          resource_type: formType,
          url: formUrl.trim(),
          description: formDescription ? formDescription.trim() : null,
          class_id: targetClassId,
          program_id: cleanProgramId,
          allow_download: formAllowDownload
        };

        const { error } = await supabase
          .from('resources')
          .update(updatePayload)
          .eq('id', editingResource.id);

        if (error) {
          if (error.message?.includes('allow_download')) {
            console.warn('Columna allow_download no existe aún, actualizando sin ella...');
            delete updatePayload.allow_download;
            const retry = await supabase.from('resources').update(updatePayload).eq('id', editingResource.id);
            if (retry.error) throw retry.error;
          } else {
            throw error;
          }
        }

        setModalSuccess('Material actualizado correctamente.');
        await fetchCourseResources();
        setTimeout(() => setShowModal(false), 1200);
      } catch (err) {
        console.error('Error actualizando recurso:', err);
        setModalError(err.message || 'Error al actualizar el recurso.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // MODO CREACIÓN:
    if (uploadMode === 'file') {
      if (!selectedFile) {
        setModalError('Por favor selecciona un archivo PDF o documento para subir a Google Drive.');
        return;
      }

      try {
        setIsSubmitting(true);
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('programId', cleanProgramId);
        formData.append('classId', targetDestination === 'general' ? 'general' : targetDestination);
        formData.append('resourceType', formType === 'presentation' ? 'presentation' : 'file');
        formData.append('allowDownload', String(formAllowDownload));
        if (formTitle.trim()) {
          formData.append('customTitle', formTitle.trim());
        }

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

        // Si se agregó descripción o se debe asegurar allow_download, actualizar el registro
        if (data?.resource?.id) {
          const updatePayload = { allow_download: formAllowDownload };
          if (formDescription) updatePayload.description = formDescription.trim();
          const { error: upErr } = await supabase
            .from('resources')
            .update(updatePayload)
            .eq('id', data.resource.id);

          if (upErr && upErr.message?.includes('allow_download') && formDescription) {
            await supabase.from('resources').update({ description: formDescription.trim() }).eq('id', data.resource.id);
          }
        }

        setModalSuccess(`✓ Archivo subido con éxito a Google Drive: "${data.formattedFileName || selectedFile.name}"`);
        await fetchCourseResources();
        setTimeout(() => setShowModal(false), 1400);
      } catch (err) {
        console.error('Error subiendo PDF:', err);
        setModalError('Error al subir a Google Drive: ' + (err.message || String(err)));
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // Subida por enlace / URL directa
      if (!formTitle.trim()) {
        setModalError('Por favor ingresa un título para el recurso.');
        return;
      }
      if (!formUrl.trim()) {
        setModalError('Por favor ingresa la URL o enlace web.');
        return;
      }

      try {
        setIsSubmitting(true);
        const targetClassId = targetDestination === 'general' ? null : targetDestination;
        const urlLower = formUrl.toLowerCase();
        let provider = 'external';
        if (urlLower.includes('drive.google.com')) provider = 'drive';
        else if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) provider = 'youtube';

        const insertPayload = {
          title: formTitle.trim(),
          resource_type: formType,
          url: formUrl.trim(),
          description: formDescription ? formDescription.trim() : null,
          class_id: targetClassId,
          program_id: cleanProgramId,
          provider,
          is_visible: true,
          allow_download: formAllowDownload
        };

        const { error } = await supabase
          .from('resources')
          .insert([insertPayload]);

        if (error) {
          if (error.message?.includes('allow_download')) {
            console.warn('Columna allow_download no existe aún, guardando sin ella...');
            delete insertPayload.allow_download;
            const retry = await supabase.from('resources').insert([insertPayload]);
            if (retry.error) throw retry.error;
          } else {
            throw error;
          }
        }

        setModalSuccess('Material añadido exitosamente.');
        await fetchCourseResources();
        setTimeout(() => setShowModal(false), 1200);
      } catch (err) {
        console.error('Error creando recurso por enlace:', err);
        setModalError(err.message || 'Error al guardar el recurso.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  // ── TOGGLE PERMISO DE DESCARGA ──
  const handleToggleAllowDownload = async (res) => {
    try {
      const nextAllow = !(res.allow_download ?? false);
      const { error } = await supabase
        .from('resources')
        .update({ allow_download: nextAllow })
        .eq('id', res.id);

      if (error) {
        if (error.message?.includes('allow_download')) {
          alert('Para alternar descargas, ejecuta la migración SQL en Supabase:\nALTER TABLE resources ADD COLUMN IF NOT EXISTS allow_download boolean NOT NULL DEFAULT false;');
          return;
        }
        throw error;
      }
      await fetchCourseResources();
    } catch (err) {
      console.error('Error cambiando permiso de descarga:', err);
      alert('No se pudo cambiar el permiso de descarga: ' + (err.message || String(err)));
    }
  };

  // ── ELIMINAR RECURSO ──
  const handleDeleteResource = async (res) => {
    const isDrive = res.provider === 'drive' || res.url?.includes('drive.google.com');
    const confirmMsg = isDrive
      ? `¿Deseas eliminar permanentemente "${res.title}"? También se eliminará el archivo en Google Drive.`
      : `¿Deseas eliminar el recurso "${res.title}"?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      if (isDrive && res.url) {
        try {
          await supabase.functions.invoke('upload-pdf-drive', {
            body: { action: 'delete', fileUrl: res.url, resourceId: res.id }
          });
        } catch (dErr) {
          console.warn('Aviso al invocar borrado en drive:', dErr);
        }
      }

      const { error } = await supabase.from('resources').delete().eq('id', res.id);
      if (error) throw error;

      await fetchCourseResources();
    } catch (err) {
      console.error('Error al eliminar recurso:', err);
      alert('Error al eliminar el recurso: ' + (err.message || String(err)));
    }
  };

  // ── TOGGLE VISIBILIDAD ──
  const handleToggleVisibility = async (res) => {
    try {
      const nextVisible = !(res.is_visible ?? true);
      const { error } = await supabase
        .from('resources')
        .update({ is_visible: nextVisible })
        .eq('id', res.id);

      if (error) throw error;
      await fetchCourseResources();
    } catch (err) {
      console.error('Error cambiando visibilidad:', err);
      alert('No se pudo cambiar la visibilidad: ' + (err.message || String(err)));
    }
  };

  const isCourse = programType === 'curso' || programType === 'course';

  if (loading) {
    return (
      <div style={{ width: '100%', padding: '1.5rem 0', animation: 'fadeSlideUp 0.35s ease-out' }}>
        <div className="skeleton" style={{ width: '220px', height: '36px', marginBottom: '1rem', borderRadius: '8px' }} />
        <div className="skeleton" style={{ width: '380px', height: '24px', marginBottom: '2rem', borderRadius: '6px' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="skeleton" style={{ height: '170px', borderRadius: '12px' }} />
          ))}
        </div>
      </div>
    );
  }

  // Renderizador de Tarjeta de Recurso
  const renderResourceCard = (res) => {
    const isDrive = res.url?.includes('drive.google.com') || res.provider === 'drive';
    const resType = res.resource_type || res.type || 'file';
    const isHidden = res.is_visible === false;

    return (
      <div
        key={res.id}
        style={{
          background: isHidden ? '#F8FAFC' : '#FFFFFF',
          borderRadius: '14px',
          border: isHidden ? '1px dashed #CBD5E1' : '1px solid #E2E8F0',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '1rem',
          boxShadow: isHidden ? 'none' : '0 2px 6px rgba(20,33,61,0.03)',
          transition: 'all 0.2s ease',
          position: 'relative',
          opacity: isHidden ? 0.8 : 1
        }}
        onMouseOver={e => {
          if (!isHidden) {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 8px 18px rgba(20,33,61,0.08)';
            e.currentTarget.style.borderColor = '#CBD5E1';
          }
        }}
        onMouseOut={e => {
          if (!isHidden) {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 6px rgba(20,33,61,0.03)';
            e.currentTarget.style.borderColor = '#E2E8F0';
          }
        }}
      >
        <div>
          {/* ENCABEZADO DE TARJETA */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '0.85rem',
            gap: '0.5rem',
            flexWrap: 'wrap'
          }}>
            {/* BADGE DE CLASE O GENERAL */}
            {res.isGeneral ? (
              <span
                style={{
                  background: 'linear-gradient(135deg, rgba(252, 163, 17, 0.18) 0%, rgba(252, 163, 17, 0.08) 100%)',
                  color: 'var(--gold-dark, #b45309)',
                  borderRadius: '8px',
                  padding: '0.3rem 0.65rem',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  border: '1px solid rgba(252, 163, 17, 0.35)'
                }}
              >
                <FolderDown size={13} color="var(--gold-dark, #b45309)" />
                <span>Contenido General del Curso</span>
              </span>
            ) : (
              <Link
                to={`/class/${res.classId}`}
                title={res.sessionTitle ? `${res.sessionTitle} — ${res.classTitle}` : `Ir a la clase: ${res.classTitle}`}
                style={{
                  background: 'linear-gradient(135deg, rgba(20,33,61,0.07) 0%, rgba(20,33,61,0.03) 100%)',
                  color: 'var(--navy, #14213D)',
                  borderRadius: '8px',
                  padding: '0.3rem 0.65rem',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  border: '1px solid rgba(20,33,61,0.12)',
                  transition: 'all 0.15s ease',
                  maxWidth: '72%'
                }}
                onMouseOver={e => {
                  e.currentTarget.style.background = 'var(--navy, #14213D)';
                  e.currentTarget.style.color = '#FFFFFF';
                }}
                onMouseOut={e => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, rgba(20,33,61,0.07) 0%, rgba(20,33,61,0.03) 100%)';
                  e.currentTarget.style.color = 'var(--navy, #14213D)';
                }}
              >
                <Video size={13} color="var(--gold, #FCA311)" />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {formatSessionAndClass(res.sessionTitle, res.classTitle)}
                </span>
              </Link>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              {/* PERMISO DE DESCARGA */}
              {res.allow_download ? (
                <span style={{
                  fontSize: '0.66rem',
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: '6px',
                  background: '#DCFCE7',
                  color: '#15803D',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px'
                }}>
                  <Download size={10} /> Descargable
                </span>
              ) : (
                <span style={{
                  fontSize: '0.66rem',
                  fontWeight: 600,
                  padding: '2px 7px',
                  borderRadius: '6px',
                  background: '#F1F5F9',
                  color: '#64748B',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px'
                }}>
                  <Lock size={10} /> Solo lectura
                </span>
              )}

              {/* INDICADOR DE OCULTO (SOLO TEACHER/ADMIN) */}
              {isHidden && (
                <span style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: '6px',
                  background: '#FEE2E2',
                  color: '#DC2626',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem'
                }}>
                  <EyeOff size={11} /> Oculto
                </span>
              )}

              {/* TIPO DE RECURSO BADGE */}
              <span style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '6px',
                textTransform: 'uppercase',
                background: resType === 'presentation' ? 'rgba(252,163,17,0.18)' : (resType === 'file' || resType === 'pdf') ? '#EFF6FF' : resType === 'link' ? '#F0FDF4' : '#FAF5FF',
                color: resType === 'presentation' ? '#B45309' : (resType === 'file' || resType === 'pdf') ? '#1D4ED8' : resType === 'link' ? '#15803D' : '#7E22CE',
                border: `1px solid ${resType === 'presentation' ? 'rgba(252,163,17,0.3)' : (resType === 'file' || resType === 'pdf') ? '#BFDBFE' : resType === 'link' ? '#BBF7D0' : '#E9D5FF'}`
              }}>
                {resType}
              </span>
            </div>
          </div>

          {/* CUERPO: TÍTULO Y DESCRIPCIÓN */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem' }}>
            <div style={{
              width: '42px', height: '42px', borderRadius: '10px',
              background: res.isGeneral ? 'rgba(252, 163, 17, 0.12)' : '#F8FAFC',
              border: '1px solid #E2E8F0',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, marginTop: '2px'
            }}>
              {getResourceIcon(resType, 20)}
            </div>

            <div style={{ minWidth: 0, flex: 1 }}>
              <h3 style={{
                fontSize: '0.98rem',
                fontWeight: 700,
                color: 'var(--navy, #14213D)',
                margin: '0 0 0.35rem 0',
                lineHeight: 1.35
              }}>
                {res.title}
              </h3>

              {res.description && (
                <p style={{
                  fontSize: '0.82rem',
                  color: 'var(--text-muted, #64748B)',
                  margin: '0 0 0.5rem 0',
                  lineHeight: 1.45,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
                }}>
                  {res.description}
                </p>
              )}

              {/* DETALLES DE SESIÓN / FECHA */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap', fontSize: '0.74rem', color: '#64748B', marginTop: '0.35rem' }}>
                {res.isGeneral ? (
                  <span style={{ color: 'var(--gold-dark, #b45309)', fontWeight: 600 }}>
                    Material transversal
                  </span>
                ) : (
                  <>
                    {res.sessionTitle && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Layers size={11} color="#94A3B8" /> {res.sessionTitle}
                      </span>
                    )}
                    {res.classDate && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Calendar size={11} color="#94A3B8" /> {new Date(res.classDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* BOTONES DE ACCIÓN */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          paddingTop: '0.85rem',
          borderTop: '1px solid #F1F5F9',
          flexWrap: 'wrap'
        }}>
          {/* Botón Principal: Abrir Recurso */}
          <button
            type="button"
            onClick={() => {
              if (isDrive) {
                setSelectedDoc(res);
              } else {
                window.open(res.url, '_blank', 'noopener,noreferrer');
              }
            }}
            style={{
              flex: '1 1 auto',
              background: 'var(--navy, #14213D)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              padding: '0.5rem 0.9rem',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              transition: 'all 0.15s ease'
            }}
            onMouseOver={e => e.currentTarget.style.background = '#000000'}
            onMouseOut={e => e.currentTarget.style.background = 'var(--navy, #14213D)'}
          >
            <Eye size={14} color="var(--gold, #FCA311)" />
            <span>{isDrive ? 'Abrir Material' : 'Abrir Enlace'}</span>
          </button>

          {/* Botón Descargar (si está permitido) */}
          {res.allow_download && (
            <button
              type="button"
              onClick={() => triggerResourceDownload(res.url, res.title)}
              title="Descargar material a tu equipo"
              style={{
                background: '#DCFCE7',
                color: '#15803D',
                border: '1px solid #86EFAC',
                borderRadius: '8px',
                padding: '0.5rem 0.85rem',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem',
                transition: 'all 0.15s ease'
              }}
            >
              <Download size={14} />
              <span>Descargar</span>
            </button>
          )}

          {/* Si es de clase, enlace a la clase */}
          {!res.isGeneral && res.classId && (
            <Link
              to={`/class/${res.classId}`}
              title="Ver clase completa con video y actividades"
              style={{
                background: '#F8FAFC',
                color: 'var(--navy, #14213D)',
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                padding: '0.5rem 0.75rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem',
                transition: 'all 0.15s ease'
              }}
              onMouseOver={e => {
                e.currentTarget.style.background = '#F1F5F9';
                e.currentTarget.style.borderColor = '#94A3B8';
              }}
              onMouseOut={e => {
                e.currentTarget.style.background = '#F8FAFC';
                e.currentTarget.style.borderColor = '#CBD5E1';
              }}
            >
              <span>Clase</span>
              <ArrowRight size={13} />
            </Link>
          )}

          {/* Copiar Enlace */}
          {res.url && (
            <button
              type="button"
              onClick={() => handleCopyLink(res.url, res.id)}
              title="Copiar enlace del recurso"
              style={{
                background: '#FFFFFF',
                color: copiedId === res.id ? '#16A34A' : '#64748B',
                border: `1px solid ${copiedId === res.id ? '#86EFAC' : '#E2E8F0'}`,
                borderRadius: '8px',
                padding: '0.5rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease'
              }}
            >
              {copiedId === res.id ? <Check size={14} /> : <Copy size={14} />}
            </button>
          )}

          {/* ACCIONES DE GESTIÓN PARA DOCENTES Y ADMINS */}
          {canManage && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginLeft: 'auto' }}>
              <button
                type="button"
                onClick={() => handleToggleAllowDownload(res)}
                title={res.allow_download ? 'Descarga permitida a estudiantes (Clic para bloquear)' : 'Descarga bloqueada a estudiantes (Clic para permitir)'}
                style={{
                  background: res.allow_download ? '#DCFCE7' : '#F1F5F9',
                  color: res.allow_download ? '#15803D' : '#64748B',
                  border: `1px solid ${res.allow_download ? '#86EFAC' : '#E2E8F0'}`,
                  borderRadius: '8px',
                  padding: '0.5rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Download size={14} />
              </button>

              <button
                type="button"
                onClick={() => handleToggleVisibility(res)}
                title={res.is_visible !== false ? 'Ocultar material a estudiantes' : 'Hacer visible a estudiantes'}
                style={{
                  background: res.is_visible !== false ? '#F1F5F9' : '#FEF3C7',
                  color: res.is_visible !== false ? '#64748B' : '#B45309',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  padding: '0.5rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {res.is_visible !== false ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>

              <button
                type="button"
                onClick={() => handleOpenEdit(res)}
                title="Editar datos del material"
                style={{
                  background: '#F1F5F9',
                  color: 'var(--navy, #14213D)',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  padding: '0.5rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Edit3 size={14} />
              </button>

              <button
                type="button"
                onClick={() => handleDeleteResource(res)}
                title="Eliminar material"
                style={{
                  background: '#FEE2E2',
                  color: '#DC2626',
                  border: '1px solid #FECACA',
                  borderRadius: '8px',
                  padding: '0.5rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ animation: 'fadeSlideUp 0.35s ease-out' }}>

      {/* ── BREADCRUMB DE RETORNO ── */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Link
            to={role === 'admin' ? `/dashboard/admin/${cleanProgramId}?tab=recursos` : (role === 'teacher' ? `/dashboard/profesor/${cleanProgramId}` : `/dashboard/${cleanProgramId}`)}
            className="btn btn-outline"
            style={{ fontSize: '0.82rem', padding: '0.4rem 0.85rem' }}
          >
            <ArrowLeft size={14} /> {role === 'admin' ? 'Volver al Panel Administrador' : (role === 'teacher' ? 'Volver al Panel Docente' : 'Volver al Inicio')}
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 500 }}>
            <ChevronRight size={14} />
            <Link
              to={role === 'admin' ? `/dashboard/admin/${cleanProgramId}?tab=recursos` : (role === 'teacher' ? `/dashboard/profesor/${cleanProgramId}` : `/dashboard/${cleanProgramId}`)}
              style={{ color: 'var(--text-muted)', textDecoration: 'none' }}
              onMouseOver={e => e.currentTarget.style.color = 'var(--navy)'}
              onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              {programTitle}
            </Link>
            <ChevronRight size={14} />
            <span style={{ color: 'var(--navy)', fontWeight: 700 }}>
              Recursos de Estudio
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* BOTÓN DE SUBIDA PARA PROFESORES / ADMINS */}
          {canManage && (
            <button
              type="button"
              onClick={() => handleOpenUpload('general')}
              style={{
                background: 'var(--gold, #FCA311)',
                color: 'var(--navy, #14213D)',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.84rem',
                padding: '0.45rem 1.1rem',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                boxShadow: '0 2px 8px rgba(252, 163, 17, 0.35)',
                transition: 'all 0.15s ease'
              }}
              onMouseOver={e => e.currentTarget.style.transform = 'translateY(-1px)'}
              onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <Plus size={16} />
              <span>Subir Contenido General</span>
            </button>
          )}

          {/* ACCESO RÁPIDO A MÓDULOS / SESIONES */}
          <Link
            to={isCourse ? `/syllabus/${cleanProgramId}` : `/modules/${cleanProgramId}`}
            className="btn btn-outline"
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <BookOpen size={14} /> {isCourse ? 'Ver Sesiones' : 'Ver Módulos'}
          </Link>
        </div>
      </div>

      {/* ── ENCABEZADO PRINCIPAL ── */}
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <h1 className="page-title" style={{ fontSize: '1.85rem', lineHeight: 1.25, margin: 0 }}>
          Recursos y Materiales de Estudio
        </h1>
        <p className="page-description" style={{ marginTop: '0.4rem', fontSize: '0.9rem' }}>
          Consulta tanto los documentos y guías generales del curso como las presentaciones, lecturas y enlaces correspondientes a cada clase.
        </p>
      </div>

      {/* ── BARRA DE PESTAÑAS DEL CURSO (NAVEGACIÓN INTEGRADA) ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        marginBottom: '1.75rem',
        overflowX: 'auto',
        paddingBottom: '4px',
        borderBottom: '1px solid var(--border-color)',
        scrollbarWidth: 'none'
      }}>
        <Link
          to={role === 'admin' ? `/dashboard/admin/${cleanProgramId}?tab=recursos` : (role === 'teacher' ? `/dashboard/profesor/${cleanProgramId}` : `/dashboard/${cleanProgramId}`)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.55rem 1rem',
            borderRadius: '8px 8px 0 0',
            fontSize: '0.84rem',
            fontWeight: 600,
            textDecoration: 'none',
            background: '#F1F5F9',
            color: 'var(--navy)',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap'
          }}
          onMouseOver={e => e.currentTarget.style.background = '#E2E8F0'}
          onMouseOut={e => e.currentTarget.style.background = '#F1F5F9'}
        >
          <Home size={15} /> {role === 'admin' ? 'Panel Admin' : (role === 'teacher' ? 'Panel Docente' : 'Resumen')}
        </Link>
        <Link
          to={isCourse ? `/syllabus/${cleanProgramId}` : `/modules/${cleanProgramId}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.55rem 1rem',
            borderRadius: '8px 8px 0 0',
            fontSize: '0.84rem',
            fontWeight: 600,
            textDecoration: 'none',
            background: '#F1F5F9',
            color: 'var(--navy)',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap'
          }}
          onMouseOver={e => e.currentTarget.style.background = '#E2E8F0'}
          onMouseOut={e => e.currentTarget.style.background = '#F1F5F9'}
        >
          {isCourse ? <ListTree size={15} /> : <BookOpen size={15} />}
          {isCourse ? 'Sesiones' : 'Módulos'}
        </Link>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.55rem 1.1rem',
            borderRadius: '8px 8px 0 0',
            fontSize: '0.84rem',
            fontWeight: 700,
            background: 'var(--navy, #14213D)',
            color: '#FFFFFF',
            borderBottom: '3px solid var(--gold, #FCA311)',
            whiteSpace: 'nowrap'
          }}
        >
          <Paperclip size={15} color="var(--gold, #FCA311)" /> Recursos y Materiales ({resources.length})
        </div>
        <Link
          to={`/resultados/${cleanProgramId}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.55rem 1rem',
            borderRadius: '8px 8px 0 0',
            fontSize: '0.84rem',
            fontWeight: 600,
            textDecoration: 'none',
            background: '#F1F5F9',
            color: 'var(--navy)',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap'
          }}
          onMouseOver={e => e.currentTarget.style.background = '#E2E8F0'}
          onMouseOut={e => e.currentTarget.style.background = '#F1F5F9'}
        >
          <BarChart2 size={15} /> Mis Resultados
        </Link>
        <Link
          to={`/teachers/${cleanProgramId}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.55rem 1rem',
            borderRadius: '8px 8px 0 0',
            fontSize: '0.84rem',
            fontWeight: 600,
            textDecoration: 'none',
            background: '#F1F5F9',
            color: 'var(--navy)',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap'
          }}
          onMouseOver={e => e.currentTarget.style.background = '#E2E8F0'}
          onMouseOut={e => e.currentTarget.style.background = '#F1F5F9'}
        >
          <Users size={15} /> Profesores
        </Link>
      </div>

      {/* ── BARRA DE BÚSQUEDA Y FILTROS ── */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '14px',
        padding: '1.25rem',
        border: '1px solid #E2E8F0',
        marginBottom: '1.75rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        boxShadow: '0 1px 3px rgba(20,33,61,0.03)'
      }}>
        {/* FILA SUPERIOR: BUSCADOR + SELECTOR DE DESTINO (GENERAL / CLASE) */}
        <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Buscador de texto */}
          <div style={{
            position: 'relative',
            flex: '1 1 280px',
            minWidth: '240px'
          }}>
            <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar por material, guía, tema o clase..."
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem 0.65rem 2.35rem',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '0.86rem',
                outline: 'none',
                background: '#FAFBFD',
                transition: 'border-color 0.15s ease'
              }}
              onFocus={e => e.currentTarget.style.borderColor = 'var(--gold, #FCA311)'}
              onBlur={e => e.currentTarget.style.borderColor = '#CBD5E1'}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                  background: 'transparent', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: '2px'
                }}
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Selector de Ámbito / Sesión */}
          <div style={{ flex: '0 1 340px', minWidth: '240px' }}>
            <select
              value={sessionFilter}
              onChange={e => setSessionFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '0.84rem',
                background: '#FAFBFD',
                color: 'var(--navy, #14213D)',
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="all">Todo el Material ({resources.length})</option>
              <option value="general">Contenido General del Curso ({generalResources.length})</option>
              {sessionsList.length > 0 && (
                <optgroup label="Filtrar por Sesión">
                  {sessionsList.map(s => {
                    const count = resources.filter(r => r.sessionId === s.id || (s.classIds && s.classIds.has(r.classId))).length;
                    return (
                      <option key={s.id} value={s.id}>
                        {s.title} ({count} {count === 1 ? 'material' : 'materiales'})
                      </option>
                    );
                  })}
                </optgroup>
              )}
            </select>
          </div>
        </div>

        {/* FILA INFERIOR: FILTROS TIPO PILL */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid #F1F5F9' }}>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: 'Todos', count: counts.all },
              { id: 'presentation', label: 'Presentaciones', count: counts.presentation },
              { id: 'file', label: 'Lecturas / PDF', count: counts.file },
              { id: 'link', label: 'Enlaces', count: counts.link },
              { id: 'code', label: 'Código / Repos', count: counts.code },
            ].map(f => {
              const isSelected = typeFilter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setTypeFilter(f.id)}
                  style={{
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.4rem 0.85rem',
                    fontSize: '0.8rem',
                    fontWeight: isSelected ? 700 : 500,
                    background: isSelected ? 'var(--navy, #14213D)' : '#F1F5F9',
                    color: isSelected ? '#FFFFFF' : 'var(--navy, #14213D)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span>{f.label}</span>
                  <span style={{
                    fontSize: '0.7rem',
                    padding: '1px 6px',
                    borderRadius: '9999px',
                    background: isSelected ? 'rgba(252,163,17,0.35)' : '#E2E8F0',
                    color: isSelected ? 'var(--gold, #FCA311)' : '#64748B',
                    fontWeight: 700
                  }}>
                    {f.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.78rem', color: '#64748B' }}>
              Mostrando <strong>{filteredResources.length}</strong> de {resources.length} recursos
            </span>
            {canManage && (
              <button
                type="button"
                onClick={() => {
                  const targetCls = sessionFilter !== 'all' && sessionFilter !== 'general'
                    ? (classesList.find(c => String(c.sessionId) === String(sessionFilter))?.id || classesList[0]?.id || 'general')
                    : 'general';
                  handleOpenUpload(targetCls);
                }}
                className="btn btn-outline"
                style={{ fontSize: '0.76rem', padding: '0.25rem 0.6rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
              >
                <Plus size={13} /> Subir Material
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── CONTENIDO PRINCIPAL: SECCIÓN GENERAL Y POR CLASE ── */}
      {filteredResources.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '3.5rem 1.5rem',
          background: '#FFFFFF',
          borderRadius: '16px',
          border: '1px dashed #CBD5E1',
          boxShadow: '0 1px 3px rgba(20,33,61,0.02)'
        }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '14px',
            background: '#F1F5F9', display: 'flex', alignItems: 'center',
            justifyContent: 'center', margin: '0 auto 1rem', color: '#94A3B8'
          }}>
            <Paperclip size={26} />
          </div>
          <h3 style={{ color: 'var(--navy, #14213D)', margin: '0 0 0.4rem 0', fontWeight: 700, fontSize: '1.15rem' }}>
            {resources.length === 0 ? 'No hay recursos cargados aún' : 'No se encontraron recursos con los filtros aplicados'}
          </h3>
          <p style={{ color: 'var(--text-muted, #64748B)', fontSize: '0.88rem', margin: 0, maxWidth: '460px', marginInline: 'auto' }}>
            {resources.length === 0
              ? 'Los profesores y administradores publicarán las guías generales, lecturas y presentaciones a lo largo del curso.'
              : 'Prueba buscando con otro término o seleccionando otra categoría o sesión en los filtros superiores.'
            }
          </p>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginTop: '1.25rem' }}>
            {(searchQuery || typeFilter !== 'all' || sessionFilter !== 'all') && (
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setTypeFilter('all'); setSessionFilter('all'); }}
                className="btn btn-outline"
                style={{ fontSize: '0.8rem', padding: '0.45rem 1rem' }}
              >
                Restablecer filtros
              </button>
            )}
            {canManage && (
              <button
                type="button"
                onClick={() => handleOpenUpload('general')}
                className="btn btn-primary"
                style={{ fontSize: '0.8rem', padding: '0.45rem 1.1rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <Plus size={14} /> Subir Material General
              </button>
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>

          {/* ═════════════════════════════════════════════════════════════
              SECCIÓN 1: CONTENIDO GENERAL DEL CURSO (DESTACADO)
             ═════════════════════════════════════════════════════════════ */}
          {(sessionFilter === 'all' || sessionFilter === 'general') && (
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1rem',
                flexWrap: 'wrap',
                gap: '0.5rem',
                paddingBottom: '0.6rem',
                borderBottom: '2px solid rgba(252, 163, 17, 0.4)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '10px',
                    background: 'linear-gradient(135deg, var(--navy, #14213D) 0%, #1e3a8a 100%)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FCA311'
                  }}>
                    <FolderDown size={18} />
                  </div>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '1.18rem', fontWeight: 800, color: 'var(--navy, #14213D)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span>Contenido General del Curso</span>
                      <span style={{
                        fontSize: '0.72rem',
                        padding: '2px 8px',
                        borderRadius: '999px',
                        background: 'rgba(252, 163, 17, 0.2)',
                        color: 'var(--gold-dark, #b45309)',
                        fontWeight: 700
                      }}>
                        {filteredGeneral.length} {filteredGeneral.length === 1 ? 'material' : 'materiales'}
                      </span>
                    </h2>
                    <span style={{ fontSize: '0.78rem', color: '#64748B' }}>
                      Guías académicas, bibliografía general, enlaces a software y recursos que aplican a todo el programa.
                    </span>
                  </div>
                </div>

                {canManage && (
                  <button
                    type="button"
                    onClick={() => handleOpenUpload('general')}
                    style={{
                      background: 'rgba(252, 163, 17, 0.15)',
                      color: 'var(--gold-dark, #b45309)',
                      border: '1px solid rgba(252, 163, 17, 0.4)',
                      borderRadius: '8px',
                      padding: '0.35rem 0.85rem',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseOver={e => e.currentTarget.style.background = 'rgba(252, 163, 17, 0.25)'}
                    onMouseOut={e => e.currentTarget.style.background = 'rgba(252, 163, 17, 0.15)'}
                  >
                    <Plus size={14} />
                    <span>Agregar Material General</span>
                  </button>
                )}
              </div>

              {filteredGeneral.length === 0 ? (
                <div style={{
                  padding: '1.5rem',
                  borderRadius: '12px',
                  background: '#FAFBFD',
                  border: '1px dashed #CBD5E1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  flexWrap: 'wrap'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Info size={20} color="#64748B" />
                    <div>
                      <h4 style={{ margin: 0, fontSize: '0.88rem', color: 'var(--navy, #14213D)', fontWeight: 700 }}>
                        Aún no se ha publicado contenido general del curso
                      </h4>
                      <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748B' }}>
                        Los profesores pueden subir guías de laboratorio, enlaces a software o documentos transversales aquí.
                      </p>
                    </div>
                  </div>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => handleOpenUpload('general')}
                      className="btn btn-primary"
                      style={{ fontSize: '0.78rem', padding: '0.4rem 0.85rem' }}
                    >
                      <Plus size={13} /> Subir ahora
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 360px), 1fr))', gap: '1.25rem' }}>
                  {filteredGeneral.map(res => renderResourceCard(res))}
                </div>
              )}
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════
              SECCIÓN 2: MATERIALES POR SESIÓN O CLASE
             ═════════════════════════════════════════════════════════════ */}
          {sessionFilter !== 'general' && filteredClass.length > 0 && (
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1rem',
                flexWrap: 'wrap',
                gap: '0.5rem',
                paddingBottom: '0.6rem',
                borderBottom: '1px solid #E2E8F0'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '10px',
                    background: '#F1F5F9',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--navy, #14213D)'
                  }}>
                    <Layers size={18} />
                  </div>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '1.18rem', fontWeight: 800, color: 'var(--navy, #14213D)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span>
                        {sessionFilter !== 'all'
                          ? (sessionsList.find(s => String(s.id) === String(sessionFilter))?.title || 'Materiales de la Sesión')
                          : 'Materiales por Sesión'}
                      </span>
                      <span style={{
                        fontSize: '0.72rem',
                        padding: '2px 8px',
                        borderRadius: '999px',
                        background: '#F1F5F9',
                        color: 'var(--navy, #14213D)',
                        fontWeight: 700
                      }}>
                        {filteredClass.length} {filteredClass.length === 1 ? 'material' : 'materiales'}
                      </span>
                    </h2>
                    <span style={{ fontSize: '0.78rem', color: '#64748B' }}>
                      {sessionFilter !== 'all'
                        ? 'Presentaciones, lecturas y recursos asignados a esta sesión.'
                        : 'Presentaciones y lecturas asociadas a sesiones de clase específicas.'}
                    </span>
                  </div>
                </div>

                {canManage && (
                  <button
                    type="button"
                    onClick={() => {
                      if (sessionFilter !== 'all' && sessionFilter !== 'general') {
                        const targetSession = sessionsList.find(s => String(s.id) === String(sessionFilter));
                        const firstClassId = targetSession?.classIds ? Array.from(targetSession.classIds)[0] : null;
                        handleOpenUpload(firstClassId || classesList[0]?.id || 'general');
                      } else {
                        handleOpenUpload(classesList[0]?.id || 'general');
                      }
                    }}
                    className="btn btn-outline"
                    style={{ fontSize: '0.78rem', padding: '0.35rem 0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <Plus size={13} /> Subir Material a Clase
                  </button>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 360px), 1fr))', gap: '1.25rem' }}>
                {filteredClass.map(res => renderResourceCard(res))}
              </div>
            </div>
          )}

        </div>
      )}

      {/* ── MODAL DE SUBIDA / EDICIÓN DE RECURSOS (DOCENTE / ADMIN) ── */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '560px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
            animation: 'fadeSlideUp 0.2s ease-out'
          }}>
            {/* Header del Modal */}
            <div style={{
              padding: '1.1rem 1.4rem',
              borderBottom: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#FAFBFD'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{
                  padding: '6px', borderRadius: '8px',
                  background: 'rgba(252, 163, 17, 0.15)',
                  color: 'var(--gold-dark, #b45309)'
                }}>
                  {modalMode === 'edit' ? <Edit3 size={18} /> : <Plus size={18} />}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--navy, #14213D)' }}>
                    {modalMode === 'edit' ? 'Editar Material de Estudio' : 'Subir Contenido o Material'}
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                    {modalMode === 'edit' ? 'Modifica los datos del recurso' : 'Publica material general o específico para una clase'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSubmitResource} style={{ padding: '1.4rem', display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>

              {/* Mensajes de Alerta */}
              {modalError && (
                <div style={{
                  padding: '0.75rem 1rem', borderRadius: '8px', background: '#FEE2E2',
                  border: '1px solid #FECACA', color: '#B91C1C', fontSize: '0.82rem',
                  display: 'flex', alignItems: 'flex-start', gap: '0.5rem'
                }}>
                  <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>{modalError}</span>
                </div>
              )}

              {modalSuccess && (
                <div style={{
                  padding: '0.75rem 1rem', borderRadius: '8px', background: '#DCFCE7',
                  border: '1px solid #BBF7D0', color: '#15803D', fontSize: '0.82rem',
                  display: 'flex', alignItems: 'flex-start', gap: '0.5rem'
                }}>
                  <Check size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>{modalSuccess}</span>
                </div>
              )}

              {/* DESTINO DEL RECURSO: GENERAL O CLASE ESPECÍFICA */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy, #14213D)', marginBottom: '0.4rem' }}>
                  Destino del Material <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <select
                  value={targetDestination}
                  onChange={e => setTargetDestination(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    background: targetDestination === 'general' ? '#FFFBEB' : '#FAFBFD',
                    color: 'var(--navy, #14213D)',
                    outline: 'none'
                  }}
                >
                  <option value="general">Contenido General del Curso (Aplica a todo el programa)</option>
                  {classesList.length > 0 && (
                    <optgroup label="Clases Específicas">
                      {classesList.map(c => (
                        <option key={c.id} value={c.id}>
                          {formatSessionAndClass(c.sessionTitle, c.title)}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <span style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '0.25rem', display: 'block' }}>
                  {targetDestination === 'general'
                    ? 'Este material se mostrará en la sección "Contenido General del Curso" disponible para todos los inscritos.'
                    : 'Este material se asociará a la clase seleccionada y aparecerá también en el visor de esa clase.'}
                </span>
              </div>

              {/* SELECTOR DE MODO DE SUBIDA (SOLO EN CREACIÓN) */}
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
                        padding: '0.65rem 0.75rem',
                        borderRadius: '8px',
                        border: uploadMode === 'file' ? '2px solid var(--gold, #FCA311)' : '1px solid #CBD5E1',
                        background: uploadMode === 'file' ? 'rgba(252, 163, 17, 0.08)' : '#FAFBFD',
                        color: uploadMode === 'file' ? 'var(--navy, #14213D)' : '#64748B',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.4rem',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <Upload size={15} />
                      <span>Subir PDF</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setUploadMode('link')}
                      style={{
                        padding: '0.65rem 0.75rem',
                        borderRadius: '8px',
                        border: uploadMode === 'link' ? '2px solid var(--gold, #FCA311)' : '1px solid #CBD5E1',
                        background: uploadMode === 'link' ? 'rgba(252, 163, 17, 0.08)' : '#FAFBFD',
                        color: uploadMode === 'link' ? 'var(--navy, #14213D)' : '#64748B',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.4rem',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <LinkIcon size={15} />
                      <span>Enlace o URL Web</span>
                    </button>
                  </div>
                </div>
              )}

              {/* TIPO DE RECURSO */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy, #14213D)', marginBottom: '0.4rem' }}>
                  Categoría del Recurso <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <select
                  value={formType}
                  onChange={e => setFormType(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.84rem',
                    background: '#FAFBFD',
                    outline: 'none'
                  }}
                >
                  <option value="file">Documento / Lectura / Guía (PDF)</option>
                  <option value="presentation">Presentación / Diapositivas</option>
                  <option value="link">Enlace de Interés / Plataforma</option>
                  <option value="code">Código / Repositorio / Software</option>
                </select>
              </div>

              {/* MODO ARCHIVO: DROPZONE */}
              {modalMode === 'create' && uploadMode === 'file' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy, #14213D)', marginBottom: '0.4rem' }}>
                    Archivo PDF a subir <span style={{ color: '#DC2626' }}>*</span>
                  </label>
                  <div
                    onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={e => {
                      e.preventDefault();
                      setIsDragOver(false);
                      const f = e.dataTransfer.files?.[0];
                      if (f) {
                        setSelectedFile(f);
                        if (!formTitle.trim()) {
                          setFormTitle(f.name.replace(/\.[^/.]+$/, ''));
                        }
                      }
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: isDragOver ? '2px dashed var(--gold, #FCA311)' : '2px dashed #CBD5E1',
                      background: isDragOver ? 'rgba(252, 163, 17, 0.05)' : '#F8FAFC',
                      borderRadius: '12px',
                      padding: '1.5rem',
                      textAlign: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,.ppt,.pptx,.zip"
                      style={{ display: 'none' }}
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) {
                          setSelectedFile(f);
                          if (!formTitle.trim()) {
                            setFormTitle(f.name.replace(/\.[^/.]+$/, ''));
                          }
                        }
                      }}
                    />
                    <Upload size={28} color={selectedFile ? 'var(--gold, #FCA311)' : '#94A3B8'} style={{ margin: '0 auto 0.5rem' }} />
                    {selectedFile ? (
                      <div>
                        <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--navy, #14213D)' }}>
                          {selectedFile.name}
                        </span>
                        <span style={{ fontSize: '0.74rem', color: '#64748B', display: 'block', marginTop: '2px' }}>
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB · Clic para cambiar de archivo
                        </span>
                      </div>
                    ) : (
                      <div>
                        <span style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--navy, #14213D)' }}>
                          Haz clic o arrastra un archivo PDF aquí
                        </span>
                        <span style={{ fontSize: '0.74rem', color: '#94A3B8', display: 'block', marginTop: '2px' }}>
                          Se guardará automáticamente en la carpeta de Google Drive del curso
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TÍTULO */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy, #14213D)', marginBottom: '0.4rem' }}>
                  Título del Material {uploadMode === 'link' && <span style={{ color: '#DC2626' }}>*</span>}
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder={uploadMode === 'file' ? 'Opcional (usa el nombre del archivo si se deja vacío)' : 'Ej: Guía Docente del Curso, Enlace a Google Colab...'}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.85rem',
                    outline: 'none',
                    background: '#FAFBFD'
                  }}
                />
              </div>

              {/* URL (SOLO SI MODO ENLACE O EDICIÓN) */}
              {(modalMode === 'edit' || uploadMode === 'link') && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy, #14213D)', marginBottom: '0.4rem' }}>
                    URL / Enlace del Recurso <span style={{ color: '#DC2626' }}>*</span>
                  </label>
                  <input
                    type="url"
                    value={formUrl}
                    onChange={e => setFormUrl(e.target.value)}
                    placeholder="https://drive.google.com/... o https://github.com/..."
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '0.85rem',
                      outline: 'none',
                      background: '#FAFBFD'
                    }}
                  />
                </div>
              )}

              {/* DESCRIPCIÓN */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy, #14213D)', marginBottom: '0.4rem' }}>
                  Descripción o Notas (Opcional)
                </label>
                <textarea
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  rows={2}
                  placeholder="Explica brevemente para qué sirve o cómo deben usar este material los estudiantes..."
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.83rem',
                    outline: 'none',
                    background: '#FAFBFD',
                    resize: 'vertical'
                  }}
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
                      ? '✓ Los estudiantes podrán descargar este material a su dispositivo.'
                      : '✗ Modo protegido: los estudiantes solo podrán visualizar el material en la plataforma sin descargarlo.'}
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

              {/* BOTONES DEL MODAL */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setShowModal(false)}
                  className="btn btn-outline"
                  style={{ fontSize: '0.84rem', padding: '0.55rem 1.1rem' }}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn btn-primary"
                  style={{
                    fontSize: '0.84rem',
                    padding: '0.55rem 1.35rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    opacity: isSubmitting ? 0.7 : 1
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} />
                      <span>{modalMode === 'edit' ? 'Guardando...' : uploadMode === 'file' ? 'Subiendo a Drive...' : 'Publicando...'}</span>
                    </>
                  ) : (
                    <>
                      {modalMode === 'edit' ? <Check size={15} /> : <Upload size={15} />}
                      <span>{modalMode === 'edit' ? 'Guardar Cambios' : 'Publicar Material'}</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ── MODAL VISOR DE DOCUMENTOS (GOOGLE DRIVE / PRESENTACIÓN) ── */}
      {selectedDoc && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '1050px',
            height: '92vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
            animation: 'fadeSlideUp 0.25s ease-out'
          }}>
            {/* Header del Visor */}
            <div style={{
              padding: '0.85rem 1.25rem',
              borderBottom: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              background: '#FAFBFD'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                <div style={{
                  padding: '6px', borderRadius: '8px',
                  background: 'rgba(252, 163, 17, 0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  {getResourceIcon(selectedDoc.resource_type || selectedDoc.type, 18)}
                </div>
                <div style={{ minWidth: 0 }}>
                  <h3 style={{
                    margin: 0, fontSize: '0.98rem', fontWeight: 800,
                    color: 'var(--navy, #14213D)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                  }}>
                    {selectedDoc.title}
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#64748B' }}>
                    {selectedDoc.isGeneral ? (
                      <span style={{ color: 'var(--gold-dark, #b45309)', fontWeight: 700 }}>
                        Contenido General del Curso
                      </span>
                    ) : (
                      <>Clase: <strong>{selectedDoc.classTitle}</strong></>
                    )}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                {(selectedDoc.allow_download || canManage) && (
                  <button
                    type="button"
                    onClick={() => triggerResourceDownload(selectedDoc.url, selectedDoc.title)}
                    title="Descargar material a tu equipo"
                    style={{
                      background: 'var(--navy, #14213D)',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '0.45rem 0.85rem',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem'
                    }}
                  >
                    <Download size={14} color="var(--gold, #FCA311)" />
                    <span>Descargar</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedDoc(null)}
                  style={{
                    background: '#F1F5F9',
                    border: 'none',
                    borderRadius: '50%',
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#64748B',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseOver={e => e.currentTarget.style.background = '#E2E8F0'}
                  onMouseOut={e => e.currentTarget.style.background = '#F1F5F9'}
                >
                  <X size={17} />
                </button>
              </div>
            </div>

            {/* Iframe Seguro para Documento */}
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
