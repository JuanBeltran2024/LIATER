import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { safeJsonParse, safeSetItem } from '@/utils/storageUtils';
import {
  User, Mail, Phone, Globe, Camera, Shield, Save,
  BookOpen, Lock, CheckCircle2, Award, Briefcase,
  LockKeyhole, MailCheck, Eye, EyeOff, X, GraduationCap
} from 'lucide-react';

export default function Profile() {
  const { currentUser } = useAuth();
  const role = currentUser?.role;
  const isTeacher = role === 'teacher';

  const [activeTab, setActiveTab] = useState('personal');

  // Datos personales (users_profile)
  const [personalData, setPersonalData] = useState({
    full_name: currentUser?.name || '',
    email: currentUser?.email || '',
    phone: '',
    country: 'Colombia',
    profession: '',
    institution: '',
    bio: '',
    avatar_url: ''
  });

  const [initialPersonalData, setInitialPersonalData] = useState({
    full_name: currentUser?.name || '',
    email: currentUser?.email || '',
    phone: '',
    country: 'Colombia',
    profession: '',
    institution: '',
    bio: '',
    avatar_url: ''
  });

  const [studentStats, setStudentStats] = useState({
    enrolledCount: 0,
    completedQuizzes: 0,
    avgProgress: 0
  });

  const hasUnsavedPersonalChanges = 
    personalData.full_name !== initialPersonalData.full_name ||
    personalData.phone !== initialPersonalData.phone ||
    personalData.country !== initialPersonalData.country ||
    personalData.profession !== initialPersonalData.profession ||
    personalData.institution !== initialPersonalData.institution ||
    personalData.bio !== initialPersonalData.bio;

  // Datos académicos (teacher_profiles)
  const [academicData, setAcademicData] = useState({
    area: '',
    bio: '',
    title_role: 'Profesor Titular',
    experience: ''
  });

  const [initialAcademicData, setInitialAcademicData] = useState({
    area: '',
    bio: '',
    title_role: 'Profesor Titular',
    experience: ''
  });

  const hasUnsavedAcademicChanges = 
    academicData.area !== initialAcademicData.area ||
    academicData.title_role !== initialAcademicData.title_role ||
    academicData.bio !== initialAcademicData.bio ||
    academicData.experience !== initialAcademicData.experience;

  // Programas en los que participa
  const [myPrograms, setMyPrograms] = useState([]);
  
  // Estado para la sección de Seguridad
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordStep, setPasswordStep] = useState('initial'); // 'initial' | 'otp'
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  
  // Visibilidad de contraseñas
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  // Mensajes de error/éxito del modal
  const [modalError, setModalError] = useState('');
  const [modalSuccess, setModalSuccess] = useState('');
  const [securitySaving, setSecuritySaving] = useState(false);

  // Verificación de correo Supabase Auth
  const [isEmailVerified, setIsEmailVerified] = useState(true);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    async function checkEmailVerification() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setIsEmailVerified(!!(user.email_confirmed_at || user.confirmed_at));
        }
      } catch (e) {
        console.error('Error al verificar estado de correo:', e);
      }
    }
    checkEmailVerification();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && showPasswordModal) {
        handleClosePasswordModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showPasswordModal]);

  useEffect(() => {
    async function loadProfileData() {
      if (!currentUser?.id) return;
      try {
        // 1. Cargar users_profile
        const { data: uProfile } = await supabase
          .from('users_profile')
          .select('*')
          .eq('id', currentUser.id)
          .maybeSingle();
          
        let phone = uProfile?.phone || '';
        let country = uProfile?.country || 'Colombia';

        // 2. Si es profesor, cargar teacher_profiles y diploma_programs
        if (isTeacher) {
          const userOrClause = currentUser?.auth_user_id 
            ? `user_id.eq.${currentUser.id},user_id.eq.${currentUser.auth_user_id}` 
            : `user_id.eq.${currentUser.id}`;

          const { data: tProfiles } = await supabase
            .from('teacher_profiles')
            .select('*')
            .or(userOrClause);

          const tProfile = tProfiles && tProfiles.length > 0 ? tProfiles[0] : null;

          if (tProfile) {
            let bioText = tProfile.bio || '';
            let expText = tProfile.experience || '';
            let roleText = tProfile.title_role || 'Profesor Titular';

            if (tProfile.phone) phone = tProfile.phone;
            if (tProfile.country) country = tProfile.country;

            if (bioText && typeof bioText === 'string' && bioText.trim().startsWith('{') && bioText.trim().endsWith('}')) {
              try {
                const parsed = JSON.parse(bioText);
                if (parsed && typeof parsed === 'object') {
                  bioText = parsed.bio !== undefined ? parsed.bio : bioText;
                  expText = parsed.experience !== undefined ? parsed.experience : expText;
                  roleText = parsed.title_role !== undefined ? parsed.title_role : roleText;
                  if (parsed.phone !== undefined && parsed.phone !== '') phone = parsed.phone;
                  if (parsed.country !== undefined && parsed.country !== '') country = parsed.country;
                }
              } catch (e) {
                // mantener texto plano
              }
            }

            const loadedData = {
              area: tProfile.area || '',
              bio: bioText,
              title_role: roleText,
              experience: expText
            };
            setAcademicData(loadedData);
            setInitialAcademicData(loadedData);
          }

          // Cargar programas
          const { data: progs } = await supabase
            .from('diploma_programs')
            .select('*')
            .order('title', { ascending: true });
          if (progs) setMyPrograms(progs);
        }

        // Cargar extensión de perfil guardada localmente si existe
        const extendedLocal = safeJsonParse(`user_extended_profile_${currentUser?.id}`, {});

        // Cargar estadísticas si es estudiante
        if (!isTeacher && currentUser?.id) {
          try {
            const { data: enrollments } = await supabase
              .from('enrollments')
              .select('*, diploma_programs(*)')
              .eq('student_id', currentUser.id);

            if (enrollments) {
              const total = enrollments.length;
              const totalProgress = enrollments.reduce((acc, curr) => acc + (curr.progress || 0), 0);
              const avg = total > 0 ? Math.round(totalProgress / total) : 0;
              
              const completedQuizzesCount = enrollments.reduce((acc, curr) => {
                return acc + (curr.progress >= 50 ? 2 : (curr.progress > 0 ? 1 : 0));
              }, 0);

              setStudentStats({
                enrolledCount: total,
                completedQuizzes: completedQuizzesCount,
                avgProgress: avg
              });
            }
          } catch (err) {
            console.warn('Advertencia al cargar estadísticas del estudiante:', err);
          }
        }

        const loadedPersonal = {
          full_name: uProfile?.full_name || currentUser.name || '',
          email: currentUser.email || '',
          phone: uProfile?.phone || phone || extendedLocal.phone || '',
          country: uProfile?.country || country || extendedLocal.country || 'Colombia',
          profession: uProfile?.profession || extendedLocal.profession || '',
          institution: uProfile?.institution || extendedLocal.institution || '',
          bio: uProfile?.bio || extendedLocal.bio || '',
          avatar_url: uProfile?.avatar_url || ''
        };
        setPersonalData(loadedPersonal);
        setInitialPersonalData(loadedPersonal);
      } catch (err) {
        console.error('Error al cargar perfil:', err);
      }
    }
    loadProfileData();
  }, [currentUser?.id, currentUser?.auth_user_id, isTeacher]);

  const handleTabChange = (newTab) => {
    if (activeTab === 'personal' && hasUnsavedPersonalChanges) {
      const confirmLeave = window.confirm('Tienes cambios sin guardar. ¿Deseas salir de esta sección?');
      if (!confirmLeave) return;
    }
    if (activeTab === 'academic' && hasUnsavedAcademicChanges) {
      const confirmLeave = window.confirm('Tienes cambios sin guardar en tu perfil académico. ¿Deseas salir de esta sección?');
      if (!confirmLeave) return;
    }
    setActiveTab(newTab);
  };

  const handleSavePersonal = async (e) => {
    e.preventDefault();
    if (!hasUnsavedPersonalChanges || saving) return;
    setSaving(true);
    setMsg({ type: '', text: '' });
    try {
      // 1. Intentar actualizar users_profile con todos los campos
      const updatePayload = {
        full_name: personalData.full_name,
        phone: personalData.phone,
        country: personalData.country,
        profession: personalData.profession,
        institution: personalData.institution,
        bio: personalData.bio
      };

      // Guardar respaldado localmente para garantía inmediata
      safeSetItem(`user_extended_profile_${currentUser.id}`, {
        phone: personalData.phone,
        country: personalData.country,
        profession: personalData.profession,
        institution: personalData.institution,
        bio: personalData.bio
      });

      let { error: uErr } = await supabase
        .from('users_profile')
        .update(updatePayload)
        .eq('id', currentUser.id);

      if (uErr) {
        // Fallback si la tabla users_profile no tiene algunas columnas en Postgres
        const { error: fallbackErr } = await supabase
          .from('users_profile')
          .update({
            full_name: personalData.full_name
          })
          .eq('id', currentUser.id);

        if (fallbackErr) throw fallbackErr;
      }

      // 2. Si el usuario es profesor, sincronizar name, phone y country en teacher_profiles
      if (isTeacher) {
        const userOrClause = currentUser?.auth_user_id 
          ? `user_id.eq.${currentUser.id},user_id.eq.${currentUser.auth_user_id}` 
          : `user_id.eq.${currentUser.id}`;

        const { data: tProfiles } = await supabase
          .from('teacher_profiles')
          .select('*')
          .or(userOrClause);

        const tProfile = tProfiles && tProfiles.length > 0 ? tProfiles[0] : null;

        let bioObj = {
          bio: academicData.bio,
          experience: academicData.experience,
          title_role: academicData.title_role,
          phone: personalData.phone,
          country: personalData.country
        };

        if (tProfile && tProfile.bio && tProfile.bio.trim().startsWith('{')) {
          try {
            const parsed = JSON.parse(tProfile.bio);
            if (parsed && typeof parsed === 'object') {
              bioObj = { ...parsed, phone: personalData.phone, country: personalData.country };
            }
          } catch (jsonErr) {
            console.warn('[Profile] Bio no es JSON estructurado válido, conservando texto plano:', jsonErr);
          }
        }

        const bioPayload = JSON.stringify(bioObj);

        if (tProfile) {
          await supabase
            .from('teacher_profiles')
            .update({
              name: personalData.full_name,
              bio: bioPayload
            })
            .eq('id', tProfile.id);
        } else {
          await supabase
            .from('teacher_profiles')
            .insert({
              user_id: currentUser.id,
              name: personalData.full_name,
              bio: bioPayload
            });
        }
      }

      setInitialPersonalData({ ...personalData });
      setMsg({ type: 'success', text: 'Información personal actualizada.' });
    } catch (err) {
      console.error('Error al actualizar perfil personal:', err);
      setMsg({ type: 'error', text: 'No fue posible guardar los cambios. Inténtalo nuevamente.' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAcademic = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg({ type: '', text: '' });
    try {
      const teacherName = personalData.full_name || currentUser?.name || 'Profesor';

      // Serializar bio, experience y title_role en bio de forma JSON para garantizar almacenamiento
      const bioPayload = JSON.stringify({
        bio: academicData.bio,
        experience: academicData.experience,
        title_role: academicData.title_role
      });

      const userOrClause = currentUser?.auth_user_id 
        ? `user_id.eq.${currentUser.id},user_id.eq.${currentUser.auth_user_id}` 
        : `user_id.eq.${currentUser.id}`;

      const { data: existingProfiles } = await supabase
        .from('teacher_profiles')
        .select('*')
        .or(userOrClause);

      const tProfile = existingProfiles && existingProfiles.length > 0 ? existingProfiles[0] : null;

      const updateData = {
        name: teacherName,
        area: academicData.area,
        bio: bioPayload
      };

      if (tProfile) {
        const { error: updateErr } = await supabase
          .from('teacher_profiles')
          .update(updateData)
          .eq('id', tProfile.id);

        if (updateErr) throw updateErr;
      } else {
        const { error: insertErr } = await supabase
          .from('teacher_profiles')
          .insert({
            user_id: currentUser.id,
            ...updateData
          });

        if (insertErr) throw insertErr;
      }

      setInitialAcademicData({ ...academicData });
      setMsg({ type: 'success', text: 'Perfil académico actualizado.' });
    } catch (err) {
      console.error('Error al guardar perfil académico:', err);
      setMsg({ type: 'error', text: 'No fue posible guardar los cambios. Inténtalo nuevamente.' });
    } finally {
      setSaving(false);
    }
  };

  const handleOpenPasswordModal = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setOtpCode('');
    setModalError('');
    setModalSuccess('');
    setPasswordStep('initial');
    setShowPasswordModal(true);
  };

  const handleClosePasswordModal = () => {
    setShowPasswordModal(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setOtpCode('');
    setModalError('');
    setModalSuccess('');
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setModalError('');
    setModalSuccess('');

    if (!currentPassword) {
      setModalError('La contraseña actual es obligatoria.');
      return;
    }
    if (!newPassword) {
      setModalError('La nueva contraseña es obligatoria.');
      return;
    }
    if (newPassword.length < 6) {
      setModalError('La nueva contraseña no cumple los requisitos de seguridad (mínimo 6 caracteres).');
      return;
    }
    if (newPassword !== confirmPassword) {
      setModalError('Las contraseñas no coinciden.');
      return;
    }
    if (newPassword === currentPassword) {
      setModalError('La nueva contraseña debe ser diferente a la contraseña actual.');
      return;
    }

    setSecuritySaving(true);

    try {
      // 1. Verificar la contraseña actual intentando autenticación segura con Supabase
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: currentUser?.email,
        password: currentPassword
      });

      if (signInErr) {
        setModalError('La contraseña actual no es correcta.');
        setSecuritySaving(false);
        return;
      }

      // 2. Si se requiere paso de OTP / Reautenticación por Supabase
      if (passwordStep === 'otp') {
        if (!otpCode.trim()) {
          setModalError('Ingresa el código de verificación enviado a tu correo.');
          setSecuritySaving(false);
          return;
        }

        const { error: otpErr } = await supabase.auth.reauthenticate({
          nonce: otpCode.trim()
        });

        if (otpErr) {
          setModalError('El código de verificación es inválido o ha expirado.');
          setSecuritySaving(false);
          return;
        }
      }

      // 3. Actualizar contraseña mediante Supabase Auth
      const { error: updateErr } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateErr) {
        if (updateErr.message?.toLowerCase().includes('reauthenticate') || updateErr.status === 429) {
          try {
            await supabase.auth.reauthenticate();
            setPasswordStep('otp');
            setModalError('Por seguridad, enviamos un código a tu correo. Ingrésalo para confirmar.');
          } catch (reauthErr) {
            setModalError('No fue posible iniciar la verificación por correo. Inténtalo más tarde.');
          }
          setSecuritySaving(false);
          return;
        }
        throw updateErr;
      }

      // Éxito
      setModalSuccess('Contraseña actualizada correctamente.');
      setMsg({ type: 'success', text: 'Contraseña actualizada correctamente.' });

      setTimeout(() => {
        handleClosePasswordModal();
      }, 1200);

    } catch (err) {
      console.error('Error al actualizar contraseña:', err);
      setModalError('No fue posible actualizar la contraseña. Inténtalo nuevamente.');
    } finally {
      setSecuritySaving(false);
    }
  };

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
        marginBottom: '1.75rem'
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
              {role === 'admin' 
                ? '🏛️ CONFIGURACIÓN DE CUENTA · PANEL ADMINISTRADOR UNAL' 
                : role === 'teacher' 
                  ? '🏛️ CONFIGURACIÓN DE CUENTA · PORTAL DOCENTE UNAL' 
                  : '🏛️ CONFIGURACIÓN DE CUENTA · PORTAL ESTUDIANTE UNAL'}
            </span>
            <span style={{
              background: isEmailVerified ? '#DCFCE7' : '#FEF3C7',
              color: isEmailVerified ? '#007A2E' : '#92400E',
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '10px'
            }}>
              {isEmailVerified ? '● Cuenta Verificada' : '● Verificación Pendiente'}
            </span>
          </div>

          <h1 style={{ color: 'var(--navy, #14213D)', fontSize: '1.65rem', fontWeight: 800, margin: 0, lineHeight: 1.25 }}>
            {role === 'admin' 
              ? 'Mi Perfil de Administrador' 
              : role === 'teacher' 
                ? 'Mi Perfil Docente' 
                : 'Mi Perfil de Estudiante'}
          </h1>
          <p style={{ color: 'var(--text-muted, #64748B)', fontSize: '0.9rem', margin: '6px 0 0 0', fontWeight: 400, maxWidth: '650px', lineHeight: 1.45 }}>
            {role === 'teacher'
              ? 'Actualiza tus datos de contacto, personaliza tu presentación pública académica y administra la seguridad de tu cuenta.'
              : role === 'admin'
                ? 'Gestiona tus datos de acceso, credenciales institucionales y seguridad de la cuenta administrativa.'
                : 'Actualiza tus datos personales, información de contacto y administra la seguridad de tu cuenta.'}
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
            <Shield size={18} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748B)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Rol en el Portal
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--navy, #14213D)' }}>
              {role === 'admin' ? 'Administrador' : role === 'teacher' ? 'Docente Titular' : 'Estudiante'}
            </div>
          </div>
        </div>
      </div>

      {msg.text && (
        <div style={{
          padding: '0.85rem 1.25rem',
          borderRadius: '10px',
          marginBottom: '1.5rem',
          fontSize: '0.88rem',
          fontWeight: 700,
          background: msg.type === 'error' ? '#FEF2F2' : '#F0FDF4',
          color: msg.type === 'error' ? '#DC2626' : '#16A34A',
          border: `1px solid ${msg.type === 'error' ? '#FCA5A5' : '#BBF7D0'}`,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          {msg.text}
        </div>
      )}

      {/* ── TARJETA PRINCIPAL DE IDENTIDAD DOCENTE (SOLO PROFESORES) ── */}
      {isTeacher && (
        <div style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          padding: '1.5rem 1.75rem',
          border: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1.5rem',
          flexWrap: 'wrap',
          marginBottom: '1.75rem',
          boxShadow: '0 1px 3px rgba(20, 33, 61, 0.03)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
            <div style={{
              width: '76px',
              height: '76px',
              borderRadius: '50%',
              background: 'var(--navy, #14213D)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--gold, #FCA311)',
              fontWeight: 800,
              fontSize: '2rem',
              border: '3px solid #FFFFFF',
              boxShadow: '0 4px 14px rgba(20, 33, 61, 0.15)',
              flexShrink: 0
            }}>
              {personalData.full_name ? personalData.full_name.charAt(0).toUpperCase() : 'P'}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--navy, #14213D)', margin: 0 }}>
                  {personalData.full_name || 'Profesor LIATER'}
                </h2>
                <span style={{
                  background: '#DCFCE7',
                  color: '#007A2E',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  padding: '3px 9px',
                  borderRadius: '9999px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#007A2E' }}></span>
                  Docente UNAL Activo
                </span>
              </div>
              <p style={{ color: 'var(--text-muted, #64748B)', display: 'flex', alignItems: 'center', gap: '0.45rem', margin: '4px 0 0 0', fontSize: '0.86rem' }}>
                <Mail size={14} /> {personalData.email}
              </p>
              {academicData.title_role && (
                <div style={{ fontSize: '0.8rem', color: 'var(--gold-dark, #b45309)', fontWeight: 700, marginTop: '4px' }}>
                  🏛️ {academicData.title_role} {academicData.area ? `· ${academicData.area}` : ''}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setActiveTab('academic')}
              style={{
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                color: 'var(--navy, #14213D)',
                padding: '0.45rem 0.95rem',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                transition: 'all 0.15s ease'
              }}
              onMouseOver={e => e.currentTarget.style.borderColor = 'var(--gold, #FCA311)'}
              onMouseOut={e => e.currentTarget.style.borderColor = '#E2E8F0'}
            >
              <Eye size={14} /> Vista Pública
            </button>
          </div>
        </div>
      )}

      {/* SI ES PROFESOR, PESTAÑAS DEDICADAS */}
      {isTeacher ? (
        <div>
          {/* BOTONES DE PESTAÑAS DEL PERFIL */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.75rem', flexWrap: 'wrap' }}>
            {[
              { id: 'personal', label: 'Perfil Personal', icon: User },
              { id: 'academic', label: 'Perfil Académico Público', icon: GraduationCap },
              { id: 'security', label: 'Seguridad de la Cuenta', icon: LockKeyhole }
            ].map(tab => {
              const isActive = activeTab === tab.id;
              const IconComp = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabChange(tab.id)}
                  style={{
                    padding: '0.55rem 1.15rem',
                    borderRadius: '9999px',
                    border: isActive ? '1.5px solid var(--navy, #14213D)' : '1px solid #E2E8F0',
                    background: isActive ? 'var(--navy, #14213D)' : '#FFFFFF',
                    color: isActive ? '#FFFFFF' : 'var(--navy, #14213D)',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    boxShadow: isActive ? '0 3px 10px rgba(20,33,61,0.15)' : 'none',
                    transition: 'all 0.18s ease'
                  }}
                  onMouseOver={e => {
                    if (!isActive) {
                      e.currentTarget.style.borderColor = 'var(--gold, #FCA311)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }
                  }}
                  onMouseOut={e => {
                    if (!isActive) {
                      e.currentTarget.style.borderColor = '#E2E8F0';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }
                  }}
                >
                  <IconComp size={15} color={isActive ? 'var(--gold, #FCA311)' : 'currentColor'} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* CONTENIDO DE PESTAÑA: PERFIL PERSONAL */}
          {activeTab === 'personal' && (
            <form 
              onSubmit={handleSavePersonal} 
              style={{ 
                padding: '2rem', 
                background: '#FFFFFF', 
                border: '1px solid #E2E8F0', 
                borderRadius: '16px',
                display: 'flex', 
                flexDirection: 'column', 
                gap: '1.5rem',
                boxShadow: '0 1px 3px rgba(20, 33, 61, 0.03)'
              }}
            >
              {/* ENCABEZADO DE LA TARJETA */}
              <div style={{ borderBottom: '1px solid #F1F5F9', paddingBottom: '0.85rem' }}>
                <h3 style={{ fontSize: '1.2rem', color: 'var(--navy, #14213D)', fontWeight: 800, margin: 0 }}>
                  Datos Personales y de Contacto
                </h3>
                <p style={{ color: 'var(--text-muted, #64748B)', fontSize: '0.85rem', margin: '0.3rem 0 0 0' }}>
                  Administra tu información básica y preferencias de ubicación.
                </p>
              </div>
              
              {/* CUADRÍCULA DE 2 COLUMNAS (2X2) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '1.25rem' }}>
                
                {/* FILA 1, COLUMNA 1: NOMBRE COMPLETO */}
                <div>
                  <label htmlFor="fullNameInput" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--navy, #14213D)', marginBottom: '0.4rem' }}>
                    Nombre completo
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      id="fullNameInput"
                      type="text" 
                      value={personalData.full_name} 
                      onChange={e => setPersonalData({ ...personalData, full_name: e.target.value })} 
                      placeholder="Tu nombre completo"
                      style={{ width: '100%', padding: '0.75rem 0.75rem 0.75rem 2.4rem', borderRadius: '10px', border: '1px solid #E2E8F0', background: '#FFFFFF', fontSize: '0.9rem' }} 
                      required 
                    />
                    <User size={16} style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                  </div>
                </div>

                {/* FILA 1, COLUMNA 2: CORREO ELECTRÓNICO (READONLY) */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.4rem' }}>
                    <label htmlFor="emailInput" style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--navy, #14213D)' }}>
                      Correo institucional
                    </label>
                    <Lock size={12} color="#94A3B8" title="Campo protegido" />
                  </div>
                  <div style={{ position: 'relative' }}>
                    <input 
                      id="emailInput"
                      type="email" 
                      value={personalData.email} 
                      readOnly
                      style={{ 
                        width: '100%', 
                        padding: '0.75rem 0.75rem 0.75rem 2.4rem', 
                        borderRadius: '10px', 
                        border: '1px solid #E2E8F0', 
                        background: '#F8FAFC', 
                        color: '#64748B', 
                        cursor: 'not-allowed',
                        fontSize: '0.9rem',
                        userSelect: 'all'
                      }} 
                    />
                    <Lock size={15} style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                  </div>
                  <span style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-muted, #64748B)', marginTop: '0.35rem' }}>
                    El correo está asociado a tu autenticación institucional UNAL.
                  </span>
                </div>

                {/* FILA 2, COLUMNA 1: TELÉFONO */}
                <div>
                  <label htmlFor="phoneInput" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--navy, #14213D)', marginBottom: '0.4rem' }}>
                    Teléfono de contacto (opcional)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      id="phoneInput"
                      type="tel" 
                      value={personalData.phone} 
                      onChange={e => setPersonalData({ ...personalData, phone: e.target.value })} 
                      placeholder="+57 300 000 0000" 
                      style={{ width: '100%', padding: '0.75rem 0.75rem 0.75rem 2.4rem', borderRadius: '10px', border: '1px solid #E2E8F0', background: '#FFFFFF', fontSize: '0.9rem' }} 
                    />
                    <Phone size={15} style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                  </div>
                </div>

                {/* FILA 2, COLUMNA 2: PAÍS */}
                <div>
                  <label htmlFor="countrySelect" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--navy, #14213D)', marginBottom: '0.4rem' }}>
                    País de residencia
                  </label>
                  <div style={{ position: 'relative' }}>
                    <select 
                      id="countrySelect"
                      value={personalData.country} 
                      onChange={e => setPersonalData({ ...personalData, country: e.target.value })} 
                      style={{ width: '100%', padding: '0.75rem 0.75rem 0.75rem 2.4rem', borderRadius: '10px', border: '1px solid #E2E8F0', background: '#FFFFFF', fontSize: '0.9rem' }}
                    >
                      <option value="Colombia">Colombia</option>
                      <option value="México">México</option>
                      <option value="Perú">Perú</option>
                      <option value="Chile">Chile</option>
                      <option value="Argentina">Argentina</option>
                      <option value="España">España</option>
                      <option value="Otro">Otro</option>
                    </select>
                    <Globe size={15} style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                  </div>
                </div>

              </div>

              {/* FOOTER DE GUARDADO */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #F1F5F9', paddingTop: '1.25rem', marginTop: '0.5rem' }}>
                <button 
                  type="submit" 
                  disabled={saving || !hasUnsavedPersonalChanges} 
                  style={{ 
                    background: (saving || !hasUnsavedPersonalChanges) ? '#CBD5E1' : 'var(--navy, #14213D)', 
                    color: '#FFFFFF', 
                    border: 'none', 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: '0.5rem', 
                    padding: '0.65rem 1.5rem', 
                    fontWeight: 700,
                    borderRadius: '8px',
                    fontSize: '0.88rem',
                    cursor: (saving || !hasUnsavedPersonalChanges) ? 'not-allowed' : 'pointer',
                    transition: 'all 0.18s ease',
                    boxShadow: (saving || !hasUnsavedPersonalChanges) ? 'none' : '0 2px 8px rgba(20, 33, 61, 0.15)'
                  }}
                  onMouseOver={e => {
                    if (!saving && hasUnsavedPersonalChanges) e.currentTarget.style.background = '#000000';
                  }}
                  onMouseOut={e => {
                    if (!saving && hasUnsavedPersonalChanges) e.currentTarget.style.background = 'var(--navy, #14213D)';
                  }}
                >
                  <Save size={16} /> 
                  {saving ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          )}

          {/* CONTENIDO DE PESTAÑA: PERFIL ACADÉMICO PÚBLICO */}
          {activeTab === 'academic' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              
              {/* ALINEACIÓN EN DOS COLUMNAS (EDICIÓN 60% + VISTA PREVIA 40%) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '1.5rem', alignItems: 'start' }}>
                
                {/* COLUMNA IZQUIERDA: FORMULARIO DE EDICIÓN */}
                <form 
                  onSubmit={handleSaveAcademic} 
                  style={{ padding: '2rem', background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '1.25rem', boxShadow: '0 1px 3px rgba(20, 33, 61, 0.03)' }}
                >
                  <div style={{ borderBottom: '1px solid #F1F5F9', paddingBottom: '0.75rem' }}>
                    <h3 style={{ fontSize: '1.2rem', color: 'var(--navy, #14213D)', fontWeight: 800, margin: 0 }}>
                      Editar Perfil Académico
                    </h3>
                    <p style={{ color: 'var(--text-muted, #64748B)', fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>
                      Completa tu información profesional para presentar tu trayectoria a los estudiantes.
                    </p>
                  </div>

                  {/* PRIMERA FILA: ESPECIALIDAD Y CARGO */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                        <label htmlFor="areaInput" style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--navy, #14213D)' }}>
                          Especialidad o área
                        </label>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748B)' }}>
                          {academicData.area.length}/100
                        </span>
                      </div>
                      <input 
                        id="areaInput"
                        type="text" 
                        maxLength={100}
                        value={academicData.area} 
                        onChange={e => setAcademicData({ ...academicData, area: e.target.value })} 
                        placeholder="Ej. Iluminación y Eficiencia Energética" 
                        style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid #E2E8F0', fontSize: '0.9rem' }} 
                      />
                      <span style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-muted, #64748B)', marginTop: '0.3rem' }}>
                        Área principal de conocimiento o experiencia.
                      </span>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                        <label htmlFor="roleInput" style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--navy, #14213D)' }}>
                          Cargo institucional
                        </label>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748B)' }}>
                          {academicData.title_role.length}/80
                        </span>
                      </div>
                      <input 
                        id="roleInput"
                        type="text" 
                        maxLength={80}
                        value={academicData.title_role} 
                        onChange={e => setAcademicData({ ...academicData, title_role: e.target.value })} 
                        placeholder="Ej. Profesor Titular / Investigador" 
                        style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid #E2E8F0', fontSize: '0.9rem' }} 
                      />
                      <span style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-muted, #64748B)', marginTop: '0.3rem' }}>
                        Cargo visible en el aula virtual para los estudiantes.
                      </span>
                    </div>
                  </div>

                  {/* SEGUNDA SECCIÓN: BIOGRAFÍA CORTA */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                      <label htmlFor="bioInput" style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--navy, #14213D)' }}>
                        Biografía profesional
                      </label>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748B)' }}>
                        {academicData.bio.length}/400
                      </span>
                    </div>
                    <textarea 
                      id="bioInput"
                      rows={3} 
                      maxLength={400}
                      value={academicData.bio} 
                      onChange={e => setAcademicData({ ...academicData, bio: e.target.value })} 
                      placeholder="Resumen profesional de tu trayectoria académica..." 
                      style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid #E2E8F0', fontSize: '0.9rem', resize: 'vertical' }} 
                    />
                    <span style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-muted, #64748B)', marginTop: '0.3rem' }}>
                      Presentación breve sobre tu experiencia docente.
                    </span>
                  </div>

                  {/* TERCERA SECCIÓN: FORMACIÓN O EXPERIENCIA */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                      <label htmlFor="expInput" style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--navy, #14213D)' }}>
                        Formación académica y trayectoria
                      </label>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748B)' }}>
                        {academicData.experience.length}/800
                      </span>
                    </div>
                    <textarea 
                      id="expInput"
                      rows={4} 
                      maxLength={800}
                      value={academicData.experience} 
                      onChange={e => setAcademicData({ ...academicData, experience: e.target.value })} 
                      placeholder="Detalles sobre títulos universitarios, proyectos e investigaciones..." 
                      style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid #E2E8F0', fontSize: '0.9rem', resize: 'vertical' }} 
                    />
                    <span style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-muted, #64748B)', marginTop: '0.3rem' }}>
                      Estudios de posgrado, distinciones y certificaciones.
                    </span>
                  </div>

                  {/* BOTÓN DE GUARDADO */}
                  <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '0.5rem' }}>
                    <button 
                      type="submit" 
                      disabled={saving || !hasUnsavedAcademicChanges} 
                      style={{ 
                        background: (saving || !hasUnsavedAcademicChanges) ? '#CBD5E1' : 'var(--navy, #14213D)', 
                        color: '#FFFFFF', 
                        border: 'none', 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '0.5rem', 
                        padding: '0.65rem 1.5rem', 
                        fontWeight: 700,
                        borderRadius: '8px',
                        fontSize: '0.88rem',
                        cursor: (saving || !hasUnsavedAcademicChanges) ? 'not-allowed' : 'pointer',
                        transition: 'all 0.18s ease'
                      }}
                      onMouseOver={e => {
                        if (!saving && hasUnsavedAcademicChanges) e.currentTarget.style.background = '#000000';
                      }}
                      onMouseOut={e => {
                        if (!saving && hasUnsavedAcademicChanges) e.currentTarget.style.background = 'var(--navy, #14213D)';
                      }}
                    >
                      <Save size={16} /> 
                      {saving ? 'Guardando...' : 'Guardar perfil académico'}
                    </button>
                  </div>
                </form>

                {/* COLUMNA DERECHA: VISTA PREVIA PÚBLICA */}
                <div 
                  role="region" 
                  aria-label="Vista previa pública del perfil" 
                  style={{ 
                    padding: 0, 
                    background: '#FFFFFF', 
                    border: '1px solid #E2E8F0', 
                    borderRadius: '16px',
                    overflow: 'hidden',
                    display: 'flex', 
                    flexDirection: 'column', 
                    position: 'sticky',
                    top: '1rem',
                    boxShadow: '0 4px 14px rgba(20, 33, 61, 0.05)'
                  }}
                >
                  {/* HEADER VISUAL DE VISTA PREVIA */}
                  <div style={{
                    background: 'linear-gradient(135deg, var(--navy, #14213D) 0%, #1e3a5f 100%)',
                    padding: '1.25rem 1.5rem',
                    color: '#FFFFFF',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span style={{ fontSize: '0.84rem', fontWeight: 800 }}>Así verán tu perfil los estudiantes</span>
                    <span style={{
                      background: 'rgba(252,163,17,0.2)',
                      color: 'var(--gold, #FCA311)',
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: '6px',
                      textTransform: 'uppercase'
                    }}>
                      Vista Previa
                    </span>
                  </div>

                  <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '50%',
                        background: 'var(--navy, #14213D)',
                        color: 'var(--gold, #FCA311)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '1.4rem',
                        boxShadow: '0 2px 8px rgba(20,33,61,0.15)',
                        flexShrink: 0
                      }}>
                        {personalData.full_name ? personalData.full_name.charAt(0).toUpperCase() : 'P'}
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--navy, #14213D)' }}>
                          {personalData.full_name || 'Profesor'}
                        </h4>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted, #64748B)', fontWeight: 600, marginTop: '2px' }}>
                          {academicData.title_role || 'Docente Titular'}
                        </div>
                      </div>
                    </div>

                    {academicData.area && (
                      <div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted, #64748B)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                          Especialidad
                        </div>
                        <span style={{
                          background: '#EFF6FF',
                          color: '#1D4ED8',
                          padding: '3px 10px',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          display: 'inline-block'
                        }}>
                          🎯 {academicData.area}
                        </span>
                      </div>
                    )}

                    {academicData.bio && (
                      <div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted, #64748B)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                          Biografía
                        </div>
                        <p style={{ margin: 0, fontSize: '0.82rem', color: '#475569', lineHeight: 1.45, fontStyle: 'italic' }}>
                          "{academicData.bio}"
                        </p>
                      </div>
                    )}

                    {academicData.experience && (
                      <div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted, #64748B)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                          Formación y Trayectoria
                        </div>
                        <p style={{ margin: 0, fontSize: '0.82rem', color: '#475569', lineHeight: 1.45 }}>
                          {academicData.experience}
                        </p>
                      </div>
                    )}

                    {/* PROGRAMAS EN LOS QUE PARTICIPA */}
                    {myPrograms.length > 0 && (
                      <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '0.85rem' }}>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted, #64748B)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
                          Programas Asignados ({myPrograms.length})
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                          {myPrograms.map(prog => (
                            <div key={prog.id} style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              padding: '0.45rem 0.65rem',
                              borderRadius: '8px',
                              background: '#F8FAFC',
                              border: '1px solid #F1F5F9'
                            }}>
                              <BookOpen size={14} color="var(--gold-dark, #b45309)" />
                              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--navy, #14213D)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {prog.title}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* CONTENIDO DE PESTAÑA: SEGURIDAD */}
          {activeTab === 'security' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* TARJETA DE RESUMEN DE SEGURIDAD */}
              <div style={{ padding: '2rem', background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(20, 33, 61, 0.03)' }}>
                <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid #F1F5F9', paddingBottom: '0.75rem' }}>
                  <h3 style={{ fontSize: '1.2rem', color: 'var(--navy, #14213D)', fontWeight: 800, margin: 0 }}>
                    Acceso y Seguridad de la Cuenta
                  </h3>
                  <p style={{ color: 'var(--text-muted, #64748B)', fontSize: '0.88rem', margin: '0.25rem 0 0 0' }}>
                    Administra la contraseña y protege el acceso institucional a tu plataforma.
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {/* FILA 1: CONTRASEÑA */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', paddingBottom: '1.25rem', borderBottom: '1px solid #F1F5F9' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', flex: '1 1 280px' }}>
                      <div style={{ padding: '0.65rem', borderRadius: '10px', background: 'rgba(20, 33, 61, 0.04)', color: 'var(--navy, #14213D)', flexShrink: 0 }}>
                        <LockKeyhole size={22} />
                      </div>
                      <div>
                        <h4 style={{ fontSize: '1rem', color: 'var(--navy, #14213D)', fontWeight: 700, margin: 0 }}>
                          Contraseña de acceso
                        </h4>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted, #64748B)', margin: '0.2rem 0 0 0' }}>
                          Utiliza una contraseña robusta para proteger la integridad de tus calificaciones y contenidos.
                        </p>
                      </div>
                    </div>

                    <button 
                      type="button" 
                      onClick={handleOpenPasswordModal}
                      style={{ 
                        background: 'transparent', 
                        color: 'var(--navy, #14213D)', 
                        border: '1.5px solid var(--navy, #14213D)', 
                        padding: '0.55rem 1.25rem', 
                        fontWeight: 700, 
                        fontSize: '0.85rem', 
                        borderRadius: '8px',
                        whiteSpace: 'nowrap',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseOver={e => { e.currentTarget.style.background = 'var(--navy, #14213D)'; e.currentTarget.style.color = '#FFFFFF'; }}
                      onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--navy, #14213D)'; }}
                    >
                      Cambiar contraseña
                    </button>
                  </div>

                  {/* FILA 2: CORREO DE RECUPERACIÓN */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', flex: '1 1 280px' }}>
                      <div style={{ padding: '0.65rem', borderRadius: '10px', background: 'rgba(20, 33, 61, 0.04)', color: 'var(--navy, #14213D)', flexShrink: 0 }}>
                        <MailCheck size={22} />
                      </div>
                      <div>
                        <h4 style={{ fontSize: '1rem', color: 'var(--navy, #14213D)', fontWeight: 700, margin: 0 }}>
                          Correo institucional vinculado
                        </h4>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted, #64748B)', margin: '0.2rem 0 0 0' }}>
                          {currentUser?.email || 'Correo no registrado'}
                        </p>
                      </div>
                    </div>

                    <div>
                      <span style={{ 
                        background: isEmailVerified ? '#DCFCE7' : '#FEF3C7', 
                        color: isEmailVerified ? '#007A2E' : '#92400E', 
                        padding: '0.35rem 0.85rem', 
                        borderRadius: '9999px', 
                        fontSize: '0.75rem', 
                        fontWeight: 700 
                      }}>
                        {isEmailVerified ? '✓ Correo verificado' : 'Verificación pendiente'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* NOTA PEQUEÑA AL FINAL */}
              <div style={{ textAlign: 'center', padding: '0.5rem 1rem' }}>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted, #64748B)', margin: 0 }}>
                  🏛️ Los roles y permisos institucionales son administrados por el Laboratorio LIATER - Universidad Nacional de Colombia.
                </p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* 1. HERO BANNER DE IDENTIDAD Y ROL */}
          <div className="card static-card" style={{ padding: '1.5rem 1.75rem', background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)', borderTop: '4px solid var(--navy)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
              <div style={{ width: '70px', height: '70px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--navy) 0%, #1e2e52 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gold)', fontWeight: 800, fontSize: '1.8rem', boxShadow: '0 6px 18px rgba(20, 33, 61, 0.15)', border: '2.5px solid #ffffff', flexShrink: 0 }}>
                {personalData.full_name ? personalData.full_name.charAt(0).toUpperCase() : (role === 'admin' ? 'A' : 'E')}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--navy)', margin: 0 }}>
                    {personalData.full_name || (role === 'admin' ? 'Administrador' : 'Estudiante')}
                  </h2>
                  <span className="badge badge-navy" style={{ padding: '0.2rem 0.65rem', fontSize: '0.7rem', fontWeight: 700 }}>
                    {role === 'admin' ? 'ADMINISTRADOR LIATER' : 'ESTUDIANTE LIATER'}
                  </span>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginTop: '0.35rem', flexWrap: 'wrap', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Mail size={14} color="var(--navy)" /> {personalData.email}
                  </span>
                  {personalData.profession && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: 'var(--navy)', fontWeight: 700, background: 'rgba(252, 163, 17, 0.14)', padding: '0.15rem 0.6rem', borderRadius: '999px', fontSize: '0.78rem' }}>
                      <Briefcase size={13} color="var(--gold-dark)" /> {personalData.profession}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 2. FORMULARIO UNIFICADO DE EDICIÓN DIVIDIDO EN SECCIONES LIMPIAS */}
          <form onSubmit={handleSavePersonal} className="card static-card" style={{ padding: '2rem' }}>
            
            {/* SECCIÓN A: INFORMACIÓN DE CONTACTO */}
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1.05rem', color: 'var(--navy)', fontWeight: 800, margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.6rem' }}>
                <User size={18} color="var(--navy)" />
                Información de Contacto
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: 'var(--navy)', marginBottom: '0.4rem' }}>Nombre Completo</label>
                  <input type="text" value={personalData.full_name} onChange={e => setPersonalData({...personalData, full_name: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: '#ffffff', fontSize: '0.9rem' }} />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: 'var(--navy)', marginBottom: '0.4rem' }}>Teléfono de Contacto</label>
                  <input type="tel" value={personalData.phone} onChange={e => setPersonalData({...personalData, phone: e.target.value})} placeholder="+57 300 000 0000" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: '#ffffff', fontSize: '0.9rem' }} />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: 'var(--navy)', marginBottom: '0.4rem' }}>País de Residencia</label>
                  <select value={personalData.country} onChange={e => setPersonalData({...personalData, country: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: '#ffffff', fontSize: '0.9rem' }}>
                    <option>Colombia</option>
                    <option>México</option>
                    <option>Perú</option>
                    <option>Chile</option>
                    <option>Argentina</option>
                    <option>Otro</option>
                  </select>
                </div>
              </div>
            </div>

            {/* SECCIÓN B: PERFIL PROFESIONAL */}
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1.05rem', color: 'var(--navy)', fontWeight: 800, margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.6rem' }}>
                <Briefcase size={18} color="var(--gold-dark)" />
                Perfil Profesional
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: 'var(--navy)', marginBottom: '0.4rem' }}>Profesión / Ocupación</label>
                  <input type="text" value={personalData.profession} onChange={e => setPersonalData({...personalData, profession: e.target.value})} placeholder="Ej. Ingeniera Mecatrónica / Estudiante" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: '#ffffff', fontSize: '0.9rem' }} />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: 'var(--navy)', marginBottom: '0.4rem' }}>Institución / Empresa</label>
                  <input type="text" value={personalData.institution} onChange={e => setPersonalData({...personalData, institution: e.target.value})} placeholder="Ej. Universidad Nacional de Colombia" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: '#ffffff', fontSize: '0.9rem' }} />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: 'var(--navy)', marginBottom: '0.4rem' }}>Resumen / Biografía Breve</label>
                <textarea rows={3} value={personalData.bio} onChange={e => setPersonalData({...personalData, bio: e.target.value})} placeholder="Describe brevemente tu área de interés o enfoque profesional..." style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: '#ffffff', fontSize: '0.88rem', fontFamily: 'inherit' }} />
              </div>
            </div>

            {/* BOTÓN DE GUARDAR CAMBIOS CON ANIMACIÓN DE RESORTE */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
              <button 
                type="submit" 
                disabled={saving || !hasUnsavedPersonalChanges} 
                className="btn btn-navy" 
                style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '0.5rem', 
                  padding: '0.75rem 1.75rem', 
                  fontWeight: 700, 
                  fontSize: '0.9rem',
                  borderRadius: '8px',
                  cursor: (saving || !hasUnsavedPersonalChanges) ? 'not-allowed' : 'pointer',
                  opacity: (!hasUnsavedPersonalChanges && !saving) ? 0.55 : 1,
                  transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  boxShadow: (hasUnsavedPersonalChanges && !saving) ? '0 4px 12px rgba(20, 33, 61, 0.25)' : 'none'
                }}
                onMouseOver={e => {
                  if (hasUnsavedPersonalChanges && !saving) {
                    e.currentTarget.style.transform = 'translateY(-2px) scale(1.03)';
                    e.currentTarget.style.boxShadow = '0 6px 18px rgba(20, 33, 61, 0.35)';
                  }
                }}
                onMouseOut={e => {
                  if (hasUnsavedPersonalChanges && !saving) {
                    e.currentTarget.style.transform = 'translateY(0) scale(1)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(20, 33, 61, 0.25)';
                  }
                }}
                onMouseDown={e => {
                  if (hasUnsavedPersonalChanges && !saving) {
                    e.currentTarget.style.transform = 'translateY(0) scale(0.96)';
                  }
                }}
              >
                <Save size={18} /> {saving ? 'Guardando...' : 'Guardar Cambios del Perfil'}
              </button>
            </div>
          </form>

          {/* 3. SEGURIDAD Y CREDENCIALES (INTEGRADO COMPACTO CON BOTÓN ANIMADO) */}
          <div className="card static-card" style={{ padding: '1.5rem', background: '#ffffff' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div style={{ padding: '0.6rem', borderRadius: '10px', background: 'rgba(20, 33, 61, 0.05)', color: 'var(--navy)' }}>
                  <LockKeyhole size={22} />
                </div>
                <div>
                  <h4 style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--navy)', margin: 0 }}>Seguridad y Contraseña</h4>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0.15rem 0 0 0' }}>Gestiona la clave de acceso a tu portal académico.</p>
                </div>
              </div>

              <button 
                type="button" 
                onClick={handleOpenPasswordModal} 
                className="btn" 
                style={{ 
                  background: 'transparent',
                  border: '1.5px solid var(--navy)', 
                  color: 'var(--navy)', 
                  padding: '0.55rem 1.25rem', 
                  fontWeight: 700, 
                  fontSize: '0.85rem', 
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)'
                }}
                onMouseOver={e => {
                  e.currentTarget.style.background = 'var(--navy)';
                  e.currentTarget.style.color = '#ffffff';
                  e.currentTarget.style.transform = 'translateY(-2px) scale(1.03)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(20, 33, 61, 0.25)';
                }}
                onMouseOut={e => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--navy)';
                  e.currentTarget.style.transform = 'translateY(0) scale(1)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
                onMouseDown={e => {
                  e.currentTarget.style.transform = 'translateY(0) scale(0.96)';
                }}
              >
                Cambiar contraseña
              </button>
            </div>
          </div>

        </div>
      )}

      {/* MODAL DE CAMBIO DE CONTRASEÑA */}
      {showPasswordModal && createPortal(
        <div 
          role="dialog" 
          aria-modal="true" 
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            width: '100%',
            height: '100%',
            minHeight: '100vh',
            background: 'rgba(15, 23, 42, 0.65)', 
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 99999,
            padding: '1rem',
            boxSizing: 'border-box',
            overflowY: 'auto'
          }}
          onClick={handleClosePasswordModal}
        >
          <div 
            style={{ 
              background: 'var(--white)', 
              borderRadius: 'var(--radius-lg)', 
              border: '1px solid var(--border-color)',
              borderTop: '4px solid var(--gold)',
              maxWidth: '500px', 
              width: '100%', 
              margin: 'auto',
              padding: '2rem', 
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              position: 'relative',
              boxSizing: 'border-box'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Botón Cerrar */}
            <button 
              type="button" 
              onClick={handleClosePasswordModal} 
              style={{ 
                position: 'absolute', 
                top: '1.25rem', 
                right: '1.25rem', 
                background: 'none', 
                border: 'none', 
                color: 'var(--text-muted)', 
                cursor: 'pointer' 
              }}
              aria-label="Cerrar modal"
            >
              <X size={20} />
            </button>

            {/* HEADER DEL MODAL */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.25rem', color: 'var(--navy)', fontWeight: 800, margin: 0 }}>
                {passwordStep === 'otp' ? 'Verifica tu identidad' : 'Cambiar contraseña'}
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: '0.35rem 0 0 0' }}>
                {passwordStep === 'otp' 
                  ? 'Enviamos un código de seguridad a tu correo registrado.' 
                  : 'Confirma tu contraseña actual antes de establecer una nueva.'}
              </p>
            </div>

            {/* ALERTAS DEL MODAL */}
            {modalError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, marginBottom: '1.25rem' }}>
                ⚠️ {modalError}
              </div>
            )}

            {modalSuccess && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, marginBottom: '1.25rem' }}>
                ✓ {modalSuccess}
              </div>
            )}

            {/* FORMULARIO DE CAMBIO */}
            <form onSubmit={handleUpdatePassword} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {passwordStep === 'initial' ? (
                <>
                  {/* Campo: Contraseña actual */}
                  <div>
                    <label htmlFor="currentPasswordInput" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--navy)', marginBottom: '0.4rem' }}>
                      Contraseña actual
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        id="currentPasswordInput"
                        type={showCurrentPw ? 'text' : 'password'} 
                        value={currentPassword}
                        onChange={e => setCurrentPassword(e.target.value)}
                        placeholder="Tu contraseña actual"
                        style={{ width: '100%', padding: '0.7rem 2.5rem 0.7rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.9rem' }}
                        required
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowCurrentPw(!showCurrentPw)}
                        style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                        aria-label="Ver u ocultar contraseña actual"
                      >
                        {showCurrentPw ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  {/* Campo: Nueva contraseña */}
                  <div>
                    <label htmlFor="newPasswordInput" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--navy)', marginBottom: '0.4rem' }}>
                      Nueva contraseña
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        id="newPasswordInput"
                        type={showNewPw ? 'text' : 'password'} 
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        style={{ width: '100%', padding: '0.7rem 2.5rem 0.7rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.9rem' }}
                        required
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowNewPw(!showNewPw)}
                        style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                        aria-label="Ver u ocultar nueva contraseña"
                      >
                        {showNewPw ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  {/* Campo: Confirmar nueva contraseña */}
                  <div>
                    <label htmlFor="confirmPasswordInput" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--navy)', marginBottom: '0.4rem' }}>
                      Confirmar nueva contraseña
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        id="confirmPasswordInput"
                        type={showConfirmPw ? 'text' : 'password'} 
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        placeholder="Repite la nueva contraseña"
                        style={{ width: '100%', padding: '0.7rem 2.5rem 0.7rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.9rem' }}
                        required
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowConfirmPw(!showConfirmPw)}
                        style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                        aria-label="Ver u ocultar confirmación de contraseña"
                      >
                        {showConfirmPw ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                /* Paso OTP */
                <div>
                  <label htmlFor="otpCodeInput" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--navy)', marginBottom: '0.4rem' }}>
                    Código de verificación
                  </label>
                  <input 
                    id="otpCodeInput"
                    type="text" 
                    value={otpCode}
                    onChange={e => setOtpCode(e.target.value)}
                    placeholder="Ingresa el código de 6 dígitos"
                    maxLength={6}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '1.1rem', letterSpacing: '0.2em', textAlign: 'center' }}
                    required
                  />
                </div>
              )}

              {/* ACCIONES DEL MODAL */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button 
                  type="button" 
                  onClick={handleClosePasswordModal}
                  className="btn btn-outline"
                  style={{ padding: '0.65rem 1.25rem', fontWeight: 600, fontSize: '0.88rem' }}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={securitySaving}
                  className="btn" 
                  style={{ background: 'var(--navy)', color: 'white', border: 'none', padding: '0.65rem 1.35rem', fontWeight: 700, fontSize: '0.88rem', borderRadius: '8px' }}
                >
                  {securitySaving ? 'Procesando...' : (passwordStep === 'otp' ? 'Verificar y actualizar' : 'Actualizar contraseña')}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
