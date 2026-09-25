-- ====================================================================
-- SCRIPT SQL: Datos de Prueba (Seed) - Plataforma del Diplomado
-- 
-- Descripción:
-- Este script inserta datos simulados realistas para probar la interfaz.
-- Utiliza UUIDs estáticos para mantener la coherencia de las relaciones.
-- (Corregido con sintaxis Hexadecimal válida para UUIDs: 0-9 y a-f)
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. Insertar Perfiles de Usuarios (users_profile)
-- 3 Profesores
-- --------------------------------------------------------------------
INSERT INTO users_profile (id, full_name, email, role) VALUES
('a1111111-1111-1111-1111-111111111111', 'Dr. Carlos Mendoza', 'carlos.mendoza@ejemplo.com', 'teacher'),
('a2222222-2222-2222-2222-222222222222', 'Ing. Laura Valdés', 'laura.valdes@ejemplo.com', 'teacher'),
('a3333333-3333-3333-3333-333333333333', 'Mg. Roberto Salinas', 'roberto.salinas@ejemplo.com', 'teacher')
ON CONFLICT (email) DO NOTHING;

-- --------------------------------------------------------------------
-- 2. Insertar Perfiles de Profesores (teacher_profiles)
-- --------------------------------------------------------------------
INSERT INTO teacher_profiles (id, user_id, name, bio, area, photo_url, linkedin_url) VALUES
('b1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'Dr. Carlos Mendoza', 'Especialista con 15 años de experiencia en innovación y tecnología educativa.', 'Innovación Tecnológica', 'https://i.pravatar.cc/150?u=carlos', 'https://linkedin.com/in/carlosm'),
('b2222222-2222-2222-2222-222222222222', 'a2222222-2222-2222-2222-222222222222', 'Ing. Laura Valdés', 'Ingeniera de software apasionada por la enseñanza y el desarrollo de arquitecturas web modernas.', 'Desarrollo Web', 'https://i.pravatar.cc/150?u=laura', 'https://linkedin.com/in/laurav'),
('b3333333-3333-3333-3333-333333333333', 'a3333333-3333-3333-3333-333333333333', 'Mg. Roberto Salinas', 'Magíster en ciencia de datos aplicado a los negocios con múltiples publicaciones científicas.', 'Ciencia de Datos', 'https://i.pravatar.cc/150?u=roberto', 'https://linkedin.com/in/robertos')
ON CONFLICT (id) DO NOTHING;

-- --------------------------------------------------------------------
-- 3. Insertar Programas de Diplomado (diploma_programs)
-- 1 Diplomado
-- --------------------------------------------------------------------
INSERT INTO diploma_programs (id, title, description, start_date, end_date) VALUES
('d1111111-1111-1111-1111-111111111111', 'Diplomado Internacional en Tecnologías de la Información', 'Programa integral enfocado en las tecnologías modernas más demandadas por el mercado actual, abarcando desarrollo, datos y metodologías ágiles.', '2026-08-01', '2026-12-15')
ON CONFLICT (id) DO NOTHING;

-- --------------------------------------------------------------------
-- 4. Insertar Módulos (modules)
-- 3 Módulos
-- --------------------------------------------------------------------
INSERT INTO modules (id, diploma_id, title, description, order_index) VALUES
('e1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', 'Módulo 1: Fundamentos de Arquitectura Web', 'Introducción a los conceptos básicos, diseño de sistemas y patrones de arquitectura de software web.', 1),
('e2222222-2222-2222-2222-222222222222', 'd1111111-1111-1111-1111-111111111111', 'Módulo 2: Ciencia de Datos y Machine Learning', 'Análisis de datos moderno y modelos predictivos básicos aplicados a problemas reales.', 2),
('e3333333-3333-3333-3333-333333333333', 'd1111111-1111-1111-1111-111111111111', 'Módulo 3: Gestión de Proyectos TI y Metodologías', 'Liderazgo, metodologías ágiles y gestión de equipos de alto rendimiento tecnológico.', 3)
ON CONFLICT (id) DO NOTHING;

-- --------------------------------------------------------------------
-- 5. Insertar Subtemas (subtopics)
-- 2 Subtemas por Módulo (6 en total)
-- --------------------------------------------------------------------
INSERT INTO subtopics (id, module_id, title, description, order_index) VALUES
-- Módulo 1
('f1111111-1111-1111-1111-111111111111', 'e1111111-1111-1111-1111-111111111111', '1.1 Introducción a Frontend y Backend', 'Comprender la separación de responsabilidades y la comunicación cliente-servidor.', 1),
('f2222222-2222-2222-2222-222222222222', 'e1111111-1111-1111-1111-111111111111', '1.2 Bases de Datos Relacionales vs NoSQL', 'Criterios de elección y diseño de esquemas para bases de datos.', 2),
-- Módulo 2
('f3333333-3333-3333-3333-333333333333', 'e2222222-2222-2222-2222-222222222222', '2.1 Limpieza y Análisis de Datos (EDA)', 'Técnicas fundamentales para el tratamiento y visualización de grandes conjuntos de datos.', 1),
('f4444444-4444-4444-4444-444444444444', 'e2222222-2222-2222-2222-222222222222', '2.2 Modelos Predictivos (Clasificación)', 'Aplicación práctica de algoritmos de machine learning supervisado.', 2),
-- Módulo 3
('f5555555-5555-5555-5555-555555555555', 'e3333333-3333-3333-3333-333333333333', '3.1 Scrum y Kanban en la Práctica', 'Gestión del flujo de trabajo, ceremonias y roles dentro de equipos ágiles.', 1),
('f6666666-6666-6666-6666-666666666666', 'e3333333-3333-3333-3333-333333333333', '3.2 Métricas y OKRs', 'Medición del éxito y alineación de los equipos con los objetivos de negocio.', 2)
ON CONFLICT (id) DO NOTHING;

-- --------------------------------------------------------------------
-- 6. Insertar Sesiones de Clase (class_sessions)
-- 2 Clases por Subtema (12 en total)
-- --------------------------------------------------------------------
INSERT INTO class_sessions (id, subtopic_id, teacher_id, title, description, class_date, duration, video_url, presentation_url, order_index) VALUES
-- Subtema 1.1 (Laura -> b2)
('c1111111-1111-1111-1111-111111111111', 'f1111111-1111-1111-1111-111111111111', 'b2222222-2222-2222-2222-222222222222', 'Clase 1: Evolución del Frontend', 'Historia y evolución de las aplicaciones web SPA.', '2026-08-05 18:00:00Z', 120, 'https://youtube.com/watch?v=demo1', 'https://ejemplo.com/pres1.pdf', 1),
('c2222222-2222-2222-2222-222222222222', 'f1111111-1111-1111-1111-111111111111', 'b2222222-2222-2222-2222-222222222222', 'Clase 2: Arquitectura RESTful API', 'Diseño de APIs, verbos HTTP y códigos de estado.', '2026-08-07 18:00:00Z', 120, 'https://youtube.com/watch?v=demo2', 'https://ejemplo.com/pres2.pdf', 2),

-- Subtema 1.2 (Laura -> b2)
('c3333333-3333-3333-3333-333333333333', 'f2222222-2222-2222-2222-222222222222', 'b2222222-2222-2222-2222-222222222222', 'Clase 3: Modelado Relacional', 'Normalización, diagramas ER y SQL Avanzado.', '2026-08-12 18:00:00Z', 120, 'https://youtube.com/watch?v=demo3', 'https://ejemplo.com/pres3.pdf', 1),
('c4444444-4444-4444-4444-444444444444', 'f2222222-2222-2222-2222-222222222222', 'b2222222-2222-2222-2222-222222222222', 'Clase 4: Ecosistema NoSQL', 'Documentos, Grafos, Llave-Valor y Casos de uso.', '2026-08-14 18:00:00Z', 120, NULL, NULL, 2),

-- Subtema 2.1 (Roberto -> b3)
('c5555555-5555-5555-5555-555555555555', 'f3333333-3333-3333-3333-333333333333', 'b3333333-3333-3333-3333-333333333333', 'Clase 5: Pandas y Manipulación de Datos', 'Uso de librerías en Python para limpieza y preprocesamiento.', '2026-08-19 18:00:00Z', 150, 'https://youtube.com/watch?v=demo5', 'https://ejemplo.com/pres5.pdf', 1),
('c6666666-6666-6666-6666-666666666666', 'f3333333-3333-3333-3333-333333333333', 'b3333333-3333-3333-3333-333333333333', 'Clase 6: Data Storytelling', 'Cómo comunicar hallazgos a través de visualizaciones efectivas.', '2026-08-21 18:00:00Z', 120, 'https://youtube.com/watch?v=demo6', 'https://ejemplo.com/pres6.pdf', 2),

-- Subtema 2.2 (Roberto -> b3)
('c7777777-7777-7777-7777-777777777777', 'f4444444-4444-4444-4444-444444444444', 'b3333333-3333-3333-3333-333333333333', 'Clase 7: Árboles de Decisión y Random Forest', 'Algoritmos fundamentales para clasificación.', '2026-08-26 18:00:00Z', 120, 'https://youtube.com/watch?v=demo7', 'https://ejemplo.com/pres7.pdf', 1),
('c8888888-8888-8888-8888-888888888888', 'f4444444-4444-4444-4444-444444444444', 'b3333333-3333-3333-3333-333333333333', 'Clase 8: Redes Neuronales Básicas', 'Conceptos iniciales y casos prácticos con TensorFlow.', '2026-08-28 18:00:00Z', 150, NULL, NULL, 2),

-- Subtema 3.1 (Carlos -> b1)
('c9999999-9999-9999-9999-999999999999', 'f5555555-5555-5555-5555-555555555555', 'b1111111-1111-1111-1111-111111111111', 'Clase 9: Framework Scrum', 'Artefactos, eventos y responsabilidades del framework Scrum.', '2026-09-02 18:00:00Z', 120, 'https://youtube.com/watch?v=demo9', 'https://ejemplo.com/pres9.pdf', 1),
('caaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'f5555555-5555-5555-5555-555555555555', 'b1111111-1111-1111-1111-111111111111', 'Clase 10: Taller Práctico Kanban', 'Uso de tableros, límites WIP y medición del Lead Time.', '2026-09-04 18:00:00Z', 120, 'https://youtube.com/watch?v=demo10', 'https://ejemplo.com/pres10.pdf', 2),

-- Subtema 3.2 (Carlos -> b1)
('cbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'f6666666-6666-6666-6666-666666666666', 'b1111111-1111-1111-1111-111111111111', 'Clase 11: Definición de OKRs', 'Cómo redactar Objetivos y Resultados Clave impactantes.', '2026-09-09 18:00:00Z', 120, 'https://youtube.com/watch?v=demo11', 'https://ejemplo.com/pres11.pdf', 1),
('cccccccc-cccc-cccc-cccc-cccccccccccc', 'f6666666-6666-6666-6666-666666666666', 'b1111111-1111-1111-1111-111111111111', 'Clase 12: Métricas de Desempeño', 'Velocity, Burndown charts y métricas de calidad de software.', '2026-09-11 18:00:00Z', 120, 'https://youtube.com/watch?v=demo12', 'https://ejemplo.com/pres12.pdf', 2)
ON CONFLICT (id) DO NOTHING;

-- --------------------------------------------------------------------
-- 7. Insertar Recursos Complementarios (resources)
-- Algunos recursos extra asociados a las clases
-- --------------------------------------------------------------------
INSERT INTO resources (id, class_id, title, resource_type, url) VALUES
('e1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'Guía de Arquitecturas Modernas', 'pdf', 'https://ejemplo.com/guia1.pdf'),
('e2222222-2222-2222-2222-222222222222', 'c1111111-1111-1111-1111-111111111111', 'Repositorio de Código Frontend', 'link', 'https://github.com/ejemplo/repo1'),
('e3333333-3333-3333-3333-333333333333', 'c3333333-3333-3333-3333-333333333333', 'Plantilla Diagrama ER', 'file', 'https://ejemplo.com/plantilla_er.zip'),
('e4444444-4444-4444-4444-444444444444', 'c5555555-5555-5555-5555-555555555555', 'Dataset Práctico Limpieza de Datos', 'file', 'https://ejemplo.com/dataset1.csv'),
('e5555555-5555-5555-5555-555555555555', 'c5555555-5555-5555-5555-555555555555', 'Notebook de Jupyter Resuelto', 'file', 'https://ejemplo.com/notebook1.ipynb'),
('e6666666-6666-6666-6666-666666666666', 'c9999999-9999-9999-9999-999999999999', 'Manifiesto Ágil', 'link', 'https://agilemanifesto.org/'),
('e7777777-7777-7777-7777-777777777777', 'cbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Ejemplos de OKRs de Google', 'pdf', 'https://ejemplo.com/okr_google.pdf')
ON CONFLICT (id) DO NOTHING;
