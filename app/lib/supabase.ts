import { createClient } from '@supabase/supabase-js'
import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// Cliente para el lado del cliente (browser)
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)

// Cliente para el lado del servidor
export const createServerClient = () => {
  return createClient(supabaseUrl, supabaseAnonKey)
}

// Tipos de autenticación
export interface AuthUser {
  id: string
  email: string
  user_metadata?: {
    full_name?: string
    avatar_url?: string
  }
}

// Funciones de autenticación
export const authService = {
  // Registro con email y contraseña
  async signUp(email: string, password: string, fullName?: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    })
    return { data, error }
  },

  // Inicio de sesión con email y contraseña
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { data, error }
  },

  // Cerrar sesión
  async signOut() {
    const { error } = await supabase.auth.signOut()
    return { error }
  },

  // Obtener usuario actual
  async getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser()
    return { user, error }
  },

  // Escuchar cambios de autenticación
  onAuthStateChange(callback: (user: AuthUser | null) => void) {
    return supabase.auth.onAuthStateChange((event, session) => {
      const user = session?.user ? {
        id: session.user.id,
        email: session.user.email!,
        user_metadata: session.user.user_metadata,
      } : null
      callback(user)
    })
  },
}