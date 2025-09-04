'use client';

import { useState, useRef, useEffect } from 'react';
import { LangchainService, ChatMessage } from './services/langchain';
import { useAuth } from './contexts/AuthContext';
import Auth from './components/Auth';

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
}

interface UserInfo {
  empresa: string;
  industria: string;
  rol: string;
}

interface InfoStatus {
  empresa: boolean;
  industria: boolean;
  rol: boolean;
}

function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: '¡Hola! Bienvenido al Taller de Buenas Vibras 🌟\n\nSoy tu asistente y me gustaría conocerte mejor para personalizar tu experiencia. Para comenzar, necesito recopilar algunos datos básicos:\n\n• Tu empresa\n• La industria en la que trabajas\n• Tu rol o posición\n\n¿Podrías contarme en qué empresa trabajas actualmente?',
      isUser: false,
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'testing'>('testing');
  const [userInfo, setUserInfo] = useState<UserInfo>({ empresa: '', industria: '', rol: '' });
  const [infoStatus, setInfoStatus] = useState<InfoStatus>({ empresa: false, industria: false, rol: false });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Función para analizar y extraer información del mensaje del usuario
  const analyzeUserMessage = (message: string) => {
    const lowerMessage = message.toLowerCase();
    const newUserInfo = { ...userInfo };
    const newInfoStatus = { ...infoStatus };

    // Detectar menciones de empresa (patrones más amplios)
    if (!infoStatus.empresa) {
      const empresaPatterns = [
        /(?:trabajo en|empresa|compañía)\s+([A-Za-z0-9\s,.-]+)/i,
        /^([A-Za-z0-9\s,.-]+)$/i // Respuesta directa cuando se pregunta por empresa
      ];
      
      for (const pattern of empresaPatterns) {
        const match = message.match(pattern);
        if (match && match[1].trim().length > 2) {
          newUserInfo.empresa = match[1].trim();
          newInfoStatus.empresa = true;
          break;
        }
      }
    }

    // Detectar menciones de industria/sector (patrones más amplios)
    if (!infoStatus.industria && infoStatus.empresa) {
      const industriaPatterns = [
        /(?:sector|industria|área|rubro)\s+(?:de\s+)?([A-Za-z0-9\s,.-]+)/i,
        /(?:tecnología|salud|educación|finanzas|retail|manufactura|servicios|construcción|agricultura|turismo|entretenimiento|logística|consultoría)/i
      ];
      
      for (const pattern of industriaPatterns) {
        const match = message.match(pattern);
        if (match) {
          newUserInfo.industria = match[1] ? match[1].trim() : match[0];
          newInfoStatus.industria = true;
          break;
        }
      }
    }

    // Detectar menciones de rol/posición (patrones más amplios)
    if (!infoStatus.rol && infoStatus.industria) {
      const rolPatterns = [
        /(?:soy|trabajo como|mi rol es|posición de|cargo de)\s+([A-Za-z0-9\s,.-]+)/i,
        /(?:desarrollador|gerente|analista|director|coordinador|especialista|consultor|ingeniero|diseñador|vendedor|administrador)/i
      ];
      
      for (const pattern of rolPatterns) {
        const match = message.match(pattern);
        if (match) {
          newUserInfo.rol = match[1] ? match[1].trim() : match[0];
          newInfoStatus.rol = true;
          break;
        }
      }
    }

    // Actualizar estado si se encontró nueva información
    if (JSON.stringify(newUserInfo) !== JSON.stringify(userInfo)) {
      setUserInfo(newUserInfo);
      setInfoStatus(newInfoStatus);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Verificar conexión al cargar el componente
  useEffect(() => {
    const testConnection = async () => {
      try {
        const isConnected = await LangchainService.testConnection();
        setConnectionStatus(isConnected ? 'connected' : 'disconnected');
      } catch (error) {
        console.error('Error al probar conexión:', error);
        setConnectionStatus('disconnected');
      }
    };

    testConnection();
  }, []);

  const getLLMResponse = async (userMessage: string): Promise<string> => {
    try {
      // Convertir mensajes al formato esperado por el servicio
      const conversationHistory: ChatMessage[] = messages.map(msg => ({
        content: msg.content,
        isUser: msg.isUser
      }));
      
      // Crear contexto de información recopilada
      const infoContext = {
        userInfo,
        infoStatus,
        completedFields: Object.values(infoStatus).filter(Boolean).length,
        totalFields: 3
      };
      
      // Generar respuesta usando Langchain con contexto
      const response = await LangchainService.generateResponse(userMessage, conversationHistory, infoContext);
      
      // Actualizar estado de conexión si la respuesta fue exitosa
      if (connectionStatus !== 'connected') {
        setConnectionStatus('connected');
      }
      
      return response;
    } catch (error: unknown) {
      console.error('Error al obtener respuesta del LLM:', error);
      
      // Actualizar estado de conexión en caso de error
      setConnectionStatus('disconnected');
      
      // Proporcionar mensajes de error más específicos
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes('API key')) {
        return '❌ Error de autenticación: Verifica que tu API key de OpenAI esté configurada correctamente en el archivo .env.local';
      } else if (errorMsg.includes('quota') || errorMsg.includes('billing')) {
        return '💳 Error de cuota: Has excedido tu límite de uso de la API de OpenAI. Verifica tu plan de facturación.';
      } else if (errorMsg.includes('network') || errorMsg.includes('fetch')) {
        return '🌐 Error de conexión: No se pudo conectar con la API de OpenAI. Verifica tu conexión a internet.';
      } else {
        return '⚠️ Lo siento, hubo un error inesperado al procesar tu mensaje. Por favor, intenta de nuevo en unos momentos.';
      }
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputMessage,
      isUser: true,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    
    // Analizar el mensaje del usuario para extraer información
    analyzeUserMessage(inputMessage);
    
    setIsLoading(true);

    try {
      const llmResponse = await getLLMResponse(inputMessage);
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: llmResponse,
        isUser: false,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error getting LLM response:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">C</span>
          </div>
          <h1 className="text-xl font-semibold text-gray-800">Taller Buenas Vibras</h1>
        </div>
        
        <div className="flex items-center space-x-4">
           {/* Indicador de progreso de información */}
           <div className="flex items-center space-x-2">
             <div className="flex space-x-1">
               <div className={`w-2 h-2 rounded-full ${
                 infoStatus.empresa ? 'bg-green-500' : 'bg-gray-300'
               }`}></div>
               <div className={`w-2 h-2 rounded-full ${
                 infoStatus.industria ? 'bg-green-500' : 'bg-gray-300'
               }`}></div>
               <div className={`w-2 h-2 rounded-full ${
                 infoStatus.rol ? 'bg-green-500' : 'bg-gray-300'
               }`}></div>
             </div>
             <span className="text-xs text-gray-600">
               {Object.values(infoStatus).filter(Boolean).length}/3 completado
             </span>
           </div>
           
           {/* Indicador de estado de conexión */}
           <div className="flex items-center space-x-2">
             <div className={`w-2 h-2 rounded-full ${
               connectionStatus === 'connected' ? 'bg-green-500' :
               connectionStatus === 'disconnected' ? 'bg-red-500' :
               'bg-yellow-500 animate-pulse'
             }`}></div>
             <span className="text-xs text-gray-600">
               {connectionStatus === 'connected' ? 'GPT-4 Conectado' :
                connectionStatus === 'disconnected' ? 'Desconectado' :
                'Conectando...'}
             </span>
           </div>
           
           <UserMenu />
         </div>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex items-start space-x-3 max-w-3xl ${
              message.isUser ? 'flex-row-reverse space-x-reverse' : ''
            }`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                message.isUser 
                  ? 'bg-red-500 text-white' 
                  : 'bg-gray-300 text-gray-600'
              }`}>
                <span className="text-sm font-medium">
                  {message.isUser ? 'U' : 'AI'}
                </span>
              </div>
              <div className={`px-4 py-3 rounded-2xl ${
                message.isUser
                  ? 'bg-red-500 text-white rounded-br-md'
                  : 'bg-white text-gray-800 border border-gray-200 rounded-bl-md'
              }`}>
                <p className="text-sm leading-relaxed">{message.content}</p>
              </div>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex items-start space-x-3 max-w-3xl">
              <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-medium text-gray-600">AI</span>
              </div>
              <div className="bg-white border border-gray-200 px-4 py-3 rounded-2xl rounded-bl-md">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Panel de resumen cuando se complete la información */}
      {Object.values(infoStatus).every(Boolean) && (
        <div className="bg-green-50 border-t border-green-200 px-4 py-3">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-green-800 mb-2">Información Recopilada Completamente</h3>
                <div className="text-sm text-green-700 space-y-1">
                  <p><strong>Empresa:</strong> {userInfo.empresa}</p>
                  <p><strong>Industria:</strong> {userInfo.industria}</p>
                  <p><strong>Rol:</strong> {userInfo.rol}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="bg-white border-t border-gray-200 px-4 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-end space-x-3">
            <div className="flex-1 relative">
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Escribe tu respuesta aquí..."
                className="w-full px-4 py-3 border border-gray-300 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm text-gray-900 placeholder-gray-500"
                rows={1}
                style={{
                  minHeight: '44px',
                  maxHeight: '120px'
                }}
              />
            </div>
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isLoading}
              className="bg-red-500 hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white p-3 rounded-full transition-colors duration-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Componente del menú de usuario
function UserMenu() {
  const { user, signOut } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    setShowDropdown(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center space-x-2 text-gray-600 hover:text-gray-800"
      >
        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
          <span className="text-white text-sm font-medium">
            {user?.user_metadata?.full_name?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
          </span>
        </div>
        <span className="text-sm font-medium hidden md:block">
          {user?.user_metadata?.full_name || user?.email}
        </span>
      </button>

      {showDropdown && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
          <div className="px-4 py-2 text-sm text-gray-700 border-b border-gray-100">
            <div className="font-medium">{user?.user_metadata?.full_name || 'Usuario'}</div>
            <div className="text-gray-500">{user?.email}</div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            Cerrar Sesión
          </button>
        </div>
      )}
    </div>
  );
}

// Componente principal de la aplicación
export default function ChatApp() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Auth onAuthSuccess={() => {}} />;
  }

  return <ChatInterface />;
}
