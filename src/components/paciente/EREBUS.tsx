// src/components/ApiErebus.tsx
import React, { useState, useRef, useCallback } from 'react';
// Asumiendo que usas Tailwind, no se importa CSS adicional.

// Interfaz para la respuesta esperada de la API
interface ApiResponse {
  responseText: string;
  audioBase64: string | null;
}

// Nombre del componente
function EREBUS() {
  // --- Estados ---
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [responseText, setResponseText] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // --- Refs ---
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const audioPlayer = useRef<HTMLAudioElement>(new Audio());

  // --- Configuración de la API ---
  // *** CAMBIO AQUÍ: Usando VITE_API_EREBUS_URL ***
  const API_ENDPOINT = import.meta.env.VITE_API_EREBUS_URL || 'http://erebus-production.up.railway.app';
  const PROCESS_ENDPOINT = `${API_ENDPOINT}/process_audio/`; // Endpoint específico

  // --- Funciones de Grabación ---
  const startRecording = useCallback(async () => {
    setError(null);
    setResponseText('');
    if (mediaRecorder.current) {
      if (mediaRecorder.current.state === "recording") {
        mediaRecorder.current.stop();
      }
      mediaRecorder.current = null;
    }

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder.current = new MediaRecorder(stream);
        audioChunks.current = [];

        mediaRecorder.current.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunks.current.push(event.data);
          }
        };

        mediaRecorder.current.onstop = () => {
          if (audioChunks.current.length > 0) {
            const audioBlob = new Blob(audioChunks.current, { type: mediaRecorder.current?.mimeType || 'audio/webm' });
            sendAudioToApi(audioBlob);
          } else {
            console.warn("No se grabaron datos de audio.");
            setIsLoading(false);
            setError("No se detectó audio durante la grabación.");
          }
          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.current.onerror = (event) => {
          const specificError = (event as any).error;
          setError(`Error de grabación: ${specificError?.name || 'desconocido'}`);
          setIsRecording(false);
          setIsLoading(false);
          stream.getTracks().forEach(track => track.stop());
        }

        mediaRecorder.current.start();
        setIsRecording(true);
      } catch (err) {
        console.error("Error al acceder al micrófono:", err);
        setError("No se pudo acceder al micrófono. Revisa los permisos.");
        setIsRecording(false);
      }
    } else {
      setError("La API de grabación no es soportada por este navegador.");
    }
  }, [PROCESS_ENDPOINT]); // Dependencia del endpoint es correcta

  const stopRecording = useCallback(() => {
    if (mediaRecorder.current && mediaRecorder.current.state === "recording") {
      mediaRecorder.current.stop(); // Esto dispara onstop que llama a sendAudioToApi
      setIsRecording(false);
      setIsLoading(true); // Mostrar carga ahora
    } else {
      console.warn("Stop recording llamado pero no se estaba grabando.");
      setIsRecording(false);
      setIsLoading(false);
    }
  }, []); // Sin dependencias aquí, solo opera sobre refs y estado

  // --- Función para Enviar Audio a la API ---
  const sendAudioToApi = useCallback(async (audioBlob: Blob) => {
    console.log("Enviando audio a:", PROCESS_ENDPOINT); // Verificar endpoint
    setIsLoading(true);
    const formData = new FormData();
    formData.append('file', audioBlob, `grabacion_${Date.now()}.wav`);

    try {
      const response = await fetch(PROCESS_ENDPOINT, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let errorDetail = `Error ${response.status}: ${response.statusText}`;
        try {
          const errorJson = await response.json();
          errorDetail = errorJson.detail || errorDetail;
        } catch (e) { /* Ignorar si no es JSON */ }
        throw new Error(errorDetail);
      }

      const data = await response.json() as ApiResponse;
      setResponseText(data.responseText || 'La API no devolvió texto.');

      if (data.audioBase64) {
        const audioSrc = `data:audio/mpeg;base64,${data.audioBase64}`;
        if (!audioPlayer.current.paused) {
          audioPlayer.current.pause();
          audioPlayer.current.currentTime = 0;
        }
        audioPlayer.current.src = audioSrc;
        audioPlayer.current.play().catch(e => {
          console.error("Error al llamar a play():", e);
          // Común en algunos navegadores si no hay interacción previa
          setError("No se pudo iniciar la reproducción del audio automáticamente.");
        });
        audioPlayer.current.onerror = (e) => {
          console.error("Error al cargar/reproducir:", e);
          setError("No se pudo cargar/reproducir el audio de respuesta.");
          audioPlayer.current.onerror = null;
        }
      } else {
        console.warn("No se recibió audioBase64 en la respuesta.");
      }

    } catch (err: any) {
      console.error("Error en sendAudioToApi:", err);
      setError(`Error de comunicación: ${err.message}`);
      setResponseText('');
    } finally {
      setIsLoading(false);
    }
  }, [PROCESS_ENDPOINT]); // La dependencia es correcta

  // --- Manejador del Botón Principal ---
  const handleButtonClick = () => {
    if (!isRecording && !audioPlayer.current.paused) {
      audioPlayer.current.pause();
      audioPlayer.current.currentTime = 0;
    }
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // --- Renderizado con Clases Tailwind ---
  return (
    <div className="max-w-2xl mx-auto my-8 p-6 px-8 bg-white border border-gray-200 rounded-xl shadow-md flex flex-col gap-5">
      <h2 className="text-2xl font-semibold text-center text-slate-800 mb-1">
        Asistente E.R.E.B.U.S.
      </h2>
      <p className="text-center text-sm text-slate-500 -mt-2 mb-4">
        V.02 powered by Cynosure
      </p>

      <div className="my-2 flex justify-center items-center">
        <button
          onClick={handleButtonClick}
          disabled={isLoading}
          className={`
            py-3 px-8 min-w-[200px] flex items-center justify-center gap-2
            rounded-full text-base font-medium text-white shadow-sm
            transition-colors duration-200 ease-in-out transform
            focus:outline-none focus:ring-2 focus:ring-offset-2
            disabled:opacity-70 disabled:cursor-not-allowed disabled:shadow-none
            ${
              isRecording
                ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500 active:bg-red-800'
                : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 active:bg-blue-800'
            }
            active:scale-95
          `}
          aria-label={isRecording ? 'Detener grabación' : 'Iniciar grabación'}
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Procesando...
            </>
          ) : (isRecording ? 'Detener Grabación' : 'Iniciar Grabación')}
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-2 px-4 py-3 bg-red-100 border border-red-300 text-red-700 rounded-lg text-center font-medium"
        >
          ⚠️ {error}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <label htmlFor="responseTextOutput" className="font-semibold text-slate-700 ml-0.5">
          Respuesta:
        </label>
        <textarea
          id="responseTextOutput"
          value={responseText}
          readOnly
          placeholder="La respuesta de E.R.E.B.U.S. aparecerá aquí..."
          rows={10}
          className="w-full p-4 text-base leading-relaxed bg-gray-50 border border-gray-300 rounded-lg resize-y focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-gray-800 min-h-[180px]"
          aria-live="polite"
        />
      </div>
      {/* El audio player se controla programáticamente, no necesita ser visible */}
      {/* <audio ref={audioPlayer} hidden /> */}
    </div>
  );
}

// *** Exportación con el nuevo nombre ***
export default EREBUS;
