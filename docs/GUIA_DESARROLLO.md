# 💻 Guía de Desarrollo y Convenciones de Código — LIATER
### Universidad Nacional de Colombia & Corenius

Esta guía está diseñada para desarrolladores, colaboradores y asistentes de IA que contribuyan activamente al código fuente del LMS **LIATER**.

---

## 1. 🚀 Configuración del Entorno Local

### Prerrequisitos
- **Node.js:** Versión 18.x o superior (recomendado Node 20 LTS).
- **npm:** Versión 9.x o superior.
- **Git:** Configurado con acceso a los repositorios de GitHub.

### Paso a Paso
1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/JuanBeltran2024/LIATER.git
   cd LIATER
   ```
2. **Instalar dependencias:**
   ```bash
   npm install
   ```
3. **Crear archivo de variables de entorno `.env`:**
   ```env
   VITE_SUPABASE_URL=https://dbxkmasucybamylpkndm.supabase.co
   VITE_SUPABASE_ANON_KEY=tu-anon-key-de-supabase
   ```
4. **Iniciar el servidor de desarrollo:**
   ```bash
   npm run dev
   ```
   El entorno quedará accesible en `http://localhost:5173`.

5. **Verificar compilación para producción:**
   ```bash
   npm run build
   ```
   Siempre ejecuta este comando antes de realizar commits para asegurar que no existan errores de sintaxis ni fallos en los paquetes.

---

## 2. 🌿 Políticas de Git y Despliegue

El proyecto se gestiona bajo una política estricta de dos remotos:

### Remoto 1: Desarrollo Activo (`juanbeltran`)
- **URL:** `https://github.com/JuanBeltran2024/LIATER.git`
- **Rama:** `main`
- **Regla de Oro:** **Todos los commits de desarrollo, pruebas y nuevas características deben subirse a este repositorio.**
- **Comandos obligatorios antes de subir:**
  ```bash
  git pull juanbeltran main
  git push juanbeltran main
  ```

### Remoto 2: Producción Oficial (`origin` / Corenius)
- **URL:** `https://github.com/Corenius2026/LIATER.git`
- **Rama:** `main`
- **Regla de Oro:** **NUNCA hacer push a `origin` durante la fase de desarrollo.** Solo se realiza push a este repositorio cuando el usuario o líder del proyecto solicite explícitamente un despliegue a la versión publicada en producción.

---

## 3. 🎨 Convenciones de Diseño y UI

1. **Variables CSS Oficiales:**
   El proyecto utiliza variables CSS nativas definidas en `src/index.css` y `src/App.css`. No se utilizan frameworks utilitarios pesados como Tailwind ni librerías de componentes prefabricadas (Bootstrap, MUI).
   - `--navy: #14213D`: Azul noche institucional para encabezados, barras y botones principales.
   - `--gold: #FCA311`: Acento dorado para estados activos, bordes y botones secundarios destacados.
   - `--gold-dark: #b45309`: Texto dorado oscuro sobre fondos claros para garantizar accesibilidad WCAG.
   - `--bg-primary: #F8FAFC`: Fondo general de la plataforma.
   - `--border-color: #E2E8F0`: Bordes sutiles para tarjetas y separadores.

2. **Estilo Glassmorphism y Micro-animaciones:**
   - Tarjetas con bordes redondeados (`border-radius: 12px` o `16px`).
   - Sombras suaves: `box-shadow: 0 1px 3px rgba(20, 33, 61, 0.05)`.
   - Transiciones suaves: `transition: all 0.15s ease`.

3. **Sin Emojis en Interfaces Oficiales:**
   - La plataforma mantiene una estética académica y corporativa limpia. Se utiliza la librería de iconos vectoriales `lucide-react` para toda la iconografía visual.

---

## 4. 🧭 Manejo del Contexto de Curso

La barra lateral (`Sidebar.jsx`) y el enrutador (`App.jsx`) se sincronizan mediante `localStorage` y eventos personalizados del navegador:

```javascript
// Al entrar a un programa académico en Portal.jsx:
localStorage.setItem('activeProgramId', programId);
localStorage.setItem('activeProgramType', programType); // 'diplomado' | 'curso'
window.dispatchEvent(new Event('programContextChanged'));
```

- **Adaptación automática:** Si `activeProgramType === 'curso'`, la barra lateral oculta automáticamente la pestaña "Módulos" y navega directamente a "Sesiones".

---

## 5. 🗄️ Consultas Seguras a Supabase

1. **Filtrado por Contexto:**
   Toda consulta dentro del contexto de un programa debe filtrar estrictamente por el ID del programa:
   ```javascript
   const { data } = await supabase
     .from('class_sessions')
     .select('*')
     .eq('program_id', cleanProgramId)
     .order('order_index', { ascending: true });
   ```

2. **Mapeo Relacional Robusto:**
   Para evitar fallos por nombres de llaves foráneas en PostgREST (`sessions` vs. `subtopics`), se recomienda consultar las entidades y construir el mapa relacional en memoria (`Map` o diccionarios JavaScript).

3. **Cliente Secundario para Crear Usuarios:**
   Para invitar o registrar usuarios desde el panel de administración sin cerrar la sesión activa del administrador, utiliza una instancia de Supabase con `persistSession: false` (`supabaseCreator`).
