import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';

export default function UpdatePassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    // Supabase redirige con un hash que contiene el token de invitación.
    // onAuthStateChange intercepta ese hash y establece la sesión automáticamente.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
          if (session) {
            setSessionReady(true);
          }
        }
      }
    );

    // También verificar si ya hay sesión activa (por si el usuario recargó la página)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSessionReady(true);
      } else {
        // Sin hash de token y sin sesión: el enlace ya expiró
        // No redirigir inmediatamente; dejar que onAuthStateChange actúe primero.
        // Si en 2 segundos no hay sesión, mostrar error.
        setTimeout(() => {
          supabase.auth.getSession().then(({ data: { session: s } }) => {
            if (!s) {
              setError('El enlace de invitación no es válido o ya expiró. Contacta al administrador para solicitar uno nuevo.');
            }
          });
        }, 2000);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setLoading(true);

    try {
      // 1. Actualizar la contraseña en Supabase Auth
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      // 2. Obtener el usuario actual para activar su perfil en users_profile
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Activar el perfil: el usuario completó el flujo correctamente
        await supabase
          .from('users_profile')
          .update({ is_active: true })
          .eq('auth_user_id', user.id);
      }

      // 3. Redirigir al portal (ProtectedRoute detectará el rol y enrutará correctamente)
      navigate('/portal', { replace: true });

    } catch (err) {
      setError(
        err.message?.includes('Auth session missing')
          ? 'La sesión expiró. Solicita al administrador que reenvíe la invitación.'
          : err.message || 'Error al guardar la contraseña. Intenta nuevamente.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="public-layout">
      <div className="card" style={{ width: '100%', maxWidth: '420px' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '0.5rem', color: 'var(--text-dark)', fontWeight: 800 }}>
          Configurar Contraseña
        </h2>
        <p style={{ textAlign: 'center', fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '1.75rem' }}>
          Ingresa una contraseña para activar tu cuenta en LIATER.
        </p>

        {error && (
          <div style={{
            backgroundColor: '#fee2e2',
            color: '#dc2626',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1rem',
            fontSize: '0.875rem',
            border: '1px solid #fca5a5',
            lineHeight: 1.5,
          }}>
            {error}
          </div>
        )}

        {!sessionReady && !error && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem', fontSize: '0.875rem' }}>
            Verificando enlace de invitación...
          </div>
        )}

        {sessionReady && (
          <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.875rem' }}>
                Nueva Contraseña
              </label>
              <input
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.875rem' }}>
                Confirmar Contraseña
              </label>
              <input
                type="password"
                placeholder="Repite tu contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
                style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', boxSizing: 'border-box' }}
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: '100%', marginTop: '0.5rem' }}
            >
              {loading ? 'Activando cuenta...' : 'Activar Cuenta'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

