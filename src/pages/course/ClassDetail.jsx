import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { createDoubt, fetchStudentDoubtsForClass } from '@/services/doubtService';
import { calculateProgramProgressDetails } from '@/services/programService';
import { isClassLiveOrSoon, formatClassDate } from '@/utils/dateUtils';
import { safeJsonParse, safeSetItem, safeRemoveItem } from '@/utils/storageUtils';
import { triggerResourceDownload } from '@/utils/resourceUtils';
import {
  Download, FileText, Video, Calendar, User, ExternalLink,
  Paperclip, Presentation, ArrowLeft, ArrowRight, Clock, Award, HelpCircle,
  Send, CheckCircle2, BookOpen, X, Info, AlertCircle, FileCheck,
  MessageSquare, Check, Lock, RotateCcw, Zap, Radio, Eye,
  Plus, Pencil, Trash2, Shield, Upload, RefreshCw
} from 'lucide-react';
import AdminClassReinforcement from '@/components/admin/AdminClassReinforcement';

function formatEmbedDocUrl(url) {
  if (!url) return '';
  let trimmed = url.trim();
  if (trimmed.includes('drive.google.com')) {
    if (trimmed.includes('/preview')) return trimmed;
    return trimmed.replace(/\/view.*$/, '/preview').replace(/\/edit.*$/, '/preview');
  }
  return trimmed;
}

function formatEmbedVideoUrl(url) {
  if (!url) return null;
  let trimmed = url.trim();

  // YouTube Shorts
  if (trimmed.includes('youtube.com/shorts/')) {
    const videoId = trimmed.split('youtube.com/shorts/')[1]?.split('?')[0]?.split('&')[0];
    if (videoId) return `https://www.youtube.com/embed/${videoId}`;
  }

  // YouTube watch / youtu.be
  if (trimmed.includes('youtube.com/watch')) {
    try {
      const urlObj = new URL(trimmed);
      const videoId = urlObj.searchParams.get('v');
      if (videoId) return `https://www.youtube.com/embed/${videoId}`;
    } catch (e) {
      const match = trimmed.match(/[?&]v=([^&]+)/);
      if (match) return `https://www.youtube.com/embed/${match[1]}`;
    }
  }
  if (trimmed.includes('youtu.be/')) {
    const videoId = trimmed.split('youtu.be/')[1]?.split('?')[0]?.split('&')[0];
    if (videoId) return `https://www.youtube.com/embed/${videoId}`;
  }

  // Google Drive
  if (trimmed.includes('drive.google.com') && (trimmed.includes('/view') || trimmed.includes('/edit'))) {
    return trimmed.replace(/\/view.*$/, '/preview').replace(/\/edit.*$/, '/preview');
  }

  // Vimeo
  if (trimmed.includes('vimeo.com/') && !trimmed.includes('player.vimeo.com')) {
    const videoId = trimmed.split('vimeo.com/')[1]?.split('?')[0]?.split('#')[0];
    if (videoId) return `https://player.vimeo.com/video/${videoId}`;
  }

  // Loom
  if (trimmed.includes('loom.com/share/')) {
    const videoId = trimmed.split('loom.com/share/')[1]?.split('?')[0];
    if (videoId) return `https://www.loom.com/embed/${videoId}`;
  }

  return trimmed;
}

function PrivateVideoPlayer({ videoUrl, title, studentName }) {
  const iframeRef = useRef(null);
  const realEmbedUrl = formatEmbedVideoUrl(videoUrl);
  const isGoogleDrive = realEmbedUrl.includes('drive.google.com');
  const isYouTube = realEmbedUrl.includes('youtube.com') || realEmbedUrl.includes('youtu.be');

  useEffect(() => {
    if (!iframeRef.current || !videoUrl) return;

    if (isGoogleDrive || isYouTube) {
      // Google Drive y YouTube bloquean iframes dentro de URLs blob: por políticas de cookies u origen.
      // Así que lo montamos directamente en el iframe.
      iframeRef.current.src = realEmbedUrl;
      return;
    }

    const obfuscatedUrl = btoa(encodeURIComponent(realEmbedUrl || ''));
    
    // Documento en memoria que descifra la URL vía JS dinámico sin escribir jamás "src=https://..." en el código HTML
    const blobHtml = `
      <!DOCTYPE html>
      <html lang="es">
        <head>
          <meta charset="utf-8">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            html, body { width: 100%; height: 100%; overflow: hidden; background: #000; user-select: none; }
            iframe { width: 100%; height: 100%; border: none; }
            .popout-mask {
              position: absolute;
              top: 0;
              right: 0;
              width: 100px;
              height: 75px;
              z-index: 999999;
              background: transparent;
              cursor: default;
            }
          </style>
        </head>
        <body>
          <iframe 
            id="streamPlayer" 
            title="${title ? title.replace(/"/g, '&quot;') : 'Reproductor Protegido'}"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
            allowfullscreen
          ></iframe>
          <div class="popout-mask" onclick="event.preventDefault(); event.stopPropagation();"></div>

          <script>
            (function() {
              // Desactivar menú contextual en el marco del reproductor
              document.addEventListener('contextmenu', function(e) { e.preventDefault(); return false; });

              // Carga dinámica en memoria del video
              var obfuscated = "${obfuscatedUrl}";
              try {
                var streamUrl = decodeURIComponent(atob(obfuscated));
                var player = document.getElementById("streamPlayer");
                if (player) {
                  try {
                    player.contentWindow.location.replace(streamUrl);
                  } catch(err) {
                    player.src = streamUrl;
                  }
                }
              } catch(err) {
                console.error("Stream init error");
              }
            })();
          </script>
        </body>
      </html>
    `;

    const blob = new Blob([blobHtml], { type: 'text/html' });
    const blobUrl = URL.createObjectURL(blob);
    iframeRef.current.src = blobUrl;

    return () => {
      URL.revokeObjectURL(blobUrl);
    };
  }, [videoUrl, title, realEmbedUrl, isGoogleDrive]);

  return (
    <div 
      onContextMenu={(e) => e.preventDefault()}
      style={{ 
        position: 'relative', 
        paddingBottom: '56.25%', 
        height: 0, 
        overflow: 'hidden', 
        borderRadius: 'var(--radius-lg)', 
        background: '#000',
        userSelect: 'none',
        WebkitUserSelect: 'none'
      }}
    >
      <iframe
        ref={iframeRef}
        title={title}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />

      {/* MARCA DE AGUA DINÁMICA ANTI-PIRATERÍA CON EL NOMBRE/USUARIO DEL ALUMNO */}
      {studentName && (
        <div style={{
          position: 'absolute', bottom: '14px', left: '16px', zIndex: 25,
          pointerEvents: 'none', userSelect: 'none',
          background: 'rgba(0, 0, 0, 0.55)', color: 'rgba(255, 255, 255, 0.75)',
          padding: '4px 10px', borderRadius: '12px', fontSize: '0.74rem',
          fontWeight: 600, backdropFilter: 'blur(4px)', letterSpacing: '0.02em'
        }}>
          🔒 LIATER • {studentName}
        </div>
      )}

      {/* MÁSCARA EXTERNA DE SEGURIDAD CONTRA BOTÓN POP-OUT */}
      <div 
        style={{ 
          position: 'absolute', 
          top: 0, 
          right: 0, 
          width: '90px', 
          height: '70px', 
          zIndex: 30, 
          background: 'transparent',
          cursor: 'default'
        }} 
        onContextMenu={(e) => e.preventDefault()}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
      />
    </div>
  );
}

export default function ClassDetail() {
  const params = useParams();
  const rawId = params['*'] || params.id || '';
  // Limpiar cualquier barra o traducción automática (/c/ -> 7c) en la URL
  const id = rawId.replace(/^\//, '').replace(/\/c\//g, '7c').replace(/\//g, '').trim();
  const { currentUser } = useAuth();
  
  const [clsData, setClsData] = useState(null);
  const [topic, setTopic] = useState('');
  const [moduleTitle, setModuleTitle] = useState('');
  const [moduleId, setModuleId] = useState(null);
  const [resources, setResources] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [programType, setProgramType] = useState(null);
  const [programMeetUrl, setProgramMeetUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [programProgressDetails, setProgramProgressDetails] = useState(null);

  const [activityConfig, setActivityConfig] = useState(null);
  const [activityState, setActivityState] = useState('no_configurada'); // 'no_configurada' | 'bloqueada' | 'no_iniciada' | 'en_progreso' | 'completada' | 'vencida'

  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [showConfirmFinishModal, setShowConfirmFinishModal] = useState(false);
  const [completedResult, setCompletedResult] = useState(null);
  const [userAttempts, setUserAttempts] = useState([]);
  const [viewingResultsMode, setViewingResultsMode] = useState(false);
  const [nowTime, setNowTime] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowTime(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  // ── ESTADOS Y FUNCIONES DE GESTIÓN ADMINISTRATIVA Y DOCENTE ──
  const isAdmin = currentUser?.role === 'admin';
  const isTeacher = currentUser?.role === 'teacher';
  const isTeacherOrAdmin = isAdmin || isTeacher;
  const canManageContent = isAdmin || isTeacher;

  // Recursos (Materiales)
  const [isResourceModalOpen, setIsResourceModalOpen] = useState(false);
  const [resourceModalMode, setResourceModalMode] = useState('create'); // 'create' | 'edit'
  const [editingResource, setEditingResource] = useState(null);
  const [resActiveTab, setResActiveTab] = useState('upload'); // 'upload' | 'link'
  const [resFormTitle, setResFormTitle] = useState('');
  const [resFormUrl, setResFormUrl] = useState('');
  const [resFormType, setResFormType] = useState('presentation'); // 'presentation' | 'file' | 'link' | 'code'
  const [resFormDescription, setResFormDescription] = useState('');
  const [uploadPdfFile, setUploadPdfFile] = useState(null);
  const [isDragOverPdf, setIsDragOverPdf] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [resFormError, setResFormError] = useState('');
  const [resFormSuccess, setResFormSuccess] = useState('');
  const [resFormAllowDownload, setResFormAllowDownload] = useState(false);

  // Eliminación de recursos
  const [resourceToDelete, setResourceToDelete] = useState(null);
  const [isDeletingResource, setIsDeletingResource] = useState(false);

  // Grabación (Video)
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [videoInputUrl, setVideoInputUrl] = useState('');
  const [isSavingVideo, setIsSavingVideo] = useState(false);
  const [videoModalError, setVideoModalError] = useState('');

  // Actividad con IA (Modal Admin)
  const [isAdminReinforcementOpen, setIsAdminReinforcementOpen] = useState(false);

  // Edición rápida de clase
  const [isEditClassModalOpen, setIsEditClassModalOpen] = useState(false);
  const [editClassTitle, setEditClassTitle] = useState('');
  const [editClassDate, setEditClassDate] = useState('');
  const [editClassDuration, setEditClassDuration] = useState('');
  const [isSavingClass, setIsSavingClass] = useState(false);
  const [editClassError, setEditClassError] = useState('');

  // Dudas de todos los estudiantes (para admin)
  const [allClassDoubts, setAllClassDoubts] = useState([]);

  const fetchResources = async () => {
    try {
      const { data, error } = await supabase
        .from('resources')
        .select('*')
        .eq('class_id', id)
        .order('created_at', { ascending: true });
      if (!error && data) {
        setResources(data);
      }
    } catch (err) {
      console.error('Error fetching resources:', err);
    }
  };

  const openCreateResourceModal = () => {
    setResourceModalMode('create');
    setEditingResource(null);
    setResActiveTab('upload');
    setResFormTitle('');
    setResFormUrl('');
    setResFormType('presentation');
    setResFormDescription('');
    setResFormAllowDownload(false);
    setUploadPdfFile(null);
    setResFormError('');
    setResFormSuccess('');
    setIsResourceModalOpen(true);
  };

  const openEditResourceModal = (res) => {
    setResourceModalMode('edit');
    setEditingResource(res);
    setResActiveTab('link');
    setResFormTitle(res.title || '');
    setResFormUrl(res.url || '');
    setResFormType(res.resource_type || res.type || 'presentation');
    setResFormDescription(res.description || '');
    setResFormAllowDownload(Boolean(res.allow_download));
    setUploadPdfFile(null);
    setResFormError('');
    setResFormSuccess('');
    setIsResourceModalOpen(true);
  };

  const handleToggleResourceDownload = async (res) => {
    try {
      const nextVal = !(res.allow_download ?? false);
      const { error } = await supabase
        .from('resources')
        .update({ allow_download: nextVal })
        .eq('id', res.id);
      if (error) throw error;
      await fetchResources();
    } catch (err) {
      alert('Error cambiando permiso de descarga: ' + err.message);
    }
  };

  const handleSubmitResource = async (e) => {
    e.preventDefault();
    setResFormError('');
    setResFormSuccess('');

    if (resActiveTab === 'upload') {
      if (!uploadPdfFile) {
        setResFormError('Por favor selecciona o arrastra un archivo PDF.');
        return;
      }
      setUploadingPdf(true);
      try {
        const formData = new FormData();
        formData.append('file', uploadPdfFile);
        formData.append('classId', id);
        formData.append('programId', clsData?.program_id || '');
        formData.append('resourceType', resFormType || 'presentation');
        formData.append('allowDownload', String(resFormAllowDownload));
        if (resFormTitle.trim()) {
          formData.append('customTitle', resFormTitle.trim());
        }

        const { data, error } = await supabase.functions.invoke('upload-pdf-drive', {
          body: formData,
        });

        if (error) {
          let msg = error.message;
          try {
            if (error.context && typeof error.context.json === 'function') {
              const b = await error.context.json();
              if (b?.error) msg = b.error;
            }
          } catch (_) {}
          throw new Error(msg);
        }
        if (data?.error) throw new Error(data.error);

        if (data?.resource?.id) {
          const updatePayload = { allow_download: resFormAllowDownload };
          if (resFormDescription) updatePayload.description = resFormDescription.trim();
          await supabase.from('resources').update(updatePayload).eq('id', data.resource.id);
        }

        setResFormSuccess(`✓ Archivo subido con éxito a Google Drive: "${data.formattedFileName || uploadPdfFile.name}"`);
        await fetchResources();
        setTimeout(() => {
          setIsResourceModalOpen(false);
          setUploadPdfFile(null);
        }, 1500);
      } catch (err) {
        console.error('Error subiendo a Google Drive:', err);
        setResFormError('Error al subir a Google Drive: ' + (err.message || String(err)));
      } finally {
        setUploadingPdf(false);
      }
    } else {
      if (!resFormTitle.trim()) {
        setResFormError('El título del recurso es obligatorio.');
        return;
      }
      if (!resFormUrl.trim()) {
        setResFormError('La URL o enlace es obligatorio.');
        return;
      }
      setUploadingPdf(true);
      try {
        const provider = resFormUrl.includes('drive.google.com') ? 'drive' : (resFormUrl.includes('github.com') ? 'github' : 'link');
        const payload = {
          class_id: id,
          program_id: clsData?.program_id || null,
          title: resFormTitle.trim(),
          resource_type: resFormType,
          provider: provider,
          url: resFormUrl.trim(),
          description: resFormDescription ? resFormDescription.trim() : null,
          is_visible: true,
          allow_download: resFormAllowDownload,
        };

        if (editingResource?.id) {
          const { error } = await supabase.from('resources').update(payload).eq('id', editingResource.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('resources').insert([payload]);
          if (error) throw error;
        }

        setResFormSuccess('✓ Recurso guardado correctamente.');
        await fetchResources();
        setTimeout(() => {
          setIsResourceModalOpen(false);
          setEditingResource(null);
        }, 1000);
      } catch (err) {
        setResFormError('Error al guardar el recurso: ' + err.message);
      } finally {
        setUploadingPdf(false);
      }
    }
  };

  const handleDeleteResourceConfirm = async () => {
    if (!resourceToDelete) return;
    setIsDeletingResource(true);
    try {
      if (resourceToDelete.url && (resourceToDelete.url.includes('drive.google.com') || resourceToDelete.provider === 'drive')) {
        try {
          await supabase.functions.invoke('upload-pdf-drive', {
            body: {
              action: 'delete',
              fileUrl: resourceToDelete.url,
              resourceId: resourceToDelete.id,
              classId: id,
              clearPresentation: resourceToDelete.resource_type === 'presentation',
            },
          });
        } catch (driveErr) {
          console.warn('Aviso al eliminar de Google Drive:', driveErr);
        }
      }

      const { error } = await supabase.from('resources').delete().eq('id', resourceToDelete.id);
      if (error) throw error;

      await fetchResources();
      setResourceToDelete(null);
    } catch (err) {
      alert('Error al eliminar recurso: ' + err.message);
    } finally {
      setIsDeletingResource(false);
    }
  };

  const handleOpenVideoModal = () => {
    setVideoInputUrl(clsData?.video_url || '');
    setVideoModalError('');
    setIsVideoModalOpen(true);
  };

  const handleSaveVideoModal = async (e) => {
    e.preventDefault();
    setIsSavingVideo(true);
    setVideoModalError('');
    try {
      const trimmed = videoInputUrl.trim() || null;
      const { error } = await supabase
        .from('class_sessions')
        .update({ video_url: trimmed })
        .eq('id', id);
      if (error) throw error;
      setClsData(prev => ({ ...prev, video_url: trimmed }));
      setIsVideoModalOpen(false);
    } catch (err) {
      setVideoModalError('Error al guardar video: ' + err.message);
    } finally {
      setIsSavingVideo(false);
    }
  };

  const handleOpenEditClassModal = () => {
    setEditClassTitle(clsData?.title || '');
    setEditClassDate(clsData?.class_date ? clsData.class_date.substring(0, 16) : '');
    setEditClassDuration(clsData?.duration || '');
    setEditClassError('');
    setIsEditClassModalOpen(true);
  };

  const handleSaveClassModal = async (e) => {
    e.preventDefault();
    if (!editClassTitle.trim()) {
      setEditClassError('El título de la clase es obligatorio.');
      return;
    }
    setIsSavingClass(true);
    setEditClassError('');
    try {
      const updates = {
        title: editClassTitle.trim(),
        class_date: editClassDate ? new Date(editClassDate).toISOString() : null,
        duration: editClassDuration ? parseInt(editClassDuration) : null,
      };
      const { error } = await supabase
        .from('class_sessions')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
      setClsData(prev => ({ ...prev, ...updates }));
      setIsEditClassModalOpen(false);
    } catch (err) {
      setEditClassError('Error al actualizar clase: ' + err.message);
    } finally {
      setIsSavingClass(false);
    }
  };

  const handleOptionSelect = (questionId, optionId) => {
    setUserAnswers(prev => {
      const updated = {
        ...prev,
        [questionId]: optionId
      };
      if (activityConfig?.id && currentUser?.id) {
        safeSetItem(`liater_answers_${activityConfig.id}_${currentUser.id}`, updated);
      }
      return updated;
    });
    if (activityState === 'no_iniciada') {
      setActivityState('en_progreso');
    }
  };

  const handleStartActivity = () => {
    if (activityState === 'completada') {
      setViewingResultsMode(true);
      setIsActivityModalOpen(true);
      return;
    }
    setViewingResultsMode(false);
    setShowConfirmFinishModal(false);
    setIsActivityModalOpen(true);
  };

  const handleRetakeActivity = () => {
    setUserAnswers({});
    if (activityConfig?.id && currentUser?.id) {
      safeRemoveItem(`liater_answers_${activityConfig.id}_${currentUser.id}`);
    }
    setCurrentQuestionIdx(0);
    setViewingResultsMode(false);
    setShowConfirmFinishModal(false);
    setActivityState('no_iniciada');
    setIsActivityModalOpen(true);
  };

  const [reactivatingActivity, setReactivatingActivity] = useState(false);

  const handleQuickReactivateActivity = async (days = 7) => {
    if (!activityConfig?.id) return;
    setReactivatingActivity(true);
    try {
      const target = new Date();
      target.setDate(target.getDate() + days);
      target.setHours(23, 59, 0, 0);
      const iso = target.toISOString();

      const { error: updErr } = await supabase
        .from('class_activities')
        .update({ due_date: iso })
        .eq('id', activityConfig.id);

      if (updErr) throw updErr;

      setActivityConfig(prev => ({ ...prev, due_date: iso }));
      setActivityState(userAttempts && userAttempts.length > 0 && userAttempts[0].status === 'in_progress' ? 'en_progreso' : 'no_iniciada');
    } catch (err) {
      console.error('Error reactivando actividad:', err);
      const msg = String(err.message || err);
      if (msg.includes('due_date') || msg.includes('schema cache')) {
        alert('Aviso: La columna "due_date" aún no existe en Supabase.\n\nPor favor ejecuta en el SQL Editor de Supabase:\nALTER TABLE public.class_activities ADD COLUMN IF NOT EXISTS due_date timestamp with time zone NULL;\nNOTIFY pgrst, \'reload schema\';');
      } else {
        alert('Error reactivando la actividad: ' + msg);
      }
    } finally {
      setReactivatingActivity(false);
    }
  };

  const handleOpenResults = () => {
    setViewingResultsMode(true);
    setIsActivityModalOpen(true);
  };

  const handleViewReview = handleOpenResults;

  const handleNextQuestion = () => {
    if (currentQuestionIdx < activityConfig.questions.length - 1) {
      setCurrentQuestionIdx(prev => prev + 1);
    }
  };

  const handlePrevQuestion = () => {
    if (currentQuestionIdx > 0) {
      setCurrentQuestionIdx(prev => prev - 1);
    }
  };

  const handleFinishAttempt = async () => {
    if (!activityConfig || !activityConfig.questions || !currentUser?.id) return;

    setShowConfirmFinishModal(false);
    setLoading(true);

    try {
      const studentIdToUse = currentUser.id;
      const qIds = activityConfig.questions.map(q => q.id);

      // 1. Guardar intento inicial como completado en Supabase
      const { data: insertedAttempt, error: insertErr } = await supabase
        .from('activity_attempts')
        .insert([{
          activity_id: activityConfig.id,
          student_id: studentIdToUse,
          status: 'completed',
          score: 0,
          completed_at: new Date().toISOString()
        }])
        .select('id')
        .maybeSingle();

      if (insertErr) console.error('Error insertando intento inicial:', insertErr);

      // 2. Obtener las respuestas correctas de Supabase (ahora permitidas por RLS al existir el intento completado)
      const { data: correctRes } = await supabase
        .from('question_correct_answers')
        .select('question_id, correct_option_id')
        .in('question_id', qIds);

      const correctMap = {};
      if (correctRes && correctRes.length > 0) {
        correctRes.forEach(ca => {
          correctMap[ca.question_id] = ca.correct_option_id;
        });
      }

      // 3. Calcular aciertos y porcentaje real con las claves de respuesta obtenidas
      let correctCount = 0;
      activityConfig.questions.forEach(q => {
        const correctOptId = correctMap[q.id] || q.correctOptionId;
        if (userAnswers[q.id] && correctOptId && String(userAnswers[q.id]) === String(correctOptId)) {
          correctCount++;
        }
      });

      const totalCount = activityConfig.questions.length;
      const scorePct = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

      // 4. Actualizar el intento en Supabase con el puntaje definitivo
      if (insertedAttempt?.id) {
        await supabase
          .from('activity_attempts')
          .update({ score: scorePct })
          .eq('id', insertedAttempt.id);

        // 5. Insertar respuestas detalladas del estudiante
        if (Object.keys(userAnswers).length > 0) {
          try {
            const attemptAnswersToInsert = Object.entries(userAnswers).map(([qId, optId]) => {
              const correctOptId = correctMap[qId] || activityConfig.questions.find(item => item.id === qId)?.correctOptionId;
              const isCorr = correctOptId && String(correctOptId) === String(optId);
              return {
                attempt_id: insertedAttempt.id,
                question_id: qId,
                selected_option_id: optId,
                is_correct: !!isCorr
              };
            });
            const { error: ansInsertErr } = await supabase.from('attempt_answers').insert(attemptAnswersToInsert);
            if (ansInsertErr) console.error('Error guardando respuestas del intento:', ansInsertErr);
          } catch (ansErr) {
            console.error('Error procesando attempt_answers:', ansErr);
          }
        }
      }

      // 6. Actualizar activityConfig local con las respuestas correctas para que la vista de resultados las pinte en verde
      setActivityConfig(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          questions: prev.questions.map(q => ({
            ...q,
            correctOptionId: correctMap[q.id] || q.correctOptionId
          }))
        };
      });

      const now = new Date();
      const formattedDate = now.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const newAttempt = {
        id: insertedAttempt?.id || `attempt_${Date.now()}`,
        activity_id: activityConfig.id,
        student_id: studentIdToUse,
        status: 'completed',
        score: scorePct,
        completed_at: new Date().toISOString()
      };

      const updatedAttempts = [newAttempt, ...userAttempts];
      setUserAttempts(updatedAttempts);

      const completedList = updatedAttempts.filter(a => a.status === 'completed');
      const bestScore = completedList.reduce((max, a) => Math.max(max, a.score ?? 0), scorePct);
      const currentAttemptsCount = completedList.length;

      const result = {
        correctCount,
        bestCorrectCount: Math.round((bestScore / 100) * totalCount),
        totalCount,
        scorePct,
        bestScore,
        attemptsCount: currentAttemptsCount,
        completedAt: formattedDate
      };

      setCompletedResult(result);
      setActivityState('completada');
      setViewingResultsMode(true);

      // Guardar intento en localStorage de respaldo
      const key = `completed_activities_${studentIdToUse}`;
      const currentList = safeJsonParse(key, []);
      const idsToAdd = [
        activityConfig.id, 
        id, 
        classData?.program_id, 
        classData?.program_id ? `reforzamiento-${classData.program_id}` : null
      ].filter(Boolean);

      idsToAdd.forEach(item => {
        if (!currentList.includes(item)) {
          currentList.push(item);
        }
      });
      safeSetItem(key, currentList);

      // Guardar clase completada
      const classKey = `completed_classes_${studentIdToUse}`;
      const classList = safeJsonParse(classKey, []);
      if (id && !classList.includes(id)) {
        classList.push(id);
        safeSetItem(classKey, classList);
      }

      // Disparar eventos globales para sincronizar tarjetas de pendientes inmediatamente
      window.dispatchEvent(new CustomEvent('activityCompleted', { 
        detail: { 
          activityId: activityConfig.id, 
          classId: id, 
          programId: classData?.program_id 
        } 
      }));
      window.dispatchEvent(new Event('storage'));
    } catch (err) {
      console.error('Error completando intento:', err);
    } finally {
      setLoading(false);
    }

    // Actualización visual del progreso
    if (programProgressDetails) {
      setProgramProgressDetails(prev => {
        if (!prev) return prev;
        const classWeight = prev.totalClasses > 0 ? (100 / prev.totalClasses) : 0;
        const additionalPercentage = classWeight * 0.2;
        const newCompletedValue = (prev.completedClassesValue || 0) + 0.2;
        const newPct = Math.round((prev.percentage || 0) + additionalPercentage);
        return {
          ...prev,
          completedClassesValue: newCompletedValue,
          percentage: Math.min(100, newPct)
        };
      });
    }
  };

  // ESTADOS DEL MODAL DE DUDAS Y PERSISTENCIA
  const [isDoubtModalOpen, setIsDoubtModalOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [touched, setTouched] = useState({ subject: false, description: false });
  const [submitError, setSubmitError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [userDoubts, setUserDoubts] = useState([]);

  const doubtButtonRef = useRef(null);
  const firstInputRef = useRef(null);

  useEffect(() => {
    async function fetchClassDetail() {
      if (!id) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);

        // BLOQUE 1: Peticiones principales independientes en paralelo
        let actQuery = supabase
          .from('class_activities')
          .select(`
            *,
            activity_questions (
              *,
              question_options (*),
              question_correct_answers (correct_option_id)
            )
          `)
          .eq('class_id', id);

        const userRole = currentUser?.role;
        if (userRole !== 'admin' && userRole !== 'teacher') {
          actQuery = actQuery.eq('is_published', true);
        }

        const [
          classRes,
          resRes,
          doubtsRes,
          actRes,
          adminDoubtsRes
        ] = await Promise.all([
          // 1. Detalles de la clase
          supabase.from('class_sessions').select('*, teacher_profiles(*)').eq('id', id).maybeSingle(),
          // 2. Recursos
          supabase.from('resources').select('*').eq('class_id', id).order('created_at', { ascending: true }),
          // 3. Dudas del estudiante actual
          currentUser?.id ? fetchStudentDoubtsForClass(id, currentUser.id) : Promise.resolve({ doubts: [] }),
          // 4. Actividades
          actQuery.order('created_at', { ascending: false }),
          // 5. Dudas de toda la clase (para admin/docente)
          (userRole === 'admin' || userRole === 'teacher')
            ? supabase.from('class_doubts').select('*, users_profile:student_id(full_name, email)').eq('class_id', id).order('created_at', { ascending: false })
            : Promise.resolve({ data: [] })
        ]);

        const classData = classRes.data;
        if (classRes.error) console.error('Error fetching class session:', classRes.error);
        setClsData(classData);

        setResources(resRes.data || []);
        setUserDoubts(doubtsRes.doubts || []);
        if (adminDoubtsRes?.data) setAllClassDoubts(adminDoubtsRes.data);

        const actData = (actRes.data && actRes.data.length > 0) ? actRes.data[0] : null;

        // BLOQUE 2: Dependencias secundarias basadas en la clase y en la actividad (en paralelo)
        const secondaryPromises = [];

        // 2a. Si hay clase, pedir la sesión/programa
        if (classData) {
          const parentSessionId = classData.session_id || classData.subtopic_id;
          
          if (parentSessionId) {
            secondaryPromises.push(
              (async () => {
                let sessionData = null;
                const { data: sData } = await supabase.from('sessions').select('module_id, modules(title)').eq('id', parentSessionId).maybeSingle();
                if (sData) {
                  sessionData = sData;
                } else {
                  const { data: subData } = await supabase.from('subtopics').select('module_id, modules(title)').eq('id', parentSessionId).maybeSingle();
                  sessionData = subData;
                }
                if (sessionData) {
                  setModuleId(sessionData.module_id);
                  if (sessionData.modules?.title) {
                    setModuleTitle(sessionData.modules.title);
                    setTopic(sessionData.modules.title);
                  }
                }
              })()
            );
          }

          if (classData.program_id) {
            secondaryPromises.push(
              (async () => {
                const { data: progData } = await supabase.from('diploma_programs').select('program_type, meet_url').eq('id', classData.program_id).maybeSingle();
                localStorage.setItem('activeProgramId', classData.program_id);
                if (progData?.program_type) {
                  setProgramType(progData.program_type);
                  localStorage.setItem('activeProgramType', progData.program_type);
                }
                if (progData?.meet_url) {
                  setProgramMeetUrl(progData.meet_url);
                }
                window.dispatchEvent(new Event('programContextChanged'));
              })()
            );

            if (currentUser?.id) {
              secondaryPromises.push(
                (async () => {
                  const progDetails = await calculateProgramProgressDetails(classData.program_id, currentUser.id);
                  setProgramProgressDetails(progDetails);
                })()
              );
            }
          }
        }

        // 2b. Si hay actividad, pedir sus detalles (preguntas, respuestas, borradores, intentos)
        if (actData) {
          secondaryPromises.push(
            (async () => {
              let questions = actData.activity_questions || [];
              if (questions.length === 0) {
                const { data: fetchedQ } = await supabase.from('activity_questions').select('*, question_options(*)').eq('activity_id', actData.id).order('order_num', { ascending: true });
                if (fetchedQ) questions = fetchedQ;
              }

              if (questions.length > 0) {
                const qIds = questions.map(q => q.id);
                
                // Ejecutar sub-dependencias de la actividad en paralelo
                const studentIdToUse = currentUser?.id;
                const filterClause = currentUser?.auth_user_id 
                  ? `student_id.eq.${studentIdToUse},student_id.eq.${currentUser.auth_user_id}`
                  : `student_id.eq.${studentIdToUse}`;

                let nextClassQuery = Promise.resolve({ data: null });
                if (!actData.due_date && classData?.program_id) {
                  let q = supabase.from('class_sessions').select('class_date').eq('program_id', classData.program_id).gt('class_date', classData?.class_date || new Date().toISOString()).order('class_date', { ascending: true }).limit(1);
                  if (classData.teacher_id) q = q.eq('teacher_id', classData.teacher_id);
                  nextClassQuery = q.maybeSingle();
                }

                const [correctRes, draftRes, attemptsRes, nextClassRes] = await Promise.all([
                  supabase.from('question_correct_answers').select('*').in('question_id', qIds),
                  supabase.from('activity_drafts').select('draft_data').eq('class_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
                  studentIdToUse 
                    ? supabase.from('activity_attempts').select('*').eq('activity_id', actData.id).or(filterClause).order('completed_at', { ascending: false })
                    : Promise.resolve({ data: [] }),
                  nextClassQuery
                ]);

                const correctMap = {};
                if (correctRes.data) {
                  correctRes.data.forEach(ca => correctMap[ca.question_id] = ca.correct_option_id);
                }

                let draftQuestionsMap = {};
                if (draftRes.data?.draft_data?.questions) {
                  draftRes.data.draft_data.questions.forEach(dq => {
                    if (dq.text) draftQuestionsMap[dq.text.trim().toLowerCase()] = dq;
                  });
                }

                const formattedQuestions = questions
                  .sort((a, b) => (a.order_num || 0) - (b.order_num || 0))
                  .map(q => {
                    const dq = draftQuestionsMap[q.text?.trim().toLowerCase()];
                    const correctOptFromJoin = Array.isArray(q.question_correct_answers)
                      ? q.question_correct_answers[0]?.correct_option_id
                      : q.question_correct_answers?.correct_option_id;

                    return {
                      id: q.id,
                      type: q.question_type,
                      statement: q.text,
                      explanation: q.explanation || dq?.explanation || null,
                      sourceBasis: q.source_basis || dq?.source_basis || null,
                      options: (q.question_options || [])
                        .sort((a, b) => (a.order_num || 0) - (b.order_num || 0))
                        .map(o => ({ id: o.id, text: o.text })),
                      correctOptionId: correctOptFromJoin || correctMap[q.id] || null
                    };
                  });

                setActivityConfig({
                  id: actData.id,
                  title: actData.title,
                  description: actData.description,
                  due_date: actData.due_date || null,
                  estimatedTimeMinutes: 10,
                  maxAttempts: actData.max_attempts ?? 1,
                  isMandatory: actData.is_mandatory,
                  questions: formattedQuestions
                });

                if (studentIdToUse && actData.id) {
                  let initialAnswers = safeJsonParse(`liater_answers_${actData.id}_${studentIdToUse}`, {});
                  let stateToSet = 'no_iniciada';
                  
                  const attempts = attemptsRes.data || [];
                  setUserAttempts(attempts);
                  const completedAttempts = attempts.filter(a => a.status === 'completed');
                  const localCompleted = safeJsonParse(`completed_activities_${studentIdToUse}`, []);
                  const isLocallyCompleted = actData.id ? localCompleted.includes(actData.id) : false;
                  const hasDbCompletedAttempt = completedAttempts.length > 0;

                  if (hasDbCompletedAttempt || isLocallyCompleted) {
                    const lastAttempt = completedAttempts.length > 0 ? completedAttempts[0] : null;
                    const effectiveAttemptsCount = completedAttempts.length || (isLocallyCompleted ? 1 : 0);

                    stateToSet = 'completada';

                    // Cargar respuestas de la BD si es posible
                    if (lastAttempt?.id) {
                      try {
                        const { data: dbAns } = await supabase
                          .from('attempt_answers')
                          .select('question_id, selected_option_id')
                          .eq('attempt_id', lastAttempt.id);

                        if (dbAns && dbAns.length > 0) {
                          dbAns.forEach(a => {
                            initialAnswers[a.question_id] = a.selected_option_id;
                          });
                        }
                      } catch (errAns) {
                        console.error('Error cargando respuestas de la BD:', errAns);
                      }
                    }

                    setUserAnswers(initialAnswers);

                    let realCorrectCount = 0;
                    formattedQuestions.forEach(q => {
                      if (initialAnswers[q.id] && q.correctOptionId && String(initialAnswers[q.id]) === String(q.correctOptionId)) {
                        realCorrectCount++;
                      }
                    });

                    const calculatedScorePct = formattedQuestions.length > 0
                      ? Math.round((realCorrectCount / formattedQuestions.length) * 100)
                      : 0;

                    // Si se calcularon aciertos o hay respuestas, usar el porcentaje real calculado
                    const finalScore = (realCorrectCount > 0 || Object.keys(initialAnswers).length > 0)
                      ? calculatedScorePct
                      : (lastAttempt?.score ?? 0);

                    const finalCorrect = (realCorrectCount > 0 || Object.keys(initialAnswers).length > 0)
                      ? realCorrectCount 
                      : Math.round((finalScore / 100) * formattedQuestions.length);

                    const bestScore = Math.max(
                      ...completedAttempts.map(a => a.score ?? 0),
                      finalScore
                    );

                    // Reparar en base de datos si el intento anterior quedó grabado con score 0 por el bug previo
                    if (lastAttempt?.id && lastAttempt.score !== finalScore && finalScore > 0) {
                      supabase
                        .from('activity_attempts')
                        .update({ score: finalScore })
                        .eq('id', lastAttempt.id)
                        .then(() => {});
                    }

                    setCompletedResult({
                      correctCount: finalCorrect,
                      bestCorrectCount: Math.round((bestScore / 100) * formattedQuestions.length),
                      totalCount: formattedQuestions.length,
                      scorePct: finalScore,
                      bestScore: bestScore,
                      attemptsCount: effectiveAttemptsCount,
                      completedAt: lastAttempt?.completed_at ? new Date(lastAttempt.completed_at).toLocaleDateString('es-ES') : 'Realizada'
                    });
                  } else {
                    // Si no hay intento guardado en BD, limpiar cualquier registro local
                    safeRemoveItem(`liater_answers_${actData.id}_${studentIdToUse}`);
                    const key = `completed_activities_${studentIdToUse}`;
                    const localList = safeJsonParse(key, []);
                    const filtered = localList.filter(id => id !== actData.id);
                    safeSetItem(key, filtered);

                    setUserAnswers({});
                    setCompletedResult(null);

                    if (attempts && attempts.length > 0 && attempts[0].status === 'in_progress') {
                      stateToSet = 'en_progreso';
                    } else {
                      stateToSet = 'no_iniciada';
                    }
                  }

                  // Verificar si la actividad está vencida
                  if (stateToSet !== 'completada') {
                    if (actData.due_date) {
                      const dueDate = new Date(actData.due_date);
                      if (dueDate < new Date()) {
                        stateToSet = 'vencida';
                      }
                    }
                  }

                  setActivityState(stateToSet);
                }
              } else {
                // La actividad existe en DB (is_published) pero aún no tiene preguntas configuradas
                setActivityConfig({
                  id: actData.id,
                  title: actData.title,
                  description: actData.description,
                  estimatedTimeMinutes: 10,
                  maxAttempts: actData.max_attempts || 1,
                  isMandatory: actData.is_mandatory,
                  questions: []
                });
                setActivityState('bloqueada');
              }
            })()
          );
        } else {
          setActivityConfig(null);
          setActivityState('no_configurada');
        }

        // Ejecutar bloque secundario (todas las peticiones dependientes, en paralelo entre sí)
        await Promise.all(secondaryPromises);

      } catch (err) {
        console.error('Error fetching class detail:', err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchClassDetail();
  }, [id, currentUser?.id]);

  // MANEJO DE ACCESIBILIDAD Y ESCAPE EN EL MODAL DE DUDAS
  const openDoubtModal = () => {
    setIsDoubtModalOpen(true);
    setSubmitError('');
    setSuccessMsg('');
    setTimeout(() => {
      firstInputRef.current?.focus();
    }, 100);
  };

  const closeDoubtModal = () => {
    setIsDoubtModalOpen(false);
    setSubmitError('');
    setSuccessMsg('');
    doubtButtonRef.current?.focus();
  };

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isDoubtModalOpen) {
        closeDoubtModal();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDoubtModalOpen]);

  // VALIDACIÓN DEL FORMULARIO
  const subjectError = touched.subject && !subject.trim()
    ? 'El asunto de la duda es obligatorio.'
    : subject.length > 120
    ? 'El asunto no debe exceder los 120 caracteres.'
    : '';

  const descriptionError = touched.description && !description.trim()
    ? 'La descripción de la duda es obligatoria.'
    : description.length > 1500
    ? 'La descripción no debe exceder los 1500 caracteres.'
    : '';

  const isFormValid = subject.trim().length > 0 &&
                      subject.length <= 120 &&
                      description.trim().length > 0 &&
                      description.length <= 1500;

  // ENVÍO DE LA DUDA A SUPABASE CON MANEJO DE ESTADOS
  const handleSubmitDoubt = async (e) => {
    e.preventDefault();
    setTouched({ subject: true, description: true });

    if (!isFormValid || submitting) return;

    if (!currentUser?.id) {
      setSubmitError('Debes iniciar sesión para enviar una duda.');
      return;
    }

    setSubmitting(true);
    setSubmitError('');
    setSuccessMsg('');

    const { data, error } = await createDoubt({
      class_id: id,
      module_id: moduleId,
      program_id: clsData?.program_id,
      student_id: currentUser.id,
      teacher_id: clsData?.teacher_id,
      subject,
      description,
      topic
    });

    if (error) {
      console.error('Supabase Error on createDoubt:', error);
      const errorMsg = error?.message || error?.details || JSON.stringify(error) || 'Ocurrió un error desconocido.';
      setSubmitError(`Error en Supabase: ${errorMsg}`);
      setSubmitting(false);
      return;
    }

    // ÉXITO EN INSERCIÓN: Mensaje requerido, limpiar campos y recargar dudas
    setSuccessMsg('Tu duda fue enviada. El docente podrá revisarla para atenderla durante la clase.');
    setSubject('');
    setDescription('');
    setTouched({ subject: false, description: false });
    setSubmitting(false);

    // Actualizar lista de dudas enviadas en la vista
    const { doubts } = await fetchStudentDoubtsForClass(id, currentUser.id);
    setUserDoubts(doubts || []);

    // Cerrar modal automáticamente después de 2 segundos
    setTimeout(() => {
      setIsDoubtModalOpen(false);
      setSuccessMsg('');
    }, 2000);
  };

  if (loading) {
    return (
      <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%', padding: '1rem 0' }}>
        {/* Esqueleto del Encabezado */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border)', marginBottom: '1.5rem' }}>
          <div style={{ width: '100%' }}>
            <div className="skeleton" style={{ width: '120px', height: '20px', marginBottom: '12px' }}></div>
            <div className="skeleton" style={{ width: 'max(300px, 40%)', height: '36px', marginBottom: '16px' }}></div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div className="skeleton" style={{ width: '150px', height: '20px' }}></div>
              <div className="skeleton" style={{ width: '150px', height: '20px' }}></div>
            </div>
          </div>
        </div>

        {/* Esqueleto del Cuerpo (Grid) */}
        <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: '1fr' }} className="skeleton-grid">
          <style>{`@media(min-width: 1024px) { .skeleton-grid { grid-template-columns: 2fr 1fr !important; } }`}</style>
          
          {/* Columna Izquierda (Video) */}
          <div>
            <div className="skeleton" style={{ width: '100%', aspectRatio: '16/9', borderRadius: 'var(--radius-lg)' }}></div>
            <div className="skeleton" style={{ width: '100%', height: '80px', marginTop: '1.5rem', borderRadius: 'var(--radius-md)' }}></div>
          </div>
          
          {/* Columna Derecha (Tarjetas laterales) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="skeleton" style={{ width: '100%', height: '240px', borderRadius: 'var(--radius-lg)' }}></div>
            <div className="skeleton" style={{ width: '100%', height: '180px', borderRadius: 'var(--radius-lg)' }}></div>
          </div>
        </div>
      </div>
    );
  }

  if (!clsData) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)', animation: 'fadeSlideUp 0.35s ease-out' }}>
        <h2>Clase no encontrada</h2>
        <p style={{ marginTop: '0.5rem', marginBottom: '1.5rem' }}>La sesión solicitada no existe o fue cancelada.</p>
        <Link to="/portal" className="btn btn-primary">
          <ArrowLeft size={16} /> Volver al Portal
        </Link>
      </div>
    );
  }

  const getResourceIcon = (type) => {
    switch (type) {
      case 'pdf': return <FileText size={18} color="#dc2626" />;
      case 'presentation': return <Presentation size={18} color="var(--navy)" />;
      case 'link': return <ExternalLink size={18} color="var(--green-600)" />;
      default: return <Paperclip size={18} color="#ca8a04" />;
    }
  };

  return (
    <div className="class-detail-container">
      <style>{`
        .class-detail-container {
          animation: fadeSlideUp 0.35s ease-out;
        }
        .class-detail-grid {
          display: grid;
          grid-template-columns: 1fr 340px;
          gap: 1.5rem;
          align-items: start;
        }
        .class-detail-main {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .class-detail-sidebar {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .card-placeholder {
          background: #ffffff;
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: var(--radius-lg, 12px);
          padding: 1.25rem;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        }

        .doubt-input:focus, .doubt-textarea:focus {
          outline: none;
          border-color: var(--gold-dark, #ca8a04) !important;
          box-shadow: 0 0 0 3px rgba(202, 138, 4, 0.15) !important;
        }

        @media (max-width: 991px) {
          .class-detail-grid {
            display: flex;
            flex-direction: column;
            gap: 1.25rem;
          }
          .class-detail-main, .class-detail-sidebar {
            display: contents;
          }
          .order-grabacion { order: 1; }
          .order-actividad { order: 2; }
          .order-recursos { order: 3; }
          .order-dudas { order: 4; }
        }
      `}</style>

      {/* 1. ENCABEZADO DE LA CLASE */}
      {(() => {
        const isCourse = programType === 'curso' || programType === 'course';
        return (
          <>
            {/* BARRA SUPERIOR DE MODO ADMINISTRADOR */}
            {isAdmin && (
              <div style={{
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                borderRadius: '12px',
                padding: '0.85rem 1.25rem',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.75rem',
                border: '1px solid #334155',
                boxShadow: '0 4px 14px rgba(0,0,0,0.12)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <span style={{
                    background: 'rgba(252, 163, 17, 0.2)',
                    color: '#fca311',
                    padding: '0.3rem 0.65rem',
                    borderRadius: '8px',
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    letterSpacing: '0.5px'
                  }}>
                    <Shield size={14} /> MODO ADMINISTRADOR
                  </span>
                  <span style={{ color: '#cbd5e1', fontSize: '0.8rem' }}>
                    Vista previa de la clase con controles de gestión
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {clsData?.program_id && (
                    <Link
                      to={`/dashboard/admin/${clsData.program_id}?tab=curriculum`}
                      style={{
                        background: 'rgba(255,255,255,0.1)',
                        color: '#ffffff',
                        padding: '0.4rem 0.85rem',
                        borderRadius: '6px',
                        fontSize: '0.76rem',
                        fontWeight: 600,
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        border: '1px solid rgba(255,255,255,0.15)'
                      }}
                    >
                      <ArrowLeft size={13} /> Volver al Constructor
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={handleOpenEditClassModal}
                    style={{
                      background: 'var(--gold, #fca311)',
                      color: '#14213d',
                      padding: '0.4rem 0.9rem',
                      borderRadius: '6px',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      border: 'none',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem'
                    }}
                  >
                    <Pencil size={13} /> Editar Clase
                  </button>
                </div>
              </div>
            )}

            {/* BARRA SUPERIOR DE MODO DOCENTE */}
            {isTeacher && !isAdmin && (
              <div style={{
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                borderRadius: '12px',
                padding: '0.85rem 1.25rem',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.75rem',
                border: '1px solid #334155',
                boxShadow: '0 4px 14px rgba(0,0,0,0.12)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <span style={{
                    background: 'rgba(252, 163, 17, 0.2)',
                    color: '#fca311',
                    padding: '0.3rem 0.65rem',
                    borderRadius: '8px',
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    letterSpacing: '0.5px'
                  }}>
                    <BookOpen size={14} /> MODO DOCENTE
                  </span>
                  <span style={{ color: '#cbd5e1', fontSize: '0.8rem' }}>
                    Gestión académica de materiales de estudio y actividad de reforzamiento
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <Link
                    to={clsData?.program_id ? `/teacher?programId=${clsData.program_id}&tab=classes` : '/teacher'}
                    style={{
                      background: 'rgba(255,255,255,0.1)',
                      color: '#ffffff',
                      padding: '0.4rem 0.85rem',
                      borderRadius: '6px',
                      fontSize: '0.76rem',
                      fontWeight: 600,
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      border: '1px solid rgba(255,255,255,0.15)',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                    onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                  >
                    <ArrowLeft size={13} /> Volver a Mis Clases
                  </Link>
                </div>
              </div>
            )}

            <div style={{ marginBottom: '1.25rem' }}>
              <Link
                to={
                  isTeacher
                    ? (clsData?.program_id ? `/teacher?programId=${clsData.program_id}&tab=classes` : '/teacher')
                    : (isCourse ? (clsData?.program_id ? `/dashboard/${clsData.program_id}` : '/portal') : (moduleId ? `/module/${moduleId}` : '/portal'))
                }
                className="btn btn-outline"
                style={{ fontSize: '0.82rem', padding: '0.4rem 0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <ArrowLeft size={14} /> {isTeacher ? 'Volver a Mis Clases' : (isCourse ? 'Volver al inicio del curso' : (moduleId ? 'Volver al Módulo' : 'Volver al Portal'))}
              </Link>
            </div>

            <div className="page-header" style={{ marginBottom: '1.75rem' }}>
              <h1 className="page-title" style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--navy)', margin: '0 0 0.6rem 0', lineHeight: 1.25 }}>
                {clsData.title}
              </h1>

              {/* METADATOS LIMPIOS */}
              <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.84rem', color: 'var(--text-muted)', flexWrap: 'wrap', alignItems: 'center' }}>
                {clsData.class_date && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                    {formatClassDate(clsData.class_date)}
                  </span>
                )}
                {clsData.teacher_profiles?.name && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                    <User size={15} color="var(--gold-dark)" />
                    Docente: <strong style={{ color: 'var(--navy)' }}>{clsData.teacher_profiles.name}</strong>
                  </span>
                )}
                {!isCourse && moduleTitle && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                    <BookOpen size={15} color="var(--gold-dark)" />
                    Módulo: <strong style={{ color: 'var(--navy)' }}>{moduleTitle}</strong>
                  </span>
                )}
                {clsData.duration && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Clock size={15} color="var(--gold-dark)" />
                    {clsData.duration} min
                  </span>
                )}

                {/* INDICADOR DE ESTADO: "Finalizada" ÚNICAMENTE SI SE COMPLETÓ LA ACTIVIDAD DE REFORZAMIENTO */}
                {activityState === 'completada' ? (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                    padding: '0.2rem 0.65rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700,
                    background: 'var(--green-subtle, #f0fdf4)',
                    color: 'var(--green-600, #16a34a)',
                    border: '1px solid var(--green-400, #86efac)'
                  }}>
                    <CheckCircle2 size={13} /> Finalizada {completedResult ? `· ${completedResult.scorePct}%` : ''}
                  </span>
                ) : (activityState === 'no_iniciada' || activityState === 'en_progreso') ? (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                    padding: '0.2rem 0.65rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700,
                    background: 'var(--gold-subtle, #fef9ec)',
                    color: 'var(--gold-dark, #b45309)',
                    border: '1px solid var(--gold-light, #fde68a)'
                  }}>
                    <Zap size={13} /> Actividad pendiente
                  </span>
                ) : clsData.video_url ? (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                    padding: '0.2rem 0.65rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600,
                    background: 'rgba(20,33,61,0.06)',
                    color: 'var(--navy)',
                    border: '1px solid var(--border-color)'
                  }}>
                    <Video size={13} /> Grabación disponible
                  </span>
                ) : (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                    padding: '0.2rem 0.65rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600,
                    background: '#f1f5f9',
                    color: '#475569'
                  }}>
                    Programada
                  </span>
                )}
              </div>
            </div>
          </>
        );
      })()}

      {/* 2. CUADRÍCULA PRINCIPAL (DESKTOP: 2 COLUMNAS / MOBILE: 1 COLUMNA ORDENADA) */}
      <div className="class-detail-grid">
        
        {/* COLUMNA PRINCIPAL (68% - 72%) */}
        <div className="class-detail-main">

          {/* BANNER CLASE EN VIVO (HOY / EN TRANSMISIÓN) */}
          {(() => {
            if (!clsData?.class_date || clsData?.video_url) return null;
            const classDate = new Date(clsData.class_date);
            const todayStart = new Date(); todayStart.setHours(0,0,0,0);
            const todayEnd = new Date(); todayEnd.setHours(23,59,59,999);
            const isClassToday = classDate >= todayStart && classDate <= todayEnd;
            const meetLink = clsData?.meet_url || programMeetUrl || null;
            const isLiveNow = isClassLiveOrSoon(clsData, 10);

            if (isLiveNow && meetLink) {
              return (
                <div style={{
                  background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                  borderRadius: 'var(--radius-lg)', padding: '1.1rem 1.4rem',
                  marginBottom: '1rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  flexWrap: 'wrap', gap: '0.75rem',
                  boxShadow: '0 4px 20px rgba(220,38,38,0.25)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '9px', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Radio size={18} color="#ffffff" />
                    </div>
                    <div>
                      <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 0.1rem 0' }}>Clase en vivo · EN TRANSMISIÓN</p>
                      <p style={{ color: '#ffffff', fontWeight: 700, fontSize: '0.9rem', margin: 0 }}>
                        {classDate.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false, hourCycle: 'h23' })} hs — Transmisión en curso
                      </p>
                    </div>
                  </div>
                  <a href={meetLink} target="_blank" rel="noreferrer" style={{
                    background: '#ffffff', color: '#dc2626',
                    padding: '0.5rem 1.1rem', borderRadius: '7px',
                    fontWeight: 800, fontSize: '0.85rem', textDecoration: 'none',
                    display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.15)', flexShrink: 0
                  }}>
                    <Video size={14} /> Entrar a la Clase
                  </a>
                </div>
              );
            }

            if (isClassToday && Date.now() < classDate.getTime()) {
              return (
                <div style={{
                  background: 'linear-gradient(135deg, var(--navy) 0%, #1e2e52 100%)',
                  borderRadius: 'var(--radius-lg)', padding: '1rem 1.3rem',
                  marginBottom: '1rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  flexWrap: 'wrap', gap: '0.75rem',
                  border: '1px solid rgba(252,163,17,0.25)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '9px', background: 'var(--gold-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Calendar size={18} color="var(--gold-dark)" />
                    </div>
                    <div>
                      <p style={{ color: 'var(--gold)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 0.1rem 0' }}>Clase programada para HOY</p>
                      <p style={{ color: '#ffffff', fontWeight: 700, fontSize: '0.88rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Clock size={13} color="var(--gold)" />
                        Inicio: {classDate.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false, hourCycle: 'h23' })} hs
                      </p>
                    </div>
                  </div>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                    background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.9)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    padding: '0.4rem 0.8rem', borderRadius: '7px',
                    fontSize: '0.75rem', fontWeight: 600
                  }}>
                    <Clock size={12} color="var(--gold)" /> El botón de ingreso se activará 10 min antes
                  </div>
                </div>
              );
            }

            return null;
          })()}

          <div className="card-placeholder order-grabacion">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--navy)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Video size={18} color="var(--gold-dark)" /> Grabación / Transmisión de la Clase
              </h3>
              {isAdmin && (
                <button
                  type="button"
                  onClick={handleOpenVideoModal}
                  style={{
                    background: '#ffffff',
                    color: 'var(--navy)',
                    border: '1px solid var(--border-color)',
                    padding: '0.35rem 0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.76rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                  }}
                >
                  <Pencil size={13} color="var(--gold-dark)" /> {clsData.video_url ? 'Editar Grabación' : 'Configurar Grabación'}
                </button>
              )}
            </div>

            {clsData.video_url ? (
              <PrivateVideoPlayer videoUrl={clsData.video_url} title={clsData.title} studentName={currentUser?.full_name || currentUser?.email} />
            ) : (
              <div style={{ textAlign: 'center', padding: '1.75rem 1rem', background: 'var(--surface-light)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <Video size={32} color="var(--text-muted)" style={{ marginBottom: '0.5rem' }} />
                <h4 style={{ color: 'var(--navy)', marginBottom: '0.2rem', fontSize: '0.92rem', fontWeight: 600 }}>Grabación no disponible aún</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                  El video de esta sesión estará disponible una vez finalizada la transmisión.
                </p>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={handleOpenVideoModal}
                    className="btn btn-primary"
                    style={{ marginTop: '0.85rem', fontSize: '0.78rem', padding: '0.4rem 0.9rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <Plus size={14} /> Cargar Enlace de Video
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 2. RECURSOS Y MATERIAL DE ESTUDIO */}
          <div className="card-placeholder order-recursos">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--navy)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Paperclip size={18} color="var(--gold-dark)" /> Recursos y Material de Estudio ({resources.length})
              </h3>

              {canManageContent && (
                <button
                  type="button"
                  onClick={openCreateResourceModal}
                  style={{
                    background: 'var(--navy)',
                    color: '#ffffff',
                    padding: '0.4rem 0.9rem',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    boxShadow: '0 2px 6px rgba(20,33,61,0.2)'
                  }}
                >
                  <Plus size={14} color="var(--gold)" /> Agregar Material
                </button>
              )}
            </div>

            {resources.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.75rem 1rem', background: 'var(--surface-light)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-color)' }}>
                <Paperclip size={28} color="var(--text-muted)" style={{ marginBottom: '0.35rem' }} />
                <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem', margin: '0 0 0.85rem 0' }}>
                  No hay archivos ni recursos adicionales cargados para esta clase.
                </p>
                {canManageContent && (
                  <button
                    type="button"
                    onClick={openCreateResourceModal}
                    className="btn btn-primary"
                    style={{ fontSize: '0.8rem', padding: '0.45rem 1rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                  >
                    <Plus size={14} /> Subir o Vincular Primer Recurso
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {resources.map(res => (
                  <div key={res.id} style={{
                    padding: '0.85rem 1.25rem',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'var(--surface-light)',
                    gap: '1rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', minWidth: 0, flex: 1 }}>
                      <div style={{ padding: '0.5rem', background: '#fff', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', flexShrink: 0 }}>
                        {getResourceIcon(res.resource_type || res.type)}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <h4 style={{ fontWeight: 600, color: 'var(--navy)', fontSize: '0.88rem', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {res.title}
                        </h4>
                        {res.description && <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>{res.description}</p>}
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', background: '#e2e8f0', color: '#475569', fontWeight: 600, textTransform: 'uppercase' }}>
                            {res.resource_type || res.type || 'archivo'}
                          </span>
                          {res.allow_download ? (
                            <span style={{ fontSize: '0.66rem', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: '#DCFCE7', color: '#15803D', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              <Download size={10} /> Descargable
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.66rem', fontWeight: 600, padding: '1px 6px', borderRadius: '4px', background: '#f1f5f9', color: '#64748B', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              <Lock size={10} /> Solo lectura
                            </span>
                          )}
                          {res.provider && res.provider !== 'drive' && (
                            <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                              • {res.provider}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => setSelectedDoc(res)}
                        className="btn btn-outline"
                        style={{
                          fontSize: '0.78rem',
                          padding: '0.4rem 0.85rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          cursor: 'pointer'
                        }}
                      >
                        <Eye size={14} /> Abrir
                      </button>

                      {res.allow_download && (
                        <button
                          type="button"
                          onClick={() => triggerResourceDownload(res.url, res.title)}
                          title="Descargar material a tu equipo"
                          style={{
                            background: '#DCFCE7',
                            color: '#15803D',
                            border: '1px solid #86EFAC',
                            borderRadius: '6px',
                            padding: '0.4rem 0.75rem',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem'
                          }}
                        >
                          <Download size={13} /> Descargar
                        </button>
                      )}

                      {canManageContent && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleToggleResourceDownload(res)}
                            title={res.allow_download ? 'Descarga permitida a estudiantes (Clic para bloquear)' : 'Descarga bloqueada a estudiantes (Clic para permitir)'}
                            style={{
                              padding: '0.4rem 0.65rem',
                              background: res.allow_download ? '#DCFCE7' : '#ffffff',
                              border: `1px solid ${res.allow_download ? '#86EFAC' : 'var(--border-color)'}`,
                              borderRadius: '6px',
                              cursor: 'pointer',
                              color: res.allow_download ? '#15803D' : '#64748b',
                              display: 'inline-flex',
                              alignItems: 'center',
                              fontSize: '0.76rem'
                            }}
                          >
                            <Download size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditResourceModal(res)}
                            title="Editar recurso"
                            style={{
                              padding: '0.4rem 0.65rem',
                              background: '#ffffff',
                              border: '1px solid var(--border-color)',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              color: 'var(--navy)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              fontSize: '0.76rem'
                            }}
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setResourceToDelete(res)}
                            title="Eliminar recurso"
                            style={{
                              padding: '0.4rem 0.65rem',
                              background: '#fef2f2',
                              border: '1px solid #fca5a5',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              color: '#dc2626',
                              display: 'inline-flex',
                              alignItems: 'center',
                              fontSize: '0.76rem'
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* COLUMNA LATERAL (BARRA LATERAL DE ACCIONES E INFORMACIÓN) */}
        <div className="class-detail-sidebar">

          {/* 1. ACTIVIDAD DE REFORZAMIENTO DE LA CLASE (REEMPLAZA EL PROGRESO DE LA CLASE) */}
          <div className="card-placeholder order-actividad" style={{ background: 'var(--white)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--navy)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Award size={18} color="var(--gold-dark)" /> Actividad de reforzamiento
              </h3>
              
              {/* STATUS CHIP DEPENDIENDO DEL ESTADO DE LA ACTIVIDAD */}
              {activityState === 'no_configurada' && (
                <span style={{ background: '#f1f5f9', color: '#64748b', fontSize: '0.72rem', padding: '0.25rem 0.65rem', borderRadius: '12px', fontWeight: 600 }}>
                  Aún no configurada
                </span>
              )}
              {activityState === 'bloqueada' && (
                <span style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', fontSize: '0.72rem', padding: '0.25rem 0.65rem', borderRadius: '12px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Lock size={12} /> Bloqueada
                </span>
              )}
              {activityState === 'no_iniciada' && (
                <span style={{ background: '#dbeafe', color: '#1e40af', border: '1px solid #bfdbfe', fontSize: '0.72rem', padding: '0.25rem 0.65rem', borderRadius: '12px', fontWeight: 600 }}>
                  Disponible
                </span>
              )}
              {activityState === 'en_progreso' && (
                <span style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', fontSize: '0.72rem', padding: '0.25rem 0.65rem', borderRadius: '12px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={12} /> En progreso ({Object.keys(userAnswers).length}/{activityConfig?.questions?.length || 0})
                </span>
              )}
              {activityState === 'completada' && (
                <span style={{ background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0', fontSize: '0.72rem', padding: '0.25rem 0.65rem', borderRadius: '12px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <CheckCircle2 size={12} /> Completada
                </span>
              )}
            </div>

            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: '0 0 0.85rem 0', lineHeight: 1.45 }}>
              Comprueba tu comprensión de los temas abordados respondiendo esta evaluación corta.
            </p>

            {/* METADATOS (Solo si existe la actividad y no está sin configurar) */}
            {activityConfig && activityState !== 'no_configurada' && (
              <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <BookOpen size={13} color="var(--gold-dark)" /> {activityConfig.questions?.length || 0} preguntas
                </span>
                {activityConfig.estimatedTimeMinutes && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={13} color="var(--gold-dark)" /> {activityConfig.estimatedTimeMinutes} min
                  </span>
                )}
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <RotateCcw size={13} color="var(--gold-dark)" />
                  {activityConfig.maxAttempts === 0
                    ? 'Intentos ilimitados'
                    : activityConfig.maxAttempts === 1
                    ? 'Único intento permitido'
                    : `${activityConfig.maxAttempts} intentos permitidos`}
                </span>
                {activityConfig.due_date && (
                  <span style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: '4px',
                    color: activityState === 'vencida' ? '#dc2626' : 'var(--text-muted)',
                    fontWeight: activityState === 'vencida' ? 700 : 500
                  }}>
                    <Calendar size={13} color={activityState === 'vencida' ? '#dc2626' : 'var(--gold-dark)'} />
                    {activityState === 'vencida' ? 'Venció: ' : 'Límite: '}
                    {formatClassDate(activityConfig.due_date, false)}
                  </span>
                )}
              </div>
            )}

            {/* VISTA SEGÚN ESTADO DE LA ACTIVIDAD */}
            {activityState === 'no_configurada' && (
              <div style={{ padding: '0.85rem', background: 'var(--bg-light)', borderRadius: '8px', border: '1px solid var(--border-color)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                La actividad de reforzamiento aún no está disponible.
              </div>
            )}

            {activityState === 'bloqueada' && (
              <div style={{ padding: '0.85rem', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fef3c7', color: '#b45309', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Lock size={16} />
                <span>Debes visualizar la clase para habilitar esta actividad.</span>
              </div>
            )}

            {(activityState === 'no_iniciada' || activityState === 'en_progreso') && (
              <button
                onClick={handleStartActivity}
                className="btn btn-primary"
                style={{ width: '100%', fontSize: '0.85rem', padding: '0.6rem 1rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: 700 }}
              >
                <Award size={16} /> {activityState === 'en_progreso' ? 'Continuar actividad' : 'Comenzar actividad'}
              </button>
            )}

            {activityState === 'vencida' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <div style={{ padding: '0.85rem', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca', color: '#991b1b', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Lock size={16} />
                  <span>La fecha límite para realizar esta actividad ha finalizado{activityConfig?.due_date ? ` (${formatClassDate(activityConfig.due_date, false)})` : ''}.</span>
                </div>
                {canManageContent && (
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => handleQuickReactivateActivity(7)}
                      disabled={reactivatingActivity}
                      className="btn btn-primary"
                      style={{ fontSize: '0.8rem', padding: '0.45rem 0.8rem', background: '#dc2626', borderColor: '#dc2626', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}
                      title="Ampliar automáticamente el plazo por 7 días más"
                    >
                      <RotateCcw size={14} /> {reactivatingActivity ? 'Reactivando...' : 'Reactivar (+7 días)'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAdminReinforcementOpen(true)}
                      className="btn btn-outline"
                      style={{ fontSize: '0.8rem', padding: '0.45rem 0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                    >
                      <Calendar size={14} /> Personalizar plazo
                    </button>
                  </div>
                )}
              </div>
            )}

            {activityState === 'completada' && completedResult && (() => {
              const maxAttempts = activityConfig?.maxAttempts ?? 1;
              const completedCount = completedResult?.attemptsCount || userAttempts.filter(a => a.status === 'completed').length || 1;
              const canRetry = (maxAttempts === 0 || completedCount < maxAttempts) && activityState !== 'vencida';
              const remainingAttempts = maxAttempts === 0 ? 'Ilimitados' : Math.max(0, maxAttempts - completedCount);

              return (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: '#166534', fontSize: '0.88rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <CheckCircle2 size={16} /> Actividad realizada
                      </span>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
                        {maxAttempts === 0 ? `Intento ${completedCount}` : `Intento ${completedCount} de ${maxAttempts}`}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#15803d', marginTop: '4px' }}>
                      Puntaje: <strong>{completedResult.totalCount > 0 ? Math.round(((completedResult.correctCount ?? 0) / completedResult.totalCount) * 100) : (completedResult.scorePct || 0)}%</strong> ({completedResult.correctCount}/{completedResult.totalCount})
                      {completedResult.bestScore !== undefined && completedResult.bestScore !== completedResult.scorePct && (
                        <span> • Mejor: <strong>{completedResult.bestScore}%</strong></span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#166534', marginTop: '2px' }}>
                      {completedResult.completedAt}
                    </div>
                    {activityConfig?.isMandatory && programProgressDetails && (
                      <div style={{ fontSize: '0.74rem', color: '#166534', marginTop: '4px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Award size={13} /> Aporte al programa: {programProgressDetails.percentage}%
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                    <button
                      onClick={handleViewReview}
                      className="btn btn-outline"
                      style={{ width: '100%', fontSize: '0.8rem', padding: '0.45rem 0.8rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    >
                      <BookOpen size={14} /> Ver revisión de respuestas
                    </button>
                    {canRetry && (
                      <button
                        onClick={handleRetakeActivity}
                        className="btn btn-primary"
                        style={{ width: '100%', fontSize: '0.8rem', padding: '0.5rem 0.8rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                      >
                        <RotateCcw size={14} /> Realizar nuevo intento ({remainingAttempts} {remainingAttempts === 1 ? 'disponible' : 'disponibles'})
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* BOTÓN ADMINISTRATIVO / DOCENTE PARA GESTIONAR ACTIVIDAD CON IA */}
            {canManageContent && (
              <div style={{ marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: '1px dashed var(--border-color)' }}>
                <button
                  type="button"
                  onClick={() => setIsAdminReinforcementOpen(true)}
                  style={{
                    width: '100%',
                    background: 'linear-gradient(135deg, #1e3a5f 0%, #14213D 100%)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.6rem 0.85rem',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.45rem',
                    boxShadow: '0 2px 6px rgba(20,33,61,0.2)'
                  }}
                >
                  <Zap size={14} color="var(--gold)" /> Gestionar Actividad con IA
                </button>
              </div>
            )}

          </div>

          {/* 2. ENVIAR UNA DUDA O GESTIÓN DE DUDAS (ADMIN / DOCENTE) */}
          <div className="card-placeholder order-dudas">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.6rem', flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--navy)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <HelpCircle size={18} color="var(--gold-dark)" />
                {canManageContent ? `Dudas de Estudiantes (${allClassDoubts.length})` : '¿Tienes una duda sobre esta clase?'}
              </h3>
              <span style={{ background: '#eff6ff', color: '#1d4ed8', fontSize: '0.72rem', padding: '0.2rem 0.55rem', borderRadius: '12px', fontWeight: 600 }}>
                {canManageContent ? (isAdmin ? 'Gestión Administrativa' : 'Atención Docente') : 'Atención docente'}
              </span>
            </div>

            {canManageContent ? (
              <div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 1rem 0', lineHeight: 1.45 }}>
                  Preguntas enviadas por los estudiantes sobre los temas de esta sesión.
                </p>

                {allClassDoubts.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '1.25rem 1rem', background: 'var(--surface-light)', borderRadius: '8px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                    No hay dudas registradas por estudiantes para esta clase aún.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    {allClassDoubts.map(doubt => (
                      <div key={doubt.id} style={{
                        padding: '0.75rem 0.9rem',
                        background: 'var(--surface-light)',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '4px' }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy)' }}>
                            {doubt.subject}
                          </span>
                          <span style={{
                            fontSize: '0.68rem', fontWeight: 700, padding: '2px 7px', borderRadius: '10px',
                            background: doubt.status === 'atendida' ? '#dcfce7' :
                                        doubt.status === 'revisada' ? '#fef3c7' : '#dbeafe',
                            color: doubt.status === 'atendida' ? '#166534' :
                                   doubt.status === 'revisada' ? '#92400e' : '#1e40af'
                          }}>
                            {doubt.status === 'atendida' ? 'Atendida' :
                             doubt.status === 'revisada' ? 'Revisada' : 'Enviada'}
                          </span>
                        </div>
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0 0 6px 0', lineHeight: 1.4 }}>
                          {doubt.description}
                        </p>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                          <span>Alumno: <strong>{doubt.users_profile?.full_name || doubt.users_profile?.email || 'Estudiante'}</strong></span>
                          <span>{doubt.created_at ? new Date(doubt.created_at).toLocaleDateString('es-CO') : ''}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 1rem 0', lineHeight: 1.45 }}>
                  Envía tu pregunta para que el docente pueda revisarla y atenderla durante la clase.
                </p>

                <button
                  ref={doubtButtonRef}
                  onClick={openDoubtModal}
                  className="btn"
                  style={{
                    width: '100%',
                    background: 'var(--navy)',
                    color: '#ffffff',
                    border: 'none',
                    padding: '0.6rem 1rem',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.45rem',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(20, 33, 61, 0.2)'
                  }}
                >
                  <Send size={15} /> Enviar una duda
                </button>

                {/* LISTA DE DUDAS ENVIADAS POR EL ESTUDIANTE EN ESTA CLASE */}
                {userDoubts.length > 0 && (
                  <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                    <h4 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <MessageSquare size={15} color="var(--gold-dark)" />
                      Mis dudas enviadas ({userDoubts.length})
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      {userDoubts.map(doubt => (
                        <div key={doubt.id} style={{
                          padding: '0.65rem 0.85rem',
                          background: 'var(--surface-light)',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '4px' }}>
                            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--navy)', lineHeight: 1.3 }}>
                              {doubt.subject}
                            </span>
                            <span style={{
                              fontSize: '0.68rem',
                              padding: '0.15rem 0.5rem',
                              borderRadius: '10px',
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                              background: doubt.status === 'atendida' ? '#dcfce7' :
                                          doubt.status === 'revisada' ? '#fef3c7' :
                                          doubt.status === 'archivada' ? '#f1f5f9' : '#dbeafe',
                              color: doubt.status === 'atendida' ? '#166534' :
                                     doubt.status === 'revisada' ? '#92400e' :
                                     doubt.status === 'archivada' ? '#475569' : '#1e40af'
                            }}>
                              {doubt.status === 'atendida' ? 'Atendida en clase' :
                               doubt.status === 'revisada' ? 'Revisada' :
                               doubt.status === 'archivada' ? 'Archivada' : 'Enviada'}
                            </span>
                          </div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {new Date(doubt.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* PREPARACIÓN VISUAL DE ETIQUETAS DE ESTADOS FUTUROS CUANDO NO HAY DUDAS */}
                {userDoubts.length === 0 && (
                  <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px dashed var(--border-color)' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>
                      ESTADOS DE REVISIÓN:
                    </span>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '10px', background: '#dbeafe', color: '#1e40af', fontWeight: 600 }}>Enviada</span>
                      <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '10px', background: '#fef3c7', color: '#92400e', fontWeight: 600 }}>Revisada</span>
                      <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '10px', background: '#dcfce7', color: '#166534', fontWeight: 600 }}>Atendida en clase</span>
                      <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '10px', background: '#f1f5f9', color: '#475569', fontWeight: 600 }}>Archivada</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>

      </div>

      {/* 3. MODAL ACCESIBLE DE ENVÍO DE DUDA */}
      {isDoubtModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '1rem',
            animation: 'fadeIn 0.2s ease-out'
          }}
          onClick={closeDoubtModal}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '560px',
              maxHeight: '90vh',
              overflowY: 'auto',
              background: '#ffffff',
              borderRadius: 'var(--radius-lg, 16px)',
              padding: '1.75rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
              position: 'relative',
              animation: 'fadeSlideUp 0.25s ease-out',
              border: '1px solid var(--border-color, #e2e8f0)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* BOTÓN CERRAR */}
            <button
              type="button"
              onClick={closeDoubtModal}
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
                justifyContent: 'center'
              }}
            >
              <X size={20} />
            </button>

            {/* ENCABEZADO DEL MODAL */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  background: '#eff6ff',
                  color: 'var(--navy)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <HelpCircle size={22} color="var(--gold-dark)" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--navy)' }}>
                  Enviar Duda al Docente
                </h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Clase: {clsData.title}
                </span>
              </div>
            </div>

            {/* TEXTO INFORMATIVO REQUERIDO */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              marginBottom: '1.25rem',
              fontSize: '0.82rem',
              color: 'var(--text-secondary, #475569)',
              lineHeight: 1.45,
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.5rem'
            }}>
              <Info size={16} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--gold-dark)' }} />
              <span>
                Tu duda será revisada por el docente para ser atendida durante la clase o en el espacio académico correspondiente.
              </span>
            </div>

            {/* MENSAJE DE ÉXITO EXIGIDO TRAS INSERCIÓN */}
            {successMsg && (
              <div style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '8px',
                padding: '0.75rem 1rem',
                marginBottom: '1.25rem',
                fontSize: '0.83rem',
                color: '#166534',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <FileCheck size={18} color="#16a34a" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* MENSAJE DE ERROR AMIGABLE */}
            {submitError && (
              <div style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                padding: '0.75rem 1rem',
                marginBottom: '1.25rem',
                fontSize: '0.83rem',
                color: '#991b1b',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <AlertCircle size={18} color="#dc2626" />
                <span>{submitError}</span>
              </div>
            )}

            {/* FORMULARIO DE DUDAS */}
            <form onSubmit={handleSubmitDoubt} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              
              {/* 1. ASUNTO DE LA DUDA */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontWeight: 600, fontSize: '0.84rem', color: 'var(--navy)' }}>
                    Asunto de la duda <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <span style={{ fontSize: '0.74rem', color: subject.length > 120 ? '#dc2626' : 'var(--text-muted)' }}>
                    {subject.length} / 120
                  </span>
                </div>
                <input
                  ref={firstInputRef}
                  type="text"
                  className="doubt-input"
                  value={subject}
                  maxLength={120}
                  onChange={(e) => {
                    setSubject(e.target.value);
                    if (!touched.subject) setTouched(prev => ({ ...prev, subject: true }));
                  }}
                  onBlur={() => setTouched(prev => ({ ...prev, subject: true }))}
                  placeholder="Ej: Aclaración sobre la fórmula de rendimiento..."
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.85rem',
                    border: subjectError ? '1px solid #dc2626' : '1px solid var(--border-color)',
                    borderRadius: '8px',
                    fontSize: '0.86rem'
                  }}
                />
                {subjectError && (
                  <span style={{ fontSize: '0.76rem', color: '#dc2626', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <AlertCircle size={13} /> {subjectError}
                  </span>
                )}
              </div>

              {/* 2. DESCRIPCIÓN */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontWeight: 600, fontSize: '0.84rem', color: 'var(--navy)' }}>
                    Descripción detallada <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <span style={{ fontSize: '0.74rem', color: description.length > 1500 ? '#dc2626' : 'var(--text-muted)' }}>
                    {description.length} / 1500
                  </span>
                </div>
                <textarea
                  rows={4}
                  className="doubt-textarea"
                  value={description}
                  maxLength={1500}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    if (!touched.description) setTouched(prev => ({ ...prev, description: true }));
                  }}
                  onBlur={() => setTouched(prev => ({ ...prev, description: true }))}
                  placeholder="Describe en detalle tu consulta o inquietud técnica..."
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.85rem',
                    border: descriptionError ? '1px solid #dc2626' : '1px solid var(--border-color)',
                    borderRadius: '8px',
                    fontSize: '0.86rem',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    minHeight: '100px'
                  }}
                />
                {descriptionError && (
                  <span style={{ fontSize: '0.76rem', color: '#dc2626', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <AlertCircle size={13} /> {descriptionError}
                  </span>
                )}
              </div>

              {/* 3. TEMA RELACIONADO (OPCIONAL) */}
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '0.84rem', color: 'var(--navy)' }}>
                  Tema relacionado (opcional)
                </label>
                <input
                  type="text"
                  className="doubt-input"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Ej: Módulo 1 - Fundamentos"
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.85rem',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    fontSize: '0.86rem'
                  }}
                />
              </div>

              {/* DATOS AUTOMÁTICOS (CONTEXTO INTERNO LISTO PARA SUPABASE) */}
              <div style={{
                background: '#f8fafc',
                borderRadius: '8px',
                padding: '0.6rem 0.85rem',
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                display: 'flex',
                gap: '1rem',
                flexWrap: 'wrap'
              }}>
                <span>Docente: <strong>{clsData.teacher_profiles?.name || 'Asignado'}</strong></span>
                <span>Estudiante: <strong>{currentUser?.full_name || 'Autenticado'}</strong></span>
              </div>

              {/* ACCIONES DEL FORMULARIO */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={closeDoubtModal}
                  className="btn btn-outline"
                  style={{ padding: '0.55rem 1.1rem', fontSize: '0.85rem', fontWeight: 600, borderRadius: '8px' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!isFormValid || submitting}
                  className="btn"
                  style={{
                    padding: '0.55rem 1.25rem',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    borderRadius: '8px',
                    background: isFormValid && !submitting ? 'var(--navy)' : '#e2e8f0',
                    color: isFormValid && !submitting ? '#ffffff' : '#94a3b8',
                    border: 'none',
                    cursor: isFormValid && !submitting ? 'pointer' : 'not-allowed',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    boxShadow: isFormValid && !submitting ? '0 2px 4px rgba(20, 33, 61, 0.2)' : 'none'
                  }}
                >
                  <Send size={15} /> {submitting ? 'Guardando...' : 'Enviar una duda'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL / EXPERIENCIA INTERACTIVA DE LA ACTIVIDAD DE REFORZAMIENTO */}
      {/* =================================================================== */}
      {isActivityModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(20, 33, 61, 0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '1rem', backdropFilter: 'blur(4px)'
        }}>
          <div className="card" style={{
            width: '100%', maxWidth: '720px', maxHeight: '90vh',
            overflowY: 'auto', background: 'var(--white)',
            borderRadius: '16px', border: '1px solid var(--border-color)',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)', padding: '2rem',
            position: 'relative', animation: 'fadeSlideUp 0.3s ease-out'
          }}>
            
            {/* BOTÓN CERRAR MODAL */}
            <button
              onClick={() => setIsActivityModalOpen(false)}
              style={{
                position: 'absolute', top: '1.25rem', right: '1.25rem',
                background: 'transparent', border: 'none', color: 'var(--text-muted)',
                cursor: 'pointer', padding: '0.4rem', borderRadius: '50%'
              }}
              aria-label="Cerrar modal de actividad"
            >
              <X size={22} />
            </button>

            {/* ─── CASO 1: MODO REVISIÓN DE RESULTADOS ─── */}
            {viewingResultsMode && completedResult ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ textAlign: 'center', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(252, 163, 17, 0.15)', color: 'var(--gold-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto' }}>
                    <Award size={36} />
                  </div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--navy)', margin: '0 0 0.35rem 0' }}>
                    Actividad completada
                  </h2>
                  <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                    Resumen de evaluación para: <strong>{clsData?.title}</strong>
                  </div>
                </div>

                {/* MENSAJE OBLIGATORIO DE PROGRESO */}
                <div style={{
                  background: '#f0fdf4', border: '1px solid #bbf7d0',
                  color: '#166534', padding: '0.85rem 1.25rem', borderRadius: '10px',
                  display: 'flex', alignItems: 'center', gap: '0.65rem',
                  fontWeight: 700, fontSize: '0.9rem'
                }}>
                  <CheckCircle2 size={20} color="#166534" />
                  <span>Tu progreso del programa se ha actualizado.</span>
                </div>

                {/* TARJETA DE NOTA Y PUNTAJE */}
                {(() => {
                  const maxAttempts = activityConfig?.maxAttempts ?? 1;
                  const completedCount = completedResult?.attemptsCount || userAttempts.filter(a => a.status === 'completed').length || 1;
                  const canRetry = (maxAttempts === 0 || completedCount < maxAttempts) && activityState !== 'vencida';
                  const remainingAttempts = maxAttempts === 0 ? 'Ilimitados' : Math.max(0, maxAttempts - completedCount);

                  return (
                    <div style={{
                      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                      gap: '1rem', background: 'var(--bg-light)', padding: '1.25rem',
                      borderRadius: '12px', border: '1px solid var(--border-color)', textAlign: 'center'
                    }}>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Puntaje Obtenido</div>
                        <div style={{ fontSize: '1.7rem', fontWeight: 800, color: 'var(--navy)', lineHeight: 1.2, marginTop: '4px' }}>
                          {completedResult?.totalCount > 0 ? Math.round(((completedResult.correctCount ?? 0) / completedResult.totalCount) * 100) : (completedResult?.scorePct ?? 0)}%
                        </div>
                        {completedResult?.bestScore !== undefined && completedResult.bestScore !== completedResult.scorePct && (
                          <div style={{ fontSize: '0.72rem', color: '#166534', fontWeight: 700, marginTop: '2px' }}>
                            Mejor: {completedResult.bestScore}%
                          </div>
                        )}
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Aciertos</div>
                        <div style={{ fontSize: '1.7rem', fontWeight: 800, color: '#166534', lineHeight: 1.2, marginTop: '4px' }}>
                          {completedResult?.correctCount ?? 0} / {completedResult?.totalCount ?? (activityConfig?.questions?.length || 0)}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Intentos</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--navy)', marginTop: '8px' }}>
                          {maxAttempts === 0 ? `${completedCount} realizados` : `${completedCount} / ${maxAttempts}`}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: canRetry ? '#15803d' : 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>
                          {canRetry ? `${remainingAttempts} ${remainingAttempts === 1 ? 'restante' : 'restantes'}` : 'Sin intentos restantes'}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Fecha</div>
                        <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--navy)', marginTop: '12px' }}>
                          {completedResult?.completedAt || 'Reciente'}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* REVISIÓN DETALLADA DE PREGUNTAS */}
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--navy)', marginBottom: '1rem' }}>
                    Revisión de respuestas y retroalimentación
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {activityConfig.questions.map((q, idx) => {
                      const userChoice = userAnswers[q.id];
                      const isCorrect = userChoice && q.correctOptionId && String(userChoice) === String(q.correctOptionId);
                      const isAnswered = !!userChoice;

                      return (
                        <div key={q.id} style={{
                          padding: '1.2rem 1.35rem', borderRadius: '12px',
                          border: isCorrect ? '1.5px solid #86efac' : isAnswered ? '1.5px solid #fca5a5' : '1.5px solid #cbd5e1',
                          background: isCorrect ? '#f0fdf4' : isAnswered ? '#fef2f2' : '#f8fafc',
                          boxShadow: '0 2px 5px rgba(0,0,0,0.03)'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.75rem' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--navy)', lineHeight: 1.4 }}>
                              {idx + 1}. {q.statement}
                            </span>
                            <span style={{
                              fontSize: '0.75rem', fontWeight: 700, padding: '3px 10px', borderRadius: '12px',
                              background: isCorrect ? '#dcfce7' : isAnswered ? '#fee2e2' : '#f1f5f9',
                              color: isCorrect ? '#166534' : isAnswered ? '#dc2626' : '#64748b',
                              flexShrink: 0
                            }}>
                              {isCorrect ? '✓ Correcta' : isAnswered ? '✗ Incorrecta' : 'Clave de respuesta'}
                            </span>
                          </div>

                          {/* LISTA DE OPCIONES */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', margin: '0.6rem 0' }}>
                            {q.options.map(opt => {
                              const isSelected = userChoice && String(userChoice) === String(opt.id);
                              const isRightOption = q.correctOptionId && String(q.correctOptionId) === String(opt.id);

                              return (
                                <div key={opt.id} style={{
                                  padding: '0.6rem 0.85rem', borderRadius: '8px',
                                  background: isRightOption ? '#dcfce7' : isSelected ? '#fee2e2' : '#ffffff',
                                  border: isRightOption ? '2px solid #22c55e' : isSelected ? '2px solid #ef4444' : '1px solid #e2e8f0',
                                  fontWeight: isSelected || isRightOption ? 700 : 400,
                                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                  gap: '0.75rem', fontSize: '0.88rem'
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{
                                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                      width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
                                      background: isRightOption ? '#166534' : isSelected ? '#dc2626' : '#cbd5e1',
                                      color: '#ffffff', fontSize: '11px', fontWeight: 700
                                    }}>
                                      {isRightOption ? '✓' : isSelected ? '✗' : '•'}
                                    </span>
                                    <span style={{ color: 'var(--navy)' }}>{opt.text}</span>
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                    {isSelected && (
                                      <span style={{
                                        fontSize: '0.72rem', padding: '2px 8px', borderRadius: '6px',
                                        background: isRightOption ? '#15803d' : '#b91c1c',
                                        color: '#ffffff', fontWeight: 700
                                      }}>
                                        {isRightOption ? 'Tu respuesta ✓' : 'Tu selección'}
                                      </span>
                                    )}
                                    {isRightOption && !isSelected && (
                                      <span style={{
                                        fontSize: '0.72rem', padding: '2px 8px', borderRadius: '6px',
                                        background: '#dcfce7', color: '#166534', fontWeight: 700, border: '1px solid #86efac'
                                      }}>
                                        Respuesta correcta
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* ACLARACIÓN / RETROALIMENTACIÓN PEDAGÓGICA */}
                          {(() => {
                            const exp = (q.explanation || '').trim();
                            const src = (q.sourceBasis || '').trim();
                            const correctOpt = (q.options || []).find(o => String(o.id) === String(q.correctOptionId));
                            const defaultFeedback = correctOpt 
                              ? `La opción correcta es "${correctOpt.text}". Revisa los conceptos explicados en esta sesión para afianzar tus conocimientos.`
                              : 'Revisa el material audiovisual y documentos de apoyo de la clase para reforzar este tema.';
                            
                            const feedbackText = exp || src || defaultFeedback;

                            return (
                              <div style={{
                                marginTop: '0.85rem', fontSize: '0.84rem', color: '#1e40af',
                                background: '#eff6ff', padding: '0.8rem 1rem', borderRadius: '10px',
                                border: '1px solid #bfdbfe',
                                lineHeight: 1.5,
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '0.6rem'
                              }}>
                                <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>💡</span>
                                <div style={{ flex: 1 }}>
                                  <strong style={{ display: 'block', color: '#1d4ed8', marginBottom: '2px', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                    Retroalimentación Pedagógica
                                  </strong>
                                  <span>{feedbackText}</span>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {(() => {
                  const maxAttempts = activityConfig?.maxAttempts ?? 1;
                  const completedCount = completedResult?.attemptsCount || userAttempts.filter(a => a.status === 'completed').length || 1;
                  const canRetry = (maxAttempts === 0 || completedCount < maxAttempts) && activityState !== 'vencida';
                  const remainingAttempts = maxAttempts === 0 ? 'Ilimitados' : Math.max(0, maxAttempts - completedCount);

                  return (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', flexWrap: 'wrap', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
                      <button onClick={() => setIsActivityModalOpen(false)} className="btn btn-outline" style={{ padding: '0.6rem 1.4rem', fontWeight: 600 }}>
                        Cerrar y volver a la clase
                      </button>
                      {canRetry && (
                        <button
                          onClick={handleRetakeActivity}
                          className="btn btn-primary"
                          style={{
                            padding: '0.6rem 1.4rem',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}
                        >
                          <RotateCcw size={16} /> Realizar nuevo intento ({remainingAttempts} {remainingAttempts === 1 ? 'restante' : 'restantes'})
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>

            ) : showConfirmFinishModal ? (
              
              /* ─── CASO 2: MODAL DE CONFIRMACIÓN DE FINALIZACIÓN ─── */
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(252, 163, 17, 0.15)', color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto' }}>
                  <HelpCircle size={32} color="var(--gold-dark)" />
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--navy)', marginBottom: '0.5rem' }}>
                  ¿Deseas finalizar la actividad?
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '480px', margin: '0 auto 1.5rem auto', lineHeight: 1.5 }}>
                  Has respondido <strong>{Object.keys(userAnswers).length}</strong> de <strong>{activityConfig.questions.length}</strong> preguntas.
                  {Object.keys(userAnswers).length < activityConfig.questions.length && (
                    <span style={{ display: 'block', color: '#dc2626', fontWeight: 600, marginTop: '0.5rem' }}>
                      ⚠️ Tienes preguntas sin responder.
                    </span>
                  )}
                </p>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
                  <button
                    onClick={() => setShowConfirmFinishModal(false)}
                    className="btn btn-outline"
                    style={{ padding: '0.55rem 1.25rem', fontSize: '0.85rem', fontWeight: 600 }}
                  >
                    Volver a revisar
                  </button>
                  <button
                    onClick={handleFinishAttempt}
                    className="btn btn-primary"
                    style={{ padding: '0.55rem 1.4rem', fontSize: '0.85rem', fontWeight: 700 }}
                  >
                    Sí, finalizar actividad
                  </button>
                </div>
              </div>

            ) : (

              /* ─── CASO 3: INTENTO ACTIVO EN PROGRESO (PREGUNTA X DE Y) ─── */
              <div>
                {/* HEADER CON BARRA DE PROGRESO */}
                <div style={{ marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--gold-dark)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Actividad de reforzamiento
                    </span>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--navy)', background: 'var(--bg-light)', padding: '0.2rem 0.65rem', borderRadius: '12px' }}>
                      Pregunta {currentQuestionIdx + 1} de {activityConfig.questions.length}
                    </span>
                  </div>

                  {/* BARRA DE AVANCE INTERNA (100% NEUTRAL - NAVY & GOLD) */}
                  <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '9999px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${((currentQuestionIdx + 1) / activityConfig.questions.length) * 100}%`,
                      height: '100%',
                      background: 'var(--navy)',
                      transition: 'width 0.3s ease-out'
                    }} />
                  </div>
                </div>

                {/* PREGUNTA ACTUAL */}
                {(() => {
                  const currentQ = activityConfig.questions[currentQuestionIdx];
                  const selectedOptId = userAnswers[currentQ.id];

                  return (
                    <div style={{ minHeight: '280px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div>
                        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--navy)', marginBottom: '1.25rem', lineHeight: 1.35 }}>
                          {currentQ.statement}
                        </h3>

                        {/* OPCIONES DE RESPUESTA CON ÁREAS CLICABLES AMPLIAS */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          {currentQ.options.map(opt => {
                            const isSelected = selectedOptId === opt.id;

                            return (
                              <div
                                key={opt.id}
                                onClick={() => handleOptionSelect(currentQ.id, opt.id)}
                                onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && handleOptionSelect(currentQ.id, opt.id)}
                                tabIndex={0}
                                role="radio"
                                aria-checked={isSelected}
                                style={{
                                  padding: '1rem 1.25rem',
                                  borderRadius: '12px',
                                  border: isSelected ? '2px solid var(--navy)' : '1px solid var(--border-color)',
                                  background: isSelected ? '#eff6ff' : 'var(--white)',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease-in-out',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: '0.85rem',
                                  boxShadow: isSelected ? '0 2px 6px rgba(20, 33, 61, 0.12)' : 'none',
                                  outline: 'none'
                                }}
                                onFocus={e => e.currentTarget.style.borderColor = 'var(--gold-dark)'}
                                onBlur={e => e.currentTarget.style.borderColor = isSelected ? 'var(--navy)' : 'var(--border-color)'}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                                  {/* CIRCULO INDICADOR RADIO */}
                                  <div style={{
                                    width: '20px', height: '20px', borderRadius: '50%',
                                    border: isSelected ? '6px solid var(--navy)' : '2px solid #cbd5e1',
                                    background: '#ffffff', flexShrink: 0,
                                    transition: 'all 0.15s ease'
                                  }} />
                                  <span style={{ fontSize: '0.92rem', color: 'var(--navy)', fontWeight: isSelected ? 700 : 500 }}>
                                    {opt.text}
                                  </span>
                                </div>

                                {isSelected && (
                                  <span style={{
                                    fontSize: '0.74rem', fontWeight: 700,
                                    background: 'var(--navy)', color: '#ffffff',
                                    padding: '2px 8px', borderRadius: '6px',
                                    flexShrink: 0
                                  }}>
                                    Seleccionada
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* CONTROLES DE NAVEGACIÓN (ANTERIOR / SIGUIENTE / FINALIZAR) */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                        <button
                          onClick={handlePrevQuestion}
                          disabled={currentQuestionIdx === 0}
                          className="btn btn-outline"
                          style={{
                            fontSize: '0.85rem', padding: '0.55rem 1rem',
                            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                            opacity: currentQuestionIdx === 0 ? 0.4 : 1,
                            cursor: currentQuestionIdx === 0 ? 'not-allowed' : 'pointer'
                          }}
                        >
                          <ArrowLeft size={16} /> Anterior
                        </button>

                        {currentQuestionIdx < activityConfig.questions.length - 1 ? (
                          <button
                            onClick={handleNextQuestion}
                            className="btn btn-primary"
                            style={{ fontSize: '0.85rem', padding: '0.55rem 1.25rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}
                          >
                            Siguiente <ArrowRight size={16} />
                          </button>
                        ) : (
                          <button
                            onClick={() => setShowConfirmFinishModal(true)}
                            className="btn"
                            style={{
                              fontSize: '0.85rem', padding: '0.55rem 1.25rem',
                              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                              background: 'var(--navy)', color: '#ffffff', border: 'none',
                              borderRadius: '8px', fontWeight: 700, cursor: 'pointer',
                              boxShadow: '0 2px 4px rgba(20, 33, 61, 0.2)'
                            }}
                          >
                            <CheckCircle2 size={16} /> Finalizar actividad
                          </button>
                        )}
                      </div>

                    </div>
                  );
                })()}

              </div>
            )}

          </div>
        </div>
      )}

      {/* MODAL VISOR DE DOCUMENTO IN-APP (SIN REDIRECCIÓN EXTERNA) */}
      {selectedDoc && createPortal(
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 99999,
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
              borderBottom: '1px solid var(--border-color, #e2e8f0)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#f8fafc',
              flexShrink: 0
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                <div style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  background: 'var(--navy, #14213d)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  flexShrink: 0
                }}>
                  <FileText size={17} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <h3 style={{
                    margin: 0,
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    color: 'var(--navy, #14213d)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {selectedDoc.title || 'Documento de la Clase'}
                  </h3>
                  {selectedDoc.description && (
                    <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-muted, #64748b)' }}>
                      {selectedDoc.description}
                    </p>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {(selectedDoc.allow_download || canManageContent) && (
                  <button
                    type="button"
                    onClick={() => triggerResourceDownload(selectedDoc.url, selectedDoc.title)}
                    title="Descargar material a tu equipo"
                    style={{
                      background: 'var(--navy, #14213d)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '0.45rem 0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      cursor: 'pointer',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                    }}
                  >
                    <Download size={14} color="var(--gold, #FCA311)" /> Descargar
                  </button>
                )}
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
                    color: 'var(--navy, #14213d)',
                    transition: 'background 0.2s'
                  }}
                >
                  <X size={16} /> Cerrar
                </button>
              </div>
            </div>

            {/* Contenedor del Iframe con Bloqueador de Redirección */}
            <div style={{ flex: 1, position: 'relative', width: '100%', height: '100%', background: '#0f172a' }}>
              {/* Bloqueador invisible sobre la esquina superior derecha para inhabilitar el botón de redirección de Google Drive */}
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
        </div>,
        document.body
      )}

      {/* =================================================================== */}
      {/* MODALES DE GESTIÓN ADMINISTRATIVA */}
      {/* =================================================================== */}

      {/* 1. MODAL AGREGAR / EDITAR RECURSO */}
      {isResourceModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '1rem'
        }}>
          <div style={{
            background: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '540px',
            maxHeight: '92vh', overflowY: 'auto', padding: '1.75rem',
            boxShadow: '0 20px 45px rgba(0,0,0,0.25)', position: 'relative',
            animation: 'fadeSlideUp 0.3s ease-out'
          }}>
            <button
              onClick={() => setIsResourceModalOpen(false)}
              style={{
                position: 'absolute', top: '1.25rem', right: '1.25rem',
                background: '#f1f5f9', border: 'none', borderRadius: '50%',
                width: '32px', height: '32px', display: 'flex', alignItems: 'center',
                justifyContent: 'center', cursor: 'pointer', color: '#64748b'
              }}
            >
              <X size={18} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Paperclip size={20} color="var(--gold)" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--navy)' }}>
                  {resourceModalMode === 'edit' ? 'Editar Material de Estudio' : 'Agregar Material de Estudio'}
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  El material estará disponible inmediatamente para los estudiantes.
                </p>
              </div>
            </div>

            {/* Pestañas (solo en modo creación) */}
            {resourceModalMode === 'create' && (
              <div style={{ display: 'flex', borderBottom: '2px solid var(--border-color)', marginBottom: '1.25rem' }}>
                <button
                  type="button"
                  onClick={() => setResActiveTab('upload')}
                  style={{
                    flex: 1, padding: '0.6rem', border: 'none', background: 'none', cursor: 'pointer',
                    fontWeight: 700, fontSize: '0.82rem',
                    borderBottom: resActiveTab === 'upload' ? '2px solid var(--gold-dark)' : '2px solid transparent',
                    color: resActiveTab === 'upload' ? 'var(--navy)' : 'var(--text-muted)',
                    marginBottom: '-2px', transition: 'all 0.15s'
                  }}
                >
                  <Upload size={14} style={{ display: 'inline', marginRight: 4 }} /> Subir PDF (Google Drive)
                </button>
                <button
                  type="button"
                  onClick={() => setResActiveTab('link')}
                  style={{
                    flex: 1, padding: '0.6rem', border: 'none', background: 'none', cursor: 'pointer',
                    fontWeight: 700, fontSize: '0.82rem',
                    borderBottom: resActiveTab === 'link' ? '2px solid var(--gold-dark)' : '2px solid transparent',
                    color: resActiveTab === 'link' ? 'var(--navy)' : 'var(--text-muted)',
                    marginBottom: '-2px', transition: 'all 0.15s'
                  }}
                >
                  <ExternalLink size={14} style={{ display: 'inline', marginRight: 4 }} /> Vincular Enlace Web
                </button>
              </div>
            )}

            {resFormError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '0.65rem 0.9rem', borderRadius: '8px', fontSize: '0.82rem', marginBottom: '1rem' }}>
                {resFormError}
              </div>
            )}
            {resFormSuccess && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '0.65rem 0.9rem', borderRadius: '8px', fontSize: '0.82rem', marginBottom: '1rem' }}>
                {resFormSuccess}
              </div>
            )}

            <form onSubmit={handleSubmitResource} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {resActiveTab === 'upload' ? (
                <>
                  {/* Zona de Drag and Drop PDF */}
                  <div
                    onDragOver={e => { e.preventDefault(); setIsDragOverPdf(true); }}
                    onDragLeave={() => setIsDragOverPdf(false)}
                    onDrop={e => {
                      e.preventDefault();
                      setIsDragOverPdf(false);
                      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        const f = e.dataTransfer.files[0];
                        if (f.type === 'application/pdf' || f.name.endsWith('.pdf')) {
                          setUploadPdfFile(f);
                          if (!resFormTitle) setResFormTitle(f.name.replace(/\.[^/.]+$/, ''));
                        } else {
                          setResFormError('Por favor selecciona un archivo en formato PDF.');
                        }
                      }
                    }}
                    style={{
                      border: `2px dashed ${isDragOverPdf ? 'var(--gold)' : uploadPdfFile ? '#16a34a' : '#cbd5e1'}`,
                      borderRadius: '12px',
                      background: isDragOverPdf ? 'rgba(252,163,17,0.06)' : uploadPdfFile ? '#f0fdf4' : '#f8fafc',
                      padding: '1.75rem 1rem',
                      textAlign: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onClick={() => document.getElementById('class-pdf-file-input')?.click()}
                  >
                    <input
                      id="class-pdf-file-input"
                      type="file"
                      accept=".pdf,application/pdf"
                      style={{ display: 'none' }}
                      onChange={e => {
                        if (e.target?.files?.[0]) {
                          const f = e.target.files[0];
                          setUploadPdfFile(f);
                          if (!resFormTitle) setResFormTitle(f.name.replace(/\.[^/.]+$/, ''));
                        }
                      }}
                    />
                    {uploadPdfFile ? (
                      <div>
                        <FileCheck size={36} color="#16a34a" style={{ margin: '0 auto 0.4rem' }} />
                        <div style={{ fontWeight: 700, color: 'var(--navy)', fontSize: '0.92rem' }}>{uploadPdfFile.name}</div>
                        <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '2px' }}>
                          {(uploadPdfFile.size / (1024 * 1024)).toFixed(2)} MB · Listo para subir
                        </div>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setUploadPdfFile(null); }}
                          style={{ marginTop: '0.6rem', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '6px', padding: '0.25rem 0.65rem', fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer' }}
                        >
                          Cambiar archivo
                        </button>
                      </div>
                    ) : (
                      <div>
                        <Upload size={32} color="var(--gold-dark)" style={{ margin: '0 auto 0.4rem' }} />
                        <div style={{ fontWeight: 700, color: 'var(--navy)', fontSize: '0.9rem' }}>
                          Arrastra tu archivo PDF aquí o haz clic para seleccionarlo
                        </div>
                        <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '4px' }}>
                          Soporta diapositivas o guías PDF de hasta 100 MB
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '0.84rem' }}>
                      Título del Material
                    </label>
                    <input
                      type="text"
                      value={resFormTitle}
                      onChange={e => setResFormTitle(e.target.value)}
                      placeholder={uploadPdfFile ? uploadPdfFile.name.replace(/\.[^/.]+$/, '') : "Ej. Diapositivas de la Sesión"}
                      style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.85rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '0.84rem' }}>
                      Tipo de Material
                    </label>
                    <select
                      value={resFormType}
                      onChange={e => setResFormType(e.target.value)}
                      style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.85rem' }}
                    >
                      <option value="presentation">Presentación / Diapositivas</option>
                      <option value="pdf">Documento / Guía PDF</option>
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '0.84rem' }}>
                      Título del Recurso *
                    </label>
                    <input
                      type="text"
                      value={resFormTitle}
                      onChange={e => setResFormTitle(e.target.value)}
                      placeholder="Ej. Código fuente en GitHub / Cuaderno Colab / Enlace Drive"
                      style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.85rem' }}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '0.84rem' }}>
                      URL / Enlace Web *
                    </label>
                    <input
                      type="url"
                      value={resFormUrl}
                      onChange={e => setResFormUrl(e.target.value)}
                      placeholder="https://drive.google.com/... o https://..."
                      style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.85rem' }}
                      required
                    />
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                      Los enlaces a Google Drive se incrustan automáticamente en el visor protegido.
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '0.84rem' }}>
                        Tipo de Recurso
                      </label>
                      <select
                        value={resFormType}
                        onChange={e => setResFormType(e.target.value)}
                        style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.85rem' }}
                      >
                        <option value="presentation">Presentación / Diapositivas</option>
                        <option value="pdf">Documento / PDF</option>
                        <option value="link">Enlace Web Externo</option>
                        <option value="code">Código / Repositorio</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '0.84rem' }}>
                        Descripción (Opcional)
                      </label>
                      <textarea
                        value={resFormDescription}
                        onChange={e => setResFormDescription(e.target.value)}
                        placeholder="Breve nota sobre cómo usar este material..."
                        style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.85rem', minHeight: '60px' }}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* PERMISO DE DESCARGA */}
              <div style={{ background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.84rem', color: 'var(--navy)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={resFormAllowDownload}
                      onChange={e => setResFormAllowDownload(e.target.checked)}
                      style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--navy)' }}
                    />
                    <span>Habilitar descarga a estudiantes</span>
                  </label>
                  <p style={{ margin: '0.2rem 0 0 1.5rem', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    {resFormAllowDownload 
                      ? '✓ Los estudiantes podrán descargar este material a su dispositivo.'
                      : '✗ Modo protegido: los estudiantes solo podrán visualizar el material en la plataforma sin descargarlo.'}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {resFormAllowDownload ? (
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

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setIsResourceModalOpen(false)}
                  style={{ padding: '0.55rem 1rem', background: '#f1f5f9', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={uploadingPdf}
                  className="btn btn-primary"
                  style={{ padding: '0.55rem 1.25rem', fontSize: '0.82rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  {uploadingPdf ? (
                    <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Subiendo...</>
                  ) : (
                    resourceModalMode === 'edit' ? 'Guardar Cambios' : (resActiveTab === 'upload' ? 'Subir a Google Drive' : 'Vincular Recurso')
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. MODAL CONFIRMACIÓN ELIMINAR RECURSO */}
      {resourceToDelete && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '1rem'
        }}>
          <div style={{
            background: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '420px',
            padding: '1.75rem', boxShadow: '0 20px 45px rgba(0,0,0,0.25)', textAlign: 'center'
          }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
              <Trash2 size={24} />
            </div>
            <h3 style={{ margin: '0 0 0.5rem 0', fontWeight: 800, color: 'var(--navy)' }}>
              ¿Eliminar este material?
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem', margin: '0 0 1.25rem 0', lineHeight: 1.4 }}>
              Se eliminará <strong>"{resourceToDelete.title}"</strong> de la lista de recursos visibles para los estudiantes.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setResourceToDelete(null)}
                style={{ padding: '0.55rem 1.2rem', background: '#f1f5f9', border: '1px solid var(--border-color)', borderRadius: '8px', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeletingResource}
                onClick={handleDeleteResourceConfirm}
                style={{ padding: '0.55rem 1.25rem', background: '#dc2626', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}
              >
                {isDeletingResource ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. MODAL EDITAR GRABACIÓN (VIDEO) */}
      {isVideoModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '1rem'
        }}>
          <div style={{
            background: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '480px',
            padding: '1.75rem', boxShadow: '0 20px 45px rgba(0,0,0,0.25)', position: 'relative'
          }}>
            <button
              onClick={() => setIsVideoModalOpen(false)}
              style={{
                position: 'absolute', top: '1.25rem', right: '1.25rem',
                background: '#f1f5f9', border: 'none', borderRadius: '50%',
                width: '32px', height: '32px', display: 'flex', alignItems: 'center',
                justifyContent: 'center', cursor: 'pointer', color: '#64748b'
              }}
            >
              <X size={18} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Video size={20} color="var(--gold)" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--navy)' }}>
                  Configurar Grabación / Video
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Pega el enlace de la grabación para incrustarla en el reproductor protegido.
                </p>
              </div>
            </div>

            {videoModalError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '0.65rem 0.9rem', borderRadius: '8px', fontSize: '0.82rem', marginBottom: '1rem' }}>
                {videoModalError}
              </div>
            )}

            <form onSubmit={handleSaveVideoModal} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '0.84rem' }}>
                  URL de la Grabación (YouTube, Vimeo, Google Drive o Loom)
                </label>
                <input
                  type="url"
                  value={videoInputUrl}
                  onChange={e => setVideoInputUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=... o Google Drive / Vimeo / Loom"
                  style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.85rem' }}
                />
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Deja el campo vacío si deseas desactivar el reproductor temporalmente.
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setIsVideoModalOpen(false)}
                  style={{ padding: '0.55rem 1rem', background: '#f1f5f9', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingVideo}
                  className="btn btn-primary"
                  style={{ padding: '0.55rem 1.25rem', fontSize: '0.82rem', fontWeight: 700 }}
                >
                  {isSavingVideo ? 'Guardando...' : 'Guardar Video'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. MODAL EDITAR DATOS DE LA CLASE */}
      {isEditClassModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '1rem'
        }}>
          <div style={{
            background: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '480px',
            padding: '1.75rem', boxShadow: '0 20px 45px rgba(0,0,0,0.25)', position: 'relative'
          }}>
            <button
              onClick={() => setIsEditClassModalOpen(false)}
              style={{
                position: 'absolute', top: '1.25rem', right: '1.25rem',
                background: '#f1f5f9', border: 'none', borderRadius: '50%',
                width: '32px', height: '32px', display: 'flex', alignItems: 'center',
                justifyContent: 'center', cursor: 'pointer', color: '#64748b'
              }}
            >
              <X size={18} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Pencil size={20} color="var(--gold)" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--navy)' }}>
                  Editar Información de la Clase
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Modifica los datos principales de esta sesión.
                </p>
              </div>
            </div>

            {editClassError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '0.65rem 0.9rem', borderRadius: '8px', fontSize: '0.82rem', marginBottom: '1rem' }}>
                {editClassError}
              </div>
            )}

            <form onSubmit={handleSaveClassModal} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '0.84rem' }}>
                  Título de la Clase *
                </label>
                <input
                  type="text"
                  value={editClassTitle}
                  onChange={e => setEditClassTitle(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.85rem' }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '0.84rem' }}>
                    Fecha y Hora
                  </label>
                  <input
                    type="datetime-local"
                    value={editClassDate}
                    onChange={e => setEditClassDate(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.85rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '0.84rem' }}>
                    Duración (min)
                  </label>
                  <input
                    type="number"
                    value={editClassDuration}
                    onChange={e => setEditClassDuration(e.target.value)}
                    placeholder="120"
                    style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setIsEditClassModalOpen(false)}
                  style={{ padding: '0.55rem 1rem', background: '#f1f5f9', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingClass}
                  className="btn btn-primary"
                  style={{ padding: '0.55rem 1.25rem', fontSize: '0.82rem', fontWeight: 700 }}
                >
                  {isSavingClass ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. MODAL ACTIVIDAD CON IA */}
      {isAdminReinforcementOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '1rem'
        }}>
          <div style={{
            background: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '920px',
            maxHeight: '92vh', overflowY: 'auto', padding: '1.75rem',
            boxShadow: '0 20px 45px rgba(0,0,0,0.25)', position: 'relative',
            animation: 'fadeSlideUp 0.3s ease-out'
          }}>
            <button
              onClick={() => {
                setIsAdminReinforcementOpen(false);
                // Refrescar actividad para actualizar la vista de estudiante
                supabase.from('class_activities').select('*').eq('class_id', id).order('created_at', { ascending: false }).then(({ data }) => {
                  if (data && data.length > 0) {
                    setActivityConfig(data[0]);
                    setActivityState(data[0].is_published ? 'no_iniciada' : 'no_configurada');
                  }
                });
              }}
              style={{
                position: 'absolute', top: '1.25rem', right: '1.25rem',
                background: '#f1f5f9', border: 'none', borderRadius: '50%',
                width: '34px', height: '34px', display: 'flex', alignItems: 'center',
                justifyContent: 'center', cursor: 'pointer', color: '#64748b'
              }}
            >
              <X size={18} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'linear-gradient(135deg, var(--navy) 0%, #1e3a5f 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Zap size={22} color="var(--gold)" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--navy)' }}>
                  Actividad de Reforzamiento con IA
                </h3>
                <p style={{ margin: '3px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Genera preguntas automáticas con Inteligencia Artificial analizando los materiales de la clase, o redacta preguntas manualmente.
                </p>
              </div>
            </div>

            <AdminClassReinforcement 
              classId={id} 
              onOpenUploadModal={() => {
                setIsAdminReinforcementOpen(false);
                openCreateResourceModal();
              }}
            />
          </div>
        </div>
      )}

    </div>
  );
}


