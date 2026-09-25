import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import {
  UserPlus, Users, GraduationCap, ShieldAlert, X, Mail,
  Pencil, Trash2, CheckCircle, BookOpen, PhoneCall, Globe,
  ToggleLeft, ToggleRight, Send, RefreshCw, Eye, EyeOff, ChevronDown,
  AlertTriangle, Clock
} from "lucide-react";
import "./AdminPanel.css";

// ─── Helpers ────────────────────────────────────────────────
// status: "active" | "pending" | "inactive"
// Se determina por is_active e invited_at del perfil:
// Verifica si el registro es una invitación pendiente de activación
function isInvitation(user) {
  return !user?.is_active && Boolean(user?.invited_at);
}

// Calcula si la invitación enviada ya superó las 24 horas (86.400.000 ms)
function isInviteExpired(user) {
  if (!user || user.is_active) return false;
  const dateStr = user.invited_at || user.created_at;
  if (!dateStr) return true;
  const elapsedMs = Date.now() - new Date(dateStr).getTime();
  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
  return elapsedMs >= TWENTY_FOUR_HOURS_MS;
}

// Horas restantes de vigencia de la invitación
function getInviteHoursRemaining(user) {
  if (!user || user.is_active) return 0;
  const dateStr = user.invited_at || user.created_at;
  if (!dateStr) return 0;
  const elapsedMs = Date.now() - new Date(dateStr).getTime();
  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
  const remainingMs = TWENTY_FOUR_HOURS_MS - elapsedMs;
  if (remainingMs <= 0) return 0;
  const hours = Math.floor(remainingMs / (1000 * 60 * 60));
  const mins = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `~${hours}h restantes`;
  return `${mins}m restantes`;
}

function AuthStatusBadge({ user, status }) {
  let finalStatus = status;
  let customLabel = null;

  if (user) {
    if (user.is_active) {
      finalStatus = "active";
    } else {
      const expired = isInviteExpired(user);
      if (expired) {
        finalStatus = "expired";
      } else {
        finalStatus = "pending";
        const rem = getInviteHoursRemaining(user);
        if (rem) customLabel = `Invitación Vigente (${rem})`;
      }
    }
  }

  const map = {
    active:   { bg: "#d1fae5", color: "#065f46", label: "Activo" },
    pending:  { bg: "#fef3c7", color: "#92400e", label: customLabel || "Invitación Vigente (<24h)" },
    expired:  { bg: "#fee2e2", color: "#991b1b", label: "Invitación Expirada (>24h)" },
    inactive: { bg: "#f1f5f9", color: "#64748b", label: "Inactivo" },
  };
  const s = map[finalStatus] || { bg: "#f1f5f9", color: "#64748b", label: finalStatus };
  return (
    <span style={{
      background: s.bg,
      color: s.color,
      fontSize: "0.72rem",
      fontWeight: 700,
      padding: "0.22rem 0.55rem",
      borderRadius: "12px",
      whiteSpace: "nowrap",
      display: "inline-flex",
      alignItems: "center",
      gap: "0.3rem"
    }}>
      {finalStatus === "expired" && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#dc2626", display: "inline-block" }} />}
      {finalStatus === "pending" && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#d97706", display: "inline-block" }} />}
      {finalStatus === "active" && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#16a34a", display: "inline-block" }} />}
      {s.label}
    </span>
  );
}

function Initials({ name, size = 36 }) {
  const parts = (name || "").trim().split(" ");
  const letters = ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: "linear-gradient(135deg, var(--navy) 0%, #1e4080 100%)",
      color: "white", display: "flex", alignItems: "center", justifyContent: "center",
      fontWeight: 800, fontSize: size * 0.37, flexShrink: 0, letterSpacing: "-0.5px"
    }}>{letters || "?"}</div>
  );
}

// ─── Modal crear usuario ─────────────────────────────────────
function CreateUserModal({ isOpen, onClose, onSuccess }) {
  const [roleSelected, setRoleSelected] = useState("student");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [area, setArea] = useState("");
  const [bio, setBio] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (isOpen) { setFullName(""); setEmail(""); setArea(""); setBio(""); setError(""); setSuccess(""); setRoleSelected("student"); }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError(""); setSuccess("");
    if (!fullName.trim() || !email.trim()) { setError("El nombre y el correo son obligatorios."); return; }
    setSubmitting(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("invite-user", {
        body: { email: email.trim(), full_name: fullName.trim(), role: roleSelected, area: area.trim() || null, bio: bio.trim() || null }
      });
      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(data.error);
      setSuccess(`Invitación enviada a ${email}. El usuario recibirá un correo para crear su contraseña.`);
      setTimeout(() => { onSuccess?.(); onClose(); }, 2800);
    } catch (err) {
      setError(err.message || "Error al enviar invitación.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1200 }}>
      <div style={{ width: "100%", maxWidth: "480px", background: "white", borderRadius: "16px", overflow: "hidden", boxShadow: "0 24px 48px rgba(0,0,0,0.25)" }}>
        <div style={{ background: "var(--navy)", padding: "1.4rem 1.75rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.5)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "0.2rem" }}>Nuevo Usuario</div>
            <h3 style={{ margin: 0, color: "white", fontWeight: 800, fontSize: "1.05rem" }}>Invitar por correo electrónico</h3>
          </div>
          <button onClick={onClose} style={{ color: "rgba(255,255,255,0.6)", background: "none", border: "none", cursor: "pointer" }}><X size={22} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: "1.75rem", display: "flex", flexDirection: "column", gap: "1.1rem" }}>
          {error && <div style={{ background: "#fef2f2", color: "#b91c1c", padding: "0.7rem 1rem", borderRadius: "8px", fontSize: "0.84rem" }}>{error}</div>}
          {success && (
            <div style={{ background: "#f0fdf4", color: "#15803d", padding: "0.7rem 1rem", borderRadius: "8px", fontSize: "0.84rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <CheckCircle size={16} /> {success}
            </div>
          )}

          {/* Rol */}
          <div>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: 600, fontSize: "0.84rem" }}>Rol del usuario</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              {[
                { id: "student", label: "Estudiante", icon: <Users size={18} /> },
                { id: "teacher", label: "Profesor", icon: <GraduationCap size={18} /> },
              ].map(r => (
                <button type="button" key={r.id} onClick={() => setRoleSelected(r.id)} style={{
                  padding: "0.75rem", borderRadius: "10px", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.6rem",
                  border: roleSelected === r.id ? "2px solid var(--gold-dark)" : "2px solid var(--border-color)",
                  background: roleSelected === r.id ? "var(--gold-subtle)" : "white",
                  fontWeight: 700, fontSize: "0.875rem",
                  color: roleSelected === r.id ? "var(--navy)" : "var(--text-muted)",
                  transition: "all 0.15s"
                }}>
                  {React.cloneElement(r.icon, { color: roleSelected === r.id ? "var(--gold-dark)" : "var(--text-muted)" })}
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "4px", fontWeight: 600, fontSize: "0.84rem" }}>Nombre completo</label>
            <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} style={{ width: "100%", padding: "0.6rem 0.8rem", border: "1px solid var(--border-color)", borderRadius: "8px" }} required placeholder="Ej: María García" />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "4px", fontWeight: 600, fontSize: "0.84rem" }}>Correo electrónico</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={{ width: "100%", padding: "0.6rem 0.8rem", border: "1px solid var(--border-color)", borderRadius: "8px" }} required placeholder="ejemplo@correo.com" />
          </div>

          {roleSelected === "teacher" && (
            <>
              <div>
                <label style={{ display: "block", marginBottom: "4px", fontWeight: 600, fontSize: "0.84rem" }}>Área / Especialidad</label>
                <input type="text" value={area} onChange={e => setArea(e.target.value)} style={{ width: "100%", padding: "0.6rem 0.8rem", border: "1px solid var(--border-color)", borderRadius: "8px" }} placeholder="Ej: Iluminación Deportiva" />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "4px", fontWeight: 600, fontSize: "0.84rem" }}>Biografía breve</label>
                <textarea value={bio} onChange={e => setBio(e.target.value)} style={{ width: "100%", padding: "0.6rem 0.8rem", border: "1px solid var(--border-color)", borderRadius: "8px", minHeight: "65px" }} placeholder="Descripción académica del profesor..." />
              </div>
            </>
          )}

          <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: "8px", padding: "0.75rem 1rem", fontSize: "0.78rem", color: "#0369a1", display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
            <Send size={14} style={{ flexShrink: 0, marginTop: "1px" }} />
            <span>El usuario recibirá un correo de <strong>Supabase</strong> con un enlace para crear su propia contraseña. No necesitas escribir ninguna contraseña manual.</span>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "0.25rem" }}>
            <button type="button" onClick={onClose} style={{ padding: "0.65rem 1.25rem", borderRadius: "8px", border: "1px solid var(--border-color)", background: "#f8fafc", color: "var(--text-secondary)", fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
            <button type="submit" disabled={submitting} style={{ padding: "0.65rem 1.5rem", borderRadius: "8px", border: "none", background: "var(--navy)", color: "white", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Mail size={15} />
              {submitting ? "Enviando..." : "Enviar Invitación"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal Eliminar Usuario (Seguro) ──────────────────────────
function DeleteUserModal({ isOpen, onClose, user, onSuccess }) {
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setConfirmText("");
      setDeleting(false);
      setError("");
    }
  }, [isOpen, user]);

  if (!isOpen || !user) return null;

  const isPending = user.is_active === false;
  const programCount = (user.assigned_programs || []).length;
  const requiresTyping = !isPending || programCount > 0;
  const canSubmit = !requiresTyping || confirmText.trim().toUpperCase() === "ELIMINAR";

  const handleDelete = async (e) => {
    if (e) e.preventDefault();
    if (!canSubmit || deleting) return;
    setDeleting(true);
    setError("");

    try {
      let fnSuccess = false;

      // 1. Intentar primero con la Edge Function delete-user
      try {
        const { data, error: fnErr } = await supabase.functions.invoke("delete-user", {
          body: { user_id: user.id }
        });

        if (!fnErr && !data?.error) {
          fnSuccess = true;
        } else if (data?.error) {
          console.warn("[DeleteUserModal] Edge function reportó error:", data.error);
        }
      } catch (invokeErr) {
        console.warn("[DeleteUserModal] Edge function no disponible, usando cascada directa:", invokeErr);
      }

      // 2. Fallback: Ejecución directa en base de datos si la función no está desplegada en Supabase
      if (!fnSuccess) {
        if (user.role === "student") {
          await supabase.from("activity_attempts").delete().eq("student_id", user.id);
          await supabase.from("quiz_submissions").delete().eq("student_id", user.id);
          await supabase.from("assignment_submissions").delete().eq("student_id", user.id);
          await supabase.from("class_doubts").delete().eq("student_id", user.id);
          await supabase.from("enrollments").delete().eq("student_id", user.id);
        } else if (user.role === "teacher") {
          await supabase.from("class_sessions").update({ teacher_id: null }).eq("teacher_id", user.id);
          if (user.teacher_profile_id) {
            await supabase.from("class_sessions").update({ teacher_id: null }).eq("teacher_id", user.teacher_profile_id);
            await supabase.from("teacher_profiles").delete().eq("id", user.teacher_profile_id);
          }
          await supabase.from("teacher_profiles").delete().eq("user_id", user.id);
          await supabase.from("enrollments").delete().eq("student_id", user.id);
        }

        const { error: delErr } = await supabase.from("users_profile").delete().eq("id", user.id);
        if (delErr) throw delErr;
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error("Error al eliminar usuario:", err);
      setError(err.message || "No se pudo eliminar el usuario.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1300, padding: "1rem" }}>
      <div style={{ width: "100%", maxWidth: "460px", background: "white", borderRadius: "16px", overflow: "hidden", boxShadow: "0 24px 48px rgba(0,0,0,0.25)", animation: "fadeSlideUp 0.25s ease-out" }}>
        
        {/* Header rojo */}
        <div style={{ background: "#991b1b", padding: "1.25rem 1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", color: "white" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Trash2 size={18} color="white" />
            </div>
            <div>
              <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.75)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Confirmación de Seguridad
              </div>
              <h3 style={{ margin: 0, color: "white", fontWeight: 800, fontSize: "1.05rem" }}>
                Eliminar {user.role === "teacher" ? "Profesor" : "Estudiante"}
              </h3>
            </div>
          </div>
          <button onClick={onClose} style={{ color: "rgba(255,255,255,0.7)", background: "none", border: "none", cursor: "pointer" }}>
            <X size={20} />
          </button>
        </div>

        {/* Contenido */}
        <div style={{ padding: "1.5rem" }}>
          {error && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", padding: "0.75rem 1rem", borderRadius: "8px", fontSize: "0.84rem", marginBottom: "1rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <ShieldAlert size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {/* Tarjeta de información del usuario */}
          <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "1rem", marginBottom: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <Initials name={user.full_name} size={40} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, color: "var(--navy)", fontSize: "0.95rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {user.full_name || "Sin nombre"}
                </div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {user.email}
                </div>
              </div>
              <AuthStatusBadge user={user} />
            </div>

            <div style={{ marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", fontSize: "0.76rem", color: "#64748b" }}>
              <span>{user.role === "teacher" ? "Programas Asignados:" : "Programas Inscritos:"} <strong>{programCount}</strong></span>
              <span>Rol: <strong style={{ textTransform: "capitalize" }}>{user.role === "teacher" ? "Profesor" : "Estudiante"}</strong></span>
            </div>
          </div>

          <p style={{ fontSize: "0.875rem", color: "#334155", lineHeight: 1.5, margin: "0 0 1rem 0" }}>
            {requiresTyping ? (
              <>
                ⚠️ <strong>Esta acción es irreversible.</strong> Se eliminarán definitivamente las credenciales de acceso, el perfil y los registros asociados de este usuario en la plataforma.
              </>
            ) : (
              <>
                Esta invitación pendiente no tiene historial de actividades. Se eliminará la cuenta y se liberará el correo para que pueda ser utilizado de nuevo.
              </>
            )}
          </p>

          {requiresTyping && (
            <div style={{ marginBottom: "1.25rem" }}>
              <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#475569", marginBottom: "0.4rem" }}>
                Para confirmar, escribe <span style={{ color: "#b91c1c", fontWeight: 800 }}>ELIMINAR</span> a continuación:
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                placeholder="Escribe ELIMINAR"
                style={{
                  width: "100%",
                  padding: "0.6rem 0.85rem",
                  borderRadius: "8px",
                  border: confirmText.toUpperCase() === "ELIMINAR" ? "2px solid #dc2626" : "1px solid #cbd5e1",
                  fontSize: "0.88rem",
                  fontWeight: 600,
                  outline: "none"
                }}
              />
            </div>
          )}

          {/* Acciones */}
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={onClose}
              disabled={deleting}
              style={{
                padding: "0.6rem 1.2rem",
                borderRadius: "8px",
                border: "1px solid var(--border-color)",
                background: "#f8fafc",
                color: "var(--text-secondary)",
                fontWeight: 600,
                fontSize: "0.85rem",
                cursor: "pointer"
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={!canSubmit || deleting}
              style={{
                padding: "0.6rem 1.4rem",
                borderRadius: "8px",
                border: "none",
                background: canSubmit ? "#dc2626" : "#fca5a5",
                color: "white",
                fontWeight: 700,
                fontSize: "0.85rem",
                cursor: canSubmit && !deleting ? "pointer" : "not-allowed",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                boxShadow: canSubmit ? "0 2px 8px rgba(220, 38, 38, 0.25)" : "none",
                transition: "all 0.15s ease"
              }}
            >
              <Trash2 size={15} />
              {deleting ? "Eliminando..." : "Eliminar Definitivamente"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── Modal Reenviar Invitación (Diseño Profesional) ───────────
function ResendInviteModal({ isOpen, onClose, user, onSuccess }) {
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    if (isOpen) {
      setResending(false);
      setError("");
      setSuccessMsg("");
    }
  }, [isOpen, user]);

  if (!isOpen || !user) return null;

  const handleConfirm = async (e) => {
    if (e) e.preventDefault();
    if (resending) return;
    setResending(true);
    setError("");

    try {
      const { data, error: fnErr } = await supabase.functions.invoke("invite-user", {
        body: {
          email: user.email,
          full_name: user.full_name,
          role: user.role,
          area: user.area,
          bio: user.bio
        }
      });

      if (fnErr) {
        let errorText = fnErr.message;
        try {
          if (fnErr.context && typeof fnErr.context.json === "function") {
            const bodyJson = await fnErr.context.json();
            if (bodyJson?.error) errorText = bodyJson.error;
          }
        } catch (_) {}
        throw new Error(errorText || "Error al invocar la función de reenvío.");
      }

      if (data?.error) throw new Error(data.error);

      setSuccessMsg(`Invitación reenviada correctamente a ${user.email}.`);
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1200);
    } catch (err) {
      console.error("Error al reenviar invitación:", err);
      setError(err.message || "No se pudo reenviar la invitación.");
    } finally {
      setResending(false);
    }
  };

  const isTeacher = user.role === "teacher";

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.65)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1300, padding: "1rem" }}>
      <div style={{ width: "100%", maxWidth: "480px", background: "white", borderRadius: "16px", overflow: "hidden", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)", animation: "fadeSlideUp 0.25s ease-out" }}>
        
        {/* Header Premium con degradado institucional */}
        <div style={{ background: "linear-gradient(135deg, var(--navy, #14213d) 0%, #1e293b 100%)", padding: "1.25rem 1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", color: "white", borderBottom: "2px solid rgba(252, 163, 17, 0.4)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: "rgba(252, 163, 17, 0.15)", border: "1px solid rgba(252, 163, 17, 0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Mail size={20} color="var(--gold, #fca311)" />
            </div>
            <div>
              <div style={{ fontSize: "0.68rem", color: "var(--gold, #fca311)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Gestión de Accesos · LIATER
              </div>
              <h3 style={{ margin: 0, color: "white", fontWeight: 800, fontSize: "1.05rem" }}>
                Reenviar Invitación
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={resending}
            style={{ color: "rgba(255,255,255,0.7)", background: "rgba(255,255,255,0.08)", border: "none", borderRadius: "6px", width: "30px", height: "30px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "var(--transition-fast)" }}
            onMouseOver={e => e.currentTarget.style.color = "white"}
            onMouseOut={e => e.currentTarget.style.color = "rgba(255,255,255,0.7)"}
          >
            <X size={18} />
          </button>
        </div>

        {/* Contenido del Modal */}
        <div style={{ padding: "1.5rem" }}>
          {error && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", padding: "0.75rem 1rem", borderRadius: "8px", fontSize: "0.84rem", marginBottom: "1rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <ShieldAlert size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div style={{ background: "#f0fdf4", border: "1px solid #86efac", color: "#16a34a", padding: "0.75rem 1rem", borderRadius: "8px", fontSize: "0.84rem", marginBottom: "1rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <CheckCircle size={16} style={{ flexShrink: 0 }} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Tarjeta resumen del usuario destinatario */}
          <div style={{ background: "var(--cream, #F8FAFC)", border: "1px solid var(--border-color, #E2E8F0)", borderRadius: "12px", padding: "1rem", marginBottom: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
              <Initials name={user.full_name} size={42} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, color: "var(--navy)", fontSize: "0.95rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {user.full_name || "Sin nombre registrado"}
                </div>
                <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "0.3rem", marginTop: "0.15rem" }}>
                  <Mail size={13} color="var(--navy-light)" /> {user.email}
                </div>
              </div>
              <span style={{ fontSize: "0.72rem", fontWeight: 700, padding: "0.2rem 0.6rem", borderRadius: "999px", background: isTeacher ? "rgba(252, 163, 17, 0.15)" : "rgba(20, 33, 61, 0.08)", color: isTeacher ? "var(--gold-dark, #b45309)" : "var(--navy)", border: isTeacher ? "1px solid rgba(252, 163, 17, 0.3)" : "1px solid rgba(20, 33, 61, 0.15)" }}>
                {isTeacher ? "Profesor" : "Estudiante"}
              </span>
            </div>
          </div>

          {/* Bloque informativo de seguridad y vigencia */}
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.65rem", marginBottom: "1.5rem" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem", fontSize: "0.83rem", color: "var(--navy)" }}>
              <Send size={15} color="var(--gold-dark, #b45309)" style={{ flexShrink: 0, marginTop: "2px" }} />
              <div>
                <strong>Nuevo correo de acceso:</strong> Se generará y enviará un nuevo enlace de activación a la dirección de correo indicada.
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem", fontSize: "0.83rem", color: "var(--navy)" }}>
              <Clock size={15} color="#0284c7" style={{ flexShrink: 0, marginTop: "2px" }} />
              <div>
                <strong>Vigencia de 24 horas:</strong> El nuevo enlace será válido durante 24 horas a partir del momento del envío.
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem", fontSize: "0.83rem", color: "var(--navy)" }}>
              <AlertTriangle size={15} color="#d97706" style={{ flexShrink: 0, marginTop: "2px" }} />
              <div>
                <strong>Revocación automática:</strong> El enlace anterior quedará automáticamente invalidado por motivos de seguridad.
              </div>
            </div>
          </div>

          {/* Botones de Acción */}
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={onClose}
              disabled={resending}
              style={{
                padding: "0.65rem 1.25rem",
                borderRadius: "8px",
                border: "1px solid var(--border-color)",
                background: "#f8fafc",
                color: "var(--text-secondary)",
                fontWeight: 600,
                fontSize: "0.88rem",
                cursor: "pointer",
                transition: "var(--transition-fast)"
              }}
              onMouseOver={e => e.currentTarget.style.background = "#e2e8f0"}
              onMouseOut={e => e.currentTarget.style.background = "#f8fafc"}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={resending}
              className="btn btn-primary"
              style={{
                padding: "0.65rem 1.45rem",
                display: "flex",
                alignItems: "center",
                gap: "0.45rem",
                fontSize: "0.88rem",
                fontWeight: 700
              }}
            >
              <RefreshCw size={15} className={resending ? "spin" : ""} />
              {resending ? "Reenviando..." : "Reenviar Invitación"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── Drawer de Estudiante ────────────────────────────────────
function StudentDrawer({ isOpen, onClose, student, onRefresh, onDeleteRequest, onResendRequest }) {
  const [activeTab, setActiveTab] = useState("perfil");
  const [diplomas, setDiplomas] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen && student) {
      setActiveTab("perfil");
      setFullName(student.full_name || "");
      setPhone(student.phone && student.phone !== "—" ? student.phone : "");
      setCountry(student.country || "");
      setSuccess(""); setError("");
      fetchEnrollmentData();
    }
  }, [isOpen, student]);

  const fetchEnrollmentData = async () => {
    if (!student) return;
    setLoading(true);
    const { data: dData } = await supabase.from("diploma_programs").select("id, title, program_type");
    const { data: eData } = await supabase.from("enrollments").select("program_id").eq("student_id", student.id);
    setDiplomas(dData || []);
    setEnrollments(eData ? eData.map(e => e.program_id) : []);
    setLoading(false);
  };

  const handleToggleEnroll = async (programId) => {
    const isEnrolled = enrollments.includes(programId);
    try {
      if (isEnrolled) {
        await supabase.from("enrollments").delete().eq("student_id", student.id).eq("program_id", programId);
        setEnrollments(prev => prev.filter(id => id !== programId));
      } else {
        await supabase.from("enrollments").insert([{ student_id: student.id, program_id: programId }]);
        setEnrollments(prev => [...prev, programId]);
      }
      onRefresh?.();
    } catch (err) { console.error(err); }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");
    setSubmitting(true);
    try {
      await supabase.from("users_profile").update({ full_name: fullName, phone, country }).eq("id", student.id);
      setSuccess("Perfil actualizado.");
      onRefresh?.();
      setTimeout(() => setSuccess(""), 2500);
    } catch (err) { setError(err.message); }
    finally { setSubmitting(false); }
  };

  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState("");

  const handleResendInvite = async () => {
    if (!window.confirm(`¿Reenviar la invitación a ${student.email}? El enlace anterior quedará inválido.`)) return;
    setResending(true);
    setResendMsg("");
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("invite-user", {
        body: { email: student.email, full_name: student.full_name, role: student.role }
      });
      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(data.error);
      setResendMsg(data?.resent ? "Invitación reenviada con éxito." : "Nueva invitación enviada.");
      setTimeout(() => setResendMsg(""), 3500);
    } catch (err) {
      setResendMsg("Error: " + (err.message || "No se pudo reenviar."));
    } finally {
      setResending(false);
    }
  };

  if (!isOpen || !student) return null;

  const TABS = [
    { id: "perfil", label: "Perfil" },
    { id: "inscripciones", label: "Inscripciones" },
  ];

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000 }} />
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: "560px", maxWidth: "95vw",
        background: "white", zIndex: 1001, display: "flex", flexDirection: "column",
        boxShadow: "-4px 0 24px rgba(0,0,0,0.15)", animation: "slideInRight 0.3s ease-out"
      }}>
        <style>{`@keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>

        <div style={{ background: "var(--navy)", padding: "1.25rem 1.5rem", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
              <Initials name={student.full_name} size={48} />
              <div>
                <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.5)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Estudiante</div>
                <div style={{ color: "white", fontWeight: 800, fontSize: "1.05rem" }}>{student.full_name}</div>
                <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.5)", marginTop: "0.1rem" }}>{student.email}</div>
              </div>
            </div>
            <button onClick={onClose} style={{ color: "rgba(255,255,255,0.6)", background: "none", border: "none", cursor: "pointer" }}><X size={22} /></button>
          </div>
          <div style={{ marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
              <AuthStatusBadge user={student} />
              {!student.is_active && (
                isInviteExpired(student) ? (
                  <button
                    onClick={() => onResendRequest ? onResendRequest(student) : handleResendInvite()}
                    disabled={resending}
                    style={{ fontSize: "0.72rem", color: "white", background: "#0284c7", border: "none", borderRadius: "6px", padding: "0.25rem 0.65rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.3rem", fontWeight: 700 }}
                  >
                    <RefreshCw size={10} className={resending ? "spin" : ""} /> {resending ? "Reenviando..." : "Reenviar invitación"}
                  </button>
                ) : (
                  <span style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.75)", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "6px", padding: "0.2rem 0.55rem" }}>
                    🕒 Enlace válido ({getInviteHoursRemaining(student)})
                  </span>
                )
              )}
            </div>
            {resendMsg && (
              <span style={{ fontSize: "0.72rem", color: resendMsg.startsWith("Error") ? "#fca5a5" : "#86efac", fontWeight: 600 }}>
                {resendMsg}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: "flex", borderBottom: "2px solid var(--border-color)", background: "#fafafa", flexShrink: 0 }}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              flex: 1, padding: "0.85rem", border: "none", background: "none", cursor: "pointer",
              fontWeight: 600, fontSize: "0.82rem", borderBottom: activeTab === tab.id ? "2px solid var(--gold-dark)" : "2px solid transparent",
              color: activeTab === tab.id ? "var(--gold-dark)" : "var(--text-muted)", transition: "all 0.15s"
            }}>
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ padding: "1.5rem", flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
          {activeTab === "perfil" && (
            <form onSubmit={handleSaveProfile} style={{ display: "flex", flexDirection: "column", gap: "1.1rem", flex: 1 }}>
              {error && <div style={{ background: "#fef2f2", color: "#b91c1c", padding: "0.7rem 1rem", borderRadius: "8px", fontSize: "0.84rem" }}>{error}</div>}
              {success && (
                <div style={{ background: "#f0fdf4", color: "#15803d", padding: "0.7rem 1rem", borderRadius: "8px", fontSize: "0.84rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <CheckCircle size={16} /> {success}
                </div>
              )}

              <div>
                <label style={{ display: "block", marginBottom: "4px", fontWeight: 600, fontSize: "0.84rem" }}>Nombre completo</label>
                <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} style={{ width: "100%", padding: "0.6rem 0.8rem", border: "1px solid var(--border-color)", borderRadius: "8px" }} />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "4px", fontWeight: 600, fontSize: "0.84rem" }}>Teléfono</label>
                <input type="text" value={phone} onChange={e => setPhone(e.target.value)} style={{ width: "100%", padding: "0.6rem 0.8rem", border: "1px solid var(--border-color)", borderRadius: "8px" }} placeholder="+57 300 123 4567" />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "4px", fontWeight: 600, fontSize: "0.84rem" }}>País</label>
                <input type="text" value={country} onChange={e => setCountry(e.target.value)} style={{ width: "100%", padding: "0.6rem 0.8rem", border: "1px solid var(--border-color)", borderRadius: "8px" }} placeholder="Colombia" />
              </div>

              <div style={{ marginTop: "auto", paddingTop: "1.5rem", borderTop: "1px solid #E2E8F0", display: "flex", justifyContent: student.is_active === false ? "space-between" : "flex-end", alignItems: "center" }}>
                {student.is_active === false && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onDeleteRequest?.(student);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem",
                      background: "none",
                      border: "none",
                      color: "#dc2626",
                      fontSize: "0.82rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      padding: "0.4rem 0.6rem",
                      borderRadius: "6px"
                    }}
                    onMouseOver={e => e.currentTarget.style.background = "#fef2f2"}
                    onMouseOut={e => e.currentTarget.style.background = "none"}
                  >
                    <Trash2 size={14} /> Eliminar estudiante
                  </button>
                )}

                <button type="submit" disabled={submitting} style={{ padding: "0.65rem 1.5rem", borderRadius: "8px", border: "none", background: "var(--navy)", color: "white", fontWeight: 700, cursor: "pointer" }}>
                  {submitting ? "Guardando..." : "Guardar Cambios"}
                </button>
              </div>
            </form>
          )}

          {activeTab === "inscripciones" && (
            <div>
              <p style={{ color: "var(--text-muted)", fontSize: "0.84rem", marginBottom: "1rem" }}>
                Haz clic en el botón para inscribir o desinscribir al estudiante de los programas disponibles.
              </p>
              {loading ? (
                <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>Cargando programas...</div>
              ) : diplomas.length === 0 ? (
                <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>No hay diplomados disponibles.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                  {diplomas.map(d => {
                    const enrolled = enrollments.includes(d.id);
                    return (
                      <div key={d.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.85rem 1rem", border: "1px solid var(--border-color)", borderRadius: "10px", background: enrolled ? "#f0fdf4" : "#fafafa", transition: "all 0.2s" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                          <BookOpen size={16} color={enrolled ? "#16a34a" : "var(--text-muted)"} />
                          <div>
                            <div style={{ fontWeight: 600, fontSize: "0.88rem", color: "var(--navy)" }}>{d.title}</div>
                            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{d.program_type === "curso" ? "Curso" : "Diplomado"}</div>
                          </div>
                        </div>
                        <button onClick={() => handleToggleEnroll(d.id)} style={{
                          padding: "0.35rem 0.85rem", borderRadius: "20px", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.75rem",
                          background: enrolled ? "#16a34a" : "var(--border-color)",
                          color: enrolled ? "white" : "var(--text-muted)", transition: "all 0.2s"
                        }}>
                          {enrolled ? "Inscrito" : "No inscrito"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Drawer de Profesor ──────────────────────────────────────
function TeacherDrawer({ isOpen, onClose, teacher, onRefresh, onDeleteRequest, onResendRequest }) {
  const [activeTab, setActiveTab] = useState("perfil");
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [bio, setBio] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [programs, setPrograms] = useState([]);
  const [assignedPrograms, setAssignedPrograms] = useState([]);

  useEffect(() => {
    if (isOpen && teacher) {
      setActiveTab("perfil");
      setName(teacher.full_name || "");
      setArea(teacher.area || "");
      setBio(teacher.bio || "");
      setSuccess(""); setError("");
      fetchPrograms();
    }
  }, [isOpen, teacher]);

  const fetchPrograms = async () => {
    if (!teacher) return;
    const { data: pData } = await supabase.from("diploma_programs").select("id, title, program_type");
    const { data: eData } = await supabase.from("enrollments").select("program_id").eq("student_id", teacher.id);
    setPrograms(pData || []);
    setAssignedPrograms(eData ? eData.map(e => e.program_id) : []);
  };

  const handleToggleProgram = async (programId) => {
    const isAssigned = assignedPrograms.includes(programId);
    if (isAssigned) {
      await supabase.from("enrollments").delete().eq("student_id", teacher.id).eq("program_id", programId);
      setAssignedPrograms(prev => prev.filter(id => id !== programId));
    } else {
      await supabase.from("enrollments").insert([{ student_id: teacher.id, program_id: programId }]);
      setAssignedPrograms(prev => [...prev, programId]);
    }
    onRefresh?.();
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");
    setSubmitting(true);
    try {
      await supabase.from("users_profile").update({ full_name: name }).eq("id", teacher.id);
      if (teacher.teacher_profile_id) {
        await supabase.from("teacher_profiles").update({ name, area, bio }).eq("id", teacher.teacher_profile_id);
      }
      setSuccess("Perfil actualizado.");
      onRefresh?.();
      setTimeout(() => setSuccess(""), 2500);
    } catch (err) { setError(err.message); }
    finally { setSubmitting(false); }
  };

  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState("");

  const handleResendInvite = async () => {
    if (!window.confirm(`¿Reenviar la invitación a ${teacher.email}? El enlace anterior quedará inválido y se generará uno nuevo válido por 24 horas.`)) return;
    setResending(true);
    setResendMsg("");
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("invite-user", {
        body: { email: teacher.email, full_name: teacher.full_name, role: teacher.role, area: teacher.area, bio: teacher.bio }
      });
      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(data.error);
      setResendMsg(data?.resent ? "Invitación reenviada con éxito (válida por 24 horas)." : "Nueva invitación enviada.");
      setTimeout(() => setResendMsg(""), 3500);
      onRefresh?.();
    } catch (err) {
      setResendMsg("Error: " + (err.message || "No se pudo reenviar."));
    } finally {
      setResending(false);
    }
  };

  if (!isOpen || !teacher) return null;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000 }} />
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: "560px", maxWidth: "95vw",
        background: "white", zIndex: 1001, display: "flex", flexDirection: "column",
        boxShadow: "-4px 0 24px rgba(0,0,0,0.15)", animation: "slideInRight 0.3s ease-out"
      }}>
        <div style={{ background: "linear-gradient(135deg, #1e3a5f 0%, var(--navy) 100%)", padding: "1.25rem 1.5rem", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 800, fontSize: "1.1rem" }}>
                {(teacher.full_name || "?")[0].toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.5)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Profesor</div>
                <div style={{ color: "white", fontWeight: 800, fontSize: "1.05rem" }}>{teacher.full_name}</div>
                <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.5)" }}>{teacher.area || teacher.email}</div>
              </div>
            </div>
            <button onClick={onClose} style={{ color: "rgba(255,255,255,0.6)", background: "none", border: "none", cursor: "pointer" }}><X size={22} /></button>
          </div>
          <div style={{ marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
              <AuthStatusBadge user={teacher} />
              {!teacher.is_active && (
                isInviteExpired(teacher) ? (
                  <button
                    onClick={() => onResendRequest ? onResendRequest(teacher) : handleResendInvite()}
                    disabled={resending}
                    style={{ fontSize: "0.72rem", color: "white", background: "#0284c7", border: "none", borderRadius: "6px", padding: "0.25rem 0.65rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.3rem", fontWeight: 700 }}
                  >
                    <RefreshCw size={10} className={resending ? "spin" : ""} /> {resending ? "Reenviando..." : "Reenviar invitación"}
                  </button>
                ) : (
                  <span style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.75)", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "6px", padding: "0.2rem 0.55rem" }}>
                    🕒 Enlace válido ({getInviteHoursRemaining(teacher)})
                  </span>
                )
              )}
            </div>
            {resendMsg && (
              <span style={{ fontSize: "0.72rem", color: resendMsg.startsWith("Error") ? "#fca5a5" : "#86efac", fontWeight: 600 }}>
                {resendMsg}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: "flex", borderBottom: "2px solid var(--border-color)", background: "#fafafa", flexShrink: 0 }}>
          {[
            { id: "perfil", label: "Perfil Académico" },
            { id: "programas", label: "Programas Asignados" },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              flex: 1, padding: "0.85rem", border: "none", background: "none", cursor: "pointer",
              fontWeight: 600, fontSize: "0.82rem", borderBottom: activeTab === tab.id ? "2px solid var(--gold-dark)" : "2px solid transparent",
              color: activeTab === tab.id ? "var(--gold-dark)" : "var(--text-muted)", transition: "all 0.15s"
            }}>
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ padding: "1.5rem", flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
          {activeTab === "perfil" && (
            <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "1.1rem", flex: 1 }}>
              {error && <div style={{ background: "#fef2f2", color: "#b91c1c", padding: "0.7rem 1rem", borderRadius: "8px", fontSize: "0.84rem" }}>{error}</div>}
              {success && (
                <div style={{ background: "#f0fdf4", color: "#15803d", padding: "0.7rem 1rem", borderRadius: "8px", fontSize: "0.84rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <CheckCircle size={16} /> {success}
                </div>
              )}

              <div>
                <label style={{ display: "block", marginBottom: "4px", fontWeight: 600, fontSize: "0.84rem" }}>Nombre completo</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} style={{ width: "100%", padding: "0.6rem 0.8rem", border: "1px solid var(--border-color)", borderRadius: "8px" }} required />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "4px", fontWeight: 600, fontSize: "0.84rem" }}>Área / Especialidad</label>
                <input type="text" value={area} onChange={e => setArea(e.target.value)} style={{ width: "100%", padding: "0.6rem 0.8rem", border: "1px solid var(--border-color)", borderRadius: "8px" }} />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "4px", fontWeight: 600, fontSize: "0.84rem" }}>Biografía académica</label>
                <textarea value={bio} onChange={e => setBio(e.target.value)} style={{ width: "100%", padding: "0.6rem 0.8rem", border: "1px solid var(--border-color)", borderRadius: "8px", minHeight: "100px" }} />
              </div>

              <div style={{ marginTop: "auto", paddingTop: "1.5rem", borderTop: "1px solid #E2E8F0", display: "flex", justifyContent: teacher.is_active === false ? "space-between" : "flex-end", alignItems: "center" }}>
                {teacher.is_active === false && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onDeleteRequest?.(teacher);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem",
                      background: "none",
                      border: "none",
                      color: "#dc2626",
                      fontSize: "0.82rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      padding: "0.4rem 0.6rem",
                      borderRadius: "6px"
                    }}
                    onMouseOver={e => e.currentTarget.style.background = "#fef2f2"}
                    onMouseOut={e => e.currentTarget.style.background = "none"}
                  >
                    <Trash2 size={14} /> Eliminar profesor
                  </button>
                )}

                <button type="submit" disabled={submitting} style={{ padding: "0.65rem 1.5rem", borderRadius: "8px", border: "none", background: "var(--navy)", color: "white", fontWeight: 700, cursor: "pointer" }}>
                  {submitting ? "Guardando..." : "Guardar Cambios"}
                </button>
              </div>
            </form>
          )}

          {activeTab === "programas" && (
            <div>
              <p style={{ color: "var(--text-muted)", fontSize: "0.84rem", marginBottom: "1rem" }}>
                Asigna o desasigna al profesor de los programas académicos disponibles:
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                {programs.map(p => {
                  const assigned = assignedPrograms.includes(p.id);
                  return (
                    <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.85rem 1rem", border: "1px solid var(--border-color)", borderRadius: "10px", background: assigned ? "#eff6ff" : "#fafafa", transition: "all 0.2s" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <GraduationCap size={16} color={assigned ? "#1d4ed8" : "var(--text-muted)"} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: "0.88rem", color: "var(--navy)" }}>{p.title}</div>
                          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{p.program_type === "curso" ? "Curso" : "Diplomado"}</div>
                        </div>
                      </div>
                      <button onClick={() => handleToggleProgram(p.id)} style={{
                        padding: "0.35rem 0.85rem", borderRadius: "20px", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.75rem",
                        background: assigned ? "#1d4ed8" : "var(--border-color)",
                        color: assigned ? "white" : "var(--text-muted)", transition: "all 0.2s"
                      }}>
                        {assigned ? "Asignado" : "Sin asignar"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────
export default function UserManagement() {
  const { currentUser } = useAuth();
  const roleAuth = currentUser?.role;

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewRole, setViewRole] = useState("student");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [drawerUser, setDrawerUser] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmResend, setConfirmResend] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const [resendingUserId, setResendingUserId] = useState(null);
  const [globalToast, setGlobalToast] = useState(null);

  const handleResendInviteDirect = (user) => {
    setConfirmResend(user);
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const [
        { data: uProfiles },
        { data: tProfiles },
        { data: allEnrollments }
      ] = await Promise.all([
        supabase.from("users_profile").select("*").order("created_at", { ascending: false }),
        supabase.from("teacher_profiles").select("*"),
        supabase.from("enrollments").select("student_id, program_id, diploma_programs(id, title, program_type)")
      ]);

      const teacherMap = new Map();
      if (tProfiles) tProfiles.forEach(tp => { if (tp.user_id) teacherMap.set(String(tp.user_id), tp); });

      const userProgramsMap = new Map();
      if (allEnrollments) {
        allEnrollments.forEach(enr => {
          if (enr.student_id && enr.diploma_programs) {
            const sid = String(enr.student_id);
            if (!userProgramsMap.has(sid)) userProgramsMap.set(sid, []);
            userProgramsMap.get(sid).push(enr.diploma_programs);
          }
        });
      }

      const enriched = (uProfiles || []).map(u => {
        const tp = teacherMap.get(String(u.id)) || teacherMap.get(String(u.auth_user_id));
        const programs = userProgramsMap.get(String(u.id)) || [];
        return {
          ...u,
          area: tp?.area || "",
          bio: tp?.bio || "",
          photo_url: tp?.photo_url || tp?.photo || "",
          teacher_profile_id: tp?.id || null,
          phone: u.phone || "—",
          country: u.country || "",
          assigned_programs: programs,
        };
      });
      setUsers(enriched);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (roleAuth === "admin") fetchUsers(); }, [roleAuth, fetchUsers]);

  if (roleAuth !== "admin") return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: "1rem", color: "var(--text-muted)" }}>
      <ShieldAlert size={48} color="#dc2626" />
      <h2>Acceso Denegado</h2>
      <p>Esta vista es exclusiva para administradores.</p>
    </div>
  );

  const filtered = users.filter(u => {
    if (u.role !== viewRole) return false;
    if (!searchTerm) return true;
    const t = searchTerm.toLowerCase();
    const matchesProgram = (u.assigned_programs || []).some(p => p.title?.toLowerCase().includes(t));
    return u.full_name?.toLowerCase().includes(t) || u.email?.toLowerCase().includes(t) || u.area?.toLowerCase().includes(t) || matchesProgram;
  });

  const openDrawer = (user) => { setDrawerUser(user); setDrawerOpen(true); };

  const handleToggleStatus = async (user) => {
    setProcessingId(user.id);
    try {
      await supabase.from("users_profile").update({ is_active: !user.is_active }).eq("id", user.id);
      fetchUsers();
    } catch (err) { console.error(err); }
    finally { setProcessingId(null); setConfirmDeactivate(null); }
  };

  const counts = {
    student: users.filter(u => u.role === "student").length,
    teacher: users.filter(u => u.role === "teacher").length,
  };

  return (
    <div style={{ animation: "fadeSlideUp 0.35s ease-out" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.75rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 900, color: "var(--navy)", margin: 0 }}>Gestión de Usuarios</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.87rem", marginTop: "0.25rem" }}>Administra estudiantes y profesores de la plataforma.</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "var(--navy)", color: "white", border: "none", borderRadius: "10px", padding: "0.7rem 1.25rem", fontWeight: 700, fontSize: "0.9rem", cursor: "pointer", boxShadow: "0 4px 12px rgba(20,33,61,0.25)" }}
        >
          <UserPlus size={17} /> Nuevo Usuario
        </button>
      </div>

      {/* Global Toast / Feedback */}
      {globalToast && (
        <div style={{
          marginBottom: "1.5rem",
          padding: "0.9rem 1.25rem",
          borderRadius: "10px",
          background: globalToast.type === "success" ? "#f0fdf4" : "#fef2f2",
          color: globalToast.type === "success" ? "#15803d" : "#b91c1c",
          border: `1px solid ${globalToast.type === "success" ? "#bbf7d0" : "#fecaca"}`,
          display: "flex",
          alignItems: "center",
          gap: "0.65rem",
          fontWeight: 600,
          fontSize: "0.88rem",
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          animation: "fadeSlideUp 0.25s ease-out"
        }}>
          {globalToast.type === "success" ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          <span>{globalToast.text}</span>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1rem", marginBottom: "1.75rem" }}>
        {[
          { label: "Estudiantes", count: counts.student, icon: <Users size={20} />, role: "student", color: "#3730a3", bg: "#e0e7ff" },
          { label: "Profesores", count: counts.teacher, icon: <GraduationCap size={20} />, role: "teacher", color: "#065f46", bg: "#d1fae5" },
        ].map(stat => (
          <div key={stat.role} onClick={() => setViewRole(stat.role)} style={{
            background: "white", borderRadius: "12px", padding: "1.25rem 1.5rem", border: viewRole === stat.role ? "2px solid var(--gold-dark)" : "1px solid var(--border-color)",
            cursor: "pointer", transition: "all 0.2s", boxShadow: viewRole === stat.role ? "0 4px 12px rgba(252,163,17,0.15)" : "var(--shadow-sm)"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div style={{ width: 40, height: 40, borderRadius: "10px", background: stat.bg, display: "flex", alignItems: "center", justifyContent: "center", color: stat.color }}>
                {stat.icon}
              </div>
              <div>
                <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "var(--navy)", lineHeight: 1 }}>{stat.count}</div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 500 }}>{stat.label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs + Search */}
      <div style={{ background: "white", borderRadius: "12px", border: "1px solid var(--border-color)", overflow: "hidden", boxShadow: "var(--shadow-sm)", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem 1.5rem", borderBottom: "1px solid var(--border-color)" }}>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {[
              { id: "student", label: "Estudiantes", count: counts.student },
              { id: "teacher", label: "Profesores", count: counts.teacher },
            ].map(tab => (
              <button key={tab.id} onClick={() => setViewRole(tab.id)} style={{
                padding: "0.5rem 1rem", borderRadius: "8px", border: "none", cursor: "pointer", fontWeight: 600, fontSize: "0.84rem",
                background: viewRole === tab.id ? "var(--gold-subtle)" : "transparent",
                color: viewRole === tab.id ? "var(--gold-dark)" : "var(--text-muted)", transition: "all 0.15s"
              }}>
                {tab.label} <span style={{ fontSize: "0.75rem", background: viewRole === tab.id ? "var(--gold-dark)" : "#e2e8f0", color: viewRole === tab.id ? "white" : "var(--text-muted)", borderRadius: "10px", padding: "0.1rem 0.45rem", marginLeft: "0.3rem", fontWeight: 700 }}>{tab.count}</span>
              </button>
            ))}
          </div>
          <input
            type="text" placeholder={viewRole === "student" ? "Buscar estudiante..." : "Buscar profesor..."}
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            style={{ padding: "0.5rem 1rem", border: "1px solid var(--border-color)", borderRadius: "8px", fontSize: "0.84rem", minWidth: "220px" }}
          />
        </div>

        {/* TABLE */}
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{viewRole === "teacher" ? "Profesor" : "Estudiante"}</th>
                {viewRole === "teacher" && <th>Área</th>}
                <th>{viewRole === "teacher" ? "Programas Asignados" : "Programas Inscritos"}</th>
                <th>Estado</th>
                <th>Registro</th>
                <th style={{ textAlign: "center" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={viewRole === "teacher" ? 6 : 5} style={{ textAlign: "center", color: "var(--text-muted)", padding: "2.5rem" }}>Cargando usuarios...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={viewRole === "teacher" ? 6 : 5} style={{ textAlign: "center", color: "var(--text-muted)", padding: "2.5rem" }}>No se encontraron {viewRole === "student" ? "estudiantes" : "profesores"}.</td></tr>
              ) : filtered.map(u => (
                <tr key={u.id} style={{ transition: "background 0.15s" }}>
                  <td>
                    <div className="user-cell">
                      {u.photo_url ? (
                        <img src={u.photo_url} alt={u.full_name} style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                      ) : (
                        <Initials name={u.full_name} size={36} />
                      )}
                      <div>
                        <div className="user-name">{u.full_name}</div>
                        <div className="user-email">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  {viewRole === "teacher" && <td><span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{u.area || "—"}</span></td>}
                  <td>
                    {u.assigned_programs && u.assigned_programs.length > 0 ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", maxWidth: "260px" }}>
                        {u.assigned_programs.map(p => (
                          <span
                            key={p.id}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "0.3rem",
                              padding: "0.2rem 0.55rem",
                              borderRadius: "6px",
                              fontSize: "0.72rem",
                              fontWeight: 600,
                              background: "rgba(20, 33, 61, 0.06)",
                              color: "var(--navy)",
                              border: "1px solid rgba(20, 33, 61, 0.12)",
                              lineHeight: 1.2
                            }}
                          >
                            <GraduationCap size={12} color="var(--gold-dark)" style={{ flexShrink: 0 }} />
                            <span>{p.title}</span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ fontSize: "0.76rem", color: "var(--text-muted)", fontStyle: "italic" }}>
                        Sin programas
                      </span>
                    )}
                  </td>
                  <td><AuthStatusBadge user={u} /></td>
                  <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{new Date(u.created_at).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })}</td>
                  <td>
                    <div style={{ display: "flex", gap: "0.4rem", justifyContent: "center", alignItems: "center" }}>
                      <button onClick={() => openDrawer(u)} title="Editar" style={{ display: "flex", alignItems: "center", gap: "0.25rem", padding: "0.3rem 0.65rem", background: "var(--navy)", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.75rem", fontWeight: 600 }}>
                        <Pencil size={12} /> Editar
                      </button>
                      {u.is_active === false && isInviteExpired(u) && (
                        <button
                          onClick={() => handleResendInviteDirect(u)}
                          disabled={resendingUserId === u.id}
                          title="Reenviar correo de invitación (el anterior ya expiró tras 24 horas)"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.25rem",
                            padding: "0.3rem 0.6rem",
                            background: "#f0f9ff",
                            color: "#0369a1",
                            border: "1px solid #bae6fd",
                            borderRadius: "6px",
                            cursor: resendingUserId === u.id ? "not-allowed" : "pointer",
                            fontSize: "0.72rem",
                            fontWeight: 700
                          }}
                        >
                          <RefreshCw size={11} className={resendingUserId === u.id ? "spin" : ""} />
                          {resendingUserId === u.id ? "Enviando..." : "Reenviar"}
                        </button>
                      )}
                      {u.is_active ? (
                        <button
                          onClick={() => setConfirmDeactivate(u)}
                          title="Suspender acceso a la plataforma"
                          style={{ padding: "0.3rem 0.6rem", background: "#fffbeb", color: "#b45309", border: "1px solid #fde68a", borderRadius: "6px", cursor: "pointer", fontSize: "0.72rem", fontWeight: 700 }}
                        >
                          Desactivar
                        </button>
                      ) : (
                        !isInvitation(u) && (
                          <button
                            onClick={() => setConfirmDeactivate(u)}
                            title="Reactivar acceso a la plataforma"
                            style={{ padding: "0.3rem 0.6rem", background: "#f0fdf4", color: "#16a34a", border: "1px solid #86efac", borderRadius: "6px", cursor: "pointer", fontSize: "0.72rem", fontWeight: 700 }}
                          >
                            Activar
                          </button>
                        )
                      )}
                      {u.is_active === false && (
                        <button
                          onClick={() => setConfirmDelete(u)}
                          title="Eliminar usuario definitivamente"
                          style={{ display: "flex", alignItems: "center", gap: "0.25rem", padding: "0.3rem 0.6rem", background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: "6px", cursor: "pointer", fontSize: "0.72rem", fontWeight: 700 }}
                        >
                          <Trash2 size={12} /> Eliminar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* DRAWERS */}
      {viewRole === "student" ? (
        <StudentDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} student={drawerUser} onRefresh={fetchUsers} onDeleteRequest={setConfirmDelete} onResendRequest={setConfirmResend} />
      ) : (
        <TeacherDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} teacher={drawerUser} onRefresh={fetchUsers} onDeleteRequest={setConfirmDelete} onResendRequest={setConfirmResend} />
      )}

      {/* CREATE MODAL */}
      <CreateUserModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} onSuccess={fetchUsers} />

      {/* RESEND INVITE MODAL (PREMIUM LIATER) */}
      <ResendInviteModal
        isOpen={!!confirmResend}
        onClose={() => setConfirmResend(null)}
        user={confirmResend}
        onSuccess={() => {
          fetchUsers();
          setGlobalToast({ type: "success", text: `Invitación reenviada a ${confirmResend?.email}. Válida por 24 horas.` });
          setTimeout(() => setGlobalToast(null), 4500);
        }}
      />

      {/* DELETE MODAL (SEGURO) */}
      <DeleteUserModal isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)} user={confirmDelete} onSuccess={fetchUsers} />

      {/* CONFIRM DEACTIVATE */}
      {confirmDeactivate && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1200 }}>
          <div style={{ background: "white", borderRadius: "16px", padding: "1.75rem", maxWidth: "400px", width: "100%", boxShadow: "0 24px 48px rgba(0,0,0,0.2)" }}>
            <h3 style={{ margin: "0 0 0.75rem 0", fontWeight: 800 }}>
              {confirmDeactivate.is_active !== false ? "Desactivar Usuario" : "Reactivar Usuario"}
            </h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
              {confirmDeactivate.is_active !== false
                ? `Se ocultará "${confirmDeactivate.full_name}" de las listas activas. Podrás reactivarlo después.`
                : `Se reactivará la cuenta de "${confirmDeactivate.full_name}".`}
            </p>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "1.25rem" }}>
              <button onClick={() => setConfirmDeactivate(null)} style={{ padding: "0.6rem 1.25rem", border: "1px solid var(--border-color)", borderRadius: "8px", background: "#f8fafc", cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button onClick={() => handleToggleStatus(confirmDeactivate)} disabled={processingId === confirmDeactivate.id} style={{ padding: "0.6rem 1.25rem", border: "none", borderRadius: "8px", background: confirmDeactivate.is_active !== false ? "#d97706" : "#16a34a", color: "white", cursor: "pointer", fontWeight: 700 }}>
                {processingId === confirmDeactivate.id ? "Procesando..." : (confirmDeactivate.is_active !== false ? "Desactivar" : "Activar")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
