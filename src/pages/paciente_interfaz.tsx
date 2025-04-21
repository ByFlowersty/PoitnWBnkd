import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Home, Calendar as CalendarIcon, Package2, FileText, Clock, Sunrise, QrCode, Menu, X, User,
  MapPin, ArrowLeft, Sun, Moon, Cloud, CloudFog, CloudDrizzle, CloudLightning, Snowflake,
  Info, AlertTriangle, CloudRain, Camera, UploadCloud, CheckCircle
} from 'lucide-react';
import Barcode from 'react-barcode';
import ContentPanel from '../components/paciente/ContentPanel'; // Asegúrate que la ruta es correcta
import supabase from '../lib/supabaseClient';
import toast from 'react-hot-toast';

// Helper: Convierte Data URL (Base64) a Blob para subir a Supabase
function dataURLtoBlob(dataurl: string): Blob | null {
    try {
        const arr = dataurl.split(',');
        if (arr.length < 2) { console.error("Invalid data URL format"); return null; }
        const mimeMatch = arr[0].match(/:(.*?);/);
        if (!mimeMatch || mimeMatch.length < 2) { console.error("Could not extract MIME type"); return null; }
        const mime = mimeMatch[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while(n--){ u8arr[n] = bstr.charCodeAt(n); }
        return new Blob([u8arr], {type:mime});
    } catch (e) { console.error("Error converting data URL to Blob:", e); return null; }
}

// --- Componente Principal ---
const Paciente_Interfaz: React.FC = () => {
  // --- Estados Generales ---
  const [currentView, setCurrentView] = useState<string>('home');
  const [patientData, setPatientData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [loyaltyCode, setLoyaltyCode] = useState<string>('');
  const [showBarcode, setShowBarcode] = useState<boolean>(false);
  const [isGeneratingCode, setIsGeneratingCode] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState<boolean>(true);
  const [user, setUser] = useState<any>(null);
  const [showPatientForm, setShowPatientForm] = useState<boolean>(false);
  const [formData, setFormData] = useState({ name: '', date_of_birth: '', gender: '', phone: '', blood_type: '', allergies: '' });

  // --- Estados Cámara ---
  const [showCameraModal, setShowCameraModal] = useState<boolean>(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null); // Guarda Data URL temporalmente
  const [isUploadingPhoto, setIsUploadingPhoto] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // --- Estado Clima ---
  const [weatherData, setWeatherData] = useState<{ temp: number | null; condition: string; location: string; day: string; icon: JSX.Element; }>({ temp: null, condition: 'Cargando...', location: 'Obteniendo ubicación...', day: new Date().toLocaleDateString('es-ES', { weekday: 'long' }), icon: <Cloud className="h-5 w-5 text-white" /> });
  const [loadingWeather, setLoadingWeather] = useState<boolean>(true);


  // --- Función para Obtener Citas ---
  const fetchAppointments = useCallback(async (patientId: string | null = null) => {
    const idToFetch = patientId || patientData?.id; if (!idToFetch) { setLoadingAppointments(false); return; } setLoadingAppointments(true); try { const { data, error } = await supabase .from('appointments') .select(`id, appointment_date, appointment_time, tipo_consulta, doctors ( name )`) .eq('patient_id', idToFetch) .order('appointment_date', { ascending: true }) .order('appointment_time', { ascending: true }); if (error) throw error; const processedAppointments = data?.map(appt => ({ ...appt, doctor_name: appt.doctors?.name || 'Dr. Asignado' })) || []; setAppointments(processedAppointments); } catch (fetchError: any) { console.error('Error fetching appointments:', fetchError); toast.error('Error al cargar las citas.'); } finally { setLoadingAppointments(false); }
  }, [patientData?.id]);

  // --- Efecto para Autenticación y Datos Iniciales ---
  useEffect(() => {
    const checkAuthAndPatientData = async () => { setLoading(true); setError(null); try { const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(); if (authError || !authUser) { toast.error('Sesión no válida. Redirigiendo a login...'); setTimeout(() => { window.location.href = '/login'; }, 1500); return; } setUser(authUser); const { data: patient, error: patientError } = await supabase .from('patients') .select('*') .eq('user_id', authUser.id) .maybeSingle(); if (patientError) { throw new Error("Error al obtener perfil del paciente."); } if (!patient) { setShowPatientForm(true); setLoading(false); } else { setPatientData(patient); setLoyaltyCode(patient.surecode || ''); setShowPatientForm(false); fetchAppointments(patient.id); setLoading(false); } } catch (err: any) { console.error('Error checking auth and patient data:', err); setError(err.message || 'Ocurrió un error inesperado.'); setLoading(false); } }; checkAuthAndPatientData();
  }, [fetchAppointments]);

  // --- Manejo de Cambios en Formularios ---
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target; setFormData(prev => ({ ...prev, [name]: value }));
  };

  // --- Funciones de Cámara ---
  const startCamera = async () => {
    console.log("[Camera] Attempting start..."); if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { toast.error("La cámara no es soportada."); return; } setShowCameraModal(true); try { const constraints = { video: { facingMode: 'user', height: { ideal: 1280 }, width: { ideal: 720 } }, audio: false }; const mediaStream = await navigator.mediaDevices.getUserMedia(constraints); console.log("[Camera] Stream obtained:", mediaStream); setCameraStream(mediaStream); } catch (err: any) { console.error("[Camera] Error starting camera:", err.name, err.message); let errorMsg = `Error de cámara (${err.name}).`; if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") { errorMsg = "Permiso de cámara denegado. Habilítalo en tu navegador."; } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") { errorMsg = "No se encontró ninguna cámara conectada."; } else if (err.name === "NotReadableError" || err.name === "TrackStartError") { errorMsg = "La cámara está ocupada o hubo un error de hardware."; } else if (err.name === "OverconstrainedError" || err.name === "ConstraintNotSatisfiedError") { errorMsg = "La cámara no soporta la configuración solicitada."; } toast.error(errorMsg); setShowCameraModal(false); setCameraStream(null); }
  };

  const stopCamera = useCallback(() => {
    console.log("[Camera] Stopping..."); if (cameraStream) { cameraStream.getTracks().forEach(track => track.stop()); console.log("[Camera] Tracks stopped."); } if (videoRef.current) { videoRef.current.srcObject = null; } setCameraStream(null); setShowCameraModal(false);
  }, [cameraStream]);

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current && cameraStream) { const video = videoRef.current; const canvas = canvasRef.current; const context = canvas.getContext('2d'); if (context) { canvas.width = video.videoWidth; canvas.height = video.videoHeight; context.translate(canvas.width, 0); context.scale(-1, 1); context.drawImage(video, 0, 0, canvas.width, canvas.height); context.setTransform(1, 0, 0, 1, 0, 0); const dataUrl = canvas.toDataURL('image/png'); setCapturedImage(dataUrl); stopCamera(); } else { toast.error("Error interno del canvas."); stopCamera(); } } else { toast.error("Error: Video o canvas no listos."); stopCamera(); }
  };

  // --- Efecto para Conectar Stream a Video ---
  useEffect(() => {
    if (cameraStream && videoRef.current) { console.log("[Camera Effect] Asignando srcObject."); videoRef.current.srcObject = cameraStream; videoRef.current.play().catch(playError => { console.error("[Camera Effect] Error al reproducir:", playError); toast.error("No se pudo iniciar la vista previa."); }); } else { console.log("[Camera Effect] No se asigna srcObject."); }
  }, [cameraStream]);

  // --- Función para Subir Foto ---
  const uploadPhoto = async (imageDataUrl: string): Promise<string | null> => {
      if (!user) { toast.error("Usuario no autenticado."); return null; }
      const blob = dataURLtoBlob(imageDataUrl);
      if (!blob) { toast.error("Error al procesar la imagen."); return null; }
      setIsUploadingPhoto(true);
      try {
          const fileExt = blob.type.split('/')[1] || 'png';
          const fileName = `${user.id}-${Date.now()}.${fileExt}`;
          const filePath = `${fileName}`; // O `private/${fileName}`
          // --- ¡¡¡ REEMPLAZA 'patients_photos' CON TU BUCKET !!! ---
          const bucketName = 'patients_photos';
          console.log(`Subiendo a bucket: ${bucketName}, ruta: ${filePath}`);
          const { data, error: uploadError } = await supabase.storage
              .from(bucketName)
              .upload(filePath, blob, { cacheControl: '3600', upsert: true, contentType: blob.type });
          if (uploadError) { console.error("Error de subida Supabase:", uploadError); throw uploadError; }
          console.log("Subida exitosa, obteniendo URL pública para:", filePath);
          // --- ¡¡¡ REEMPLAZA 'patients_photos' CON TU BUCKET !!! ---
          const { data: urlData } = supabase.storage
              .from(bucketName)
              .getPublicUrl(filePath);
          if (!urlData?.publicUrl) { console.error("Fallo al obtener URL pública:", urlData); throw new Error("No se pudo obtener la URL pública."); }
          console.log("URL Pública:", urlData.publicUrl);
          toast.success("Foto subida.");
          return urlData.publicUrl;
      } catch (error: any) {
          console.error('Error en uploadPhoto:', error);
          toast.error(`Error al subir foto: ${error.message || 'Error desconocido.'}`);
          return null;
      } finally {
          setIsUploadingPhoto(false);
      }
  };

  // --- Envío del Formulario de Creación de Perfil ---
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!user) return; let photoUrl: string | null = null; if (capturedImage) { photoUrl = await uploadPhoto(capturedImage); } try {
      // --- ¡¡¡ REEMPLAZA 'Foto_paciente' SI TU COLUMNA SE LLAMA DIFERENTE !!! ---
      const { data: newPatient, error } = await supabase .from('patients') .insert({ user_id: user.id, email: user.email, name: formData.name, date_of_birth: formData.date_of_birth || null, gender: formData.gender || null, phone: formData.phone || null, created_at: new Date().toISOString(), blood_type: formData.blood_type || null, allergies: formData.allergies || null, Foto_paciente: photoUrl }) .select().single(); if (error) throw error; setPatientData(newPatient); setShowPatientForm(false); toast.success('Perfil guardado!'); fetchAppointments(newPatient.id); } catch (err: any) { console.error('Error saving patient data:', err); toast.error(`Error al guardar perfil: ${err.message || 'Inténtelo de nuevo.'}`); }
  };

  // --- Generación Código Lealtad ---
  const generateLoyaltyCode = async () => {
    if (!patientData || !patientData.id) { toast.error('Datos del paciente no cargados.'); return; } setIsGeneratingCode(true); try { const characters = 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789'; const codeLength = 10; let result = ''; for (let i = 0; i < codeLength; i++) { result += characters.charAt(Math.floor(Math.random() * characters.length)); } const { error } = await supabase.from('patients').update({ surecode: result }).eq('id', patientData.id); if (error) throw error; setLoyaltyCode(result); setPatientData((prev: any) => ({ ...prev, surecode: result })); toast.success('Código generado.'); } catch (err: any) { console.error('Error updating loyalty code:', err); toast.error(`Error al generar código: ${err.message || 'Inténtelo de nuevo.'}`); } finally { setIsGeneratingCode(false); }
  };

  // --- Efecto para Obtener Clima ---
  useEffect(() => {
    const fetchWeather = () => { if (!navigator.geolocation) { console.warn("Geolocation is not supported."); setWeatherData(prev => ({...prev, temp: null, condition: 'Geolocalización no soportada', location: 'Desconocida', icon: <AlertTriangle className="h-5 w-5 text-white" /> })); setLoadingWeather(false); return; } setLoadingWeather(true); navigator.geolocation.getCurrentPosition(async (position) => { const { latitude, longitude } = position.coords; try { const openMeteoApiEndpoint = import.meta.env.VITE_OPENMETEO_API_ENDPOINT || 'https://api.open-meteo.com/v1/forecast'; const weatherApiUrl = `${openMeteoApiEndpoint}?latitude=${latitude}&longitude=${longitude}¤t=temperature_2m,weather_code&timezone=auto`; const response = await fetch(weatherApiUrl); if (!response.ok) { const errorData = await response.json().catch(() => ({})); throw new Error(`Weather API Error ${response.status}: ${errorData?.reason || response.statusText}`); } const data = await response.json(); const getWeatherDetails = (code: number): { condition: string; icon: JSX.Element } => { const conditions: { [key: number]: { condition: string; icon: JSX.Element } } = { 0: { condition: 'Despejado', icon: <Sun className="h-5 w-5 text-white" /> }, 1: { condition: 'Mayormente despejado', icon: <Sun className="h-5 w-5 text-white" /> }, 2: { condition: 'Parcialmente nublado', icon: <Cloud className="h-5 w-5 text-white" /> }, 3: { condition: 'Nublado', icon: <Cloud className="h-5 w-5 text-white" /> }, 45: { condition: 'Niebla', icon: <CloudFog className="h-5 w-5 text-white" /> }, 48: { condition: 'Niebla engelante', icon: <CloudFog className="h-5 w-5 text-white" /> }, 51: { condition: 'Llovizna ligera', icon: <CloudDrizzle className="h-5 w-5 text-white" /> }, 53: { condition: 'Llovizna moderada', icon: <CloudDrizzle className="h-5 w-5 text-white" /> }, 55: { condition: 'Llovizna densa', icon: <CloudRain className="h-5 w-5 text-white" /> }, 61: { condition: 'Lluvia ligera', icon: <CloudRain className="h-5 w-5 text-white" /> }, 63: { condition: 'Lluvia moderada', icon: <CloudRain className="h-5 w-5 text-white" /> }, 65: { condition: 'Lluvia fuerte', icon: <CloudRain className="h-5 w-5 text-white" /> }, 71: { condition: 'Nieve ligera', icon: <Snowflake className="h-5 w-5 text-white" /> }, 73: { condition: 'Nieve moderada', icon: <Snowflake className="h-5 w-5 text-white" /> }, 75: { condition: 'Nieve fuerte', icon: <Snowflake className="h-5 w-5 text-white" /> }, 80: { condition: 'Chubascos ligeros', icon: <CloudRain className="h-5 w-5 text-white" /> }, 81: { condition: 'Chubascos moderados', icon: <CloudRain className="h-5 w-5 text-white" /> }, 82: { condition: 'Chubascos violentos', icon: <CloudRain className="h-5 w-5 text-white" /> }, 95: { condition: 'Tormenta', icon: <CloudLightning className="h-5 w-5 text-white" /> }, 96: { condition: 'Tormenta c/ granizo ligero', icon: <CloudLightning className="h-5 w-5 text-white" /> }, 99: { condition: 'Tormenta c/ granizo fuerte', icon: <CloudLightning className="h-5 w-5 text-white" /> }, }; return conditions[code] ?? { condition: 'No disponible', icon: <Cloud className="h-5 w-5 text-white" /> }; }; if (data?.current) { const details = getWeatherDetails(data.current.weather_code); setWeatherData({ temp: Math.round(data.current.temperature_2m), condition: details.condition, icon: details.icon, location: 'Tu ubicación', day: new Date().toLocaleDateString('es-ES', { weekday: 'long' }), }); } else { throw new Error("Datos del clima inválidos."); } } catch (fetchError: any) { console.error('Error fetching weather data:', fetchError); setWeatherData(prev => ({ ...prev, temp: null, condition: 'Error al cargar', location: 'Desconocida', icon: <AlertTriangle className="h-5 w-5 text-white" />, })); } finally { setLoadingWeather(false); } }, (geoError) => { console.error("Geolocation error: ", geoError); setWeatherData(prev => ({ ...prev, temp: null, condition: 'Ubicación denegada', location: 'Desconocida', icon: <MapPin className="h-5 w-5 text-white" /> })); setLoadingWeather(false); }); }; fetchWeather();
  }, []);

  // --- Efecto para Notificación de Perfil Incompleto (Foto) ---
  useEffect(() => {
    if (!loading && !error && patientData) {
        if (!patientData.Foto_paciente) {
            console.log("[Notification] Profile picture missing, showing toast.");
            toast(
                (t) => (
                  <span className="flex items-center">
                    <Info size={18} className="mr-2 text-blue-500 shrink-0" />
                    <span className="flex-1">
                        Completa tu perfil añadiendo una foto.
                    </span>
                    <button onClick={() => toast.dismiss(t.id)} className="ml-3 p-1 rounded-full hover:bg-gray-200 text-gray-500 hover:text-gray-700">
                        <X size={16} />
                    </button>
                  </span>
                ),
                { id: 'profile-incomplete-toast', duration: 8000, position: "bottom-center", style: { border: '1px solid #e0e0e0', padding: '12px', maxWidth: '500px' } }
            );
        } else {
            console.log("[Notification] Profile picture exists, dismissing toast.");
            toast.dismiss('profile-incomplete-toast');
        }
    } else if (!loading && !error && !patientData) {
         toast.dismiss('profile-incomplete-toast');
    }
  }, [loading, error, patientData]);

  // --- Manejadores UI ---
  const handleViewChange = (view: string) => { setCurrentView(view); setMobileMenuOpen(false); };
  const formatDate = (dateString: string | null | undefined): string => { if (!dateString) return 'No programada'; try { const date = new Date(dateString); if (isNaN(date.getTime())) return 'Fecha inválida'; return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { console.error("Error formatting date:", dateString, e); return 'Error fecha'; } };
  const formatTime = (timeString: string | null | undefined): string => { if (!timeString) return '--:--'; try { const [hour, minute] = timeString.split(':'); if (hour && minute) { const h = parseInt(hour, 10); const m = parseInt(minute, 10); if (!isNaN(h) && !isNaN(m)) { return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`; } } } catch(e) { console.error("Error formatting time:", timeString, e); } return timeString; };
  const toggleMobileMenu = () => { setMobileMenuOpen(!mobileMenuOpen); };

  // --- Efecto Limpieza Cámara ---
  useEffect(() => { return () => { if (cameraStream) { stopCamera(); } }; }, [cameraStream, stopCamera]);

  // --- Lógica de Renderizado ---
  if (loading) { return <div className="min-h-screen flex items-center justify-center bg-gray-100"><div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-primary"></div></div>; }
  if (error) { return <div className="min-h-screen flex flex-col items-center justify-center bg-red-50 p-4 text-center"><AlertTriangle className="h-12 w-12 text-red-500 mb-4" /><h2 className="text-xl font-semibold text-red-700 mb-2">Ocurrió un Error</h2><p className="text-red-600 mb-6">{error}</p><button onClick={() => window.location.reload()} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors">Intentar de Nuevo</button></div>; }

  // --- Formulario Creación de Perfil ---
  if (showPatientForm) {
    return (
        <div className="min-h-screen bg-gradient-to-br from-primary/5 via-white to-accent/5 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-lg w-full border border-gray-100">
                 <div className="flex flex-col items-center justify-center mb-8 text-center"> <User className="h-16 w-16 text-primary mb-4" /> <h2 className="text-3xl font-bold text-gray-800">Completa tu perfil</h2> <p className="text-gray-600 mt-2">Necesitamos algunos datos.</p> </div>
                <form onSubmit={handleFormSubmit} className="space-y-5">
                    <div><label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1.5">Nombre completo*</label><input id="name" type="text" name="name" value={formData.name} onChange={handleFormChange} required className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors" placeholder="Ej: Ana García López"/></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5"> <div><label htmlFor="date_of_birth" className="block text-sm font-medium text-gray-700 mb-1.5">Fecha de nacimiento</label><input id="date_of_birth" type="date" name="date_of_birth" value={formData.date_of_birth} onChange={handleFormChange} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors" max={new Date().toISOString().split("T")[0]}/></div> <div><label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-1.5">Género</label><select id="gender" name="gender" value={formData.gender} onChange={handleFormChange} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors bg-white appearance-none"><option value="">Seleccionar...</option><option value="Masculino">Masculino</option><option value="Femenino">Femenino</option><option value="Otro">Otro</option><option value="Prefiero no decir">Prefiero no decir</option></select></div> </div>
                    <div><label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1.5">Teléfono</label><input id="phone" type="tel" name="phone" value={formData.phone} onChange={handleFormChange} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors" placeholder="Ej: 55 1234 5678"/></div>
                    <div> <label htmlFor="blood_type" className="block text-sm font-medium text-gray-700 mb-1.5">Tipo de sangre</label> <select id="blood_type" name="blood_type" value={formData.blood_type} onChange={handleFormChange} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors bg-white appearance-none"> <option value="">Seleccionar...</option> <option value="A+">A+</option> <option value="A-">A-</option> <option value="AB+">AB+</option> <option value="AB-">AB-</option> <option value="B+">B+</option> <option value="B-">B-</option> <option value="O+">O+</option> <option value="O-">O-</option> <option value="Desconocido">No lo sé</option> </select> </div>
                    <div> <label htmlFor="allergies" className="block text-sm font-medium text-gray-700 mb-1.5">Alergias conocidas</label> <textarea id="allergies" name="allergies" value={formData.allergies} onChange={handleFormChange} rows={3} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors" placeholder="Ej: Penicilina, Cacahuetes, Polvo..." /> </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Foto de perfil (Opcional)</label>
                        <div className="mt-1 flex items-center space-x-4">
                            {capturedImage ? ( <img src={capturedImage} alt="Foto Capturada" className="h-20 w-20 rounded-full object-cover border-2 border-primary shadow-sm" /> ) : ( <span className="inline-block h-20 w-20 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center border"> <User className="h-12 w-12 text-gray-300" /> </span> )}
                            <button type="button" onClick={startCamera} className="ml-5 bg-white py-2 px-3 border border-gray-300 rounded-md shadow-sm text-sm leading-4 font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary flex items-center gap-1.5"> <Camera className="h-4 w-4" aria-hidden="true" /> {capturedImage ? 'Tomar Otra' : 'Tomar Foto'} </button>
                        </div>
                        {isUploadingPhoto && ( <div className="mt-2 flex items-center text-sm text-gray-500"> <UploadCloud className="animate-pulse h-4 w-4 mr-1" /> Subiendo foto... </div> )}
                    </div>
                    <div className="pt-4"> <button type="submit" disabled={isUploadingPhoto} className="w-full bg-primary text-white py-3 px-4 rounded-lg hover:bg-primary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 font-semibold text-lg shadow-md hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"> {isUploadingPhoto ? 'Guardando...' : 'Guardar y Continuar'} </button> </div>
                </form>
                 <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
                 {showCameraModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4">
                        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-xl max-w-sm w-full mx-auto">
                            <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4 text-center">Capturar Foto</h3>
                            <div className="relative w-full aspect-[9/16] bg-gray-800 rounded overflow-hidden mb-4 border border-gray-300">
                                <video ref={videoRef} playsInline className="absolute inset-0 w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} ></video>
                                {!cameraStream && <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">Iniciando cámara...</div>}
                            </div>
                            <div className="flex justify-center space-x-4">
                                <button type="button" onClick={capturePhoto} disabled={!cameraStream} className="inline-flex items-center justify-center px-5 py-2 border border-transparent rounded-full shadow-sm text-base font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"> <Camera className="h-5 w-5" /> </button>
                                <button type="button" onClick={stopCamera} className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"> Cancelar </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
  }

  // --- Interfaz Principal Paciente ---
  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-30 border-b border-gray-200">
          <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center"> <div className="flex items-center gap-3"> <img src="/logo.png" alt="Carelux Logo" className="h-10 w-auto"/> <h1 className="text-xl font-semibold text-gray-800 hidden sm:block">Portal Paciente</h1> </div> <button className="p-2 rounded-md text-gray-600 hover:text-primary hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary lg:hidden" onClick={toggleMobileMenu} aria-label="Abrir menú"><Menu className="h-6 w-6" /></button> </div>
      </header>
      {/* Contenido Principal */}
      <main className="flex-1 pt-6 pb-24 lg:pb-8">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
            {/* Sidebar */}
            <aside className="lg:col-span-3 xl:col-span-2 hidden lg:block">
                <div className="sticky top-20 bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-1.5">{[ { view: 'home', label: 'Inicio', icon: Home }, { view: 'appointments', label: 'Calendario', icon: CalendarIcon }, { view: 'medications', label: 'Recetas', icon: FileText }, { view: 'EREBUS', label: 'EREBUS', icon: FileText }, { view: 'pharmacies', label: 'Farmacias', icon: Package2 }, { view: 'profile', label: 'Perfil', icon: User }, ].map(item => ( <button key={item.view} className={`w-full flex items-center space-x-3 p-3 text-sm rounded-lg transition-colors duration-150 ${ currentView === item.view ? 'bg-primary/10 text-primary font-semibold' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800' }`} onClick={() => handleViewChange(item.view)}> <item.icon className="h-5 w-5 flex-shrink-0" /> <span>{item.label}</span> </button> ))}</div>
            </aside>
             {/* Menú Móvil */}
            {mobileMenuOpen && ( <> <div className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden" onClick={toggleMobileMenu} aria-hidden="true"></div><div className="fixed inset-y-0 left-0 max-w-xs w-full bg-white shadow-xl z-40 lg:hidden flex flex-col" ><div className="p-4 border-b border-gray-200 flex items-center justify-between"><div className="flex items-center gap-2"><img src="/logo.png" alt="Logo" className="h-8 w-auto"/><span className="text-lg font-semibold text-gray-800">Menú</span></div><button className="p-2 -mr-2 rounded-md text-gray-500 hover:bg-gray-100" onClick={toggleMobileMenu} aria-label="Cerrar menú"> <X className="h-6 w-6" /> </button></div><nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">{[ { view: 'home', label: 'Inicio', icon: Home }, { view: 'appointments', label: 'Calendario', icon: CalendarIcon }, { view: 'medications', label: 'Recetas', icon: FileText }, { view: 'EREBUS', label: 'EREBUS', icon: FileText }, { view: 'pharmacies', label: 'Farmacias', icon: Package2 }, { view: 'profile', label: 'Perfil', icon: User }, ].map(item => ( <button key={item.view} className={`w-full flex items-center space-x-3 p-3 text-sm rounded-lg transition-colors duration-150 ${ currentView === item.view ? 'bg-primary/10 text-primary font-semibold' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800' }`} onClick={() => handleViewChange(item.view)}> <item.icon className="h-5 w-5 flex-shrink-0" /> <span>{item.label}</span> </button> ))} </nav></div></> )}
            {/* Navegación Inferior Móvil */}
            <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-20 lg:hidden shadow-[0_-2px_5px_rgba(0,0,0,0.05)]"> <div className="grid grid-cols-6 h-16">{[ { view: 'home', label: 'Inicio', icon: Home }, { view: 'appointments', label: 'Citas', icon: CalendarIcon }, { view: 'medications', label: 'Recetas', icon: FileText }, { view: 'EREBUS', label: 'EREBUS', icon: FileText }, { view: 'pharmacies', label: 'Farmacias', icon: Package2 }, { view: 'profile', label: 'Perfil', icon: User }, ].map(item => ( <button key={item.view} className={`flex flex-col items-center justify-center pt-1 transition-colors duration-150 ${ currentView === item.view ? 'text-primary' : 'text-gray-500 hover:text-primary' }`} onClick={() => handleViewChange(item.view)} aria-label={item.label}> <item.icon className="h-5 w-5 mb-0.5" /> <span className="text-[10px] font-medium tracking-tight text-center leading-tight">{item.label}</span> </button> ))} </div> </nav>
            {/* Área Contenido Principal */}
            <div className="lg:col-span-9 xl:col-span-10 space-y-6">
              {/* Contenido Vista Home */}
              {currentView === 'home' && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    <div className="bg-gradient-to-br from-primary to-blue-600 rounded-xl shadow-lg p-5 text-white"> <div className="flex justify-between items-start mb-3"> <div> <p className="text-sm font-medium opacity-90">Hola de nuevo,</p> <h2 className="text-2xl font-bold truncate"> {patientData?.name ?? 'Paciente'} </h2> <p className="text-xs opacity-80 mt-1 flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</p> </div> <div className="flex-shrink-0 h-11 w-11 bg-white/20 rounded-full flex items-center justify-center ring-2 ring-white/30"><Sunrise className="h-6 w-6" /></div> </div> <p className="text-xs opacity-90 mt-2">¡Que tengas un excelente día!</p> </div>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 cursor-pointer hover:shadow-md transition-shadow group" onClick={() => handleViewChange('appointments')} role="button" tabIndex={0} aria-label="Ver próxima cita"> <div className="flex justify-between items-start mb-3"> <div> <p className="text-sm text-gray-500 font-medium">Próxima Cita</p> <h2 className="text-xl font-bold text-gray-800">{formatDate(patientData?.proxima_consulta)}</h2> <p className="text-xs text-gray-500 mt-1 truncate">Ver detalles en Calendario</p> </div> <div className="flex-shrink-0 h-11 w-11 bg-gradient-to-br from-accent/80 to-accent rounded-full flex items-center justify-center shadow transition-transform duration-300 group-hover:scale-110"><CalendarIcon className="h-5 w-5 text-white" /></div> </div> <span className="text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">Ver detalles</span> </div>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5"> <div className="flex justify-between items-start mb-3"> <div> <p className="text-sm text-gray-500 font-medium capitalize">{weatherData.day}</p> <h2 className="text-xl font-bold text-gray-800">{loadingWeather ? '...' : (weatherData.temp !== null ? `${weatherData.temp}°C` : '--')}</h2> <p className="text-xs text-gray-500 mt-1 truncate">{weatherData.condition} • {weatherData.location}</p> </div> <div className={`flex-shrink-0 h-11 w-11 rounded-full flex items-center justify-center shadow ${loadingWeather ? 'bg-gray-400 animate-pulse' : 'bg-gradient-to-br from-blue-400 to-cyan-400'}`}>{weatherData.icon}</div> </div> <p className="text-xs text-gray-500">Clima actual en tu zona.</p> </div>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-200 flex justify-between items-center"> <h3 className="text-lg font-semibold text-gray-800">Citas Próximas</h3> <button className="text-sm font-medium text-primary hover:text-primary/80 focus:outline-none" onClick={() => handleViewChange('appointments')}> Ver todas </button> </div>
                    {loadingAppointments ? ( <div className="h-40 flex items-center justify-center text-gray-500">Cargando citas...</div> ) : appointments.length > 0 ? ( <div className="overflow-x-auto"> <table className="min-w-full divide-y divide-gray-200"> <thead className="bg-gray-50/50"> <tr> <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th> <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hora</th> <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Tipo</th> <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Doctor</th> </tr> </thead> <tbody className="bg-white divide-y divide-gray-200"> {appointments.slice(0, 4).map((appt) => ( <tr key={appt.id} className="hover:bg-gray-50 transition-colors"> <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800">{formatDate(appt.appointment_date)}</td> <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{formatTime(appt.appointment_time)}</td> <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 hidden md:table-cell">{appt.tipo_consulta || 'General'}</td> <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{appt.doctor_name || 'No asignado'}</td> </tr> ))} </tbody> </table> </div> ) : ( <div className="h-40 flex flex-col items-center justify-center text-center px-6 py-4"><CalendarIcon className="h-10 w-10 text-gray-400 mb-3" /><p className="text-sm text-gray-500">No tienes citas programadas próximamente.</p><button onClick={() => handleViewChange('appointments')} className="mt-3 text-sm font-medium text-primary hover:underline">Agendar una cita</button></div> )}
                 </div>
                </>
              )}
              {/* Panel Contenido Otras Vistas */}
              {currentView !== 'home' && currentView !== 'profile' && (
                <ContentPanel view={currentView as any} patientId={patientData?.id} onClose={() => handleViewChange('home')} />
              )}
              {/* Contenido Vista Perfil */}
              {currentView === 'profile' && patientData && (
                <div className="space-y-6">
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 md:p-6"> <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6"><div><h3 className="text-lg font-semibold text-gray-800 mb-1">Código de Identificación</h3><p className="text-sm text-gray-600 mb-3">Usa este código para identificarte rápidamente.</p><p className="text-2xl font-bold text-primary font-mono tracking-widest bg-gray-100 px-4 py-2 rounded-md inline-block break-all">{patientData?.surecode || loyaltyCode || 'No Generado'}</p></div><div className="flex flex-col sm:flex-row md:flex-col gap-3 mt-2 md:mt-0 flex-shrink-0">{(!patientData?.surecode && !loyaltyCode) && ( <button onClick={generateLoyaltyCode} disabled={isGeneratingCode} className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 text-sm font-medium shadow disabled:opacity-70 disabled:cursor-not-allowed"> {isGeneratingCode ? ( <> <span className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></span><span>Generando...</span> </> ) : ( <> <QrCode className="h-4 w-4" /> <span>Generar Código</span> </>)} </button> )}{(patientData?.surecode || loyaltyCode) && ( <button onClick={() => setShowBarcode((prev) => !prev)} className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 text-sm font-medium"> <QrCode className="h-4 w-4" /> <span>{showBarcode ? 'Ocultar Barras' : 'Mostrar Barras'}</span> </button> )}</div></div>{(patientData?.surecode || loyaltyCode) && showBarcode && ( <div className="mt-6 p-4 bg-white rounded-lg border border-gray-200 overflow-x-auto max-w-md mx-auto flex justify-center"> <Barcode value={patientData?.surecode || loyaltyCode} width={1.8} height={60} margin={10} displayValue={false} background="#ffffff" lineColor="#000000" /> </div> )}</div>
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                     <div className="px-5 py-4 border-b border-gray-200 sm:px-6 flex justify-between items-center"> <h3 className="text-lg font-semibold text-gray-800">Información Personal</h3> </div>
                     <div className="px-5 py-5 sm:px-6 grid grid-cols-1 sm:grid-cols-3 gap-6">
                        <div className="sm:col-span-1 flex flex-col items-center sm:items-start"> <dt className="text-sm font-medium text-gray-500 mb-2">Foto de perfil</dt> {patientData?.Foto_paciente ? ( <img src={patientData.Foto_paciente} alt="Foto de perfil" className="h-32 w-32 rounded-full object-cover border-2 border-gray-200 shadow-sm" onError={(e) => { e.currentTarget.src = '/placeholder-user.png'; }} /> ) : ( <div className="h-32 w-32 rounded-full bg-gray-100 flex items-center justify-center border"> <User className="h-16 w-16 text-gray-400" /> </div> )} </div>
                        <dl className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
                            {[ { label: 'Nombre completo', value: patientData?.name }, { label: 'Fecha de nacimiento', value: formatDate(patientData?.date_of_birth) }, { label: 'Correo electrónico', value: patientData?.email || user?.email }, { label: 'Teléfono', value: patientData?.phone }, { label: 'Género', value: patientData?.gender }, { label: 'Tipo de sangre', value: patientData?.blood_type }, { label: 'Alergias', value: patientData?.allergies }, ].map(item => item.value && item.value !== 'Fecha inválida' && item.value !== 'No programada' ? ( <div key={item.label} className={`${item.label === 'Alergias' ? 'sm:col-span-2' : 'sm:col-span-1'}`}> <dt className="text-sm font-medium text-gray-500">{item.label}</dt> <dd className={`mt-1 text-sm text-gray-900 ${item.label === 'Alergias' ? 'whitespace-pre-wrap' : ''}`}>{item.value}</dd> </div> ) : item.label === 'Nombre completo' || item.label === 'Correo electrónico' ? ( <div key={item.label} className="sm:col-span-1"><dt className="text-sm font-medium text-gray-500">{item.label}</dt><dd className="mt-1 text-sm text-gray-500 italic">No disponible</dd></div> ) : null)}
                        </dl>
                     </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Paciente_Interfaz;
