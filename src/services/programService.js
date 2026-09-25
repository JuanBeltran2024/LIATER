/**
 * Módulo: programService.js
 * Capa de servicios y datos para la gestión de programas, portadas y consulta de próximos programas.
 */
import { supabase } from '@/lib/supabaseClient';

/**
 * Sube una imagen de portada al bucket de Supabase Storage 'program-covers'.
 * Requiere autenticación de Administrador.
 * 
 * @param {File} file - Archivo de imagen (JPG, PNG, WebP)
 * @param {string} programId - ID del programa asociado
 * @returns {Promise<{ publicUrl: string|null, filePath: string|null, error: Error|null }>}
 */
export async function uploadProgramCover(file, programId) {
  try {
    if (!file) throw new Error('No se proporcionó ningún archivo de imagen.');

    // 1. Validar Tipo MIME
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Formato no permitido. Solo se aceptan imágenes JPG, PNG y WebP.');
    }

    // 2. Validar Tamaño Máximo (5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new Error('El archivo excede el tamaño máximo permitido de 5MB.');
    }

    // 3. Generar Nombre Único para evitar sobreescrituras accidentales
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'png';
    const uniqueHash = Math.random().toString(36).substring(2, 8);
    const filePath = `covers/${programId || 'new'}_${Date.now()}_${uniqueHash}.${fileExt}`;

    // 4. Subir a Supabase Storage (Bucket: 'program-covers')
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('program-covers')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) throw uploadError;

    // 5. Obtener URL pública
    const { data: urlData } = supabase.storage
      .from('program-covers')
      .getPublicUrl(filePath);

    return {
      publicUrl: urlData?.publicUrl || null,
      filePath: uploadData?.path || filePath,
      error: null
    };
  } catch (err) {
    console.error('Error al subir imagen de portada:', err);
    return { publicUrl: null, filePath: null, error: err };
  }
}

/**
 * Obtiene los próximos programas disponibles para un estudiante:
 * - Publicados (`is_published = true`)
 * - En estado 'published' o 'upcoming'
 * - En los cuales el estudiante NO está inscrito aún
 * - Ordenados por fecha de inicio más cercana
 * - Máximo 3 resultados
 * 
 * @param {string} studentId - ID del estudiante actual
 * @param {number} [limit=3] - Límite de resultados
 * @returns {Promise<{ programs: Array, error: Error|null }>}
 */
export async function fetchUpcomingPrograms(studentId, limit = 3) {
  try {
    // 1. Obtener los IDs de los programas donde el estudiante YA está inscrito
    let enrolledProgramIds = [];
    if (studentId) {
      const { data: enrollments, error: enrollError } = await supabase
        .from('enrollments')
        .select('program_id')
        .eq('student_id', studentId);

      if (!enrollError && enrollments) {
        enrolledProgramIds = enrollments.map(e => e.program_id).filter(Boolean);
      }
    }

    // 2. Consultar programas próximos/publicados
    let query = supabase
      .from('diploma_programs')
      .select('*')
      .eq('is_published', true)
      .in('status', ['published', 'upcoming'])
      .order('start_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    // Excluir programas en los que ya está inscrito si aplica
    if (enrolledProgramIds.length > 0) {
      query = query.not('id', 'in', `(${enrolledProgramIds.join(',')})`);
    }

    const { data: programs, error: progError } = await query;
    if (progError) throw progError;

    return { programs: programs || [], error: null };
  } catch (err) {
    console.error('Error al consultar próximos programas:', err);
    return { programs: [], error: err };
  }
}

/**
 * Obtiene el progreso real calculado para un programa específico y estudiante:
 * (Clases pasadas o vistas / Total clases del programa) * 100
 * 
 * @param {string} programId - ID del programa
 * @returns {Promise<number>} Porcentaje de avance (0 a 100)
 */
export async function calculateProgramProgressDetails(programId, studentId) {
  try {
    if (!programId || !studentId) return { percentage: 0, totalClasses: 0, completedClassesValue: 0 };

    // 1. Fetch all class sessions for the program
    let { data: classes, error: classError } = await supabase
      .from('class_sessions')
      .select('id, video_url')
      .eq('program_id', programId);
      
    if (classError || !classes || classes.length === 0) {
      // Fallback para diplomados antiguos donde class_sessions.program_id pudiera ser null
      const { data: modules } = await supabase.from('modules').select('id').eq('program_id', programId);
      if (modules && modules.length > 0) {
        const modIds = modules.map(m => m.id);
        const { data: subtopicsData } = await supabase.from('subtopics').select('id').in('module_id', modIds);
        const subtopicIds = (subtopicsData || []).map(s => s.id);
        
        if (subtopicIds.length > 0) {
          const { data: fallbackClasses } = await supabase
            .from('class_sessions')
            .select('id, video_url')
            .in('subtopic_id', subtopicIds);
          classes = fallbackClasses || [];
        }
      }
    }
    
    const totalClasses = classes ? classes.length : 0;
    
    if (totalClasses === 0) return { percentage: 0, totalClasses: 0, completedClassesValue: 0 };

    const classIds = classes.map(c => c.id);

    // 2. Fetch all published activities for these classes directly
    let mandatoryActivities = [];
    if (classIds.length > 0) {
      const { data: acts, error: actError } = await supabase
        .from('class_activities')
        .select('id, class_id, is_published')
        .eq('is_published', true)
        .in('class_id', classIds);
      if (!actError && acts) {
        mandatoryActivities = acts;
      }
    }
    
    const activityIds = mandatoryActivities ? mandatoryActivities.map(a => a.id) : [];
    
    // 3. Fetch completed attempts for this student
    let uniqueCompletedActivities = new Set();
    if (activityIds.length > 0) {
      const { data: completedAttempts, error: attError } = await supabase
        .from('activity_attempts')
        .select('activity_id')
        .eq('student_id', studentId)
        .eq('status', 'completed')
        .in('activity_id', activityIds);
        
      if (!attError && completedAttempts) {
        uniqueCompletedActivities = new Set(completedAttempts.map(a => a.activity_id));
      }
    }
    
    // Map classId -> has mandatory activity, and is it completed
    const classActivityMap = {};
    if (mandatoryActivities) {
      mandatoryActivities.forEach(act => {
        classActivityMap[act.class_id] = {
          hasActivity: true,
          completed: uniqueCompletedActivities.has(act.id)
        };
      });
    }

    // 4. Calculate progress
    // Each class has an equal weight (100% / totalClasses)
    const classWeight = 100 / totalClasses;
    let totalProgressPercentage = 0;
    let completedClassesValue = 0;

    for (const cls of classes) {
      const hasRecording = !!cls.video_url && cls.video_url.trim() !== '';
      const actInfo = classActivityMap[cls.id];
      
      if (actInfo && actInfo.hasActivity) {
        // Recording = 80%, Activity = 20%
        if (hasRecording) {
          totalProgressPercentage += classWeight * 0.8;
          completedClassesValue += 0.8;
        }
        if (actInfo.completed) {
          totalProgressPercentage += classWeight * 0.2;
          completedClassesValue += 0.2;
        }
      } else {
        // If no activity, recording gives full 100% of the class weight
        if (hasRecording) {
          totalProgressPercentage += classWeight;
          completedClassesValue += 1;
        }
      }
    }
    
    const percentage = Math.round(totalProgressPercentage);
    return {
      percentage: Math.min(100, Math.max(0, percentage)),
      totalClasses,
      completedClassesValue: Math.round(completedClassesValue * 10) / 10
    };
  } catch (err) {
    console.error('Error al calcular detalles del progreso del programa:', err);
    return { percentage: 0, totalClasses: 0, completedClassesValue: 0 };
  }
}

export async function calculateProgramProgress(programId, studentId) {
  const details = await calculateProgramProgressDetails(programId, studentId);
  return details.percentage;
}
