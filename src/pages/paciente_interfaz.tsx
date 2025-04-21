import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Home, Calendar as CalendarIcon, Package2, FileText, Clock, Sunrise, QrCode, Menu, X, User,
  MapPin, ArrowLeft, Sun, Moon, Cloud, CloudFog, CloudDrizzle, CloudLightning, Snowflake,
  Info, AlertTriangle, CloudRain, Camera, UploadCloud, CheckCircle // Added Camera icons
} from 'lucide-react';
import Barcode from 'react-barcode';
import ContentPanel from '../components/paciente/ContentPanel'; // Assuming path is correct
import supabase from '../lib/supabaseClient';
import toast from 'react-hot-toast';

// Helper function to convert Base64 Data URL to Blob/File
function dataURLtoBlob(dataurl: string): Blob | null {
    try {
        const arr = dataurl.split(',');
        if (arr.length < 2) return null;
        const mimeMatch = arr[0].match(/:(.*?);/);
        if (!mimeMatch || mimeMatch.length < 2) return null;
        const mime = mimeMatch[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while(n--){ u8arr[n] = bstr.charCodeAt(n); }
        return new Blob([u8arr], {type:mime});
    } catch (e) { console.error("Error converting data URL to Blob:", e); return null; }
}

// --- Component Definition ---
const Paciente_Interfaz: React.FC = () => {
  // --- State Variables ---
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

  // --- Camera State ---
  const [showCameraModal, setShowCameraModal] = useState<boolean>(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // --- Weather State ---
  const [weatherData, setWeatherData] = useState<{ temp: number | null; condition: string; location: string; day: string; icon: JSX.Element; }>({ temp: null, condition: 'Cargando...', location: 'Obteniendo ubicación...', day: new Date().toLocaleDateString('es-ES', { weekday: 'long' }), icon: <Cloud className="h-5 w-5 text-white" /> });
  const [loadingWeather, setLoadingWeather] = useState<boolean>(true);

  // --- Fetch Appointments Function ---
  const fetchAppointments = useCallback(async (patientId: string | null = null) => { /* ... function unchanged ... */
    const idToFetch = patientId || patientData?.id; if (!idToFetch) { setLoadingAppointments(false); return; } setLoadingAppointments(true); try { const { data, error } = await supabase .from('appointments') .select(`id, appointment_date, appointment_time, tipo_consulta, doctors ( name )`) .eq('patient_id', idToFetch) .order('appointment_date', { ascending: true }) .order('appointment_time', { ascending: true }); if (error) throw error; const processedAppointments = data?.map(appt => ({ ...appt, doctor_name: appt.doctors?.name || 'Dr. Asignado' })) || []; setAppointments(processedAppointments); } catch (fetchError: any) { console.error('Error fetching appointments:', fetchError); toast.error('Error al cargar las citas.'); } finally { setLoadingAppointments(false); }
  }, [patientData?.id]);

  // --- Authentication and Patient Data Check ---
  useEffect(() => { /* ... function unchanged ... */
    const checkAuthAndPatientData = async () => { setLoading(true); setError(null); try { const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(); if (authError || !authUser) { toast.error('Sesión no válida. Redirigiendo a login...'); setTimeout(() => { window.location.href = '/login'; }, 1500); return; } setUser(authUser); const { data: patient, error: patientError } = await supabase .from('patients') .select('*') .eq('user_id', authUser.id) .maybeSingle(); if (patientError) { throw new Error("Error al obtener perfil del paciente."); } if (!patient) { setShowPatientForm(true); setLoading(false); } else { setPatientData(patient); setLoyaltyCode(patient.surecode || ''); setShowPatientForm(false); fetchAppointments(patient.id); setLoading(false); } } catch (err: any) { console.error('Error checking auth and patient data:', err); setError(err.message || 'Ocurrió un error inesperado.'); setLoading(false); } }; checkAuthAndPatientData();
  }, [fetchAppointments]);

  // --- Form Handling ---
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => { /* ... function unchanged ... */
    const { name, value } = e.target; setFormData(prev => ({ ...prev, [name]: value }));
  };

  // --- Camera Handling ---
  const startCamera = async () => {
    console.log("Intentando iniciar cámara...");
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
            // Solicitar preferentemente vertical (ideal, no garantizado)
            const constraints = {
                video: {
                    facingMode: "user",
                    // Sugerir proporción vertical
                    height: { ideal: 1280 },
                    width: { ideal: 720 }
                 },
                 audio: false
            };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            console.log("Stream obtenido:", stream);
            setCameraStream(stream);

            if (videoRef.current) {
                console.log("Asignando srcObject al videoRef:", videoRef.current);
                videoRef.current.srcObject = stream;
                 // --- LLAMAR A play() ES CLAVE ---
                videoRef.current.play().then(() => {
                    console.log("Reproducción iniciada.");
                    // Abrir modal sólo después de confirmar que el video puede empezar
                    setShowCameraModal(true);
                }).catch(playError => {
                    console.error("Error al intentar reproducir el video:", playError);
                    toast.error("No se pudo iniciar la cámara. Verifica los permisos.");
                    stopCamera(); // Limpia y cierra si falla
                });
            } else {
                console.error("videoRef.current es null al intentar asignar srcObject");
                stream.getTracks().forEach(track => track.stop()); // Detiene el stream si no hay video element
                setCameraStream(null);
            }
        } catch (err: any) {
            console.error("Error en getUserMedia:", err);
            let userMessage = `Error al acceder a la cámara: ${err.name}`;
            if (err.name === 'NotAllowedError') {
                userMessage = "Permiso de cámara denegado. Revísalo en la configuración de tu navegador.";
            } else if (err.name === 'NotFoundError') {
                userMessage = "No se encontró una cámara compatible.";
            }
            toast.error(userMessage);
            setShowCameraModal(false); // Asegurar que el modal no quede abierto
        }
    } else {
        toast.error("La cámara no es soportada por este navegador.");
    }
  };

  const stopCamera = useCallback(() => { // Usar useCallback si se pasa como prop
      console.log("Deteniendo cámara...");
      if (cameraStream) {
          cameraStream.getTracks().forEach(track => track.stop());
          setCameraStream(null);
      }
       // Asegurar que el video se limpie
      if (videoRef.current) {
          videoRef.current.srcObject = null;
      }
      setShowCameraModal(false); // Cierra el modal
  }, [cameraStream]); // Depende del stream

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current && cameraStream) {
        const video = videoRef.current; const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (context) {
            // Ajustar canvas a la resolución REAL del video (puede no ser la ideal solicitada)
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            // Dibujar el frame (invertido horizontalmente para que coincida con la preview)
            context.translate(canvas.width, 0);
            context.scale(-1, 1);
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            context.setTransform(1, 0, 0, 1, 0, 0); // Reset transform

            const dataUrl = canvas.toDataURL('image/png');
            setCapturedImage(dataUrl);
            stopCamera(); // Detiene y cierra el modal
        } else { toast.error("Error interno del canvas."); stopCamera(); }
    } else { toast.error("Error: Video o canvas no listos."); stopCamera(); }
  };

  // --- Photo Upload Function ---
  const uploadPhoto = async (imageDataUrl: string): Promise<string | null> => { /* ... function unchanged ... */
    if (!user) { toast.error("Usuario no autenticado."); return null; } const blob = dataURLtoBlob(imageDataUrl); if (!blob) { toast.error("Error al procesar la imagen."); return null; } setIsUploadingPhoto(true); try { const fileExt = blob.type.split('/')[1] || 'png'; const fileName = `${user.id}-${Date.now()}.${fileExt}`; const filePath = `${fileName}`; // O `private/${fileName}` si usas esa carpeta y política /* --- CAMBIA 'patient-photos' POR TU BUCKET --- */ const { data, error: uploadError } = await supabase.storage .from('patient-photos') .upload(filePath, blob, { cacheControl: '3600', upsert: true, contentType: blob.type }); if (uploadError) { throw uploadError; } /* --- CAMBIA 'patient-photos' POR TU BUCKET --- */ const { data: urlData } = supabase.storage .from('patient-photos') .getPublicUrl(filePath); if (!urlData?.publicUrl) { throw new Error("No se pudo obtener la URL pública."); } toast.success("Foto subida."); return urlData.publicUrl; } catch (error: any) { console.error('Error uploading photo:', error); toast.error(`Error al subir la foto: ${error.message}`); return null; } finally { setIsUploadingPhoto(false); }
  };

  // --- Form Submit ---
  const handleFormSubmit = async (e: React.FormEvent) => { /* ... function unchanged ... */
    e.preventDefault(); if (!user) return; let photoUrl: string | null = null; if (capturedImage) { photoUrl = await uploadPhoto(capturedImage); } try { /* --- CAMBIA 'Foto_paciente' SI TU COLUMNA SE LLAMA DIFERENTE --- */ const { data: newPatient, error } = await supabase .from('patients') .insert({ user_id: user.id, email: user.email, name: formData.name, date_of_birth: formData.date_of_birth || null, gender: formData.gender || null, phone: formData.phone || null, created_at: new Date().toISOString(), blood_type: formData.blood_type || null, allergies: formData.allergies || null, Foto_paciente: photoUrl }) .select().single(); if (error) throw error; setPatientData(newPatient); setShowPatientForm(false); toast.success('Perfil guardado!'); fetchAppointments(newPatient.id); } catch (err: any) { console.error('Error saving patient data:', err); toast.error(`Error al guardar perfil: ${err.message || 'Inténtelo de nuevo.'}`); }
  };

  // --- Loyalty Code Generation ---
  const generateLoyaltyCode = async () => { /* ... function unchanged ... */
    if (!patientData || !patientData.id) { toast.error('Datos del paciente no cargados.'); return; } setIsGeneratingCode(true); try { const characters = 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789'; const codeLength = 10; let result = ''; for (let i = 0; i < codeLength; i++) { result += characters.charAt(Math.floor(Math.random() * characters.length)); } const { error } = await supabase.from('patients').update({ surecode: result }).eq('id', patientData.id); if (error) throw error; setLoyaltyCode(result); setPatientData((prev: any) => ({ ...prev, surecode: result })); toast.success('Código generado.'); } catch (err: any) { console.error('Error updating loyalty code:', err); toast.error(`Error al generar código: ${err.message || 'Inténtelo de nuevo.'}`); } finally { setIsGeneratingCode(false); }
  };

  // --- Weather Fetching Effect ---
  useEffect(() => { /* ... function unchanged ... */
    const fetchWeather = () => { if (!navigator.geolocation) { console.warn("Geolocation is not supported."); setWeatherData(prev => ({...prev, temp: null, condition: 'Geolocalización no soportada', location: 'Desconocida', icon: <AlertTriangle className="h-5 w-5 text-white" /> })); setLoadingWeather(false); return; } setLoadingWeather(true); navigator.geolocation.getCurrentPosition(async (position) => { const { latitude, longitude } = position.coords; try { const openMeteoApiEndpoint = import.meta.env.VITE_OPENMETEO_API_ENDPOINT || 'https://api.open-meteo.com/v1/forecast'; const weatherApiUrl = `${openMeteoApiEndpoint}?latitude=${latitude}&longitude=${longitude}¤t=temperature_2m,weather_code&timezone=auto`; const response = await fetch(weatherApiUrl); if (!response.ok) { const errorData = await response.json().catch(() => ({})); throw new Error(`Weather API Error ${response.status}: ${errorData?.reason || response.statusText}`); } const data = await response.json(); const getWeatherDetails = (code: number): { condition: string; icon: JSX.Element } => { const conditions: { [key: number]: { condition: string; icon: JSX.Element } } = { 0: { condition: 'Despejado', icon: <Sun className="h-5 w-5 text-white" /> }, 1: { condition: 'Mayormente despejado', icon: <Sun className="h-5 w-5 text-white" /> }, 2: { condition: 'Parcialmente nublado', icon: <Cloud className="h-5 w-5 text-white" /> }, 3: { condition: 'Nublado', icon: <Cloud className="h-5 w-5 text-white" /> }, 45: { condition: 'Niebla', icon: <CloudFog className="h-5 w-5 text-white" /> }, 48: { condition: 'Niebla engelante', icon: <CloudFog className="h-5 w-5 text-white" /> }, 51: { condition: 'Llovizna ligera', icon: <CloudDrizzle className="h-5 w-5 text-white" /> }, 53: { condition: 'Llovizna moderada', icon: <CloudDrizzle className="h-5 w-5 text-white" /> }, 55: { condition: 'Llovizna densa', icon: <CloudRain className="h-5 w-5 text-white" /> }, 61: { condition: 'Lluvia ligera', icon: <CloudRain className="h-5 w-5 text-white" /> }, 63: { condition: 'Lluvia moderada', icon: <CloudRain className="h-5 w-5 text-white" /> }, 65: { condition: 'Lluvia fuerte', icon: <CloudRain className="h-5 w-5 text-white" /> }, 71: { condition: 'Nieve ligera', icon: <Snowflake className="h-5 w-5 text-white" /> }, 73: { condition: 'Nieve moderada', icon: <Snowflake className="h-5 w-5 text-white" /> }, 75: { condition: 'Nieve fuerte', icon: <Snowflake className="h-5 w-5 text-white" /> }, 80: { condition: 'Chubascos ligeros', icon: <CloudRain className="h-5 w-5 text-white" /> }, 81: { condition: 'Chubascos moderados', icon: <CloudRain className="h-5 w-5 text-white" /> }, 82: { condition: 'Chubascos violentos', icon: <CloudRain className="h-5 w-5 text-white" /> }, 95: { condition: 'Tormenta', icon: <CloudLightning className="h-5 w-5 text-white" /> }, 96: { condition: 'Tormenta c/ granizo ligero', icon: <CloudLightning className="h-5 w-5 text-white" /> }, 99: { condition: 'Tormenta c/ granizo fuerte', icon: <CloudLightning className="h-5 w-5 text-white" /> }, }; return conditions[code] ?? { condition: 'No disponible', icon: <Cloud className="h-5 w-5 text-white" /> }; }; if (data?.current) { const details = getWeatherDetails(data.current.weather_code); setWeatherData({ temp: Math.round(data.current.temperature_2m), condition: details.condition, icon: details.icon, location: 'Tu ubicación', day: new Date().toLocaleDateString('es-ES', { weekday: 'long' }), }); } else { throw new Error("Datos del clima inválidos."); } } catch (fetchError: any) { console.error('Error fetching weather data:', fetchError); setWeatherData(prev => ({ ...prev, temp: null, condition: 'Error al cargar', location: 'Desconocida', icon: <AlertTriangle className="h-5 w-5 text-white" />, })); } finally { setLoadingWeather(false); } }, (geoError) => { console.error("Geolocation error: ", geoError); setWeatherData(prev => ({ ...prev, temp: null, condition: 'Ubicación denegada', location: 'Desconocida', icon: <MapPin className="h-5 w-5 text-white" /> })); setLoadingWeather(false); }); }; fetchWeather();
  }, []);

  // --- UI Handlers ---
  const handleViewChange = (view: string) => { setCurrentView(view); setMobileMenuOpen(false); };
  const formatDate = (dateString: string | null | undefined): string => { /* ... unchanged ... */ if (!dateString) return 'No programada'; try { const date = new Date(dateString); if (isNaN(date.getTime())) return 'Fecha inválida'; return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { console.error("Error formatting date:", dateString, e); return 'Error fecha'; } };
  const formatTime = (timeString: string | null | undefined): string => { /* ... unchanged ... */ if (!timeString) return '--:--'; try { const [hour, minute] = timeString.split(':'); if (hour && minute) { const h = parseInt(hour, 10); const m = parseInt(minute, 10); if (!isNaN(h) && !isNaN(m)) { return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`; } } } catch(e) { console.error("Error formatting time:", timeString, e); } return timeString; };
  const toggleMobileMenu = () => { setMobileMenuOpen(!mobileMenuOpen); };

  // --- Cleanup Effect for Camera ---
  useEffect(() => {
      // Ensure camera is stopped if component unmounts while modal is open
      return () => {
          if (cameraStream) {
              stopCamera();
          }
      };
  }, [cameraStream, stopCamera]); // Add stopCamera to dependency array


  // --- Render Logic ---
  if (loading) { /* ... Loading spinner ... */ }
  if (error) { /* ... Error display screen ... */ }

  // --- Profile Creation Form with Camera ---
  if (showPatientForm) {
    return (
        <div className="min-h-screen bg-gradient-to-br from-primary/5 via-white to-accent/5 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-lg w-full border border-gray-100">
                {/* Form Title */}
                <div className="flex flex-col items-center justify-center mb-8 text-center"> <User className="h-16 w-16 text-primary mb-4" /> <h2 className="text-3xl font-bold text-gray-800">Completa tu perfil</h2> <p className="text-gray-600 mt-2">Necesitamos algunos datos para personalizar tu experiencia.</p> </div>

                <form onSubmit={handleFormSubmit} className="space-y-5">
                    {/* Name, DOB, Gender, Phone, Blood Type, Allergies ... */}
                    <div><label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1.5">Nombre completo*</label><input id="name" type="text" name="name" value={formData.name} onChange={handleFormChange} required className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors" placeholder="Ej: Ana García López"/></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5"> <div><label htmlFor="date_of_birth" className="block text-sm font-medium text-gray-700 mb-1.5">Fecha de nacimiento</label><input id="date_of_birth" type="date" name="date_of_birth" value={formData.date_of_birth} onChange={handleFormChange} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors" max={new Date().toISOString().split("T")[0]}/></div> <div><label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-1.5">Género</label><select id="gender" name="gender" value={formData.gender} onChange={handleFormChange} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors bg-white appearance-none"><option value="">Seleccionar...</option><option value="Masculino">Masculino</option><option value="Femenino">Femenino</option><option value="Otro">Otro</option><option value="Prefiero no decir">Prefiero no decir</option></select></div> </div>
                    <div><label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1.5">Teléfono</label><input id="phone" type="tel" name="phone" value={formData.phone} onChange={handleFormChange} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors" placeholder="Ej: 55 1234 5678"/></div>
                    <div> <label htmlFor="blood_type" className="block text-sm font-medium text-gray-700 mb-1.5">Tipo de sangre</label> <select id="blood_type" name="blood_type" value={formData.blood_type} onChange={handleFormChange} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors bg-white appearance-none"> <option value="">Seleccionar...</option> <option value="A+">A+</option> <option value="A-">A-</option> <option value="AB+">AB+</option> <option value="AB-">AB-</option> <option value="B+">B+</option> <option value="B-">B-</option> <option value="O+">O+</option> <option value="O-">O-</option> <option value="Desconocido">No lo sé</option> </select> </div>
                    <div> <label htmlFor="allergies" className="block text-sm font-medium text-gray-700 mb-1.5">Alergias conocidas</label> <textarea id="allergies" name="allergies" value={formData.allergies} onChange={handleFormChange} rows={3} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors" placeholder="Ej: Penicilina, Cacahuetes, Polvo..." /> </div>

                     {/* Camera Capture Section */}
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Foto de perfil (Opcional)</label>
                        <div className="mt-1 flex items-center space-x-4">
                            {capturedImage ? ( <img src={capturedImage} alt="Foto Capturada" className="h-20 w-20 rounded-full object-cover border-2 border-primary shadow-sm" /> ) : ( <span className="inline-block h-20 w-20 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center border"> <User className="h-12 w-12 text-gray-300" /> </span> )}
                            <button type="button" onClick={startCamera} className="ml-5 bg-white py-2 px-3 border border-gray-300 rounded-md shadow-sm text-sm leading-4 font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary flex items-center gap-1.5">
                                <Camera className="h-4 w-4" aria-hidden="true" />
                                {capturedImage ? 'Tomar Otra' : 'Tomar Foto'}
                            </button>
                        </div>
                        {isUploadingPhoto && ( <div className="mt-2 flex items-center text-sm text-gray-500"> <UploadCloud className="animate-pulse h-4 w-4 mr-1" /> Subiendo foto... </div> )}
                    </div>

                    {/* Submit Button */}
                    <div className="pt-4"> <button type="submit" disabled={isUploadingPhoto} className="w-full bg-primary text-white py-3 px-4 rounded-lg hover:bg-primary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 font-semibold text-lg shadow-md hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"> {isUploadingPhoto ? 'Guardando...' : 'Guardar y Continuar'} </button> </div>
                </form>

                 {/* Hidden Canvas */}
                 <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>

                 {/* Camera Modal - Styled for Vertical Aspect */}
                 {showCameraModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4">
                        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-xl max-w-sm w-full mx-auto"> {/* Limitar ancho maximo */}
                            <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4 text-center">Capturar Foto</h3>
                            {/* Aspect Ratio Container */}
                            <div className="relative w-full aspect-[9/16] bg-gray-800 rounded overflow-hidden mb-4 border border-gray-300"> {/* Forzar proporción 9:16 */}
                                <video
                                    ref={videoRef}
                                    playsInline // Esencial para móviles
                                    className="absolute inset-0 w-full h-full object-cover" // Cubrir el contenedor
                                    style={{ transform: 'scaleX(-1)' }} // Espejo horizontal
                                ></video>
                                {!cameraStream && <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">Iniciando cámara...</div>}
                            </div>
                            <div className="flex justify-center space-x-4">
                                <button type="button" onClick={capturePhoto} disabled={!cameraStream} className="inline-flex items-center justify-center px-5 py-2 border border-transparent rounded-full shadow-sm text-base font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"> <Camera className="h-5 w-5" /> {/* Botón redondo opcional */} </button>
                                <button type="button" onClick={stopCamera} className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"> Cancelar </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
  }

  // --- Main Patient Interface ---
  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-30 border-b border-gray-200"> {/* ... Header content ... */} </header>

      {/* Main Content */}
      <main className="flex-1 pt-6 pb-24 lg:pb-8">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">

            {/* Sidebar (Desktop) */}
            <aside className="lg:col-span-3 xl:col-span-2 hidden lg:block"> {/* ... Sidebar content ... */} </aside>

            {/* Mobile Menu Overlay */}
            {mobileMenuOpen && ( <>{/* ... Mobile menu content ... */} </> )}

            {/* Mobile Bottom Navigation */}
            <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-20 lg:hidden shadow-[0_-2px_5px_rgba(0,0,0,0.05)]">{/* ... Bottom nav content ... */} </nav>

            {/* Main Content Area Column */}
            <div className="lg:col-span-9 xl:col-span-10 space-y-6">

              {/* Home View Specific Content */}
              {currentView === 'home' && (
                <>
                  {/* Top Cards - FIXES APPLIED */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {/* Welcome Card - Applied blue gradient */}
                    <div className="bg-gradient-to-br from-primary to-blue-600 rounded-xl shadow-lg p-5 text-white"> {/* Ensure 'primary' is blue in tailwind.config.js, added fallback blue-600 */} <div className="flex justify-between items-start mb-3"> <div> <p className="text-sm font-medium opacity-90">Hola de nuevo,</p> <h2 className="text-2xl font-bold truncate"> {patientData?.name ?? 'Paciente'} </h2> <p className="text-xs opacity-80 mt-1 flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</p> </div> <div className="flex-shrink-0 h-11 w-11 bg-white/20 rounded-full flex items-center justify-center ring-2 ring-white/30"><Sunrise className="h-6 w-6" /></div> </div> <p className="text-xs opacity-90 mt-2">¡Que tengas un excelente día!</p> </div>
                    {/* Next Appointment Card - Uses patientData.proxima_consulta */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 cursor-pointer hover:shadow-md transition-shadow group" onClick={() => handleViewChange('appointments')} role="button" tabIndex={0} aria-label="Ver próxima cita"> <div className="flex justify-between items-start mb-3"> <div> <p className="text-sm text-gray-500 font-medium">Próxima Cita</p> <h2 className="text-xl font-bold text-gray-800">{formatDate(patientData?.proxima_consulta)}</h2> <p className="text-xs text-gray-500 mt-1 truncate">Ver detalles en Calendario</p> </div> <div className="flex-shrink-0 h-11 w-11 bg-gradient-to-br from-accent/80 to-accent rounded-full flex items-center justify-center shadow transition-transform duration-300 group-hover:scale-110"><CalendarIcon className="h-5 w-5 text-white" /></div> </div> <span className="text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">Ver detalles</span> </div>
                    {/* Weather Card */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5"> <div className="flex justify-between items-start mb-3"> <div> <p className="text-sm text-gray-500 font-medium capitalize">{weatherData.day}</p> <h2 className="text-xl font-bold text-gray-800">{loadingWeather ? '...' : (weatherData.temp !== null ? `${weatherData.temp}°C` : '--')}</h2> <p className="text-xs text-gray-500 mt-1 truncate">{weatherData.condition} • {weatherData.location}</p> </div> <div className={`flex-shrink-0 h-11 w-11 rounded-full flex items-center justify-center shadow ${loadingWeather ? 'bg-gray-400 animate-pulse' : 'bg-gradient-to-br from-blue-400 to-cyan-400'}`}>{weatherData.icon}</div> </div> <p className="text-xs text-gray-500">Clima actual en tu zona.</p> </div>
                  </div>

                  {/* Appointments Table */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"> {/* ... Appointments table content ... */} </div>
                </>
              )}

              {/* ContentPanel for other views */}
              {currentView !== 'home' && currentView !== 'profile' && (
                <ContentPanel view={currentView as any} patientId={patientData?.id} onClose={() => handleViewChange('home')} />
              )}

              {/* Profile View Content */}
              {currentView === 'profile' && patientData && (
                <div className="space-y-6">
                  {/* Loyalty Code Card */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 md:p-6">{/* ... Loyalty card content ... */} </div>
                  {/* Personal Information Card - Updated */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                     <div className="px-5 py-4 border-b border-gray-200 sm:px-6 flex justify-between items-center"> <h3 className="text-lg font-semibold text-gray-800">Información Personal</h3> </div>
                     <div className="px-5 py-5 sm:px-6 grid grid-cols-1 sm:grid-cols-3 gap-6">
                        {/* Profile Picture */}
                        <div className="sm:col-span-1 flex flex-col items-center sm:items-start"> <dt className="text-sm font-medium text-gray-500 mb-2">Foto de perfil</dt> {patientData?.Foto_paciente ? ( <img src={patientData.Foto_paciente} alt="Foto de perfil" className="h-32 w-32 rounded-full object-cover border-2 border-gray-200 shadow-sm" onError={(e) => { e.currentTarget.src = '/placeholder-user.png'; }} /> ) : ( <div className="h-32 w-32 rounded-full bg-gray-100 flex items-center justify-center border"> <User className="h-16 w-16 text-gray-400" /> </div> )} </div>
                        {/* Other Details */}
                        <dl className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5"> {/* ... Other profile details dl ... */}
                            {[ { label: 'Nombre completo', value: patientData?.name }, { label: 'Fecha de nacimiento', value: formatDate(patientData?.date_of_birth) }, { label: 'Correo electrónico', value: patientData?.email || user?.email }, { label: 'Teléfono', value: patientData?.phone }, { label: 'Género', value: patientData?.gender }, { label: 'Tipo de sangre', value: patientData?.blood_type }, { label: 'Alergias', value: patientData?.allergies }, ].map(item => item.value && item.value !== 'Fecha inválida' && item.value !== 'No programada' ? ( <div key={item.label} className={`${item.label === 'Alergias' ? 'sm:col-span-2' : 'sm:col-span-1'}`}> <dt className="text-sm font-medium text-gray-500">{item.label}</dt> <dd className={`mt-1 text-sm text-gray-900 ${item.label === 'Alergias' ? 'whitespace-pre-wrap' : ''}`}>{item.value}</dd> </div> ) : item.label === 'Nombre completo' || item.label === 'Correo electrónico' ? ( <div key={item.label} className="sm:col-span-1"><dt className="text-sm font-medium text-gray-500">{item.label}</dt><dd className="mt-1 text-sm text-gray-500 italic">No disponible</dd></div> ) : null)}
                        </dl>
                     </div>
                  </div>
                </div>
              )}
            </div> {/* End Main Content Area Column */}
          </div> {/* End Main Grid */}
        </div> {/* End Max Width Container */}
      </main>
    </div>
  );
};

export default Paciente_Interfaz;
