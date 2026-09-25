-- ============================================================================
-- Migración: Agregar columna allow_download a la tabla resources
-- Permite que administradores y profesores controlen si un recurso
-- puede ser descargado directamente por los estudiantes o es solo lectura in-app.
-- ============================================================================

-- 1. Agregar columna allow_download con valor predeterminado false
ALTER TABLE public.resources
ADD COLUMN IF NOT EXISTS allow_download boolean NOT NULL DEFAULT false;

-- 2. Asegurar que los registros existentes tengan valor false
UPDATE public.resources
SET allow_download = false
WHERE allow_download IS NULL;

-- 3. Crear índice para optimizar consultas que filtren por disponibilidad de descarga
CREATE INDEX IF NOT EXISTS idx_resources_allow_download ON public.resources(allow_download);

-- 4. Notificar a PostgREST para recargar la caché del esquema
NOTIFY pgrst, 'reload schema';
