import React from "react";
import {
  Users, GraduationCap, BookOpen, ListTree, Video,
  LayoutDashboard, Clock, Zap, UserPlus, Megaphone,
  CalendarPlus, Settings, CheckCircle, EyeOff, AlertCircle,
  Radio, Paperclip
} from "lucide-react";
import { formatShortDate } from '@/utils/dateUtils';

export default function AdminDashboard({
  counts, upcomingClasses, isCourse, isPublished,
  onTabChange, onTogglePublish,
  activeLiveMeetUrl, activeLiveTitle
}) {

  // ESTADISTICAS
  let stats = [
    { label: "Alumnos Inscritos", value: counts?.usuarios   || 0, color: "var(--navy)",      bg: "rgba(20, 33, 61, 0.08)",  icon: <Users        size={22} color="var(--navy)"      /> },
    { label: "Profesores Asignados", value: counts?.profesores  || 0, color: "var(--gold-dark)", bg: "var(--gold-subtle)",      icon: <GraduationCap size={22} color="var(--gold-dark)" /> },
    { label: "Módulos",           value: counts?.modulos     || 0, color: "#16a34a",          bg: "#f0fdf4",                 icon: <BookOpen     size={22} color="#16a34a"           /> },
    { label: "Sesiones",          value: (counts?.sesiones ?? counts?.subtemas) || 0, color: "#0284c7", bg: "#eff6ff", icon: <ListTree size={22} color="#0284c7" /> },
    { label: "Clases Programadas", value: counts?.clases      || 0, color: "var(--gold-dark)", bg: "var(--gold-subtle)",      icon: <Video        size={22} color="var(--gold-dark)" /> },
  ];
  if (isCourse) stats = stats.filter(s => s.label !== "Módulos");

  // ACCESOS RAPIDOS (6)
  const quickActions = [
    { label: "Añadir Alumno",     desc: "Inscribir nuevo estudiante",   icon: <UserPlus      size={20} color="var(--navy)"      />, bg: "rgba(20,33,61,0.07)",  tab: "alumnos"       },
    { label: "Asignar Profesor",  desc: "Vincular docente al programa", icon: <GraduationCap size={20} color="var(--gold-dark)" />, bg: "var(--gold-subtle)",   tab: "profesores"    },
    { label: "Material del Curso", desc: "Recursos y guías",            icon: <Paperclip     size={20} color="var(--gold-dark)" />, bg: "var(--gold-subtle)",   tab: "recursos"      },
    { label: "Nuevo Anuncio",     desc: "Comunicar al programa",        icon: <Megaphone     size={20} color="#0284c7"          />, bg: "#eff6ff",              tab: "anuncios"      },
    { label: "Ir al Constructor", desc: "Gestionar contenidos",         icon: <CalendarPlus  size={20} color="#16a34a"          />, bg: "#f0fdf4",              tab: "curriculum"    },
    { label: "Configuracion",     desc: "Editar datos del programa",    icon: <Settings      size={20} color="#7c3aed"          />, bg: "#f5f3ff",              tab: "configuracion" },
  ];

  // CHECKS DE ESTADO
  const statusChecks = [
    ...(!isCourse ? [{ label: "Modulos publicados",   value: counts?.modulos    || 0 }] : []),
    { label: "Sesiones creadas",     value: (counts?.sesiones ?? counts?.subtemas) || 0 },
    { label: "Clases programadas",   value: counts?.clases     || 0 },
    { label: "Profesores asignados", value: counts?.profesores || 0 },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", animation: "fadeSlideUp 0.35s ease-out" }}>

      {/* ALERTA CLASE EN VIVO */}
      {activeLiveMeetUrl && (
        <a
          href={activeLiveMeetUrl}
          target="_blank"
          rel="noreferrer"
          style={{
            display: "flex", alignItems: "center", gap: "0.85rem",
            background: "linear-gradient(135deg, #14213D 0%, #1e3a5f 100%)",
            color: "#FFFFFF", textDecoration: "none",
            padding: "1rem 1.25rem", borderRadius: "var(--radius-lg)",
            boxShadow: "0 4px 16px rgba(20,33,61,0.25)",
            transition: "transform 0.2s, box-shadow 0.2s",
          }}
          onMouseOver={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(20,33,61,0.35)"; }}
          onMouseOut={e  => { e.currentTarget.style.transform = "translateY(0)";    e.currentTarget.style.boxShadow = "0 4px 16px rgba(20,33,61,0.25)"; }}
        >
          <span style={{ position: "relative", flexShrink: 0 }}>
            <span style={{
              display: "block", width: 12, height: 12,
              borderRadius: "50%", background: "#FCA311",
              animation: "livePulse 1.4s infinite",
            }} />
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: "0.9rem" }}>
              <Radio size={14} style={{ marginRight: 6, verticalAlign: "middle" }} />
              Clase en vivo activa ahora
            </div>
            {activeLiveTitle && (
              <div style={{ fontSize: "0.78rem", opacity: 0.78, marginTop: 2 }}>{activeLiveTitle}</div>
            )}
          </div>
          <span style={{
            background: "#FCA311", color: "#14213D",
            padding: "0.35rem 0.85rem", borderRadius: "6px",
            fontSize: "0.8rem", fontWeight: 800, flexShrink: 0,
          }}>
            Unirse a la sesion en vivo
          </span>
        </a>
      )}

      {/* BADGE PUBLICACION + CTA */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
        {isPublished ? (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "#f0fdf4", color: "#16a34a",
            border: "1px solid #bbf7d0", borderRadius: "20px",
            padding: "0.3rem 0.85rem", fontSize: "0.78rem", fontWeight: 700
          }}>
            <CheckCircle size={14} /> Programa publicado — visible para estudiantes
          </span>
        ) : (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "#fffbe6", color: "#d97706",
            border: "1px solid #fca311", borderRadius: "20px",
            padding: "0.3rem 0.85rem", fontSize: "0.78rem", fontWeight: 700
          }}>
            <EyeOff size={14} /> Programa en borrador — no visible para estudiantes
          </span>
        )}

        {onTogglePublish && (
          <button
            onClick={onTogglePublish}
            style={{
              background: isPublished ? "#fee2e2" : "#f0fdf4",
              color: isPublished ? "#dc2626" : "#16a34a",
              border: "1px solid " + (isPublished ? "#fecaca" : "#bbf7d0"),
              borderRadius: "20px",
              padding: "0.3rem 0.85rem",
              fontSize: "0.78rem", fontWeight: 700,
              cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
              transition: "opacity 0.18s",
            }}
            onMouseOver={e => e.currentTarget.style.opacity = "0.75"}
            onMouseOut={e  => e.currentTarget.style.opacity = "1"}
          >
            {isPublished
              ? <><EyeOff size={13} /> Cambiar a borrador</>
              : <><CheckCircle size={13} /> Publicar programa</>
            }
          </button>
        )}
      </div>

      {/* ESTADISTICAS (KPIs en Grid Horizontal) */}
      <div
        className="stats-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: "1.1rem",
          width: "100%",
          marginBottom: "0.25rem"
        }}
      >
        {stats.map(s => (
          <div
            className="stat-card"
            key={s.label}
            style={{
              background: "#ffffff",
              border: "1px solid var(--border-color)",
              borderRadius: "14px",
              padding: "1.15rem 1.25rem",
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
              transition: "transform 0.2s ease, box-shadow 0.2s ease",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 6px 16px rgba(20, 33, 61, 0.08)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.04)";
            }}
          >
            <div
              className="stat-icon"
              style={{
                background: s.bg,
                width: 48,
                height: 48,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {s.icon}
            </div>
            <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <span
                style={{
                  fontWeight: 700,
                  color: "var(--text-muted)",
                  fontSize: "0.72rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  lineHeight: 1.2,
                }}
              >
                {s.label}
              </span>
              <span
                style={{
                  color: "var(--navy)",
                  fontWeight: 800,
                  fontSize: "1.75rem",
                  lineHeight: 1.1,
                  marginTop: "0.25rem",
                }}
              >
                {s.value ?? "0"}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* ACCESOS RAPIDOS */}
      <div style={{ background: "#ffffff", border: "1px solid var(--border-color)", borderRadius: "var(--radius-lg)", padding: "1.5rem", boxShadow: "var(--shadow-sm)" }}>
        <h3 style={{ fontWeight: 700, marginBottom: "1.1rem", fontSize: "1.05rem", color: "var(--navy)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Zap size={18} color="var(--gold)" /> Accesos Rapidos
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))", gap: "0.85rem" }}>
          {quickActions.map(action => (
            <button
              key={action.tab}
              onClick={() => onTabChange && onTabChange(action.tab)}
              style={{
                display: "flex", alignItems: "center", gap: "0.75rem",
                padding: "0.85rem 1rem",
                background: action.bg,
                border: "1px solid var(--border-color)",
                borderRadius: "var(--radius-md)",
                cursor: "pointer", textAlign: "left",
                transition: "transform 0.15s, box-shadow 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)";    e.currentTarget.style.boxShadow = "none"; }}
            >
              <div style={{ flexShrink: 0 }}>{action.icon}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--navy)" }}>{action.label}</div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 2 }}>{action.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* SECCION DOBLE: ESTADO + PROXIMAS CLASES */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.5rem" }}>

        {/* Estado del Programa — checks, no barras */}
        <div style={{ padding: "1.5rem", background: "#ffffff", border: "1px solid var(--border-color)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-sm)" }}>
          <h3 style={{ fontWeight: 700, marginBottom: "1.25rem", fontSize: "1.05rem", color: "var(--navy)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <LayoutDashboard size={18} color="var(--gold)" /> Estado del Programa
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {statusChecks.map(item => {
              const ok = item.value > 0;
              return (
                <div key={item.label} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "0.65rem 0.9rem",
                  background: ok ? "#f0fdf4" : "#fff7ed",
                  border: "1px solid " + (ok ? "#bbf7d0" : "#fed7aa"),
                  borderRadius: "var(--radius-md)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
                    {ok ? <CheckCircle size={15} color="#16a34a" /> : <AlertCircle size={15} color="#f97316" />}
                    <span style={{ fontSize: "0.84rem", fontWeight: 500, color: "var(--text-secondary)" }}>{item.label}</span>
                  </div>
                  <span style={{ fontWeight: 800, fontSize: "0.9rem", color: ok ? "#16a34a" : "#f97316", minWidth: 28, textAlign: "right" }}>
                    {item.value}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Proximas Clases — con nombre del profesor */}
        <div style={{ padding: "1.5rem", background: "#ffffff", border: "1px solid var(--border-color)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-sm)" }}>
          <h3 style={{ fontWeight: 700, marginBottom: "1.25rem", fontSize: "1.05rem", color: "var(--navy)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Clock size={18} color="var(--gold-dark)" /> Proximas Clases
          </h3>
          {!upcomingClasses || upcomingClasses.length === 0 ? (
            <div style={{ textAlign: "center", padding: "1.5rem 0", color: "var(--text-muted)" }}>
              <Clock size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
              <p style={{ fontSize: "0.85rem", margin: 0 }}>No hay clases proximas programadas.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {upcomingClasses.map(cls => {
                const teacherName = cls.teacher_profiles?.name || null;
                return (
                  <div key={cls.id} style={{
                    display: "flex", alignItems: "center", gap: "0.85rem",
                    padding: "0.75rem",
                    borderRadius: "var(--radius-md)",
                    background: "var(--surface-light)",
                    border: "1px solid var(--border-color)",
                  }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: "var(--radius-md)",
                      background: "var(--gold-subtle)", display: "flex",
                      alignItems: "center", justifyContent: "center", flexShrink: 0
                    }}>
                      <Clock size={18} color="var(--gold-dark)" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: "0.86rem", color: "var(--navy)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {cls.title}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2, display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                        <span>{formatShortDate(cls.class_date)}</span>
                        {teacherName ? (
                          <>
                            <span style={{ opacity: 0.4 }}>·</span>
                            <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                              <GraduationCap size={11} />{teacherName}
                            </span>
                          </>
                        ) : (
                          <>
                            <span style={{ opacity: 0.4 }}>·</span>
                            <span style={{ color: "#f97316", fontWeight: 600 }}>Sin profesor asignado</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      <style>{`
        @keyframes livePulse {
          0%   { box-shadow: 0 0 0 0   rgba(252,163,17,0.7); }
          70%  { box-shadow: 0 0 0 10px rgba(252,163,17,0);  }
          100% { box-shadow: 0 0 0 0   rgba(252,163,17,0);  }
        }
      `}</style>

    </div>
  );
}
