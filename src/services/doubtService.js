/**
 * Módulo: doubtService.js
 * Servicio para gestión y persistencia de dudas de estudiantes por clase en Supabase.
 */
import { supabase } from '@/lib/supabaseClient';

/**
 * Crea y guarda una nueva duda enviada por el estudiante para una clase específica.
 * 
 * @param {Object} doubtData
 * @param {string} doubtData.class_id - ID de la sesión de clase (obligatorio)
 * @param {string} [doubtData.module_id] - ID del módulo
 * @param {string} [doubtData.program_id] - ID del programa
 * @param {string} doubtData.student_id - ID del perfil del estudiante (users_profile.id)
 * @param {string} [doubtData.teacher_id] - ID del profesor asignado (teacher_profiles.id)
 * @param {string} doubtData.subject - Asunto de la duda (max 120 caracteres)
 * @param {string} doubtData.description - Descripción detallada (max 1500 caracteres)
 * @param {string} [doubtData.topic] - Tema relacionado opcional
 * @returns {Promise<{ data: Object|null, error: Error|null }>}
 */
export async function createDoubt(doubtData) {
  try {
    if (!doubtData.class_id) throw new Error('El ID de la clase es obligatorio.');
    if (!doubtData.student_id) throw new Error('El ID del estudiante es obligatorio.');
    if (!doubtData.subject?.trim()) throw new Error('El asunto de la duda es obligatorio.');
    if (!doubtData.description?.trim()) throw new Error('La descripción de la duda es obligatoria.');

    const payload = {
      class_id: doubtData.class_id,
      module_id: doubtData.module_id || null,
      program_id: doubtData.program_id || null,
      student_id: doubtData.student_id,
      teacher_id: doubtData.teacher_id || null,
      subject: doubtData.subject.trim(),
      description: doubtData.description.trim(),
      topic: doubtData.topic?.trim() || null,
      status: 'enviada'
    };

    const { data, error } = await supabase
      .from('class_doubts')
      .insert([payload])
      .select('*')
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (err) {
    console.error('Error al guardar la duda en Supabase:', err);
    return { data: null, error: err };
  }
}

/**
 * Obtiene la lista de dudas del estudiante actual para una clase específica.
 * 
 * @param {string} classId - ID de la clase
 * @param {string} [studentId] - ID del estudiante (opcional)
 * @returns {Promise<{ doubts: Array, error: Error|null }>}
 */
export async function fetchStudentDoubtsForClass(classId, studentId = null) {
  try {
    if (!classId) return { doubts: [], error: null };

    let query = supabase
      .from('class_doubts')
      .select('*')
      .eq('class_id', classId)
      .order('created_at', { ascending: false });

    if (studentId) {
      query = query.eq('student_id', studentId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return { doubts: data || [], error: null };
  } catch (err) {
    console.error('Error al consultar las dudas de la clase:', err);
    return { doubts: [], error: err };
  }
}

/**
 * Actualiza el estado de una duda (utilizado por el docente / admin).
 * Estados permitidos: 'enviada', 'revisada', 'atendida', 'archivada'.
 * 
 * @param {string} doubtId - ID de la duda
 * @param {string} newStatus - Nuevo estado
 * @returns {Promise<{ success: boolean, error: Error|null }>}
 */
export async function updateDoubtStatus(doubtId, newStatus) {
  try {
    const validStatuses = ['enviada', 'revisada', 'atendida', 'archivada'];
    if (!validStatuses.includes(newStatus)) {
      throw new Error(`Estado '${newStatus}' no es válido.`);
    }

    const { error } = await supabase
      .from('class_doubts')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', doubtId);

    if (error) throw error;
    return { success: true, error: null };
  } catch (err) {
    console.error('Error al actualizar el estado de la duda:', err);
    return { success: false, error: err };
  }
}
