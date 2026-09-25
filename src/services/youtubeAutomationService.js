import { supabase } from '@/lib/supabaseClient';

/**
 * Servicio: youtubeAutomationService
 * Maneja la extracción del ID de YouTube, la vinculación automática con clases
 * en Supabase y la integración de webhooks (Make.com / Zapier / N8N / Drive).
 */

/**
 * Extrae el ID único de 11 caracteres de cualquier URL de YouTube.
 * Soporta:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/shorts/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - VIDEO_ID directo de 11 caracteres
 * 
 * @param {string} input - URL o ID del video
 * @returns {string|null} ID de 11 caracteres o null si es inválido
 */
export function extractYouTubeId(input) {
  if (!input) return null;
  const str = input.trim();

  // Si ya es un ID de 11 caracteres alfanuméricos
  if (/^[a-zA-Z0-9_-]{11}$/.test(str)) {
    return str;
  }

  // Shorts
  if (str.includes('youtube.com/shorts/')) {
    const parts = str.split('youtube.com/shorts/')[1]?.split(/[?&/]/);
    if (parts && parts[0] && parts[0].length === 11) return parts[0];
  }

  // watch?v=
  if (str.includes('youtube.com/watch')) {
    try {
      const urlObj = new URL(str);
      const v = urlObj.searchParams.get('v');
      if (v && v.length === 11) return v;
    } catch (_) {
      const match = str.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
      if (match) return match[1];
    }
  }

  // youtu.be/
  if (str.includes('youtu.be/')) {
    const parts = str.split('youtu.be/')[1]?.split(/[?&/]/);
    if (parts && parts[0] && parts[0].length === 11) return parts[0];
  }

  // embed/
  if (str.includes('youtube.com/embed/')) {
    const parts = str.split('youtube.com/embed/')[1]?.split(/[?&/]/);
    if (parts && parts[0] && parts[0].length === 11) return parts[0];
  }

  return null;
}

/**
 * Genera la URL canónica de YouTube y la URL de Embed protegida a partir del ID o URL.
 * @param {string} input 
 * @returns {{ youtubeId: string|null, watchUrl: string|null, embedUrl: string|null }}
 */
export function formatYouTubeUrls(input) {
  const youtubeId = extractYouTubeId(input);
  if (!youtubeId) {
    return { youtubeId: null, watchUrl: input || null, embedUrl: null };
  }

  return {
    youtubeId,
    watchUrl: `https://www.youtube.com/watch?v=${youtubeId}`,
    embedUrl: `https://www.youtube.com/embed/${youtubeId}`
  };
}

/**
 * Vincula automáticamente un video de YouTube subido a una clase en Supabase.
 * Actualiza `video_url` y el estado de la clase a 'completed'.
 * 
 * @param {string} classId - ID de la clase en class_sessions
 * @param {string} videoInput - URL o ID de YouTube
 * @returns {Promise<{ success: boolean, data: object|null, error: string|null }>}
 */
export async function linkYouTubeVideoToClass(classId, videoInput) {
  if (!classId || !videoInput) {
    return { success: false, data: null, error: 'classId y videoInput son requeridos' };
  }

  const { youtubeId, watchUrl } = formatYouTubeUrls(videoInput);

  if (!youtubeId && !watchUrl) {
    return { success: false, data: null, error: 'No se pudo identificar una URL o ID válido de YouTube' };
  }

  try {
    const finalUrl = watchUrl || videoInput;

    const { data, error } = await supabase
      .from('class_sessions')
      .update({
        video_url: finalUrl
      })
      .eq('id', classId)
      .select('id, title, video_url')
      .single();

    if (error) {
      console.error('Error actualizando clase con video de YouTube:', error);
      return { success: false, data: null, error: error.message };
    }

    return {
      success: true,
      data: {
        ...data,
        youtubeId,
        watchUrl: finalUrl,
        embedUrl: youtubeId ? `https://www.youtube.com/embed/${youtubeId}` : null
      },
      error: null
    };
  } catch (err) {
    console.error('Excepción vinculando video de YouTube:', err);
    return { success: false, data: null, error: err.message };
  }
}

/**
 * Procesa la carga útil enviada por Webhook (Make.com / N8N / Zapier) cuando se sube un video desde Google Drive a YouTube.
 * Payload esperado: { class_id: "...", youtube_video_id: "...", youtube_url: "..." }
 * 
 * @param {object} payload 
 * @returns {Promise<{ success: boolean, message: string, classData: object|null }>}
 */
export async function processYouTubeWebhookPayload(payload) {
  if (!payload || !payload.class_id) {
    return { success: false, message: 'Payload inválido: se requiere class_id', classData: null };
  }

  const videoInput = payload.youtube_video_id || payload.youtube_url || payload.video_url;
  if (!videoInput) {
    return { success: false, message: 'Payload inválido: se requiere youtube_video_id o youtube_url', classData: null };
  }

  const res = await linkYouTubeVideoToClass(payload.class_id, videoInput);
  if (!res.success) {
    return { success: false, message: res.error, classData: null };
  }

  return {
    success: true,
    message: `Video de YouTube ID '${res.data.youtubeId}' vinculado exitosamente a la clase.`,
    classData: res.data
  };
}
