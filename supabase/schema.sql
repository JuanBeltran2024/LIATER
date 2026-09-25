-- ====================================================================
-- ESQUEMA OFICIAL DE BASE DE DATOS - PLATAFORMA LIATER UNAL (Supabase PostgreSQL)
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Usuarios (users_profile)
CREATE TABLE IF NOT EXISTS public.users_profile (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  full_name character varying NOT NULL,
  email character varying NOT NULL UNIQUE,
  role character varying NOT NULL CHECK (role::text = ANY (ARRAY['student'::character varying, 'teacher'::character varying, 'admin'::character varying]::text[])),
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  is_active boolean DEFAULT true,
  auth_user_id uuid UNIQUE,
  profession text,
  institution text,
  bio text,
  phone text,
  country text,
  CONSTRAINT users_profile_pkey PRIMARY KEY (id),
  CONSTRAINT users_profile_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id)
);

-- 2. Perfiles de Profesores (teacher_profiles)
CREATE TABLE IF NOT EXISTS public.teacher_profiles (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  name character varying NOT NULL,
  bio text,
  area character varying,
  photo_url text,
  linkedin_url text,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT teacher_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT teacher_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users_profile(id)
);

-- 3. Programas Académicos (diploma_programs)
CREATE TABLE IF NOT EXISTS public.diploma_programs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  title character varying NOT NULL,
  description text,
  start_date date,
  end_date date,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  program_type text DEFAULT 'diplomado'::text,
  image_url text,
  is_published boolean DEFAULT true,
  status character varying DEFAULT 'published'::character varying CHECK (status::text = ANY (ARRAY['draft'::character varying, 'published'::character varying, 'upcoming'::character varying, 'completed'::character varying]::text[])),
  enrollment_start_date timestamp with time zone,
  enrollment_end_date timestamp with time zone,
  meet_url text,
  whatsapp_group_id text,
  CONSTRAINT diploma_programs_pkey PRIMARY KEY (id)
);

-- 4. Módulos (modules)
CREATE TABLE IF NOT EXISTS public.modules (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  program_id uuid NOT NULL,
  title character varying NOT NULL,
  description text,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT modules_pkey PRIMARY KEY (id),
  CONSTRAINT modules_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.diploma_programs(id)
);

-- 5. Subtemas (subtopics)
CREATE TABLE IF NOT EXISTS public.subtopics (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  module_id uuid NOT NULL,
  program_id uuid,
  title character varying NOT NULL,
  description text,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT subtopics_pkey PRIMARY KEY (id),
  CONSTRAINT subtopics_module_id_fkey FOREIGN KEY (module_id) REFERENCES public.modules(id),
  CONSTRAINT subtopics_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.diploma_programs(id)
);

-- 6. Clases / Sesiones (class_sessions)
CREATE TABLE IF NOT EXISTS public.class_sessions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  subtopic_id uuid NOT NULL,
  program_id uuid,
  teacher_id uuid,
  title character varying NOT NULL,
  description text,
  class_date timestamp with time zone,
  duration integer,
  video_url text,
  presentation_url text,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  drive_folder_id text,
  drive_sync_enabled boolean NOT NULL DEFAULT false,
  meet_url text,
  CONSTRAINT class_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT class_sessions_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.diploma_programs(id),
  CONSTRAINT class_sessions_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.teacher_profiles(id),
  CONSTRAINT class_sessions_subtopic_id_fkey FOREIGN KEY (subtopic_id) REFERENCES public.subtopics(id)
);

-- 7. Recursos (resources)
CREATE TABLE IF NOT EXISTS public.resources (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  class_id uuid,
  program_id uuid,
  title character varying NOT NULL,
  resource_type character varying NOT NULL CHECK (resource_type::text = ANY (ARRAY['presentation'::character varying, 'pdf'::character varying, 'link'::character varying, 'video'::character varying, 'file'::character varying]::text[])),
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  url text,
  provider text DEFAULT 'external'::text CHECK (provider = ANY (ARRAY['drive'::text, 'youtube'::text, 'supabase'::text, 'external'::text])),
  file_path text,
  is_visible boolean DEFAULT true,
  allow_download boolean NOT NULL DEFAULT false,
  CONSTRAINT resources_pkey PRIMARY KEY (id),
  CONSTRAINT resources_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.class_sessions(id),
  CONSTRAINT resources_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.diploma_programs(id)
);

-- 8. Anuncios (announcements)
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  program_id uuid,
  teacher_id uuid,
  title character varying NOT NULL,
  body text NOT NULL,
  tag character varying DEFAULT 'general'::character varying CHECK (tag::text = ANY (ARRAY['general'::character varying, 'urgent'::character varying, 'info'::character varying]::text[])),
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT announcements_pkey PRIMARY KEY (id),
  CONSTRAINT announcements_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.teacher_profiles(id),
  CONSTRAINT announcements_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.diploma_programs(id)
);

-- 9. Inscripciones (enrollments)
CREATE TABLE IF NOT EXISTS public.enrollments (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  student_id uuid NOT NULL,
  program_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT enrollments_pkey PRIMARY KEY (id),
  CONSTRAINT enrollments_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.diploma_programs(id),
  CONSTRAINT enrollments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users_profile(id)
);

-- 10. Tareas (assignments)
CREATE TABLE IF NOT EXISTS public.assignments (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  program_id uuid NOT NULL,
  title character varying NOT NULL,
  description text,
  due_date timestamp with time zone NOT NULL,
  is_published boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT assignments_pkey PRIMARY KEY (id),
  CONSTRAINT assignments_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.diploma_programs(id)
);

-- 11. Entregas de Tareas (assignment_submissions)
CREATE TABLE IF NOT EXISTS public.assignment_submissions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  assignment_id uuid NOT NULL,
  student_id uuid NOT NULL,
  file_url text,
  comments text,
  submitted_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  status character varying DEFAULT 'submitted'::character varying CHECK (status::text = ANY (ARRAY['submitted'::character varying, 'graded'::character varying, 'returned'::character varying]::text[])),
  CONSTRAINT assignment_submissions_pkey PRIMARY KEY (id),
  CONSTRAINT assignment_submissions_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.assignments(id),
  CONSTRAINT assignment_submissions_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users_profile(id)
);

-- 12. Quizzes / Cuestionarios (quizzes)
CREATE TABLE IF NOT EXISTS public.quizzes (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  program_id uuid NOT NULL,
  title character varying NOT NULL,
  description text,
  due_date timestamp with time zone NOT NULL,
  is_published boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT quizzes_pkey PRIMARY KEY (id),
  CONSTRAINT quizzes_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.diploma_programs(id)
);

-- 13. Entregas de Quizzes (quiz_submissions)
CREATE TABLE IF NOT EXISTS public.quiz_submissions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  quiz_id uuid NOT NULL,
  student_id uuid NOT NULL,
  score numeric,
  completed_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT quiz_submissions_pkey PRIMARY KEY (id),
  CONSTRAINT quiz_submissions_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id),
  CONSTRAINT quiz_submissions_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users_profile(id)
);

-- 14. Dudas de Clase (class_doubts)
CREATE TABLE IF NOT EXISTS public.class_doubts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  class_id uuid NOT NULL,
  module_id uuid,
  program_id uuid,
  student_id uuid NOT NULL,
  teacher_id uuid,
  subject character varying NOT NULL,
  description text NOT NULL,
  topic character varying,
  status character varying DEFAULT 'enviada'::character varying CHECK (status::text = ANY (ARRAY['enviada'::character varying, 'revisada'::character varying, 'atendida'::character varying, 'archivada'::character varying]::text[])),
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT class_doubts_pkey PRIMARY KEY (id),
  CONSTRAINT class_doubts_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.class_sessions(id),
  CONSTRAINT class_doubts_module_id_fkey FOREIGN KEY (module_id) REFERENCES public.modules(id),
  CONSTRAINT class_doubts_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.diploma_programs(id),
  CONSTRAINT class_doubts_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users_profile(id),
  CONSTRAINT class_doubts_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.teacher_profiles(id)
);

-- 15. Actividades de Clase (class_activities)
CREATE TABLE IF NOT EXISTS public.class_activities (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  class_id uuid NOT NULL UNIQUE,
  title character varying NOT NULL,
  description text,
  available_from timestamp with time zone,
  due_date timestamp with time zone,
  is_published boolean DEFAULT false,
  is_mandatory boolean DEFAULT false,
  max_attempts integer DEFAULT 1,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT class_activities_pkey PRIMARY KEY (id),
  CONSTRAINT class_activities_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.class_sessions(id)
);

-- 16. Preguntas de Actividades (activity_questions)
CREATE TABLE IF NOT EXISTS public.activity_questions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  activity_id uuid NOT NULL,
  text text NOT NULL,
  question_type character varying NOT NULL CHECK (question_type::text = ANY (ARRAY['single_choice'::character varying, 'true_false'::character varying]::text[])),
  order_num integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT activity_questions_pkey PRIMARY KEY (id),
  CONSTRAINT activity_questions_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES public.class_activities(id)
);

-- 17. Opciones de Pregunta (question_options)
CREATE TABLE IF NOT EXISTS public.question_options (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  question_id uuid NOT NULL,
  text text NOT NULL,
  order_num integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT question_options_pkey PRIMARY KEY (id),
  CONSTRAINT question_options_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.activity_questions(id)
);

-- 18. Respuestas Correctas de Pregunta (question_correct_answers)
CREATE TABLE IF NOT EXISTS public.question_correct_answers (
  question_id uuid NOT NULL,
  correct_option_id uuid NOT NULL,
  CONSTRAINT question_correct_answers_pkey PRIMARY KEY (question_id),
  CONSTRAINT question_correct_answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.activity_questions(id),
  CONSTRAINT question_correct_answers_correct_option_id_fkey FOREIGN KEY (correct_option_id) REFERENCES public.question_options(id)
);

-- 19. Intentos de Actividad (activity_attempts)
CREATE TABLE IF NOT EXISTS public.activity_attempts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  activity_id uuid NOT NULL,
  student_id uuid NOT NULL,
  completed_at timestamp with time zone,
  score numeric,
  started_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  status character varying DEFAULT 'in_progress'::character varying CHECK (status::text = ANY (ARRAY['in_progress'::character varying, 'completed'::character varying]::text[])),
  attempt_number integer NOT NULL DEFAULT 1,
  CONSTRAINT activity_attempts_pkey PRIMARY KEY (id),
  CONSTRAINT activity_attempts_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users_profile(id),
  CONSTRAINT activity_attempts_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES public.class_activities(id)
);

-- 20. Respuestas de Intento (attempt_answers)
CREATE TABLE IF NOT EXISTS public.attempt_answers (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  attempt_id uuid NOT NULL,
  question_id uuid NOT NULL,
  selected_option_id uuid NOT NULL,
  is_correct boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT attempt_answers_pkey PRIMARY KEY (id),
  CONSTRAINT attempt_answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.activity_questions(id),
  CONSTRAINT attempt_answers_selected_option_id_fkey FOREIGN KEY (selected_option_id) REFERENCES public.question_options(id),
  CONSTRAINT attempt_answers_attempt_id_fkey FOREIGN KEY (attempt_id) REFERENCES public.activity_attempts(id)
);

-- 21. Trabajos de Generación de Actividades por IA (activity_generation_jobs)
CREATE TABLE IF NOT EXISTS public.activity_generation_jobs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  class_id uuid NOT NULL,
  activity_id uuid,
  requested_by uuid,
  source_video_url text,
  ai_provider text,
  ai_model text,
  error_message text,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'processing'::text, 'review_ready'::text, 'completed'::text, 'failed'::text])),
  progress integer NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT activity_generation_jobs_pkey PRIMARY KEY (id),
  CONSTRAINT activity_generation_jobs_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.class_sessions(id),
  CONSTRAINT activity_generation_jobs_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES public.class_activities(id),
  CONSTRAINT activity_generation_jobs_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users_profile(id)
);

-- 22. Trabajos de Transcripción de Google Drive (drive_transcript_jobs)
CREATE TABLE IF NOT EXISTS public.drive_transcript_jobs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  class_id uuid NOT NULL,
  drive_file_id text NOT NULL,
  drive_file_name text NOT NULL,
  drive_modified_at timestamp with time zone,
  activity_id uuid,
  error_message text,
  processing_started_at timestamp with time zone,
  processed_at timestamp with time zone,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'processing'::text, 'review_ready'::text, 'completed'::text, 'failed'::text])),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  detected_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT drive_transcript_jobs_pkey PRIMARY KEY (id),
  CONSTRAINT drive_transcript_jobs_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.class_sessions(id),
  CONSTRAINT drive_transcript_jobs_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES public.class_activities(id)
);

-- 23. Borradores de Actividades (activity_drafts)
CREATE TABLE IF NOT EXISTS public.activity_drafts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  class_id uuid NOT NULL,
  drive_folder_id text,
  draft_data jsonb NOT NULL,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT activity_drafts_pkey PRIMARY KEY (id),
  CONSTRAINT activity_drafts_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.class_sessions(id),
  CONSTRAINT activity_drafts_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users_profile(id)
);
