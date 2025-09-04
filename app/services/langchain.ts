// Interfaz para los mensajes del chat
export interface ChatMessage {
  content: string;
  isUser: boolean;
}

export class LangchainService {
  /**
   * Genera una respuesta usando GPT-4 a través de la API route
   * @param message El mensaje del usuario
   * @param conversationHistory Historial de la conversación (opcional)
   * @param infoContext Contexto de información recopilada (opcional)
   * @returns Promise con la respuesta del asistente
   */
  static async generateResponse(
    message: string,
    conversationHistory: ChatMessage[] = [],
    infoContext?: any
  ): Promise<string> {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          conversationHistory,
          infoContext,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al procesar la solicitud');
      }

      return data.response;
    } catch (error: unknown) {
      console.error('Error al generar respuesta:', error);
      throw error;
    }
  }

  /**
   * Verifica si la configuración de la API está correcta
   * @returns Promise<boolean>
   */
  static async testConnection(): Promise<boolean> {
    try {
      const testResponse = await this.generateResponse('Hola, ¿estás funcionando?');
      return testResponse.length > 0;
    } catch (error) {
      console.error('Error en test de conexión:', error);
      return false;
    }
  }
}