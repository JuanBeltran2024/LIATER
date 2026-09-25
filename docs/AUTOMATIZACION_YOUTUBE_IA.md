# 🤖 Documentación Técnica: Automatización de Grabaciones (YouTube) y Generación de Evaluaciones con IA (Gemini)
### Portal Educativo LIATER — Universidad Nacional de Colombia & Corenius

---

## 1. 🎯 Objetivo del Sistema

Automatizar el ciclo de vida posterior a cada clase virtual:
1. **Detectar y sincronizar** las grabaciones transmitidas o subidas al canal de YouTube del programa.
2. **Asociar automáticamente** el video a la clase correspondiente en la base de datos de LIATER (`class_sessions.video_url`).
3. **Extraer la transcripción textual** de la sesión académica impartida por el docente.
4. **Generar cuestionarios de reforzamiento formativo** mediante **Google Gemini AI** con preguntas contextualizadas, opciones múltiples y justificaciones pedagógicas paso a paso.

---

## 2. 🏛️ Diagrama de Flujo del Pipeline

```mermaid
sequenceDiagram
    autonumber
    participant YT as Canal de YouTube
    participant GAS as Google Apps Script (Cron Job)
    participant EdgeAuto as Edge Function: automatizacion-drive
    participant DB as Supabase PostgreSQL
    participant EdgeAI as Edge Function: generar-preguntas-reforzamiento
    participant Gemini as Google Gemini API
    participant UI as Aula Virtual (ClassDetail.jsx)

    Note over YT,GAS: 1. Detección Periódica
    GAS->>YT: Consulta videos recientes vía YouTube Data API
    GAS->>EdgeAuto: POST /automatizacion-drive (video_id, titulo, fecha)

    Note over EdgeAuto,DB: 2. Sincronización en Base de Datos
    EdgeAuto->>DB: Busca clase coincidente en `class_sessions`
    EdgeAuto->>DB: Actualiza `video_url` y estado de grabación
    EdgeAuto->>DB: Inserta registro en `drive_transcript_jobs` (status: pending)

    Note over EdgeAuto,EdgeAI: 3. Extracción de Transcripción
    EdgeAuto->>YT: Descarga subtítulos / transcripción oficial
    EdgeAuto->>DB: Guarda transcripción en `drive_transcript_jobs`

    Note over EdgeAI,Gemini: 4. Generación Pedagógica con IA
    EdgeAI->>DB: Lee transcripción de la clase
    EdgeAI->>Gemini: Envía transcripción con Prompt Pedagógico estructurado
    Gemini-->>EdgeAI: Responde con JSON (Preguntas, opciones, explicaciones)
    EdgeAI->>DB: Inserta cuestionario en `class_activities`

    Note over DB,UI: 5. Consumo por el Estudiante
    UI->>DB: Consulta actividad formativa de la clase
    UI-->>UI: Estudiante responde quiz y recibe retroalimentación inmediata
```

---

## 3. 🧩 Componentes del Sistema

### 3.1 Google Apps Script (`apps-script/AutomatizacionLIATER.gs`)
- **Ubicación:** `apps-script/AutomatizacionLIATER.gs`
- **Función:** Script de Google Apps Script configurado con un disparador por tiempo (*time-driven trigger*) para ejecutarse periódicamente (cada 30 a 60 minutos).
- **Flujo:**
  1. Utiliza el servicio avanzado `YouTube.PlaylistItems.list` o `YouTube.Search.list` con la cuenta del canal oficial.
  2. Identifica transmisiones finalizadas o videos publicados recientemente.
  3. Realiza una petición `UrlFetchApp.fetch` hacia la Edge Function de Supabase `automatizacion-drive` enviando el payload con la información del video.

### 3.2 Edge Function `automatizacion-drive`
- **Ubicación:** `supabase/functions/automatizacion-drive/index.ts`
- **Entorno:** Deno Runtime en Supabase Cloud.
- **Acciones:**
  - Recibe el webhook o llamada autorizada con el ID del video de YouTube.
  - Asocia el video a la clase en `class_sessions` basándose en coincidencia de fecha programada o título.
  - Dispara la tarea de extracción de subtítulos/transcripción.
  - Registra el trabajo en la tabla `drive_transcript_jobs`.

### 3.3 Edge Function `generar-preguntas-reforzamiento`
- **Ubicación:** `supabase/functions/generar-preguntas-reforzamiento/index.ts`
- **Entorno:** Deno Runtime en Supabase Cloud.
- **Integración con IA:** Utiliza el modelo `gemini-1.5-flash` o `gemini-1.5-pro` mediante la API oficial de Google AI Studio / Vertex AI.
- **Estructura del Prompt Pedagógico:**
  - Rol asignado al modelo: *Experto pedagogo universitario en ingeniería y tecnologías de la información*.
  - Parámetros: Entre 3 y 5 preguntas de selección múltiple (A, B, C, D).
  - Cada pregunta incluye:
    - Enunciado claro contextualizado a lo explicado por el profesor.
    - 4 opciones de respuesta donde sólo 1 es correcta.
    - Explicación conceptual detallada del porqué de la respuesta correcta.
  - Formato de salida: JSON estrictamente estructurado sin markdown residual.

### 3.4 Interfaz de Estudiante (`src/pages/ClassDetail.jsx`)
- En la pestaña **"Actividades"** del visor de clase:
  - El alumno visualiza el cuestionario interactivo.
  - Al completar el intento, la plataforma evalúa las respuestas contra la tabla `class_activities`, calcula el puntaje sobre 5.0, registra el intento en `activity_submissions` y muestra al estudiante la retroalimentación inmediata con justificación pedagógica de cada opción.

---

## 4. 🔐 Configuración de Secrets

En el panel de Supabase (`Project Settings` $\rightarrow$ `Edge Functions` $\rightarrow$ `Secrets`):

| Secret | Descripción |
| :--- | :--- |
| `GEMINI_API_KEY` | Llave de API para invocar el modelo Gemini |
| `SUPABASE_SERVICE_ROLE_KEY` | Llave de servicio para escribir en `class_activities` y `drive_transcript_jobs` |
| `SUPABASE_URL` | URL de la instancia de Supabase |
