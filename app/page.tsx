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

function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: '¡Hola! Soy tu asistente de IA powered by GPT-4. ¿En qué puedo ayudarte hoy?',
      isUser: false,
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'testing'>('testing');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
      
      // Generar respuesta usando Langchain
      const response = await LangchainService.generateResponse(userMessage, conversationHistory);
      
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
      if (error?.message?.includes('API key')) {
        return '❌ Error de autenticación: Verifica que tu API key de OpenAI esté configurada correctamente en el archivo .env.local';
      } else if (error?.message?.includes('quota') || error?.message?.includes('billing')) {
        return '💳 Error de cuota: Has excedido tu límite de uso de la API de OpenAI. Verifica tu plan de facturación.';
      } else if (error?.message?.includes('network') || error?.message?.includes('fetch')) {
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
          <h1 className="text-xl font-semibold text-gray-800">ChatApp</h1>
        </div>
        
        <div className="flex items-center space-x-4">
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

      {/* Input Area */}
      <div className="bg-white border-t border-gray-200 px-4 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-end space-x-3">
            <div className="flex-1 relative">
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message here..."
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
