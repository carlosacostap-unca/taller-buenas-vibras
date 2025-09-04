import { NextRequest, NextResponse } from 'next/server';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación con Supabase
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json(
        { error: 'No autorizado. Debes iniciar sesión.' },
        { status: 401 }
      );
    }

    const { message, conversationHistory } = await request.json();

    // Verificar que la API key esté configurada
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === 'tu-api-key-aqui') {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY no está configurada correctamente. Por favor, configura tu API key en el archivo .env.local' },
        { status: 500 }
      );
    }

    // Configurar el modelo
    const model = new ChatOpenAI({
      modelName: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.7,
      maxTokens: 1000,
      openAIApiKey: apiKey,
    });

    // Mensaje del sistema
    const systemMessage = new SystemMessage(
      'Eres un asistente de IA útil y amigable. Responde de manera conversacional y natural en español. Mantén tus respuestas concisas pero informativas.'
    );

    // Preparar los mensajes para el contexto
    const messages = [systemMessage];

    // Agregar historial de conversación (últimos 10 mensajes para mantener contexto)
    const recentHistory = conversationHistory?.slice(-10) || [];
    for (const msg of recentHistory) {
      if (msg.isUser) {
        messages.push(new HumanMessage(msg.content));
      } else {
        messages.push(new SystemMessage(`Asistente: ${msg.content}`));
      }
    }

    // Agregar el mensaje actual del usuario
    messages.push(new HumanMessage(message));

    // Generar respuesta
    const response = await model.invoke(messages);

    return NextResponse.json({ response: response.content });
  } catch (error: any) {
    console.error('Error al generar respuesta:', error);

    // Proporcionar mensajes de error más específicos
    let errorMessage = 'Error al procesar tu mensaje. Intenta nuevamente.';
    
    if (error?.message?.includes('API key')) {
      errorMessage = 'Error de autenticación: Verifica que tu API key de OpenAI esté configurada correctamente.';
    } else if (error?.message?.includes('quota') || error?.message?.includes('billing')) {
      errorMessage = 'Error de cuota: Has excedido tu límite de uso de la API de OpenAI.';
    } else if (error?.message?.includes('network') || error?.message?.includes('fetch')) {
      errorMessage = 'Error de conexión: No se pudo conectar con la API de OpenAI.';
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}