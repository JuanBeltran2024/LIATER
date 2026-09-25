import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { updateDoubtStatus } from '@/services/doubtService';
import { formatClassDate, isClassLiveOrSoon, getGoogleCalendarUrl } from '@/utils/dateUtils';
import { extractYouTubeId, formatYouTubeUrls, linkYouTubeVideoToClass } from '@/services/youtubeAutomationService';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import {
  CalendarPlus,
  BookOpen, Video, FileText, Megaphone, Presentation,
  Plus, Upload, Link as LinkIcon, Clock, CheckCircle2,
  CalendarDays, Timer, ShieldAlert, Eye, Pencil, Trash2,
  AlertCircle, Info, Layers, X, User, MessageSquare, Users,
  Search, Filter, Check, Archive, RefreshCw, FileCheck,
  Sparkles, Bot, CheckCheck, XCircle, ChevronDown, ChevronUp,
  Edit3, EyeOff, Save, PlusCircle, ExternalLink, Download,
  ChevronLeft, ChevronRight, Award, GraduationCap, Percent,
  Calendar, FileSpreadsheet, Folder, Brain, BarChart3,
  TrendingUp, Target, Lightbulb, Activity, HelpCircle,
  AlertTriangle, Star, Mail, Copy, Paperclip, FolderDown,
  Lock
} from 'lucide-react';
import { triggerResourceDownload } from '@/utils/resourceUtils';

import './TeacherPanel.css';
import AdminClassReinforcement from '@/components/admin/AdminClassReinforcement';
import DeleteAnnouncementModal from '@/components/common/DeleteAnnouncementModal';

const TeacherContext = React.createContext(null);
const useTeacherContext = () => React.useContext(TeacherContext);

function formatEmbedDocUrl(url) {
  if (!url) return '';
  let trimmed = url.trim();
  if (trimmed.includes('drive.google.com')) {
    if (trimmed.includes('/preview')) return trimmed;
    return trimmed.replace(/\/view.*$/, '/preview').replace(/\/edit.*$/, '/preview');
  }
  return trimmed;
}

function TypePill({ type }) {
  const labels = {
    presentation: 'Presentación',
    reading: 'Lectura',
    exercise: 'Ejercicio',
    document: 'Documento',
    code: 'Código',
    link: 'Enlace',
    other: 'Otro'
  };
  return (
    <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.45rem', borderRadius: '4px', background: '#F1F5F9', color: '#475569', fontWeight: 600 }}>
      {labels[type] || type || 'Recurso'}
    </span>
  );
}

/* ─────────────────────────────────────────
   MODAL: DETALLE Y GESTIÓN DE CLASE
   Fases: PRE-CLASE | GRABACIÓN | ACTIVIDAD IA
───────────────────────────────────────── */
function ClassDetailModal({ selectedClass, allClasses, onClose, onClassUpdated, initialSection = 'preclass' }) {
  const { currentProgram } = useTeacherContext();
  const { currentUser } = useAuth();
  const [activeSection, setActiveSection] = useState(initialSection || 'preclass'); // 'preclass' | 'recording' | 'activity'
  const [selectedDoc, setSelectedDoc] = useState(null);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  useEffect(() => {
    if (initialSection) {
      setActiveSection(initialSection);
    }
  }, [initialSection, selectedClass?.id]);
  
  // — PRE-CLASE: Materiales —
  const [materials, setMaterials]         = useState([]);
  const [matLoading, setMatLoading]       = useState(true);
  const [matError, setMatError]           = useState('');
  const [editId, setEditId]               = useState(null);
  const [matTitle, setMatTitle]           = useState('');
  const [matType, setMatType]             = useState('presentation');
  const [matProvider, setMatProvider]     = useState('drive');
  const [matUrl, setMatUrl]               = useState('');
  const [submitting, setSubmitting]       = useState(false);
  const [activeForm, setActiveForm]       = useState(null); // 'presentation' | 'complementary' | null
  const [uploadFile, setUploadFile]       = useState(null);
  const [uploadMode, setUploadMode]       = useState('file'); // 'file' | 'link'
  const [uploadingPdf, setUploadingPdf]   = useState(false);
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState('');
  const [isDragOver, setIsDragOver]       = useState(false);

  // — PRE-CLASE: Info de clase —
  const [classTitle, setClassTitle]       = useState(selectedClass?.title || '');
  const [classDesc, setClassDesc]         = useState(selectedClass?.description || '');
  const [savingInfo, setSavingInfo]       = useState(false);
  const [infoMsg, setInfoMsg]             = useState('');

  // — ACTIVIDAD IA —
  const [draft, setDraft]                 = useState(null);
  const [draftLoading, setDraftLoading]   = useState(true);
  const [draftError, setDraftError]       = useState('');
  const [editingQuestions, setEditingQuestions] = useState(false);
  const [localQuestions, setLocalQuestions]     = useState([]);
  const [maxAttempts, setMaxAttempts]           = useState(1);
  const [actionLoading, setActionLoading]       = useState(null);
  const [activityMsg, setActivityMsg]           = useState('');
  const [activityStats, setActivityStats]       = useState(null);

  // — GRABACIÓN YOUTUBE Y AUTOMATIZACIÓN —
  const [ytInput, setYtInput]                 = useState(selectedClass?.video_url || '');
  const [ytLinking, setYtLinking]             = useState(false);
  const [ytMsg, setYtMsg]                     = useState('');
  const [showAutomationHelp, setShowAutomationHelp] = useState(false);

  const detectedYtId = extractYouTubeId(ytInput);

  const handleLinkYouTubeVideo = async (e) => {
    if (e) e.preventDefault();
    if (!ytInput.trim()) return;
    setYtLinking(true);
    setYtMsg('');

    const res = await linkYouTubeVideoToClass(selectedClass.id, ytInput);
    if (res.success) {
      setYtMsg(`✓ Video vinculado exitosamente (ID de YouTube: ${res.data.youtubeId || 'Extraído'})`);
      if (selectedClass) {
        selectedClass.video_url = res.data.watchUrl;
        selectedClass.status = 'completed';
      }
      if (onClassUpdated) onClassUpdated();
    } else {
      setYtMsg(`Error: ${res.error}`);
    }
    setYtLinking(false);
  };

  if (!selectedClass) return null;

  const isPastClass = selectedClass?.class_date ? new Date(selectedClass.class_date) < new Date() : false;

  // Determina el estado de ciclo de vida de la clase
  const classStatus = (() => {
    if (!selectedClass || !selectedClass.class_date) return 'upcoming';
    const now = new Date();
    const classDate = new Date(selectedClass.class_date);
    if (isNaN(classDate.getTime())) return 'upcoming';
    const diff = classDate - now;
    if (diff > 0 && diff < 60 * 60 * 1000) return 'live';   // próxima hora
    if (diff > 0) return 'upcoming';
    
    // Lógica para completada vs pendiente si ya pasó la fecha
    const hasVideo = !!selectedClass.video_url;
    let isActPublished = false;
    if (activityStats) {
      isActPublished = !!activityStats.isPublished;
    } else if (selectedClass.has_published_activity) {
      isActPublished = true;
    } else if (Array.isArray(selectedClass.class_activities)) {
      isActPublished = selectedClass.class_activities.some(a => a.is_published);
    } else if (Array.isArray(selectedClass.activity_drafts)) {
      isActPublished = selectedClass.activity_drafts.some(d => d.status === 'approved' || d.status === 'published');
    } else if (draft) {
      isActPublished = draft.status === 'approved' || draft.status === 'published';
    }
    
    if (hasVideo && isActPublished) return 'completed';
    return 'pending';
  })();

  const STATUS_LABELS = {
    upcoming:  { label: 'Programada',  bg: 'rgba(255,255,255,0.15)', color: '#FFFFFF', border: 'rgba(255,255,255,0.3)' },
    live:      { label: '🔴 EN VIVO',  bg: '#FEE2E2',                color: '#DC2626', border: 'rgba(220,38,38,0.4)' },
    completed: { label: 'Finalizada',  bg: '#DCFCE7',                color: '#007A2E', border: 'rgba(0,122,46,0.3)' },
    pending:   { label: 'Pendiente',   bg: '#FEF3C7',                color: '#92400E', border: 'rgba(245,158,11,0.4)' },
  };
  const statusInfo = STATUS_LABELS[classStatus] || STATUS_LABELS.upcoming;

  // ── FETCH MATERIALES ──
  const fetchMaterials = async () => {
    setMatLoading(true);
    try {
      const { data, error } = await supabase
        .from('resources')
        .select('*')
        .eq('class_id', selectedClass.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setMaterials(data || []);
    } catch (err) {
      setMatError(err.message);
    } finally {
      setMatLoading(false);
    }
  };

  // ── FETCH BORRADOR IA + STATS ──
  const fetchDraftAndStats = async () => {
    setDraftLoading(true);
    try {
      // Borrador IA para esta clase
      const { data: draftData } = await supabase
        .from('activity_drafts')
        .select('*')
        .eq('class_id', selectedClass.id)
        .neq('status', 'rejected')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setDraft(draftData || null);
      if (draftData?.draft_data?.questions) {
        setLocalQuestions(draftData.draft_data.questions.map((q, i) => ({ ...q, _key: i })));
      }

      // Stats de la actividad publicada para esta clase
      const { data: actData } = await supabase
        .from('class_activities')
        .select('id, title, is_published, max_attempts')
        .eq('class_id', selectedClass.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (actData?.id) {
        try {
          const { count: totalResponses } = await supabase
            .from('activity_responses')
            .select('id', { count: 'exact', head: true })
            .eq('activity_id', actData.id);
          setActivityStats({ isPublished: !!actData.is_published, totalResponses: totalResponses || 0 });
          if (actData.max_attempts !== undefined) setMaxAttempts(actData.max_attempts);
        } catch {
          setActivityStats({ isPublished: !!actData.is_published, totalResponses: 0 });
          if (actData.max_attempts !== undefined) setMaxAttempts(actData.max_attempts);
        }
      } else if (draftData?.status === 'approved' || draftData?.status === 'published') {
        setActivityStats({ isPublished: true, totalResponses: 0 });
      } else {
        setActivityStats({ isPublished: false, totalResponses: 0 });
      }
    } catch (err) {
      setDraftError(err.message);
    } finally {
      setDraftLoading(false);
    }
  };

  useEffect(() => {
    if (selectedClass) {
      setClassTitle(selectedClass.title || '');
      setClassDesc(selectedClass.description || '');
      fetchMaterials();
      fetchDraftAndStats();
    }
  }, [selectedClass?.id]);

  // Suscripción realtime: si admin publica/despublica, el modal y la lista se actualizan
  useEffect(() => {
    if (!selectedClass?.id) return;
    const channel = supabase
      .channel('class_activities_modal_sync_' + selectedClass.id)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'class_activities', filter: `class_id=eq.${selectedClass.id}` },
        () => { 
          fetchDraftAndStats();
          if (onClassUpdated) onClassUpdated();
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'activity_drafts', filter: `class_id=eq.${selectedClass.id}` },
        () => { 
          fetchDraftAndStats();
          if (onClassUpdated) onClassUpdated();
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedClass?.id]);

  // ── GUARDAR INFO DE CLASE ──
  const handleSaveInfo = async (e) => {
    e.preventDefault();
    setSavingInfo(true);
    setInfoMsg('');
    try {
      const { error } = await supabase
        .from('class_sessions')
        .update({ title: classTitle.trim(), description: classDesc.trim() })
        .eq('id', selectedClass.id);
      if (error) throw error;
      setInfoMsg('✓ Información actualizada correctamente.');
      if (onClassUpdated) onClassUpdated();
    } catch (err) {
      setInfoMsg('Error: ' + err.message);
    } finally {
      setSavingInfo(false);
    }
  };

  // ── MATERIALES: Guardar recurso ──
  const handleCancelForm = () => {
    setEditId(null); setMatTitle(''); setMatType('presentation');
    setMatProvider('drive'); setMatUrl(''); setActiveForm(null); setMatError('');
    setUploadFile(null); setUploadMode('file'); setUploadingPdf(false); setUploadSuccessMsg('');
  };

  const handleUploadPdfToDrive = async (e, resourceType = 'presentation') => {
    if (e) e.preventDefault();
    if (!uploadFile) {
      setMatError('Por favor selecciona un archivo PDF para subir.');
      return;
    }
    setUploadingPdf(true);
    setMatError('');
    setUploadSuccessMsg('');

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('classId', selectedClass.id);
      formData.append('programId', selectedClass.program_id || currentProgram?.id || '');
      formData.append('resourceType', resourceType);
      if (matTitle.trim()) {
        formData.append('customTitle', matTitle.trim());
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

      setUploadSuccessMsg(`✓ Archivo subido con éxito a Google Drive: "${data.formattedFileName || uploadFile.name}"`);
      setUploadFile(null);
      setMatTitle('');
      await fetchMaterials();
      if (onClassUpdated) onClassUpdated();
      setTimeout(() => {
        handleCancelForm();
      }, 2200);
    } catch (err) {
      console.error('Error subiendo PDF a Google Drive:', err);
      setMatError('Error al subir a Google Drive: ' + (err.message || String(err)));
    } finally {
      setUploadingPdf(false);
    }
  };

  const handleEditResource = (r) => {
    setEditId(r.id); setMatTitle(r.title); setMatType(r.resource_type);
    setMatProvider(r.provider || 'drive'); setMatUrl(r.url || '');
    setUploadMode('link');
    setActiveForm(r.resource_type === 'presentation' ? 'presentation' : 'complementary');
    setMatError('');
  };

  const handleSubmitResource = async (e, sectionType) => {
    e.preventDefault();
    if (!matTitle.trim() || !matUrl.trim()) { setMatError('El título y el enlace son obligatorios.'); return; }
    setSubmitting(true); setMatError('');
    const targetType = sectionType === 'presentation' ? 'presentation' : (matType === 'presentation' ? 'file' : matType);
    const payload = { class_id: selectedClass.id, program_id: selectedClass.program_id || currentProgram?.id, title: matTitle.trim(), resource_type: targetType, provider: matProvider, url: matUrl.trim(), is_visible: true };
    try {
      if (editId) {
        const { error } = await supabase.from('resources').update(payload).eq('id', editId).eq('class_id', selectedClass.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('resources').insert([payload]);
        if (error) throw error;
      }
      handleCancelForm(); await fetchMaterials();
    } catch (err) { setMatError('Error: ' + err.message); }
    finally { setSubmitting(false); }
  };

  const handleDeleteResource = async (id) => {
    try {
      const targetRes = materials.find(m => m.id === id);
      const isPres = targetRes?.resource_type === 'presentation';

      // 1. Si es archivo de Google Drive, solicitar borrado en Drive vía Edge Function
      if (targetRes?.url && (targetRes.url.includes('drive.google.com') || targetRes.provider === 'drive')) {
        try {
          await supabase.functions.invoke('upload-pdf-drive', {
            body: {
              action: 'delete',
              fileUrl: targetRes.url,
              resourceId: id,
              classId: selectedClass?.id,
              clearPresentation: isPres,
            },
          });
        } catch (driveErr) {
          console.warn('Aviso: no se pudo eliminar de Google Drive o ya fue borrado:', driveErr);
        }
      }

      // 2. Limpieza en base de datos
      const { error } = await supabase.from('resources').delete().eq('id', id).eq('class_id', selectedClass.id);
      if (error) throw error;

      if (isPres && selectedClass?.id) {
        await supabase.from('class_sessions').update({ presentation_url: null }).eq('id', selectedClass.id);
      }

      await fetchMaterials();
    } catch (err) { setMatError('Error al eliminar: ' + err.message); }
  };

  // ── ACTIVIDAD IA: Publicar / Despublicar ──
  const syncAndPublish = async (draftData, classId) => {
    // Buscar actividad existente
    const { data: existing } = await supabase
      .from('class_activities')
      .select('id')
      .eq('class_id', classId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    let actId;
    if (existing) {
      actId = existing.id;
      const updatePayload = { 
        title: draftData.activity_title || 'Actividad de Reforzamiento', 
        description: draftData.activity_description || '', 
        is_published: true, 
        max_attempts: maxAttempts 
      };
      if (draftData.due_date) updatePayload.due_date = draftData.due_date;
      
      let { data: updated, error } = await supabase.from('class_activities').update(updatePayload).eq('id', existing.id).select('id').single();
      if (error && (error.code === '42703' || error.message?.includes('due_date'))) {
        delete updatePayload.due_date;
        const retry = await supabase.from('class_activities').update(updatePayload).eq('id', existing.id).select('id').single();
        updated = retry.data;
        error = retry.error;
      }
      if (error) throw error;
      const { data: oldQs } = await supabase.from('activity_questions').select('id').eq('activity_id', actId);
      if (oldQs && oldQs.length > 0) {
        const oldQIds = oldQs.map(q => q.id);
        await supabase.from('question_correct_answers').delete().in('question_id', oldQIds);
        await supabase.from('question_options').delete().in('question_id', oldQIds);
        await supabase.from('activity_questions').delete().in('id', oldQIds);
      }
    } else {
      const insertPayload = { 
        class_id: classId, 
        title: draftData.activity_title || 'Actividad de Reforzamiento', 
        description: draftData.activity_description || '', 
        is_published: true, 
        max_attempts: maxAttempts, 
        is_mandatory: false 
      };
      if (draftData.due_date) insertPayload.due_date = draftData.due_date;
      
      let { data: newAct, error } = await supabase.from('class_activities').insert(insertPayload).select('id').single();
      if (error && (error.code === '42703' || error.message?.includes('due_date'))) {
        delete insertPayload.due_date;
        const retry = await supabase.from('class_activities').insert([insertPayload]).select('id').single();
        newAct = retry.data;
        error = retry.error;
      }
      if (error) throw error;
      actId = newAct.id;
    }
    
    for (let qi = 0; qi < (draftData.questions || []).length; qi++) {
      const q = draftData.questions[qi];
      const qPayload = {
        activity_id: actId,
        text: q.text,
        question_type: q.question_type || 'single_choice',
        order_num: qi + 1,
      };
      if (q.explanation) qPayload.explanation = q.explanation;
      if (q.source_basis) qPayload.source_basis = q.source_basis;

      let { data: qData, error: qErr } = await supabase
        .from('activity_questions')
        .insert(qPayload)
        .select('id')
        .single();

      if (qErr && (qErr.message?.includes('explanation') || qErr.message?.includes('source_basis') || qErr.code === 'PGRST204')) {
        const fallbackPayload = {
          activity_id: actId,
          text: q.text,
          question_type: q.question_type || 'single_choice',
          order_num: qi + 1,
        };
        const resFallback = await supabase
          .from('activity_questions')
          .insert(fallbackPayload)
          .select('id')
          .single();
        qData = resFallback.data;
        qErr = resFallback.error;
      }

      if (qErr) throw qErr;
      let correctOptId = null;
      for (let oi = 0; oi < (q.options || []).length; oi++) {
        const opt = q.options[oi];
        const { data: optData, error: optErr } = await supabase.from('question_options').insert({ question_id: qData.id, text: opt.text, order_num: oi + 1 }).select('id').single();
        if (optErr) throw optErr;
        if (opt.is_correct) correctOptId = optData.id;
      }
      if (correctOptId) {
        await supabase.from('question_correct_answers').upsert({ question_id: qData.id, correct_option_id: correctOptId }, { onConflict: 'question_id' });
      }
    }
  };

  const handlePublishActivity = async () => {
    if (!draft) return;
    setActionLoading('publishing');
    setActivityMsg('');
    try {
      const updatedDraftData = { ...draft.draft_data, questions: localQuestions };
      await syncAndPublish(updatedDraftData, selectedClass.id);
      await supabase.from('activity_drafts').update({ status: 'approved', reviewed_at: new Date().toISOString() }).eq('id', draft.id);
      setActivityMsg('✓ Actividad publicada correctamente. Los estudiantes ya pueden responderla.');
      await fetchDraftAndStats();
      if (onClassUpdated) onClassUpdated();
    } catch (err) {
      setActivityMsg('Error al publicar: ' + err.message);
    } finally { setActionLoading(null); }
  };

  const handleUnpublishActivity = async () => {
    setActionLoading('unpublishing');
    setActivityMsg('');
    try {
      await supabase.from('class_activities').update({ is_published: false }).eq('class_id', selectedClass.id);
      await supabase.from('activity_drafts').update({ status: 'pending' }).eq('id', draft?.id);
      setActivityMsg('Actividad despublicada. Los estudiantes ya no pueden verla.');
      await fetchDraftAndStats();
      if (onClassUpdated) onClassUpdated();
    } catch (err) {
      setActivityMsg('Error: ' + err.message);
    } finally { setActionLoading(null); }
  };

  const handleSaveDraftEdits = async () => {
    if (!draft) return;
    setActionLoading('saving');
    setActivityMsg('');
    try {
      const updatedDraftData = { ...draft.draft_data, questions: localQuestions };
      const { error } = await supabase
        .from('activity_drafts')
        .update({ draft_data: updatedDraftData })
        .eq('id', draft.id);
      if (error) throw error;
      setActivityMsg('✓ Cambios en el borrador guardados correctamente.');
      setEditingQuestions(false);
      await fetchDraftAndStats();
      if (onClassUpdated) onClassUpdated();
    } catch (err) {
      setActivityMsg('Error al guardar: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const presentations = materials.filter(m => m.resource_type === 'presentation');
  const complementary = materials.filter(m => m.resource_type !== 'presentation');

  const SECTIONS = [
    { id: 'preclass',   label: 'Pre-Clase',    icon: <Presentation size={15} /> },
    { id: 'recording',  label: 'Grabación',    icon: <Video size={15} />,
      badge: selectedClass?.video_url ? 'OK' : null },
    { id: 'activity',   label: 'Actividad IA', icon: <Sparkles size={15} />,
      badge: draft && draft.status === 'pending' ? '!' : (activityStats?.isPublished ? 'OK' : null) },
  ];

  const moduleName = selectedClass?.sessions?.modules?.title || selectedClass?.subtopics?.modules?.title || 'Módulo';
  const sessionName = selectedClass?.sessions?.title || selectedClass?.subtopics?.title || 'Sesión';

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0,
      backgroundColor: 'rgba(14,21,50,0.65)',
      backdropFilter: 'blur(5px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 99999, padding: '1rem',
      animation: 'fadeIn 0.2s ease'
    }}>
      <div style={{
        width: '100%', maxWidth: '880px',
        maxHeight: '90vh',
        background: '#FFFFFF',
        borderRadius: '20px',
        boxShadow: '0 25px 60px rgba(14,21,50,0.22)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideUp 0.25s cubic-bezier(0.34,1.56,0.64,1)'
      }}>
        {/* HEADER HERO NAVY */}
        <div style={{
          background: 'linear-gradient(135deg, var(--navy, #14213D) 0%, #1e3a5f 100%)',
          padding: '1.5rem 2rem 0',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
            <div style={{ flex: 1, minWidth: 0, paddingRight: '1rem' }}>
              
              {/* BREADCRUMB & STATUS */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
                <span style={{
                  background: 'rgba(252,163,17,0.18)',
                  color: 'var(--gold, #FCA311)',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '12px'
                }}>
                  Gestión de Sesión
                </span>
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: statusInfo.bg,
                  color: statusInfo.color,
                  border: `1px solid ${statusInfo.border}`
                }}>
                  {statusInfo.label}
                </span>
                <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.76rem' }}>
                  {moduleName} › {sessionName}
                </span>
              </div>

              {/* TITULO */}
              <h2 style={{ margin: '4px 0 0 0', fontWeight: 800, fontSize: '1.35rem', color: '#FFFFFF' }}>
                {selectedClass?.title || 'Clase'}
              </h2>

              {/* METADATA */}
              <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.8rem', color: 'rgba(255,255,255,0.75)', marginTop: '0.45rem', flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CalendarDays size={13} color="var(--gold, #FCA311)" />
                  {selectedClass?.class_date ? formatClassDate(selectedClass.class_date, false) : 'Fecha por confirmar'}
                </span>
                {selectedClass?.duration ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={13} color="var(--gold, #FCA311)" />
                    {selectedClass.duration} min
                  </span>
                ) : null}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
              {isClassLiveOrSoon(selectedClass, 10) && (selectedClass?.meet_url || currentProgram?.meet_url) && (
                <a href={selectedClass?.meet_url || currentProgram?.meet_url} target="_blank" rel="noreferrer"
                  style={{
                    background: 'var(--gold, #FCA311)', color: 'var(--navy, #14213D)',
                    padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.84rem',
                    fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.45rem',
                    boxShadow: '0 4px 12px rgba(252,163,17,0.3)', transition: 'all 0.15s ease'
                  }}>
                  <Video size={15} /> Entrar a Clase
                </a>
              )}
              
              <button
                onClick={onClose}
                style={{
                  background: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer',
                  borderRadius: '8px', padding: '0.45rem', color: 'rgba(255,255,255,0.85)',
                  display: 'flex', transition: 'background 0.2s'
                }}
                onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* TAB BAR NAVEGACIÓN */}
          <div style={{ display: 'flex', gap: '0.5rem', borderBottom: 'none' }}>
            {SECTIONS.map(sec => {
              const isActive = activeSection === sec.id;
              return (
                <button
                  key={sec.id}
                  onClick={() => setActiveSection(sec.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.45rem',
                    padding: '0.7rem 1.25rem', border: 'none',
                    borderBottom: isActive ? '3px solid var(--gold, #FCA311)' : '3px solid transparent',
                    background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
                    borderTopLeftRadius: '8px', borderTopRightRadius: '8px',
                    color: isActive ? 'var(--gold, #FCA311)' : 'rgba(255,255,255,0.8)',
                    fontWeight: isActive ? 700 : 500, fontSize: '0.84rem', cursor: 'pointer',
                    transition: 'all 0.15s ease', position: 'relative'
                  }}
                  onMouseOver={e => { if (!isActive) e.currentTarget.style.color = '#FFFFFF'; }}
                  onMouseOut={e => { if (!isActive) e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; }}
                >
                  {sec.icon} {sec.label}
                  {sec.badge && (
                    <span style={{
                      fontSize: '0.68rem', fontWeight: 800,
                      padding: '1px 6px', borderRadius: '10px',
                      background: sec.badge === 'OK' ? '#DCFCE7' : 'var(--gold, #FCA311)',
                      color: sec.badge === 'OK' ? '#007A2E' : 'var(--navy, #14213D)',
                      marginLeft: '3px'
                    }}>
                      {sec.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* MODAL BODY */}
        <div style={{ padding: '1.75rem 2rem', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* ════ SECCIÓN: PRE-CLASE ════ */}
          {activeSection === 'preclass' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* INFORMACIÓN DE LA SESIÓN */}
              <div style={{ background: '#F8FAFC', padding: '1.4rem', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ margin: 0, color: 'var(--navy, #14213D)', fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Info size={16} color="var(--gold, #FCA311)" /> Información de la Sesión
                  </h3>
                </div>
                
                {infoMsg && (
                  <div style={{
                    fontSize: '0.82rem', marginBottom: '0.85rem', fontWeight: 600,
                    color: infoMsg.startsWith('✓') ? '#007A2E' : '#DC2626',
                    background: infoMsg.startsWith('✓') ? '#DCFCE7' : '#FEE2E2',
                    padding: '0.55rem 0.85rem', borderRadius: '8px', border: `1px solid ${infoMsg.startsWith('✓') ? 'rgba(0,122,46,0.2)' : 'rgba(220,38,38,0.2)'}`
                  }}>
                    {infoMsg}
                  </div>
                )}

                <form onSubmit={handleSaveInfo} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.78rem', fontWeight: 700, color: 'var(--navy, #14213D)', textTransform: 'uppercase' }}>
                      Título de la Clase
                    </label>
                    <input
                      type="text"
                      value={classTitle}
                      onChange={e => setClassTitle(e.target.value)}
                      style={{
                        width: '100%', padding: '0.55rem 0.85rem', border: '1.5px solid #CBD5E1',
                        borderRadius: '8px', fontSize: '0.88rem', outline: 'none', background: '#FFFFFF', boxSizing: 'border-box'
                      }}
                      onFocus={e => e.target.style.borderColor = 'var(--gold, #FCA311)'}
                      onBlur={e => e.target.style.borderColor = '#CBD5E1'}
                      required
                    />
                  </div>
                  
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.78rem', fontWeight: 700, color: 'var(--navy, #14213D)', textTransform: 'uppercase' }}>
                      Descripción / Temas a cubrir
                    </label>
                    <textarea
                      rows={2}
                      value={classDesc}
                      onChange={e => setClassDesc(e.target.value)}
                      placeholder="Ej: Introducción a conceptos clave, ejercicios prácticos, normas de eficiencia..."
                      style={{
                        width: '100%', padding: '0.55rem 0.85rem', border: '1.5px solid #CBD5E1',
                        borderRadius: '8px', fontSize: '0.88rem', resize: 'vertical', outline: 'none', background: '#FFFFFF', boxSizing: 'border-box'
                      }}
                      onFocus={e => e.target.style.borderColor = 'var(--gold, #FCA311)'}
                      onBlur={e => e.target.style.borderColor = '#CBD5E1'}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
                    <button
                      type="submit"
                      disabled={savingInfo}
                      style={{
                        background: 'var(--navy, #14213D)', color: '#FFFFFF', border: 'none',
                        borderRadius: '8px', padding: '0.55rem 1.25rem', fontWeight: 700, fontSize: '0.84rem',
                        cursor: savingInfo ? 'not-allowed' : 'pointer', transition: 'all 0.15s ease'
                      }}
                      onMouseOver={e => { if (!savingInfo) e.currentTarget.style.background = '#000000'; }}
                      onMouseOut={e => { if (!savingInfo) e.currentTarget.style.background = 'var(--navy, #14213D)'; }}
                    >
                      {savingInfo ? 'Guardando...' : 'Guardar Información'}
                    </button>
                  </div>
                </form>
              </div>

              {/* PRESENTACIÓN DE LA CLASE */}
              <div style={{ background: '#F8FAFC', padding: '1.4rem', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h3 style={{ margin: 0, color: 'var(--navy, #14213D)', fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Presentation size={16} color="var(--gold, #FCA311)" /> Presentación de la Clase (Diapositivas)
                  </h3>
                  <button
                    type="button"
                    onClick={() => activeForm === 'presentation' && !editId ? setActiveForm(null) : (handleCancelForm(), setActiveForm('presentation'))}
                    style={{
                      background: 'var(--navy, #14213D)', color: '#FFFFFF', border: 'none',
                      borderRadius: '7px', padding: '0.4rem 0.85rem', fontSize: '0.78rem',
                      fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem'
                    }}
                  >
                    <Plus size={13} /> {activeForm === 'presentation' ? 'Cerrar' : 'Cargar Presentación'}
                  </button>
                </div>

                {matError && activeForm === 'presentation' && (
                  <div style={{ color: '#DC2626', background: '#FEE2E2', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
                    {matError}
                  </div>
                )}

                {activeForm === 'presentation' && (
                  <div style={{ background: '#FFFFFF', padding: '1.25rem', borderRadius: '10px', marginBottom: '1rem', border: '1px solid #CBD5E1' }}>
                    {/* Selector de Modo: Subir PDF a Drive vs Enlace Manual */}
                    <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', borderBottom: '1px solid #E2E8F0', paddingBottom: '0.6rem' }}>
                      <button
                        type="button"
                        onClick={() => setUploadMode('file')}
                        style={{
                          padding: '0.35rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: uploadMode === 'file' ? 700 : 500,
                          background: uploadMode === 'file' ? 'var(--navy, #14213D)' : '#F1F5F9',
                          color: uploadMode === 'file' ? '#FFFFFF' : 'var(--navy, #14213D)',
                          display: 'flex', alignItems: 'center', gap: '0.4rem', border: 'none', cursor: 'pointer'
                        }}
                      >
                        <Upload size={13} /> Subir PDF a Google Drive
                      </button>
                      <button
                        type="button"
                        onClick={() => setUploadMode('link')}
                        style={{
                          padding: '0.35rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: uploadMode === 'link' ? 700 : 500,
                          background: uploadMode === 'link' ? 'var(--navy, #14213D)' : '#F1F5F9',
                          color: uploadMode === 'link' ? '#FFFFFF' : 'var(--navy, #14213D)',
                          display: 'flex', alignItems: 'center', gap: '0.4rem', border: 'none', cursor: 'pointer'
                        }}
                      >
                        <LinkIcon size={13} /> Pegar Enlace Manual
                      </button>
                    </div>

                    {uploadSuccessMsg && (
                      <div style={{ color: '#007A2E', background: '#DCFCE7', border: '1px solid #86EFAC', padding: '0.6rem 0.85rem', borderRadius: '8px', fontSize: '0.82rem', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <CheckCircle2 size={16} /> {uploadSuccessMsg}
                      </div>
                    )}

                    {uploadMode === 'file' ? (
                      <form onSubmit={e => handleUploadPdfToDrive(e, 'presentation')}>
                        {/* Drag & Drop Zone */}
                        <div
                          onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
                          onDragLeave={() => setIsDragOver(false)}
                          onDrop={e => {
                            e.preventDefault();
                            setIsDragOver(false);
                            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                              const f = e.dataTransfer.files[0];
                              if (f.type === 'application/pdf' || f.name.endsWith('.pdf')) {
                                setUploadFile(f);
                                if (!matTitle) setMatTitle(f.name.replace(/\.[^/.]+$/, ''));
                              } else {
                                setMatError('Por favor selecciona un archivo en formato PDF.');
                              }
                            }
                          }}
                          style={{
                            border: `2px dashed ${isDragOver ? 'var(--gold, #FCA311)' : uploadFile ? '#007A2E' : '#CBD5E1'}`,
                            borderRadius: '10px',
                            background: isDragOver ? 'rgba(252,163,17,0.06)' : uploadFile ? '#F0FDF4' : '#F8FAFC',
                            padding: '1.5rem 1rem',
                            textAlign: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            marginBottom: '0.85rem'
                          }}
                          onClick={() => document.getElementById('pdf-upload-input-pres')?.click()}
                        >
                          <input
                            id="pdf-upload-input-pres"
                            type="file"
                            accept=".pdf,application/pdf"
                            style={{ display: 'none' }}
                            onChange={e => {
                              if (e.target.files && e.target.files[0]) {
                                const f = e.target.files[0];
                                setUploadFile(f);
                                if (!matTitle) setMatTitle(f.name.replace(/\.[^/.]+$/, ''));
                              }
                            }}
                          />
                          {uploadFile ? (
                            <div>
                              <FileCheck size={32} color="#007A2E" style={{ margin: '0 auto 0.4rem' }} />
                              <div style={{ fontWeight: 700, color: 'var(--navy, #14213D)', fontSize: '0.9rem' }}>{uploadFile.name}</div>
                              <div style={{ fontSize: '0.76rem', color: '#64748B', marginTop: '2px' }}>
                                {(uploadFile.size / (1024 * 1024)).toFixed(2)} MB · Listo para subir a Google Drive
                              </div>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setUploadFile(null); }}
                                style={{ marginTop: '0.5rem', background: '#FEE2E2', color: '#DC2626', border: 'none', borderRadius: '5px', padding: '0.2rem 0.6rem', fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer' }}
                              >
                                Cambiar archivo
                              </button>
                            </div>
                          ) : (
                            <div>
                              <Upload size={30} color="var(--gold, #FCA311)" style={{ margin: '0 auto 0.4rem' }} />
                              <div style={{ fontWeight: 700, color: 'var(--navy, #14213D)', fontSize: '0.88rem' }}>
                                Arrastra tu presentación PDF aquí o haz clic para buscar
                              </div>
                              <div style={{ fontSize: '0.76rem', color: '#64748B', marginTop: '3px' }}>
                                Soporta archivos PDF de hasta 100MB
                              </div>
                            </div>
                          )}
                        </div>

                        <div style={{ marginBottom: '0.85rem' }}>
                          <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--navy, #14213D)' }}>
                            Título visible para los estudiantes (Opcional)
                          </label>
                          <input
                            type="text"
                            value={matTitle}
                            onChange={e => setMatTitle(e.target.value)}
                            placeholder={uploadFile ? uploadFile.name.replace(/\.[^/.]+$/, '') : "Ej. Diapositivas de la Sesión"}
                            style={{ width: '100%', padding: '0.5rem 0.7rem', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.84rem', boxSizing: 'border-box' }}
                          />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                          <button type="button" onClick={handleCancelForm} style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '0.45rem 0.85rem', fontSize: '0.8rem', cursor: 'pointer' }}>Cancelar</button>
                          <button
                            type="submit"
                            disabled={!uploadFile || uploadingPdf}
                            style={{
                              background: !uploadFile || uploadingPdf ? '#94A3B8' : 'var(--navy, #14213D)',
                              color: '#FFFFFF', border: 'none', borderRadius: '6px', padding: '0.45rem 1.15rem',
                              fontSize: '0.82rem', fontWeight: 700, cursor: !uploadFile || uploadingPdf ? 'not-allowed' : 'pointer',
                              display: 'flex', alignItems: 'center', gap: '0.45rem',
                              boxShadow: '0 2px 6px rgba(20,33,61,0.15)'
                            }}
                          >
                            {uploadingPdf ? (
                              <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Subiendo a Google Drive...</>
                            ) : (
                              <><Upload size={14} /> Subir a Google Drive</>
                            )}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <form onSubmit={e => handleSubmitResource(e, 'presentation')}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem', marginBottom: '0.85rem' }}>
                          <div>
                            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--navy, #14213D)' }}>Título</label>
                            <input type="text" value={matTitle} onChange={e => setMatTitle(e.target.value)} placeholder="Ej. Diapositivas Sesión 1" style={{ width: '100%', padding: '0.5rem 0.7rem', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.84rem', boxSizing: 'border-box' }} required />
                          </div>
                          <div>
                            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--navy, #14213D)' }}>Plataforma / Origen</label>
                            <select value={matProvider} onChange={e => setMatProvider(e.target.value)} style={{ width: '100%', padding: '0.5rem 0.7rem', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.84rem', boxSizing: 'border-box' }}>
                              <option value="drive">Google Drive / OneDrive</option>
                              <option value="external">Otro enlace externo</option>
                            </select>
                          </div>
                        </div>
                        
                        <div style={{ marginBottom: '0.85rem' }}>
                          <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--navy, #14213D)' }}>URL del archivo</label>
                          <input type="url" value={matUrl} onChange={e => setMatUrl(e.target.value)} placeholder="https://drive.google.com/..." style={{ width: '100%', padding: '0.5rem 0.7rem', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.84rem', boxSizing: 'border-box' }} required />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                          <button type="button" onClick={handleCancelForm} style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '0.4rem 0.85rem', fontSize: '0.8rem', cursor: 'pointer' }}>Cancelar</button>
                          <button type="submit" disabled={submitting} style={{ background: 'var(--gold, #FCA311)', color: 'var(--navy, #14213D)', border: 'none', borderRadius: '6px', padding: '0.4rem 1rem', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>
                            {submitting ? 'Guardando...' : (editId ? 'Guardar Cambios' : 'Guardar Enlace')}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}

                {matLoading ? (
                  <p style={{ color: 'var(--text-muted, #64748B)', fontSize: '0.85rem' }}>Cargando...</p>
                ) : presentations.length === 0 ? (
                  <p style={{ color: 'var(--text-muted, #64748B)', fontSize: '0.84rem', margin: 0 }}>Sin presentación cargada aún para esta sesión.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {presentations.map(p => (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <Presentation size={16} color="var(--navy, #14213D)" />
                          <span style={{ fontWeight: 600, fontSize: '0.86rem', color: 'var(--navy, #14213D)' }}>{p.title}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button
                            type="button"
                            onClick={() => setSelectedDoc(p)}
                            style={{
                              padding: '0.35rem 0.75rem',
                              border: '1px solid #CBD5E1',
                              borderRadius: '6px',
                              fontSize: '0.78rem',
                              color: 'var(--navy, #14213D)',
                              background: '#FFFFFF',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              fontWeight: 600
                            }}
                          >
                            <Eye size={13} /> Abrir
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteResource(p.id)}
                            style={{
                              padding: '0.35rem 0.75rem',
                              border: '1px solid #fca5a5',
                              borderRadius: '6px',
                              fontSize: '0.78rem',
                              color: '#dc2626',
                              background: '#fef2f2',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              fontWeight: 600
                            }}
                          >
                            <Trash2 size={13} /> Eliminar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* MATERIAL COMPLEMENTARIO */}
              <div style={{ background: '#F8FAFC', padding: '1.4rem', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h3 style={{ margin: 0, color: 'var(--navy, #14213D)', fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FileText size={16} color="var(--gold, #FCA311)" /> Material Complementario
                  </h3>
                  <button
                    type="button"
                    onClick={() => activeForm === 'complementary' && !editId ? setActiveForm(null) : (handleCancelForm(), setActiveForm('complementary'))}
                    style={{
                      background: 'var(--navy, #14213D)', color: '#FFFFFF', border: 'none',
                      borderRadius: '7px', padding: '0.4rem 0.85rem', fontSize: '0.78rem',
                      fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem'
                    }}
                  >
                    <Plus size={13} /> {activeForm === 'complementary' ? 'Cerrar' : 'Agregar Material'}
                  </button>
                </div>

                {matError && activeForm === 'complementary' && (
                  <div style={{ color: '#DC2626', background: '#FEE2E2', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
                    {matError}
                  </div>
                )}

                {activeForm === 'complementary' && (
                  <div style={{ background: '#FFFFFF', padding: '1.25rem', borderRadius: '10px', marginBottom: '1rem', border: '1px solid #CBD5E1' }}>
                    {/* Selector de Modo */}
                    <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', borderBottom: '1px solid #E2E8F0', paddingBottom: '0.6rem' }}>
                      <button
                        type="button"
                        onClick={() => setUploadMode('file')}
                        style={{
                          padding: '0.35rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: uploadMode === 'file' ? 700 : 500,
                          background: uploadMode === 'file' ? 'var(--navy, #14213D)' : '#F1F5F9',
                          color: uploadMode === 'file' ? '#FFFFFF' : 'var(--navy, #14213D)',
                          display: 'flex', alignItems: 'center', gap: '0.4rem', border: 'none', cursor: 'pointer'
                        }}
                      >
                        <Upload size={13} /> Subir PDF / Archivo a Drive
                      </button>
                      <button
                        type="button"
                        onClick={() => setUploadMode('link')}
                        style={{
                          padding: '0.35rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: uploadMode === 'link' ? 700 : 500,
                          background: uploadMode === 'link' ? 'var(--navy, #14213D)' : '#F1F5F9',
                          color: uploadMode === 'link' ? '#FFFFFF' : 'var(--navy, #14213D)',
                          display: 'flex', alignItems: 'center', gap: '0.4rem', border: 'none', cursor: 'pointer'
                        }}
                      >
                        <LinkIcon size={13} /> Pegar Enlace Manual
                      </button>
                    </div>

                    {uploadSuccessMsg && (
                      <div style={{ color: '#007A2E', background: '#DCFCE7', border: '1px solid #86EFAC', padding: '0.6rem 0.85rem', borderRadius: '8px', fontSize: '0.82rem', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <CheckCircle2 size={16} /> {uploadSuccessMsg}
                      </div>
                    )}

                    {uploadMode === 'file' ? (
                      <form onSubmit={e => handleUploadPdfToDrive(e, 'pdf')}>
                        {/* Drag & Drop Zone */}
                        <div
                          onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
                          onDragLeave={() => setIsDragOver(false)}
                          onDrop={e => {
                            e.preventDefault();
                            setIsDragOver(false);
                            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                              const f = e.dataTransfer.files[0];
                              setUploadFile(f);
                              if (!matTitle) setMatTitle(f.name.replace(/\.[^/.]+$/, ''));
                            }
                          }}
                          style={{
                            border: `2px dashed ${isDragOver ? 'var(--gold, #FCA311)' : uploadFile ? '#007A2E' : '#CBD5E1'}`,
                            borderRadius: '10px',
                            background: isDragOver ? 'rgba(252,163,17,0.06)' : uploadFile ? '#F0FDF4' : '#F8FAFC',
                            padding: '1.5rem 1rem',
                            textAlign: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            marginBottom: '0.85rem'
                          }}
                          onClick={() => document.getElementById('pdf-upload-input-comp')?.click()}
                        >
                          <input
                            id="pdf-upload-input-comp"
                            type="file"
                            accept=".pdf,application/pdf"
                            style={{ display: 'none' }}
                            onChange={e => {
                              if (e.target.files && e.target.files[0]) {
                                const f = e.target.files[0];
                                setUploadFile(f);
                                if (!matTitle) setMatTitle(f.name.replace(/\.[^/.]+$/, ''));
                              }
                            }}
                          />
                          {uploadFile ? (
                            <div>
                              <FileCheck size={32} color="#007A2E" style={{ margin: '0 auto 0.4rem' }} />
                              <div style={{ fontWeight: 700, color: 'var(--navy, #14213D)', fontSize: '0.9rem' }}>{uploadFile.name}</div>
                              <div style={{ fontSize: '0.76rem', color: '#64748B', marginTop: '2px' }}>
                                {(uploadFile.size / (1024 * 1024)).toFixed(2)} MB · Listo para subir a Google Drive
                              </div>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setUploadFile(null); }}
                                style={{ marginTop: '0.5rem', background: '#FEE2E2', color: '#DC2626', border: 'none', borderRadius: '5px', padding: '0.2rem 0.6rem', fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer' }}
                              >
                                Cambiar archivo
                              </button>
                            </div>
                          ) : (
                            <div>
                              <Upload size={30} color="var(--gold, #FCA311)" style={{ margin: '0 auto 0.4rem' }} />
                              <div style={{ fontWeight: 700, color: 'var(--navy, #14213D)', fontSize: '0.88rem' }}>
                                Arrastra tu documento PDF aquí o haz clic para buscar
                              </div>
                              <div style={{ fontSize: '0.76rem', color: '#64748B', marginTop: '3px' }}>
                                Soporta archivos PDF de hasta 100MB
                              </div>
                            </div>
                          )}
                        </div>

                        <div style={{ marginBottom: '0.85rem' }}>
                          <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--navy, #14213D)' }}>
                            Título visible para los estudiantes (Opcional)
                          </label>
                          <input
                            type="text"
                            value={matTitle}
                            onChange={e => setMatTitle(e.target.value)}
                            placeholder={uploadFile ? uploadFile.name.replace(/\.[^/.]+$/, '') : "Ej. Guía de Estudio / Lectura Complementaria"}
                            style={{ width: '100%', padding: '0.5rem 0.7rem', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.84rem', boxSizing: 'border-box' }}
                          />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                          <button type="button" onClick={handleCancelForm} style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '0.45rem 0.85rem', fontSize: '0.8rem', cursor: 'pointer' }}>Cancelar</button>
                          <button
                            type="submit"
                            disabled={!uploadFile || uploadingPdf}
                            style={{
                              background: !uploadFile || uploadingPdf ? '#94A3B8' : 'var(--navy, #14213D)',
                              color: '#FFFFFF', border: 'none', borderRadius: '6px', padding: '0.45rem 1.15rem',
                              fontSize: '0.82rem', fontWeight: 700, cursor: !uploadFile || uploadingPdf ? 'not-allowed' : 'pointer',
                              display: 'flex', alignItems: 'center', gap: '0.45rem',
                              boxShadow: '0 2px 6px rgba(20,33,61,0.15)'
                            }}
                          >
                            {uploadingPdf ? (
                              <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Subiendo a Google Drive...</>
                            ) : (
                              <><Upload size={14} /> Subir a Google Drive</>
                            )}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <form onSubmit={e => handleSubmitResource(e, 'complementary')}>
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.85rem', marginBottom: '0.85rem' }}>
                          <div>
                            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--navy, #14213D)' }}>Título del recurso</label>
                            <input type="text" value={matTitle} onChange={e => setMatTitle(e.target.value)} placeholder="Ej. Lectura PDF, Guía de estudio" style={{ width: '100%', padding: '0.5rem 0.7rem', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.84rem', boxSizing: 'border-box' }} required />
                          </div>
                          <div>
                            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--navy, #14213D)' }}>Tipo</label>
                            <select value={matType} onChange={e => setMatType(e.target.value)} style={{ width: '100%', padding: '0.5rem 0.7rem', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.84rem', boxSizing: 'border-box' }}>
                              <option value="pdf">PDF</option>
                              <option value="link">Enlace Web</option>
                              <option value="file">Archivo</option>
                            </select>
                          </div>
                        </div>
                        
                        <div style={{ marginBottom: '0.85rem' }}>
                          <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--navy, #14213D)' }}>URL</label>
                          <input type="url" value={matUrl} onChange={e => setMatUrl(e.target.value)} placeholder="https://..." style={{ width: '100%', padding: '0.5rem 0.7rem', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.84rem', boxSizing: 'border-box' }} required />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                          <button type="button" onClick={handleCancelForm} style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '0.4rem 0.85rem', fontSize: '0.8rem', cursor: 'pointer' }}>Cancelar</button>
                          <button type="submit" disabled={submitting} style={{ background: 'var(--gold, #FCA311)', color: 'var(--navy, #14213D)', border: 'none', borderRadius: '6px', padding: '0.4rem 1rem', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>
                            {submitting ? 'Guardando...' : (editId ? 'Guardar Cambios' : 'Agregar')}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}

                {complementary.length === 0 ? (
                  <p style={{ color: 'var(--text-muted, #64748B)', fontSize: '0.84rem', margin: 0 }}>Sin material complementario agregado.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {complementary.map(p => (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <FileText size={16} color="var(--navy, #14213D)" />
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.86rem', color: 'var(--navy, #14213D)' }}>{p.title}</div>
                            <TypePill type={p.resource_type} />
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button
                            type="button"
                            onClick={() => setSelectedDoc(p)}
                            style={{
                              padding: '0.35rem 0.75rem',
                              border: '1px solid #CBD5E1',
                              borderRadius: '6px',
                              fontSize: '0.78rem',
                              color: 'var(--navy, #14213D)',
                              background: '#FFFFFF',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              fontWeight: 600
                            }}
                          >
                            <Eye size={13} /> Abrir
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteResource(p.id)}
                            style={{
                              padding: '0.35rem 0.75rem',
                              border: '1px solid #fca5a5',
                              borderRadius: '6px',
                              fontSize: '0.78rem',
                              color: '#dc2626',
                              background: '#fef2f2',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              fontWeight: 600
                            }}
                          >
                            <Trash2 size={13} /> Eliminar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ════ SECCIÓN: GRABACIÓN ════ */}
          {activeSection === 'recording' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {!isPastClass && !selectedClass?.video_url && (
                <div style={{ padding: '0.85rem 1.1rem', borderRadius: '10px', background: '#EFF6FF', border: '1px solid #BFDBFE', fontSize: '0.82rem', color: '#1E40AF', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <Info size={16} color="#1D4ED8" style={{ flexShrink: 0 }} />
                  <span>Esta clase está programada para una fecha futura. Puedes vincular el video con antelación o esperar al procesamiento automático tras la sesión.</span>
                </div>
              )}

              {/* SEMÁFORO DE ESTADO */}
              <div style={{
                padding: '1.4rem 1.6rem', borderRadius: '12px',
                border: `1.5px solid ${selectedClass?.video_url ? '#86EFAC' : '#FDE68A'}`,
                background: selectedClass?.video_url ? '#F0FDF4' : '#FFFBEB',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: '1rem', flexWrap: 'wrap'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{
                    width: '46px', height: '46px', borderRadius: '50%',
                    background: selectedClass?.video_url ? '#007A2E' : 'var(--gold, #FCA311)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                  }}>
                    {selectedClass?.video_url ? <CheckCircle2 size={24} color="#FFFFFF" /> : <AlertCircle size={24} color="#14213D" />}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--navy, #14213D)' }}>
                      {selectedClass?.video_url ? '✓ Grabación vinculada y activa' : 'Grabación pendiente de vinculación'}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '2px' }}>
                      {selectedClass?.video_url 
                        ? `Disponible para los estudiantes (${extractYouTubeId(selectedClass.video_url) ? `YouTube ID: ${extractYouTubeId(selectedClass.video_url)}` : 'Enlace directo'})` 
                        : 'La grabación aún no ha sido vinculada manualmente ni por la automatización.'}
                    </div>
                  </div>
                </div>
              </div>

              {/* EXTRACTOR DE YOUTUBE (ADMIN) */}
              {currentUser?.role === 'admin' && (
                <>
                  <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '1.35rem' }}>
                    <h4 style={{ margin: '0 0 0.75rem 0', color: 'var(--navy, #14213D)', fontSize: '0.92rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Video size={17} color="var(--gold, #FCA311)" /> Extractor de ID y Vinculación de YouTube
                    </h4>
                    
                    <form onSubmit={handleLinkYouTubeVideo} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--navy, #14213D)', marginBottom: '4px' }}>
                          Enlace de YouTube o ID del video
                        </label>
                        <input
                          type="text"
                          value={ytInput}
                          onChange={e => setYtInput(e.target.value)}
                          placeholder="Ej. https://www.youtube.com/watch?v=dQw4w9WgXcQ o dQw4w9WgXcQ"
                          style={{ width: '100%', padding: '0.55rem 0.85rem', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.86rem', boxSizing: 'border-box' }}
                        />
                      </div>

                      {detectedYtId ? (
                        <div style={{ background: '#DCFCE7', border: '1px solid #86EFAC', color: '#007A2E', padding: '0.5rem 0.85rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <CheckCircle2 size={14} color="#007A2E" />
                          <span>ID de YouTube detectado: <strong>{detectedYtId}</strong></span>
                        </div>
                      ) : ytInput.trim() ? (
                        <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', color: '#92400E', padding: '0.5rem 0.85rem', borderRadius: '6px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Info size={14} color="#FCA311" />
                          <span>Se guardará como enlace directo.</span>
                        </div>
                      ) : null}

                      {ytMsg && (
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: ytMsg.startsWith('✓') ? '#007A2E' : '#DC2626' }}>
                          {ytMsg}
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          type="submit"
                          disabled={ytLinking || !ytInput.trim()}
                          style={{
                            background: 'var(--navy, #14213D)', color: '#FFFFFF', border: 'none',
                            borderRadius: '6px', padding: '0.5rem 1.2rem', fontSize: '0.82rem',
                            fontWeight: 700, cursor: ytLinking ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', gap: '0.45rem'
                          }}
                        >
                          {ytLinking ? 'Vinculando...' : 'Vincular y Extraer ID'}
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* GUIA DE AUTOMATIZACION */}
                  <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '1.25rem' }}>
                    <div
                      onClick={() => setShowAutomationHelp(!showAutomationHelp)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <Sparkles size={17} color="var(--gold, #FCA311)" />
                        <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--navy, #14213D)' }}>
                          Automatización Google Drive → YouTube (Make.com / API)
                        </span>
                      </div>
                      <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}>
                        {showAutomationHelp ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </button>
                    </div>

                    {showAutomationHelp && (
                      <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #E2E8F0', fontSize: '0.82rem', color: '#334155', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <p style={{ margin: 0, lineHeight: 1.5 }}>
                          Al subir un video a la carpeta de Google Drive del programa, la automatización procesa el archivo, lo publica en YouTube como <i>No listado</i> y vincula el ID de YouTube en esta clase automáticamente.
                        </p>
                        <div style={{ background: '#FFFFFF', padding: '0.75rem 1rem', borderRadius: '6px', border: '1px solid #CBD5E1' }}>
                          <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '4px' }}>
                            ID Único de esta clase (para Payload Make.com):
                          </div>
                          <code style={{ background: '#F1F5F9', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 700, color: 'var(--navy, #14213D)' }}>
                            {selectedClass?.id}
                          </code>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

            </div>
          )}

          {/* ════ SECCIÓN: ACTIVIDAD IA ════ */}
          {activeSection === 'activity' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {draftLoading ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted, #64748B)' }}>
                  <div style={{ width: '32px', height: '32px', border: '3px solid #E2E8F0', borderTopColor: 'var(--gold, #FCA311)', borderRadius: '50%', animation: 'liaterSpin 0.8s linear infinite', margin: '0 auto 1rem' }} />
                  <span>Cargando actividad de reforzamiento IA...</span>
                </div>
              ) : !draft ? (
                <div style={{ padding: '3rem', textAlign: 'center', background: '#F8FAFC', borderRadius: '12px', border: '1px dashed #CBD5E1' }}>
                  <Sparkles size={36} color="var(--gold, #FCA311)" style={{ margin: '0 auto 0.75rem' }} />
                  <h3 style={{ color: 'var(--navy, #14213D)', marginBottom: '0.5rem', fontWeight: 700 }}>
                    {!isPastClass ? 'Actividad disponible tras realizar la clase' : 'Sin borrador IA disponible'}
                  </h3>
                  <p style={{ color: 'var(--text-muted, #64748B)', fontSize: '0.88rem', margin: 0, maxWidth: '500px', marginLeft: 'auto', marginRight: 'auto' }}>
                    {!isPastClass
                      ? 'El borrador de preguntas generado por la IA se procesará automáticamente una vez que la clase haya finalizado y se disponga de la grabación o transcripción.'
                      : 'El administrador enviará el borrador generado por IA una vez que la transcripción de la clase esté procesada.'}
                  </p>
                </div>
              ) : (
                <>
                  {/* ESTADO DE PUBLICACIÓN & ACCIONES */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '1.1rem 1.35rem', borderRadius: '12px',
                    background: activityStats?.isPublished ? '#F0FDF4' : '#FFFBEB',
                    border: `1.5px solid ${activityStats?.isPublished ? '#86EFAC' : '#FDE68A'}`,
                    flexWrap: 'wrap', gap: '0.85rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      {activityStats?.isPublished ? (
                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#007A2E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <CheckCircle2 size={20} color="#FFFFFF" />
                        </div>
                      ) : (
                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--gold, #FCA311)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Sparkles size={20} color="var(--navy, #14213D)" />
                        </div>
                      )}
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--navy, #14213D)' }}>
                          {activityStats?.isPublished ? 'Actividad publicada a estudiantes' : 'Borrador IA pendiente de revisión'}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '2px' }}>
                          {draft.draft_data?.activity_title || 'Sin título'} · {(localQuestions.length)} preguntas
                          {activityStats && ` · ${activityStats.totalResponses} respuestas recibidas`}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {activityStats?.isPublished ? (
                        <button
                          type="button"
                          onClick={handleUnpublishActivity}
                          disabled={actionLoading === 'unpublishing'}
                          style={{
                            background: '#FFFFFF', color: '#DC2626', border: '1px solid #FCA5A5',
                            borderRadius: '8px', padding: '0.45rem 0.95rem', fontSize: '0.8rem',
                            fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem'
                          }}
                        >
                          {actionLoading === 'unpublishing' ? '...' : <><EyeOff size={13} /> Despublicar</>}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handlePublishActivity}
                          disabled={actionLoading === 'publishing'}
                          style={{
                            background: 'var(--gold, #FCA311)', color: 'var(--navy, #14213D)', border: 'none',
                            borderRadius: '8px', padding: '0.45rem 1rem', fontSize: '0.8rem',
                            fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem',
                            boxShadow: '0 2px 6px rgba(252,163,17,0.3)'
                          }}
                        >
                          {actionLoading === 'publishing' ? 'Publicando...' : <><CheckCheck size={14} /> Publicar a estudiantes</>}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setEditingQuestions(!editingQuestions)}
                        style={{
                          background: 'var(--navy, #14213D)', color: '#FFFFFF', border: 'none',
                          borderRadius: '8px', padding: '0.45rem 0.95rem', fontSize: '0.8rem',
                          fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem'
                        }}
                      >
                        <Edit3 size={13} /> {editingQuestions ? 'Cerrar editor' : 'Editar preguntas'}
                      </button>
                    </div>
                  </div>

                  {activityMsg && (
                    <div style={{
                      fontSize: '0.82rem', fontWeight: 600,
                      color: activityMsg.startsWith('✓') ? '#007A2E' : '#DC2626',
                      background: activityMsg.startsWith('✓') ? '#DCFCE7' : '#FEE2E2',
                      padding: '0.6rem 0.85rem', borderRadius: '8px'
                    }}>
                      {activityMsg}
                    </div>
                  )}

                  {editingQuestions && (
                    <div style={{ padding: '1rem', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #CBD5E1' }}>
                      <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy, #14213D)' }}>
                        Intentos permitidos para el alumno:
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input 
                          type="number" 
                          min="0"
                          value={maxAttempts} 
                          onChange={e => setMaxAttempts(parseInt(e.target.value) || 0)}
                          style={{ width: '90px', padding: '0.45rem 0.6rem', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.85rem' }} 
                        />
                        <span style={{ fontSize: '0.78rem', color: '#64748B' }}>(0 = Intentos ilimitados)</span>
                      </div>
                    </div>
                  )}

                  {/* MODO VISUALIZACIÓN DE PREGUNTAS */}
                  {!editingQuestions && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {localQuestions.map((q, qi) => (
                        <div key={q._key ?? qi} style={{ background: '#F8FAFC', padding: '1.35rem', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
                            <span style={{ background: 'var(--navy, #14213D)', color: '#FFFFFF', fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: '6px' }}>
                              Pregunta {qi + 1}
                            </span>
                          </div>
                          
                          <div style={{ fontWeight: 700, color: 'var(--navy, #14213D)', fontSize: '0.92rem', marginBottom: '0.75rem', lineHeight: 1.45 }}>
                            {q.text}
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            {(q.options || []).map((opt, oi) => (
                              <div
                                key={oi}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                                  padding: '0.45rem 0.75rem', borderRadius: '8px',
                                  background: opt.is_correct ? '#DCFCE7' : '#FFFFFF',
                                  border: opt.is_correct ? '1px solid #86EFAC' : '1px solid #E2E8F0'
                                }}
                              >
                                {opt.is_correct ? <Check size={14} color="#007A2E" /> : <span style={{ width: '14px' }} />}
                                <span style={{ fontSize: '0.84rem', color: opt.is_correct ? '#007A2E' : 'var(--navy, #14213D)', fontWeight: opt.is_correct ? 700 : 400 }}>
                                  {opt.text}
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* RETROALIMENTACIÓN PEDAGÓGICA */}
                          {(() => {
                            const exp = (q.explanation || '').trim();
                            const src = (q.source_basis || '').trim();
                            const correctOpt = (q.options || []).find(o => o.is_correct);
                            const defaultFeedback = correctOpt 
                              ? `La opción correcta es "${correctOpt.text}". Revisa los contenidos de esta sesión para afianzar la explicación con tus estudiantes.`
                              : 'Fundamentado en los contenidos clave explicados durante esta sesión.';
                            const feedbackText = exp || src || defaultFeedback;

                            return (
                              <div style={{
                                marginTop: '0.85rem',
                                padding: '0.75rem 1rem',
                                background: '#EFF6FF',
                                border: '1px solid #BFDBFE',
                                borderRadius: '10px',
                                fontSize: '0.82rem',
                                color: '#1E40AF',
                                lineHeight: 1.45,
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '0.6rem'
                              }}>
                                <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>💡</span>
                                <div style={{ flex: 1 }}>
                                  <strong style={{ display: 'block', color: '#1D4ED8', marginBottom: '2px', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                    Retroalimentación Pedagógica
                                  </strong>
                                  <span>{feedbackText}</span>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* MODO EDICIÓN DE PREGUNTAS */}
                  {editingQuestions && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
                      {localQuestions.map((q, qi) => (
                        <div key={q._key ?? qi} style={{ background: '#F8FAFC', padding: '1.35rem', borderRadius: '12px', border: '1px solid #CBD5E1' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                            <label style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--navy, #14213D)' }}>Pregunta {qi + 1}</label>
                            <button
                              type="button"
                              onClick={() => setLocalQuestions(prev => prev.filter((_, i) => i !== qi))}
                              style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: '6px', padding: '0.25rem 0.6rem', cursor: 'pointer', color: '#DC2626', fontSize: '0.75rem' }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                          
                          <textarea
                            value={q.text}
                            onChange={e => setLocalQuestions(prev => prev.map((item, i) => i === qi ? { ...item, text: e.target.value } : item))}
                            rows={2}
                            style={{ width: '100%', padding: '0.55rem', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '0.65rem', resize: 'vertical', boxSizing: 'border-box' }}
                          />
                          
                          {/* OPCIONES */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.75rem' }}>
                            {(q.options || []).map((opt, oi) => (
                              <div key={oi} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <input
                                  type="radio"
                                  name={`correct-${qi}`}
                                  checked={!!opt.is_correct}
                                  onChange={() => setLocalQuestions(prev => prev.map((item, i) => i === qi ? { ...item, options: item.options.map((o, j) => ({ ...o, is_correct: j === oi })) } : item))}
                                  style={{ accentColor: 'var(--gold, #FCA311)', cursor: 'pointer' }}
                                  title="Marcar como opción correcta"
                                />
                                <input
                                  type="text"
                                  value={opt.text}
                                  onChange={e => setLocalQuestions(prev => prev.map((item, i) => i === qi ? { ...item, options: item.options.map((o, j) => j === oi ? { ...o, text: e.target.value } : o) } : item))}
                                  style={{ flex: 1, padding: '0.45rem 0.65rem', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.83rem' }}
                                />
                              </div>
                            ))}
                          </div>

                          {/* RETROALIMENTACIÓN */}
                          <div style={{ padding: '0.75rem', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
                              <span>💡</span>
                              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1D4ED8', textTransform: 'uppercase' }}>
                                Retroalimentación Pedagógica / Explicación
                              </label>
                            </div>
                            <textarea 
                              value={q.explanation || ''} 
                              onChange={e => setLocalQuestions(prev => prev.map((item, i) => i === qi ? { ...item, explanation: e.target.value } : item))}
                              placeholder="Escribe la explicación de por qué esta respuesta es la correcta..."
                              rows={2} 
                              style={{ width: '100%', padding: '0.45rem 0.6rem', border: '1px solid #93C5FD', borderRadius: '6px', fontSize: '0.82rem', resize: 'vertical', background: '#FFFFFF', color: '#1E3A8A', boxSizing: 'border-box' }} 
                            />
                          </div>
                        </div>
                      ))}

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.5rem' }}>
                        <button
                          type="button"
                          onClick={() => setLocalQuestions(prev => [...prev, { _key: Date.now(), text: '', explanation: '', question_type: 'single_choice', options: [{ text: '', is_correct: true }, { text: '', is_correct: false }, { text: '', is_correct: false }, { text: '', is_correct: false }] }])}
                          style={{
                            background: '#FFFFFF', border: '1.5px dashed var(--gold, #FCA311)',
                            borderRadius: '8px', padding: '0.55rem 1rem', color: 'var(--gold, #FCA311)',
                            fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem'
                          }}
                        >
                          <PlusCircle size={15} /> Agregar pregunta
                        </button>
                        
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button 
                            type="button"
                            onClick={() => setEditingQuestions(false)}
                            style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '0.55rem 1.1rem', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}
                          >
                            Cerrar
                          </button>
                          <button 
                            type="button"
                            onClick={handleSaveDraftEdits} 
                            disabled={actionLoading === 'saving'}
                            style={{
                              background: 'var(--navy, #14213D)', color: '#FFFFFF', border: 'none',
                              borderRadius: '8px', padding: '0.55rem 1.25rem', fontSize: '0.82rem',
                              fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem'
                            }}
                          >
                            <Save size={14} /> {actionLoading === 'saving' ? 'Guardando...' : 'Guardar Cambios'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

        </div>
      </div>

      {/* MODAL VISOR DE DOCUMENTO IN-APP (IGUAL AL DE LOS ESTUDIANTES) */}
      {selectedDoc && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 100000,
            padding: '1.25rem',
            animation: 'fadeIn 0.2s ease-out'
          }}
          onClick={() => setSelectedDoc(null)}
        >
          <div 
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '1100px',
              width: '100%',
              height: '88vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              border: '1px solid rgba(255, 255, 255, 0.2)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Encabezado del Visor */}
            <div style={{
              padding: '0.85rem 1.25rem',
              borderBottom: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#F8FAFC',
              flexShrink: 0
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                <div style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  background: 'var(--navy, #14213D)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                  flexShrink: 0
                }}>
                  <FileText size={17} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <h3 style={{
                    margin: 0,
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    color: 'var(--navy, #14213D)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {selectedDoc.title || 'Documento de la Clase'}
                  </h3>
                  {selectedDoc.description && (
                    <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#64748B' }}>
                      {selectedDoc.description}
                    </p>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
                <button
                  type="button"
                  onClick={() => setSelectedDoc(null)}
                  style={{
                    background: 'rgba(0, 0, 0, 0.05)',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.45rem 0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.82rem',
                    color: 'var(--navy, #14213D)',
                    transition: 'background 0.2s'
                  }}
                >
                  <X size={16} /> Cerrar Visor
                </button>
              </div>
            </div>

            {/* Contenedor del Iframe con Bloqueador de Redirección */}
            <div style={{ flex: 1, position: 'relative', width: '100%', height: '100%', background: '#0F172A' }}>
              {/* Bloqueador invisible sobre la esquina superior derecha */}
              <div 
                style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  width: '64px',
                  height: '56px',
                  zIndex: 20,
                  background: 'transparent',
                  cursor: 'default'
                }}
                title=""
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
              />

              <iframe
                src={formatEmbedDocUrl(selectedDoc.url)}
                title={selectedDoc.title || 'Visor de Documento'}
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  display: 'block'
                }}
                sandbox="allow-scripts allow-same-origin allow-forms"
                allow="autoplay"
              />
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}

/* ─────────────────────────────────────────
   TAB: MIS CLASES (Rediseñado de Alta Fidelidad)
   Módulo → Sesión → Clase
───────────────────────────────────────── */
function ClasesTab() {
  const { programId, teacherId, currentProgram } = useTeacherContext();
  const [searchParams] = useSearchParams();
  const [classes, setClasses]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [selectedClass, setSelectedClass] = useState(null);
  const [modalInitialSection, setModalInitialSection] = useState('preclass');
  const [expandedModules, setExpandedModules]   = useState({});
  const [expandedSessions, setExpandedSessions] = useState({});
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'upcoming' | 'completed' | 'pending'

  const fetchMyClasses = async () => {
    if (!teacherId) return; // Esperar hasta tener el ID del profesor
    try {
      setLoading(true);
      let data = [];
      const { data: sData, error: sErr } = await supabase
        .from('class_sessions')
        .select('*, sessions(id, title, order_index, module_id, modules(id, title, program_id)), meet_url, class_activities(id, is_published)')
        .eq('program_id', programId)
        .or(`teacher_id.eq.${teacherId},teacher_id.is.null`)
        .order('class_date', { ascending: true });

      if (sErr) {
        const { data: oldData, error: oldErr } = await supabase
          .from('class_sessions')
          .select('*, subtopics(id, title, module_id, modules(id, title, program_id)), meet_url, class_activities(id, is_published)')
          .eq('program_id', programId)
          .or(`teacher_id.eq.${teacherId},teacher_id.is.null`)
          .order('class_date', { ascending: true });
        if (oldErr) throw oldErr;
        data = oldData || [];
      } else {
        data = sData || [];
      }

      // Enriquecer con class_activities y activity_drafts para asegurar sincronización exacta
      const classIds = data.map(c => c.id);
      if (classIds.length > 0) {
        const [{ data: acts }, { data: drafts }] = await Promise.all([
          supabase
            .from('class_activities')
            .select('id, class_id, is_published, created_at')
            .in('class_id', classIds)
            .order('created_at', { ascending: false }),
          supabase
            .from('activity_drafts')
            .select('id, class_id, status, created_at')
            .in('class_id', classIds)
            .neq('status', 'rejected')
            .order('created_at', { ascending: false })
        ]);

        const actsByClass = {};
        (acts || []).forEach(a => {
          if (!actsByClass[a.class_id]) actsByClass[a.class_id] = [];
          actsByClass[a.class_id].push(a);
        });

        const draftsByClass = {};
        (drafts || []).forEach(d => {
          if (!draftsByClass[d.class_id]) draftsByClass[d.class_id] = [];
          draftsByClass[d.class_id].push(d);
        });

        data = data.map(c => {
          const classActs = actsByClass[c.id] || (Array.isArray(c.class_activities) ? c.class_activities : []);
          const classDrafts = draftsByClass[c.id] || [];
          const hasPublishedActivity = classActs.some(a => a.is_published) || classDrafts.some(d => d.status === 'approved' || d.status === 'published');
          return {
            ...c,
            class_activities: classActs,
            activity_drafts: classDrafts,
            has_published_activity: hasPublishedActivity
          };
        });
      }

      setClasses(data);

      // Expandir todos los módulos y sesiones por defecto
      const mods = {};
      const subs = {};
      (data || []).forEach(c => {
        const parentMod = c.sessions?.module_id || c.subtopics?.module_id;
        const parentSes = c.session_id || c.subtopic_id;
        if (parentMod) mods[parentMod] = true;
        if (parentSes) subs[parentSes] = true;
      });
      setExpandedModules(mods);
      setExpandedSessions(subs);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (programId && teacherId) fetchMyClasses(); }, [programId, teacherId]);

  // Auto-seleccionar clase y sección si vienen por URL (Deep-link desde el Dashboard de Inicio)
  useEffect(() => {
    const classIdParam = searchParams.get('classId');
    const sectionParam = searchParams.get('section');
    const filterParam = searchParams.get('filter');

    if (filterParam && ['all', 'upcoming', 'completed', 'pending'].includes(filterParam)) {
      setFilterStatus(filterParam);
    }

    if (classIdParam && classes.length > 0) {
      const targetClass = classes.find(c => String(c.id) === String(classIdParam));
      if (targetClass) {
        setSelectedClass(targetClass);
        if (sectionParam === 'actividad' || sectionParam === 'activity' || sectionParam === 'reforzamiento') {
          setModalInitialSection('activity');
        } else if (sectionParam === 'recording' || sectionParam === 'grabacion') {
          setModalInitialSection('recording');
        } else {
          setModalInitialSection('preclass');
        }
      }
    }
  }, [searchParams, classes]);

  // Suscripción Realtime en ClasesTab
  useEffect(() => {
    if (!programId) return;
    const channel = supabase
      .channel('clases_tab_realtime_sync_' + programId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'class_activities' }, () => {
        fetchMyClasses();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_drafts' }, () => {
        fetchMyClasses();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'class_sessions' }, () => {
        fetchMyClasses();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [programId, teacherId]);

  const toggleModule   = id => setExpandedModules(p => ({ ...p, [id]: !p[id] }));
  const toggleSession  = id => setExpandedSessions(p => ({ ...p, [id]: !p[id] }));

  if (loading) {
    return (
      <div style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--text-muted, #64748B)', background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
        <div style={{ width: '32px', height: '32px', border: '3px solid #E2E8F0', borderTopColor: 'var(--gold, #FCA311)', borderRadius: '50%', animation: 'liaterSpin 0.8s linear infinite', margin: '0 auto 1rem' }} />
        <span>Cargando clases del programa...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#DC2626', background: '#FEE2E2', borderRadius: '12px', border: '1px solid #FCA5A5' }}>
        Error: {error}
      </div>
    );
  }

  const now = new Date();

  // Filtrar por estado
  const filteredClasses = classes.filter(c => {
    const isPast = new Date(c.class_date) < now;
    const hasVideo = !!c.video_url;
    const hasActivity = !!c.has_published_activity || (Array.isArray(c.class_activities) && c.class_activities.some(a => a.is_published)) || (Array.isArray(c.activity_drafts) && c.activity_drafts.some(d => d.status === 'approved' || d.status === 'published'));
    const isCompleted = isPast && hasVideo && hasActivity;
    const isPending   = isPast && !isCompleted;

    if (filterStatus === 'upcoming')  return !isPast;
    if (filterStatus === 'pending')   return isPending;
    if (filterStatus === 'completed') return isCompleted;
    return true;
  });

  // Agrupar: Módulo → Sesión → Clase
  const grouped = {};
  filteredClasses.forEach(cls => {
    const sesObj = cls.sessions || cls.subtopics;
    const modId     = sesObj?.modules?.id    || 'sin-modulo';
    const modTitle  = sesObj?.modules?.title || 'Sin Módulo';
    const sesId     = cls.session_id || cls.subtopic_id || 'sin-sesion';
    let sesTitle    = sesObj?.title          || 'Sin Sesión';
    
    // Normalizar si viene como 'Sesion -1' o similar
    if (sesTitle.toLowerCase().includes('sesion -1') || sesTitle.toLowerCase().includes('sesión -1')) {
      sesTitle = sesTitle.replace(/-1/g, '1');
    }
    
    const sesOrder  = sesObj?.order_index    ?? 999;

    if (!grouped[modId]) grouped[modId] = { title: modTitle, sessions: {} };
    if (!grouped[modId].sessions[sesId]) {
      grouped[modId].sessions[sesId] = { title: sesTitle, order: sesOrder, classes: [], minDate: null, maxDate: null };
    }
    grouped[modId].sessions[sesId].classes.push(cls);
    // Rastrear rango de fechas de la sesión
    const d = new Date(cls.class_date);
    const sess = grouped[modId].sessions[sesId];
    if (!sess.minDate || d < new Date(sess.minDate)) sess.minDate = cls.class_date;
    if (!sess.maxDate || d > new Date(sess.maxDate)) sess.maxDate = cls.class_date;
  });

  const totalUpcoming  = classes.filter(c => new Date(c.class_date) >= now).length;
  const totalPending   = classes.filter(c => {
    const isPast = new Date(c.class_date) < now;
    const hasVideo = !!c.video_url;
    const hasActivity = !!c.has_published_activity || (Array.isArray(c.class_activities) && c.class_activities.some(a => a.is_published)) || (Array.isArray(c.activity_drafts) && c.activity_drafts.some(d => d.status === 'approved' || d.status === 'published'));
    return isPast && !(hasVideo && hasActivity);
  }).length;
  const totalCompleted = classes.filter(c => {
    const isPast = new Date(c.class_date) < now;
    const hasVideo = !!c.video_url;
    const hasActivity = !!c.has_published_activity || (Array.isArray(c.class_activities) && c.class_activities.some(a => a.is_published)) || (Array.isArray(c.activity_drafts) && c.activity_drafts.some(d => d.status === 'approved' || d.status === 'published'));
    return isPast && hasVideo && hasActivity;
  }).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      
      {/* ── HERO HEADER DE SECCIÓN ── */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        padding: '1.5rem 1.75rem',
        border: '1px solid #E2E8F0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
        boxShadow: '0 1px 3px rgba(20, 33, 61, 0.03)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '4px' }}>
            <span style={{
              background: '#F1F5F9',
              color: 'var(--navy, #14213D)',
              fontSize: '0.73rem',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '12px',
              textTransform: 'uppercase'
            }}>
              📚 Gestión Académica
            </span>
            <span style={{ color: 'var(--text-muted, #64748B)', fontSize: '0.8rem' }}>
              {currentProgram?.title || 'Curso'}
            </span>
          </div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--navy, #14213D)', margin: 0 }}>
            Mis Clases y Sesiones
          </h2>
          <p style={{ color: 'var(--text-muted, #64748B)', fontSize: '0.86rem', margin: '4px 0 0 0' }}>
            Administra los contenidos de tus clases, materiales de apoyo, grabaciones y actividades de reforzamiento IA.
          </p>
        </div>
      </div>

      {/* ── 4 KPI CARDS SUPERIORES ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '1rem'
      }}>
        {/* TOTAL CLASES */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '14px',
          padding: '1.25rem 1.5rem',
          border: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          boxShadow: '0 1px 3px rgba(20,33,61,0.02)'
        }}>
          <div style={{
            width: '46px', height: '46px', borderRadius: '12px',
            background: 'rgba(20,33,61,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--navy, #14213D)', flexShrink: 0
          }}>
            <BookOpen size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted, #64748B)', textTransform: 'uppercase' }}>
              Total Clases
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--navy, #14213D)' }}>
              {classes.length}
            </div>
            <div style={{ fontSize: '0.74rem', color: '#64748B' }}>
              Programadas en el curso
            </div>
          </div>
        </div>

        {/* PRÓXIMAS / EN VIVO */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '14px',
          padding: '1.25rem 1.5rem',
          border: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          boxShadow: '0 1px 3px rgba(20,33,61,0.02)'
        }}>
          <div style={{
            width: '46px', height: '46px', borderRadius: '12px',
            background: 'rgba(252,163,17,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--gold, #FCA311)', flexShrink: 0
          }}>
            <Video size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted, #64748B)', textTransform: 'uppercase' }}>
              Próximas Sesiones
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--navy, #14213D)' }}>
              {totalUpcoming}
            </div>
            <div style={{ fontSize: '0.74rem', color: '#64748B' }}>
              {totalUpcoming > 0 ? 'Por impartir' : 'Sin clases próximas'}
            </div>
          </div>
        </div>

        {/* PENDIENTES DE GESTIÓN */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '14px',
          padding: '1.25rem 1.5rem',
          border: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          boxShadow: '0 1px 3px rgba(20,33,61,0.02)'
        }}>
          <div style={{
            width: '46px', height: '46px', borderRadius: '12px',
            background: totalPending > 0 ? '#FEF3C7' : '#F8FAFC',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: totalPending > 0 ? '#92400E' : '#64748B', flexShrink: 0
          }}>
            <AlertTriangle size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted, #64748B)', textTransform: 'uppercase' }}>
              Atención Requerida
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: totalPending > 0 ? '#92400E' : 'var(--navy, #14213D)' }}>
              {totalPending}
            </div>
            <div style={{ fontSize: '0.74rem', color: '#64748B' }}>
              {totalPending > 0 ? 'Grabación o IA pendiente' : 'Todo al día'}
            </div>
          </div>
        </div>

        {/* FINALIZADAS CON ÉXITO */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '14px',
          padding: '1.25rem 1.5rem',
          border: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          boxShadow: '0 1px 3px rgba(20,33,61,0.02)'
        }}>
          <div style={{
            width: '46px', height: '46px', borderRadius: '12px',
            background: '#DCFCE7',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#007A2E', flexShrink: 0
          }}>
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted, #64748B)', textTransform: 'uppercase' }}>
              Finalizadas
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#007A2E' }}>
              {totalCompleted}
            </div>
            <div style={{ fontSize: '0.74rem', color: '#64748B' }}>
              Video y actividad OK
            </div>
          </div>
        </div>
      </div>

      {/* ── BARRA DE FILTROS TIPO PILL ── */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '14px',
        padding: '0.85rem 1.25rem',
        border: '1px solid #E2E8F0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem'
      }}>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {[
            { id: 'all',       label: 'Todas las clases', count: classes.length },
            { id: 'upcoming',  label: 'Próximas',         count: totalUpcoming },
            { id: 'pending',   label: 'Pendientes',       count: totalPending },
            { id: 'completed', label: 'Finalizadas',      count: totalCompleted }
          ].map(f => {
            const isSelected = filterStatus === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilterStatus(f.id)}
                style={{
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.45rem 0.9rem',
                  fontSize: '0.82rem',
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
                  fontSize: '0.72rem',
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

        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted, #64748B)' }}>
          Mostrando <strong>{filteredClasses.length}</strong> de {classes.length} clases
        </span>
      </div>

      {/* ── LISTADO / ACORDEÓN JERÁRQUICO ── */}
      {Object.keys(grouped).length === 0 ? (
        <div style={{ padding: '3.5rem', textAlign: 'center', background: '#FFFFFF', borderRadius: '16px', border: '1px dashed #CBD5E1' }}>
          <BookOpen size={40} color="#CBD5E1" style={{ margin: '0 auto 0.75rem' }} />
          <h3 style={{ color: 'var(--navy, #14213D)', marginBottom: '0.5rem', fontWeight: 700 }}>Sin clases que coincidan</h3>
          <p style={{ color: 'var(--text-muted, #64748B)', fontSize: '0.88rem', margin: 0 }}>
            Prueba cambiando el filtro seleccionado arriba.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {Object.entries(grouped).map(([modId, mod]) => {
            const isModExpanded = expandedModules[modId];
            const modClassCount = Object.values(mod.sessions).reduce((acc, s) => acc + s.classes.length, 0);

            return (
              <div key={modId} style={{
                background: '#FFFFFF',
                borderRadius: '16px',
                border: '1px solid #E2E8F0',
                overflow: 'hidden',
                boxShadow: '0 1px 3px rgba(20,33,61,0.03)'
              }}>
                {/* CABECERA DE MÓDULO */}
                <button
                  type="button"
                  onClick={() => toggleModule(modId)}
                  style={{
                    width: '100%',
                    padding: '1rem 1.4rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'linear-gradient(135deg, var(--navy, #14213D) 0%, #1e3a5f 100%)',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#FFFFFF',
                    textAlign: 'left',
                    transition: 'background 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '8px',
                      background: 'rgba(252,163,17,0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--gold, #FCA311)'
                    }}>
                      <Layers size={17} />
                    </div>
                    <div>
                      <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#FFFFFF' }}>{mod.title}</span>
                    </div>
                    <span style={{
                      fontSize: '0.74rem',
                      background: 'rgba(255,255,255,0.15)',
                      color: '#FFFFFF',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '12px'
                    }}>
                      {modClassCount} clase{modClassCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {isModExpanded ? <ChevronUp size={18} color="var(--gold, #FCA311)" /> : <ChevronDown size={18} color="var(--gold, #FCA311)" />}
                </button>

                {/* SESIONES DENTRO DEL MÓDULO */}
                {isModExpanded && Object.entries(mod.sessions).map(([sesId, ses]) => {
                  const isSesExpanded = expandedSessions[sesId];

                  return (
                    <div key={sesId} style={{ borderTop: '1px solid #E2E8F0' }}>
                      
                      {/* ENCABEZADO DE SESIÓN (Contraste definido) */}
                      <button
                        type="button"
                        onClick={() => toggleSession(sesId)}
                        style={{
                          width: '100%',
                          padding: '0.85rem 1.4rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: '#EAEFF5',
                          border: 'none',
                          borderLeft: '4px solid var(--gold, #FCA311)',
                          cursor: 'pointer',
                          textAlign: 'left',
                          borderBottom: '1px solid #CBD5E1',
                          transition: 'background 0.15s ease'
                        }}
                        onMouseOver={e => e.currentTarget.style.background = '#DFE6EE'}
                        onMouseOut={e => e.currentTarget.style.background = '#EAEFF5'}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <BookOpen size={16} color="var(--navy, #14213D)" />
                          <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--navy, #14213D)' }}>
                            {ses.title}
                          </span>
                          {ses.minDate && (
                            <span style={{
                              fontSize: '0.73rem',
                              color: '#334155',
                              background: '#FFFFFF',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              border: '1px solid #CBD5E1',
                              fontWeight: 600
                            }}>
                              {ses.minDate === ses.maxDate
                                ? new Date(ses.minDate).toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' })
                                : `${new Date(ses.minDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} – ${new Date(ses.maxDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}`
                              }
                            </span>
                          )}
                          <span style={{
                            fontSize: '0.73rem',
                            color: 'var(--navy, #14213D)',
                            background: 'rgba(20, 33, 61, 0.07)',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontWeight: 600
                          }}>
                            {ses.classes.length} clase{ses.classes.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        {isSesExpanded ? <ChevronUp size={16} color="var(--navy, #14213D)" /> : <ChevronDown size={16} color="var(--navy, #14213D)" />}
                      </button>

                      {/* CLASES DENTRO DE LA SESIÓN */}
                      {isSesExpanded && ses.classes.map(cls => {
                        const isPast      = new Date(cls.class_date) < now;
                        const hasVideo    = !!cls.video_url;
                        const hasActivity = !!cls.has_published_activity || (Array.isArray(cls.class_activities) && cls.class_activities.some(a => a.is_published)) || (Array.isArray(cls.activity_drafts) && cls.activity_drafts.some(d => d.status === 'approved' || d.status === 'published'));
                        const isCompleted = isPast && hasVideo && hasActivity;
                        const isPending   = isPast && !isCompleted;
                        const isToday     = new Date().toDateString() === new Date(cls.class_date).toDateString();
                        const isLive      = isClassLiveOrSoon(cls, 10);

                        return (
                          <div
                            key={cls.id}
                            style={{
                              padding: '1.1rem 1.6rem',
                              borderBottom: '1px solid #F1F5F9',
                              background: '#FFFFFF',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '1rem',
                              flexWrap: 'wrap',
                              transition: 'background 0.15s ease'
                            }}
                            onMouseOver={e => e.currentTarget.style.background = '#FAFBFD'}
                            onMouseOut={e => e.currentTarget.style.background = '#FFFFFF'}
                          >
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.9rem', flex: 1, minWidth: 0 }}>
                              
                              {/* BADGE DE ESTADO CIRCULAR */}
                              <div style={{
                                width: '10px', height: '10px', borderRadius: '50%',
                                marginTop: '6px', flexShrink: 0,
                                background: isCompleted ? '#007A2E' : isPending ? '#F97316' : isToday ? 'var(--gold, #FCA311)' : '#94A3B8',
                                boxShadow: isLive ? '0 0 0 3px rgba(220,38,38,0.2)' : 'none'
                              }} />

                              <div style={{ minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                  <div style={{ fontWeight: 800, color: 'var(--navy, #14213D)', fontSize: '0.92rem' }}>
                                    {cls.title}
                                  </div>
                                  
                                  {isLive && (
                                    <span style={{
                                      background: '#FEE2E2', color: '#DC2626',
                                      fontSize: '0.7rem', fontWeight: 800, padding: '1px 6px',
                                      borderRadius: '10px', border: '1px solid rgba(220,38,38,0.3)'
                                    }}>
                                      🔴 EN VIVO
                                    </span>
                                  )}
                                </div>

                                {/* METADATA Y CHIPS SEMÁNTICOS */}
                                <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '0.65rem', alignItems: 'center' }}>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <CalendarDays size={13} />
                                    {formatClassDate(cls.class_date, false)}
                                  </span>
                                  
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Timer size={13} />
                                    {cls.duration || 0} min
                                  </span>

                                  {isPast && (
                                    <>
                                      {/* GRABACIÓN STATUS CHIP */}
                                      <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                                        background: hasVideo ? '#DCFCE7' : '#FEF3C7',
                                        color: hasVideo ? '#007A2E' : '#92400E',
                                        border: `1px solid ${hasVideo ? 'rgba(0,122,46,0.2)' : 'rgba(245,158,11,0.3)'}`,
                                        padding: '2px 7px', borderRadius: '6px',
                                        fontSize: '0.74rem', fontWeight: 700
                                      }}>
                                        {hasVideo ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                                        {hasVideo ? 'Grabación OK' : 'Grabación pendiente'}
                                      </span>

                                      {/* ACTIVIDAD IA STATUS CHIP */}
                                      <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                                        background: hasActivity ? '#DCFCE7' : '#FEF3C7',
                                        color: hasActivity ? '#007A2E' : '#92400E',
                                        border: `1px solid ${hasActivity ? 'rgba(0,122,46,0.2)' : 'rgba(245,158,11,0.3)'}`,
                                        padding: '2px 7px', borderRadius: '6px',
                                        fontSize: '0.74rem', fontWeight: 700
                                      }}>
                                        {hasActivity ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                                        {hasActivity ? 'Actividad OK' : 'Actividad pendiente'}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* ACCIONES */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              {isLive && (cls.meet_url || currentProgram?.meet_url) && (
                                <a
                                  href={cls.meet_url || currentProgram?.meet_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{
                                    background: 'var(--gold, #FCA311)',
                                    color: 'var(--navy, #14213D)',
                                    padding: '0.45rem 0.95rem',
                                    borderRadius: '8px',
                                    fontSize: '0.8rem',
                                    fontWeight: 700,
                                    textDecoration: 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.4rem',
                                    flexShrink: 0,
                                    transition: 'all 0.15s ease',
                                    boxShadow: '0 2px 6px rgba(252,163,17,0.3)'
                                  }}
                                >
                                  <Video size={14} /> Entrar
                                </a>
                              )}

                              <Link
                                to={`/class/${cls.id}`}
                                style={{
                                  background: 'var(--navy, #14213D)',
                                  color: '#FFFFFF',
                                  border: 'none',
                                  borderRadius: '8px',
                                  padding: '0.48rem 1rem',
                                  fontSize: '0.82rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.45rem',
                                  flexShrink: 0,
                                  textDecoration: 'none',
                                  transition: 'all 0.15s ease'
                                }}
                                onMouseOver={e => e.currentTarget.style.background = '#000000'}
                                onMouseOut={e => e.currentTarget.style.background = 'var(--navy, #14213D)'}
                              >
                                <Eye size={14} /> Gestionar clase
                              </Link>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de detalle */}
      {selectedClass && (
        <ClassDetailModal
          selectedClass={selectedClass}
          allClasses={classes}
          initialSection={modalInitialSection}
          onClose={() => setSelectedClass(null)}
          onClassUpdated={fetchMyClasses}
        />
      )}
    </div>
  );
}


/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   TAB 4 — Materiales de Apoyo (Global)
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function SupportMaterialsTab() {
  const { id: teacherId, programId } = useTeacherContext();
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teacherId || !programId) return;
    async function fetchMaterials() {
      try {
        setLoading(true);
        const { data } = await supabase
          .from('resources')
          .select('*, class_sessions!inner(title, teacher_id, program_id)')
          .eq('class_sessions.teacher_id', teacherId)
          .eq('program_id', programId)
          .in('resource_type', ['presentation', 'pdf', 'link', 'file'])
          .order('created_at', { ascending: false });
        
        setMaterials(data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchMaterials();
  }, [teacherId]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <span style={{ fontWeight: 600, fontSize: '1rem' }}>Materiales de apoyo ({materials.length})</span>
      </div>

      <div style={{ background: '#eef2ff', color: '#3730a3', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
        <Info size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
        <div style={{ fontSize: '0.85rem' }}>
          <strong style={{ display: 'block', marginBottom: '4px' }}>Nota sobre la gestión de materiales</strong>
          Para añadir, editar o eliminar un material de una de tus clases, ve a la pestaña <strong>Mis Clases</strong>, haz clic en <strong>Ver Clase</strong> y gestiónalo desde allí. Aquí puedes ver una lista consolidada de todo el material.
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Cargando materiales...</p>
      ) : materials.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No hay materiales de apoyo en tus clases.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {materials.map(p => (
            <div className="resource-row" key={p.id}>
              <div className="resource-icon-box" style={{ background: '#f8fafc' }}>
                <FileText size={20} color="#64748b" />
              </div>
              <div className="resource-row-body">
                <div className="resource-row-title">{p.title}</div>
                <div className="resource-row-meta">Clase: {p.class_sessions?.title}</div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <TypePill type={p.resource_type} />
                <a href={p.url} target="_blank" rel="noreferrer" className="btn btn-outline" style={{ fontSize: '0.8rem', padding: '0.4rem 0.6rem' }}><Eye size={13} style={{display:'inline', marginRight:'4px'}}/> Ver</a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   MODAL DE ANUNCIOS
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function AnnouncementModal({ announcement, onClose, onRefresh }) {
  const { id: teacherId, programId } = useTeacherContext();
  const [title, setTitle] = useState(announcement?.title || '');
  const [body, setBody] = useState(announcement?.body || '');
  const [tag, setTag] = useState(announcement?.tag || 'general');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const TAG_OPTIONS = [
    { value: 'general', label: 'General',     icon: '📢', color: '#14213D', bg: '#EEF2F8' },
    { value: 'info',    label: 'Informativo', icon: '📌', color: '#1d4ed8', bg: '#dbeafe' },
    { value: 'urgent',  label: 'Urgente',     icon: '🔴', color: '#991b1b', bg: '#fee2e2' },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      setError('El título y el mensaje son obligatorios.');
      return;
    }
    setSubmitting(true);
    setError('');
    const payload = { teacher_id: teacherId, program_id: programId, title: title.trim(), body: body.trim(), tag };
    try {
      if (announcement?.id) {
        const { error: updateError } = await supabase.from('announcements').update(payload).eq('id', announcement.id).eq('teacher_id', teacherId);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from('announcements').insert([payload]);
        if (insertError) throw insertError;
      }
      onRefresh();
      onClose();
    } catch (err) {
      setError('Error al guardar el anuncio: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '0.7rem 0.9rem',
    border: '1.5px solid #E2E8F0', borderRadius: '10px',
    fontSize: '0.9rem', color: 'var(--navy)',
    background: '#FAFBFD', outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    boxSizing: 'border-box'
  };

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0,
      backgroundColor: 'rgba(14,21,50,0.65)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 99999, padding: '1rem',
      animation: 'fadeIn 0.2s ease'
    }}>
      <div style={{
        width: '100%', maxWidth: '560px',
        background: 'var(--white)',
        borderRadius: '20px',
        boxShadow: '0 25px 60px rgba(14,21,50,0.18)',
        overflow: 'hidden',
        animation: 'slideUp 0.25s cubic-bezier(0.34,1.56,0.64,1)'
      }}>
        {/* HEADER */}
        <div style={{
          background: 'linear-gradient(135deg, var(--navy) 0%, #1e3a5f 100%)',
          padding: '1.5rem 2rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '38px', height: '38px', borderRadius: '10px',
              background: 'rgba(252,163,17,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Megaphone size={20} color="var(--gold)" />
            </div>
            <div>
              <div style={{ color: 'var(--white)', fontWeight: 700, fontSize: '1rem' }}>
                {announcement ? 'Editar Anuncio' : 'Nuevo Anuncio'}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.75rem' }}>
                Comunicación con estudiantes del programa
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer',
            borderRadius: '8px', padding: '0.4rem', color: 'rgba(255,255,255,0.7)',
            display: 'flex', transition: 'background 0.2s'
          }}
            onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
            onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
          >
            <X size={20} />
          </button>
        </div>

        {/* FORM BODY */}
        <form onSubmit={handleSubmit} style={{ padding: '1.75rem 2rem 2rem' }}>
          {error && (
            <div style={{
              background: '#fee2e2', color: '#991b1b',
              padding: '0.65rem 1rem', borderRadius: '10px',
              fontSize: '0.83rem', fontWeight: 500,
              marginBottom: '1.25rem', display: 'flex', gap: '0.5rem', alignItems: 'center'
            }}>
              <AlertCircle size={15} /> {error}
            </div>
          )}

          {/* TÍTULO */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Título del Anuncio
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ej: Cambio de horario de la sesión 3..."
              style={inputStyle}
              onFocus={e => { e.target.style.borderColor = 'var(--gold)'; e.target.style.boxShadow = '0 0 0 3px rgba(252,163,17,0.12)'; }}
              onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none'; }}
              required
            />
          </div>

          {/* TAG PILLS */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Categoría
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {TAG_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTag(opt.value)}
                  style={{
                    padding: '0.4rem 0.85rem',
                    borderRadius: '999px',
                    border: tag === opt.value ? `2px solid ${opt.color}` : '1.5px solid #E2E8F0',
                    background: tag === opt.value ? opt.bg : 'var(--white)',
                    color: tag === opt.value ? opt.color : 'var(--text-muted)',
                    fontWeight: tag === opt.value ? 700 : 500,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'flex', alignItems: 'center', gap: '0.3rem'
                  }}
                >
                  <span>{opt.icon}</span> {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* MENSAJE */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Mensaje
            </label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={5}
              placeholder="Escribe el contenido del anuncio para tus estudiantes..."
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
              onFocus={e => { e.target.style.borderColor = 'var(--gold)'; e.target.style.boxShadow = '0 0 0 3px rgba(252,163,17,0.12)'; }}
              onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none'; }}
              required
            />
            <div style={{ textAlign: 'right', fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              {body.length} caracteres
            </div>
          </div>

          {/* ACTIONS */}
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="button" onClick={onClose} style={{
              flex: 1, padding: '0.75rem',
              borderRadius: '10px', border: '1.5px solid #E2E8F0',
              background: 'var(--white)', color: 'var(--text-muted)',
              fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer',
              transition: 'all 0.2s'
            }}
              onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--navy)'; e.currentTarget.style.color = 'var(--navy)'; }}
              onMouseOut={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              Cancelar
            </button>
            <button type="submit" disabled={submitting} style={{
              flex: 2, padding: '0.75rem',
              borderRadius: '10px', border: 'none',
              background: submitting ? '#9ca3af' : 'linear-gradient(135deg, var(--navy) 0%, #1e3a5f 100%)',
              color: 'var(--white)',
              fontWeight: 700, fontSize: '0.88rem', cursor: submitting ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              transition: 'all 0.2s',
              boxShadow: submitting ? 'none' : '0 4px 14px rgba(14,21,50,0.25)'
            }}>
              {submitting ? (
                <><RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> Guardando...</>
              ) : (
                <><Megaphone size={15} /> {announcement ? 'Guardar Cambios' : 'Publicar Anuncio'}</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

/* ─────────────────────────────────────────
   TAB — Anuncios (Premium Rewrite)
───────────────────────────────────────── */


/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   TAB 7 — Perfil
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function PerfilTab() {
  const { profile, setProfile } = useTeacherContext();
  const [newPassword, setNewPassword] = useState('');
  const [updatingPwd, setUpdatingPwd] = useState(false);
  const [pwdMsg, setPwdMsg] = useState({ text: '', type: '' });
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({ area: profile.area || '', bio: profile.bio || '' });

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      const { data, error } = await supabase
        .from('teacher_profiles')
        .update({ area: editData.area, bio: editData.bio })
        .eq('id', profile.id)
        .select('*, users_profile(email)')
        .single();
      
      if (error) throw error;
      setProfile(data);
      setEditing(false);
    } catch (err) {
      console.error('Error updating profile:', err);
      alert('Error al actualizar perfil: ' + err.message);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setPwdMsg({ text: 'Debe tener al menos 6 caracteres.', type: 'error' });
      return;
    }
    setUpdatingPwd(true);
    setPwdMsg({ text: '', type: '' });
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPwdMsg({ text: 'Contraseña actualizada con éxito.', type: 'success' });
      setNewPassword('');
    } catch (err) {
      setPwdMsg({ text: 'Error al actualizar: ' + err.message, type: 'error' });
    } finally {
      setUpdatingPwd(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <span style={{ fontWeight: 600, fontSize: '1rem' }}>Mi Perfil Público</span>
        {!editing && (
          <button onClick={() => setEditing(true)} className="btn btn-outline" style={{ display: 'flex', gap: '0.5rem' }}>
            <Pencil size={16} /> Editar Perfil
          </button>
        )}
      </div>
      <div className="card" style={{ maxWidth: '600px' }}>
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', marginBottom: '1.5rem' }}>
          <img src={profile.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name)}&background=14213D&color=FCA311&size=150`} alt="Avatar" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover' }} />
          <div>
            <h3 style={{ fontWeight: 700, fontSize: '1.1rem' }}>{profile.name}</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{profile.users_profile?.email}</p>
          </div>
        </div>
        {editing ? (
          <form onSubmit={handleUpdateProfile}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: 500 }}>Especialidad / Área</label>
              <input type="text" value={editData.area} onChange={e => setEditData({...editData, area: e.target.value})} style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-color)', borderRadius: '4px' }} required />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: 500 }}>Biografía corta</label>
              <textarea value={editData.bio} onChange={e => setEditData({...editData, bio: e.target.value})} rows={4} style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-color)', borderRadius: '4px' }} required />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setEditing(false)} className="btn btn-outline">Cancelar</button>
              <button type="submit" className="btn btn-primary">Guardar Cambios</button>
            </div>
          </form>
        ) : (
          <>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: 500 }}>Especialidad / Área</label>
              <input type="text" value={profile.area || ''} disabled style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-color)', borderRadius: '4px', background: '#f8fafc' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: 500 }}>Biografía corta</label>
              <textarea value={profile.bio || ''} disabled rows={4} style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-color)', borderRadius: '4px', background: '#f8fafc' }} />
            </div>
          </>
        )}
      </div>

      <div className="card" style={{ maxWidth: '600px', marginTop: '1.5rem' }}>
        <h3 style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '1rem' }}>Cambiar Contraseña</h3>
        {pwdMsg.text && (
          <div style={{ color: pwdMsg.type === 'error' ? 'red' : 'green', marginBottom: '1rem', fontSize: '0.85rem' }}>
            {pwdMsg.text}
          </div>
        )}
        <form onSubmit={handleUpdatePassword} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: 500 }}>Nueva Contraseña</label>
            <input 
              type="password" 
              value={newPassword} 
              onChange={e => setNewPassword(e.target.value)} 
              placeholder="Mínimo 6 caracteres"
              required
              style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-color)', borderRadius: '4px' }} 
            />
          </div>
          <button type="submit" disabled={updatingPwd} className="btn btn-primary">
            {updatingPwd ? 'Guardando...' : 'Actualizar'}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   HELPER COMPONENT: StatusChip
───────────────────────────────────────── */
function StatusChip({ status }) {
  const configs = {
    enviada:   { bg: '#dbeafe', color: '#1e40af', icon: <Clock size={13} />,       label: 'Nueva (Sin revisar)' },
    revisada:  { bg: '#fef3c7', color: '#92400e', icon: <Eye size={13} />,         label: 'Para clase (Revisada)' },
    atendida:  { bg: '#dcfce7', color: '#166534', icon: <CheckCircle2 size={13} />, label: 'Atendida en clase' },
    archivada: { bg: '#f1f5f9', color: '#475569', icon: <Layers size={13} />,       label: 'Archivada' }
  };
  const cfg = configs[status] || configs.enviada;
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.35rem',
      padding: '0.25rem 0.65rem',
      borderRadius: '12px',
      fontSize: '0.74rem',
      fontWeight: 600,
      background: cfg.bg,
      color: cfg.color
    }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

/* ─────────────────────────────────────────
   TAB 1 — Resumen (Hero + stats rápidas)
───────────────────────────────────────── */
function ResumenTab({ onChangeTab }) {
  const { profile, teacherId, programId, currentProgram } = useTeacherContext();
  const [stats, setStats] = useState({
    totalClasses: 0,
    completed: 0,
    upcoming: 0,
    announcements: 0,
    students: 0,
    pendingDoubts: 0,
    pendingDrafts: 0,      // borradores IA pendientes de revisión
    missingRecordings: 0,  // clases pasadas sin video_url
    pendingEvaluations: 0, // entregas de estudiantes pendientes por calificar
  });
  const [loading, setLoading] = useState(true);
  const [upcomingClasses, setUpcomingClasses] = useState([]);  // máx 1 (la más próxima)
  const [pendingDoubts, setPendingDoubts] = useState([]);
  const [urgentAlerts, setUrgentAlerts] = useState([]);        // bandeja de acción

  const fetchStatsAndDoubts = async () => {
    if (!programId) return;
    try {
      setLoading(true);

      const teacherProfileId = teacherId || profile?.id;
      const pClasses = supabase.from('class_sessions')
        .select('id, title, class_date, program_id, duration, description, meet_url')
        .eq('program_id', programId)
        .eq('teacher_id', teacherProfileId)
        .order('class_date', { ascending: true });
        
      const pAnnouncements = supabase.from('announcements')
        .select('*', { count: 'exact', head: true })
        .eq('program_id', programId);
        
      const pStudents = supabase.from('enrollments')
        .select('student_id, users_profile!inner(role)', { count: 'exact', head: true })
        .eq('program_id', programId)
        .eq('users_profile.role', 'student');

      // Consultar dudas no revisadas ('enviada') para el contador dinámico
      const pUnreviewedDoubts = supabase.from('class_doubts')
        .select('*', { count: 'exact', head: true })
        .eq('program_id', programId)
        .eq('status', 'enviada');

      // Consultar las últimas dudas recibidas que requieren atención
      const pTopDoubts = supabase.from('class_doubts')
        .select(`
          *,
          class_sessions (id, title),
          users_profile:student_id (full_name)
        `)
        .eq('program_id', programId)
        .in('status', ['enviada', 'revisada'])
        .order('created_at', { ascending: false })
        .limit(3);

      // Query A: Borradores IA pendientes de las clases del profesor
      const pPendingDrafts = supabase
        .from('activity_drafts')
        .select('id, class_id, status, draft_data, created_at, class_sessions!inner(id, title, program_id, teacher_id)', { count: 'exact' })
        .eq('class_sessions.program_id', programId)
        .eq('class_sessions.teacher_id', teacherProfileId)
        .eq('status', 'pending');

      // Query B: Clases PROPIAS del profesor pasadas sin grabación (class_date < ahora Y video_url IS NULL)
      const pMissingRecordings = supabase
        .from('class_sessions')
        .select('id, title, class_date', { count: 'exact', head: false })
        .eq('program_id', programId)
        .eq('teacher_id', teacherProfileId)
        .lt('class_date', new Date().toISOString())
        .is('video_url', null);

      // Query C: Actividades de reforzamiento publicadas en las clases del profesor
      const pActivities = supabase
        .from('class_activities')
        .select('id, class_id, is_published, class_sessions!inner(id, program_id, teacher_id)')
        .eq('class_sessions.program_id', programId)
        .eq('class_sessions.teacher_id', teacherProfileId)
        .eq('is_published', true);

      // Query D: Anuncios institucionales para profesores
      const pAdminAnnouncements = supabase
        .from('announcements')
        .select('*')
        .is('program_id', null)
        .in('target_role', ['teacher', 'all'])
        .order('created_at', { ascending: false });

      const [resClasses, resAnn, resStudents, resUnreviewed, resTopDoubts, resDrafts, resMissingRec, resActivities, resAdminAnnouncements] = await Promise.all([
        pClasses, pAnnouncements, pStudents, pUnreviewedDoubts, pTopDoubts, pPendingDrafts, pMissingRecordings, pActivities, pAdminAnnouncements
      ]);
      
      const classes = resClasses.data || [];
      const now = new Date();
      const getEndTime = (c) => new Date(new Date(c.class_date).getTime() + (c.duration || 120) * 60000);

      const completed = classes.filter(c => getEndTime(c) < now).length;
      const upcomingList = classes.filter(c => getEndTime(c) >= now);
      
      setUpcomingClasses(upcomingList.slice(0, 1));
      setPendingDoubts(resTopDoubts.data || []);

      const alerts = [];

      // Alerta: borradores IA pendientes de validación
      if ((resDrafts.data || []).length > 0) {
        (resDrafts.data || []).forEach(d => {
          alerts.push({
            id: d.id,
            type: 'draft',
            title: `Borrador IA pendiente: "${d.draft_data?.activity_title || 'Sin título'}"`,
            subtitle: `Clase: ${d.class_sessions?.title || 'Clase vinculada'} · Generado ${new Date(d.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}`,
            action: 'Validar en Mis Clases',
            tab: 'clases',
            icon: 'sparkles',
            color: '#FCA311',
          });
        });
      }

      // Alerta: clases sin grabación vinculada
      if ((resMissingRec.data || []).length > 0) {
        (resMissingRec.data || []).forEach(c => {
          alerts.push({
            id: c.id + '-rec',
            type: 'recording',
            title: `Grabación pendiente: "${c.title}"`,
            subtitle: `Clase del ${new Date(c.class_date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })} · Sin grabación vinculada`,
            action: 'Ir a Mis Clases',
            tab: 'clases',
            icon: 'video',
            color: '#14213D',
          });
        });
      }
      setUrgentAlerts(alerts);

      setStats({
        totalClasses: classes.length,
        completed,
        upcoming: upcomingList.length,
        announcements: resAnn.count || 0,
        students: resStudents.count || 0,
        pendingDoubts: resUnreviewed.count || 0,
        pendingDrafts: (resDrafts.data || []).length,
        missingRecordings: (resMissingRec.data || []).length,
        activeActivities: (resActivities.data || []).length,
        pendingEvaluations: 0, // Placeholder
        adminAnnouncements: resAdminAnnouncements.data || [],
      });
    } catch (err) {
      console.error('Error fetching teacher stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatsAndDoubts();
  }, [profile?.id, programId]);

  // Actualizar estado de una duda directamente desde el Resumen y actualizar contador en caliente
  const handleQuickStatusChange = async (doubtId, newStatus) => {
    setPendingDoubts(prev => prev.map(d => d.id === doubtId ? { ...d, status: newStatus } : d));
    
    // Si la duda pasa de 'enviada' a otro estado, decrementar el contador dinámicamente
    const target = pendingDoubts.find(d => d.id === doubtId);
    if (target && target.status === 'enviada' && newStatus !== 'enviada') {
      setStats(prev => ({ ...prev, pendingDoubts: Math.max(0, prev.pendingDoubts - 1) }));
    }

    await updateDoubtStatus(doubtId, newStatus);
  };

  if (loading) {
    return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando resumen del programa...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* ── ENCABEZADO DEL PROGRAMA ── */}
      {/* ── HERO BANNER DEL CURSO (Rediseño limpio 60-30-10) ── */}
      <div className="card teacher-course-hero" style={{
        padding: '1.75rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#FFFFFF',
        border: '1px solid var(--border-color, #E2E8F0)',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(20, 33, 61, 0.04)',
        flexWrap: 'wrap',
        gap: '1.25rem'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: '0.72rem',
              color: 'var(--navy, #14213D)',
              background: '#F1F5F9',
              padding: '0.2rem 0.6rem',
              borderRadius: '4px',
              textTransform: 'uppercase',
              fontWeight: 700,
              letterSpacing: '0.06em'
            }}>
              {currentProgram?.program_type === 'curso' ? 'Curso Corto' : 'Diplomado'} · Panel Docente
            </span>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              background: 'rgba(0, 122, 46, 0.08)',
              color: '#007A2E',
              padding: '0.2rem 0.6rem',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              fontWeight: 700
            }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#007A2E' }} />
              Programa activo
            </span>
          </div>

          <h1 style={{ fontSize: '1.5rem', color: 'var(--navy, #14213D)', margin: '0 0 0.4rem 0', fontWeight: 800, letterSpacing: '-0.01em' }}>
            {currentProgram?.title || 'Cargando programa...'}
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem', fontSize: '0.84rem', color: 'var(--text-muted, #64748B)' }}>
            <span>Prof. <strong style={{ color: 'var(--navy, #14213D)', fontWeight: 700 }}>{profile.name}</strong></span>
            <span>·</span>
            <span><strong style={{ color: 'var(--navy, #14213D)', fontWeight: 700 }}>{stats.students}</strong> estudiantes inscritos</span>
          </div>
        </div>

        <button
          className="btn"
          onClick={() => onChangeTab('anuncios')}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            background: 'var(--gold, #FCA311)', color: 'var(--navy, #14213D)', border: 'none',
            fontWeight: 700, fontSize: '0.85rem', padding: '0.65rem 1.35rem',
            borderRadius: '8px', cursor: 'pointer', whiteSpace: 'nowrap',
            boxShadow: '0 2px 6px rgba(252, 163, 17, 0.3)',
            transition: 'all 0.2s ease',
          }}
          onMouseOver={e => { e.currentTarget.style.background = '#e8960a'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseOut={e => { e.currentTarget.style.background = 'var(--gold, #FCA311)'; e.currentTarget.style.transform = 'translateY(0)'; }}
        >
          <Megaphone size={16} /> Crear anuncio
        </button>
      </div>

      {/* ── KPI CARDS (4 indicadores limpios y estandarizados) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
        {/* KPI 1: Dudas por revisar */}
        <div className="card" style={{
          padding: '1.35rem 1.5rem',
          borderLeft: `4px solid ${stats.pendingDoubts > 0 ? 'var(--gold, #FCA311)' : '#E2E8F0'}`,
          borderRadius: '10px',
          background: stats.pendingDoubts > 0 ? 'rgba(252, 163, 17, 0.04)' : '#FFFFFF',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          boxShadow: '0 1px 3px rgba(20, 33, 61, 0.04)'
        }}
          onClick={() => onChangeTab('dudas')}
          onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <span style={{ fontSize: '2.3rem', fontWeight: 800, color: stats.pendingDoubts > 0 ? 'var(--gold-dark, #d98a00)' : 'var(--navy, #14213D)', lineHeight: 1 }}>{stats.pendingDoubts}</span>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted, #64748B)', fontWeight: 700, marginTop: '0.5rem', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Dudas sin revisar</span>
        </div>

        {/* KPI 2: Próximas clases */}
        <div className="card" style={{
          padding: '1.35rem 1.5rem',
          borderLeft: '4px solid var(--navy, #14213D)',
          borderRadius: '10px',
          background: '#FFFFFF',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          boxShadow: '0 1px 3px rgba(20, 33, 61, 0.04)'
        }}
          onClick={() => onChangeTab('clases')}
          onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <span style={{ fontSize: '2.3rem', fontWeight: 800, color: 'var(--navy, #14213D)', lineHeight: 1 }}>{stats.upcoming}</span>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted, #64748B)', fontWeight: 700, marginTop: '0.5rem', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Próximas clases</span>
        </div>

        {/* KPI 3: Borradores IA pendientes */}
        <div className="card" style={{
          padding: '1.35rem 1.5rem',
          borderLeft: `4px solid ${stats.pendingDrafts > 0 ? 'var(--gold, #FCA311)' : '#E2E8F0'}`,
          borderRadius: '10px',
          background: stats.pendingDrafts > 0 ? 'rgba(252, 163, 17, 0.04)' : '#FFFFFF',
          cursor: stats.pendingDrafts > 0 ? 'pointer' : 'default',
          transition: 'all 0.2s ease',
          boxShadow: '0 1px 3px rgba(20, 33, 61, 0.04)'
        }}
          onClick={() => stats.pendingDrafts > 0 && onChangeTab('clases')}
          onMouseOver={e => stats.pendingDrafts > 0 && (e.currentTarget.style.transform = 'translateY(-2px)')}
          onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '2.3rem', fontWeight: 800, color: stats.pendingDrafts > 0 ? 'var(--gold-dark, #d98a00)' : 'var(--navy, #14213D)', lineHeight: 1 }}>{stats.pendingDrafts}</span>
            {stats.pendingDrafts > 0 && <Sparkles size={18} color="var(--gold, #FCA311)" />}
          </div>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted, #64748B)', fontWeight: 700, marginTop: '0.5rem', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Borradores IA</span>
        </div>

        {/* KPI 4: Clases sin grabación */}
        <div className="card" style={{
          padding: '1.35rem 1.5rem',
          borderLeft: `4px solid ${stats.missingRecordings > 0 ? '#dc2626' : '#E2E8F0'}`,
          borderRadius: '10px',
          background: stats.missingRecordings > 0 ? 'rgba(220, 38, 38, 0.03)' : '#FFFFFF',
          cursor: stats.missingRecordings > 0 ? 'pointer' : 'default',
          transition: 'all 0.2s ease',
          boxShadow: '0 1px 3px rgba(20, 33, 61, 0.04)'
        }}
          onClick={() => stats.missingRecordings > 0 && onChangeTab('clases')}
          onMouseOver={e => stats.missingRecordings > 0 && (e.currentTarget.style.transform = 'translateY(-2px)')}
          onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <span style={{ fontSize: '2.3rem', fontWeight: 800, color: stats.missingRecordings > 0 ? '#dc2626' : 'var(--navy, #14213D)', lineHeight: 1 }}>{stats.missingRecordings}</span>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted, #64748B)', fontWeight: 700, marginTop: '0.5rem', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Sin grabación</span>
        </div>
      </div>
      {/* ── BANDEJA DE ACCIÓN URGENTE ── Solo visible si hay alertas */}
      {urgentAlerts.length > 0 && (
        <div className="card" style={{ padding: '1.5rem', border: '1px solid rgba(252, 163, 17, 0.3)', background: 'rgba(252, 163, 17, 0.04)', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
            <AlertCircle size={18} color="#FCA311" />
            <h3 style={{ margin: 0, color: '#14213D', fontSize: '1rem', fontWeight: 700 }}>
              Acciones requeridas <span style={{ background: '#FCA311', color: '#14213D', fontSize: '0.7rem', fontWeight: 800, padding: '2px 8px', borderRadius: '9999px', marginLeft: '6px' }}>{urgentAlerts.length}</span>
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {urgentAlerts.map(alert => (
              <div key={alert.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '1rem 1.25rem', background: '#FFFFFF',
                border: `1px solid ${alert.color === '#FCA311' ? 'rgba(252,163,17,0.25)' : 'rgba(20,33,61,0.15)'}`,
                borderRadius: '8px', gap: '1rem', flexWrap: 'wrap',
                transition: 'all 0.2s ease',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  <div style={{ background: alert.color === '#FCA311' ? 'rgba(252,163,17,0.12)' : 'rgba(20,33,61,0.08)', padding: '0.5rem', borderRadius: '8px' }}>
                    {alert.type === 'draft' ? (
                      <Sparkles size={18} color={alert.color} />
                    ) : alert.type === 'evaluation' ? (
                      <FileCheck size={18} color={alert.color} />
                    ) : (
                      <Video size={18} color={alert.color} />
                    )}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, color: '#14213D', fontSize: '0.9rem' }}>{alert.title}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>{alert.subtitle}</div>
                  </div>
                </div>
                <button
                  onClick={() => onChangeTab(alert.tab)}
                  style={{
                    background: alert.color, color: alert.color === '#FCA311' ? '#14213D' : '#FFFFFF',
                    border: 'none', borderRadius: '6px', padding: '0.4rem 0.9rem',
                    fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
                    transition: 'all 0.2s ease', whiteSpace: 'nowrap', flexShrink: 0,
                  }}
                  onMouseOver={e => e.currentTarget.style.opacity = '0.85'}
                  onMouseOut={e => e.currentTarget.style.opacity = '1'}
                >
                  {alert.action}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* ── GRID PRINCIPAL (2 columnas) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem', alignItems: 'start' }}>
        {/* COLUMNA IZQUIERDA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Tu próxima clase */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, color: '#14213D', fontSize: '1.05rem', fontWeight: 700 }}>
                Tu próxima clase
              </h3>
              <button onClick={() => onChangeTab('clases')} className="btn btn-outline" style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}>
                Ver todas
              </button>
            </div>
            {upcomingClasses.length === 0 ? (
              <div style={{ padding: '2.5rem', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #E5E5E5' }}>
                <CalendarDays size={32} color="#E5E5E5" style={{ margin: '0 auto 0.75rem' }} />
                <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)', fontWeight: 600 }}>No hay clases próximas programadas</p>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>El administrador asignará las próximas sesiones</span>
              </div>
            ) : (
              upcomingClasses.map(c => {
                const classDate = new Date(c.class_date);
                const isToday = new Date().toDateString() === classDate.toDateString();
                return (
                  <div key={c.id} style={{
                    padding: '1.25rem', border: isToday ? '2px solid #FCA311' : '1px solid #E5E5E5',
                    borderRadius: '10px', background: isToday ? 'rgba(252,163,17,0.04)' : '#FFFFFF',
                  }}>
                    {isToday && (
                      <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#FCA311', background: 'rgba(252,163,17,0.15)', padding: '2px 10px', borderRadius: '9999px', marginBottom: '0.75rem', display: 'inline-block', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        ¡HOY!
                      </span>
                    )}
                    <div style={{ fontWeight: 800, color: '#14213D', fontSize: '1.05rem', marginBottom: '0.5rem' }}>{c.title}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.85rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <CalendarDays size={14} />
                        {classDate.toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'long' })}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={14} />
                        {classDate.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false, hourCycle: 'h23' })} · {c.duration || 0} min
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                      {getGoogleCalendarUrl(c, currentProgram?.title, profile?.name || currentUser?.full_name) && (
                        <a
                          href={getGoogleCalendarUrl(c, currentProgram?.title, profile?.name || currentUser?.full_name)}
                          target="_blank"
                          rel="noreferrer"
                          title="Agendar esta clase en Google Calendar"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            background: '#F8FAFC',
                            color: 'var(--navy, #14213D)',
                            border: '1px solid #E2E8F0',
                            padding: '0.45rem 0.9rem',
                            borderRadius: '7px',
                            fontWeight: 700,
                            fontSize: '0.8rem',
                            textDecoration: 'none',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseOver={e => { e.currentTarget.style.background = '#E2E8F0'; }}
                          onMouseOut={e => { e.currentTarget.style.background = '#F8FAFC'; }}
                        >
                          <CalendarPlus size={14} color="var(--gold-dark, #b45309)" />
                          <span>Agendar en Calendar</span>
                        </a>
                      )}
                    {isClassLiveOrSoon(c, 10) && (c.meet_url || currentProgram?.meet_url) ? (
                      <a href={c.meet_url || currentProgram?.meet_url} target="_blank" rel="noreferrer" style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                        background: '#14213D', color: '#FFFFFF', textDecoration: 'none',
                        padding: '0.5rem 1.1rem', borderRadius: '7px', fontWeight: 700,
                        fontSize: '0.83rem', transition: 'all 0.2s ease',
                      }}
                        onMouseOver={e => e.currentTarget.style.background = '#000000'}
                        onMouseOut={e => e.currentTarget.style.background = '#14213D'}
                      >
                        <Video size={15} /> Unirse a la sesión en vivo
                      </a>
                    ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          {/* Dudas que requieren atención — SOLO LECTURA, navega a la pestaña Dudas */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ margin: 0, color: '#14213D', fontSize: '1.05rem', fontWeight: 700 }}>Dudas que requieren atención</h3>
                <p style={{ margin: '3px 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Haz clic en cualquier duda para gestionarla
                </p>
              </div>
              <button onClick={() => onChangeTab('dudas')} className="btn btn-outline" style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}>Ver todas</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {pendingDoubts.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', background: '#f8fafc', borderRadius: '8px' }}>
                  <CheckCircle2 size={28} color="#E5E5E5" style={{ margin: '0 auto 0.5rem' }} />
                  <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)', fontWeight: 600 }}>¡Sin dudas pendientes!</p>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Las nuevas dudas de estudiantes aparecerán aquí</span>
                </div>
              ) : (
                pendingDoubts.map(d => (
                  <div
                    key={d.id}
                    onClick={() => onChangeTab('dudas', d.id)}
                    title="Clic para gestionar esta duda en la Bandeja de Consultas"
                    style={{
                      padding: '1rem 1.25rem', border: '1px solid #E5E5E5',
                      borderRadius: '8px', background: '#FFFFFF',
                      cursor: 'pointer', transition: 'all 0.18s ease',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem'
                    }}
                    onMouseOver={e => { e.currentTarget.style.borderColor = 'rgba(252,163,17,0.5)'; e.currentTarget.style.background = '#fffdf5'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 3px 10px rgba(252,163,17,0.1)'; }}
                    onMouseOut={e => { e.currentTarget.style.borderColor = '#E5E5E5'; e.currentTarget.style.background = '#FFFFFF'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: '#14213D', fontSize: '0.9rem', marginBottom: '0.2rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {d.subject}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, color: '#14213D' }}>{d.users_profile?.full_name || 'Estudiante'}</span>
                        <span>·</span>
                        <span>{d.class_sessions?.title || 'Clase'}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                      <StatusChip status={d.status} />
                      <ChevronRight size={14} color="#94a3b8" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        {/* COLUMNA DERECHA — Resumen estadístico */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1.25rem 0', color: '#14213D', fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <BookOpen size={16} color="#FCA311" /> Resumen del Programa
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {[
                { label: 'Total de clases', value: stats.totalClasses, color: '#14213D' },
                { label: 'Clases completadas', value: stats.completed, color: '#16a34a' },
                { label: 'Clases pendientes', value: stats.upcoming, color: '#14213D' },
                { label: 'Actividades IA activas', value: stats.activeActivities || 0, color: '#FCA311' },
                { label: 'Estudiantes inscritos', value: stats.students, color: '#14213D' },
                { label: 'Anuncios publicados', value: stats.announcements, color: '#14213D' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', paddingBottom: '0.75rem', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                  <strong style={{ color }}>{value}</strong>
                </div>
              ))}
            </div>
          </div>
          {/* Acceso rápido a secciones */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#14213D', fontSize: '1rem', fontWeight: 700 }}>Acceso rápido</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {[
                { label: 'Mis Clases', tab: 'clases', icon: <Video size={14} /> },
                { label: 'Reforzamiento IA', tab: 'reforzamiento', icon: <Brain size={14} /> },
                { label: 'Dudas de estudiantes', tab: 'dudas', icon: <MessageSquare size={14} /> },
                { label: 'Anuncios', tab: 'anuncios', icon: <Megaphone size={14} /> },
                { label: 'Estudiantes', tab: 'estudiantes', icon: <Users size={14} /> },
              ].map(({ label, tab, icon }) => (
                <button key={tab} onClick={() => onChangeTab(tab)} style={{
                  display: 'flex', alignItems: 'center', gap: '0.6rem',
                  padding: '0.65rem 0.9rem', background: '#f8fafc',
                  border: '1px solid #E5E5E5', borderRadius: '7px',
                  color: '#14213D', fontSize: '0.83rem', fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.2s ease', textAlign: 'left',
                }}
                  onMouseOver={e => { e.currentTarget.style.background = '#14213D'; e.currentTarget.style.color = '#FFFFFF'; e.currentTarget.style.borderColor = '#14213D'; }}
                  onMouseOut={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#14213D'; e.currentTarget.style.borderColor = '#E5E5E5'; }}
                >
                  {icon} {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   TAB 3: Dudas de estudiantes (Gestión Docente)
───────────────────────────────────────── */
function DudasTab() {
  const { programId, currentProgram } = useTeacherContext();
  const [searchParams] = useSearchParams();
  const [doubts, setDoubts] = useState([]);
  const [classes, setClasses] = useState([]);
  const [hierarchyMap, setHierarchyMap] = useState({});
  const [loading, setLoading] = useState(true);

  // Filtros
  const [statusFilter, setStatusFilter] = useState('todos');
  const [classFilter, setClassFilter] = useState('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateOrder, setDateOrder] = useState('desc');

  // Modal de Detalle
  const [selectedDoubt, setSelectedDoubt] = useState(null);

  const fetchDoubtsAndClasses = async () => {
    if (!programId) return;
    try {
      setLoading(true);
      let doubtsData = [];

      // 1. Fetch dudas
      const { data: qData, error: qErr } = await supabase
        .from('class_doubts')
        .select(`
          *,
          class_sessions (
            id,
            title,
            session_id
          ),
          users_profile:student_id (
            id,
            full_name,
            email
          )
        `)
        .eq('program_id', programId)
        .order('created_at', { ascending: false });

      if (qErr) {
        console.warn('Error en join de dudas:', qErr);
        const { data: rawData } = await supabase
          .from('class_doubts')
          .select('*')
          .eq('program_id', programId)
          .order('created_at', { ascending: false });
        doubtsData = rawData ? [...rawData] : [];
      } else {
        doubtsData = qData ? [...qData] : [];
      }

      // 2. Fetch clases de forma segura para no romper la app
      let classIds = [];
      try {
        const { data: clsData } = await supabase
          .from('class_sessions')
          .select('id, title, session_id, program_id')
          .eq('program_id', programId);
          
        const loadedClasses = clsData || [];
        setClasses(loadedClasses);
        classIds = loadedClasses.map(c => c.id);

        let moduleMap = {};
        let sessionMap = {};

        const { data: modulesRes } = await supabase.from('modules').select('id, title').eq('program_id', programId);
        if (modulesRes) {
          moduleMap = modulesRes.reduce((acc, m) => ({ ...acc, [m.id]: m.title }), {});
        }

        const { data: sessionsRes, error: sErr } = await supabase.from('sessions').select('id, title, module_id');
        let sData = sessionsRes || [];
        if (sErr) {
          const { data: subRes } = await supabase.from('subtopics').select('id, title, module_id');
          sData = subRes || [];
        }
        
        sessionMap = sData.reduce((acc, s) => ({
          ...acc,
          [s.id]: {
            title: s.title,
            moduleTitle: moduleMap[s.module_id] || 'Módulo General'
          }
        }), {});

        const classHierarchy = {};
        loadedClasses.forEach(c => {
          const sess = sessionMap[c.session_id];
          classHierarchy[c.id] = {
            className: c.title || 'Clase',
            sessionName: sess?.title || 'Sesión General',
            moduleName: sess?.moduleTitle || 'Módulo General'
          };
        });
        setHierarchyMap(classHierarchy);
        
      } catch (errHier) {
        console.warn('Error construyendo jerarquía de clases:', errHier);
      }

      // 3. Fallback de dudas por class_id si es necesario
      if (classIds.length > 0) {
        try {
          const { data: byClassData } = await supabase
            .from('class_doubts')
            .select(`
              *,
              class_sessions (id, title, session_id),
              users_profile:student_id (id, full_name, email)
            `)
            .in('class_id', classIds)
            .order('created_at', { ascending: false });

          if (byClassData && byClassData.length > 0) {
            const existingIds = new Set(doubtsData.map(d => d.id));
            byClassData.forEach(d => {
              if (!existingIds.has(d.id)) {
                doubtsData.push(d);
                existingIds.add(d.id);
              }
            });
          }
        } catch (errClassDoubts) {
          console.warn('Consulta complementaria por class_id falló:', errClassDoubts);
        }
      }

      // 4. Enriquecer perfiles
      const missingStudentIds = doubtsData
        .filter(d => (!d.users_profile || !d.users_profile.full_name) && d.student_id)
        .map(d => d.student_id);

      if (missingStudentIds.length > 0) {
        try {
          const { data: profiles } = await supabase
            .from('users_profile')
            .select('id, full_name, email')
            .in('id', missingStudentIds);

          if (profiles && profiles.length > 0) {
            const profMap = profiles.reduce((acc, p) => ({ ...acc, [p.id]: p }), {});
            doubtsData = doubtsData.map(d => {
              if ((!d.users_profile || !d.users_profile.full_name) && profMap[d.student_id]) {
                return { ...d, users_profile: profMap[d.student_id] };
              }
              return d;
            });
          }
        } catch (errProfiles) {
          console.warn('Error al enriquecer perfiles:', errProfiles);
        }
      }

      setDoubts(doubtsData);
    } catch (err) {
      console.error('Error general al cargar dudas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoubtsAndClasses();
  }, [programId]);

  // Deep linking: Si viene un doubtId en la URL, abrir automáticamente el modal correspondiente
  useEffect(() => {
    const doubtIdFromUrl = searchParams.get('doubtId');
    if (doubtIdFromUrl && doubts.length > 0) {
      const target = doubts.find(d => d.id === doubtIdFromUrl);
      if (target) {
        setSelectedDoubt(target);
      }
    }
  }, [searchParams, doubts]);

  // Helper de jerarquía
  const getHierarchy = (d) => {
    const clsId = d?.class_id || d?.class_sessions?.id;
    if (clsId && hierarchyMap[clsId]) {
      return hierarchyMap[clsId];
    }
    const moduleName = d?.class_sessions?.sessions?.modules?.title || 'Módulo General';
    const sessionName = d?.class_sessions?.sessions?.title || 'Sesión';
    const className = d?.class_sessions?.title || 'Clase';
    return { moduleName, sessionName, className };
  };

  // Actualización de estado en caliente (optimista y persistida)
  const handleStatusUpdate = async (doubtId, newStatus) => {
    setDoubts(prev => prev.map(d => d.id === doubtId ? { ...d, status: newStatus } : d));
    if (selectedDoubt && selectedDoubt.id === doubtId) {
      setSelectedDoubt(prev => prev ? { ...prev, status: newStatus } : null);
    }
    await updateDoubtStatus(doubtId, newStatus);
  };

  // Filtrado dinámico
  const filteredDoubts = doubts.filter(d => {
    const matchesStatus = statusFilter === 'todos'
      ? d.status !== 'archivada'           // "Todas" excluye archivadas
      : d.status === statusFilter;          // filtros específicos funcionan normal
    const matchesClass = classFilter === 'todos' || d.class_id === classFilter;
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm.trim() ||
      d.subject?.toLowerCase().includes(searchLower) ||
      d.description?.toLowerCase().includes(searchLower) ||
      d.users_profile?.full_name?.toLowerCase().includes(searchLower) ||
      d.users_profile?.email?.toLowerCase().includes(searchLower);

    return matchesStatus && matchesClass && matchesSearch;
  }).sort((a, b) => {
    const dateA = new Date(a.created_at).getTime();
    const dateB = new Date(b.created_at).getTime();
    return dateOrder === 'desc' ? dateB - dateA : dateA - dateB;
  });

  const countByStatus = (st) => doubts.filter(d => d.status === st).length;

  const activeDoubt = selectedDoubt && doubts.some(d => d.id === selectedDoubt.id)
    ? (doubts.find(d => d.id === selectedDoubt.id) || selectedDoubt)
    : (filteredDoubts.length > 0 ? filteredDoubts[0] : null);

  if (loading) {
    return <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando consultas de estudiantes...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* ENCABEZADO DE SECCIÓN */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--navy)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <MessageSquare size={24} color="var(--gold-dark)" /> Bandeja de Consultas
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', margin: '4px 0 0 0' }}>
            Revisa y gestiona las dudas enviadas por los estudiantes del programa <strong>{currentProgram?.title}</strong> para atenderlas durante las sesiones de clase.
          </p>
        </div>
        <button 
          onClick={fetchDoubtsAndClasses} 
          className="btn btn-outline" 
          style={{ fontSize: '0.82rem', padding: '0.45rem 0.95rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', borderRadius: '8px' }}
        >
          <RefreshCw size={14} /> Actualizar
        </button>
      </div>

      {/* 3 STATS KPI CARDS ESTILO STITCH */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        
        {/* CARD 1: PENDIENTES */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'todos' ? 'enviada' : 'todos')}
          style={{
            background: 'var(--white)',
            border: (statusFilter === 'todos' || statusFilter === 'enviada' || statusFilter === 'revisada') ? '1.5px solid rgba(224, 145, 69, 0.4)' : '1px solid var(--border-color)',
            borderRadius: '16px',
            padding: '1.25rem',
            boxShadow: '0 1px 3px rgba(20, 33, 61, 0.04)',
            cursor: 'pointer',
            position: 'relative',
            overflow: 'hidden',
            transition: 'all 0.2s ease'
          }}
        >
          <div style={{ position: 'absolute', top: 0, right: 0, width: '80px', height: '80px', background: 'rgba(239, 68, 68, 0.08)', borderBottomLeftRadius: '100%', pointerEvents: 'none' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#fee2e2', color: '#b91c1c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertCircle size={20} />
            </div>
            <span style={{ display: 'inline-flex', width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444', position: 'relative' }}>
              <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#ef4444', animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite', opacity: 0.75 }} />
            </span>
          </div>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Pendientes</div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--navy)', lineHeight: 1 }}>
            {countByStatus('enviada') + countByStatus('revisada')}
          </div>
        </div>

        {/* CARD 2: NUEVAS (HOY) */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'enviada' ? 'todos' : 'enviada')}
          style={{
            background: 'var(--white)',
            border: statusFilter === 'enviada' ? '1.5px solid #fca311' : '1px solid var(--border-color)',
            borderRadius: '16px',
            padding: '1.25rem',
            boxShadow: '0 1px 3px rgba(20, 33, 61, 0.04)',
            cursor: 'pointer',
            position: 'relative',
            overflow: 'hidden',
            transition: 'all 0.2s ease'
          }}
        >
          <div style={{ position: 'absolute', top: 0, right: 0, width: '80px', height: '80px', background: 'rgba(252, 163, 17, 0.12)', borderBottomLeftRadius: '100%', pointerEvents: 'none' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#fef3c7', color: '#92400e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={20} />
            </div>
          </div>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Nuevas (Sin revisar)</div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--navy)', lineHeight: 1 }}>
            {countByStatus('enviada')}
          </div>
        </div>

        {/* CARD 3: REVISADAS */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'revisada' ? 'todos' : 'revisada')}
          style={{
            background: 'var(--white)',
            border: statusFilter === 'revisada' ? '1.5px solid #16a34a' : '1px solid var(--border-color)',
            borderRadius: '16px',
            padding: '1.25rem',
            boxShadow: '0 1px 3px rgba(20, 33, 61, 0.04)',
            cursor: 'pointer',
            position: 'relative',
            overflow: 'hidden',
            transition: 'all 0.2s ease'
          }}
        >
          <div style={{ position: 'absolute', top: 0, right: 0, width: '80px', height: '80px', background: 'rgba(22, 163, 74, 0.1)', borderBottomLeftRadius: '100%', pointerEvents: 'none' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#dcfce7', color: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={20} />
            </div>
          </div>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Revisadas</div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--navy)', lineHeight: 1 }}>
            {countByStatus('revisada')}
          </div>
        </div>

      </div>

      {/* SPLIT LAYOUT: LISTA DE CONSULTAS (IZQUIERDA) Y DETALLE COMPLETO (DERECHA) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 380px) 1fr', gap: '1.25rem', alignItems: 'stretch' }}>
        
        {/* PANEL IZQUIERDO: BUSCADOR, FILTROS Y LISTA DE CONSULTAS */}
        <div style={{ background: 'var(--white)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem', height: '700px', overflow: 'hidden' }}>
          
          {/* BUSCADOR */}
          <div style={{ position: 'relative' }}>
            <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Buscar consultas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem 0.5rem 2.2rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                fontSize: '0.84rem',
                background: 'var(--bg-canvas, #f8fafc)',
                outline: 'none'
              }}
            />
          </div>

          {/* FILTRO POR PESTAÑAS (PILLS) */}
          <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', paddingBottom: '2px' }}>
            {[
              { id: 'todos', label: 'Todas', count: doubts.length },
              { id: 'enviada', label: 'Nuevas', count: countByStatus('enviada') },
              { id: 'revisada', label: 'Revisadas', count: countByStatus('revisada') },
              { id: 'atendida', label: 'Atendidas', count: countByStatus('atendida') },
              { id: 'archivada', label: 'Archivadas', count: countByStatus('archivada') },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                style={{
                  padding: '0.25rem 0.65rem',
                  borderRadius: '9999px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  background: statusFilter === tab.id ? 'var(--navy)' : 'rgba(20, 33, 61, 0.05)',
                  color: statusFilter === tab.id ? 'var(--white)' : 'var(--navy)',
                  transition: 'all 0.15s ease'
                }}
              >
                {tab.label} {tab.count > 0 ? `(${tab.count})` : ''}
              </button>
            ))}
          </div>

          {/* SELECTOR DE CLASE Y ORDEN */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              style={{ flex: 1, padding: '0.35rem 0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.75rem', background: '#fff' }}
            >
              <option value="todos">Todas las clases</option>
              {classes.map(c => {
                const info = hierarchyMap[c.id];
                const displayLabel = info ? `${info.sessionName} › ${c.title}` : c.title;
                return <option key={c.id} value={c.id}>{displayLabel}</option>;
              })}
            </select>

            <select
              value={dateOrder}
              onChange={(e) => setDateOrder(e.target.value)}
              style={{ flex: '0 0 auto', padding: '0.35rem 0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.75rem', background: '#fff' }}
            >
              <option value="desc">Recientes</option>
              <option value="asc">Antiguas</option>
            </select>
          </div>

          {/* LISTA CON SCROLL DE CONSULTAS */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.65rem', paddingRight: '4px' }}>
            {filteredDoubts.length === 0 ? (
              <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <MessageSquare size={32} style={{ opacity: 0.4, margin: '0 auto 0.5rem auto' }} />
                <p style={{ fontSize: '0.82rem', margin: 0 }}>No hay consultas con los filtros actuales.</p>
              </div>
            ) : (
              filteredDoubts.map(doubt => {
                const isSelected = activeDoubt?.id === doubt.id;
                const { moduleName, className } = getHierarchy(doubt);
                const isNew = doubt.status === 'enviada';
                const isRevised = doubt.status === 'revisada';

                return (
                  <div
                    key={doubt.id}
                    onClick={() => setSelectedDoubt(doubt)}
                    style={{
                      padding: '0.85rem 1rem',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(252, 163, 17, 0.08)' : 'var(--white)',
                      border: isSelected ? '1px solid rgba(252, 163, 17, 0.4)' : '1px solid var(--border-color)',
                      borderLeft: isSelected ? '4px solid #fca311' : '1px solid var(--border-color)',
                      boxShadow: isSelected ? '0 2px 6px rgba(252, 163, 17, 0.1)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        {isNew && (
                          <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '1px 6px', borderRadius: '4px', background: '#fee2e2', color: '#b91c1c', textTransform: 'uppercase' }}>
                            Nueva
                          </span>
                        )}
                        {isRevised && (
                          <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '1px 6px', borderRadius: '4px', background: '#fef3c7', color: '#92400e', textTransform: 'uppercase' }}>
                            Revisada
                          </span>
                        )}
                        {!isNew && !isRevised && (
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: '#f1f5f9', color: '#475569', textTransform: 'uppercase' }}>
                            {doubt.status}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {new Date(doubt.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>

                    <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--navy)', margin: '0 0 0.25rem 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {doubt.users_profile?.full_name || 'Estudiante'}
                    </h4>

                    <p style={{
                      fontSize: '0.78rem', color: '#475569', margin: '0 0 0.5rem 0', lineHeight: 1.35,
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
                    }}>
                      {doubt.subject ? `${doubt.subject}: ` : ''}{doubt.description}
                    </p>

                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.68rem', fontWeight: 600, color: 'var(--gold-dark)', background: 'rgba(20, 33, 61, 0.04)', padding: '2px 6px', borderRadius: '4px' }}>
                      <span>⚡ {className || moduleName}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

        </div>

        {/* PANEL DERECHO: DETALLE COMPLETO Y GESTIÓN ACTIVA (CANVAS STITCH) */}
        <div style={{ background: 'var(--white)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '700px', overflowY: 'auto' }}>
          {activeDoubt ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* HEADER DEL DETALLE */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--navy)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', fontWeight: 800, boxShadow: '0 2px 4px rgba(20,33,61,0.15)' }}>
                    {activeDoubt.users_profile?.full_name?.charAt(0) || 'E'}
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--navy)', margin: 0 }}>
                      {activeDoubt.users_profile?.full_name || 'Estudiante'}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.2rem', fontSize: '0.78rem' }}>
                      <span style={{ background: '#dcfce7', color: '#166534', padding: '1px 8px', borderRadius: '9999px', fontWeight: 700, fontSize: '0.7rem' }}>
                        Estudiante
                      </span>
                      <span style={{ color: 'var(--text-muted)' }}>•</span>
                      <span style={{ color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Clock size={12} /> {new Date(activeDoubt.created_at).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <StatusChip status={activeDoubt.status} />
                </div>
              </div>

              {/* JERARQUÍA ACADÉMICA / CLASE */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: '#f8fafc', border: '1px solid var(--border-color)', padding: '0.35rem 0.75rem', borderRadius: '8px', fontSize: '0.78rem', color: 'var(--navy)', fontWeight: 600 }}>
                  <BookOpen size={14} color="var(--gold-dark)" /> {currentProgram?.title || 'Programa'}
                </div>
                {(() => {
                  const h = getHierarchy(activeDoubt);
                  return (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: '#f8fafc', border: '1px solid var(--border-color)', padding: '0.35rem 0.75rem', borderRadius: '8px', fontSize: '0.78rem', color: '#475569' }}>
                      <span>🎓 {h.moduleName} › {h.sessionName} › <strong style={{ color: 'var(--navy)' }}>{h.className}</strong></span>
                    </div>
                  );
                })()}
              </div>

              {/* ASUNTO Y CONTENIDO DE LA CONSULTA */}
              <div>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 0.4rem 0' }}>
                  Consulta del Estudiante
                </h4>
                <div style={{ background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.25rem', fontSize: '0.92rem', color: 'var(--navy)', lineHeight: 1.6, whiteSpace: 'pre-wrap', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)' }}>
                  {activeDoubt.subject && (
                    <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--navy)', marginBottom: '0.6rem' }}>
                      {activeDoubt.subject}
                    </div>
                  )}
                  {activeDoubt.description}
                </div>
              </div>

              {/* ORIENTACIÓN DOCENTE */}
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '0.75rem 1rem', fontSize: '0.8rem', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Info size={16} color="#2563eb" style={{ flexShrink: 0 }} />
                <span>Esta duda será atendida por el docente durante la sesión de clase o espacio académico correspondiente.</span>
              </div>

              {/* ACCIONES DE ESTADO (FOOTER) */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexWrap: 'wrap', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', marginTop: 'auto' }}>
                {activeDoubt.status === 'enviada' && (
                  <>
                    <button
                      onClick={() => handleStatusUpdate(activeDoubt.id, 'revisada')}
                      className="btn btn-outline"
                      style={{ fontSize: '0.82rem', padding: '0.55rem 1.1rem', color: '#92400e', borderColor: '#fde68a', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', borderRadius: '8px' }}
                    >
                      <Eye size={15} /> Marcar como Revisada
                    </button>
                    <button
                      onClick={() => handleStatusUpdate(activeDoubt.id, 'atendida')}
                      className="btn"
                      style={{ fontSize: '0.82rem', padding: '0.55rem 1.1rem', background: '#fca311', color: '#14213d', fontWeight: 800, border: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', borderRadius: '8px' }}
                    >
                      <CheckCircle2 size={15} /> Preparar Respuesta para Clase en Vivo
                    </button>
                  </>
                )}

                {activeDoubt.status === 'revisada' && (
                  <button
                    onClick={() => handleStatusUpdate(activeDoubt.id, 'atendida')}
                    className="btn"
                    style={{ fontSize: '0.82rem', padding: '0.55rem 1.1rem', background: '#166534', color: '#ffffff', border: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', borderRadius: '8px' }}
                  >
                    <CheckCircle2 size={15} /> Atendida en clase
                  </button>
                )}

                {activeDoubt.status === 'atendida' && (
                  <button
                    onClick={() => handleStatusUpdate(activeDoubt.id, 'archivada')}
                    className="btn btn-outline"
                    style={{ fontSize: '0.82rem', padding: '0.55rem 1.1rem', color: '#475569', borderColor: '#cbd5e1', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', borderRadius: '8px' }}
                  >
                    <Layers size={15} /> Archivar consulta
                  </button>
                )}

                {activeDoubt.status === 'archivada' && (
                  <button
                    onClick={() => handleStatusUpdate(activeDoubt.id, 'enviada')}
                    className="btn btn-outline"
                    style={{ fontSize: '0.82rem', padding: '0.55rem 1.1rem', color: '#1e40af', borderColor: '#bfdbfe', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', borderRadius: '8px' }}
                  >
                    <RefreshCw size={15} /> Reactivar consulta
                  </button>
                )}
              </div>

            </div>
          ) : (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'var(--text-muted)' }}>
              <MessageSquare size={48} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
              <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--navy)', margin: '0 0 0.35rem 0' }}>
                Ninguna consulta seleccionada
              </h4>
              <p style={{ fontSize: '0.85rem', maxWidth: '340px', margin: 0 }}>
                Selecciona una consulta de la lista lateral para ver su detalle completo y gestionarla.
              </p>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}

/* ─────────────────────────────────────────
   MODAL: Contactar Estudiante (Despachador Inteligente de Correo)
───────────────────────────────────────── */
function ContactStudentModal({ student, currentProgram, onClose }) {
  if (!student) return null;

  const email = student.profile?.email || '';
  const studentName = student.profile?.full_name || 'Estudiante';
  const programTitle = currentProgram?.title || 'Curso';

  const [subject, setSubject] = useState(
    `[LIATER] Seguimiento Académico - ${programTitle}`
  );
  const [bodyText, setBodyText] = useState(
    `Estimado(a) ${studentName},\n\nTe contacto desde el Laboratorio LIATER con respecto a tu participación en el curso "${programTitle}".\n\nPor favor revisa tu avance en la plataforma y las actividades pendientes de Reforzamiento IA.\n\nQuedo atento a tus dudas o inquietudes.\n\nSaludos cordiales,\nProfesor.`
  );
  const [copied, setCopied] = useState(false);

  // Opción 1: Abrir en Gmail Web
  const handleOpenGmail = () => {
    if (!email) return;
    const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Opción 2: Abrir en Correo Institucional UNAL / Outlook Web (Microsoft 365)
  const handleOpenOutlook = () => {
    if (!email) return;
    const url = `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(email)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Opción 3: Abrir en cliente de correo local predeterminado
  const handleOpenMailto = () => {
    if (!email) return;
    const url = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;
    window.open(url, '_self');
  };

  // Opción 4: Copiar correo al portapapeles
  const handleCopy = () => {
    if (!email) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(email).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      });
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = email;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0,
      backgroundColor: 'rgba(14,21,50,0.65)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 99999, padding: '1rem',
      animation: 'fadeIn 0.2s ease'
    }}>
      <div style={{
        width: '100%', maxWidth: '620px',
        background: '#FFFFFF',
        borderRadius: '20px',
        boxShadow: '0 25px 60px rgba(14,21,50,0.22)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideUp 0.25s cubic-bezier(0.34,1.56,0.64,1)'
      }}>
        {/* HEADER */}
        <div style={{
          background: 'linear-gradient(135deg, var(--navy, #14213D) 0%, #1e3a5f 100%)',
          padding: '1.25rem 1.75rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{
              width: '42px', height: '42px', borderRadius: '50%',
              background: 'var(--gold, #FCA311)',
              color: 'var(--navy, #14213D)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: '1.1rem'
            }}>
              <Mail size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{
                  background: 'rgba(252,163,17,0.2)',
                  color: 'var(--gold, #FCA311)',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '12px'
                }}>
                  Mensaje al Alumno
                </span>
              </div>
              <h3 style={{ color: '#FFFFFF', margin: '3px 0 0 0', fontSize: '1.1rem', fontWeight: 700 }}>
                {studentName}
              </h3>
              <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.8rem' }}>
                {email || 'Sin correo registrado'}
              </div>
            </div>
          </div>

          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer',
            borderRadius: '8px', padding: '0.45rem', color: 'rgba(255,255,255,0.8)',
            display: 'flex', transition: 'background 0.2s'
          }}
            onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
            onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
          >
            <X size={20} />
          </button>
        </div>

        {/* MODAL BODY */}
        <div style={{ padding: '1.4rem 1.75rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          
          {/* ASUNTO */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--navy, #14213D)', textTransform: 'uppercase', marginBottom: '4px' }}>
              Asunto del Correo
            </label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              style={{
                width: '100%', padding: '0.55rem 0.85rem',
                borderRadius: '8px', border: '1.5px solid #E2E8F0',
                fontSize: '0.85rem', color: 'var(--navy, #14213D)',
                background: '#FAFBFD', outline: 'none', boxSizing: 'border-box'
              }}
              onFocus={e => { e.target.style.borderColor = 'var(--gold, #FCA311)'; }}
              onBlur={e => { e.target.style.borderColor = '#E2E8F0'; }}
            />
          </div>

          {/* CUERPO DEL MENSAJE */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--navy, #14213D)', textTransform: 'uppercase', marginBottom: '4px' }}>
              Mensaje Preliminar
            </label>
            <textarea
              rows={4}
              value={bodyText}
              onChange={e => setBodyText(e.target.value)}
              style={{
                width: '100%', padding: '0.65rem 0.85rem',
                borderRadius: '8px', border: '1.5px solid #E2E8F0',
                fontSize: '0.85rem', color: 'var(--navy, #14213D)',
                background: '#FAFBFD', outline: 'none', resize: 'vertical',
                boxSizing: 'border-box', lineHeight: 1.5
              }}
              onFocus={e => { e.target.style.borderColor = 'var(--gold, #FCA311)'; }}
              onBlur={e => { e.target.style.borderColor = '#E2E8F0'; }}
            />
          </div>

          {/* OPCIONES DE ENVÍO DIRECTO */}
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--navy, #14213D)', textTransform: 'uppercase', marginBottom: '8px' }}>
              Selecciona tu plataforma de correo:
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.65rem' }}>
              
              {/* GMAIL WEB */}
              <button
                type="button"
                onClick={handleOpenGmail}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  padding: '0.7rem 0.9rem', borderRadius: '10px',
                  border: '1.5px solid #EA4335', background: '#FEF2F2', color: '#B91C1C',
                  fontSize: '0.83rem', fontWeight: 700, cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseOver={e => { e.currentTarget.style.background = '#EA4335'; e.currentTarget.style.color = '#FFFFFF'; }}
                onMouseOut={e => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.color = '#B91C1C'; }}
              >
                <span>🔴</span> Abrir en Gmail Web
              </button>

              {/* OUTLOOK / CORREO UNAL */}
              <button
                type="button"
                onClick={handleOpenOutlook}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  padding: '0.7rem 0.9rem', borderRadius: '10px',
                  border: '1.5px solid #0078D4', background: '#EFF6FF', color: '#1D4ED8',
                  fontSize: '0.83rem', fontWeight: 700, cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseOver={e => { e.currentTarget.style.background = '#0078D4'; e.currentTarget.style.color = '#FFFFFF'; }}
                onMouseOut={e => { e.currentTarget.style.background = '#EFF6FF'; e.currentTarget.style.color = '#1D4ED8'; }}
              >
                <span>🏛️</span> Correo UNAL / Outlook
              </button>

              {/* APP DEL SISTEMA (MAILTO) */}
              <button
                type="button"
                onClick={handleOpenMailto}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  padding: '0.7rem 0.9rem', borderRadius: '10px',
                  border: '1.5px solid #CBD5E1', background: '#FFFFFF', color: 'var(--navy, #14213D)',
                  fontSize: '0.83rem', fontWeight: 600, cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseOver={e => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.borderColor = '#94A3B8'; }}
                onMouseOut={e => { e.currentTarget.style.background = '#FFFFFF'; e.currentTarget.style.borderColor = '#CBD5E1'; }}
              >
                <span>💻</span> App de Correo Local
              </button>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div style={{
          padding: '1rem 1.75rem',
          borderTop: '1px solid #E2E8F0',
          background: '#F8FAFC',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap'
        }}>
          <button
            type="button"
            onClick={handleCopy}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              background: copied ? '#DCFCE7' : '#FFFFFF',
              color: copied ? '#007A2E' : 'var(--navy, #14213D)',
              border: `1px solid ${copied ? '#007A2E' : '#CBD5E1'}`,
              borderRadius: '8px', padding: '0.5rem 0.95rem',
              fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <Copy size={14} />
            <span>{copied ? '✓ ¡Correo Copiado!' : 'Copiar Dirección'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.5rem 1.25rem',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              color: 'var(--navy, #14213D)',
              fontSize: '0.84rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ─────────────────────────────────────────
   TAB: Estudiantes
───────────────────────────────────────── */
function StudentDetailModal({ student, totalActivities, currentProgram, onOpenContact, onClose }) {
  if (!student) return null;

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0,
      backgroundColor: 'rgba(14,21,50,0.65)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 99999, padding: '1rem',
      animation: 'fadeIn 0.2s ease'
    }}>
      <div style={{
        width: '100%', maxWidth: '780px',
        maxHeight: '90vh',
        background: '#FFFFFF',
        borderRadius: '20px',
        boxShadow: '0 25px 60px rgba(14,21,50,0.2)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideUp 0.25s cubic-bezier(0.34,1.56,0.64,1)'
      }}>
        {/* HEADER */}
        <div style={{
          background: 'linear-gradient(135deg, var(--navy, #14213D) 0%, #1e3a5f 100%)',
          padding: '1.5rem 2rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
            <div style={{
              width: '44px', height: '44px', borderRadius: '50%',
              background: 'var(--gold, #FCA311)',
              color: 'var(--navy, #14213D)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: '1.1rem'
            }}>
              {student.profile?.full_name ? student.profile.full_name.charAt(0).toUpperCase() : 'E'}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{
                  background: 'rgba(252,163,17,0.2)',
                  color: 'var(--gold, #FCA311)',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '12px'
                }}>
                  Ficha Académica
                </span>
                <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem' }}>
                  Matriculado: {student.enrolled_at ? new Date(student.enrolled_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Reciente'}
                </span>
              </div>
              <h3 style={{ color: '#FFFFFF', margin: '4px 0 0 0', fontSize: '1.15rem', fontWeight: 700 }}>
                {student.profile?.full_name || 'Estudiante'}
              </h3>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem' }}>
                {student.profile?.email || 'Sin correo registrado'}
              </div>
            </div>
          </div>

          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer',
            borderRadius: '8px', padding: '0.45rem', color: 'rgba(255,255,255,0.8)',
            display: 'flex', transition: 'background 0.2s'
          }}
            onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
            onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
          >
            <X size={20} />
          </button>
        </div>

        {/* MODAL BODY CON SCROLL */}
        <div style={{ padding: '1.5rem 2rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Micro KPIs */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem'
          }}>
            <div style={{
              background: '#F8FAFC',
              borderRadius: '12px',
              border: '1px solid #E2E8F0',
              padding: '1rem'
            }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted, #64748B)', textTransform: 'uppercase' }}>Avance de Actividades</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--navy, #14213D)', margin: '4px 0' }}>
                {student.completionRate}%
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748B' }}>
                {student.attemptedCount} de {totalActivities} actividades realizadas
              </div>
            </div>

            <div style={{
              background: '#F8FAFC',
              borderRadius: '12px',
              border: '1px solid #E2E8F0',
              padding: '1rem'
            }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted, #64748B)', textTransform: 'uppercase' }}>Score Promedio</div>
              <div style={{
                fontSize: '1.4rem',
                fontWeight: 800,
                color: student.avgScore >= 80 ? '#007A2E' : student.avgScore >= 60 ? 'var(--navy, #14213D)' : '#DC2626',
                margin: '4px 0'
              }}>
                {student.avgScore}%
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748B' }}>
                {student.avgScore >= 80 ? '⭐ Rendimiento Sobresaliente' : student.avgScore >= 60 ? 'Aprobado satisfactoriamente' : '⚠️ Requiere refuerzo pedagógico'}
              </div>
            </div>

            <div style={{
              background: '#F8FAFC',
              borderRadius: '12px',
              border: '1px solid #E2E8F0',
              padding: '1rem'
            }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted, #64748B)', textTransform: 'uppercase' }}>Dudas y Consultas</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--navy, #14213D)', margin: '4px 0' }}>
                {student.doubtsCount}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748B' }}>
                {student.doubtsCount > 0 ? 'Preguntas formuladas en el curso' : 'Sin dudas registradas'}
              </div>
            </div>
          </div>

          {/* TABLA DE ACTIVIDADES DE REFORZAMIENTO */}
          <div>
            <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', fontWeight: 700, color: 'var(--navy, #14213D)' }}>
              Desglose de Actividades de Reforzamiento IA
            </h4>

            {(!student.activitiesBreakdown || student.activitiesBreakdown.length === 0) ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', background: '#F8FAFC', borderRadius: '10px', color: '#64748B', fontSize: '0.85rem' }}>
                No hay actividades de reforzamiento publicadas en este curso.
              </div>
            ) : (
              <div style={{ borderRadius: '10px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                  <thead>
                    <tr style={{ background: '#F1F5F9', borderBottom: '1px solid #E2E8F0' }}>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 700, color: 'var(--navy, #14213D)' }}>Actividad / Clase</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 700, color: 'var(--navy, #14213D)' }}>Estado</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 700, color: 'var(--navy, #14213D)' }}>Mejor Calificación</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 700, color: 'var(--navy, #14213D)' }}>Fecha de Entrega</th>
                    </tr>
                  </thead>
                  <tbody>
                    {student.activitiesBreakdown.map(act => (
                      <tr key={act.activityId} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <div style={{ fontWeight: 600, color: 'var(--navy, #14213D)' }}>{act.activityTitle}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{act.classTitle}</div>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                          {act.isAttempted ? (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: '4px',
                              background: '#DCFCE7', color: '#007A2E',
                              padding: '2px 8px', borderRadius: '12px',
                              fontSize: '0.74rem', fontWeight: 700
                            }}>
                              <CheckCircle2 size={12} /> Completada
                            </span>
                          ) : (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: '4px',
                              background: '#F1F5F9', color: '#64748B',
                              padding: '2px 8px', borderRadius: '12px',
                              fontSize: '0.74rem', fontWeight: 600
                            }}>
                              Sin realizar
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                          {act.isAttempted ? (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{
                                fontWeight: 700,
                                color: act.score >= 80 ? '#007A2E' : act.score >= 60 ? 'var(--navy, #14213D)' : '#DC2626'
                              }}>
                                {act.score}%
                              </span>
                            </div>
                          ) : (
                            <span style={{ color: '#94A3B8' }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center', color: '#64748B', fontSize: '0.78rem' }}>
                          {act.completedAt
                            ? new Date(act.completedAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* DUDAS FORMULADAS */}
          {student.doubtsList && student.doubtsList.length > 0 && (
            <div>
              <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', fontWeight: 700, color: 'var(--navy, #14213D)' }}>
                Dudas Formuladas ({student.doubtsList.length})
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {student.doubtsList.map(d => (
                  <div key={d.id} style={{
                    padding: '0.75rem 1rem',
                    background: '#F8FAFC',
                    borderRadius: '8px',
                    border: '1px solid #E2E8F0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.75rem'
                  }}>
                    <div style={{ fontSize: '0.82rem', color: 'var(--navy, #14213D)', flex: 1 }}>
                      "{d.question}"
                    </div>
                    <span style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '6px',
                      background: d.status === 'answered' ? '#DCFCE7' : '#FEF3C7',
                      color: d.status === 'answered' ? '#007A2E' : '#92400E'
                    }}>
                      {d.status === 'answered' ? 'Respondida' : 'Pendiente'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* FOOTER ACTIONS */}
        <div style={{
          padding: '1rem 2rem',
          borderTop: '1px solid #E2E8F0',
          background: '#F8FAFC',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap'
        }}>
          <button
            type="button"
            onClick={() => onOpenContact && onOpenContact(student)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              background: 'var(--navy, #14213D)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              padding: '0.55rem 1.1rem',
              fontSize: '0.84rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <Mail size={15} /> Contactar por Correo ({student.profile?.email})
          </button>

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.55rem 1.25rem',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              color: 'var(--navy, #14213D)',
              fontSize: '0.84rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ─────────────────────────────────────────
   TAB: Estudiantes (Premium Refactored)
───────────────────────────────────────── */
function EstudiantesTab() {
  const { programId, currentProgram } = useTeacherContext();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'risk' | 'normal' | 'excellent'
  const [selectedStudentForModal, setSelectedStudentForModal] = useState(null);
  const [contactingStudent, setContactingStudent] = useState(null);
  const [totalPublishedActivities, setTotalPublishedActivities] = useState(0);

  useEffect(() => {
    async function fetchStudentAnalytics() {
      if (!programId) return;
      try {
        setLoading(true);

        // 1. Obtener enrollments (estudiantes)
        const { data: enrollData, error: enrollErr } = await supabase
          .from('enrollments')
          .select('student_id, created_at, users_profile:student_id(*)')
          .eq('program_id', programId);
        if (enrollErr) throw enrollErr;

        const programStudents = (enrollData || []).filter(item => 
          item.users_profile && item.users_profile.role === 'student'
        );

        if (programStudents.length === 0) {
          setStudents([]);
          setLoading(false);
          return;
        }

        // 2. Obtener class_sessions del programa con class_date y title
        const { data: classesData } = await supabase
          .from('class_sessions')
          .select('id, title, class_date')
          .eq('program_id', programId)
          .order('class_date', { ascending: true });
        
        const classMap = {};
        (classesData || []).forEach(c => { classMap[c.id] = c; });
        const classIds = Object.keys(classMap);

        // 3. Obtener actividades publicadas de esas clases
        let activitiesList = [];
        if (classIds.length > 0) {
          const { data: actsData } = await supabase
            .from('class_activities')
            .select('id, class_id, title, is_published')
            .in('class_id', classIds)
            .eq('is_published', true);
          activitiesList = actsData || [];
        }
        setTotalPublishedActivities(activitiesList.length);
        const activityIds = activitiesList.map(a => a.id);

        // 4. Obtener intentos de esas actividades
        let attemptsData = [];
        if (activityIds.length > 0) {
          const { data: attsData } = await supabase
            .from('activity_attempts')
            .select('id, activity_id, student_id, score, status, completed_at')
            .in('activity_id', activityIds);
          attemptsData = attsData || [];
        }

        // 5. Obtener dudas enviadas en el programa
        const { data: doubtsData } = await supabase
          .from('class_doubts')
          .select('id, student_id, question, status, created_at')
          .eq('program_id', programId);
        const doubtsList = doubtsData || [];

        // ENSAMBLAJE
        const totalActivities = activitiesList.length;
        const now = new Date();

        const enrichedStudents = programStudents.map(enroll => {
          const stuId = enroll.student_id;
          const authUserId = enroll.users_profile?.auth_user_id;
          
          // Filtrar intentos del estudiante
          const stuAttempts = attemptsData.filter(a => 
            (a.student_id === stuId || (authUserId && a.student_id === authUserId)) && a.status !== 'pending'
          );
          
          // Mapear el MEJOR intento / puntaje más alto obtenido en cada actividad y fecha
          const bestAttemptByAct = {};
          stuAttempts.forEach(att => {
            const actId = att.activity_id;
            const sc = typeof att.score === 'number' ? att.score : 0;
            if (!bestAttemptByAct[actId] || sc > (bestAttemptByAct[actId].score || 0)) {
              bestAttemptByAct[actId] = {
                score: sc,
                completedAt: att.completed_at
              };
            }
          });

          // Actividades intentadas / completadas
          const attemptedCount = Object.keys(bestAttemptByAct).length;
          const completionRate = totalActivities > 0 
            ? Math.round((attemptedCount / totalActivities) * 100) 
            : 0;

          // Cuestionarios evaluables: Hechos o Vencidos
          let evaluatedCount = 0;
          let totalScoreSum = 0;

          const activitiesBreakdown = activitiesList.map(act => {
            const attempt = bestAttemptByAct[act.id];
            const cls = classMap[act.class_id];
            const isAttempted = attempt !== undefined;
            const score = isAttempted ? attempt.score : 0;

            return {
              activityId: act.id,
              activityTitle: act.title || 'Actividad de Reforzamiento',
              classTitle: cls?.title || 'Clase',
              classDate: cls?.class_date,
              isAttempted,
              score,
              completedAt: attempt?.completedAt || null
            };
          });

          activitiesList.forEach(act => {
            const hasAttempt = bestAttemptByAct[act.id] !== undefined;
            const cls = classMap[act.class_id];
            const isOverdue = cls?.class_date ? new Date(cls.class_date) < now : false;

            if (hasAttempt) {
              evaluatedCount++;
              totalScoreSum += bestAttemptByAct[act.id].score;
            } else if (isOverdue) {
              evaluatedCount++;
              totalScoreSum += 0;
            }
          });

          let avgScore = 0;
          if (evaluatedCount > 0) {
            avgScore = Math.round(totalScoreSum / evaluatedCount);
          }

          // Conteo de dudas y lista de dudas del estudiante
          const stuDoubts = doubtsList.filter(d => 
            d.student_id === stuId || (authUserId && d.student_id === authUserId)
          );

          // Determinar estado de riesgo
          let riskStatus = 'normal';
          if (totalActivities > 0 && completionRate < 50) riskStatus = 'risk';
          if (evaluatedCount > 0 && avgScore < 60) riskStatus = 'risk';
          if (completionRate >= 80 && avgScore >= 80) riskStatus = 'excellent';

          return {
            id: stuId,
            profile: enroll.users_profile,
            enrolled_at: enroll.created_at,
            completionRate,
            attemptedCount,
            avgScore,
            doubtsCount: stuDoubts.length,
            doubtsList: stuDoubts,
            activitiesBreakdown,
            riskStatus
          };
        });

        // Ordenar alfabéticamente por defecto
        enrichedStudents.sort((a, b) => {
          const nameA = (a.profile?.full_name || '').toLowerCase();
          const nameB = (b.profile?.full_name || '').toLowerCase();
          return nameA.localeCompare(nameB);
        });

        setStudents(enrichedStudents);

      } catch (err) {
        console.error('Error ensamblando analítica de estudiantes:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchStudentAnalytics();
  }, [programId]);

  if (loading) {
    return (
      <div style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--text-muted, #64748B)', background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
        <div style={{ width: '32px', height: '32px', border: '3px solid #E2E8F0', borderTopColor: 'var(--gold, #FCA311)', borderRadius: '50%', animation: 'liaterSpin 0.8s linear infinite', margin: '0 auto 1rem' }} />
        <span>Cargando analítica de estudiantes...</span>
      </div>
    );
  }

  // Métricas del grupo para KPIs superiores
  const totalCount = students.length;
  const riskCount = students.filter(s => s.riskStatus === 'risk').length;
  const excellentCount = students.filter(s => s.riskStatus === 'excellent').length;
  const normalCount = students.filter(s => s.riskStatus === 'normal').length;
  const avgCompletion = totalCount > 0 ? Math.round(students.reduce((acc, s) => acc + s.completionRate, 0) / totalCount) : 0;

  // Filtrado y Búsqueda
  const filteredStudents = students.filter(s => {
    // Búsqueda
    const term = searchTerm.toLowerCase();
    const nameMatch = (s.profile?.full_name || '').toLowerCase().includes(term);
    const emailMatch = (s.profile?.email || '').toLowerCase().includes(term);
    if (term && !nameMatch && !emailMatch) return false;

    // Filtro estado
    if (filterStatus === 'risk' && s.riskStatus !== 'risk') return false;
    if (filterStatus === 'excellent' && s.riskStatus !== 'excellent') return false;
    if (filterStatus === 'normal' && s.riskStatus !== 'normal') return false;

    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      
      {/* ── HEADER DE SECCIÓN ── */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        padding: '1.5rem 1.75rem',
        border: '1px solid #E2E8F0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
        boxShadow: '0 1px 3px rgba(20, 33, 61, 0.03)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '4px' }}>
            <span style={{
              background: '#F1F5F9',
              color: 'var(--navy, #14213D)',
              fontSize: '0.73rem',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '12px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <Users size={12} /> Gestión de Cohorte
            </span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted, #64748B)' }}>
              {currentProgram?.title || 'Programa Activo'}
            </span>
          </div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--navy, #14213D)', margin: 0, letterSpacing: '-0.01em' }}>
            Estudiantes Inscritos ({totalCount})
          </h2>
          <p style={{ color: 'var(--text-muted, #64748B)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
            Monitorea el progreso, rendimiento académico en reforzamiento IA y estado pedagógico de cada alumno.
          </p>
        </div>
      </div>

      {/* ── TARJETAS KPI DE RESUMEN (Patrón homogéneo a Reforzamiento IA) ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '1rem'
      }}>
        {/* KPI 1: Matriculados */}
        <div className="card" style={{
          background: '#FFFFFF',
          borderRadius: '14px',
          padding: '1.25rem 1.5rem',
          border: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          boxShadow: '0 1px 3px rgba(20, 33, 61, 0.03)'
        }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            background: '#FEF3C7',
            color: '#B45309',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Users size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted, #64748B)' }}>
              Alumnos Matriculados
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--navy, #14213D)', lineHeight: 1.2 }}>
              {totalCount} <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted, #64748B)' }}>activos</span>
            </div>
            <div style={{ fontSize: '0.73rem', color: '#64748B', marginTop: '2px' }}>
              En este programa
            </div>
          </div>
        </div>

        {/* KPI 2: Participación Promedio */}
        <div className="card" style={{
          background: '#FFFFFF',
          borderRadius: '14px',
          padding: '1.25rem 1.5rem',
          border: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          boxShadow: '0 1px 3px rgba(20, 33, 61, 0.03)'
        }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            background: '#DCFCE7',
            color: '#007A2E',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Activity size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted, #64748B)' }}>
              Participación del Grupo
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--navy, #14213D)', lineHeight: 1.2 }}>
              {avgCompletion}% <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted, #64748B)' }}>avance medio</span>
            </div>
            <div style={{ fontSize: '0.73rem', color: '#64748B', marginTop: '2px' }}>
              {totalPublishedActivities} actividades publicadas
            </div>
          </div>
        </div>

        {/* KPI 3: Alumnos en Riesgo */}
        <div className="card" style={{
          background: '#FFFFFF',
          borderRadius: '14px',
          padding: '1.25rem 1.5rem',
          border: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          boxShadow: '0 1px 3px rgba(20, 33, 61, 0.03)'
        }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            background: '#FEE2E2',
            color: '#DC2626',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <AlertTriangle size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted, #64748B)' }}>
              Atención Requerida
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: riskCount > 0 ? '#DC2626' : '#007A2E', lineHeight: 1.2 }}>
              {riskCount} <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted, #64748B)' }}>en riesgo</span>
            </div>
            <div style={{ fontSize: '0.73rem', color: '#64748B', marginTop: '2px' }}>
              Score &lt; 60% o baja entrega
            </div>
          </div>
        </div>
      </div>

      {/* ── BARRA DE HERRAMIENTAS: BÚSQUEDA Y PILLS DE ESTADO ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        {/* Pills de Filtrado */}
        <div style={{
          display: 'inline-flex',
          background: '#F1F5F9',
          padding: '4px',
          borderRadius: '10px',
          gap: '4px',
          flexWrap: 'wrap'
        }}>
          <button
            type="button"
            onClick={() => setFilterStatus('all')}
            style={{
              border: 'none',
              borderRadius: '7px',
              padding: '0.4rem 0.85rem',
              fontSize: '0.82rem',
              fontWeight: filterStatus === 'all' ? 700 : 500,
              background: filterStatus === 'all' ? 'var(--navy, #14213D)' : 'transparent',
              color: filterStatus === 'all' ? '#FFFFFF' : 'var(--text-muted, #64748B)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              transition: 'all 0.15s ease'
            }}
          >
            <span>Todos</span>
            <span style={{
              fontSize: '0.72rem',
              padding: '1px 6px',
              borderRadius: '9999px',
              background: filterStatus === 'all' ? 'rgba(255,255,255,0.2)' : '#E2E8F0',
              color: filterStatus === 'all' ? '#FFFFFF' : '#64748B'
            }}>
              {totalCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterStatus('risk')}
            style={{
              border: 'none',
              borderRadius: '7px',
              padding: '0.4rem 0.85rem',
              fontSize: '0.82rem',
              fontWeight: filterStatus === 'risk' ? 700 : 500,
              background: filterStatus === 'risk' ? '#DC2626' : 'transparent',
              color: filterStatus === 'risk' ? '#FFFFFF' : '#DC2626',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              transition: 'all 0.15s ease'
            }}
          >
            <span>⚠️ En Riesgo</span>
            <span style={{
              fontSize: '0.72rem',
              padding: '1px 6px',
              borderRadius: '9999px',
              background: filterStatus === 'risk' ? 'rgba(255,255,255,0.25)' : '#FEE2E2',
              color: filterStatus === 'risk' ? '#FFFFFF' : '#991B1B'
            }}>
              {riskCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterStatus('normal')}
            style={{
              border: 'none',
              borderRadius: '7px',
              padding: '0.4rem 0.85rem',
              fontSize: '0.82rem',
              fontWeight: filterStatus === 'normal' ? 700 : 500,
              background: filterStatus === 'normal' ? 'var(--navy, #14213D)' : 'transparent',
              color: filterStatus === 'normal' ? '#FFFFFF' : 'var(--text-muted, #64748B)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              transition: 'all 0.15s ease'
            }}
          >
            <span>Al Día</span>
            <span style={{
              fontSize: '0.72rem',
              padding: '1px 6px',
              borderRadius: '9999px',
              background: filterStatus === 'normal' ? 'rgba(255,255,255,0.2)' : '#E2E8F0',
              color: filterStatus === 'normal' ? '#FFFFFF' : '#64748B'
            }}>
              {normalCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterStatus('excellent')}
            style={{
              border: 'none',
              borderRadius: '7px',
              padding: '0.4rem 0.85rem',
              fontSize: '0.82rem',
              fontWeight: filterStatus === 'excellent' ? 700 : 500,
              background: filterStatus === 'excellent' ? '#007A2E' : 'transparent',
              color: filterStatus === 'excellent' ? '#FFFFFF' : '#007A2E',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              transition: 'all 0.15s ease'
            }}
          >
            <span>⭐ Sobresalientes</span>
            <span style={{
              fontSize: '0.72rem',
              padding: '1px 6px',
              borderRadius: '9999px',
              background: filterStatus === 'excellent' ? 'rgba(255,255,255,0.25)' : '#DCFCE7',
              color: filterStatus === 'excellent' ? '#FFFFFF' : '#007A2E'
            }}>
              {excellentCount}
            </span>
          </button>
        </div>

        {/* Buscador */}
        <div style={{
          position: 'relative',
          minWidth: '240px',
          maxWidth: '340px',
          flex: '1 1 auto'
        }}>
          <Search size={16} style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#94A3B8'
          }} />
          <input
            type="text"
            placeholder="Buscar por nombre o correo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem 2rem 0.5rem 2.2rem',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              background: '#FFFFFF',
              fontSize: '0.84rem',
              color: 'var(--navy, #14213D)',
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'all 0.2s ease'
            }}
            onFocus={e => { e.target.style.borderColor = 'var(--gold, #FCA311)'; e.target.style.boxShadow = '0 0 0 3px rgba(252, 163, 17, 0.15)'; }}
            onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none'; }}
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                color: '#94A3B8',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ── TABLA DE CALIFICACIONES Y ESTUDIANTES ── */}
      <div className="card" style={{
        padding: 0,
        overflow: 'hidden',
        background: '#FFFFFF',
        borderRadius: '14px',
        border: '1px solid #E2E8F0',
        boxShadow: '0 1px 3px rgba(20, 33, 61, 0.04)'
      }}>
        {filteredStudents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3.5rem 2rem', color: 'var(--text-muted, #64748B)' }}>
            <Users size={44} style={{ color: '#CBD5E1', margin: '0 auto 1rem' }} />
            <h4 style={{ margin: '0 0 0.4rem 0', color: 'var(--navy, #14213D)', fontSize: '1.1rem', fontWeight: 700 }}>
              {searchTerm ? 'No se encontraron estudiantes' : 'No hay estudiantes en este filtro'}
            </h4>
            <p style={{ margin: 0, fontSize: '0.85rem' }}>
              {searchTerm
                ? `Ningún alumno coincide con el término "${searchTerm}".`
                : 'No existen registros para el estado seleccionado.'}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  <th style={{ padding: '0.9rem 1.25rem', textAlign: 'left', color: 'var(--navy, #14213D)', fontWeight: 700, width: '28%' }}>Estudiante</th>
                  <th style={{ padding: '0.9rem 1.25rem', textAlign: 'center', color: 'var(--navy, #14213D)', fontWeight: 700 }}>Avance de Actividades</th>
                  <th style={{ padding: '0.9rem 1.25rem', textAlign: 'center', color: 'var(--navy, #14213D)', fontWeight: 700 }}>Score Promedio</th>
                  <th style={{ padding: '0.9rem 1.25rem', textAlign: 'center', color: 'var(--navy, #14213D)', fontWeight: 700 }}>Dudas</th>
                  <th style={{ padding: '0.9rem 1.25rem', textAlign: 'center', color: 'var(--navy, #14213D)', fontWeight: 700 }}>Estado Académico</th>
                  <th style={{ padding: '0.9rem 1.25rem', textAlign: 'center', color: 'var(--navy, #14213D)', fontWeight: 700 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map(item => (
                  <tr
                    key={item.id}
                    style={{ borderBottom: '1px solid #F1F5F9', transition: 'background 0.15s ease' }}
                    onMouseOver={e => e.currentTarget.style.background = '#F8FAFC'}
                    onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                  >
                    
                    {/* INFO ESTUDIANTE */}
                    <td style={{ padding: '1rem 1.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '50%',
                          background: 'rgba(20, 33, 61, 0.08)',
                          color: 'var(--navy, #14213D)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '0.9rem',
                          flexShrink: 0
                        }}>
                          {item.profile?.full_name ? item.profile.full_name.charAt(0).toUpperCase() : 'E'}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--navy, #14213D)', marginBottom: '2px', fontSize: '0.92rem' }}>
                            {item.profile?.full_name || 'Estudiante'}
                          </div>
                          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted, #64748B)' }}>
                            {item.profile?.email || 'Sin correo'}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* AVANCE */}
                    <td style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ width: '80px', height: '6px', background: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{
                              width: `${item.completionRate}%`,
                              height: '100%',
                              background: item.completionRate === 100 ? '#007A2E' : 'var(--gold, #FCA311)',
                              borderRadius: '3px'
                            }}></div>
                          </div>
                          <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--navy, #14213D)', minWidth: '35px' }}>
                            {item.completionRate}%
                          </span>
                        </div>
                        <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                          {item.attemptedCount} de {totalPublishedActivities} actividades
                        </span>
                      </div>
                    </td>

                    {/* SCORE PROMEDIO */}
                    <td style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>
                      <span style={{ 
                        fontWeight: 700, 
                        color: item.avgScore >= 80 ? '#007A2E' : item.avgScore >= 60 ? 'var(--navy, #14213D)' : '#991B1B',
                        background: item.avgScore >= 80 ? '#DCFCE7' : item.avgScore >= 60 ? '#F1F5F9' : '#FEE2E2',
                        border: `1px solid ${item.avgScore >= 80 ? 'rgba(0,122,46,0.2)' : item.avgScore >= 60 ? '#E2E8F0' : 'rgba(220,38,38,0.25)'}`,
                        padding: '0.2rem 0.65rem',
                        borderRadius: '999px',
                        fontSize: '0.82rem'
                      }}>
                        {item.avgScore}%
                      </span>
                    </td>

                    {/* DUDAS */}
                    <td style={{ padding: '1rem 1.25rem', textAlign: 'center', color: 'var(--navy, #14213D)', fontWeight: 600 }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: '#F8FAFC', padding: '0.2rem 0.6rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                        <MessageSquare size={13} color="#64748B" />
                        <span style={{ fontSize: '0.82rem' }}>{item.doubtsCount}</span>
                      </div>
                    </td>

                    {/* ESTADO ACADÉMICO */}
                    <td style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>
                      {item.riskStatus === 'risk' && (
                        <span style={{
                          color: '#991B1B',
                          background: '#FEE2E2',
                          border: '1px solid rgba(220,38,38,0.25)',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          padding: '0.25rem 0.6rem',
                          borderRadius: '12px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <AlertTriangle size={13}/> En riesgo
                        </span>
                      )}
                      {item.riskStatus === 'excellent' && (
                        <span style={{
                          color: '#007A2E',
                          background: '#DCFCE7',
                          border: '1px solid rgba(0,122,46,0.25)',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          padding: '0.25rem 0.6rem',
                          borderRadius: '12px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <Star size={13}/> Excelente
                        </span>
                      )}
                      {item.riskStatus === 'normal' && (
                        <span style={{
                          color: '#475569',
                          background: '#F1F5F9',
                          border: '1px solid #E2E8F0',
                          fontSize: '0.74rem',
                          fontWeight: 600,
                          padding: '0.25rem 0.6rem',
                          borderRadius: '12px',
                          display: 'inline-flex',
                          alignItems: 'center'
                        }}>
                          Al día
                        </span>
                      )}
                    </td>

                    {/* ACCIONES */}
                    <td style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                        <button
                          type="button"
                          onClick={() => setSelectedStudentForModal(item)}
                          title="Ver Ficha Académica del Alumno"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            padding: '0.4rem 0.75rem',
                            borderRadius: '6px',
                            border: '1px solid #E2E8F0',
                            background: '#FFFFFF',
                            color: 'var(--navy, #14213D)',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseOver={e => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.borderColor = '#CBD5E1'; }}
                          onMouseOut={e => { e.currentTarget.style.background = '#FFFFFF'; e.currentTarget.style.borderColor = '#E2E8F0'; }}
                        >
                          <Eye size={14} />
                          <span>Ficha</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setContactingStudent(item)}
                          title={`Contactar a ${item.profile?.full_name || 'estudiante'} (${item.profile?.email || ''})`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '0.4rem',
                            borderRadius: '6px',
                            border: '1px solid #E2E8F0',
                            background: '#FFFFFF',
                            color: 'var(--navy, #14213D)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseOver={e => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.borderColor = '#CBD5E1'; }}
                          onMouseOut={e => { e.currentTarget.style.background = '#FFFFFF'; e.currentTarget.style.borderColor = '#E2E8F0'; }}
                        >
                          <Mail size={14} />
                        </button>
                      </div>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Ficha Académica del Alumno */}
      {selectedStudentForModal && (
        <StudentDetailModal
          student={selectedStudentForModal}
          totalActivities={totalPublishedActivities}
          currentProgram={currentProgram}
          onOpenContact={(stu) => {
            setSelectedStudentForModal(null);
            setContactingStudent(stu);
          }}
          onClose={() => setSelectedStudentForModal(null)}
        />
      )}

      {/* Modal Despachador de Correo Inteligente */}
      {contactingStudent && (
        <ContactStudentModal
          student={contactingStudent}
          currentProgram={currentProgram}
          onClose={() => setContactingStudent(null)}
        />
      )}
    </div>
  );
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   COMPONENTE PRINCIPAL
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
/* ─── Borradores IA ─────────────────────────────────────────────────────── */

function BorradoresTab() {
  const { programId } = useTeacherContext();
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [toast, setToast] = useState(null);
  const [maxAttemptsByDraft, setMaxAttemptsByDraft] = useState({});

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchDrafts = async () => {
    setLoading(true);
    try {
      // 1. Obtener clases del programa actual
      const { data: classesData, error: classesErr } = await supabase
        .from('class_sessions')
        .select('id, title, program_id')
        .eq('program_id', programId);

      if (classesErr) {
        console.warn('Error cargando clases del programa:', classesErr);
      }

      const classIds = (classesData || []).map(c => c.id);
      const classMap = {};
      (classesData || []).forEach(c => { classMap[c.id] = c; });

      // 2. Consultar borradores (excluyendo rechazados o eliminados)
      let query = supabase
        .from('activity_drafts')
        .select('id, class_id, status, drive_folder_id, created_at, draft_data, reviewed_at')
        .neq('status', 'rejected')
        .order('created_at', { ascending: false });

      if (classIds.length > 0) {
        query = query.in('class_id', classIds);
      }

      const { data, error } = await query;

      if (error) throw error;

      // 3. Consultar estado en class_activities para sincronizar con lo que haya hecho el admin
      let actMap = {};
      if (classIds.length > 0) {
        const { data: actRows } = await supabase
          .from('class_activities')
          .select('id, class_id, is_published, max_attempts')
          .in('class_id', classIds);

        (actRows || []).forEach(a => {
          actMap[a.class_id] = a;
        });
      }

      // Vincular datos de clase y estado real de publicación para renderizar
      const formattedDrafts = (data || []).map(d => {
        const act = actMap[d.class_id];
        const isPublished = act ? !!act.is_published : (d.status === 'approved' || d.status === 'published');
        return {
          ...d,
          status: isPublished ? 'approved' : (d.status === 'approved' ? 'pending' : d.status),
          is_published_activity: isPublished,
          class_sessions: classMap[d.class_id] || { id: d.class_id, title: 'Clase vinculada' }
        };
      });

      setDrafts(formattedDrafts);
    } catch (err) {
      console.error('Error cargando borradores:', err);
      showToast(`Error: ${err.message || 'No se pudieron cargar los borradores'}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrafts();

    // Suscripción realtime para detectar cambios del admin en class_activities y activity_drafts
    const channel = supabase
      .channel('class_activities_teacher_sync_' + (programId || 'all'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'class_activities' }, () => {
        fetchDrafts();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_drafts' }, () => {
        fetchDrafts();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [programId]);

  // Helper para sincronizar la actividad en las tablas públicas de Supabase
  const syncAndPublishActivity = async (classId, draftData, attempts) => {
    const attemptsValue = (attempts !== undefined && attempts !== null) ? attempts : 1;
    // 1. Upsert / update en class_activities
    // Usar order + limit(1) para evitar problemas con duplicados
    const { data: existingRows } = await supabase
      .from('class_activities')
      .select('id')
      .eq('class_id', classId)
      .order('created_at', { ascending: false })
      .limit(1);
    const existingAct = existingRows && existingRows.length > 0 ? existingRows[0] : null;

    let activityId;

    if (existingAct) {
      const updatePayload = {
        title: draftData.activity_title || 'Actividad de Reforzamiento',
        description: draftData.activity_description || '',
        is_published: true,
        max_attempts: attemptsValue,
        is_mandatory: false,
      };
      if (draftData.due_date) updatePayload.due_date = draftData.due_date;

      let { data: updatedAct, error: updateErr } = await supabase
        .from('class_activities')
        .update(updatePayload)
        .eq('id', existingAct.id)
        .select('id')
        .single();

      if (updateErr && (updateErr.code === '42703' || updateErr.message?.includes('due_date'))) {
        delete updatePayload.due_date;
        const retry = await supabase.from('class_activities').update(updatePayload).eq('id', existingAct.id).select('id').single();
        updatedAct = retry.data;
        updateErr = retry.error;
      }

      if (updateErr) throw updateErr;
      activityId = updatedAct.id;

      // Limpiar preguntas anteriores para re-insertar limpiamente (respetando Foreign Keys)
      const { data: oldQs } = await supabase.from('activity_questions').select('id').eq('activity_id', activityId);
      if (oldQs && oldQs.length > 0) {
        const oldQIds = oldQs.map(q => q.id);
        await supabase.from('question_correct_answers').delete().in('question_id', oldQIds);
        await supabase.from('question_options').delete().in('question_id', oldQIds);
        await supabase.from('activity_questions').delete().in('id', oldQIds);
      }
    } else {
      const insertPayload = {
        class_id: classId,
        title: draftData.activity_title || 'Actividad de Reforzamiento',
        description: draftData.activity_description || '',
        is_published: true,
        max_attempts: attemptsValue,
        is_mandatory: false,
      };
      if (draftData.due_date) insertPayload.due_date = draftData.due_date;

      let { data: newAct, error: actErr } = await supabase
        .from('class_activities')
        .insert(insertPayload)
        .select('id')
        .single();

      if (actErr && (actErr.code === '42703' || actErr.message?.includes('due_date'))) {
        delete insertPayload.due_date;
        const retry = await supabase.from('class_activities').insert(insertPayload).select('id').single();
        newAct = retry.data;
        actErr = retry.error;
      }

      if (actErr) throw actErr;
      activityId = newAct.id;
    }

    // 2. Insertar preguntas y opciones
    const questions = draftData.questions || [];
    for (let qIndex = 0; qIndex < questions.length; qIndex++) {
      const q = questions[qIndex];

      const { data: qData, error: qErr } = await supabase
        .from('activity_questions')
        .insert({
          activity_id: activityId,
          text: q.text,
          question_type: q.question_type || 'single_choice',
          order_num: qIndex + 1,
        })
        .select('id')
        .single();

      if (qErr) throw qErr;
      const questionId = qData.id;

      let correctOptId = null;

      for (let oIndex = 0; oIndex < (q.options || []).length; oIndex++) {
        const opt = q.options[oIndex];

        const { data: optData, error: optErr } = await supabase
          .from('question_options')
          .insert({
            question_id: questionId,
            text: opt.text,
            order_num: oIndex + 1,
          })
          .select('id')
          .single();

        if (optErr) throw optErr;

        if (opt.is_correct) {
          correctOptId = optData.id;
        }
      }

      if (correctOptId) {
        await supabase
          .from('question_correct_answers')
          .upsert({
            question_id: questionId,
            correct_option_id: correctOptId,
          }, { onConflict: 'question_id' });
      }
    }
  };

  const handleApprove = async (draft) => {
    if (!window.confirm(`¿Publicar la actividad "${draft.draft_data?.activity_title}" para los alumnos?`)) return;
    setActionLoading(draft.id + '-approve');
    try {
      const classId = draft.class_id || draft.class_sessions?.id;
      if (!classId) throw new Error('No se encontró el ID de la clase vinculada.');

      const attempts = maxAttemptsByDraft[draft.id] ?? 1;
      await syncAndPublishActivity(classId, draft.draft_data, attempts);

      await supabase
        .from('activity_drafts')
        .update({ status: 'approved', reviewed_at: new Date().toISOString() })
        .eq('id', draft.id);

      showToast('¡Actividad publicada exitosamente!');
      fetchDrafts();
    } catch (err) {
      console.error('Error aprobando borrador:', err);
      showToast(`Error al publicar: ${err.message || 'Intenta de nuevo'}`, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnpublish = async (draft) => {
    if (!window.confirm(`¿Despublicar la actividad "${draft.draft_data?.activity_title}"? Los estudiantes ya no podrán verla ni responderla.`)) return;
    setActionLoading(draft.id + '-unpublish');
    try {
      const classId = draft.class_id || draft.class_sessions?.id;
      if (classId) {
        await supabase
          .from('class_activities')
          .update({ is_published: false })
          .eq('class_id', classId);
      }

      await supabase
        .from('activity_drafts')
        .update({ status: 'pending' })
        .eq('id', draft.id);

      showToast('Actividad despublicada. Ha vuelto a estado pendiente.', 'info');
      fetchDrafts();
    } catch (err) {
      console.error('Error despublicando borrador:', err);
      showToast(`Error al despublicar: ${err.message || 'Intenta de nuevo'}`, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (draft) => {
    if (!window.confirm(`¿Eliminar permanentemente el borrador "${draft.draft_data?.activity_title || 'este borrador'}"? Esta acción no se puede deshacer.`)) return;
    setActionLoading(draft.id + '-delete');
    
    // Remover inmediatamente de la vista para respuesta instantánea
    setDrafts(prev => prev.filter(d => d.id !== draft.id));

    try {
      const classId = draft.class_id || draft.class_sessions?.id;
      if (draft.status === 'approved' && classId) {
        const deleteClassAct = window.confirm('Este borrador ya estaba publicado. ¿Deseas también eliminar la actividad de la clase para que los estudiantes ya no la vean?');
        if (deleteClassAct) {
          const { data: act } = await supabase.from('class_activities').select('id').eq('class_id', classId).maybeSingle();
          if (act) {
            const { data: oldQs } = await supabase.from('activity_questions').select('id').eq('activity_id', act.id);
            if (oldQs && oldQs.length > 0) {
              const oldQIds = oldQs.map(q => q.id);
              await supabase.from('question_correct_answers').delete().in('question_id', oldQIds);
              await supabase.from('question_options').delete().in('question_id', oldQIds);
              await supabase.from('activity_questions').delete().in('id', oldQIds);
            }
            await supabase.from('class_activities').delete().eq('id', act.id);
          }
        }
      }

      // 1. Cambiar estado a 'rejected' en la base de datos (para asegurar la eliminación lógica incluso si RLS bloquea DELETE)
      const { error: updateErr } = await supabase
        .from('activity_drafts')
        .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
        .eq('id', draft.id);

      if (updateErr) {
        console.error('Error al actualizar estado del borrador:', updateErr);
      }

      // 2. Intentar la eliminación física del registro
      const { error: delErr } = await supabase
        .from('activity_drafts')
        .delete()
        .eq('id', draft.id);

      if (delErr) {
        console.warn('No se pudo borrar físicamente (posible política RLS), pero se marcó como rejected:', delErr);
      }

      showToast('Borrador eliminado exitosamente.');
    } catch (err) {
      console.error('Error eliminando borrador:', err);
      showToast(`Error al eliminar: ${err.message || 'Intenta de nuevo'}`, 'error');
      // En caso de fallo grave, recargar lista
      fetchDrafts();
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (draft) => {
    if (!window.confirm('¿Rechazar y descartar este borrador?')) return;
    setActionLoading(draft.id + '-reject');
    try {
      await supabase
        .from('activity_drafts')
        .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
        .eq('id', draft.id);
      showToast('Borrador rechazado.', 'info');
      fetchDrafts();
    } catch (err) {
      showToast('Error al rechazar el borrador.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // --- LÓGICA DE EDICIÓN DEL BORRADOR ---
  const [editingDraft, setEditingDraft] = useState(null);
  const [editFormData, setEditFormData] = useState(null);

  const startEditing = (draft) => {
    setEditingDraft(draft);
    setEditFormData(JSON.parse(JSON.stringify(draft.draft_data || {
      activity_title: '',
      activity_description: '',
      questions: []
    })));
  };

  const handleSaveEditedDraft = async (publishDirectly = false) => {
    if (!editingDraft || !editFormData) return;
    if (!editFormData.activity_title?.trim()) {
      alert('Por favor asigna un título a la actividad.');
      return;
    }

    setActionLoading('saving-edit');
    try {
      const classId = editingDraft.class_id || editingDraft.class_sessions?.id;
      const shouldPublish = publishDirectly || editingDraft.status === 'approved';

      // 1. Guardar cambios en activity_drafts
      const { error: draftErr } = await supabase
        .from('activity_drafts')
        .update({
          draft_data: editFormData,
          status: shouldPublish ? 'approved' : editingDraft.status,
          reviewed_at: shouldPublish ? new Date().toISOString() : editingDraft.reviewed_at
        })
        .eq('id', editingDraft.id);

      if (draftErr) throw draftErr;

      // 2. Si se publica o ya estaba aprobado, sincronizar en base de datos real
      if (shouldPublish && classId) {
        const attempts = maxAttemptsByDraft[editingDraft.id] ?? 1;
        await syncAndPublishActivity(classId, editFormData, attempts);
      }

      showToast(shouldPublish ? '¡Borrador guardado y publicado exitosamente!' : 'Borrador guardado con éxito.');
      setEditingDraft(null);
      setEditFormData(null);
      fetchDrafts();
    } catch (err) {
      console.error('Error guardando cambios del borrador:', err);
      showToast(`Error al guardar: ${err.message || 'Intenta de nuevo'}`, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const statusBadge = (status) => {
    const styles = {
      pending:  { bg: '#fef9c3', color: '#854d0e', label: 'Pendiente',  icon: <Bot size={12} /> },
      approved: { bg: '#dcfce7', color: '#166534', label: 'Publicado',  icon: <CheckCheck size={12} /> },
      rejected: { bg: '#fee2e2', color: '#991b1b', label: 'Rechazado',  icon: <XCircle size={12} /> },
    };
    const s = styles[status] || styles.pending;
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '4px',
        background: s.bg, color: s.color,
        padding: '2px 10px', borderRadius: '12px', fontSize: '0.74rem', fontWeight: 700
      }}>
        {s.icon} {s.label}
      </span>
    );
  };

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando borradores...</div>;

  return (
    <div style={{ padding: '1.5rem 0' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: '1.5rem', right: '1.5rem', zIndex: 9999,
          background: toast.type === 'error' ? '#dc2626' : toast.type === 'info' ? '#0369a1' : '#16a34a',
          color: '#fff', padding: '0.75rem 1.25rem', borderRadius: '10px',
          fontWeight: 600, fontSize: '0.88rem', boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Sparkles size={20} color="var(--gold-dark)" />
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--navy)' }}>
            Borradores generados por IA
          </h3>
        </div>
        <button
          onClick={fetchDrafts}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'none', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.35rem 0.85rem', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-muted)' }}
        >
          <RefreshCw size={13} /> Actualizar
        </button>
      </div>

      {/* Info banner */}
      <div style={{
        background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px',
        padding: '0.75rem 1rem', marginBottom: '1.25rem',
        display: 'flex', alignItems: 'flex-start', gap: '0.6rem', fontSize: '0.83rem', color: '#1e40af'
      }}>
        <Bot size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
        <span>
          Estos borradores fueron generados automáticamente a partir del contenido de las clases.
          Puedes <strong>editar</strong> sus preguntas y retroalimentación, <strong>publicar</strong> para tus estudiantes, <strong>despublicar</strong> o <strong>eliminar</strong> cuando lo necesites.
        </span>
      </div>

      {/* Lista */}
      {drafts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
          <Bot size={40} style={{ marginBottom: '0.75rem', opacity: 0.4 }} />
          <p style={{ margin: 0, fontWeight: 600 }}>No hay borradores</p>
          <p style={{ margin: '0.4rem 0 0', fontSize: '0.82rem' }}>Cuando se procese una sesión de clase, el borrador aparecerá aquí.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {drafts.map(draft => (
            <div key={draft.id} style={{
              background: '#fff', border: '1px solid var(--border-color)',
              borderRadius: '12px', overflow: 'hidden',
              boxShadow: draft.status === 'pending' ? '0 0 0 2px rgba(202,138,4,0.15)' : 'none'
            }}>
              {/* Cabecera del borrador */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '1rem 1.25rem', gap: '1rem', flexWrap: 'wrap'
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
                    {statusBadge(draft.status)}
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {new Date(draft.created_at).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem', color: 'var(--navy)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {draft.draft_data?.activity_title || 'Sin título'}
                  </p>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Clase: <strong>{draft.class_sessions?.title}</strong> · {draft.draft_data?.questions?.length || 0} preguntas
                  </p>
                </div>

                {/* Acciones */}
                <div style={{ display: 'flex', gap: '0.45rem', flexShrink: 0, flexWrap: 'wrap' }}>
                  {/* Previsualizar */}
                  <button
                    onClick={() => setExpandedId(expandedId === draft.id ? null : draft.id)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                      padding: '0.45rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)',
                      background: '#fff', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600
                    }}
                  >
                    <Eye size={13} />
                    {expandedId === draft.id ? 'Ocultar' : 'Ver'}
                    {expandedId === draft.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>

                  {/* Editar */}
                  <button
                    onClick={() => startEditing(draft)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                      padding: '0.45rem 0.75rem', borderRadius: '8px', border: '1px solid #93c5fd',
                      background: '#eff6ff', color: '#1d4ed8', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700
                    }}
                  >
                    <Edit3 size={13} /> Editar
                  </button>

                  {/* Botones según estado */}
                  {draft.status === 'pending' && (
                    <>
                      {/* Input intentos permitidos */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>Intentos:</label>
                        <input
                          type="number"
                          min="0"
                          value={maxAttemptsByDraft[draft.id] ?? 1}
                          onChange={e => setMaxAttemptsByDraft(prev => ({ ...prev, [draft.id]: parseInt(e.target.value) || 0 }))}
                          style={{ width: '60px', padding: '0.3rem 0.4rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.8rem', textAlign: 'center' }}
                          title="0 = Intentos ilimitados"
                        />
                      </div>
                      <button
                        onClick={() => handleApprove(draft)}
                        disabled={!!actionLoading}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                          padding: '0.45rem 0.85rem', borderRadius: '8px', border: 'none',
                          background: 'var(--navy)', color: '#fff', cursor: 'pointer',
                          fontSize: '0.8rem', fontWeight: 700, opacity: actionLoading ? 0.6 : 1
                        }}
                      >
                        {actionLoading === draft.id + '-approve' ? '...' : <><Check size={13} /> Publicar</>}
                      </button>
                      <button
                        onClick={() => handleReject(draft)}
                        disabled={!!actionLoading}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                          padding: '0.45rem 0.75rem', borderRadius: '8px', border: '1px solid #fca5a5',
                          background: '#fff7f7', color: '#dc2626', cursor: 'pointer',
                          fontSize: '0.8rem', fontWeight: 700, opacity: actionLoading ? 0.6 : 1
                        }}
                      >
                        {actionLoading === draft.id + '-reject' ? '...' : <><XCircle size={13} /> Rechazar</>}
                      </button>
                    </>
                  )}

                  {draft.status === 'approved' && (
                    <button
                      onClick={() => handleUnpublish(draft)}
                      disabled={!!actionLoading}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                        padding: '0.45rem 0.85rem', borderRadius: '8px', border: '1px solid #fde047',
                        background: '#fef9c3', color: '#854d0e', cursor: 'pointer',
                        fontSize: '0.8rem', fontWeight: 700, opacity: actionLoading ? 0.6 : 1
                      }}
                    >
                      {actionLoading === draft.id + '-unpublish' ? '...' : <><EyeOff size={13} /> Despublicar</>}
                    </button>
                  )}

                  {draft.status === 'rejected' && (
                    <button
                      onClick={() => handleApprove(draft)}
                      disabled={!!actionLoading}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                        padding: '0.45rem 0.85rem', borderRadius: '8px', border: 'none',
                        background: 'var(--navy)', color: '#fff', cursor: 'pointer',
                        fontSize: '0.8rem', fontWeight: 700, opacity: actionLoading ? 0.6 : 1
                      }}
                    >
                      {actionLoading === draft.id + '-approve' ? '...' : <><Check size={13} /> Publicar</>}
                    </button>
                  )}

                  {/* Eliminar borrador */}
                  <button
                    onClick={() => handleDelete(draft)}
                    disabled={!!actionLoading}
                    title="Eliminar borrador permanentemente"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                      padding: '0.45rem 0.65rem', borderRadius: '8px', border: '1px solid #fecaca',
                      background: '#fff1f2', color: '#e11d48', cursor: 'pointer',
                      fontSize: '0.8rem', fontWeight: 700, opacity: actionLoading ? 0.6 : 1
                    }}
                  >
                    {actionLoading === draft.id + '-delete' ? '...' : <Trash2 size={13} />}
                  </button>
                </div>
              </div>

              {/* Previsualización expandida de preguntas */}
              {expandedId === draft.id && (
                <div style={{ borderTop: '1px solid var(--border-color)', padding: '1rem 1.25rem', background: '#fafafa' }}>
                  <p style={{ margin: '0 0 0.75rem', fontSize: '0.83rem', color: 'var(--text-muted)' }}>
                    {draft.draft_data?.activity_description}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {(draft.draft_data?.questions || []).map((q, qi) => (
                      <div key={qi} style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.85rem 1rem' }}>
                        <p style={{ margin: '0 0 0.6rem', fontWeight: 700, fontSize: '0.87rem', color: 'var(--navy)' }}>
                          {qi + 1}. {q.text}
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          {(q.options || []).map((opt, oi) => (
                            <div key={oi} style={{
                              display: 'flex', alignItems: 'center', gap: '0.5rem',
                              padding: '0.4rem 0.65rem', borderRadius: '7px', fontSize: '0.83rem',
                              background: opt.is_correct ? '#dcfce7' : '#f8fafc',
                              border: `1px solid ${opt.is_correct ? '#86efac' : 'var(--border-color)'}`,
                              color: opt.is_correct ? '#166534' : 'var(--text-dark)',
                              fontWeight: opt.is_correct ? 700 : 400
                            }}>
                              {opt.is_correct ? <Check size={13} /> : <span style={{ width: 13 }} />}
                              {opt.text}
                            </div>
                          ))}
                        </div>
                        {/* ACLARACIÓN / RETROALIMENTACIÓN PEDAGÓGICA */}
                        {(() => {
                          const exp = (q.explanation || '').trim();
                          const src = (q.source_basis || '').trim();
                          const correctOpt = (q.options || []).find(o => o.is_correct || String(o.id) === String(q.correctOptionId));
                          const defaultFeedback = correctOpt 
                            ? `La opción correcta es "${correctOpt.text}". Revisa los contenidos de esta sesión para afianzar la explicación con tus estudiantes.`
                            : 'Fundamentado en los contenidos clave explicados durante esta sesión.';

                          const feedbackText = exp || src || defaultFeedback;

                          return (
                            <div style={{
                              margin: '0.6rem 0 0',
                              padding: '0.65rem 0.85rem',
                              background: '#eff6ff',
                              border: '1px solid #bfdbfe',
                              borderRadius: '8px',
                              fontSize: '0.8rem',
                              color: '#1e40af',
                              lineHeight: 1.45,
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '0.5rem'
                            }}>
                              <span style={{ fontSize: '1rem', flexShrink: 0 }}>💡</span>
                              <div style={{ flex: 1 }}>
                                <strong style={{ display: 'block', color: '#1d4ed8', marginBottom: '2px', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                  Retroalimentación Pedagógica
                                </strong>
                                <span>{feedbackText}</span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ─── MODAL DE EDICIÓN DEL BORRADOR ─── */}
      {editingDraft && editFormData && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 10000, padding: '1rem'
        }}>
          <div style={{
            background: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '820px',
            maxHeight: '90vh', display: 'flex', flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)', border: '1px solid var(--border-color)',
            overflow: 'hidden'
          }}>
            {/* Header del Modal */}
            <div style={{
              padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'var(--bg-light)'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--navy)' }}>
                  Editar Borrador de Actividad
                </h3>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Clase: {editingDraft.class_sessions?.title}
                </p>
              </div>
              <button
                onClick={() => { setEditingDraft(null); setEditFormData(null); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Cuerpo con scroll */}
            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Título de la actividad */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--navy)', marginBottom: '0.4rem' }}>
                  Título de la actividad *
                </label>
                <input
                  type="text"
                  value={editFormData.activity_title || ''}
                  onChange={e => setEditFormData({ ...editFormData, activity_title: e.target.value })}
                  style={{
                    width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px',
                    border: '1px solid var(--border-color)', fontSize: '0.9rem', outline: 'none'
                  }}
                  placeholder="Ej: Cuestionario de Reforzamiento - Sesión 1"
                />
              </div>

              {/* Descripción */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--navy)', marginBottom: '0.4rem' }}>
                  Instrucciones o descripción
                </label>
                <textarea
                  rows={2}
                  value={editFormData.activity_description || ''}
                  onChange={e => setEditFormData({ ...editFormData, activity_description: e.target.value })}
                  style={{
                    width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px',
                    border: '1px solid var(--border-color)', fontSize: '0.88rem', outline: 'none', resize: 'vertical'
                  }}
                  placeholder="Instrucciones para los estudiantes..."
                />
              </div>

              {/* Lista de preguntas */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <label style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--navy)' }}>
                    Preguntas ({editFormData.questions?.length || 0})
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const newQ = {
                        text: 'Nueva pregunta...',
                        question_type: 'single_choice',
                        options: [
                          { text: 'Opción 1', is_correct: true },
                          { text: 'Opción 2', is_correct: false },
                          { text: 'Opción 3', is_correct: false },
                          { text: 'Opción 4', is_correct: false },
                        ],
                        explanation: '',
                        source_basis: ''
                      };
                      setEditFormData({
                        ...editFormData,
                        questions: [...(editFormData.questions || []), newQ]
                      });
                    }}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                      padding: '0.35rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)',
                      background: '#fff', color: 'var(--navy)', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer'
                    }}
                  >
                    <PlusCircle size={14} /> Agregar Pregunta
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {(editFormData.questions || []).map((q, qIdx) => (
                    <div key={qIdx} style={{
                      background: 'var(--bg-light)', border: '1px solid var(--border-color)',
                      borderRadius: '12px', padding: '1.1rem', position: 'relative'
                    }}>
                      {/* Header de la pregunta */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--navy)', background: '#e2e8f0', padding: '2px 8px', borderRadius: '6px' }}>
                          Pregunta {qIdx + 1}
                        </span>
                        {editFormData.questions.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const updated = editFormData.questions.filter((_, idx) => idx !== qIdx);
                              setEditFormData({ ...editFormData, questions: updated });
                            }}
                            style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', fontWeight: 600 }}
                          >
                            <Trash2 size={13} /> Eliminar
                          </button>
                        )}
                      </div>

                      {/* Enunciado */}
                      <div style={{ marginBottom: '0.85rem' }}>
                        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '0.25rem' }}>
                          Enunciado
                        </label>
                        <textarea
                          rows={2}
                          value={q.text || ''}
                          onChange={e => {
                            const updated = [...editFormData.questions];
                            updated[qIdx].text = e.target.value;
                            setEditFormData({ ...editFormData, questions: updated });
                          }}
                          style={{
                            width: '100%', padding: '0.5rem 0.75rem', borderRadius: '7px',
                            border: '1px solid var(--border-color)', fontSize: '0.88rem', outline: 'none'
                          }}
                        />
                      </div>

                      {/* Opciones */}
                      <div style={{ marginBottom: '0.85rem' }}>
                        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '0.35rem' }}>
                          Opciones de respuesta (Marca cuál es la correcta)
                        </label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                          {(q.options || []).map((opt, oIdx) => (
                            <div key={oIdx} style={{
                              display: 'flex', alignItems: 'center', gap: '0.5rem',
                              background: '#ffffff', padding: '0.4rem 0.6rem', borderRadius: '8px',
                              border: opt.is_correct ? '1.5px solid #22c55e' : '1px solid var(--border-color)'
                            }}>
                              <input
                                type="radio"
                                name={`correct-opt-${qIdx}`}
                                checked={!!opt.is_correct}
                                onChange={() => {
                                  const updated = [...editFormData.questions];
                                  updated[qIdx].options = updated[qIdx].options.map((o, i) => ({
                                    ...o,
                                    is_correct: i === oIdx
                                  }));
                                  setEditFormData({ ...editFormData, questions: updated });
                                }}
                                style={{ cursor: 'pointer' }}
                              />
                              <input
                                type="text"
                                value={opt.text || ''}
                                onChange={e => {
                                  const updated = [...editFormData.questions];
                                  updated[qIdx].options[oIdx].text = e.target.value;
                                  setEditFormData({ ...editFormData, questions: updated });
                                }}
                                style={{
                                  flex: 1, border: 'none', outline: 'none', fontSize: '0.85rem',
                                  fontWeight: opt.is_correct ? 700 : 400, color: 'var(--navy)'
                                }}
                                placeholder={`Opción ${oIdx + 1}`}
                              />
                              {opt.is_correct && (
                                <span style={{ fontSize: '0.72rem', color: '#166534', fontWeight: 700, background: '#dcfce7', padding: '1px 6px', borderRadius: '4px' }}>
                                  Correcta
                                </span>
                              )}
                              {(q.options || []).length > 2 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = [...editFormData.questions];
                                    updated[qIdx].options = updated[qIdx].options.filter((_, i) => i !== oIdx);
                                    // Si eliminó la correcta, poner la primera como correcta
                                    if (opt.is_correct && updated[qIdx].options.length > 0) {
                                      updated[qIdx].options[0].is_correct = true;
                                    }
                                    setEditFormData({ ...editFormData, questions: updated });
                                  }}
                                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px' }}
                                  title="Eliminar opción"
                                >
                                  <X size={14} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...editFormData.questions];
                            updated[qIdx].options = [
                              ...(updated[qIdx].options || []),
                              { text: '', is_correct: false }
                            ];
                            setEditFormData({ ...editFormData, questions: updated });
                          }}
                          style={{
                            marginTop: '0.4rem', background: 'none', border: 'none',
                            color: 'var(--navy)', fontSize: '0.75rem', fontWeight: 700,
                            cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: '3px'
                          }}
                        >
                          + Agregar opción
                        </button>
                      </div>

                      {/* Retroalimentación de la IA */}
                      <div style={{ marginBottom: '0.6rem' }}>
                        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '0.25rem' }}>
                          💡 Retroalimentación Pedagógica (Explicación para el estudiante)
                        </label>
                        <textarea
                          rows={2}
                          value={q.explanation || ''}
                          onChange={e => {
                            const updated = [...editFormData.questions];
                            updated[qIdx].explanation = e.target.value;
                            setEditFormData({ ...editFormData, questions: updated });
                          }}
                          style={{
                            width: '100%', padding: '0.5rem 0.75rem', borderRadius: '7px',
                            border: '1px solid var(--border-color)', fontSize: '0.82rem', outline: 'none'
                          }}
                          placeholder="Explica por qué esta es la respuesta correcta y cómo se relaciona con el contenido..."
                        />
                      </div>

                      {/* Fundamento en la clase */}
                      <div>
                        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '0.25rem' }}>
                          📌 Fundamento en la clase
                        </label>
                        <input
                          type="text"
                          value={q.source_basis || ''}
                          onChange={e => {
                            const updated = [...editFormData.questions];
                            updated[qIdx].source_basis = e.target.value;
                            setEditFormData({ ...editFormData, questions: updated });
                          }}
                          style={{
                            width: '100%', padding: '0.45rem 0.75rem', borderRadius: '7px',
                            border: '1px solid var(--border-color)', fontSize: '0.82rem', outline: 'none'
                          }}
                          placeholder="Ej: Minuto 14:20 - Introducción al concepto de..."
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer del modal con botones de acción */}
            <div style={{
              padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)',
              display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem',
              background: '#f8fafc'
            }}>
              <button
                type="button"
                onClick={() => { setEditingDraft(null); setEditFormData(null); }}
                style={{
                  padding: '0.55rem 1.15rem', borderRadius: '8px', border: '1px solid var(--border-color)',
                  background: '#fff', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer'
                }}
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={() => handleSaveEditedDraft(false)}
                disabled={actionLoading === 'saving-edit'}
                style={{
                  padding: '0.55rem 1.25rem', borderRadius: '8px', border: '1px solid var(--navy)',
                  background: '#fff', color: 'var(--navy)', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: '0.35rem'
                }}
              >
                <Save size={14} /> Guardar borrador
              </button>

              <button
                type="button"
                onClick={() => handleSaveEditedDraft(true)}
                disabled={actionLoading === 'saving-edit'}
                style={{
                  padding: '0.55rem 1.35rem', borderRadius: '8px', border: 'none',
                  background: 'var(--navy)', color: '#fff', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                  boxShadow: '0 2px 4px rgba(20, 33, 61, 0.2)'
                }}
              >
                <CheckCheck size={14} /> Guardar y Publicar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
/* ─────────────────────────────────────────────────────────────
   MODAL DE RESULTADOS POR ESTUDIANTE (ActivityResultsModal)
───────────────────────────────────────────────────────────── */
function ActivityResultsModal({ activity, classData, onClose, onGoToClass }) {
  const { programId } = useTeacherContext();
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [stats, setStats] = useState({
    totalStudents: 0,
    completedCount: 0,
    averageScore: 0,
    passingCount: 0,
  });
  const [searchStudent, setSearchStudent] = useState('');
  const [filterStudentStatus, setFilterStudentStatus] = useState('all'); // 'all' | 'completed' | 'not_started'

  useEffect(() => {
    async function loadActivityResults() {
      const effectiveProgId = programId || classData?.program_id || classData?.sessions?.modules?.program_id;
      let effectiveActId = activity?.id || classData?.activity?.id;

      try {
        setLoading(true);

        // Si no vino el ID de actividad directamente, buscarlo por class_id
        if (!effectiveActId && classData?.id) {
          const { data: actRow } = await supabase
            .from('class_activities')
            .select('id, title, description')
            .eq('class_id', classData.id)
            .maybeSingle();
          if (actRow?.id) {
            effectiveActId = actRow.id;
          }
        }

        // 1. Cargar estudiantes matriculados en el programa (FILTRADO ESTRICTO ROLE === 'student')
        let enrolledStudentProfiles = [];
        if (effectiveProgId) {
          try {
            // Estrategia A: select con join directo a users_profile
            const { data: enrollData, error: enrollErr } = await supabase
              .from('enrollments')
              .select('student_id, created_at, users_profile(*)')
              .eq('program_id', effectiveProgId);

            if (!enrollErr && enrollData && enrollData.length > 0) {
              enrolledStudentProfiles = enrollData
                .map(e => e.users_profile)
                .filter(p => p && p.role === 'student');
            }
          } catch (err) {
            console.warn('Error en join enrollments-users_profile:', err);
          }

          // Estrategia B (Fallback): Si no se obtuvieron perfiles mediante el join, consultar por IDs
          if (enrolledStudentProfiles.length === 0) {
            try {
              const { data: rawEnroll } = await supabase
                .from('enrollments')
                .select('student_id')
                .eq('program_id', effectiveProgId);

              const rawIds = (rawEnroll || []).map(e => e.student_id).filter(Boolean);
              if (rawIds.length > 0) {
                const { data: profsById } = await supabase
                  .from('users_profile')
                  .select('*')
                  .in('id', rawIds)
                  .eq('role', 'student');

                const { data: profsByAuth } = await supabase
                  .from('users_profile')
                  .select('*')
                  .in('auth_user_id', rawIds)
                  .eq('role', 'student');

                const pMap = new Map();
                (profsById || []).forEach(p => pMap.set(p.id, p));
                (profsByAuth || []).forEach(p => pMap.set(p.id, p));
                enrolledStudentProfiles = Array.from(pMap.values());
              }
            } catch (fallbackErr) {
              console.warn('Error en fallback enrollments:', fallbackErr);
            }
          }
        }

        // 2. Cargar intentos de estudiantes en esta actividad
        let attemptsList = [];
        if (effectiveActId) {
          const { data: attemptsData, error: attErr } = await supabase
            .from('activity_attempts')
            .select('*')
            .eq('activity_id', effectiveActId)
            .order('completed_at', { ascending: false });

          if (attErr) console.error('Error cargando intentos:', attErr);
          attemptsList = attemptsData || [];
        }

        // 3. Auto-inclusión de estudiantes con intentos (por si no estaban en enrolledStudentProfiles)
        const matchedProfileIds = new Set();
        enrolledStudentProfiles.forEach(st => {
          if (st.id) matchedProfileIds.add(st.id);
          if (st.auth_user_id) matchedProfileIds.add(st.auth_user_id);
        });

        const unmatchedAttemptUserIds = attemptsList
          .map(a => a.student_id)
          .filter(id => id && !matchedProfileIds.has(id));

        if (unmatchedAttemptUserIds.length > 0) {
          try {
            const { data: extraById } = await supabase
              .from('users_profile')
              .select('*')
              .in('id', unmatchedAttemptUserIds);

            const { data: extraByAuth } = await supabase
              .from('users_profile')
              .select('*')
              .in('auth_user_id', unmatchedAttemptUserIds);

            const extraProfiles = [...(extraById || []), ...(extraByAuth || [])];
            extraProfiles.forEach(p => {
              if (p && (p.role === 'student' || !p.role)) {
                if (!enrolledStudentProfiles.some(st => st.id === p.id)) {
                  enrolledStudentProfiles.push(p);
                }
              }
            });
          } catch (extraErr) {
            console.warn('Error resolviendo perfiles de intentos extra:', extraErr);
          }
        }

        // 4. Combinar cada estudiante con sus intentos (matching bidireccional por id y auth_user_id)
        const combinedStudents = enrolledStudentProfiles.map(st => {
          const studentAttempts = attemptsList.filter(att => {
            if (!att.student_id) return false;
            return (
              att.student_id === st.id ||
              (st.auth_user_id && att.student_id === st.auth_user_id)
            );
          });

          // Ordenar por el puntaje más alto obtenido (desempate por fecha más reciente)
          studentAttempts.sort((a, b) => {
            const scA = typeof a.score === 'number' ? a.score : -1;
            const scB = typeof b.score === 'number' ? b.score : -1;
            if (scB !== scA) return scB - scA;
            return new Date(b.completed_at || 0) - new Date(a.completed_at || 0);
          });
          const bestAttempt = studentAttempts[0] || null;
          const isCompleted = bestAttempt && (bestAttempt.status === 'completed' || typeof bestAttempt.score === 'number');

          return {
            ...st,
            attempt: bestAttempt,
            status: isCompleted ? 'completed' : 'not_started',
            score: isCompleted && typeof bestAttempt.score === 'number' ? bestAttempt.score : null,
            completedAt: bestAttempt?.completed_at || null,
          };
        });

        setStudents(combinedStudents);

        // 5. Calcular métricas estadísticas del grupo usando el mejor intento por estudiante
        const completedAttempts = combinedStudents.filter(s => s.status === 'completed');
        const scores = completedAttempts.map(s => s.score).filter(sc => typeof sc === 'number');
        const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
        const passing = scores.filter(sc => sc >= 60).length;

        setStats({
          totalStudents: combinedStudents.length,
          completedCount: completedAttempts.length,
          averageScore: avg,
          passingCount: passing,
        });

      } catch (err) {
        console.error('Error cargando analítica de reforzamiento:', err);
      } finally {
        setLoading(false);
      }
    }

    loadActivityResults();
  }, [activity?.id, classData?.id, classData?.program_id, programId]);

  const completedCount = students.filter(s => s.status === 'completed').length;
  const notStartedCount = students.filter(s => s.status === 'not_started').length;

  const filteredStudents = students.filter(st => {
    if (filterStudentStatus === 'completed' && st.status !== 'completed') return false;
    if (filterStudentStatus === 'not_started' && st.status !== 'not_started') return false;
    if (searchStudent.trim()) {
      const q = searchStudent.toLowerCase();
      const name = (st.full_name || '').toLowerCase();
      const email = (st.email || '').toLowerCase();
      return name.includes(q) || email.includes(q);
    }
    return true;
  });

  const participationPct = stats.totalStudents > 0 ? Math.round((stats.completedCount / stats.totalStudents) * 100) : 0;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(10, 17, 40, 0.75)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1100,
      padding: '1.5rem',
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <div style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        maxWidth: '900px',
        width: '100%',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(20, 33, 61, 0.35)',
        border: '1px solid #E5E5E5',
        overflow: 'hidden'
      }}>
        {/* MODAL HEADER */}
        <div style={{
          padding: '1.5rem 2rem',
          background: '#14213D',
          color: '#FFFFFF',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          borderBottom: '2px solid #FCA311'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span style={{
                background: 'rgba(252, 163, 17, 0.2)',
                color: '#FCA311',
                padding: '3px 10px',
                borderRadius: '8px',
                fontSize: '0.74rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <Sparkles size={12} /> Actividad de Reforzamiento IA
              </span>
              <span style={{
                background: 'rgba(255, 255, 255, 0.12)',
                color: '#E5E5E5',
                padding: '3px 10px',
                borderRadius: '8px',
                fontSize: '0.74rem',
                fontWeight: 600
              }}>
                {classData?.title || 'Clase'}
              </span>
            </div>
            <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: '#FFFFFF' }}>
              {activity?.title || classData?.activity?.title || 'Resultados de Reforzamiento'}
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'rgba(255,255,255,0.75)' }}>
              {activity?.description || classData?.activity?.description || 'Desempeño y calificaciones individuales de los estudiantes en la actividad de repaso.'}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '8px',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* STATS BANNER */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem',
          padding: '1.25rem 2rem',
          background: '#F8F9FA',
          borderBottom: '1px solid #E5E5E5'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: 'rgba(20, 33, 61, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#14213D'
            }}>
              <Users size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#6C757D', fontWeight: 600 }}>Participación</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#14213D' }}>
                {stats.completedCount} / {stats.totalStudents} <span style={{ fontSize: '0.8rem', color: '#FCA311', fontWeight: 700 }}>({participationPct}%)</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: 'rgba(252, 163, 17, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#B45309'
            }}>
              <TrendingUp size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#6C757D', fontWeight: 600 }}>Promedio de Dominio</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: stats.averageScore >= 60 ? '#166534' : '#B45309' }}>
                {stats.averageScore}% <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6C757D' }}>promedio</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: 'rgba(22, 101, 52, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#166534'
            }}>
              <Target size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#6C757D', fontWeight: 600 }}>Tasa de Aprobación</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#166534' }}>
                {stats.passingCount} estudiantes <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6C757D' }}>(&ge;60%)</span>
              </div>
            </div>
          </div>
        </div>

        {/* MODAL BODY (RESULTADOS POR ESTUDIANTE) */}
        <div style={{ padding: '1.5rem 2rem', overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#6C757D' }}>
              <RefreshCw size={28} style={{ animation: 'spin 1s linear infinite', marginBottom: '8px' }} />
              <div>Cargando resultados de los estudiantes...</div>
            </div>
          ) : (
            <div>
              {/* Toolbar Estudiantes */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
                  <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: '#6C757D' }} />
                  <input
                    type="text"
                    placeholder="Buscar por nombre o correo de estudiante..."
                    value={searchStudent}
                    onChange={(e) => setSearchStudent(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px 8px 34px',
                      borderRadius: '8px',
                      border: '1px solid #E5E5E5',
                      fontSize: '0.85rem'
                    }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[
                    { id: 'all', label: `Todos (${students.length})` },
                    { id: 'completed', label: `Completados (${completedCount})` },
                    { id: 'not_started', label: `Sin realizar (${notStartedCount})` }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setFilterStudentStatus(tab.id)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: filterStudentStatus === tab.id ? '1px solid #14213D' : '1px solid #E5E5E5',
                        background: filterStudentStatus === tab.id ? '#14213D' : '#FFFFFF',
                        color: filterStudentStatus === tab.id ? '#FFFFFF' : '#14213D',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* TABLA DE ESTUDIANTES */}
              <div style={{ border: '1px solid #E5E5E5', borderRadius: '10px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#F8F9FA', borderBottom: '1px solid #E5E5E5', color: '#6C757D', fontWeight: 700 }}>
                      <th style={{ padding: '12px 16px' }}>Estudiante</th>
                      <th style={{ padding: '12px 16px' }}>Estado</th>
                      <th style={{ padding: '12px 16px' }}>Calificación</th>
                      <th style={{ padding: '12px 16px' }}>Fecha de finalización</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ padding: '2.5rem', textAlign: 'center', color: '#6C757D' }}>
                          No se encontraron estudiantes con ese criterio de búsqueda.
                        </td>
                      </tr>
                    ) : (
                      filteredStudents.map((st, idx) => (
                        <tr key={st.id || st.student_id || st.email || idx} style={{ borderBottom: '1px solid #F0F0F0' }}>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                background: '#14213D',
                                color: '#FFFFFF',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                flexShrink: 0
                              }}>
                                {(st.full_name || 'E')[0].toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontWeight: 600, color: '#14213D' }}>{st.full_name || 'Estudiante'}</div>
                                <div style={{ fontSize: '0.72rem', color: '#6C757D' }}>{st.email}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            {st.status === 'completed' ? (
                              <span style={{
                                background: '#DCFCE7',
                                color: '#166534',
                                padding: '4px 10px',
                                borderRadius: '12px',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}>
                                <CheckCircle2 size={13} /> Completada
                              </span>
                            ) : (
                              <span style={{
                                background: '#F1F5F9',
                                color: '#64748B',
                                padding: '4px 10px',
                                borderRadius: '12px',
                                fontSize: '0.74rem',
                                fontWeight: 600
                              }}>
                                Sin realizar
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            {typeof st.score === 'number' ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{
                                  fontWeight: 800,
                                  color: st.score >= 60 ? '#166534' : '#B45309',
                                  fontSize: '0.92rem',
                                  minWidth: '38px'
                                }}>
                                  {st.score}%
                                </span>
                                <div style={{
                                  width: '80px',
                                  height: '7px',
                                  background: '#E5E5E5',
                                  borderRadius: '4px',
                                  overflow: 'hidden'
                                }}>
                                  <div style={{
                                    width: `${Math.min(100, Math.max(0, st.score))}%`,
                                    height: '100%',
                                    background: st.score >= 60 ? '#22C55E' : '#FCA311',
                                    borderRadius: '4px'
                                  }} />
                                </div>
                              </div>
                            ) : (
                              <span style={{ color: '#9CA3AF', fontSize: '0.85rem' }}>—</span>
                            )}
                          </td>
                          <td style={{ padding: '12px 16px', color: '#6C757D', fontSize: '0.82rem' }}>
                            {st.completedAt ? (
                              new Date(st.completedAt).toLocaleString('es-ES', {
                                day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                              })
                            ) : '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div style={{
          padding: '1rem 2rem',
          background: '#F8F9FA',
          borderTop: '1px solid #E5E5E5',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <button
            onClick={() => {
              onClose();
              if (onGoToClass && classData?.id) onGoToClass(classData.id);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'transparent',
              border: '1px solid #14213D',
              color: '#14213D',
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <Video size={14} /> Ver clase en Mis Clases
          </button>
          <button
            onClick={onClose}
            style={{
              background: '#14213D',
              color: '#FFFFFF',
              border: 'none',
              padding: '8px 20px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   PESTAÑA DE REFORZAMIENTO IA (ReforzamientoIATab)
   Monitoreo, analítica y resultados de actividades de reforzamiento
───────────────────────────────────────────────────────────── */
function ReforzamientoIATab({ onChangeTab }) {
  const { profile, teacherId, programId, currentProgram } = useTeacherContext();
  const [loading, setLoading] = useState(true);
  const [classesWithActivities, setClassesWithActivities] = useState([]);
  const [modules, setModules] = useState([]);
  const [selectedModuleId, setSelectedModuleId] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'published' | 'with_responses' | 'draft_pending' | 'no_activity'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedActivityForModal, setSelectedActivityForModal] = useState(null);

  // Cargar datos
  const loadData = async () => {
    if (!programId) return;
    try {
      setLoading(true);
      const teacherProfileId = teacherId || profile?.id;

      // 1. Obtener módulos del programa (tabla modules)
      const { data: modData } = await supabase
        .from('modules')
        .select('id, title, order_index')
        .eq('program_id', programId)
        .order('order_index', { ascending: true });

      setModules(modData || []);

      // 2. Obtener clases asignadas al docente con jerarquía sessions / modules
      let classes = [];
      const { data: sData, error: sErr } = await supabase
        .from('class_sessions')
        .select('*, sessions(id, title, order_index, module_id, modules(id, title, program_id)), meet_url')
        .eq('program_id', programId)
        .eq('teacher_id', teacherProfileId)
        .order('class_date', { ascending: true });

      if (sErr) {
        // Fallback a esquema subtopics si aún existiera
        const { data: oldData } = await supabase
          .from('class_sessions')
          .select('*, subtopics(id, title, module_id, modules(id, title, program_id)), meet_url')
          .eq('program_id', programId)
          .eq('teacher_id', teacherProfileId)
          .order('class_date', { ascending: true });
        classes = oldData || [];
      } else {
        classes = sData || [];
      }

      const classIds = classes.map(c => c.id);

      if (classIds.length === 0) {
        setClassesWithActivities([]);
        setLoading(false);
        return;
      }

      // 3. Obtener actividades de reforzamiento (class_activities)
      const { data: actData } = await supabase
        .from('class_activities')
        .select('id, class_id, title, description, is_published, max_attempts, is_mandatory, created_at')
        .in('class_id', classIds);

      const activityByClass = {};
      const activityIds = [];
      (actData || []).forEach(a => {
        activityByClass[a.class_id] = a;
        activityIds.push(a.id);
      });

      // 4. Obtener borradores IA (activity_drafts)
      const { data: draftData } = await supabase
        .from('activity_drafts')
        .select('id, class_id, status, draft_data, reviewed_at, created_at')
        .in('class_id', classIds)
        .order('created_at', { ascending: false });

      const draftByClass = {};
      (draftData || []).forEach(d => {
        if (!draftByClass[d.class_id]) draftByClass[d.class_id] = d;
      });

      // 5. Obtener intentos completados (activity_attempts)
      let attemptsByActivity = {};
      if (activityIds.length > 0) {
        const { data: attData } = await supabase
          .from('activity_attempts')
          .select('id, activity_id, student_id, status, score, completed_at')
          .in('activity_id', activityIds);

        (attData || []).forEach(att => {
          if (!attemptsByActivity[att.activity_id]) attemptsByActivity[att.activity_id] = [];
          attemptsByActivity[att.activity_id].push(att);
        });
      }

      // 6. Obtener conteo de estudiantes matriculados (filtrado por role === 'student')
      let totalStudents = 0;
      try {
        const { data: rawEnroll } = await supabase
          .from('enrollments')
          .select('student_id, users_profile(role)')
          .eq('program_id', programId);

        const studentEnrollments = (rawEnroll || []).filter(e => {
          if (!e.users_profile) return true;
          return e.users_profile.role === 'student';
        });
        totalStudents = studentEnrollments.length;
      } catch (errEnroll) {
        console.warn('Error leyendo conteo de estudiantes:', errEnroll);
      }

      // 7. Enlazar datos por cada clase
      const enriched = classes.map(c => {
        const act = activityByClass[c.id] || null;
        const draft = draftByClass[c.id] || null;
        const attempts = act ? (attemptsByActivity[act.id] || []) : [];
        const completedAttempts = attempts.filter(a => a.status === 'completed' || typeof a.score === 'number');
        
        // Estudiantes únicos que completaron y su mejor puntaje
        const bestScoreByStudent = {};
        completedAttempts.forEach(a => {
          if (typeof a.score === 'number') {
            const sId = a.student_id;
            if (bestScoreByStudent[sId] === undefined || a.score > bestScoreByStudent[sId]) {
              bestScoreByStudent[sId] = a.score;
            }
          }
        });
        const uniqueStudentsCompleted = new Set(completedAttempts.map(a => a.student_id)).size;
        const studentBestScores = Object.values(bestScoreByStudent);
        const avgScore = studentBestScores.length > 0 ? Math.round(studentBestScores.reduce((a, b) => a + b, 0) / studentBestScores.length) : null;

        // Determinar estado de la actividad con sincronización exacta
        let actStatus = 'no_activity';
        if (act && act.is_published) {
          actStatus = 'published';
        } else if (draft && draft.status === 'pending') {
          actStatus = 'draft_pending';
        } else if (draft && draft.status === 'approved' && (!act || !act.is_published)) {
          actStatus = 'draft_pending';
        }

        const effectiveTotal = totalStudents > 0 ? totalStudents : uniqueStudentsCompleted;

        return {
          ...c,
          activity: act,
          draft: draft,
          actStatus,
          totalStudents: effectiveTotal,
          completedCount: uniqueStudentsCompleted,
          attemptsCount: attempts.length,
          avgScore,
          participationPct: effectiveTotal > 0 ? Math.round((uniqueStudentsCompleted / effectiveTotal) * 100) : 0,
        };
      });

      setClassesWithActivities(enriched);
    } catch (err) {
      console.error('Error cargando actividades de reforzamiento:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Suscripción Realtime para actualizar la vista instantáneamente
    const channel = supabase
      .channel('reforzamiento_ia_tab_sync_' + (programId || 'all'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'class_activities' }, () => {
        loadData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_drafts' }, () => {
        loadData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_attempts' }, () => {
        loadData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teacherId, profile?.id, programId]);

  // Cálculos de KPIs superiores
  const publishedClasses = classesWithActivities.filter(c => c.actStatus === 'published');
  const publishedCount = publishedClasses.length;
  const draftPendingCount = classesWithActivities.filter(c => c.actStatus === 'draft_pending').length;
  
  // Participación promedio sobre actividades publicadas
  const totalStudents = classesWithActivities[0]?.totalStudents || 0;
  let globalParticipation = 0;
  if (publishedCount > 0 && totalStudents > 0) {
    const sumParticipation = publishedClasses.reduce((acc, c) => acc + c.participationPct, 0);
    globalParticipation = Math.round(sumParticipation / publishedCount);
  }
  
  const allScores = publishedClasses.map(c => c.avgScore).filter(s => typeof s === 'number');
  const globalAverage = allScores.length > 0 ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : 0;

  // Filtrado
  const filteredList = classesWithActivities.filter(c => {
    // Filtro Módulo
    if (selectedModuleId !== 'all') {
      const classModId = c.sessions?.module_id || c.subtopics?.module_id || c.sessions?.modules?.id;
      if (classModId !== selectedModuleId) return false;
    }

    // Filtro Estado
    if (statusFilter === 'published' && c.actStatus !== 'published') return false;
    if (statusFilter === 'with_responses' && c.completedCount === 0) return false;
    if (statusFilter === 'draft_pending' && c.actStatus !== 'draft_pending') return false;
    if (statusFilter === 'no_activity' && c.actStatus !== 'no_activity') return false;

    // Filtro Búsqueda
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const title = (c.title || '').toLowerCase();
      const actTitle = (c.activity?.title || c.draft?.draft_data?.activity_title || '').toLowerCase();
      return title.includes(q) || actTitle.includes(q);
    }

    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* ── HEADER DEL MÓDULO ── */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        padding: '1.75rem 2rem',
        border: '1px solid #E5E5E5',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{
              background: 'rgba(252, 163, 17, 0.15)',
              color: '#B45309',
              padding: '3px 10px',
              borderRadius: '8px',
              fontSize: '0.75rem',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <Brain size={13} /> Inteligencia Pedagógica
            </span>
            <span style={{ fontSize: '0.8rem', color: '#6C757D', fontWeight: 600 }}>
              {currentProgram?.title || 'Programa'}
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#14213D' }}>
            Seguimiento de Reforzamiento IA
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.88rem', color: '#6C757D' }}>
            Monitorea el impacto de las actividades de reforzamiento generadas por IA y el nivel de comprensión de tus estudiantes.
          </p>
        </div>

        <button
          onClick={() => onChangeTab && onChangeTab('clases')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: '#14213D',
            color: '#FFFFFF',
            border: 'none',
            padding: '10px 18px',
            borderRadius: '10px',
            fontSize: '0.85rem',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(20, 33, 61, 0.2)'
          }}
        >
          <Video size={16} /> Ir a Mis Clases
        </button>
      </div>

      {/* ── 4 KPIS BLACK & GOLD ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1.25rem'
      }}>
        {/* KPI 1: Actividades Publicadas */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '14px',
          padding: '1.25rem',
          border: '1px solid #E5E5E5',
          boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'rgba(20, 33, 61, 0.06)',
            color: '#14213D',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Sparkles size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: '#6C757D', fontWeight: 600 }}>Actividades Publicadas</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#14213D' }}>
              {publishedCount} <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6C757D' }}>de {classesWithActivities.length} clases</span>
            </div>
          </div>
        </div>

        {/* KPI 2: Participación Global */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '14px',
          padding: '1.25rem',
          border: '1px solid #E5E5E5',
          boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'rgba(252, 163, 17, 0.15)',
            color: '#B45309',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Users size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: '#6C757D', fontWeight: 600 }}>Participación Estudiantil</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#14213D' }}>
              {globalParticipation}% <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6C757D' }}>promedio</span>
            </div>
          </div>
        </div>

        {/* KPI 3: Promedio de Dominio */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '14px',
          padding: '1.25rem',
          border: '1px solid #E5E5E5',
          boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'rgba(22, 101, 52, 0.1)',
            color: '#166534',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <TrendingUp size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: '#6C757D', fontWeight: 600 }}>Nivel de Dominio</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: globalAverage >= 60 ? '#166534' : '#B45309' }}>
              {globalAverage}% <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6C757D' }}>aciertos</span>
            </div>
          </div>
        </div>

        {/* KPI 4: Borradores por Validar */}
        <div style={{
          background: draftPendingCount > 0 ? '#FFFBEB' : '#FFFFFF',
          borderRadius: '14px',
          padding: '1.25rem',
          border: draftPendingCount > 0 ? '1.5px solid #FCA311' : '1px solid #E5E5E5',
          boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: draftPendingCount > 0 ? 'rgba(252, 163, 17, 0.25)' : 'rgba(108, 117, 125, 0.1)',
            color: draftPendingCount > 0 ? '#B45309' : '#6C757D',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Bot size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: '#6C757D', fontWeight: 600 }}>Borradores por Validar</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: draftPendingCount > 0 ? '#B45309' : '#14213D' }}>
              {draftPendingCount} <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6C757D' }}>en Mis Clases</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── BARRA DE HERRAMIENTAS Y FILTROS ── */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '14px',
        padding: '1rem 1.5rem',
        border: '1px solid #E5E5E5',
        display: 'flex',
        gap: '1rem',
        alignItems: 'center',
        flexWrap: 'wrap'
      }}>
        {/* Buscador */}
        <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '11px', color: '#6C757D' }} />
          <input
            type="text"
            placeholder="Buscar por clase o actividad..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 12px 9px 38px',
              borderRadius: '8px',
              border: '1px solid #E5E5E5',
              fontSize: '0.85rem',
              outline: 'none'
            }}
          />
        </div>

        {/* Filtro Módulo */}
        {modules.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.8rem', color: '#6C757D', fontWeight: 600 }}>Módulo:</span>
            <select
              value={selectedModuleId}
              onChange={(e) => setSelectedModuleId(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #E5E5E5',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: '#14213D',
                background: '#FFFFFF',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="all">Todos los Módulos</option>
              {modules.map((m, idx) => (
                <option key={m.id} value={m.id}>
                  M{m.order_index || idx + 1}: {m.title}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Pastillas de Estado */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: 'Todas' },
            { id: 'published', label: 'Publicadas' },
            { id: 'with_responses', label: 'Con respuestas' },
            { id: 'draft_pending', label: 'Borradores pendientes' },
            { id: 'no_activity', label: 'Sin actividad' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: statusFilter === f.id ? '1px solid #14213D' : '1px solid #E5E5E5',
                background: statusFilter === f.id ? '#14213D' : '#FFFFFF',
                color: statusFilter === f.id ? '#FFFFFF' : '#6C757D',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── CUADRÍCULA DE ACTIVIDADES POR CLASE ── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#6C757D' }}>
          <RefreshCw size={32} style={{ animation: 'spin 1s linear infinite', marginBottom: '8px' }} />
          <div>Cargando actividades de reforzamiento...</div>
        </div>
      ) : filteredList.length === 0 ? (
        <div style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          padding: '3rem',
          textAlign: 'center',
          border: '1px dashed #D1D5DB'
        }}>
          <Brain size={40} color="#9CA3AF" style={{ marginBottom: '12px' }} />
          <h3 style={{ margin: '0 0 6px 0', fontSize: '1.1rem', color: '#14213D' }}>
            No se encontraron clases con ese criterio
          </h3>
          <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: '#6C757D' }}>
            Prueba ajustando los filtros de módulo o estado de actividad.
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
          gap: '1.25rem'
        }}>
          {filteredList.map(cls => {
            const isPublished = cls.actStatus === 'published';
            const isDraftPending = cls.actStatus === 'draft_pending';
            const moduleName = cls.sessions?.modules?.title || cls.subtopics?.modules?.title || 'Módulo General';

            return (
              <div
                key={cls.id}
                style={{
                  background: '#FFFFFF',
                  borderRadius: '14px',
                  border: isPublished ? '1.5px solid #E2E8F0' : isDraftPending ? '1.5px solid #FCA311' : '1px solid #E5E5E5',
                  boxShadow: isPublished ? '0 4px 12px rgba(20, 33, 61, 0.05)' : 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  transition: 'transform 0.2s, box-shadow 0.2s'
                }}
              >
                {/* Header de la Tarjeta */}
                <div style={{
                  padding: '1rem 1.25rem',
                  background: isPublished ? '#F8FAFC' : isDraftPending ? '#FFFBEB' : '#F9FAFB',
                  borderBottom: '1px solid #E5E5E5',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    color: '#64748B',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    {moduleName}
                  </span>

                  {isPublished ? (
                    <span style={{
                      background: '#DCFCE7',
                      color: '#166534',
                      padding: '3px 8px',
                      borderRadius: '12px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <CheckCheck size={12} /> Publicada y activa
                    </span>
                  ) : isDraftPending ? (
                    <span style={{
                      background: '#FEF3C7',
                      color: '#B45309',
                      padding: '3px 8px',
                      borderRadius: '12px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <Bot size={12} /> Borrador IA pendiente
                    </span>
                  ) : (
                    <span style={{
                      background: '#F1F5F9',
                      color: '#64748B',
                      padding: '3px 8px',
                      borderRadius: '12px',
                      fontSize: '0.72rem',
                      fontWeight: 600
                    }}>
                      Sin actividad IA
                    </span>
                  )}
                </div>

                {/* Cuerpo de la Tarjeta */}
                <div style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <div style={{ fontSize: '0.78rem', color: '#6C757D', marginBottom: '2px' }}>
                      {cls.class_date ? new Date(cls.class_date).toLocaleDateString('es-ES', {
                        weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
                      }) : 'Fecha por programar'}
                    </div>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#14213D', lineHeight: 1.35 }}>
                      {cls.title}
                    </h3>
                  </div>

                  {/* Actividad info */}
                  {(cls.activity || cls.draft) && (
                    <div style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: '#F8F9FA',
                      border: '1px solid #E9ECEF'
                    }}>
                      <div style={{ fontSize: '0.72rem', color: '#6C757D', fontWeight: 600, textTransform: 'uppercase' }}>
                        Actividad generada:
                      </div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#14213D' }}>
                        {cls.activity?.title || cls.draft?.draft_data?.activity_title || 'Actividad de Reforzamiento'}
                      </div>
                    </div>
                  )}

                  {/* Métricas de Participación */}
                  {isPublished ? (
                    <div style={{ marginTop: 'auto', paddingTop: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '6px' }}>
                        <span style={{ color: '#6C757D', fontWeight: 600 }}>Participación de alumnos:</span>
                        <span style={{ fontWeight: 700, color: '#14213D' }}>
                          {cls.completedCount} / {cls.totalStudents} <span style={{ color: '#FCA311' }}>({cls.participationPct}%)</span>
                        </span>
                      </div>
                      {/* Barra de progreso */}
                      <div style={{ width: '100%', height: '7px', background: '#E5E5E5', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{
                          width: `${cls.participationPct}%`,
                          height: '100%',
                          background: cls.participationPct >= 70 ? '#22C55E' : '#FCA311',
                          borderRadius: '4px'
                        }} />
                      </div>

                      {/* Promedio */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                        <span style={{ fontSize: '0.78rem', color: '#6C757D' }}>Promedio de aciertos:</span>
                        {typeof cls.avgScore === 'number' ? (
                          <span style={{
                            fontSize: '0.85rem',
                            fontWeight: 800,
                            color: cls.avgScore >= 60 ? '#166534' : '#B45309'
                          }}>
                            {cls.avgScore}%
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.78rem', color: '#9CA3AF' }}>Sin entregas aún</span>
                        )}
                      </div>
                    </div>
                  ) : isDraftPending ? (
                    <div style={{
                      marginTop: 'auto',
                      padding: '10px 12px',
                      background: '#FFFBEB',
                      borderRadius: '8px',
                      border: '1px solid #FDE68A',
                      fontSize: '0.8rem',
                      color: '#92400E'
                    }}>
                      💡 <strong>Borrador listo:</strong> La IA generó preguntas de repaso basadas en la grabación. Valídalo en la pestaña Mis Clases.
                    </div>
                  ) : (
                    <div style={{
                      marginTop: 'auto',
                      padding: '10px 12px',
                      background: '#F8F9FA',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      color: '#6C757D'
                    }}>
                      Añade la grabación de la clase en <strong>Mis Clases</strong> para que la IA genere automáticamente la actividad de reforzamiento.
                    </div>
                  )}
                </div>

                {/* Footer Acciones */}
                <div style={{
                  padding: '0.9rem 1.25rem',
                  background: '#FFFFFF',
                  borderTop: '1px solid #E5E5E5',
                  display: 'flex',
                  gap: '8px'
                }}>
                  {isPublished ? (
                    <button
                      onClick={() => setSelectedActivityForModal({ activity: cls.activity, classData: cls })}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        background: '#14213D',
                        color: '#FFFFFF',
                        border: 'none',
                        padding: '8px 14px',
                        borderRadius: '8px',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'background 0.15s'
                      }}
                    >
                      <BarChart3 size={15} color="#FCA311" /> Ver Resultados y Analítica
                    </button>
                  ) : isDraftPending ? (
                    <button
                      onClick={() => onChangeTab && onChangeTab('clases')}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        background: '#FCA311',
                        color: '#14213D',
                        border: 'none',
                        padding: '8px 14px',
                        borderRadius: '8px',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      <Sparkles size={15} /> Revisar y Validar en Mis Clases
                    </button>
                  ) : (
                    <button
                      onClick={() => onChangeTab && onChangeTab('clases')}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        background: 'transparent',
                        color: '#14213D',
                        border: '1px solid #D1D5DB',
                        padding: '8px 14px',
                        borderRadius: '8px',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      <Video size={15} /> Ir a Mis Clases
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL DE ANALÍTICA Y RESULTADOS */}
      {selectedActivityForModal && (
        <ActivityResultsModal
          activity={selectedActivityForModal.activity}
          classData={selectedActivityForModal.classData}
          onClose={() => setSelectedActivityForModal(null)}
          onGoToClass={(classId) => {
            setSelectedActivityForModal(null);
            if (onChangeTab) onChangeTab('clases');
          }}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────
   TAB — Anuncios (Premium Rewrite)
───────────────────────────────────────── */
function AnunciosTab() {
  const { id: teacherId, profile, programId } = useTeacherContext();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'mine' | 'admin'
  const [searchQuery, setSearchQuery] = useState('');

  const fetchAnnouncements = async () => {
    if (!programId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('program_id', programId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setAnnouncements(data || []);
    } catch (err) {
      console.error('Error fetching announcements:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, [programId]);

  const handleDelete = (ann) => {
    setConfirmDelete(ann);
  };

  const handleConfirmDelete = async (id) => {
    const { error } = await supabase.from('announcements').delete().eq('id', id);
    if (error) throw error;
    fetchAnnouncements();
  };

  const getTagBadge = (tag, isInstitutional = false, targetRole = 'all') => {
    if (isInstitutional) {
      return {
        bg: 'rgba(0, 122, 46, 0.08)',
        color: '#007A2E',
        borderColor: 'rgba(0, 122, 46, 0.25)',
        icon: '🏛️',
        label: 'Institucional UNAL',
        targetLabel: targetRole === 'student' ? 'Para: Estudiantes' : targetRole === 'teacher' ? 'Para: Profesores' : 'Para: Todos'
      };
    }
    switch (tag) {
      case 'urgent':
        return {
          bg: '#fee2e2',
          color: '#991b1b',
          borderColor: 'rgba(220, 38, 38, 0.3)',
          accentColor: '#dc2626',
          icon: '🔴',
          label: 'Urgente'
        };
      case 'info':
        return {
          bg: '#dbeafe',
          color: '#1e40af',
          borderColor: 'rgba(30, 64, 175, 0.25)',
          accentColor: '#2563eb',
          icon: '📌',
          label: 'Informativo'
        };
      default:
        return {
          bg: '#f1f5f9',
          color: 'var(--navy, #14213D)',
          borderColor: '#e2e8f0',
          accentColor: 'var(--navy, #14213D)',
          icon: '📢',
          label: 'General'
        };
    }
  };

  const myAnnouncements = announcements.filter(a => a.teacher_id !== null);
  const adminAnnouncements = announcements.filter(a => a.teacher_id === null);

  // Filtrado por pestaña y búsqueda
  const filteredAnnouncements = announcements.filter(ann => {
    const isMine = ann.teacher_id !== null;
    if (activeFilter === 'mine' && !isMine) return false;
    if (activeFilter === 'admin' && isMine) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = (ann.title || '').toLowerCase().includes(q);
      const matchBody = (ann.body || '').toLowerCase().includes(q);
      return matchTitle || matchBody;
    }
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      
      {/* ── ENCABEZADO Y ACCIÓN PRINCIPAL ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
        paddingBottom: '1rem',
        borderBottom: '1px solid var(--border-color, #E2E8F0)'
      }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--navy, #14213D)', margin: 0, letterSpacing: '-0.01em' }}>
            Anuncios del Curso
          </h2>
          <p style={{ color: 'var(--text-muted, #64748B)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
            Publica avisos, recordatorios y comunicados a los estudiantes inscritos.
          </p>
        </div>

        <button
          className="btn"
          onClick={() => { setSelectedAnnouncement(null); setShowModal(true); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'var(--gold, #FCA311)',
            color: 'var(--navy, #14213D)',
            border: 'none',
            fontWeight: 700,
            fontSize: '0.86rem',
            padding: '0.65rem 1.35rem',
            borderRadius: '8px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 6px rgba(252, 163, 17, 0.3)',
            transition: 'all 0.2s ease'
          }}
          onMouseOver={e => { e.currentTarget.style.background = '#e8960a'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseOut={e => { e.currentTarget.style.background = 'var(--gold, #FCA311)'; e.currentTarget.style.transform = 'translateY(0)'; }}
        >
          <Megaphone size={16} /> Crear Anuncio
        </button>
      </div>

      {/* ── BARRA DE HERRAMIENTAS: FILTROS SEGMENTADOS Y BÚSQUEDA ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        {/* Pills de filtrado */}
        <div style={{
          display: 'inline-flex',
          background: '#F1F5F9',
          padding: '4px',
          borderRadius: '10px',
          gap: '4px'
        }}>
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            style={{
              border: 'none',
              borderRadius: '7px',
              padding: '0.4rem 0.9rem',
              fontSize: '0.82rem',
              fontWeight: activeFilter === 'all' ? 700 : 500,
              background: activeFilter === 'all' ? 'var(--navy, #14213D)' : 'transparent',
              color: activeFilter === 'all' ? '#FFFFFF' : 'var(--text-muted, #64748B)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <span>Todos</span>
            <span style={{
              fontSize: '0.72rem',
              padding: '1px 6px',
              borderRadius: '9999px',
              background: activeFilter === 'all' ? 'rgba(255,255,255,0.2)' : '#E2E8F0',
              color: activeFilter === 'all' ? '#FFFFFF' : '#64748B'
            }}>
              {announcements.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('mine')}
            style={{
              border: 'none',
              borderRadius: '7px',
              padding: '0.4rem 0.9rem',
              fontSize: '0.82rem',
              fontWeight: activeFilter === 'mine' ? 700 : 500,
              background: activeFilter === 'mine' ? 'var(--navy, #14213D)' : 'transparent',
              color: activeFilter === 'mine' ? '#FFFFFF' : 'var(--text-muted, #64748B)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <span>Mis Anuncios</span>
            <span style={{
              fontSize: '0.72rem',
              padding: '1px 6px',
              borderRadius: '9999px',
              background: activeFilter === 'mine' ? 'rgba(255,255,255,0.2)' : '#E2E8F0',
              color: activeFilter === 'mine' ? '#FFFFFF' : '#64748B'
            }}>
              {myAnnouncements.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('admin')}
            style={{
              border: 'none',
              borderRadius: '7px',
              padding: '0.4rem 0.9rem',
              fontSize: '0.82rem',
              fontWeight: activeFilter === 'admin' ? 700 : 500,
              background: activeFilter === 'admin' ? 'var(--navy, #14213D)' : 'transparent',
              color: activeFilter === 'admin' ? '#FFFFFF' : 'var(--text-muted, #64748B)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <span>Institucionales</span>
            <span style={{
              fontSize: '0.72rem',
              padding: '1px 6px',
              borderRadius: '9999px',
              background: activeFilter === 'admin' ? 'rgba(255,255,255,0.2)' : '#E2E8F0',
              color: activeFilter === 'admin' ? '#FFFFFF' : '#64748B'
            }}>
              {adminAnnouncements.length}
            </span>
          </button>
        </div>

        {/* Buscador de anuncios */}
        <div style={{
          position: 'relative',
          minWidth: '240px',
          maxWidth: '340px',
          flex: '1 1 auto'
        }}>
          <Search size={16} style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#94A3B8'
          }} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar por título o contenido..."
            style={{
              width: '100%',
              padding: '0.5rem 2rem 0.5rem 2.2rem',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              background: '#FFFFFF',
              fontSize: '0.84rem',
              color: 'var(--navy, #14213D)',
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'all 0.2s ease'
            }}
            onFocus={e => { e.target.style.borderColor = 'var(--gold, #FCA311)'; e.target.style.boxShadow = '0 0 0 3px rgba(252, 163, 17, 0.15)'; }}
            onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none'; }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                color: '#94A3B8',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ── LISTADO DE ANUNCIOS ── */}
      {loading ? (
        <div style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--text-muted, #64748B)', background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
          <div style={{ width: '32px', height: '32px', border: '3px solid #E2E8F0', borderTopColor: 'var(--gold, #FCA311)', borderRadius: '50%', animation: 'liaterSpin 0.8s linear infinite', margin: '0 auto 1rem' }} />
          <span>Cargando anuncios del programa...</span>
        </div>
      ) : filteredAnnouncements.length === 0 ? (
        <div className="card" style={{
          padding: '3.5rem 2rem',
          textAlign: 'center',
          background: '#FFFFFF',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 1px 3px rgba(20, 33, 61, 0.04)'
        }}>
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: '#F1F5F9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.25rem',
            color: 'var(--navy, #14213D)'
          }}>
            <Megaphone size={28} />
          </div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--navy, #14213D)', margin: '0 0 0.5rem 0' }}>
            {searchQuery ? 'No se encontraron resultados' : 'No hay anuncios en esta sección'}
          </h3>
          <p style={{ color: 'var(--text-muted, #64748B)', fontSize: '0.88rem', margin: '0 0 1.25rem 0', maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto' }}>
            {searchQuery
              ? `No se encontró ningún anuncio que coincida con "${searchQuery}". Intenta con otros términos.`
              : activeFilter === 'mine'
                ? 'Aún no has publicado anuncios en este curso. Comparte avisos con tus estudiantes.'
                : activeFilter === 'admin'
                  ? 'No hay comunicados institucionales de la administración para este programa.'
                  : 'Crea tu primer comunicado para informar a los alumnos sobre fechas, tareas o novedades.'}
          </p>
          {searchQuery ? (
            <button
              onClick={() => setSearchQuery('')}
              className="btn btn-outline"
              style={{ fontSize: '0.82rem', padding: '0.5rem 1rem' }}
            >
              Limpiar búsqueda
            </button>
          ) : (
            <button
              onClick={() => { setSelectedAnnouncement(null); setShowModal(true); }}
              style={{
                background: 'var(--gold, #FCA311)',
                color: 'var(--navy, #14213D)',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.84rem',
                padding: '0.55rem 1.2rem',
                borderRadius: '8px',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(252, 163, 17, 0.25)'
              }}
            >
              + Crear Anuncio
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredAnnouncements.map(ann => {
            const isInstitutional = ann.teacher_id === null;
            const tagStyle = getTagBadge(ann.tag, isInstitutional, ann.target_role);

            return (
              <article
                key={ann.id}
                className="card announcement-item-card"
                style={{
                  background: '#FFFFFF',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                  borderLeft: isInstitutional
                    ? '4px solid #007A2E'
                    : ann.tag === 'urgent'
                      ? '4px solid #DC2626'
                      : ann.tag === 'info'
                        ? '4px solid #0284C7'
                        : '4px solid var(--navy, #14213D)',
                  boxShadow: '0 1px 3px rgba(20, 33, 61, 0.04)',
                  padding: '1.35rem 1.5rem',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem'
                }}
              >
                {/* Cabecera de la tarjeta: Autor, Badges y Acciones */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '1rem',
                  flexWrap: 'wrap'
                }}>
                  {/* Autor y metadatos */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: isInstitutional ? 'rgba(0, 122, 46, 0.1)' : 'rgba(20, 33, 61, 0.08)',
                      color: isInstitutional ? '#007A2E' : 'var(--navy, #14213D)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      flexShrink: 0
                    }}>
                      {isInstitutional ? '🏛️' : (profile?.name ? profile.name.charAt(0).toUpperCase() : 'P')}
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--navy, #14213D)' }}>
                          {isInstitutional ? 'Dirección Académica · UNAL' : (profile?.name ? `Prof. ${profile.name}` : 'Profesor')}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748B)' }}>
                          · {new Date(ann.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {/* Badges de clasificación */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '3px', flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: '0.73rem',
                          fontWeight: 700,
                          padding: '0.15rem 0.55rem',
                          borderRadius: '6px',
                          background: tagStyle.bg,
                          color: tagStyle.color,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          border: `1px solid ${tagStyle.borderColor}`
                        }}>
                          {tagStyle.icon} {tagStyle.label}
                        </span>

                        {isInstitutional && tagStyle.targetLabel && (
                          <span style={{
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            padding: '0.15rem 0.55rem',
                            borderRadius: '6px',
                            background: '#F1F5F9',
                            color: '#64748B'
                          }}>
                            {tagStyle.targetLabel}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Acciones para el docente (Editar / Eliminar) */}
                  {!isInstitutional && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <button
                        type="button"
                        onClick={() => { setSelectedAnnouncement(ann); setShowModal(true); }}
                        title="Editar anuncio"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          padding: '0.4rem 0.75rem',
                          borderRadius: '6px',
                          border: '1px solid #E2E8F0',
                          background: '#FFFFFF',
                          color: 'var(--navy, #14213D)',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseOver={e => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.borderColor = '#CBD5E1'; }}
                        onMouseOut={e => { e.currentTarget.style.background = '#FFFFFF'; e.currentTarget.style.borderColor = '#E2E8F0'; }}
                      >
                        <Edit3 size={14} />
                        <span>Editar</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(ann)}
                        title="Eliminar anuncio"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '0.4rem',
                          borderRadius: '6px',
                          border: '1px solid #FEE2E2',
                          background: '#FEF2F2',
                          color: '#EF4444',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseOver={e => { e.currentTarget.style.background = '#FEE2E2'; }}
                        onMouseOut={e => { e.currentTarget.style.background = '#FEF2F2'; }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Contenido del Anuncio */}
                <div style={{ marginTop: '0.25rem' }}>
                  <h3 style={{
                    margin: '0 0 0.45rem 0',
                    fontSize: '1.12rem',
                    fontWeight: 700,
                    color: 'var(--navy, #14213D)',
                    lineHeight: 1.35
                  }}>
                    {ann.title}
                  </h3>
                  <p style={{
                    margin: 0,
                    fontSize: '0.92rem',
                    color: 'var(--text-secondary, #334155)',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap'
                  }}>
                    {ann.body}
                  </p>
                </div>

                {/* Pie de tarjeta con indicador de alcance */}
                <div style={{
                  paddingTop: '0.65rem',
                  borderTop: '1px solid #F1F5F9',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: '0.76rem',
                  color: 'var(--text-muted, #64748B)'
                }}>
                  <Users size={13} style={{ opacity: 0.7 }} />
                  <span>Enviado a los estudiantes inscritos en el curso</span>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Modal de Crear / Editar Anuncio */}
      {showModal && (
        <AnnouncementModal
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

/* ─────────────────────────────────────────
   PESTAÑA: RECURSOS Y MATERIALES DEL CURSO
   Permite subir y organizar contenido general del curso (no por clase)
   y materiales asociados a clases específicas.
───────────────────────────────────────── */
function RecursosTab() {
  const { programId, currentProgram, programClasses } = useTeacherContext();
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
        if (error) console.warn('Aviso al consultar recursos en TeacherPanel:', error);
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
      console.error('Error al cargar recursos en TeacherPanel:', err);
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
            description: formDescription ? formDescription.trim() : null,
            class_id: targetDestination === 'general' ? null : targetDestination,
            program_id: programId,
            allow_download: formAllowDownload
          })
          .eq('id', editingResource.id);

        if (error) throw error;
        setModalSuccess('Material actualizado correctamente.');
        await fetchResources();
        setTimeout(() => setShowModal(false), 1200);
      } catch (err) {
        setModalError(err.message || 'Error al actualizar');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (uploadMode === 'file') {
      if (!selectedFile) {
        setModalError('Selecciona un archivo PDF para subir a Google Drive.');
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
          const updatePayload = { allow_download: formAllowDownload };
          if (formDescription) updatePayload.description = formDescription.trim();
          await supabase.from('resources').update(updatePayload).eq('id', data.resource.id);
        }

        setModalSuccess(`✓ Subido a Google Drive: "${data.formattedFileName || selectedFile.name}"`);
        await fetchResources();
        setTimeout(() => setShowModal(false), 1400);
      } catch (err) {
        setModalError('Error al subir a Google Drive: ' + (err.message || String(err)));
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
        const urlLower = formUrl.toLowerCase();
        let provider = 'external';
        if (urlLower.includes('drive.google.com')) provider = 'drive';
        else if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) provider = 'youtube';

        const { error } = await supabase.from('resources').insert([{
          title: formTitle.trim(),
          resource_type: formType,
          url: formUrl.trim(),
          description: formDescription ? formDescription.trim() : null,
          class_id: targetDestination === 'general' ? null : targetDestination,
          program_id: programId,
          provider,
          is_visible: true,
          allow_download: formAllowDownload
        }]);

        if (error) throw error;
        setModalSuccess('Material añadido exitosamente.');
        await fetchResources();
        setTimeout(() => setShowModal(false), 1200);
      } catch (err) {
        setModalError(err.message || 'Error al guardar');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleDelete = async (r) => {
    const isDrive = r.provider === 'drive' || r.url?.includes('drive.google.com');
    const confirmMsg = isDrive
      ? `¿Eliminar permanentemente "${r.title}"? También se eliminará el archivo en Google Drive.`
      : `¿Eliminar "${r.title}"?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      if (isDrive && r.url) {
        try {
          await supabase.functions.invoke('upload-pdf-drive', {
            body: { action: 'delete', fileUrl: r.url, resourceId: r.id }
          });
        } catch (_) {}
      }
      const { error } = await supabase.from('resources').delete().eq('id', r.id);
      if (error) throw error;
      await fetchResources();
    } catch (err) {
      alert('Error eliminando: ' + err.message);
    }
  };

  const handleToggleVis = async (r) => {
    try {
      const nextVis = !(r.is_visible ?? true);
      const { error } = await supabase.from('resources').update({ is_visible: nextVis }).eq('id', r.id);
      if (error) throw error;
      await fetchResources();
    } catch (err) {
      alert('Error cambiando visibilidad: ' + err.message);
    }
  };

  const handleToggleAllowDownload = async (r) => {
    try {
      const nextAllow = !(r.allow_download ?? false);
      const { error } = await supabase
        .from('resources')
        .update({ allow_download: nextAllow })
        .eq('id', r.id);
      if (error) throw error;
      await fetchResources();
    } catch (err) {
      alert('Error cambiando permiso de descarga: ' + err.message);
    }
  };

  return (
    <div style={{ padding: '0.5rem 0' }}>
      {/* ── ENCABEZADO DE PESTAÑA ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--navy, #14213D)', margin: 0 }}>
            Material y Contenido del Curso
          </h2>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.86rem', color: '#64748B' }}>
            Gestiona el contenido general que aplica a todo el programa (guías, software, bibliografía) y las presentaciones por clase.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => handleOpenUpload('general')}
            style={{
              background: 'var(--gold, #FCA311)',
              color: 'var(--navy, #14213D)',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.84rem',
              padding: '0.55rem 1.15rem',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              boxShadow: '0 2px 8px rgba(252, 163, 17, 0.3)'
            }}
          >
            <Plus size={16} />
            <span>+ Subir Contenido General</span>
          </button>

          <Link
            to={`/resources/${programId}`}
            className="btn btn-outline"
            style={{ fontSize: '0.82rem', padding: '0.5rem 0.95rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Eye size={14} />
            <span>Ver Vista de Estudiantes</span>
          </Link>
        </div>
      </div>

      {/* ── RESUMEN MÉTRICAS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: '#FFFFFF', padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(252, 163, 17, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gold-dark, #b45309)' }}>
            <Paperclip size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--navy, #14213D)' }}>{resources.length}</div>
            <div style={{ fontSize: '0.76rem', color: '#64748B', fontWeight: 600 }}>Total de Materiales</div>
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
        marginBottom: '1.5rem',
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
              placeholder="Buscar por título, contenido o clase..."
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
                  fontSize: '0.78rem',
                  fontWeight: scopeFilter === f.id ? 700 : 500,
                  background: scopeFilter === f.id ? 'var(--navy, #14213D)' : '#F1F5F9',
                  color: scopeFilter === f.id ? '#FFFFFF' : 'var(--navy, #14213D)',
                  cursor: 'pointer'
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── LISTADO DE RECURSOS ── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#64748B' }}>
          <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 0.5rem' }} />
          <span>Cargando materiales del curso...</span>
        </div>
      ) : filteredResources.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '3rem 1.5rem', background: '#FFFFFF',
          borderRadius: '14px', border: '1px dashed #CBD5E1'
        }}>
          <FolderDown size={36} color="#94A3B8" style={{ margin: '0 auto 0.5rem' }} />
          <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--navy, #14213D)', fontWeight: 700 }}>
            {resources.length === 0 ? 'No has subido ningún material aún' : 'No hay recursos con los filtros aplicados'}
          </h3>
          <p style={{ margin: '0.3rem 0 1.25rem 0', fontSize: '0.84rem', color: '#64748B' }}>
            Comienza subiendo la guía docente, bibliografía general o presentaciones de las sesiones.
          </p>
          <button
            type="button"
            onClick={() => handleOpenUpload('general')}
            className="btn btn-primary"
            style={{ fontSize: '0.82rem', padding: '0.5rem 1.1rem' }}
          >
            <Plus size={14} /> Subir Contenido General
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

          {/* BLOQUE: CONTENIDO GENERAL */}
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
                        padding: '1.1rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '0.85rem'
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
                            <span style={{ fontSize: '0.68rem', fontWeight: 600, color: '#64748B' }}>
                              {r.resource_type || r.type}
                            </span>
                          </div>
                        </div>
                        <h4 style={{ margin: '0 0 0.3rem 0', fontSize: '0.94rem', fontWeight: 700, color: 'var(--navy, #14213D)' }}>
                          {r.title}
                        </h4>
                        {r.description && (
                          <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748B', lineHeight: 1.4 }}>
                            {r.description}
                          </p>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.65rem', borderTop: '1px solid #F1F5F9' }}>
                        <button
                          type="button"
                          onClick={() => {
                            if (r.url?.includes('drive.google.com') || r.provider === 'drive') {
                              setSelectedDoc(r);
                            } else {
                              window.open(r.url, '_blank', 'noopener,noreferrer');
                            }
                          }}
                          style={{
                            background: 'var(--navy, #14213D)', color: '#FFFFFF', border: 'none',
                            borderRadius: '6px', padding: '0.4rem 0.75rem', fontSize: '0.76rem', fontWeight: 700,
                            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.35rem'
                          }}
                        >
                          <Eye size={13} color="#FCA311" /> Abrir
                        </button>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <button
                            type="button"
                            onClick={() => handleToggleAllowDownload(r)}
                            title={r.allow_download ? 'Descarga permitida a estudiantes (Clic para bloquear)' : 'Descarga bloqueada a estudiantes (Clic para permitir)'}
                            style={{
                              background: r.allow_download ? '#DCFCE7' : '#F1F5F9',
                              border: `1px solid ${r.allow_download ? '#86EFAC' : '#E2E8F0'}`,
                              borderRadius: '6px', padding: '0.4rem',
                              cursor: 'pointer', color: r.allow_download ? '#15803D' : '#94A3B8'
                            }}
                          >
                            <Download size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleVis(r)}
                            title={r.is_visible !== false ? 'Ocultar a estudiantes' : 'Hacer visible'}
                            style={{ background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '0.4rem', cursor: 'pointer', color: '#64748B' }}
                          >
                            {r.is_visible !== false ? <Eye size={13} /> : <EyeOff size={13} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(r)}
                            title="Editar"
                            style={{ background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '0.4rem', cursor: 'pointer', color: 'var(--navy)' }}
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(r)}
                            title="Eliminar"
                            style={{ background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: '6px', padding: '0.4rem', cursor: 'pointer', color: '#DC2626' }}
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

          {/* BLOQUE: MATERIALES POR CLASE */}
          {(scopeFilter === 'all' || scopeFilter === 'classes') && (
            <div>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: '0.85rem', paddingBottom: '0.4rem', borderBottom: '1px solid #E2E8F0'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Video size={18} color="var(--navy, #14213D)" />
                  <h3 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 800, color: 'var(--navy, #14213D)' }}>
                    Materiales por Clase ({filteredClass.length})
                  </h3>
                </div>
              </div>

              {filteredClass.length === 0 ? (
                <div style={{ padding: '1.25rem', background: '#FAFBFD', borderRadius: '10px', border: '1px dashed #CBD5E1', fontSize: '0.84rem', color: '#64748B' }}>
                  No hay materiales asignados a clases específicas.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))', gap: '1rem' }}>
                  {filteredClass.map(r => (
                    <div
                      key={r.id}
                      style={{
                        background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0',
                        padding: '1.1rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '0.85rem'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                          <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 7px', borderRadius: '6px', background: '#EFF6FF', color: '#1D4ED8' }}>
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
                            <span style={{ fontSize: '0.68rem', fontWeight: 600, color: '#64748B' }}>
                              {r.resource_type || r.type}
                            </span>
                          </div>
                        </div>
                        <h4 style={{ margin: '0 0 0.3rem 0', fontSize: '0.94rem', fontWeight: 700, color: 'var(--navy, #14213D)' }}>
                          {r.title}
                        </h4>
                        {r.description && (
                          <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748B', lineHeight: 1.4 }}>
                            {r.description}
                          </p>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.65rem', borderTop: '1px solid #F1F5F9' }}>
                        <button
                          type="button"
                          onClick={() => {
                            if (r.url?.includes('drive.google.com') || r.provider === 'drive') {
                              setSelectedDoc(r);
                            } else {
                              window.open(r.url, '_blank', 'noopener,noreferrer');
                            }
                          }}
                          style={{
                            background: 'var(--navy, #14213D)', color: '#FFFFFF', border: 'none',
                            borderRadius: '6px', padding: '0.4rem 0.75rem', fontSize: '0.76rem', fontWeight: 700,
                            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.35rem'
                          }}
                        >
                          <Eye size={13} color="#FCA311" /> Abrir
                        </button>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <button
                            type="button"
                            onClick={() => handleToggleAllowDownload(r)}
                            title={r.allow_download ? 'Descarga permitida a estudiantes (Clic para bloquear)' : 'Descarga bloqueada a estudiantes (Clic para permitir)'}
                            style={{
                              background: r.allow_download ? '#DCFCE7' : '#F1F5F9',
                              border: `1px solid ${r.allow_download ? '#86EFAC' : '#E2E8F0'}`,
                              borderRadius: '6px', padding: '0.4rem',
                              cursor: 'pointer', color: r.allow_download ? '#15803D' : '#94A3B8'
                            }}
                          >
                            <Download size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleVis(r)}
                            title={r.is_visible !== false ? 'Ocultar a estudiantes' : 'Hacer visible'}
                            style={{ background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '0.4rem', cursor: 'pointer', color: '#64748B' }}
                          >
                            {r.is_visible !== false ? <Eye size={13} /> : <EyeOff size={13} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(r)}
                            title="Editar"
                            style={{ background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '0.4rem', cursor: 'pointer', color: 'var(--navy)' }}
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(r)}
                            title="Eliminar"
                            style={{ background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: '6px', padding: '0.4rem', cursor: 'pointer', color: '#DC2626' }}
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

      {/* ── MODAL DE SUBIDA / EDICIÓN ── */}
      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem'
        }}>
          <div style={{
            background: '#FFFFFF', borderRadius: '16px', width: '100%', maxWidth: '540px',
            maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 40px rgba(0,0,0,0.25)', animation: 'fadeSlideUp 0.2s ease-out'
          }}>
            <div style={{
              padding: '1.1rem 1.4rem', borderBottom: '1px solid #E2E8F0',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FAFBFD'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{ padding: '6px', borderRadius: '8px', background: 'rgba(252, 163, 17, 0.15)', color: 'var(--gold-dark, #b45309)' }}>
                  {modalMode === 'edit' ? <Edit3 size={18} /> : <Plus size={18} />}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--navy, #14213D)' }}>
                    {modalMode === 'edit' ? 'Editar Material' : 'Subir Contenido al Curso'}
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                    {targetDestination === 'general' ? 'Se publicará en Contenido General del Curso' : 'Se vinculará a la clase seleccionada'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94A3B8' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: '1.4rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              {modalError && (
                <div style={{ padding: '0.75rem', borderRadius: '8px', background: '#FEE2E2', border: '1px solid #FECACA', color: '#B91C1C', fontSize: '0.82rem' }}>
                  {modalError}
                </div>
              )}
              {modalSuccess && (
                <div style={{ padding: '0.75rem', borderRadius: '8px', background: '#DCFCE7', border: '1px solid #BBF7D0', color: '#15803D', fontSize: '0.82rem' }}>
                  {modalSuccess}
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
                      e.preventDefault(); setIsDragOver(false);
                      const f = e.dataTransfer.files?.[0];
                      if (f) {
                        setSelectedFile(f);
                        if (!formTitle.trim()) setFormTitle(f.name.replace(/\.[^/.]+$/, ''));
                      }
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: isDragOver ? '2px dashed var(--gold, #FCA311)' : '2px dashed #CBD5E1',
                      background: isDragOver ? 'rgba(252, 163, 17, 0.05)' : '#F8FAFC',
                      borderRadius: '10px', padding: '1.4rem', textAlign: 'center', cursor: 'pointer'
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
                          if (!formTitle.trim()) setFormTitle(f.name.replace(/\.[^/.]+$/, ''));
                        }
                      }}
                    />
                    <Upload size={24} color={selectedFile ? 'var(--gold, #FCA311)' : '#94A3B8'} style={{ margin: '0 auto 0.4rem' }} />
                    {selectedFile ? (
                      <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--navy, #14213D)' }}>
                        {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.82rem', color: '#64748B' }}>
                        Haz clic o arrastra un archivo PDF aquí
                      </span>
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
                  placeholder={uploadMode === 'file' ? 'Opcional (toma el nombre del archivo)' : 'Ej: Guía docente del curso, Enlace a Google Colab...'}
                  style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.84rem', outline: 'none', background: '#FAFBFD' }}
                />
              </div>

              {/* URL */}
              {(modalMode === 'edit' || uploadMode === 'link') && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy, #14213D)', marginBottom: '0.4rem' }}>
                    URL / Enlace Web <span style={{ color: '#DC2626' }}>*</span>
                  </label>
                  <input
                    type="url"
                    value={formUrl}
                    onChange={e => setFormUrl(e.target.value)}
                    placeholder="https://..."
                    style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.84rem', outline: 'none', background: '#FAFBFD' }}
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
                  placeholder="Instrucciones breves sobre cómo utilizar este material..."
                  style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.82rem', outline: 'none', background: '#FAFBFD' }}
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

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  disabled={isSubmitting}
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
                      <span>{uploadMode === 'file' ? 'Subiendo a Drive...' : 'Guardando...'}</span>
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      <span>{modalMode === 'edit' ? 'Guardar Cambios' : 'Publicar Material'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL VISOR ── */}
      {selectedDoc && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(5px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem'
        }}>
          <div style={{
            background: '#FFFFFF', borderRadius: '16px', width: '100%', maxWidth: '1050px',
            height: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden'
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

const TABS = [
  { id: 'resumen',      label: 'Panorama del Curso',        icon: <BookOpen size={16} />,        component: ResumenTab },
  { id: 'clases',       label: 'Mis Clases',                icon: <Video size={16} />,           component: ClasesTab },
  { id: 'recursos',     label: 'Material del Curso',        icon: <Paperclip size={16} />,       component: RecursosTab },
  { id: 'reforzamiento',label: 'Reforzamiento IA',          icon: <Brain size={16} />,           component: ReforzamientoIATab },
  { id: 'dudas',        label: 'Dudas',                     icon: <MessageSquare size={16} />,   component: DudasTab },
  { id: 'anuncios',     label: 'Anuncios',                  icon: <Megaphone size={16} />,       component: AnunciosTab },
  { id: 'estudiantes',  label: 'Estudiantes',               icon: <Users size={16} />,           component: EstudiantesTab },
];

export default function TeacherPanel() {
  const { currentUser } = useAuth();
  const { programId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('resumen');
  const [teacherProfile, setTeacherProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [currentProgram, setCurrentProgram] = useState(null);
  const [programClasses, setProgramClasses] = useState([]);
  const [myPrograms, setMyPrograms] = useState([]);
  const [nowTime, setNowTime] = useState(Date.now());
  const role = currentUser?.role;

  // Actualizar temporizador cada 30 segundos para recalcular la ventana de 10 minutos
  useEffect(() => {
    const timer = setInterval(() => setNowTime(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const tabFromUrl = searchParams.get('tab');
    setActiveTab(tabFromUrl || 'resumen');
  }, [searchParams]);

  // Función centralizada de cambio de pestaña con soporte de deep-link a duda específica
  const handleChangeTab = (tabId, doubtId = null) => {
    setActiveTab(tabId);
    if (doubtId) {
      setSearchParams({ tab: tabId, doubtId });
    } else {
      setSearchParams({ tab: tabId });
    }
  };

  // Resolver el teacher_profile.id real y obtener datos del programa
  useEffect(() => {
    async function resolveTeacherProfile() {
      if (!currentUser?.id) return;
      try {
        const { data } = await supabase
          .from('teacher_profiles')
          .select('*, users_profile(email)')
          .eq('user_id', currentUser.id)
          .maybeSingle();
        if (data) setTeacherProfile(data);
      } catch (err) {
        console.error('Error al resolver teacher_profile:', err);
      } finally {
        setProfileLoading(false);
      }
    }

    async function fetchProgramDetails() {
      if (!programId) return;
      try {
        const { data } = await supabase
          .from('diploma_programs')
          .select('*')
          .eq('id', programId)
          .maybeSingle();
        if (data) setCurrentProgram(data);

        // Cargar clases del programa para determinar si hay clase en vivo activa (faltando 10 min o en curso)
        const { data: clsData } = await supabase
          .from('class_sessions')
          .select('id, title, class_date, duration, meet_url, video_url')
          .eq('program_id', programId);
        if (clsData) setProgramClasses(clsData);
      } catch (err) {
        console.error('Error al obtener programa:', err);
      }
    }

    async function fetchAllPrograms() {
      try {
        // 1. Obtener teacher_profile.id del usuario actual
        const { data: profileData } = await supabase
          .from('teacher_profiles')
          .select('id')
          .eq('user_id', currentUser.id)
          .maybeSingle();
        const tId = profileData?.id;

        // 2. Obtener programas desde enrollments (asignación directa de administrador)
        const { data: enrollRows } = await supabase
          .from('enrollments')
          .select('program_id')
          .eq('student_id', currentUser.id);

        const enrollProgIds = (enrollRows || []).map(r => r.program_id).filter(Boolean);

        // 3. Obtener programas donde el profesor tiene clases asignadas en class_sessions
        let classProgIds = [];
        if (tId) {
          const { data: classRows } = await supabase
            .from('class_sessions')
            .select('program_id')
            .eq('teacher_id', tId);
          classProgIds = (classRows || []).map(r => r.program_id).filter(Boolean);
        }

        const uniqueProgramIds = [...new Set([...enrollProgIds, ...classProgIds])];
        if (uniqueProgramIds.length === 0) return;

        const { data } = await supabase
          .from('diploma_programs')
          .select('*')
          .in('id', uniqueProgramIds)
          .order('title', { ascending: true });
        if (data) setMyPrograms(data);
      } catch (err) {
        console.error('Error al obtener lista de programas del profesor:', err);
      }
    }

    resolveTeacherProfile();
    fetchProgramDetails();
    fetchAllPrograms();

    // Suscripción en tiempo real a las sesiones de clase del programa
    if (!programId) return;
    const channel = supabase
      .channel(`teacher_program_classes_${programId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'class_sessions', filter: `program_id=eq.${programId}` }, () => {
        fetchProgramDetails();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id, programId]);

  if (role !== 'teacher') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem', color: 'var(--text-muted)' }}>
        <ShieldAlert size={48} color="#ca8a04" />
        <h2 style={{ color: 'var(--text-dark)' }}>Acceso Denegado</h2>
        <p>Este panel es exclusivo para profesores.</p>
      </div>
    );
  }

  if (profileLoading) {
    return <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando tu perfil de profesor...</div>;
  }

  if (!teacherProfile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem', color: 'var(--text-muted)' }}>
        <ShieldAlert size={48} color="#dc2626" />
        <h2 style={{ color: 'var(--text-dark)' }}>Perfil no configurado</h2>
        <p>Tu cuenta no tiene un perfil de profesor vinculado. Contacta con el administrador.</p>
      </div>
    );
  }

  const ActiveComponent = TABS.find(t => t.id === activeTab)?.component ?? ResumenTab;

  const activeLiveClass = programClasses.find(c => isClassLiveOrSoon(c, 10));
  const activeLiveMeetUrl = activeLiveClass ? (activeLiveClass.meet_url || currentProgram?.meet_url) : null;

  return (
    <TeacherContext.Provider value={{ id: teacherProfile.id, teacherId: teacherProfile.id, profile: teacherProfile, setProfile: setTeacherProfile, programId, currentProgram, programClasses, activeLiveClass, activeLiveMeetUrl }}>
      <div>

        {/* ALERTA DE PROGRAMA INHABILITADO */}
        {currentProgram && (currentProgram.is_published === false || currentProgram.status === 'draft' || currentProgram.status === 'disabled') && (
          <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b', padding: '0.85rem 1.25rem', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: 600, fontSize: '0.88rem' }}>
            <AlertCircle size={20} color="#dc2626" style={{ flexShrink: 0 }} />
            <span>Este programa se encuentra inhabilitado por la administración. Los estudiantes no pueden acceder ni reciben notificaciones ni fechas de este curso.</span>
          </div>
        )}

        {/* --- RUTA DE NAVEGACIÓN (BREADCRUMB) Y ACCIONES DE PROGRAMA --- */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem', color: 'var(--text-muted)', fontWeight: 500 }}>
            <Link to="/portal" style={{ color: 'var(--text-muted)', textDecoration: 'none' }} onMouseOver={e => e.currentTarget.style.color = 'var(--gold)'} onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted)'}>
              Mis programas
            </Link>
            <span>/</span>
            {myPrograms.length > 1 ? (
              <select
                value={programId}
                onChange={e => navigate(`/dashboard/profesor/${e.target.value}`)}
                aria-label="Seleccionar programa"
                style={{
                  padding: '0.3rem 0.6rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: '#ffffff',
                  color: 'var(--navy)',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  outline: 'none',
                  maxWidth: '320px'
                }}
              >
                {myPrograms.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.title} ({p.program_type === 'curso' ? 'Curso' : p.program_type === 'taller' ? 'Taller' : 'Diplomado'})
                  </option>
                ))}
              </select>
            ) : (
              <span style={{ color: 'var(--navy)', fontWeight: 700 }}>
                {currentProgram?.title || 'Cargando programa...'}
              </span>
            )}
            {currentProgram && (currentProgram.is_published === false || currentProgram.status === 'draft' || currentProgram.status === 'disabled') && (
              <span className="badge" style={{ backgroundColor: '#fee2e2', color: '#dc2626', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', marginLeft: '0.5rem' }}>
                INHABILITADO
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {activeLiveMeetUrl && (
              <a
                href={activeLiveMeetUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  background: '#FCA311',
                  color: '#14213D',
                  padding: '0.45rem 1rem',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  boxShadow: '0 2px 4px rgba(252,163,17,0.2)',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <Video size={16} /> Unirse a la sesión en vivo
              </a>
            )}
          </div>
        </div>

        <ActiveComponent onChangeTab={handleChangeTab} />
      </div>
    </TeacherContext.Provider>
  );
}




