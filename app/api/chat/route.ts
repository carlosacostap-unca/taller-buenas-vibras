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

    const { message, conversationHistory, infoContext } = await request.json();

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

    // Crear prompt dinámico basado en el contexto de información
    let systemPrompt = `Eres un asistente especializado en recopilar información básica de usuarios para el Taller de Buenas Vibras. Tu objetivo principal es obtener de manera amigable y conversacional los siguientes datos:

1. **Empresa**: ¿En qué empresa trabajas?
2. **Industria**: ¿A qué sector o industria pertenece tu empresa?
3. **Rol**: ¿Cuál es tu posición o rol en la empresa?

Instrucciones:
- Haz preguntas de una en una, de manera natural y conversacional
- Si el usuario proporciona información parcial, pide aclaración o más detalles
- Una vez que tengas toda la información, confirma los datos con el usuario
- Mantén un tono amigable y profesional
- Si el usuario se desvía del tema, redirige gentilmente hacia la recopilación de información
- Responde siempre en español`;

    // Añadir contexto de información ya recopilada
    if (infoContext) {
      systemPrompt += `\n\n**CONTEXTO ACTUAL:**\n`;
      systemPrompt += `Progreso: ${infoContext.completedFields}/${infoContext.totalFields} campos completados\n`;
      
      if (infoContext.infoStatus.empresa) {
        systemPrompt += `✅ Empresa: "${infoContext.userInfo.empresa}"\n`;
      } else {
        systemPrompt += `❌ Empresa: Pendiente\n`;
      }
      
      if (infoContext.infoStatus.industria) {
        systemPrompt += `✅ Industria: "${infoContext.userInfo.industria}"\n`;
      } else {
        systemPrompt += `❌ Industria: Pendiente\n`;
      }
      
      if (infoContext.infoStatus.rol) {
        systemPrompt += `✅ Rol: "${infoContext.userInfo.rol}"\n`;
      } else {
        systemPrompt += `❌ Rol: Pendiente\n`;
      }
      
      systemPrompt += `\nBasa tu siguiente pregunta en esta información. Si todos los campos están completos, confirma la información con el usuario.`;
    }

    const systemMessage = new SystemMessage(systemPrompt);

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
  } catch (error: unknown) {
    console.error('Error al generar respuesta:', error);

    // Proporcionar mensajes de error más específicos
    let errorMessage = 'Error al procesar tu mensaje. Intenta nuevamente.';
    
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (errorMsg.includes('API key')) {
      errorMessage = 'Error de autenticación: Verifica que tu API key de OpenAI esté configurada correctamente.';
    } else if (errorMsg.includes('quota') || errorMsg.includes('billing')) {
      errorMessage = 'Error de cuota: Has excedido tu límite de uso de la API de OpenAI.';
    } else if (errorMsg.includes('network') || errorMsg.includes('fetch')) {
      errorMessage = 'Error de conexión: No se pudo conectar con la API de OpenAI.';
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}