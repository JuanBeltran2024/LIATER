# 🤖 Contexto Exhaustivo del Proyecto LIATER (LMS)
### Guía Técnica, Arquitectura y Reglas Operativas para Asistentes de IA

---

## 1. 📌 Naturaleza y Propósito del Proyecto
**LIATER** es una plataforma integral de tipo Learning Management System (LMS) orientada a la gestión y entrega de programas académicos de la **Universidad Nacional de Colombia — Sede Bogotá** en alianza con **Corenius**. 

La plataforma soporta diferentes modalidades académicas mediante el campo `program_type` ('diplomado', 'curso', 'taller'), adaptando automáticamente la interfaz, navegación y consultas:
- **Diplomados:** Módulos $\rightarrow$ Sesiones $\rightarrow$ Clases.
- **Cursos Cortos:** Sesiones $\rightarrow$ Clases (los módulos se ocultan automáticamente en la barra lateral y en el enrutador).

---

## 2. 🛠️ Stack Tecnológico
- **Frontend Core:** `React 19` + `Vite 8` con Hot Module Replacement (HMR).
- **Enrutamiento:** `react-router-dom` v6 con rutas protegidas (`ProtectedRoute.jsx`) y contexto de programa.
- **Estado Global:** Context API nativo (`AuthContext.jsx`) para autenticación y roles (`admin`, `teacher`, `student`). Contexto del curso activo en `localStorage` (`activeProgramId`, `activeProgramType`).
- **3D & WebGL:** `Three.js` + `@react-three/fiber` + `@react-three/drei` para el emblema interactivo (`LIATER_logo_3D.glb`).
- **Backend as a Service:** `Supabase Cloud` (PostgreSQL 15+, Supabase Auth JWT, Row Level Security, Edge Functions en Deno).
- **Iconografía:** `lucide-react`.
- **Estilos:** CSS nativo (`App.css`, `index.css`, variables de color, glassmorphism, sin dependencias utilitarias pesadas como Tailwind ni Bootstrap).

---

## 3. 🗄️ Arquitectura de Base de Datos y Supabase

### 3.1 Tablas Principales
- `users_profile`: Vinculada 1:1 con `auth.users(id)`. Campos: `id`, `full_name`, `email`, `role`, `is_active`.
- `teacher_profiles`: Perfil profesional de docentes (`id`, `user_id`, `name`, `bio`, `area`, `photo_url`, `linkedin_url`).
- `diploma_programs`: Programas formativos (`id`, `title`, `program_type`, `drive_folder_id`, `meet_url`, `is_published`).
- `modules`: Módulos de diplomados (`id`, `program_id`, `title`, `order_index`).
- `subtopics` / `sessions`: Sesiones intermedias (`id`, `module_id`, `program_id`, `title`, `order_index`).
- `class_sessions`: Clases físicas (`id`, `subtopic_id`, `program_id`, `teacher_id`, `title`, `class_date`, `video_url`, `presentation_url`, `order_index`).
- `resources`: Materiales de estudio (`id`, `class_id`, `program_id`, `title`, `resource_type`, `url`, `is_visible`, `is_downloadable`).
- `enrollments`: Matrículas de alumnos (`id`, `student_id`, `program_id`, `status`).
- `announcements`: Comunicados del curso (`id`, `program_id`, `teacher_id`, `title`, `message`, `target_role`).
- `class_activities`: Quices de clase formativos (`id`, `class_id`, `title`, `questions`, `due_date`, `is_published`).
- `activity_submissions`: Respuestas de los estudiantes (`id`, `activity_id`, `student_id`, `answers`, `score`).
- `class_doubts`: Dudas de alumnos con minutero del video (`id`, `class_id`, `user_id`, `question`, `timestamp_seconds`, `answer`).

### 3.2 Regla Vital de Base de Datos para Consultas
- En `class_sessions`, la llave foránea histórica hacia la sesión es `subtopic_id`. Al consultar sesiones o módulos desde `class_sessions`, **evita joins anidados rígidos** como `sessions(modules(...))` que puedan fallar si la relación en PostgREST difiere entre entornos.
- **Estrategia robusta implementada:** Consulta `class_sessions.select('*')`, consulta los módulos y subtemas del programa, y resuelve el mapeo en memoria mediante diccionarios (`sessionsMap`, `classMap`).

---

## 4. 🧭 Flujo de Navegación y Contexto de Curso

1. **Rutas Globales:**
   - `/portal`: Catálogo de cursos disponibles para el usuario.
   - `/users`: Consola global de administración de usuarios y matrículas (exclusiva para administradores).
2. **Rutas de Curso (`:programId`):**
   - Al seleccionar un programa en `/portal`, se guardan `activeProgramId` y `activeProgramType` en `localStorage` y se dispara el evento `programContextChanged`.
   - `/dashboard/:programId`: Resumen para estudiantes.
   - `/resources/:programId`: Centro de recursos con filtro por sesión y control de descargabilidad.
   - `/modules/:programId` o `/syllabus/:programId`: Temario del curso.
   - `/dashboard/admin/:programId`: Panel de control del curso para administradores.
   - `/dashboard/profesor/:programId`: Panel del docente para gestionar sus clases.
3. **Rutas de Aula Virtual:**
   - `/class/:classId`: Visualizador de clase con reproductor, diapositivas Drive, actividades de refuerzo y dudas.

---

## 5. ⚡ Integraciones de Terceros

1. **Google Drive API v3:**
   - Subida a través de la Edge Function `upload-pdf-drive` con OAuth 2.0 Refresh Token.
   - Nomenclatura obligatoria: `[Clase XX - Titulo] Archivo.pdf`.
   - Permiso público de lectura asignado para embebido en `<iframe>` (`/preview`) sin consumo de egreso en Supabase.
2. **YouTube & Google Apps Script:**
   - Sincronización periódica de videos de clases desde YouTube hacia `class_sessions.video_url`.
3. **Google Gemini AI:**
   - Generación de evaluaciones formativas automáticas basadas en transcripciones de clase (`generar-preguntas-reforzamiento`).

---

## 6. 🚨 Reglas Operativas Estrictas para Agentes de IA

1. **Flujo de Git (CRÍTICO):**
   - **Repositorio de desarrollo:** `juanbeltran` (`https://github.com/JuanBeltran2024/LIATER.git`).
   - **Rama de desarrollo:** `main`.
   - **Siempre** ejecutar `git pull juanbeltran main` antes de cualquier `git push juanbeltran main`.
   - **NUNCA** hacer push al repositorio `origin` (`Corenius2026/LIATER`) salvo que el usuario lo solicite expresamente como despliegue de producción.
2. **Verificación de Compilación:**
   - Tras cualquier cambio en código fuente, ejecutar siempre `npm run build` para garantizar cero errores de transpilación o sintaxis.
3. **Consistencia Visual:**
   - Preservar la estética institucional: Navy `#14213D`, Gold `#FCA311`, fondos limpios `#F8FAFC`.
   - No usar emojis en la interfaz ni textos crudos de marca como "Google Drive" frente al usuario final; usar términos pedagógicos (*"Centro de Recursos"*, *"Abrir Material"*, etc.).
4. **Preservación de Permisos y Descargabilidad:**
   - Respetar la bandera `is_downloadable` de la tabla `resources`. Si es `false`, los estudiantes no deben tener acceso a botones de descarga directa.
5. **No Almacenar Binarios en Base de Datos:**
   - Archivos pesados van a Google Drive; en Supabase sólo se guardan los enlaces (`url`) y metadatos.
