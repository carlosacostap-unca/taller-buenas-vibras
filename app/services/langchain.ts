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
   * @returns Promise con la respuesta del asistente
   */
  static async generateResponse(
    message: string,
    conversationHistory: ChatMessage[] = []
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
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al procesar la solicitud');
      }

      return data.response;
    } catch (error: any) {
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