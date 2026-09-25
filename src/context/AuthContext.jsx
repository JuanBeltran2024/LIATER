import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

/**
 * Construye el objeto de usuario combinando los datos de Supabase Auth
 * con el perfil almacenado en users_profile.
 */
async function buildUserFromAuth(authUser) {
  if (!authUser) return null;

  const { data: profile, error } = await supabase
    .from('users_profile')
    .select('id, full_name, role, email, is_active')
    .eq('auth_user_id', authUser.id)
    .maybeSingle();

  if (error || !profile) return null;

  return {
    id: profile.id,                        // users_profile.id (usado en teacher_profiles, etc.)
    auth_user_id: authUser.id,             // auth.users.id
    name: profile.full_name,               // alias para compatibilidad con Header.jsx
    full_name: profile.full_name,
    email: profile.email || authUser.email,
    role: profile.role,
    is_active: profile.is_active,
    avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.full_name)}&background=14213D&color=FCA311&size=150`
  };
}

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  // loading=true mientras se verifica la sesión inicial al cargar la app
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Verificar si ya hay sesión activa (p. ej. al recargar la página)
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const user = await buildUserFromAuth(session.user);
        setCurrentUser(user);
      }
      setLoading(false);
    });

    // 2. Escuchar cambios de sesión (login, logout, refresh de token)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          const user = await buildUserFromAuth(session.user);
          setCurrentUser(user);
        } else {
          setCurrentUser(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  /**
   * Login real contra Supabase Auth.
   * Devuelve { success, role } o { success: false, message }.
   */
  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      // Mensaje amigable en español
      if (error.message.includes('Invalid login credentials')) {
        return { success: false, message: 'Correo o contraseña incorrectos.' };
      }
      if (error.message.includes('Email not confirmed')) {
        return { success: false, message: 'Debes confirmar tu correo antes de iniciar sesión.' };
      }
      return { success: false, message: error.message };
    }

    const user = await buildUserFromAuth(data.user);

    if (!user) {
      await supabase.auth.signOut();
      return { success: false, message: 'No se encontró tu perfil en la plataforma. Contacta al administrador.' };
    }

    if (user.is_active === false) {
      await supabase.auth.signOut();
      return { success: false, message: 'Tu cuenta está desactivada. Contacta al administrador.' };
    }

    return { success: true, role: user.role };
  };

  /**
   * Cierra la sesión en Supabase y limpia el estado local.
   */
  const logout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
  };

  return (
    <AuthContext.Provider value={{ currentUser, login, logout, loading }}>
      {/* No renderizar hijos hasta que se verifique la sesión inicial */}
      {!loading && children}
    </AuthContext.Provider>
  );
};
