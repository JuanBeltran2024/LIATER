import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { 
  Plus, Trash2, Edit2, CheckCircle2, AlertTriangle, PlayCircle, 
  GripVertical, Save, FileText, Check, Sparkles, RefreshCw, 
  FileQuestion, ExternalLink, Presentation, ChevronDown, ChevronUp, 
  Layers, HelpCircle, ArrowRight, Upload, Calendar, Clock, RotateCcw
} from 'lucide-react';
import { toLocalDatetimeString, parseLocalDatetime, formatClassDate } from '@/utils/dateUtils';

export default function AdminClassReinforcement({ classId, onOpenUploadModal }) {
  const { currentUser } = useAuth();
  const userRole = (currentUser?.role || '').trim().toLowerCase();
  const isAdmin = userRole === 'admin';
  const isTeacher = ['teacher', 'docente', 'profesor'].includes(userRole);
  const isTeacherOrAdmin = isAdmin || isTeacher;

  const [loading, setLoading] = useState(true);
  const [activity, setActivity] = useState(null);
  const [draft, setDraft] = useState(null);
  const [questions, setQuestions] = useState([]);
  
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Estados de edición local
  const [localActivity, setLocalActivity] = useState({
    title: 'Actividad de Reforzamiento',
    description: '',
    is_mandatory: false,
    max_attempts: 1,
    due_date: ''
  });

  const [previewMode, setPreviewMode] = useState(false);
  const [previewQuestionIndex, setPreviewQuestionIndex] = useState(0);
  const [previewSelectedOptions, setPreviewSelectedOptions] = useState({});

  // ==========================================
  // ESTADOS PARA GENERACIÓN DE PREGUNTAS CON IA
  // ==========================================
  const [classResources, setClassResources] = useState([]);
  const [loadingResources, setLoadingResources] = useState(false);
  const [selectedResourceId, setSelectedResourceId] = useState('');
  const [aiMode, setAiMode] = useState('document'); // 'document' | 'transcript'
  const [aiQuestionCount, setAiQuestionCount] = useState(5);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiSuccess, setAiSuccess] = useState('');
  const [generationSource, setGenerationSource] = useState(null); // { type, docTitle, date }
  const [manualTranscript, setManualTranscript] = useState('');
  const [showManualSection, setShowManualSection] = useState(false);
  
  // Modal de confirmación si ya existen preguntas
  const [replaceQuestionsModalOpen, setReplaceQuestionsModalOpen] = useState(false);
  const [pendingDraftToLoad, setPendingDraftToLoad] = useState(null);

  const fetchClassResources = async () => {
    if (!classId) return;
    setLoadingResources(true);
    try {
      const { data, error: resErr } = await supabase
        .from('resources')
        .select('*')
        .eq('class_id', classId)
        .neq('is_visible', false)
        .order('created_at', { ascending: true });

      if (!resErr && data) {
        setClassResources(data);
        if (data.length > 0) {
          // Pre-seleccionar la presentación o el primer documento
          setSelectedResourceId(prev => {
            if (prev && data.some(r => r.id === prev)) return prev;
            const presentation = data.find(r => r.resource_type === 'presentation');
            return presentation ? presentation.id : data[0].id;
          });
        }
      }
    } catch (err) {
      console.error('Error al cargar recursos de la clase para IA:', err);
    } finally {
      setLoadingResources(false);
    }
  };

  const handleGenerateQuestions = async (mode = 'document') => {
    setAiError('');
    setAiSuccess('');

    if (mode === 'document') {
      if (!selectedResourceId) {
        setAiError('Por favor selecciona un material de estudio de la lista para analizar.');
        return;
      }
    } else {
      if (manualTranscript.trim().length < 200) {
        setAiError('La transcripción debe tener al menos 200 caracteres para poder generar preguntas representativas.');
        return;
      }
    }

    setAiGenerating(true);

    try {
      const selectedDoc = classResources.find(r => r.id === selectedResourceId);
      const payload = {
        classId,
        questionCount: aiQuestionCount,
        classTitle: localActivity.title
      };

      if (mode === 'document') {
        payload.resourceId = selectedResourceId;
      } else {
        payload.transcript = manualTranscript.trim();
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      const invokeOptions = { body: payload };
      if (accessToken) {
        invokeOptions.headers = { Authorization: `Bearer ${accessToken}` };
      }

      const { data, error: fnErr } = await supabase.functions.invoke(
        'generar-preguntas-reforzamiento',
        invokeOptions
      );

      if (fnErr) {
        let msg = fnErr.message || 'Error al conectar con la función de inteligencia artificial';
        try {
          if (fnErr.context && typeof fnErr.context.json === 'function') {
            const body = await fnErr.context.json();
            if (body?.error) msg = body.error;
          }
        } catch (_) {}
        throw new Error(msg);
      }

      if (!data?.ok && data?.error) {
        throw new Error(data.error);
      }

      if (!data?.draft?.questions || data.draft.questions.length === 0) {
        throw new Error('La IA no devolvió preguntas válidas. Por favor intenta nuevamente.');
      }

      const isOptionCorrect = (o, oIndex, q) => {
        if (o.is_correct === true || o.isCorrect === true || o.correct === true || o.is_right === true) return true;
        if (typeof q.correct_option_index === 'number' && q.correct_option_index === oIndex) return true;
        if (typeof q.correct_index === 'number' && q.correct_index === oIndex) return true;
        if (typeof q.correct_answer === 'number' && q.correct_answer === oIndex) return true;
        if (typeof q.correct_answer === 'string' && (q.correct_answer === o.text || q.correct_answer === String(oIndex))) return true;
        return false;
      };

      const parsedQuestions = data.draft.questions.map((q, qIndex) => {
        const qId = `temp-q-${crypto.randomUUID()}`;
        let correctOptId = null;

        const newOptions = (q.options || []).map((o, oIndex) => {
          const oId = `temp-o-${crypto.randomUUID()}`;
          if (isOptionCorrect(o, oIndex, q)) {
            correctOptId = oId;
          }
          return {
            id: oId,
            question_id: qId,
            text: o.text || `Opción ${oIndex + 1}`,
            order_num: oIndex
          };
        });

        if (!correctOptId && newOptions.length > 0) {
          correctOptId = newOptions[0].id;
        }

        return {
          id: qId,
          activity_id: activity?.id || 'temp-act',
          text: q.text || 'Sin enunciado',
          question_type: q.question_type || 'single_choice',
          order_num: qIndex,
          options: newOptions,
          correctOptionId: correctOptId,
          explanation: q.explanation || '',
          source_basis: q.source_basis || ''
        };
      });

      const docName = mode === 'document' 
        ? (selectedDoc?.title || 'Material seleccionado') 
        : 'Transcripción de la clase';

      const sourceMeta = {
        type: mode,
        docTitle: docName,
        date: new Date().toISOString()
      };

      if (questions.length > 0) {
        setPendingDraftToLoad({
          questions: parsedQuestions,
          sourceMeta,
          activityTitle: data.draft.activity_title,
          activityDescription: data.draft.activity_description
        });
        setReplaceQuestionsModalOpen(true);
      } else {
        applyGeneratedQuestions(parsedQuestions, sourceMeta, 'replace', data.draft.activity_title, data.draft.activity_description);
      }

    } catch (err) {
      console.error('Error generando preguntas con IA:', err);
      setAiError(err.message || 'Error desconocido al invocar la función de IA.');
    } finally {
      setAiGenerating(false);
    }
  };

  const applyGeneratedQuestions = (newQuestions, sourceMeta, strategy = 'replace', newTitle = '', newDesc = '') => {
    if (strategy === 'replace') {
      setQuestions(newQuestions);
      if (newTitle && (!localActivity.title || localActivity.title === 'Actividad de Reforzamiento')) {
        setLocalActivity(prev => ({
          ...prev,
          title: newTitle,
          description: newDesc || prev.description
        }));
      }
    } else {
      const offset = questions.length;
      const renumbered = newQuestions.map((q, i) => ({
        ...q,
        order_num: offset + i
      }));
      setQuestions(prev => [...prev, ...renumbered]);
    }

    setGenerationSource(sourceMeta);
    setAiSuccess(`✓ ${newQuestions.length} preguntas generadas con IA a partir de "${sourceMeta.docTitle}" cargadas en el borrador.`);
    setTimeout(() => setAiSuccess(''), 7000);
    setReplaceQuestionsModalOpen(false);
    setPendingDraftToLoad(null);
  };

  useEffect(() => {
    if (classId) {
      loadActivityData();
      fetchClassResources();
    }
  }, [classId]);

  // Realtime subscription para sincronizar drafts creados por la IA y recursos en vivo
  useEffect(() => {
    if (!classId) return;
    const channel = supabase
      .channel('admin_class_activity_sync_' + classId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'class_activities', filter: `class_id=eq.${classId}` }, () => {
        loadActivityData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_drafts', filter: `class_id=eq.${classId}` }, () => {
        loadActivityData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'resources', filter: `class_id=eq.${classId}` }, () => {
        fetchClassResources();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [classId]);

  const loadActivityData = async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Obtener la actividad publicada de la clase
      const { data: actData, error: actError } = await supabase
        .from('class_activities')
        .select('*')
        .eq('class_id', classId)
        .maybeSingle();

      if (actError) throw actError;

      // 2. Obtener borrador de IA (activity_drafts)
      const { data: draftData } = await supabase
        .from('activity_drafts')
        .select('*')
        .eq('class_id', classId)
        .neq('status', 'rejected')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setDraft(draftData || null);

      if (actData) {
        setActivity(actData);
        setLocalActivity({
          title: actData.title,
          description: actData.description || '',
          is_mandatory: actData.is_mandatory,
          max_attempts: actData.max_attempts,
          due_date: actData.due_date ? toLocalDatetimeString(actData.due_date) : ''
        });

        // 3. Obtener preguntas, opciones y correctas
        const { data: qData, error: qError } = await supabase
          .from('activity_questions')
          .select(`
            *,
            question_options (*),
            question_correct_answers (correct_option_id)
          `)
          .eq('activity_id', actData.id)
          .order('order_num', { ascending: true });

        if (qError) throw qError;

        // Normalizar los datos
        let normalizedQuestions = (qData || []).map(q => {
          const sortedOptions = (q.question_options || []).sort((a, b) => a.order_num - b.order_num);
          let correctOption = null;

          if (q.question_correct_answers) {
            if (Array.isArray(q.question_correct_answers) && q.question_correct_answers.length > 0) {
              correctOption = q.question_correct_answers[0].correct_option_id;
            } else if (typeof q.question_correct_answers === 'object' && q.question_correct_answers.correct_option_id) {
              correctOption = q.question_correct_answers.correct_option_id;
            }
          }
            
          return {
            ...q,
            options: sortedOptions,
            correctOptionId: correctOption
          };
        });

        // Si la actividad en DB no tiene preguntas pero existe un borrador de IA, cargarlas automáticamente
        if (normalizedQuestions.length === 0 && draftData?.draft_data?.questions && draftData.draft_data.questions.length > 0) {
          const isOptionCorrect = (o, oIndex, q) => {
            if (o.is_correct === true || o.isCorrect === true || o.correct === true || o.is_right === true) return true;
            if (typeof q.correct_option_index === 'number' && q.correct_option_index === oIndex) return true;
            if (typeof q.correct_index === 'number' && q.correct_index === oIndex) return true;
            if (typeof q.correct_answer === 'number' && q.correct_answer === oIndex) return true;
            if (typeof q.correct_answer === 'string' && (q.correct_answer === o.text || q.correct_answer === String(oIndex))) return true;
            return false;
          };

          normalizedQuestions = draftData.draft_data.questions.map((q, qIndex) => {
            const qId = `temp-draft-q-${qIndex}`;
            let correctOptId = null;

            const newOptions = (q.options || []).map((o, oIndex) => {
              const oId = `temp-draft-o-${qIndex}-${oIndex}`;
              if (isOptionCorrect(o, oIndex, q)) {
                correctOptId = oId;
              }
              return {
                id: oId,
                question_id: qId,
                text: o.text || `Opción ${oIndex + 1}`,
                order_num: oIndex
              };
            });

            if (!correctOptId && newOptions.length > 0) {
              correctOptId = newOptions[0].id;
            }

            return {
              id: qId,
              activity_id: actData.id,
              text: q.text || 'Sin enunciado',
              question_type: q.question_type || 'single_choice',
              explanation: q.explanation || '',
              source_basis: q.source_basis || '',
              order_num: qIndex,
              options: newOptions,
              correctOptionId: correctOptId
            };
          });
        }

        setQuestions(normalizedQuestions);
      } else if (draftData?.draft_data?.questions && draftData.draft_data.questions.length > 0) {
        // Cargar automáticamente las preguntas del borrador de IA
        setLocalActivity({
          title: draftData.draft_data.activity_title || 'Actividad de Reforzamiento',
          description: draftData.draft_data.activity_description || '',
          is_mandatory: false,
          max_attempts: 1,
          due_date: draftData.draft_data.due_date ? toLocalDatetimeString(draftData.draft_data.due_date) : ''
        });

        const isOptionCorrect = (o, oIndex, q) => {
          if (o.is_correct === true || o.isCorrect === true || o.correct === true || o.is_right === true) return true;
          if (typeof q.correct_option_index === 'number' && q.correct_option_index === oIndex) return true;
          if (typeof q.correct_index === 'number' && q.correct_index === oIndex) return true;
          if (typeof q.correct_answer === 'number' && q.correct_answer === oIndex) return true;
          if (typeof q.correct_answer === 'string' && (q.correct_answer === o.text || q.correct_answer === String(oIndex))) return true;
          return false;
        };

        const draftQs = draftData.draft_data.questions.map((q, qIndex) => {
          const qId = `temp-draft-q-${qIndex}`;
          let correctOptId = null;

          const newOptions = (q.options || []).map((o, oIndex) => {
            const oId = `temp-draft-o-${qIndex}-${oIndex}`;
            if (isOptionCorrect(o, oIndex, q)) {
              correctOptId = oId;
            }
            return {
              id: oId,
              question_id: qId,
              text: o.text || `Opción ${oIndex + 1}`,
              order_num: oIndex
            };
          });

          if (!correctOptId && newOptions.length > 0) {
            correctOptId = newOptions[0].id;
          }

          return {
            id: qId,
            activity_id: 'draft-temp',
            text: q.text || 'Sin enunciado',
            question_type: q.question_type || 'single_choice',
            explanation: q.explanation || '',
            source_basis: q.source_basis || '',
            order_num: qIndex,
            options: newOptions,
            correctOptionId: correctOptId
          };
        });

        setQuestions(draftQs);
        setActivity({
          id: 'draft-temp',
          class_id: classId,
          title: draftData.draft_data.activity_title || 'Actividad de Reforzamiento',
          description: draftData.draft_data.activity_description || '',
          is_published: false,
          is_draft: true
        });
      } else {
        setActivity(null);
        setQuestions([]);
      }
    } catch (err) {
      console.error('Error cargando actividad:', err);
      setError('No se pudo cargar la actividad.');
    } finally {
      setLoading(false);
    }
  };

  const createActivity = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = {
        class_id: classId,
        title: localActivity.title,
        description: localActivity.description,
        is_mandatory: localActivity.is_mandatory,
        max_attempts: localActivity.max_attempts,
        due_date: localActivity.due_date ? parseLocalDatetime(localActivity.due_date) : null,
        is_published: false
      };

      let { data, error: insertError } = await supabase
        .from('class_activities')
        .insert([payload])
        .select()
        .single();
      
      if (insertError && (insertError.code === '42703' || insertError.message?.includes('due_date'))) {
        delete payload.due_date;
        const retry = await supabase.from('class_activities').insert([payload]).select().single();
        data = retry.data;
        insertError = retry.error;
      }

      if (insertError) throw insertError;
      
      setActivity(data);
      setSuccess('Actividad creada. Ahora puedes añadir preguntas.');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      console.error(err);
      setError('Error al crear la actividad: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const persistQuestionsToDatabase = async (activityId, currentQuestions) => {
    if (!activityId || !currentQuestions) return [];

    // Si es una actividad temporal de borrador, resolver o crear en class_activities
    let targetActId = activityId;
    if (!targetActId || targetActId === 'draft-temp' || String(targetActId).startsWith('temp-')) {
      const { data: existingAct } = await supabase
        .from('class_activities')
        .select('id, title, description, is_mandatory, max_attempts, is_published')
        .eq('class_id', classId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingAct) {
        targetActId = existingAct.id;
        setActivity(existingAct);
      } else {
        const insertPayload = {
          class_id: classId,
          title: localActivity.title || 'Actividad de Reforzamiento',
          description: localActivity.description || '',
          is_mandatory: localActivity.is_mandatory || false,
          max_attempts: localActivity.max_attempts || 1,
          due_date: localActivity.due_date ? parseLocalDatetime(localActivity.due_date) : null,
          is_published: false
        };

        let { data: newAct, error: actErr } = await supabase
          .from('class_activities')
          .insert([insertPayload])
          .select()
          .single();

        if (actErr && (actErr.code === '42703' || actErr.message?.includes('due_date'))) {
          delete insertPayload.due_date;
          const retry = await supabase.from('class_activities').insert([insertPayload]).select().single();
          newAct = retry.data;
          actErr = retry.error;
        }

        if (actErr) throw actErr;
        targetActId = newAct.id;
        setActivity(newAct);
      }
    }

    const normalizeQType = (t) => {
      if (!t) return 'single_choice';
      const str = String(t).toLowerCase();
      if (str.includes('true') || str.includes('false') || str.includes('falso') || str.includes('verdadero')) {
        return 'true_false';
      }
      return 'single_choice';
    };

    // 0. Eliminar de DB preguntas que ya no estén en currentQuestions (en orden para respetar Foreign Keys)
    const { data: existingQs } = await supabase
      .from('activity_questions')
      .select('id')
      .eq('activity_id', targetActId);

    if (existingQs && existingQs.length > 0) {
      const currentRealIds = new Set(currentQuestions.filter(q => !String(q.id).startsWith('temp-')).map(q => q.id));
      const idsToDelete = existingQs.map(q => q.id).filter(id => !currentRealIds.has(id));
      if (idsToDelete.length > 0) {
        await supabase.from('question_correct_answers').delete().in('question_id', idsToDelete);
        await supabase.from('question_options').delete().in('question_id', idsToDelete);
        await supabase.from('activity_questions').delete().in('id', idsToDelete);
      }
    }

    const savedQuestions = [];

    for (let qIndex = 0; qIndex < currentQuestions.length; qIndex++) {
      const q = currentQuestions[qIndex];
      let realQId = q.id;
      const validQType = normalizeQType(q.question_type);

      // 1. Crear o actualizar la pregunta en DB
      if (String(q.id).startsWith('temp-')) {
        const qPayload = {
          activity_id: targetActId,
          text: q.text || 'Sin enunciado',
          question_type: validQType,
          order_num: qIndex
        };
        if (q.explanation) qPayload.explanation = q.explanation;
        if (q.source_basis) qPayload.source_basis = q.source_basis;

        let { data: insertedQ, error: qErr } = await supabase
          .from('activity_questions')
          .insert([qPayload])
          .select()
          .single();

        if (qErr && (qErr.message?.includes('explanation') || qErr.message?.includes('source_basis') || qErr.code === 'PGRST204')) {
          delete qPayload.explanation;
          delete qPayload.source_basis;
          const retryRes = await supabase
            .from('activity_questions')
            .insert([qPayload])
            .select()
            .single();
          insertedQ = retryRes.data;
          qErr = retryRes.error;
        }

        if (qErr) throw qErr;
        realQId = insertedQ.id;
      } else {
        const updatePayload = {
          text: q.text,
          question_type: validQType,
          order_num: qIndex
        };
        if (q.explanation !== undefined) updatePayload.explanation = q.explanation || null;

        let { error: updateQErr } = await supabase
          .from('activity_questions')
          .update(updatePayload)
          .eq('id', q.id);

        if (updateQErr && (updateQErr.message?.includes('explanation') || updateQErr.code === 'PGRST204')) {
          delete updatePayload.explanation;
          await supabase
            .from('activity_questions')
            .update(updatePayload)
            .eq('id', q.id);
        }
      }

      // Eliminar de DB opciones huérfanas de esta pregunta
      if (!String(q.id).startsWith('temp-')) {
        const { data: existingOpts } = await supabase
          .from('question_options')
          .select('id')
          .eq('question_id', realQId);

        if (existingOpts && existingOpts.length > 0) {
          const currentOptRealIds = new Set((q.options || []).filter(o => !String(o.id).startsWith('temp-')).map(o => o.id));
          const optIdsToDelete = existingOpts.map(o => o.id).filter(id => !currentOptRealIds.has(id));
          if (optIdsToDelete.length > 0) {
            await supabase.from('question_correct_answers').delete().in('correct_option_id', optIdsToDelete);
            await supabase
              .from('question_options')
              .delete()
              .in('id', optIdsToDelete);
          }
        }
      }

      // 2. Crear o actualizar las opciones en DB
      const savedOptions = [];
      let realCorrectOptId = null;

      for (let oIndex = 0; oIndex < (q.options || []).length; oIndex++) {
        const opt = q.options[oIndex];
        let realOptId = opt.id;

        if (String(opt.id).startsWith('temp-')) {
          const { data: insertedOpt, error: optErr } = await supabase
            .from('question_options')
            .insert([{
              question_id: realQId,
              text: opt.text || 'Opción',
              order_num: oIndex
            }])
            .select()
            .single();

          if (optErr) throw optErr;
          realOptId = insertedOpt.id;
        } else {
          await supabase
            .from('question_options')
            .update({
              text: opt.text,
              order_num: oIndex
            })
            .eq('id', opt.id);
        }

        if (q.correctOptionId && String(q.correctOptionId) === String(opt.id)) {
          realCorrectOptId = realOptId;
        }

        savedOptions.push({
          ...opt,
          id: realOptId,
          question_id: realQId
        });
      }

      // Si por alguna razón no se detectó la respuesta correcta, usar la primera por defecto
      if (!realCorrectOptId && savedOptions.length > 0) {
        realCorrectOptId = savedOptions[0].id;
      }

      // 3. Guardar la respuesta correcta en DB
      if (realCorrectOptId) {
        const { error: upsertErr } = await supabase
          .from('question_correct_answers')
          .upsert({
            question_id: realQId,
            correct_option_id: realCorrectOptId
          }, { onConflict: 'question_id' });
          
        if (upsertErr) {
          console.error('Error guardando respuesta correcta en Supabase:', upsertErr);
        }
      }

      savedQuestions.push({
        ...q,
        id: realQId,
        activity_id: activityId,
        options: savedOptions,
        correctOptionId: realCorrectOptId
      });
    }

    return savedQuestions;
  };

  const saveActivityInfo = async () => {
    setSaving(true);
    setError('');
    try {
      let realActId = (activity && activity.id !== 'draft-temp' && !String(activity.id).startsWith('temp-')) 
        ? activity.id 
        : null;

      let currentAct = null;

      if (!realActId) {
        // Verificar si ya existe en la BD para esta clase
        const { data: existingAct } = await supabase
          .from('class_activities')
          .select('*')
          .eq('class_id', classId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const parsedDue = localActivity.due_date ? parseLocalDatetime(localActivity.due_date) : null;

        if (existingAct) {
          realActId = existingAct.id;
          const updatePayload = {
            title: localActivity.title,
            description: localActivity.description,
            is_mandatory: localActivity.is_mandatory,
            max_attempts: localActivity.max_attempts,
            due_date: parsedDue
          };
          let { data: updatedAct, error: updateError } = await supabase
            .from('class_activities')
            .update(updatePayload)
            .eq('id', realActId)
            .select()
            .single();

          if (updateError && (updateError.code === '42703' || updateError.message?.includes('due_date'))) {
            delete updatePayload.due_date;
            const retry = await supabase.from('class_activities').update(updatePayload).eq('id', realActId).select().single();
            updatedAct = retry.data;
            updateError = retry.error;
          }

          if (updateError) throw updateError;
          currentAct = updatedAct;
          setActivity(updatedAct);
        } else {
          const insertPayload = {
            class_id: classId,
            title: localActivity.title,
            description: localActivity.description,
            is_mandatory: localActivity.is_mandatory,
            max_attempts: localActivity.max_attempts,
            due_date: parsedDue,
            is_published: false
          };
          let { data: newAct, error: insertError } = await supabase
            .from('class_activities')
            .insert([insertPayload])
            .select()
            .single();

          if (insertError && (insertError.code === '42703' || insertError.message?.includes('due_date'))) {
            delete insertPayload.due_date;
            const retry = await supabase.from('class_activities').insert([insertPayload]).select().single();
            newAct = retry.data;
            insertError = retry.error;
          }

          if (insertError) throw insertError;
          realActId = newAct.id;
          currentAct = newAct;
          setActivity(newAct);
        }
      } else {
        const parsedDue = localActivity.due_date ? parseLocalDatetime(localActivity.due_date) : null;
        const updatePayload = {
          title: localActivity.title,
          description: localActivity.description,
          is_mandatory: localActivity.is_mandatory,
          max_attempts: localActivity.max_attempts,
          due_date: parsedDue
        };
        let { data: updatedAct, error: updateError } = await supabase
          .from('class_activities')
          .update(updatePayload)
          .eq('id', realActId)
          .select()
          .single();

        if (updateError && (updateError.code === '42703' || updateError.message?.includes('due_date'))) {
          delete updatePayload.due_date;
          const retry = await supabase.from('class_activities').update(updatePayload).eq('id', realActId).select().single();
          updatedAct = retry.data;
          updateError = retry.error;
        }

        if (updateError) throw updateError;
        currentAct = updatedAct;
        setActivity(updatedAct);
      }

      // Guardar en la BD todas las preguntas y opciones (incluyendo las generadas por IA)
      if (questions.length > 0) {
        const savedQs = await persistQuestionsToDatabase(realActId, questions);
        setQuestions(savedQs);
      }

      setSuccess('Las preguntas y la actividad han sido guardadas en borrador. Puedes revisarla y hacer clic en "Publicar Actividad".');
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      console.error(err);
      setError('Error al guardar la actividad: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const addQuestion = async (type) => {
    let currentAct = activity;
    if (!currentAct) {
      return setError('Guarda primero la actividad para poder añadir preguntas.');
    }
    try {
      const newOrder = questions.length;
      
      const { data: qData, error: qError } = await supabase
        .from('activity_questions')
        .insert([{
          activity_id: currentAct.id,
          text: 'Nueva pregunta',
          question_type: type,
          order_num: newOrder
        }])
        .select()
        .single();
        
      if (qError) throw qError;

      let initialOptions = [];
      if (type === 'true_false') {
        const { data: oData, error: oError } = await supabase
          .from('question_options')
          .insert([
            { question_id: qData.id, text: 'Verdadero', order_num: 0 },
            { question_id: qData.id, text: 'Falso', order_num: 1 }
          ])
          .select();
        
        if (oError) throw oError;
        initialOptions = oData;
      }

      const newQuestion = {
        ...qData,
        options: initialOptions,
        correctOptionId: null
      };

      setQuestions([...questions, newQuestion]);
      
    } catch (err) {
      console.error(err);
      setError('Error añadiendo pregunta: ' + err.message);
    }
  };

  const updateQuestionText = async (id, text) => {
    setQuestions(questions.map(q => q.id === id ? { ...q, text } : q));
    if (!String(id).startsWith('temp-')) {
      try {
        await supabase.from('activity_questions').update({ text }).eq('id', id);
      } catch (err) { console.error(err); }
    }
  };

  const updateQuestionExplanation = async (id, explanation) => {
    setQuestions(questions.map(q => q.id === id ? { ...q, explanation } : q));
    if (!String(id).startsWith('temp-')) {
      try {
        const { error } = await supabase.from('activity_questions').update({ explanation }).eq('id', id);
        if (error && error.message?.includes('explanation')) {
          // Ignorar si la columna no existe en schema cache
        }
      } catch (err) { console.warn('Nota: no se pudo guardar explanation en DB:', err); }
    }
  };

  const deleteQuestion = async (id) => {
    if (!window.confirm('¿Eliminar pregunta? Se borrarán sus opciones y respuestas.')) return;
    if (!String(id).startsWith('temp-')) {
      try {
        await supabase.from('question_correct_answers').delete().eq('question_id', id);
        await supabase.from('question_options').delete().eq('question_id', id);
        await supabase.from('activity_questions').delete().eq('id', id);
      } catch (err) { console.error(err); }
    }
    setQuestions(questions.filter(q => q.id !== id));
  };

  const addOption = async (questionId) => {
    const qIndex = questions.findIndex(q => q.id === questionId);
    if (qIndex < 0) return;
    const q = questions[qIndex];
    
    let newOpt = null;
    if (!String(questionId).startsWith('temp-')) {
      try {
        const { data, error } = await supabase
          .from('question_options')
          .insert([{
            question_id: questionId,
            text: 'Nueva opción',
            order_num: q.options.length
          }])
          .select()
          .single();
          
        if (!error) newOpt = data;
      } catch (err) { console.error(err); }
    }

    if (!newOpt) {
      newOpt = {
        id: `temp-o-${crypto.randomUUID()}`,
        question_id: questionId,
        text: 'Nueva opción',
        order_num: q.options.length
      };
    }

    const updatedQuestions = [...questions];
    updatedQuestions[qIndex] = { ...q, options: [...q.options, newOpt] };
    setQuestions(updatedQuestions);
  };

  const updateOptionText = async (questionId, optionId, text) => {
    setQuestions(questions.map(q => {
      if (q.id === questionId) {
        return {
          ...q,
          options: q.options.map(o => o.id === optionId ? { ...o, text } : o)
        };
      }
      return q;
    }));

    if (!String(optionId).startsWith('temp-')) {
      try {
        await supabase.from('question_options').update({ text }).eq('id', optionId);
      } catch (err) { console.error(err); }
    }
  };

  const deleteOption = async (questionId, optionId) => {
    const qIndex = questions.findIndex(q => q.id === questionId);
    if (qIndex < 0) return;
    const q = questions[qIndex];
    let correctId = q.correctOptionId;

    if (!String(optionId).startsWith('temp-')) {
      try {
        if (correctId === optionId) {
          await supabase.from('question_correct_answers').delete().eq('question_id', questionId);
          correctId = null;
        }
        await supabase.from('question_options').delete().eq('id', optionId);
      } catch (err) { console.error(err); }
    } else {
      if (correctId === optionId) correctId = null;
    }

    const updatedQuestions = [...questions];
    updatedQuestions[qIndex] = { 
      ...q, 
      options: q.options.filter(o => o.id !== optionId),
      correctOptionId: correctId
    };
    setQuestions(updatedQuestions);
  };

  const setCorrectOption = async (questionId, optionId) => {
    if (!String(questionId).startsWith('temp-') && !String(optionId).startsWith('temp-')) {
      try {
        const { error } = await supabase
          .from('question_correct_answers')
          .upsert({ question_id: questionId, correct_option_id: optionId }, { onConflict: 'question_id' });
          
        if (error) throw error;
      } catch (err) { console.error(err); }
    }

    setQuestions(questions.map(q => {
      if (q.id === questionId) return { ...q, correctOptionId: optionId };
      return q;
    }));
  };

  const togglePublish = async () => {
    setSaving(true);
    setError('');
    try {
      // 1. Obtener o crear la actividad real en la base de datos
      let realActId = (activity && activity.id !== 'draft-temp' && !String(activity.id).startsWith('temp-')) 
        ? activity.id 
        : null;

      let currentAct = activity;

      if (!realActId) {
        // Verificar si ya existe en la BD para esta clase
        const { data: existingAct } = await supabase
          .from('class_activities')
          .select('id, title, description, is_mandatory, max_attempts, is_published')
          .eq('class_id', classId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingAct) {
          realActId = existingAct.id;
          currentAct = existingAct;
        } else {
          // Crear la fila inicial en class_activities
          const insertPayload = {
            class_id: classId,
            title: localActivity.title || 'Actividad de Reforzamiento',
            description: localActivity.description || '',
            is_mandatory: localActivity.is_mandatory || false,
            max_attempts: localActivity.max_attempts || 1,
            due_date: localActivity.due_date ? parseLocalDatetime(localActivity.due_date) : null,
            is_published: false
          };

          let { data: newAct, error: createErr } = await supabase
            .from('class_activities')
            .insert([insertPayload])
            .select()
            .single();

          if (createErr && (createErr.code === '42703' || createErr.message?.includes('due_date'))) {
            delete insertPayload.due_date;
            const retry = await supabase.from('class_activities').insert([insertPayload]).select().single();
            newAct = retry.data;
            createErr = retry.error;
          }

          if (createErr) throw createErr;
          realActId = newAct.id;
          currentAct = newAct;
        }
      }

      // 2. Persistir todas las preguntas y opciones pendientes con el UUID real
      const savedQs = await persistQuestionsToDatabase(realActId, questions);
      setQuestions(savedQs);

      const willPublish = !currentAct?.is_published;

      // 3. Validaciones antes de publicar
      if (willPublish) {
        if (savedQs.length === 0) {
          throw new Error('La actividad debe tener al menos una pregunta para ser publicada.');
        }
        for (const q of savedQs) {
          if (!q.options || q.options.length < 2) {
            throw new Error(`La pregunta "${q.text}" debe tener al menos 2 opciones.`);
          }
          if (!q.correctOptionId) {
            throw new Error(`La pregunta "${q.text}" no tiene una opción correcta asignada.`);
          }
        }
      }

      // 4. Actualizar el estado en class_activities
      const pubPayload = { 
        is_published: willPublish,
        title: localActivity.title || currentAct?.title || 'Actividad de Reforzamiento',
        description: localActivity.description || currentAct?.description || '',
        is_mandatory: localActivity.is_mandatory !== undefined ? localActivity.is_mandatory : false,
        max_attempts: localActivity.max_attempts || 1,
        due_date: localActivity.due_date ? parseLocalDatetime(localActivity.due_date) : null
      };

      let { data: updatedAct, error: pubErr } = await supabase
        .from('class_activities')
        .update(pubPayload)
        .eq('id', realActId)
        .select()
        .single();

      if (pubErr && (pubErr.code === '42703' || pubErr.message?.includes('due_date'))) {
        delete pubPayload.due_date;
        const retry = await supabase.from('class_activities').update(pubPayload).eq('id', realActId).select().single();
        updatedAct = retry.data;
        pubErr = retry.error;
      }

      if (pubErr) throw pubErr;

      // 5. Sincronizar también activity_drafts para mantener consistencia bidireccional
      try {
        await supabase
          .from('activity_drafts')
          .update({ 
            status: willPublish ? 'approved' : 'pending',
            reviewed_at: willPublish ? new Date().toISOString() : null 
          })
          .eq('class_id', classId);
      } catch (draftErr) {
        console.warn('Nota: No se pudo actualizar status en activity_drafts:', draftErr);
      }

      setActivity(updatedAct || { ...(currentAct || {}), id: realActId, is_published: willPublish });
      setSuccess(willPublish ? '✓ Actividad publicada exitosamente. Los estudiantes ya pueden responderla.' : 'Actividad regresada a borrador.');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      console.error('Error al cambiar el estado de publicación:', err);
      setError('Error al cambiar el estado de publicación: ' + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  const handleQuickExtendDays = async (days = 7) => {
    const target = new Date();
    target.setDate(target.getDate() + days);
    target.setHours(23, 59, 0, 0);
    const localStr = toLocalDatetimeString(target.toISOString());
    setLocalActivity(prev => ({ ...prev, due_date: localStr }));
    
    // Si la actividad ya existe en BD, guardar al instante para reactivarla inmediatamente
    const realActId = (activity && activity.id !== 'draft-temp' && !String(activity.id).startsWith('temp-')) ? activity.id : null;
    if (realActId) {
      setSaving(true);
      try {
        const parsed = parseLocalDatetime(localStr);
        const { error: updErr } = await supabase
          .from('class_activities')
          .update({ due_date: parsed })
          .eq('id', realActId);
        
        if (updErr) throw updErr;
        setActivity(prev => ({ ...(prev || {}), due_date: parsed }));
        setSuccess(`✓ Actividad reactivada con éxito. Plazo extendido hasta el ${formatClassDate(parsed, false)}.`);
        setTimeout(() => setSuccess(''), 5000);
      } catch (e) {
        console.error('Error reactivando actividad:', e);
        const msg = String(e.message || e);
        if (msg.includes('due_date') || msg.includes('schema cache')) {
          setError('La columna "due_date" aún no existe en tu base de datos de Supabase. Ejecuta en el SQL Editor de Supabase: ALTER TABLE class_activities ADD COLUMN IF NOT EXISTS due_date timestamptz;');
        } else {
          setError('No se pudo reactivar automáticamente la fecha: ' + msg);
        }
      } finally {
        setSaving(false);
      }
    }
  };

  const handleClearDeadline = async () => {
    setLocalActivity(prev => ({ ...prev, due_date: '' }));
    const realActId = (activity && activity.id !== 'draft-temp' && !String(activity.id).startsWith('temp-')) ? activity.id : null;
    if (realActId) {
      setSaving(true);
      try {
        const { error: updErr } = await supabase
          .from('class_activities')
          .update({ due_date: null })
          .eq('id', realActId);

        if (updErr) throw updErr;
        setActivity(prev => ({ ...(prev || {}), due_date: null }));
        setSuccess('✓ Plazo eliminado. La actividad queda abierta indefinidamente.');
        setTimeout(() => setSuccess(''), 4000);
      } catch (e) {
        console.error('Error eliminando plazo:', e);
        const msg = String(e.message || e);
        if (msg.includes('due_date') || msg.includes('schema cache')) {
          setError('La columna "due_date" aún no existe en Supabase. Ejecuta la sentencia SQL en Supabase para habilitarla.');
        } else {
          setError('No se pudo actualizar el plazo: ' + msg);
        }
      } finally {
        setSaving(false);
      }
    }
  };

  // VISTA PREVIA
  if (previewMode) {
    const hasQuestions = questions && questions.length > 0;
    const currentQ = hasQuestions ? questions[previewQuestionIndex] : null;
    const currentOptions = currentQ?.options || [];

    return (
      <div style={{ background: '#f8fafc', padding: '2rem', borderRadius: '12px', border: '1px solid var(--border-color)', minHeight: '400px' }}>
        <button onClick={() => setPreviewMode(false)} className="btn btn-secondary" style={{ marginBottom: '1.5rem' }}>
          ← Salir de Vista Previa
        </button>
        
        {!hasQuestions || !currentQ ? (
          <div style={{ background: 'white', padding: '2rem', borderRadius: '12px', textAlign: 'center' }}>
            <h3 style={{ fontSize: '1.1rem', color: '#475569', marginBottom: '0.5rem' }}>
              Esta actividad aún no tiene preguntas para previsualizar.
            </h3>
            <p style={{ fontSize: '0.9rem', color: '#64748b' }}>
              Añade algunas preguntas en el editor o genera un borrador con IA.
            </p>
          </div>
        ) : (
          <div style={{ background: 'white', padding: '2rem', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <span style={{ fontWeight: 600, color: 'var(--navy)' }}>Pregunta {previewQuestionIndex + 1} de {questions.length}</span>
            </div>
            
            <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', fontWeight: 600 }}>{currentQ.text || 'Sin enunciado'}</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {currentOptions.map(opt => {
                const isSelected = previewSelectedOptions[currentQ.id] === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => setPreviewSelectedOptions({ ...previewSelectedOptions, [currentQ.id]: opt.id })}
                    style={{
                      padding: '1rem',
                      textAlign: 'left',
                      borderRadius: '8px',
                      border: `1.5px solid ${isSelected ? 'var(--gold)' : 'var(--border-color)'}`,
                      background: isSelected ? '#fbf8f1' : 'white',
                      color: isSelected ? 'var(--navy)' : 'inherit',
                      fontWeight: isSelected ? 600 : 400,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem'
                    }}
                  >
                    <div style={{
                      width: '20px', height: '20px', borderRadius: '50%',
                      border: `2px solid ${isSelected ? 'var(--gold)' : '#cbd5e1'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      {isSelected && <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--gold)' }} />}
                    </div>
                    {opt.text}
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2.5rem' }}>
              <button
                className="btn btn-secondary"
                disabled={previewQuestionIndex === 0}
                onClick={() => setPreviewQuestionIndex(prev => prev - 1)}
              >
                Anterior
              </button>
              <button
                className="btn btn-primary"
                disabled={!previewSelectedOptions[currentQ.id]}
                onClick={() => {
                  if (previewQuestionIndex < questions.length - 1) {
                    setPreviewQuestionIndex(prev => prev + 1);
                  } else {
                    alert("¡Has llegado al final de la vista previa!");
                  }
                }}
              >
                {previewQuestionIndex === questions.length - 1 ? 'Finalizar' : 'Siguiente'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando actividad...</div>;
  }

  if (!activity) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 1rem', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
        <h4 style={{ marginBottom: '1rem', fontSize: '1.2rem', color: 'var(--navy)', fontWeight: 600 }}>Esta clase aún no tiene una actividad</h4>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          Crea una actividad de reforzamiento para validar el aprendizaje de los estudiantes.
        </p>
        <button onClick={createActivity} disabled={saving} className="btn btn-primary" style={{ padding: '0.75rem 1.5rem', fontSize: '1rem' }}>
          <Plus size={18} style={{ marginRight: '0.5rem' }} /> Crear Actividad
        </button>
        {error && <div style={{ color: 'red', marginTop: '1rem' }}>{error}</div>}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* BANNER INFORMATIVO SI HAY BORRADOR DE IA */}
      {(draft || generationSource) && !activity?.is_published && (
        <div style={{ 
          padding: '1.25rem 1.5rem', 
          background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)', 
          border: '1.5px solid #86efac', 
          borderRadius: '10px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          flexWrap: 'wrap', 
          gap: '1rem',
          boxShadow: '0 2px 8px rgba(22, 163, 74, 0.08)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
              <Sparkles size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 800, color: '#166534', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                Borrador generado por IA (Google Gemini)
                <span style={{ fontSize: '0.72rem', background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '12px', fontWeight: 700, textTransform: 'uppercase' }}>
                  Pendiente de Revisión
                </span>
              </div>
              <div style={{ fontSize: '0.84rem', color: '#15803d', marginTop: '2px' }}>
                {generationSource?.docTitle 
                  ? `Preguntas generadas a partir de "${generationSource.docTitle}". Puedes revisarlas, editarlas, eliminar o añadir más preguntas manualmente antes de publicar.`
                  : 'Las preguntas fueron generadas automáticamente con IA. Puedes revisarlas, editarlas y publicarlas a continuación.'}
              </div>
            </div>
          </div>
          <button 
            onClick={togglePublish} 
            disabled={saving} 
            className="btn btn-primary" 
            style={{ background: '#16a34a', borderColor: '#16a34a', padding: '0.6rem 1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Check size={16} /> Aprobar y Publicar Actividad
          </button>
        </div>
      )}

      {/* 1. CONFIGURACIÓN GENERAL */}
      <div className="card" style={{ padding: '1.5rem', background: 'white', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--navy)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={20} /> Configuración de la Actividad
            </h3>
            <span style={{ 
              display: 'inline-block', 
              marginTop: '0.5rem', 
              fontSize: '0.8rem', 
              padding: '0.2rem 0.6rem', 
              borderRadius: '20px', 
              background: activity?.is_published ? '#dcfce7' : '#f1f5f9',
              color: activity?.is_published ? '#166534' : '#475569',
              fontWeight: 600
            }}>
              {activity?.is_published ? 'PUBLICADA' : 'BORRADOR (Pendiente de revisión)'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => { setPreviewQuestionIndex(0); setPreviewMode(true); }} className="btn btn-secondary">
              <PlayCircle size={16} style={{ marginRight: '0.4rem' }}/> Vista Previa
            </button>
            <button 
              onClick={togglePublish} 
              disabled={saving}
              className={`btn ${activity?.is_published ? 'btn-secondary' : 'btn-primary'}`}
              style={activity?.is_published ? { borderColor: 'var(--border-color)', color: '#dc2626' } : {}}
            >
              {activity?.is_published ? 'Despublicar' : 'Publicar Actividad'}
            </button>
          </div>
        </div>

        {error && <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><AlertTriangle size={16}/> {error}</div>}
        {success && <div style={{ background: '#f0fdf4', color: '#15803d', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CheckCircle2 size={16}/> {success}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 600 }}>Título de la Actividad</label>
            <input 
              type="text" 
              value={localActivity.title} 
              onChange={e => setLocalActivity({...localActivity, title: e.target.value})}
              style={{ width: '100%', padding: '0.65rem', border: '1px solid var(--border-color)', borderRadius: '6px' }} 
            />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 600 }}>Descripción (Opcional)</label>
            <textarea 
              value={localActivity.description} 
              onChange={e => setLocalActivity({...localActivity, description: e.target.value})}
              style={{ width: '100%', padding: '0.65rem', border: '1px solid var(--border-color)', borderRadius: '6px', minHeight: '60px', fontFamily: 'inherit' }} 
              placeholder="Ej: Resuelve este breve test para asentar tus conocimientos..."
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={localActivity.is_mandatory} 
                onChange={e => setLocalActivity({...localActivity, is_mandatory: e.target.checked})}
                style={{ width: '16px', height: '16px' }}
              />
              <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Es Obligatoria para avanzar</span>
            </label>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 600 }}>Intentos permitidos</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input 
                type="number" 
                min="0"
                value={localActivity.max_attempts} 
                onChange={e => setLocalActivity({...localActivity, max_attempts: parseInt(e.target.value) || 0})}
                style={{ width: '100px', padding: '0.5rem', border: '1px solid var(--border-color)', borderRadius: '6px' }} 
              />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>(0 = Ilimitados)</span>
            </div>
          </div>
          
          {/* FECHA LÍMITE Y CONTROL DE VENCIMIENTO / REACTIVACIÓN */}
          <div style={{ gridColumn: '1 / -1', marginTop: '0.75rem', padding: '1rem 1.25rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Calendar size={18} color="var(--navy)" />
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--navy)' }}>Fecha y Hora Límite para Presentar</span>
              </div>
              {/* Indicador de estado */}
              {(() => {
                if (!localActivity.due_date) {
                  return (
                    <span style={{ fontSize: '0.78rem', background: '#f1f5f9', color: '#475569', padding: '3px 10px', borderRadius: '12px', fontWeight: 600 }}>
                      ⚪ Sin fecha límite (Abierta indefinidamente)
                    </span>
                  );
                }
                const parsed = parseLocalDatetime(localActivity.due_date);
                const isExpired = parsed ? new Date(parsed) < new Date() : false;
                if (isExpired) {
                  return (
                    <span style={{ fontSize: '0.78rem', background: '#fee2e2', color: '#991b1b', padding: '3px 10px', borderRadius: '12px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      🔴 Plazo vencido (Cerrada para estudiantes)
                    </span>
                  );
                }
                return (
                  <span style={{ fontSize: '0.78rem', background: '#dcfce7', color: '#166534', padding: '3px 10px', borderRadius: '12px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    🟢 Abierta hasta {formatClassDate(parsed, false)}
                  </span>
                );
              })()}
            </div>

            {/* Alerta y botón de reactivación si el plazo ya venció */}
            {(() => {
              if (!localActivity.due_date) return null;
              const parsed = parseLocalDatetime(localActivity.due_date);
              const isExpired = parsed ? new Date(parsed) < new Date() : false;
              if (!isExpired) return null;

              return (
                <div style={{ marginBottom: '1rem', padding: '0.85rem 1rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#991b1b', fontSize: '0.85rem' }}>
                    <AlertTriangle size={18} />
                    <div>
                      <strong>Esta actividad ha finalizado.</strong> Los estudiantes no pueden resolverla porque el plazo expiró.
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => handleQuickExtendDays(7)}
                      disabled={saving}
                      className="btn btn-primary"
                      style={{ background: '#dc2626', borderColor: '#dc2626', fontSize: '0.82rem', padding: '0.45rem 0.9rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}
                    >
                      <RotateCcw size={15} /> Reactivar (+7 días)
                    </button>
                    <button
                      type="button"
                      onClick={handleClearDeadline}
                      disabled={saving}
                      className="btn btn-outline"
                      style={{ fontSize: '0.82rem', padding: '0.45rem 0.8rem', background: 'white', color: '#475569' }}
                    >
                      Reabrir sin fecha límite
                    </button>
                  </div>
                </div>
              );
            })()}

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 240px', minWidth: '220px' }}>
                <input 
                  type="datetime-local" 
                  value={localActivity.due_date} 
                  onChange={e => setLocalActivity(prev => ({ ...prev, due_date: e.target.value }))}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '0.88rem' }} 
                />
              </div>

              {/* Botones de extensión y atajo rápido */}
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginRight: '2px' }}>Extender plazo:</span>
                <button
                  type="button"
                  onClick={() => handleQuickExtendDays(3)}
                  disabled={saving}
                  className="btn btn-outline"
                  style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                  title="Establecer límite para dentro de 3 días a las 23:59"
                >
                  +3 días
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickExtendDays(7)}
                  disabled={saving}
                  className="btn btn-outline"
                  style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                  title="Establecer límite para dentro de 7 días a las 23:59"
                >
                  +7 días
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickExtendDays(15)}
                  disabled={saving}
                  className="btn btn-outline"
                  style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                  title="Establecer límite para dentro de 15 días a las 23:59"
                >
                  +15 días
                </button>
                {localActivity.due_date && (
                  <button
                    type="button"
                    onClick={handleClearDeadline}
                    disabled={saving}
                    className="btn btn-outline"
                    style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem', color: '#64748b' }}
                    title="Eliminar la fecha límite para dejarla abierta"
                  >
                    Sin límite
                  </button>
                )}
              </div>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              Los estudiantes podrán resolver y enviar la actividad hasta esta fecha y hora. Una vez vencida, podrás reactivarla o ampliar el plazo cuando lo necesites.
            </div>
          </div>
          
          <div style={{ gridColumn: '1 / -1', marginTop: '0.5rem' }}>
            <button onClick={saveActivityInfo} disabled={saving} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Save size={16} /> Guardar Cambios
            </button>
          </div>
        </div>
      </div>

      {/* 2. GENERADOR DE PREGUNTAS CON IA (GOOGLE GEMINI) */}
      {isTeacherOrAdmin && (
        <div className="card" style={{ 
          padding: '1.5rem', 
          background: '#ffffff', 
          borderRadius: '10px', 
          border: '1.5px solid #cbd5e1',
          boxShadow: '0 2px 8px rgba(20, 33, 61, 0.04)'
        }}>
          {/* Header del generador */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ 
                width: '42px', height: '42px', borderRadius: '10px', 
                background: 'linear-gradient(135deg, #14213d 0%, #1e3a5f 100%)', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', 
                color: 'var(--gold)', flexShrink: 0 
              }}>
                <Sparkles size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--navy)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  Generador de Preguntas con IA
                  <span style={{ fontSize: '0.68rem', padding: '0.15rem 0.5rem', borderRadius: '20px', background: '#eff6ff', color: '#1d4ed8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Google Gemini Flash
                  </span>
                </h3>
                <p style={{ margin: '3px 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Genera preguntas de evaluación formativa analizando automáticamente los documentos y presentaciones de esta clase.
                </p>
              </div>
            </div>

            {/* Pestañas de modo (Documentos vs Transcripción) */}
            <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <button
                type="button"
                onClick={() => { setAiMode('document'); setAiError(''); }}
                style={{
                  padding: '0.35rem 0.8rem',
                  fontSize: '0.78rem',
                  fontWeight: aiMode === 'document' ? 700 : 500,
                  background: aiMode === 'document' ? '#ffffff' : 'transparent',
                  color: aiMode === 'document' ? 'var(--navy)' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  boxShadow: aiMode === 'document' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
              >
                <Presentation size={14} color={aiMode === 'document' ? 'var(--gold-dark)' : 'inherit'} /> Desde Documento / Presentación
              </button>
              <button
                type="button"
                onClick={() => { setAiMode('transcript'); setAiError(''); }}
                style={{
                  padding: '0.35rem 0.8rem',
                  fontSize: '0.78rem',
                  fontWeight: aiMode === 'transcript' ? 700 : 500,
                  background: aiMode === 'transcript' ? '#ffffff' : 'transparent',
                  color: aiMode === 'transcript' ? 'var(--navy)' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  boxShadow: aiMode === 'transcript' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
              >
                <FileText size={14} /> Desde Transcripción
              </button>
            </div>
          </div>

          {/* MODO A: DESDE MATERIALES DE LA CLASE */}
          {aiMode === 'document' && (
            <div>
              {loadingResources ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  <RefreshCw size={18} className="spin" style={{ marginBottom: '0.5rem' }} />
                  <div>Cargando materiales de la clase...</div>
                </div>
              ) : classResources.length === 0 ? (
                /* ESTADO VACÍO: NO HAY DOCUMENTOS SUBIDOS */
                <div style={{
                  padding: '1.75rem',
                  background: '#fffbeb',
                  border: '1.5px dashed #fcd34d',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '1.25rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#b45309', flexShrink: 0 }}>
                      <FileQuestion size={24} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#92400e' }}>
                        Esta clase no tiene materiales de estudio subidos aún
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#b45309', marginTop: '3px', maxWidth: '520px' }}>
                        Para generar preguntas con Inteligencia Artificial, primero debes subir una presentación (PDF) o documento de lectura en la sección de Materiales.
                      </div>
                    </div>
                  </div>

                  {onOpenUploadModal && (
                    <button
                      type="button"
                      onClick={onOpenUploadModal}
                      style={{
                        padding: '0.55rem 1.1rem',
                        background: '#d97706',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.45rem',
                        boxShadow: '0 2px 6px rgba(217, 119, 6, 0.25)'
                      }}
                    >
                      <Upload size={14} /> Subir Material a esta Clase
                    </button>
                  )}
                </div>
              ) : (
                /* SELECTOR DE DOCUMENTOS DE LA CLASE */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy)', marginBottom: '0.45rem' }}>
                      Selecciona el material de estudio para generar las preguntas:
                    </label>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem' }}>
                      {classResources.map((res) => {
                        const isSelected = selectedResourceId === res.id;
                        const isPresentation = res.resource_type === 'presentation';

                        return (
                          <div
                            key={res.id}
                            onClick={() => setSelectedResourceId(res.id)}
                            style={{
                              border: `2px solid ${isSelected ? 'var(--navy)' : 'var(--border-color)'}`,
                              background: isSelected ? '#f8fafc' : '#ffffff',
                              borderRadius: '8px',
                              padding: '0.85rem 1rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '0.75rem',
                              transition: 'all 0.15s ease',
                              boxShadow: isSelected ? '0 2px 6px rgba(20, 33, 61, 0.08)' : 'none'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                              <div style={{
                                width: '18px', height: '18px', borderRadius: '50%',
                                border: `2px solid ${isSelected ? 'var(--navy)' : '#cbd5e1'}`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0
                              }}>
                                {isSelected && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--navy)' }} />}
                              </div>

                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--navy)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {res.title || 'Documento sin título'}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                  <span style={{ 
                                    padding: '0.05rem 0.35rem', 
                                    borderRadius: '4px', 
                                    background: isPresentation ? '#fef3c7' : '#f1f5f9', 
                                    color: isPresentation ? '#92400e' : '#475569',
                                    fontWeight: 600,
                                    fontSize: '0.68rem'
                                  }}>
                                    {isPresentation ? 'Presentación' : (res.resource_type || 'PDF')}
                                  </span>
                                  {res.created_at && (
                                    <span>{new Date(res.created_at).toLocaleDateString('es-CO')}</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {res.url && (
                              <a
                                href={res.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                title="Abrir y previsualizar documento en nueva pestaña"
                                style={{
                                  padding: '0.35rem 0.55rem',
                                  background: '#f8fafc',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: '6px',
                                  color: '#64748b',
                                  fontSize: '0.72rem',
                                  textDecoration: 'none',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                  flexShrink: 0
                                }}
                              >
                                <ExternalLink size={12} /> Ver
                              </a>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Selector de cantidad y botón generar */}
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    flexWrap: 'wrap', 
                    gap: '1rem',
                    paddingTop: '0.5rem',
                    borderTop: '1px solid #f1f5f9'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        Cantidad de preguntas:
                      </span>
                      {[3, 5, 8, 10].map(count => (
                        <button
                          key={count}
                          type="button"
                          onClick={() => setAiQuestionCount(count)}
                          style={{
                            padding: '0.25rem 0.65rem',
                            borderRadius: '6px',
                            border: `1.5px solid ${aiQuestionCount === count ? 'var(--gold-dark)' : 'var(--border-color)'}`,
                            background: aiQuestionCount === count ? '#fffbeb' : '#ffffff',
                            color: aiQuestionCount === count ? '#92400e' : 'var(--text-secondary)',
                            fontWeight: aiQuestionCount === count ? 800 : 500,
                            fontSize: '0.78rem',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {count}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleGenerateQuestions('document')}
                      disabled={aiGenerating || !selectedResourceId}
                      className="btn btn-primary"
                      style={{
                        padding: '0.6rem 1.35rem',
                        fontSize: '0.84rem',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.45rem',
                        boxShadow: '0 2px 8px rgba(20,33,61,0.2)'
                      }}
                    >
                      {aiGenerating ? (
                        <>
                          <RefreshCw size={15} className="spin" /> Analizando documento con IA (~3-5s)...
                        </>
                      ) : (
                        <>
                          <Sparkles size={15} color="var(--gold)" /> Generar Preguntas con IA
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MODO B: DESDE TRANSCRIPCIÓN MANUAL */}
          {aiMode === 'transcript' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy)', marginBottom: '0.35rem' }}>
                  Pega la transcripción o resumen de la clase (Mín. 200 caracteres):
                </label>
                <textarea
                  value={manualTranscript}
                  onChange={(e) => setManualTranscript(e.target.value)}
                  placeholder="Pega aquí la transcripción de la sesión grabada o el texto explicativo de la clase..."
                  style={{
                    width: '100%',
                    minHeight: '110px',
                    padding: '0.75rem',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', marginTop: '0.25rem', color: manualTranscript.trim().length >= 200 ? '#16a34a' : '#64748b' }}>
                  <span>{manualTranscript.trim().length} caracteres</span>
                  {manualTranscript.trim().length < 200 && <span>Faltan {200 - manualTranscript.trim().length} para el mínimo</span>}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Cantidad de preguntas:
                  </span>
                  {[3, 5, 8, 10].map(count => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setAiQuestionCount(count)}
                      style={{
                        padding: '0.25rem 0.65rem',
                        borderRadius: '6px',
                        border: `1.5px solid ${aiQuestionCount === count ? 'var(--gold-dark)' : 'var(--border-color)'}`,
                        background: aiQuestionCount === count ? '#fffbeb' : '#ffffff',
                        color: aiQuestionCount === count ? '#92400e' : 'var(--text-secondary)',
                        fontWeight: aiQuestionCount === count ? 800 : 500,
                        fontSize: '0.78rem',
                        cursor: 'pointer'
                      }}
                    >
                      {count}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => handleGenerateQuestions('transcript')}
                  disabled={aiGenerating || manualTranscript.trim().length < 200}
                  className="btn btn-primary"
                  style={{ padding: '0.6rem 1.35rem', fontSize: '0.84rem', fontWeight: 700 }}
                >
                  {aiGenerating ? (
                    <>
                      <RefreshCw size={15} className="spin" /> Generando preguntas...
                    </>
                  ) : (
                    <>
                      <Sparkles size={15} color="var(--gold)" /> Generar desde Transcripción
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* MENSAJES DE ALERTA DE LA IA */}
          {aiError && (
            <div style={{
              marginTop: '1rem',
              padding: '0.75rem 1rem',
              background: '#fef2f2',
              color: '#b91c1c',
              border: '1px solid #fca5a5',
              borderRadius: '8px',
              fontSize: '0.84rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <AlertTriangle size={16} flexShrink={0} />
              <span>{aiError}</span>
            </div>
          )}

          {aiSuccess && (
            <div style={{
              marginTop: '1rem',
              padding: '0.75rem 1rem',
              background: '#f0fdf4',
              color: '#15803d',
              border: '1px solid #86efac',
              borderRadius: '8px',
              fontSize: '0.84rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <CheckCircle2 size={16} flexShrink={0} />
              <span>{aiSuccess}</span>
            </div>
          )}
        </div>
      )}

      {/* 3. PREGUNTAS Y OPCIONES */}
      <div className="card" style={{ padding: '1.5rem', background: 'white', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--navy)' }}>Constructor de Preguntas ({questions.length})</h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => addQuestion('single_choice')} className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.5rem 0.8rem' }}>
              <Plus size={14} style={{ marginRight: '0.3rem' }}/> Opción Múltiple
            </button>
            <button onClick={() => addQuestion('true_false')} className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.5rem 0.8rem' }}>
              <Plus size={14} style={{ marginRight: '0.3rem' }}/> Verdadero / Falso
            </button>
          </div>
        </div>

        {questions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', background: '#f8fafc', borderRadius: '6px' }}>
            No hay preguntas. Añade una para comenzar.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {questions.map((q, idx) => (
              <div key={q.id} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ background: '#f8fafc', padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', flex: 1 }}>
                    <div style={{ background: 'white', border: '1px solid #cbd5e1', width: '28px', height: '28px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem' }}>
                      {idx + 1}
                    </div>
                    <textarea 
                      value={q.text}
                      onChange={(e) => updateQuestionText(q.id, e.target.value)}
                      placeholder="Escribe la pregunta aquí..."
                      style={{ flex: 1, padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px', minHeight: '60px', fontFamily: 'inherit', resize: 'vertical' }}
                    />
                  </div>
                  <button onClick={() => deleteQuestion(q.id)} className="btn-icon del" title="Eliminar Pregunta" style={{ padding: '0.5rem' }}>
                    <Trash2 size={16} />
                  </button>
                </div>

                <div style={{ padding: '1rem' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Opciones ({q.question_type === 'single_choice' ? 'Selección Única' : 'Verdadero / Falso'})
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {q.options.map(opt => {
                      const isCorrect = q.correctOptionId === opt.id;
                      return (
                        <div key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <button 
                            onClick={() => setCorrectOption(q.id, opt.id)}
                            title="Marcar como correcta"
                            style={{ 
                              width: '28px', height: '28px', borderRadius: '50%', 
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              border: isCorrect ? 'none' : '2px solid #cbd5e1',
                              background: isCorrect ? '#22c55e' : 'transparent',
                              color: 'white', cursor: 'pointer', transition: 'all 0.2s'
                            }}
                          >
                            {isCorrect && <Check size={16} strokeWidth={3} />}
                          </button>
                          
                          <input 
                            type="text" 
                            value={opt.text}
                            onChange={(e) => updateOptionText(q.id, opt.id, e.target.value)}
                            disabled={q.question_type === 'true_false'}
                            style={{ flex: 1, padding: '0.5rem', border: isCorrect ? '1.5px solid #22c55e' : '1px solid var(--border-color)', borderRadius: '4px', background: q.question_type === 'true_false' ? '#f1f5f9' : 'white' }}
                          />
                          
                          {q.question_type !== 'true_false' && (
                            <button onClick={() => deleteOption(q.id, opt.id)} className="btn-icon del" style={{ padding: '0.5rem' }}>
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {q.question_type === 'single_choice' && (
                    <button onClick={() => addOption(q.id)} className="btn" style={{ marginTop: '0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--navy)', background: '#f1f5f9', padding: '0.4rem 0.75rem', borderRadius: '4px', border: 'none', cursor: 'pointer' }}>
                      <Plus size={14} /> Añadir opción
                    </button>
                  )}
                  
                  {!q.correctOptionId && (
                    <div style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <AlertTriangle size={12} /> Debes marcar una opción como correcta.
                    </div>
                  )}

                  {/* CAMPO DE RETROALIMENTACIÓN PEDAGÓGICA */}
                  <div style={{ marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px dashed #e2e8f0' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', fontWeight: 700, color: 'var(--navy)', marginBottom: '0.3rem' }}>
                      💡 Retroalimentación Pedagógica (Explicación para el estudiante)
                    </label>
                    <input 
                      type="text" 
                      value={q.explanation || ''} 
                      onChange={(e) => updateQuestionExplanation(q.id, e.target.value)}
                      placeholder="Escribe la explicación o justificación de la respuesta correcta..."
                      style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.83rem' }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL: CONFIRMAR REEMPLAZO O AÑADIR PREGUNTAS DE IA */}
      {replaceQuestionsModalOpen && pendingDraftToLoad && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 10000, padding: '1rem'
        }}>
          <div style={{
            background: '#ffffff', borderRadius: '14px', width: '100%', maxWidth: '500px',
            padding: '1.75rem', boxShadow: '0 20px 45px rgba(0,0,0,0.25)', position: 'relative',
            animation: 'fadeSlideUp 0.25s ease-out'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gold)' }}>
                <Layers size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--navy)' }}>
                  ¿Cómo deseas aplicar las preguntas?
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  El editor ya tiene {questions.length} {questions.length === 1 ? 'pregunta' : 'preguntas'} registradas.
                </p>
              </div>
            </div>

            <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '1.5rem' }}>
              La Inteligencia Artificial generó <strong>{pendingDraftToLoad.questions.length} preguntas</strong> a partir de <em>"{pendingDraftToLoad.sourceMeta.docTitle}"</em>. Selecciona cómo deseas organizarlas:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => applyGeneratedQuestions(pendingDraftToLoad.questions, pendingDraftToLoad.sourceMeta, 'replace', pendingDraftToLoad.activityTitle, pendingDraftToLoad.activityDescription)}
                style={{
                  padding: '0.85rem 1rem',
                  background: '#ffffff',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: '8px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseOver={e => e.currentTarget.style.borderColor = 'var(--navy)'}
                onMouseOut={e => e.currentTarget.style.borderColor = '#cbd5e1'}
              >
                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--navy)' }}>
                  🔄 Reemplazar todas las preguntas
                </div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Elimina las preguntas actuales del editor y deja únicamente las {pendingDraftToLoad.questions.length} generadas por la IA.
                </div>
              </button>

              <button
                type="button"
                onClick={() => applyGeneratedQuestions(pendingDraftToLoad.questions, pendingDraftToLoad.sourceMeta, 'append', pendingDraftToLoad.activityTitle, pendingDraftToLoad.activityDescription)}
                style={{
                  padding: '0.85rem 1rem',
                  background: '#ffffff',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: '8px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseOver={e => e.currentTarget.style.borderColor = 'var(--navy)'}
                onMouseOut={e => e.currentTarget.style.borderColor = '#cbd5e1'}
              >
                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--navy)' }}>
                  ➕ Añadir al final (Conservar las actuales)
                </div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Mantén tus preguntas existentes y añade las nuevas al final (Total: {questions.length + pendingDraftToLoad.questions.length} preguntas).
                </div>
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button
                type="button"
                onClick={() => { setReplaceQuestionsModalOpen(false); setPendingDraftToLoad(null); }}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#f1f5f9',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
