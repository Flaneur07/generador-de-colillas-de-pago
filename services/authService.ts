import { supabase } from '../lib/supabaseClient';
import { Session, User } from '@supabase/supabase-js';

export const authService = {
  /**
   * Obtiene la sesión actual almacenada localmente.
   */
  async getSession(): Promise<Session | null> {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  },

  /**
   * Obtiene el usuario actualmente autenticado.
   */
  async getUser(): Promise<User | null> {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  },

  /**
   * Inicia sesión usando el "usuario" (que internamente es un email formateado).
   * @param username El nombre de usuario (ej. camilo.lafe)
   * @param password La contraseña asignada
   * @param autoDomain El dominio falso que se le agrega si el usuario no pone @. (Por defecto @lafe.com)
   */
  async signIn(username: string, password: string, autoDomain: string = '@lafe.com'): Promise<{ user: User | null; error: Error | null }> {
    // Si el usuario no escribió un '@', le agregamos el dominio corporativo automáticamente.
    const email = username.includes('@') ? username : `${username}${autoDomain}`;
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('Error en signIn:', error.message);
      return { user: null, error };
    }

    return { user: data.user, error: null };
  },

  /**
   * Cierra la sesión activa y limpia los tokens locales.
   */
  async signOut(): Promise<{ error: Error | null }> {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error en signOut:', error.message);
    }
    return { error };
  },

  /**
   * Suscribirse a cambios en el estado de autenticación (login, logout, token refresh).
   */
  onAuthStateChange(callback: (event: string, session: Session | null) => void) {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(callback);
    return subscription;
  }
};
