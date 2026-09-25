import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  HelpCircle, MessageSquare, ChevronDown, Mail, Search,
  Building2, Clock, CheckCircle2, Shield, Phone, Sparkles
} from 'lucide-react';
import { supportConfig } from '@/config/supportConfig';
import { useAuth } from '@/context/AuthContext';

export default function Support() {
  const [openIndex, setOpenIndex] = useState(null);
  const [faqSearch, setFaqSearch] = useState('');
  const { currentUser } = useAuth();
  const role = currentUser?.role;

  const toggleFaq = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  const teacherFaqs = [
    {
      category: '🎥 Grabaciones',
      question: '¿Cómo enlazo una clase grabada de YouTube a mi sesión?',
      answer: 'Dirígete a la pestaña "Agenda", selecciona una clase pasada y haz clic en "Enlazar grabación". Pega el enlace de YouTube y define los minutos exactos de inicio y fin. La grabación estará disponible inmediatamente para tus estudiantes.'
    },
    {
      category: '📊 Analítica',
      question: '¿Cómo se calcula el Score Promedio de mis estudiantes?',
      answer: 'El promedio se calcula considerando los cuestionarios realizados y los vencidos no realizados. Si un estudiante realiza varios intentos en una misma actividad, el sistema siempre toma en cuenta su puntaje más alto para no penalizar la práctica.'
    },
    {
      category: '⚠️ Estudiantes',
      question: '¿Por qué algunos estudiantes aparecen "En riesgo" en la analítica?',
      answer: 'El estado "En riesgo" se activa automáticamente si un estudiante ha completado menos del 50% de las actividades publicadas hasta la fecha, o si su promedio de calificaciones actual es inferior al 60%.'
    },
    {
      category: '💬 Consultas',
      question: '¿Cómo respondo a las dudas enviadas durante mis clases?',
      answer: 'Todas las consultas académicas enviadas por los estudiantes desde el aula virtual se recopilan en tu pestaña "Bandeja de consultas". Desde allí puedes filtrar por programa y marcar las dudas como resueltas a medida que las atiendas.'
    },
    {
      category: '📝 Evaluación',
      question: '¿Cómo habilito un cuestionario de reforzamiento en una clase?',
      answer: 'En tu panel de "Clases y Actividades", busca la clase deseada y haz clic en "Nueva Actividad". Podrás redactar o cargar preguntas, establecer límites de tiempo e intentos, y marcar la actividad como obligatoria para el avance.'
    },
    {
      category: '🏛️ Asignación',
      question: '¿Qué hago si una clase asignada no aparece en mi panel?',
      answer: 'Verifica primero tener seleccionado el programa académico correcto en el selector de la parte superior (Mis Programas). Si el problema continúa, comunícate con la administración para revisar tu carga docente.'
    }
  ];

  const studentFaqs = [
    {
      category: '📝 Cuestionarios',
      question: '¿Qué son las actividades de reforzamiento?',
      answer: 'Son cuestionarios o ejercicios habilitados por tu profesor para comprobar tu entendimiento sobre el tema de una clase reciente. Suelen ser obligatorios para tu avance académico.'
    },
    {
      category: '⏳ Intentos',
      question: '¿Por qué tengo una actividad pendiente que ya hice?',
      answer: 'Si una actividad permite múltiples intentos, seguirá apareciendo en tu panel hasta que envíes todos los intentos disponibles o hasta que cierre su fecha límite. ¡Pero no te preocupes! El sistema guarda tu intento más alto.'
    },
    {
      category: '📊 Calificaciones',
      question: '¿Cómo sé cuál es mi calificación y en qué fallé?',
      answer: 'Puedes revisar tus puntajes en la sección "Mis Resultados". Si el profesor habilitó la revisión, también podrás ver el detalle de en qué preguntas acertaste o te equivocaste haciendo clic en el detalle.'
    },
    {
      category: '🔥 Hábitos',
      question: '¿Cómo funciona la racha de estudio?',
      answer: 'Mantén un avance continuo enviando al menos una actividad o entregable cada semana para aumentar tu racha. Si dejas pasar una semana sin entregar nada, la racha se reiniciará a cero.'
    },
    {
      category: '💬 Dudas',
      question: '¿Dónde puedo resolver dudas académicas de una clase?',
      answer: 'Dentro de la página donde ves la grabación o los detalles de cada clase, encontrarás un área de comentarios en la parte inferior. Si envías tu duda allí, le llegará directamente al profesor de esa sesión.'
    },
    {
      category: '🏛️ Inscripciones',
      question: 'No me aparece un programa o diplomado al que me inscribí',
      answer: 'En la parte superior, revisa el selector "Mis Programas". Si no lo ves allí, asegúrate de que estás ingresando con el correo con el que te registraste, y de lo contrario comunícate con soporte.'
    }
  ];

  const adminFaqs = [
    {
      category: '📘 Programas',
      question: '¿Cómo creo un nuevo programa o curso?',
      answer: 'Desde la sección de Panorama General, puedes utilizar el acceso rápido "Nuevo Programa" para abrir el formulario de creación y definir el título, descripción y tipo de programa.'
    },
    {
      category: '⚙️ Visibilidad',
      question: '¿Cómo activo o desactivo un programa?',
      answer: 'Puedes hacerlo desde el menú de opciones (tres puntos) en la tarjeta del programa en tu panel de Panorama General, y usar el interruptor "Estado de publicación" para cambiarlo a Publicado o Borrador.'
    },
    {
      category: '📢 Comunicaciones',
      question: '¿Cómo envío una comunicación masiva?',
      answer: 'Dirígete a la pestaña de "Comunicaciones" y selecciona "Redactar Nuevo Mensaje". Podrás elegir enviar un mensaje a todos los estudiantes de un programa específico o buscar usuarios particulares.'
    },
    {
      category: '👥 Cuentas',
      question: '¿Cómo gestiono las cuentas de estudiantes y profesores?',
      answer: 'En la sección de "Gestión de Usuarios" puedes buscar a cualquier usuario registrado, visualizar sus datos, y editar su rol o información básica utilizando las acciones disponibles en la tabla.'
    },
    {
      category: '🔴 En Vivo',
      question: '¿Cómo puedo monitorear las clases en vivo?',
      answer: 'En tu Panorama General, los programas que tengan una clase activa en este momento mostrarán un indicador rojo de "En vivo" junto con un botón para que puedas unirte a la sesión como observador.'
    },
    {
      category: '🛠️ Mesa de Ayuda',
      question: '¿Qué hago si necesito asistencia técnica avanzada?',
      answer: 'Para configuraciones del sistema, problemas de acceso, o dudas complejas de la plataforma, utiliza nuestros canales directos de "Envíanos un correo" o "Asistencia rápida" situados en la parte superior.'
    }
  ];

  const allFaqs = role === 'admin' ? adminFaqs : (role === 'teacher' ? teacherFaqs : studentFaqs);

  const filteredFaqs = allFaqs.filter(faq => {
    if (!faqSearch.trim()) return true;
    const query = faqSearch.toLowerCase();
    return faq.question.toLowerCase().includes(query) || 
           faq.answer.toLowerCase().includes(query) ||
           (faq.category && faq.category.toLowerCase().includes(query));
  });

  return (
    <div style={{ padding: '1.5rem 2rem', maxWidth: '1080px', margin: '0 auto', animation: 'fadeSlideUp 0.35s ease-out' }}>
      
      {/* ── HERO BANNER INSTITUCIONAL ── */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        padding: '1.75rem 2rem',
        border: '1px solid #E2E8F0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1.25rem',
        boxShadow: '0 1px 3px rgba(20, 33, 61, 0.03)',
        marginBottom: '2rem'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '6px', flexWrap: 'wrap' }}>
            <span style={{
              background: '#F1F5F9',
              color: 'var(--navy, #14213D)',
              fontSize: '0.74rem',
              fontWeight: 800,
              padding: '3px 10px',
              borderRadius: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.04em'
            }}>
              🏛️ CENTRO DE ASISTENCIA · PORTAL LIATER UNAL
            </span>
            <span style={{
              background: '#DCFCE7',
              color: '#007A2E',
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '10px'
            }}>
              ● Mesa de Ayuda Activa (L-V 8:00 - 17:00)
            </span>
          </div>

          <h1 style={{ color: 'var(--navy, #14213D)', fontSize: '1.65rem', fontWeight: 800, margin: 0, lineHeight: 1.25 }}>
            Soporte Técnico y Ayuda Académica
          </h1>
          <p style={{ color: 'var(--text-muted, #64748B)', fontSize: '0.9rem', margin: '6px 0 0 0', fontWeight: 400, maxWidth: '650px', lineHeight: 1.45 }}>
            {role === 'teacher' || role === 'admin' 
              ? 'Encuentra guías operativas para la gestión de tus diplomados o comunícate con el equipo técnico de LIATER.'
              : 'Encuentra respuestas a dudas frecuentes sobre el aula virtual o comunícate con la coordinación académica.'}
          </p>
        </div>

        <div style={{
          background: '#F8FAFC',
          padding: '0.75rem 1.15rem',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          gap: '0.85rem'
        }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'rgba(20,33,61,0.06)',
            color: 'var(--navy, #14213D)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <HelpCircle size={18} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748B)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Base de Conocimiento
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--navy, #14213D)' }}>
              {allFaqs.length} Guías Disponibles
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* ── CANALES DE ATENCIÓN DIRECTA (3 TARJETAS MODULARES) ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '1.25rem' }}>
          
          {/* TARJETA 1: CORREO INSTITUCIONAL */}
          <div 
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              padding: '1.75rem', 
              background: '#FFFFFF', 
              border: '1px solid #E2E8F0', 
              borderRadius: '16px',
              boxShadow: '0 1px 3px rgba(20, 33, 61, 0.03)',
              transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
              justifyContent: 'space-between'
            }}
            onMouseOver={e => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(20, 33, 61, 0.07)';
              e.currentTarget.style.borderColor = 'var(--gold, #FCA311)';
            }}
            onMouseOut={e => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(20, 33, 61, 0.03)';
              e.currentTarget.style.borderColor = '#E2E8F0';
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#EFF6FF', color: '#1D4ED8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Mail size={22} />
                </div>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted, #64748B)', background: '#F8FAFC', padding: '3px 8px', borderRadius: '6px' }}>
                  ⏱️ &lt; 24 hrs
                </span>
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 0.35rem 0', color: 'var(--navy, #14213D)' }}>
                Correo Institucional
              </h3>
              <p style={{ color: 'var(--text-muted, #64748B)', fontSize: '0.84rem', margin: '0 0 1.25rem 0', lineHeight: 1.45 }}>
                Reporta inconvenientes con cuentas de usuario, acceso a programas o sincronización de calificaciones.
              </p>
            </div>

            {supportConfig.supportEmail ? (
              <a 
                href={`mailto:${supportConfig.supportEmail}`} 
                style={{ 
                  background: 'var(--navy, #14213D)', 
                  color: '#FFFFFF', 
                  border: 'none', 
                  width: '100%', 
                  fontWeight: 700, 
                  fontSize: '0.85rem',
                  padding: '0.65rem 1rem',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.45rem',
                  transition: 'all 0.15s ease'
                }}
                onMouseOver={e => e.currentTarget.style.background = '#000000'}
                onMouseOut={e => e.currentTarget.style.background = 'var(--navy, #14213D)'}
              >
                <Mail size={15} color="var(--gold, #FCA311)" />
                <span>{supportConfig.supportEmail}</span>
              </a>
            ) : (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted, #64748B)', fontStyle: 'italic', background: '#F8FAFC', padding: '0.5rem', borderRadius: '6px', textAlign: 'center' }}>
                Canal de correo pendiente de configuración.
              </span>
            )}
          </div>

          {/* TARJETA 2: WHATSAPP / ASISTENCIA RÁPIDA */}
          <div 
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              padding: '1.75rem', 
              background: '#FFFFFF', 
              border: '1px solid #E2E8F0', 
              borderRadius: '16px',
              boxShadow: '0 1px 3px rgba(20, 33, 61, 0.03)',
              transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
              justifyContent: 'space-between'
            }}
            onMouseOver={e => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(20, 33, 61, 0.07)';
              e.currentTarget.style.borderColor = 'var(--gold, #FCA311)';
            }}
            onMouseOut={e => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(20, 33, 61, 0.03)';
              e.currentTarget.style.borderColor = '#E2E8F0';
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#DCFCE7', color: '#007A2E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <MessageSquare size={22} />
                </div>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#007A2E', background: '#DCFCE7', padding: '3px 8px', borderRadius: '6px' }}>
                  ● En horario hábil
                </span>
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 0.35rem 0', color: 'var(--navy, #14213D)' }}>
                Asistencia Rápida
              </h3>
              <p style={{ color: 'var(--text-muted, #64748B)', fontSize: '0.84rem', margin: '0 0 1.25rem 0', lineHeight: 1.45 }}>
                Atención directa para urgencias relacionadas con el inicio de clases en vivo o problemas de conectividad.
              </p>
            </div>

            {supportConfig.supportWhatsApp ? (
              <a 
                href={supportConfig.supportWhatsApp} 
                target="_blank" 
                rel="noreferrer" 
                style={{ 
                  background: '#007A2E', 
                  color: '#FFFFFF', 
                  border: 'none', 
                  width: '100%', 
                  fontWeight: 700, 
                  fontSize: '0.85rem',
                  padding: '0.65rem 1rem',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.45rem',
                  transition: 'all 0.15s ease'
                }}
                onMouseOver={e => e.currentTarget.style.background = '#005a22'}
                onMouseOut={e => e.currentTarget.style.background = '#007A2E'}
              >
                <MessageSquare size={15} />
                <span>Contactar por WhatsApp</span>
              </a>
            ) : (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted, #64748B)', fontStyle: 'italic', background: '#F8FAFC', padding: '0.5rem', borderRadius: '6px', textAlign: 'center' }}>
                Canal de mensajería en configuración.
              </span>
            )}
          </div>

          {/* TARJETA 3: ATENCIÓN INSTITUCIONAL UNAL */}
          <div 
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              padding: '1.75rem', 
              background: '#FFFFFF', 
              border: '1px solid #E2E8F0', 
              borderRadius: '16px',
              boxShadow: '0 1px 3px rgba(20, 33, 61, 0.03)',
              transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
              justifyContent: 'space-between'
            }}
            onMouseOver={e => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(20, 33, 61, 0.07)';
              e.currentTarget.style.borderColor = 'var(--gold, #FCA311)';
            }}
            onMouseOut={e => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(20, 33, 61, 0.03)';
              e.currentTarget.style.borderColor = '#E2E8F0';
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#FEF3C7', color: '#92400E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Building2 size={22} />
                </div>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--navy, #14213D)', background: '#F1F5F9', padding: '3px 8px', borderRadius: '6px' }}>
                  Sede Bogotá
                </span>
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 0.35rem 0', color: 'var(--navy, #14213D)' }}>
                Laboratorio LIATER
              </h3>
              <p style={{ color: 'var(--text-muted, #64748B)', fontSize: '0.84rem', margin: '0 0 1.25rem 0', lineHeight: 1.45 }}>
                Universidad Nacional de Colombia · Facultad de Ingeniería. Coordinación de Diplomados y Cursos Especializados.
              </p>
            </div>

            <div style={{
              background: '#F8FAFC',
              padding: '0.6rem 0.85rem',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              fontSize: '0.78rem',
              color: 'var(--navy, #14213D)',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}>
              <Clock size={14} color="var(--gold, #FCA311)" />
              <span>Lunes a Viernes · 08:00 a 17:00 COT</span>
            </div>
          </div>

        </div>

        {/* ── FAQ - PREGUNTAS FRECUENTES CON BUSCADOR EN VIVO ── */}
        <div style={{ 
          padding: '2rem', 
          background: '#FFFFFF', 
          border: '1px solid #E2E8F0', 
          borderRadius: '16px',
          boxShadow: '0 1px 3px rgba(20, 33, 61, 0.03)'
        }}>
          
          {/* HEADER DE FAQ CON BUSCADOR */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            gap: '1rem', 
            flexWrap: 'wrap', 
            marginBottom: '1.5rem', 
            borderBottom: '1px solid #F1F5F9', 
            paddingBottom: '1.25rem' 
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <HelpCircle size={20} color="var(--navy, #14213D)" />
                <h2 style={{ fontSize: '1.25rem', color: 'var(--navy, #14213D)', fontWeight: 800, margin: 0 }}>
                  Preguntas Frecuentes y Guías
                </h2>
              </div>
              <p style={{ color: 'var(--text-muted, #64748B)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
                Respuestas inmediatas a las consultas más habituales en la plataforma.
              </p>
            </div>

            {/* BARRA DE BÚSQUEDA RÁPIDA */}
            <div style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
              <input 
                type="text"
                value={faqSearch}
                onChange={e => setFaqSearch(e.target.value)}
                placeholder="Buscar en preguntas frecuentes..."
                style={{
                  width: '100%',
                  padding: '0.6rem 0.85rem 0.6rem 2.2rem',
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0',
                  background: '#F8FAFC',
                  fontSize: '0.84rem',
                  color: 'var(--navy, #14213D)',
                  outline: 'none',
                  transition: 'all 0.15s ease'
                }}
                onFocus={e => {
                  e.currentTarget.style.borderColor = 'var(--gold, #FCA311)';
                  e.currentTarget.style.background = '#FFFFFF';
                }}
                onBlur={e => {
                  e.currentTarget.style.borderColor = '#E2E8F0';
                  e.currentTarget.style.background = '#F8FAFC';
                }}
              />
              <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
              {faqSearch && (
                <button
                  type="button"
                  onClick={() => setFaqSearch('')}
                  style={{
                    position: 'absolute',
                    right: '0.65rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#94A3B8',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: 700
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* LISTADO DE PREGUNTAS / ACORDEONES */}
          {filteredFaqs.length === 0 ? (
            <div style={{ padding: '2.5rem 1.5rem', textAlign: 'center', background: '#F8FAFC', borderRadius: '12px', border: '1px dashed #CBD5E1' }}>
              <p style={{ color: 'var(--text-muted, #64748B)', margin: '0 0 0.5rem 0', fontWeight: 600 }}>
                No encontramos preguntas que coincidan con "{faqSearch}".
              </p>
              <button
                type="button"
                onClick={() => setFaqSearch('')}
                style={{
                  background: 'var(--navy, #14213D)',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '0.45rem 1rem',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Ver todas las preguntas ({allFaqs.length})
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {filteredFaqs.map((faq, index) => {
                const isOpen = openIndex === index;
                return (
                  <div 
                    key={index} 
                    style={{ 
                      border: isOpen ? '1px solid var(--navy, #14213D)' : '1px solid #E2E8F0', 
                      borderLeft: isOpen ? '4px solid var(--gold, #FCA311)' : '1px solid #E2E8F0',
                      borderRadius: '10px', 
                      overflow: 'hidden',
                      transition: 'all 0.18s ease',
                      background: isOpen ? '#FFFFFF' : '#FFFFFF',
                      boxShadow: isOpen ? '0 4px 12px rgba(20, 33, 61, 0.05)' : 'none'
                    }}
                  >
                    <button 
                      onClick={() => toggleFaq(index)}
                      style={{ 
                        width: '100%', 
                        padding: '1.1rem 1.35rem', 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        background: 'transparent',
                        border: 'none',
                        textAlign: 'left',
                        cursor: 'pointer',
                        gap: '1rem'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                        {faq.category && (
                          <span style={{
                            background: '#F1F5F9',
                            color: 'var(--navy, #14213D)',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: '6px'
                          }}>
                            {faq.category}
                          </span>
                        )}
                        <span style={{ fontSize: '0.94rem', fontWeight: 800, color: 'var(--navy, #14213D)', lineHeight: 1.4 }}>
                          {faq.question}
                        </span>
                      </div>
                      <ChevronDown 
                        size={18} 
                        color="var(--navy, #14213D)" 
                        style={{ 
                          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', 
                          transition: 'transform 0.2s ease',
                          flexShrink: 0 
                        }} 
                      />
                    </button>
                    {isOpen && (
                      <div style={{ padding: '0 1.35rem 1.25rem 1.35rem', borderTop: '1px solid #F1F5F9' }}>
                        <p style={{ color: '#475569', fontSize: '0.88rem', margin: '0.85rem 0 0 0', lineHeight: 1.6 }}>
                          {faq.answer}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
