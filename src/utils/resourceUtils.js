/**
 * Utilidades para la gestión y descarga de recursos y materiales de estudio.
 */

/**
 * Obtiene la URL de descarga directa de un recurso.
 * Para archivos alojados en Google Drive, convierte la URL de vista previa/compartida
 * en una URL de exportación directa (export=download).
 * Para otros recursos, retorna la URL directa.
 *
 * @param {string} url - URL del recurso
 * @returns {string} URL directa para descarga
 */
export function getDownloadUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();

  // Caso Google Drive: extraer file ID y retornar enlace de descarga directa
  if (trimmed.includes('drive.google.com')) {
    const matchFile = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (matchFile && matchFile[1]) {
      return `https://drive.google.com/uc?export=download&id=${matchFile[1]}`;
    }
    const matchIdParam = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (matchIdParam && matchIdParam[1]) {
      return `https://drive.google.com/uc?export=download&id=${matchIdParam[1]}`;
    }
  }

  return trimmed;
}

/**
 * Dispara la descarga de un recurso de forma programática o abre la descarga directa en nueva pestaña.
 *
 * @param {string} url - URL original o de descarga
 * @param {string} [title] - Nombre sugerido del archivo
 */
export function triggerResourceDownload(url, title = '') {
  const downloadUrl = getDownloadUrl(url);
  if (!downloadUrl) return;

  // Si es Google Drive, abrimos la URL de descarga directa que fuerza el download del archivo
  if (downloadUrl.includes('drive.google.com')) {
    window.open(downloadUrl, '_blank', 'noopener,noreferrer');
    return;
  }

  // Para enlaces directos de archivos (PDF, ZIP, etc.)
  const link = document.createElement('a');
  link.href = downloadUrl;
  if (title) {
    link.download = title;
  }
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
