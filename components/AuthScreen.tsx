import React, { useState } from 'react';
import { Lock, User, AlertCircle, Loader2 } from 'lucide-react';
import { LOGO_BASE64 } from '../assets/logo';
import { authService } from '../services/authService';

interface AuthScreenProps {
  onLoginSuccess: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Por favor, ingresa tu usuario y contraseña.');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      // Usamos el servicio de autenticación. 
      // El servicio automáticamente agregará "@lafe.com" si el usuario no pone el @.
      const { user, error: authError } = await authService.signIn(username, password);

      if (authError) {
        if (authError.message === 'Invalid login credentials') {
          setError('Usuario o contraseña incorrectos.');
        } else if (authError.message === 'Email not confirmed') {
          setError('El usuario no ha sido confirmado por el administrador.');
        } else {
          setError('Error al iniciar sesión. Verifica tu conexión.');
        }
      } else if (user) {
        onLoginSuccess();
      }
    } catch (err) {
      setError('Ocurrió un error inesperado al iniciar sesión.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-3xl shadow-xl border border-slate-100 relative overflow-hidden">

        {/* Encabezado del Formulario */}
        <div className="flex flex-col items-center">
          <img src={LOGO_BASE64} alt="Logo La Fe" className="h-24 w-auto mb-6 drop-shadow-lg" />
          <h1 className="text-3xl font-black text-slate-900 mb-2">Iniciar Sesión</h1>
          <p className="text-slate-500 font-medium text-center">
            Sistema de Gestión de Colillas
          </p>
        </div>

        {/* Alerta de Error */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-md flex items-start">
            <AlertCircle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Formulario de Login */}
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="space-y-4">

            {/* Campo Usuario */}
            <div>
              <label htmlFor="username" className="block text-sm font-semibold text-slate-700 mb-1">
                Usuario Funcional
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  className="appearance-none rounded-xl relative block w-full pl-10 px-3 py-3 border border-slate-300 placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:z-10 sm:text-sm bg-slate-50 transition-colors"
                  placeholder="ej. usuario@lafe.com"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Campo Contraseña */}
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-slate-700 mb-1">
                Contraseña
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  className="appearance-none rounded-xl relative block w-full pl-10 px-3 py-3 border border-slate-300 placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:z-10 sm:text-sm bg-slate-50 transition-colors"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 shadow-md hover:shadow-lg transition-all disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" />
                  Validando credenciales...
                </>
              ) : (
                'Entrar al Sistema'
              )}
            </button>
          </div>
        </form>

        <div className="mt-6">
          <p className="text-center text-xs text-slate-400">
            Organización La Fe © {new Date().getFullYear()}
            <br />
            Acceso restringido a personal autorizado.
          </p>
        </div>
      </div>
    </div>
  );
};
