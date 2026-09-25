import { supabase } from '@/lib/supabaseClient';
import { safeJsonParse } from '@/utils/storageUtils';

/**
 * Servicio: activityService
 * Consulta y unifica actividades pendientes de tareas (assignments), cuestionarios (quizzes),
 * sesiones en vivo (class_sessions) y anuncios urgentes (announcements) para el estudiante autenticado.
 * Diseñado con alta resiliencia para no fallar aunque alguna tabla no exista o esté vacía.
 */

/**
 * Obtiene las actividades pendientes de un estudiante.
 * @param {string} studentId - ID del estudiante
 * @param {number|null} limit - Número máximo de actividades a devolver (default: 4)
 * @returns {Promise<{ activities: Array, error: string|null }>}
 */
export async function fetchStudentPendingActivities(studentId, limit = 4) {
  if (!studentId) return { activities: [], error: null };

  try {
    const pendingActivities = [];
    const programMap = {};
    let programIds = [];

    // -------------------------------------------------------------
    // 1. OBTENER PROGRAMAS A LOS QUE ESTÁ INSCRITO EL ESTUDIANTE (SOLO PUBLICADOS)
    // -------------------------------------------------------------
    try {
      let { data: enrollments, error: enrollErr } = await supabase
        .from('enrollments')
        .select('program_id, diploma_programs(id, title, is_published, status)')
        .eq('student_id', studentId);

      if (enrollErr || !enrollments || enrollments.length === 0) {
        const { data: legacyEnrollments } = await supabase
          .from('enrollments')
          .select('diploma_id, diploma_programs(id, title, is_published, status)')
          .eq('student_id', studentId);
        enrollments = legacyEnrollments;
      }

      if (enrollments) {
        programIds = enrollments
          .filter(e => {
            const prog = e.diploma_programs;
            if (!prog) return true; // si no hay relación cargada, mantenemos resiliencia
            return prog.is_published !== false && prog.status !== 'draft' && prog.status !== 'disabled';
          })
          .map(e => {
            const pId = e.program_id || e.diploma_id;
            if (pId) {
              programMap[pId] = e.diploma_programs?.title || 'Programa Inscrito';
              return pId;
            }
            return null;
          }).filter(Boolean);
      }
    } catch (err) {
      console.warn('Advertencia al consultar inscripciones:', err);
    }

    const now = new Date();
    
    // Obtener la fecha local usando el offset de la zona horaria
    const tzOffset = now.getTimezoneOffset() * 60000;
    const todayStr = new Date(now.getTime() - tzOffset).toISOString().split('T')[0];

    // -------------------------------------------------------------
    // 1.5 RECOPILAR ACTIVIDADES Y CLASES YA COMPLETADAS/REALIZADAS
    // -------------------------------------------------------------
    const completedActivityIds = new Set();
    const completedActivityCounts = new Map();
    let totalStudentAttempts = 0;

    const addCompleted = (id) => {
      if (!id) return;
      const strId = String(id).toLowerCase();
      completedActivityIds.add(strId);
      completedActivityCounts.set(strId, (completedActivityCounts.get(strId) || 0) + 1);
    };

    try {
      // A. Intentos completados en activity_attempts
      const { data: attempts } = await supabase
        .from('activity_attempts')
        .select('activity_id, student_id, score')
        .eq('student_id', studentId);
      
      const activityBestScores = new Map();

      if (attempts) {
        totalStudentAttempts += attempts.length;
        attempts.forEach(att => {
          if (att.activity_id) {
            addCompleted(att.activity_id);
            const strId = String(att.activity_id).toLowerCase();
            const currentBest = activityBestScores.get(strId) || 0;
            if (att.score && att.score > currentBest) {
              activityBestScores.set(strId, att.score);
            }
          }
        });
      }

      // B. Entregas en assignment_submissions
      const { data: subAss } = await supabase
        .from('assignment_submissions')
        .select('assignment_id')
        .eq('student_id', studentId);
      if (subAss) {
        totalStudentAttempts += subAss.length;
        subAss.forEach(s => {
          if (s.assignment_id) addCompleted(s.assignment_id);
        });
      }

      // C. Cuestionarios en quiz_submissions
      const { data: qSubs } = await supabase
        .from('quiz_submissions')
        .select('quiz_id')
        .eq('student_id', studentId);
      if (qSubs) {
        totalStudentAttempts += qSubs.length;
        qSubs.forEach(q => {
          if (q.quiz_id) addCompleted(q.quiz_id);
        });
      }

      // D. Escanear todo localStorage (completed_activities, liater_answers, completed_classes, etc.)
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        if (k.startsWith('completed_activities_') || k.startsWith('completed_classes_')) {
          const parsed = safeJsonParse(k, null);
          if (Array.isArray(parsed)) {
            parsed.forEach(idVal => {
              if (idVal) {
                addCompleted(idVal);
                totalStudentAttempts++;
              }
            });
          }
        } else if (k.startsWith('liater_answers_')) {
          const rest = k.slice('liater_answers_'.length);
          const lastUnderscore = rest.lastIndexOf('_');
          if (lastUnderscore !== -1) {
            const actId = rest.slice(0, lastUnderscore);
            if (actId) {
              addCompleted(actId);
              totalStudentAttempts++;
            }
          } else {
            addCompleted(rest);
            totalStudentAttempts++;
          }
        }
      }
    } catch (err) {
      console.warn('Advertencia al verificar actividades completadas:', err);
    }

    // -------------------------------------------------------------
    // 2. CONSULTAR TAREAS / ENTREGABLES (assignments)
    // -------------------------------------------------------------
    if (programIds.length > 0) {
      try {
        const { data: assignments, error: assErr } = await supabase
          .from('assignments')
          .select('id, program_id, title, description, due_date, is_published')
          .in('program_id', programIds)
          .eq('is_published', true);

        if (!assErr && assignments && assignments.length > 0) {
          assignments.forEach(ass => {
            const strId = String(ass.id).toLowerCase();
            const strTitle = String(ass.title).toLowerCase();
            if (completedActivityIds.has(strId) || completedActivityIds.has(strTitle)) return; // Omitir entregadas/realizadas

            const dueDate = new Date(ass.due_date);
            const tzOffsetAss = dueDate.getTimezoneOffset() * 60000;
            const dueDateStr = new Date(dueDate.getTime() - tzOffsetAss).toISOString().split('T')[0];

            let urgency = 'upcoming';
            let statusLabel = 'Próxima';

            if (dueDateStr === todayStr) {
              urgency = 'today';
              statusLabel = 'Hoy';
            } else if (dueDate < now) {
              return; // No mostrar entregas vencidas en los pendientes activos
            }

            pendingActivities.push({
              id: ass.id,
              title: ass.title,
              type: 'Entrega',
              programId: ass.program_id,
              programTitle: programMap[ass.program_id] || 'Programa Inscrito',
              date: ass.due_date,
              urgency,
              statusLabel,
              link: `/modules/${ass.program_id}`
            });
          });
        }
      } catch (err) {
        console.info('Información: Tabla assignments en preparación o sin registros.', err);
      }

      // -------------------------------------------------------------
      // 3. CONSULTAR CUESTIONARIOS (quizzes)
      // -------------------------------------------------------------
      try {
        const { data: quizzes, error: quizErr } = await supabase
          .from('quizzes')
          .select('id, program_id, title, description, due_date, is_published')
          .in('program_id', programIds)
          .eq('is_published', true);

        if (!quizErr && quizzes && quizzes.length > 0) {
          const quizIds = quizzes.map(q => q.id);
          let completedQuizIds = new Set();

          try {
            const { data: quizSubmissions } = await supabase
              .from('quiz_submissions')
              .select('quiz_id')
              .eq('student_id', studentId)
              .in('quiz_id', quizIds);

            if (quizSubmissions) {
              completedQuizIds = new Set(quizSubmissions.map(s => s.quiz_id));
            }
          } catch {
            // Ignorar si la tabla de intentos de cuestionario aún no tiene datos
          }

          quizzes.forEach(qz => {
            const strId = String(qz.id).toLowerCase();
            const strTitle = String(qz.title).toLowerCase();
            if (completedActivityIds.has(strId) || completedActivityIds.has(strTitle) || completedQuizIds.has(qz.id)) return; // Omitir completados

            const dueDate = new Date(qz.due_date);
            const tzOffsetQz = dueDate.getTimezoneOffset() * 60000;
            const dueDateStr = new Date(dueDate.getTime() - tzOffsetQz).toISOString().split('T')[0];

            let urgency = 'upcoming';
            let statusLabel = 'Próxima';

            if (dueDateStr === todayStr) {
              urgency = 'today';
              statusLabel = 'Hoy';
            } else if (dueDate < now) {
              return; // No mostrar cuestionarios vencidos en los pendientes activos
            }

            pendingActivities.push({
              id: qz.id,
              title: qz.title,
              type: 'Actividad de Reforzamiento',
              programId: qz.program_id,
              programTitle: programMap[qz.program_id] || 'Programa Inscrito',
              date: qz.due_date,
              urgency,
              statusLabel: 'Pendiente',
              link: `/modules/${qz.program_id}`
            });
          });
        }
      } catch (err) {
        console.info('Información sobre cuestionarios:', err);
      }
    }

    // -------------------------------------------------------------
    // 3.5. CONSULTAR SESIONES EN VIVO PRÓXIMAS (class_sessions)
    // (Mover antes de class_activities para calcular due_date basado en la siguiente clase)
    // -------------------------------------------------------------
    const classMap = {};
    const futureClassesByProgram = {};

    if (programIds.length > 0) {
      try {
        const [
          { data: classes, error: classErr },
          { data: subtopicsData }
        ] = await Promise.all([
          supabase
            .from('class_sessions')
            .select('id, title, class_date, duration, program_id, teacher_id, subtopic_id')
            .in('program_id', programIds)
            .order('class_date', { ascending: true })
            .limit(100),
          supabase
            .from('subtopics')
            .select('id, title, program_id, module_id, order_index')
            .in('program_id', programIds)
        ]);

        const sessionMap = {};
        (subtopicsData || []).forEach(st => {
          if (st.id && st.title) sessionMap[st.id] = st.title;
        });

        // Fallback si no vinieron por program_id
        if (Object.keys(sessionMap).length === 0) {
          const { data: mods } = await supabase.from('modules').select('id').in('program_id', programIds);
          if (mods && mods.length > 0) {
            const modIds = mods.map(m => m.id);
            const { data: stByMod } = await supabase.from('subtopics').select('id, title').in('module_id', modIds);
            (stByMod || []).forEach(st => {
              if (st.id && st.title) sessionMap[st.id] = st.title;
            });
          }
        }

        if (!classErr && classes) {
          const sessionGroups = new Map();

          classes.forEach(cls => {
            if (!cls.class_date) return;
            const strId = String(cls.id).toLowerCase();
            const strTitle = String(cls.title).toLowerCase();
            
            // Inicializar array para el programa si no existe
            if (!futureClassesByProgram[cls.program_id]) {
              futureClassesByProgram[cls.program_id] = [];
            }
            
            const clsDate = new Date(cls.class_date);

            // Solo agregar a la lista de clases futuras si no ha pasado
            if (clsDate > now) {
              futureClassesByProgram[cls.program_id].push(cls);
            }

            if (completedActivityIds.has(strId) || completedActivityIds.has(strTitle)) return; // Omitir clases ya realizadas
            
            // Guardar primera clase (futura o sin realizar) asociada al programa para redirección
            if (!classMap[cls.program_id]) {
              classMap[cls.program_id] = cls.id;
            }

            if (clsDate < now) return; // Solo mostramos clases futuras en pendientes

            // Agrupar por sesión (subtopic_id) si existe, o por clase individual
            const sessionKey = cls.subtopic_id 
              ? `${cls.program_id}_sub_${cls.subtopic_id}` 
              : `${cls.program_id}_cls_${cls.id}`;

            if (!sessionGroups.has(sessionKey)) {
              const sessionTitle = (cls.subtopic_id && sessionMap[cls.subtopic_id])
                ? sessionMap[cls.subtopic_id]
                : cls.title;

              sessionGroups.set(sessionKey, {
                id: cls.id,
                sessionId: cls.subtopic_id || cls.id,
                title: sessionTitle,
                programId: cls.program_id,
                programTitle: programMap[cls.program_id] || 'Programa Inscrito',
                classes: [],
                earliestDate: clsDate,
                latestDate: clsDate,
                latestDuration: Number(cls.duration) || 90
              });
            }

            const group = sessionGroups.get(sessionKey);
            group.classes.push(cls);
            if (clsDate < group.earliestDate) {
              group.earliestDate = clsDate;
            }
            if (clsDate > group.latestDate) {
              group.latestDate = clsDate;
              group.latestDuration = Number(cls.duration) || 90;
            }
          });

          // Convertir los grupos de sesiones en actividades pendientes (ordenados por fecha de inicio)
          const sortedSessionGroups = Array.from(sessionGroups.values()).sort((a, b) => a.earliestDate - b.earliestDate);

          sortedSessionGroups.forEach(group => {
            const classCount = group.classes.length;
            const startDate = group.earliestDate;
            const tzOffset = startDate.getTimezoneOffset() * 60000;
            const clsDateStr = new Date(startDate.getTime() - tzOffset).toISOString().split('T')[0];

            let urgency = 'upcoming';
            let statusLabel = 'Próxima';

            if (clsDateStr === todayStr) {
              urgency = 'today';
              statusLabel = 'Hoy';
            }

            let timeRange = null;
            if (classCount > 1) {
              const startHour = startDate.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false, hourCycle: 'h23' });
              const endCalc = new Date(group.latestDate.getTime() + group.latestDuration * 60 * 1000);
              const endHour = endCalc.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false, hourCycle: 'h23' });
              timeRange = `${startHour} - ${endHour} hs`;
            }

            pendingActivities.push({
              id: group.id,
              title: group.title,
              type: 'Sesión en vivo',
              programId: group.programId,
              programTitle: group.programTitle,
              date: startDate.toISOString(),
              urgency,
              statusLabel,
              classCount,
              timeRange,
              link: `/class/${group.classes[0].id}`
            });
          });
        }
      } catch (err) {
        console.info('Información sobre clases:', err);
      }
    }

    // -------------------------------------------------------------
    // 4. CONSULTAR ACTIVIDADES PUBLICADAS EN CLASES (class_activities)
    // -------------------------------------------------------------
    if (programIds.length > 0) {
      try {
        const programHasClassActivitiesInDb = new Set();
        const programCompletedActivities = new Set();

        const { data: classActs, error: actErr } = await supabase
          .from('class_activities')
          .select('id, class_id, title, description, due_date, max_attempts, class_sessions!inner(id, program_id, title, video_url, class_date, teacher_id)')
          .eq('is_published', true);

        if (classActs) {
          classActs.forEach(ca => {
            const clsSession = ca.class_sessions;
            const pId = clsSession?.program_id;
            
            // Solo incluir si pertenece a un programa inscrito del estudiante
            if (pId && programIds.includes(pId)) {
              programHasClassActivitiesInDb.add(pId);
              const strId = String(ca.id).toLowerCase();
              const strTitle = String(ca.title || '').toLowerCase();
              const strClassId = String(ca.class_id || '').toLowerCase();

              const bestScore = activityBestScores.get(strId) || 0;
              const attemptsCount = completedActivityCounts.get(strId) || 0;
              const maxAttempts = ca.max_attempts || 1;
              const hasReachedMaxAttempts = maxAttempts > 0 && attemptsCount >= maxAttempts;
              const isPerfectScore = bestScore >= 100;
              
              const isCompleted = hasReachedMaxAttempts || isPerfectScore ||
                                  completedActivityIds.has(strTitle) || 
                                  completedActivityIds.has(strClassId) ||
                                  completedActivityIds.has(`reforzamiento-${pId}`) ||
                                  completedActivityIds.has(String(pId).toLowerCase());

              if (isCompleted) {
                programCompletedActivities.add(pId);
                return; // Omitir si ya fue realizada
              }

              let dueDate = new Date();
              if (ca.due_date) {
                dueDate = new Date(ca.due_date);
              } else {
                const teacherId = clsSession?.teacher_id;
                const nextClasses = futureClassesByProgram[pId];
                let nextClassOfSameTeacher = null;
                
                if (nextClasses && nextClasses.length > 0 && teacherId) {
                  nextClassOfSameTeacher = nextClasses.find(c => c.teacher_id === teacherId);
                }
                
                if (nextClassOfSameTeacher) {
                  const nextClassDate = new Date(nextClassOfSameTeacher.class_date);
                  // 5 min antes de la siguiente clase del mismo profe
                  dueDate = new Date(nextClassDate.getTime() - 5 * 60000);
                } else if (clsSession?.class_date) {
                  // 7 dias despues de la clase actual
                  const currClassDate = new Date(clsSession.class_date);
                  dueDate = new Date(currClassDate.getTime() + 7 * 24 * 60 * 60000);
                }
              }

              // Si la actividad ya venció, NO mostrarla en los pendientes
              if (dueDate < now) {
                return;
              }

              const tzOffsetActivity = dueDate.getTimezoneOffset() * 60000;
              const dueDateStr = new Date(dueDate.getTime() - tzOffsetActivity).toISOString().split('T')[0];

              let urgency = 'upcoming';
              let statusLabel = 'Sin realizar';

              if (dueDateStr === todayStr) {
                urgency = 'today';
                statusLabel = 'Hoy';
              }

              pendingActivities.push({
                id: ca.id,
                title: ca.title || 'Actividad de Reforzamiento',
                type: 'Actividad de Reforzamiento',
                programId: pId,
                programTitle: programMap[pId] || 'Programa Inscrito',
                date: dueDate.toISOString(),
                urgency,
                statusLabel,
                link: `/class/${ca.class_id}`
              });
            }
          });
        }
      } catch (err) {
        console.info('Información sobre class_activities:', err);
      }

      // Fallback: generar actividad de reforzamiento por defecto ÚNICAMENTE si:
      // 1. NO hay actividades reales publicadas en base de datos para ese programa
      // 2. El estudiante NO ha completado la actividad de este programa
      // 3. No está en completedActivityIds
      try {
        if (programIds.length > 0) {
          programIds.forEach(pId => {
            // Si ya hay actividades reales en base de datos para este programa, NO generar fallback
            if (programHasClassActivitiesInDb.has(pId)) return;

            // Si el estudiante ya completó una actividad para este programa, NO generar fallback
            if (programCompletedActivities.has(pId)) return;

            const refId = `reforzamiento-${pId}`;
            const isDone = completedActivityIds.has(refId) || 
                           completedActivityIds.has(refId.toLowerCase()) || 
                           completedActivityIds.has(String(pId).toLowerCase());
            if (isDone) return;

            // Calcular fecha límite: 5 min antes de la próxima clase del programa
            let defaultDate = null;
            const nextClasses = futureClassesByProgram[pId];
            if (nextClasses && nextClasses.length > 0) {
              // Usar la próxima clase que esté en el futuro
              const nextCls = nextClasses.find(c => new Date(c.class_date) > now);
              if (nextCls) {
                defaultDate = new Date(new Date(nextCls.class_date).getTime() - 5 * 60000);
              }
            }
            
            // Si no hay clase futura o la fecha ya venció, no mostrar
            if (!defaultDate || defaultDate < now) return;

            const tzOffsetFallback = defaultDate.getTimezoneOffset() * 60000;
            const defDateStr = new Date(defaultDate.getTime() - tzOffsetFallback).toISOString().split('T')[0];
            let urgency = 'upcoming';
            let statusLabel = 'Sin realizar';
            
            if (defDateStr === todayStr) {
              urgency = 'today';
              statusLabel = 'Hoy';
            }

            pendingActivities.push({
              id: refId,
              title: `Actividad de Reforzamiento - ${programMap[pId] || 'Repaso Módulo'}`,
              type: 'Actividad de Reforzamiento',
              programId: pId,
              programTitle: programMap[pId] || 'Programa Inscrito',
              date: defaultDate.toISOString(),
              urgency,
              statusLabel,
              link: classMap[pId] ? `/class/${classMap[pId]}` : `/modules/${pId}`
            });
          });
        }
      } catch (err) {
        console.info('Información: Generando actividades de reforzamiento por defecto.', err);
      }
    }

    // Actualizar enlaces de entregas y reforzamientos por defecto a la clase correspondiente si está disponible
    pendingActivities.forEach(act => {
      if (act.type !== 'Sesión en vivo' && act.programId && classMap[act.programId]) {
        // Solo sobreescribir el link si es un reforzamiento por defecto (que empieza por reforzamiento-) 
        // o si el link actual apunta a /modules/ (y no a una clase específica)
        if (String(act.id).startsWith('reforzamiento-') || String(act.link).startsWith('/modules/')) {
          act.link = `/class/${classMap[act.programId]}`;
        }
      }
    });

    // -------------------------------------------------------------
    // 5. CONSULTAR ÚLTIMOS ANUNCIOS PUBLICADOS (TODOS LOS TIPOS: general, info, urgent)
    // -------------------------------------------------------------
    const latestAnnouncements = [];
    if (programIds.length > 0) {
      try {
        const { data: annData, error: annErr } = await supabase
          .from('announcements')
          .select('id, title, body, created_at, tag, program_id, teacher_id, teacher_profiles(name), diploma_programs(id, title, is_published, status)')
          .in('program_id', programIds)
          .order('created_at', { ascending: false })
          .limit(10);

        if (!annErr && annData) {
          annData.forEach(ann => {
            const prog = ann.diploma_programs;
            if (prog && (prog.is_published === false || prog.status === 'draft' || prog.status === 'disabled')) {
              return;
            }

            const rawTag = (ann.tag || 'general').toLowerCase();
            let tagKey = 'general';
            let statusLabel = 'General';
            let urgency = 'upcoming';

            if (rawTag === 'urgent' || rawTag === 'urgente') {
              tagKey = 'urgent';
              statusLabel = 'Urgente';
              urgency = 'overdue';
            } else if (rawTag === 'info' || rawTag === 'informativo') {
              tagKey = 'info';
              statusLabel = 'Informativo';
              urgency = 'today';
            }

            const progTitle = ann.diploma_programs?.title || programMap[ann.program_id] || 'Aviso General';
            const teacherName = ann.teacher_profiles?.name || 'Administración Académica';

            const announcementObj = {
              id: ann.id,
              title: ann.title,
              body: ann.body || '',
              type: 'Anuncio',
              tag: tagKey,
              programId: ann.program_id,
              programTitle: progTitle,
              teacherName: teacherName,
              isAdmin: !ann.teacher_id,
              date: ann.created_at,
              urgency,
              statusLabel,
              link: ann.program_id ? `/dashboard/${ann.program_id}` : `/portal`
            };

            latestAnnouncements.push(announcementObj);

            // Si es urgente, también lo agregamos a pendingActivities
            if (tagKey === 'urgent') {
              pendingActivities.push({
                ...announcementObj,
                type: 'Anuncio importante'
              });
            }
          });
        }
      } catch (err) {
        console.info('Información sobre announcements:', err);
      }
    }

    // Consultar también anuncios institucionales globales sin program_id
    try {
      const { data: globalAnn } = await supabase
        .from('announcements')
        .select('id, title, body, created_at, tag, program_id, teacher_id, teacher_profiles(name)')
        .is('program_id', null)
        .order('created_at', { ascending: false })
        .limit(5);

      if (globalAnn && globalAnn.length > 0) {
        globalAnn.forEach(ann => {
          const rawTag = (ann.tag || 'general').toLowerCase();
          let tagKey = 'general';
          let statusLabel = 'General';
          let urgency = 'upcoming';

          if (rawTag === 'urgent' || rawTag === 'urgente') {
            tagKey = 'urgent';
            statusLabel = 'Urgente';
            urgency = 'overdue';
          } else if (rawTag === 'info' || rawTag === 'informativo') {
            tagKey = 'info';
            statusLabel = 'Informativo';
            urgency = 'today';
          }

          const teacherName = ann.teacher_profiles?.name || 'Administración General';

          latestAnnouncements.push({
            id: ann.id,
            title: ann.title,
            body: ann.body || '',
            type: 'Anuncio',
            tag: tagKey,
            programId: null,
            programTitle: 'Aviso Institucional',
            teacherName: teacherName,
            isAdmin: !ann.teacher_id,
            date: ann.created_at,
            urgency,
            statusLabel,
            link: `/portal`
          });
        });

        latestAnnouncements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      }
    } catch (err) {
      console.info('Información sobre anuncios globales:', err);
    }

    // -------------------------------------------------------------
    // 6. ORDEN DE PRIORIDAD ESTRICTO POR FECHA (MÁS ANTIGUAS PRIMERO)
    // Se filtran únicamente actividades NO realizadas y se ordenan prioritariamente por fecha más cercana/antigua.
    // -------------------------------------------------------------
    pendingActivities.sort((a, b) => {
      const timeA = a.date ? new Date(a.date).getTime() : Infinity;
      const timeB = b.date ? new Date(b.date).getTime() : Infinity;
      return timeA - timeB; // Las fechas más antiguas/cercanas primero
    });

    return {
      activities: limit ? pendingActivities.slice(0, limit) : pendingActivities,
      announcements: latestAnnouncements.slice(0, 5), // Hasta 5 últimos anuncios publicados
      error: null
    };
  } catch (err) {
    console.error('Error al procesar pendientes:', err);
    return { activities: [], announcements: [], error: null };
  }
}

/**
 * Obtiene la racha de semanas activas de un estudiante.
 * Una semana es activa si el estudiante ha completado al menos una Actividad de Reforzamiento (Opción 2).
 * 
 * @param {string} studentId - ID del estudiante
 * @returns {Promise<{ streak: number, error: string|null }>}
 */
export async function fetchStudentStreak(studentId) {
  if (!studentId) return { streak: 0, error: null };

  try {
    const dates = [];

    // 1. Obtener fechas de intentos (activity_attempts) - Opción 2: Solo Actividades de Reforzamiento
    const { data: attempts, error: attErr } = await supabase
      .from('activity_attempts')
      .select('completed_at')
      .eq('student_id', studentId);
      
    if (attErr) console.error("Error al obtener activity_attempts en racha:", attErr);
      
    if (attempts) {
      attempts.forEach(a => {
        if (a.completed_at) dates.push(new Date(a.completed_at));
      });
    }

    if (dates.length === 0) {
      return { streak: 0, error: null };
    }

    // Función para obtener un índice de semana desde un Lunes de referencia
    const EPOCH_MONDAY = new Date('2020-01-06T00:00:00Z').getTime();
    const getWeekIndex = (dateObj) => {
      // Ajuste básico de timezone
      const tzOffset = dateObj.getTimezoneOffset() * 60000;
      const localTime = dateObj.getTime() - tzOffset;
      return Math.floor((localTime - EPOCH_MONDAY) / (7 * 86400000));
    };

    // Convertir fechas a índices de semana y crear un Set
    const activeWeeks = new Set(dates.map(getWeekIndex));
    
    const now = new Date();
    const currentWeekIndex = getWeekIndex(now);

    let streak = 0;
    
    // Si no está activa la semana actual, revisamos si estuvo activo la semana anterior
    // Si no estuvo activo ni la actual ni la anterior, la racha se perdió (es 0).
    let weekToCheck = currentWeekIndex;
    
    if (!activeWeeks.has(weekToCheck)) {
      weekToCheck--;
    }

    // Contar semanas consecutivas hacia atrás
    while (activeWeeks.has(weekToCheck)) {
      streak++;
      weekToCheck--;
    }

    return { streak, error: null };
  } catch (error) {
    console.error('Error calculando racha:', error);
    return { streak: 0, error: error.message };
  }
}
