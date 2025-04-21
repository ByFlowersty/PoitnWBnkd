import React, { useState, useEffect, useCallback, useRef } from 'react'; // Added React import
import {
  Home, Calendar as CalendarIcon, Package2, FileText, Clock, Sunrise, QrCode, Menu, X, User,
  MapPin, ArrowLeft, Sun, Moon, Cloud, CloudFog, CloudDrizzle, CloudLightning, Snowflake,
  Info, AlertTriangle, CloudRain, Camera, UploadCloud, CheckCircle, Edit, Plus
} from 'lucide-react';
import Barcode from 'react-barcode';
import ContentPanel from '../components/paciente/ContentPanel'; // Asegúrate que la ruta es correcta
import supabase from '../lib/supabaseClient';
import toast from 'react-hot-toast';

// Helper: Data URL to Blob
function dataURLtoBlob(dataurl: string): Blob | null {
    try {
        const arr = dataurl.split(','); if (arr.length < 2) { console.error("Invalid data URL format"); return null; }
        const mimeMatch = arr[0].match(/:(.*?);/); if (!mimeMatch || mimeMatch.length < 2) { console.error("Could not extract MIME type"); return null; }
        const mime = mimeMatch[1]; const bstr = atob(arr[1]); let n = bstr.length;
        const u8arr = new Uint8Array(n); while(n--){ u8arr[n] = bstr.charCodeAt(n); }
        return new Blob([u8arr], {type:mime});
    } catch (e) { console.error("Error converting data URL to Blob:", e); return null; }
}

// --- Componente Principal ---
const Paciente_Interfaz: React.FC = () => {
  // --- Estados ---
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
  const [showCameraModal, setShowCameraModal] = useState<boolean>(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null); // Ya no se usa en submit inicial
  const [isUploadingPhoto, setIsUploadingPhoto] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [weatherData, setWeatherData] = useState<{ temp: number | null; condition: string; location: string; day: string; icon: JSX.Element; }>({ temp: null, condition: 'Cargando...', location: 'Obteniendo ubicación...', day: new Date().toLocaleDateString('es-ES', { weekday: 'long' }), icon: <Cloud className="h-5 w-5 text-white" /> });
  const [loadingWeather, setLoadingWeather] = useState<boolean>(true);
  const [mobileFabMenuOpen, setMobileFabMenuOpen] = useState<boolean>(false);

  // --- Fetch Citas ---
  const fetchAppointments = useCallback(async (patientId: string | null = null) => {
    const idToFetch = patientId || patientData?.id; if (!idToFetch) { setLoadingAppointments(false); return; } setLoadingAppointments(true); try { const { data, error } = await supabase .from('appointments') .select(`id, appointment_date, appointment_time, tipo_consulta, doctors ( name )`) .eq('patient_id', idToFetch) .order('appointment_date', { ascending: true }) .order('appointment_time', { ascending: true }); if (error) throw error; const processedAppointments = data?.map(appt => ({ ...appt, doctor_name: appt.doctors?.name || 'Dr. Asignado' })) || []; setAppointments(processedAppointments); } catch (fetchError: any) { console.error('Error fetching appointments:', fetchError); toast.error('Error al cargar citas.'); } finally { setLoadingAppointments(false); }
  }, [patientData?.id]);

  // --- Auth Check & Datos Iniciales ---
  useEffect(() => {
    const checkAuthAndPatientData = async () => { setLoading(true); setError(null); try { const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(); if (authError || !authUser) { toast.error('Sesión no válida. Redirigiendo...'); setTimeout(() => { window.location.href = '/login'; }, 1500); return; } setUser(authUser); const { data: patient, error: patientError } = await supabase .from('patients') .select('*') .eq('user_id', authUser.id) .maybeSingle(); if (patientError) { throw new Error("Error al obtener perfil."); } if (!patient) { setShowPatientForm(true); setLoading(false); } else { setPatientData(patient); setLoyaltyCode(patient.surecode || ''); setShowPatientForm(false); fetchAppointments(patient.id); setLoading(false); } } catch (err: any) { console.error('Error checking auth:', err); setError(err.message || 'Error inesperado.'); setLoading(false); } }; checkAuthAndPatientData();
  }, [fetchAppointments]);

  // --- Manejo Formulario ---
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target; setFormData(prev => ({ ...prev, [name]: value }));
  };

  // --- Funciones Cámara ---
  const startCamera = async () => {
    console.log("[Camera] Start attempt..."); if (!navigator.mediaDevices?.getUserMedia) { toast.error("Cámara no soportada."); return; } setShowCameraModal(true); try { const constraints = { video: { facingMode: 'user', height: { ideal: 1280 }, width: { ideal: 720 } }, audio: false }; const mediaStream = await navigator.mediaDevices.getUserMedia(constraints); console.log("[Camera] Stream obtained."); setCameraStream(mediaStream); } catch (err: any) { console.error("[Camera] Error:", err.name, err.message); let errorMsg = `Error cámara (${err.name}).`; if (err.name === "NotAllowedError") errorMsg = "Permiso denegado."; else if (err.name === "NotFoundError") errorMsg = "No se encontró cámara."; else if (err.name === "NotReadableError") errorMsg = "Cámara ocupada."; else if (err.name === "OverconstrainedError") errorMsg = "Cámara no soporta config."; toast.error(errorMsg); setShowCameraModal(false); setCameraStream(null); }
   };
  const stopCamera = useCallback(() => {
    console.log("[Camera] Stop."); if (cameraStream) { cameraStream.getTracks().forEach(track => track.stop()); } if (videoRef.current) { videoRef.current.srcObject = null; } setCameraStream(null); setShowCameraModal(false);
  }, [cameraStream]);
  const capturePhoto = () => { // Ahora solo captura y llama a la actualización
      if (videoRef.current && canvasRef.current && cameraStream) { const video = videoRef.current; const canvas = canvasRef.current; const context = canvas.getContext('2d'); if (context) { canvas.width = video.videoWidth; canvas.height = video.videoHeight; context.translate(canvas.width, 0); context.scale(-1, 1); context.drawImage(video, 0, 0, canvas.width, canvas.height); context.setTransform(1, 0, 0, 1, 0, 0); const dataUrl = canvas.toDataURL('image/png');
          handleProfilePhotoUpdate(dataUrl); // Llama directamente a la actualización
          stopCamera();
      } else { toast.error("Error canvas."); stopCamera(); } } else { toast.error("Error video/canvas."); stopCamera(); }
  };
  useEffect(() => { // Conectar Stream a Video
      if (cameraStream && videoRef.current) { videoRef.current.srcObject = cameraStream; videoRef.current.play().catch(e => { console.error("Error play:",e); toast.error("Error vista previa.");}); }
  }, [cameraStream]);
  useEffect(() => { return () => { if (cameraStream) stopCamera(); }; }, [cameraStream, stopCamera]); // Limpieza Cámara

  // --- Subir Foto ---
  const uploadPhoto = async (imageDataUrl: string): Promise<string | null> => {
      if (!user) { toast.error("No autenticado."); return null; } const blob = dataURLtoBlob(imageDataUrl); if (!blob) { toast.error("Error procesando imagen."); return null; } setIsUploadingPhoto(true); try { const fileExt = blob.type.split('/')[1] || 'png'; const fileName = `${user.id}-${Date.now()}.${fileExt}`; const filePath = fileName;
          // --- ¡¡¡ USA TU NOMBRE DE BUCKET EXACTO AQUÍ !!! ---
          const bucketName = 'patients_photos';
          console.log(`Subiendo a bucket: ${bucketName}, ruta: ${filePath}`); const { error: uploadError } = await supabase.storage .from(bucketName) .upload(filePath, blob, { cacheControl: '3600', upsert: true, contentType: blob.type }); if (uploadError) throw uploadError;
          const { data: urlData } = supabase.storage .from(bucketName) .getPublicUrl(filePath); if (!urlData?.publicUrl) throw new Error("No se obtuvo URL pública."); toast.success("Foto subida."); return urlData.publicUrl;
      } catch (error: any) { console.error('Error uploadPhoto:', error); toast.error(`Error subiendo foto: ${error.message || '?'}`); return null; } finally { setIsUploadingPhoto(false); }
  };

  // --- Submit Formulario Creación (SIN FOTO) ---
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!user) return; try { const { data: newPatient, error } = await supabase .from('patients') .insert({ user_id: user.id, email: user.email, name: formData.name, date_of_birth: formData.date_of_birth || null, gender: formData.gender || null, phone: formData.phone || null, created_at: new Date().toISOString(), blood_type: formData.blood_type || null, allergies: formData.allergies || null }) .select().single(); if (error) throw error; setPatientData(newPatient); setShowPatientForm(false); toast.success('Perfil guardado! Añade tu foto desde la sección Perfil.'); fetchAppointments(newPatient.id); setCapturedImage(null); } catch (err: any) { console.error('Error saving patient:', err); toast.error(`Error guardando perfil: ${err.message || '?'}`); }
  };

  // --- Actualizar Foto Perfil Existente ---
  const handleProfilePhotoUpdate = async (imageDataUrl: string) => {
      if (!patientData?.id || !user) { toast.error("Error: Faltan datos de perfil."); return; } const photoUrl = await uploadPhoto(imageDataUrl); if (photoUrl) { try {
          // --- ¡¡¡ USA TU NOMBRE DE COLUMNA EXACTO AQUÍ !!! ---
          const { data, error } = await supabase .from('patients') .update({ Foto_paciente: photoUrl }) .eq('id', patientData.id) .select() .single(); if (error) throw error; if (data) setPatientData(data); else setPatientData((prev: any) => ({ ...prev, Foto_paciente: photoUrl })); toast.success("Foto actualizada."); setCapturedImage(null); } catch (updateError: any) { console.error('Error updating DB photo:', updateError); toast.error(`Error guardando foto: ${updateError.message}`); } }
  };

  // --- Generar Código Lealtad ---
  const generateLoyaltyCode = async () => {
    if (!patientData?.id) { toast.error('Faltan datos.'); return; } setIsGeneratingCode(true); try { const chars = 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789'; let code = ''; for (let i = 0; i < 10; i++) code += chars.charAt(Math.floor(Math.random() * chars.length)); const { error } = await supabase.from('patients').update({ surecode: code }).eq('id', patientData.id); if (error) throw error; setLoyaltyCode(code); setPatientData((prev: any) => ({ ...prev, surecode: code })); toast.success('Código generado.'); } catch (err: any) { console.error('Error generating code:', err); toast.error(`Error generando código: ${err.message || '?'}`); } finally { setIsGeneratingCode(false); }
  };

  // --- Fetch Clima ---
  useEffect(() => {
    const fetchWeather = () => { if (!navigator.geolocation) { console.warn("Geolocation disabled."); return; } setLoadingWeather(true); navigator.geolocation.getCurrentPosition(async (pos) => { const { latitude, longitude } = pos.coords; try { const api = import.meta.env.VITE_OPENMETEO_API_ENDPOINT || 'https://api.open-meteo.com/v1/forecast'; const url = `${api}?latitude=${latitude}&longitude=${longitude}¤t=temperature_2m,weather_code&timezone=auto`; const res = await fetch(url); if (!res.ok) throw new Error(`API Error ${res.status}`); const data = await res.json(); const getDetails = (code: number): { condition: string; icon: JSX.Element } => { const map: Record<number, { condition: string; icon: JSX.Element }> = { 0: {icon:<Sun/>,c:'Despejado'},1:{icon:<Sun/>,c:'Mayormente despejado'},2:{icon:<Cloud/>,c:'Parcialmente nublado'},3:{icon:<Cloud/>,c:'Nublado'},45:{icon:<CloudFog/>,c:'Niebla'},48:{icon:<CloudFog/>,c:'Niebla engelante'},51:{icon:<CloudDrizzle/>,c:'Llovizna ligera'},53:{icon:<CloudDrizzle/>,c:'Llovizna moderada'},55:{icon:<CloudRain/>,c:'Llovizna densa'},61:{icon:<CloudRain/>,c:'Lluvia ligera'},63:{icon:<CloudRain/>,c:'Lluvia moderada'},65:{icon:<CloudRain/>,c:'Lluvia fuerte'},71:{icon:<Snowflake/>,c:'Nieve ligera'},73:{icon:<Snowflake/>,c:'Nieve moderada'},75:{icon:<Snowflake/>,c:'Nieve fuerte'},80:{icon:<CloudRain/>,c:'Chubascos ligeros'},81:{icon:<CloudRain/>,c:'Chubascos moderados'},82:{icon:<CloudRain/>,c:'Chubascos violentos'},95:{icon:<CloudLightning/>,c:'Tormenta'},96:{icon:<CloudLightning/>,c:'Tormenta c/ granizo ligero'},99:{icon:<CloudLightning/>,c:'Tormenta c/ granizo fuerte'} }; const details = map[code] || {icon:<Cloud/>,c:'No disponible'}; return {condition: details.c, icon: React.cloneElement(details.icon, {className:"h-5 w-5 text-white"})}; }; if(data?.current){ const d=getDetails(data.current.weather_code); setWeatherData({ temp:Math.round(data.current.temperature_2m), condition:d.condition, icon:d.icon, location:'Tu ubicación', day:new Date().toLocaleDateString('es-ES',{weekday:'long'}) }); } else throw new Error("Clima inválido."); } catch (err:any) { console.error("Error fetching weather:",err); setWeatherData(p=>({...p, temp:null, condition:'Error', location:'?', icon:<AlertTriangle className="h-5 w-5 text-white"/>})); } finally { setLoadingWeather(false); } }, (geoErr) => { console.error("Geolocation error:",geoErr); setWeatherData(p=>({...p, temp:null, condition:'Ubicación denegada', location:'?', icon:<MapPin className="h-5 w-5 text-white"/>})); setLoadingWeather(false); }); }; fetchWeather();
  }, []);

  // --- Manejadores UI ---
  const handleViewChange = (view: string) => { setCurrentView(view); setMobileMenuOpen(false); setMobileFabMenuOpen(false); };
  const formatDate = (dateString: string | null | undefined): string => { if (!dateString) return 'No programada'; try { const date = new Date(dateString); if (isNaN(date.getTime())) return 'Fecha inválida'; return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return 'Error fecha'; } };
  const formatTime = (timeString: string | null | undefined): string => { if (!timeString) return '--:--'; try { const [h, m] = timeString.split(':'); if(h&&m){const hr=parseInt(h,10),min=parseInt(m,10);if(!isNaN(hr)&&!isNaN(min))return `${hr.toString().padStart(2,'0')}:${min.toString().padStart(2,'0')}`;} } catch(e){} return timeString; };
  const toggleMobileMenu = () => { setMobileMenuOpen(!mobileMenuOpen); };
  const toggleMobileFabMenu = () => { setMobileFabMenuOpen(!mobileFabMenuOpen); };

  // --- Renderizado ---
  if (loading) { return <div className="min-h-screen flex items-center justify-center bg-gray-100"><div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-primary"></div></div>; }
  if (error) { return <div className="min-h-screen flex flex-col items-center justify-center bg-red-50 p-4 text-center"><AlertTriangle className="h-12 w-12 text-red-500 mb-4" /><h2 className="text-xl font-semibold text-red-700 mb-2">Ocurrió un Error</h2><p className="text-red-600 mb-6">{error}</p><button onClick={() => window.location.reload()} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">Intentar de Nuevo</button></div>; }

  // --- Formulario Creación Perfil ---
  if (showPatientForm) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-white to-accent/5 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-lg w-full border border-gray-100">
          <div className="flex flex-col items-center justify-center mb-8 text-center"> <User className="h-16 w-16 text-primary mb-4" /> <h2 className="text-3xl font-bold text-gray-800">Completa tu perfil</h2> <p className="text-gray-600 mt-2">Necesitamos algunos datos.</p> </div>
          <form onSubmit={handleFormSubmit} className="space-y-5">
            {/* --- Campos del Formulario --- */}
            {/* Nombre */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1.5">Nombre completo*</label>
              <input id="name" type="text" name="name" value={formData.name} onChange={handleFormChange} required className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary" placeholder="Ej: Ana García"/>
            </div>
            {/* Nacimiento y Género */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label htmlFor="date_of_birth" className="block text-sm font-medium text-gray-700 mb-1.5">Nacimiento</label>
                <input id="date_of_birth" type="date" name="date_of_birth" value={formData.date_of_birth} onChange={handleFormChange} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary" max={new Date().toISOString().split("T")[0]}/>
              </div>
              <div>
                <label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-1.5">Género</label>
                <select id="gender" name="gender" value={formData.gender} onChange={handleFormChange} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary bg-white appearance-none">
                  <option value="">Seleccionar...</option><option value="Masculino">Masculino</option><option value="Femenino">Femenino</option><option value="Otro">Otro</option><option value="Prefiero no decir">Prefiero no decir</option>
                </select>
              </div>
            </div>
            {/* Teléfono */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1.5">Teléfono</label>
              <input id="phone" type="tel" name="phone" value={formData.phone} onChange={handleFormChange} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary" placeholder="Ej: 5512345678"/>
            </div>
            {/* Tipo Sangre */}
            <div>
              <label htmlFor="blood_type" className="block text-sm font-medium text-gray-700 mb-1.5">Tipo sangre</label>
              <select id="blood_type" name="blood_type" value={formData.blood_type} onChange={handleFormChange} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary bg-white appearance-none">
                <option value="">...</option> <option value="A+">A+</option><option value="A-">A-</option><option value="AB+">AB+</option><option value="AB-">AB-</option><option value="B+">B+</option><option value="B-">B-</option><option value="O+">O+</option><option value="O-">O-</option> <option value="Desconocido">No sé</option>
              </select>
            </div>
            {/* Alergias */}
            <div>
              <label htmlFor="allergies" className="block text-sm font-medium text-gray-700 mb-1.5">Alergias</label>
              <textarea id="allergies" name="allergies" value={formData.allergies} onChange={handleFormChange} rows={3} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary" placeholder="Ej: Penicilina, Polvo..." />
            </div>
            {/* Botón Guardar */}
            <div className="pt-4">
              <button type="submit" className="w-full bg-primary text-white py-3 px-4 rounded-lg hover:bg-primary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 font-semibold text-lg shadow-md hover:shadow-lg">Guardar</button>
            </div>
          </form>
          {/* Canvas y Modal Cámara (Siguen aquí para usarse desde Perfil) */}
          <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
          {showCameraModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4">
                <div className="bg-white p-4 sm:p-6 rounded-lg shadow-xl max-w-sm w-full mx-auto">
                    <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4 text-center">Capturar Foto</h3>
                    <div className="relative w-full aspect-[9/16] bg-gray-800 rounded overflow-hidden mb-4 border border-gray-300"> <video ref={videoRef} playsInline className="absolute inset-0 w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} ></video> {!cameraStream && <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">Iniciando...</div>} </div>
                    <div className="flex justify-center space-x-4"> <button type="button" onClick={capturePhoto} disabled={!cameraStream} className="inline-flex items-center justify-center px-5 py-2 border border-transparent rounded-full shadow-sm text-base font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"> <Camera className="h-5 w-5" /> </button> <button type="button" onClick={stopCamera} className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"> Cancelar </button> </div>
                </div>
            </div>
           )}
        </div>
      </div>
    );
  }

  // --- Interfaz Principal ---
  const navigationItems = [
      { view: 'home', label: 'Inicio', icon: Home }, { view: 'appointments', label: 'Citas', icon: CalendarIcon },
      { view: 'medications', label: 'Recetas', icon: FileText }, { view: 'EREBUS', label: 'EREBUS', icon: FileText },
      { view: 'pharmacies', label: 'Farmacias', icon: Package2 }, { view: 'profile', label: 'Perfil', icon: User },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-30 border-b border-gray-200">
          <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center"> <div className="flex items-center gap-3"> <img src="/logo.png" alt="Logo" className="h-10 w-auto"/> <h1 className="text-xl font-semibold text-gray-800 hidden sm:block">Portal Paciente</h1> </div> <button className="p-2 rounded-md text-gray-600 hover:text-primary lg:hidden" onClick={toggleMobileMenu} aria-label="Abrir menú"><Menu className="h-6 w-6" /></button> </div>
      </header>

      {/* Contenido Principal */}
      <main className="flex-1 pt-6 pb-24 lg:pb-8"> {/* Padding inferior para FAB */}
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
            {/* Sidebar (Desktop) */}
            <aside className="lg:col-span-3 xl:col-span-2 hidden lg:block">
                <div className="sticky top-20 bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-1.5">{navigationItems.map(item => ( <button key={item.view} className={`w-full flex items-center space-x-3 p-3 text-sm rounded-lg ${ currentView === item.view ? 'bg-primary/10 text-primary font-semibold' : 'text-gray-600 hover:bg-gray-100' }`} onClick={() => handleViewChange(item.view)}> <item.icon className="h-5 w-5 shrink-0" /> <span>{item.label}</span> </button> ))}</div>
            </aside>

             {/* Menú Lateral Móvil (Overlay) */}
            {mobileMenuOpen && ( <> <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden" onClick={toggleMobileMenu} aria-hidden="true"></div><div className="fixed inset-y-0 left-0 max-w-xs w-full bg-white shadow-xl z-50 lg:hidden flex flex-col" ><div className="p-4 border-b flex items-center justify-between"><div className="flex items-center gap-2"><img src="/logo.png" alt="Logo" className="h-8 w-auto"/><span className="text-lg font-semibold">Menú</span></div><button className="p-2 -mr-2 rounded-md text-gray-500 hover:bg-gray-100" onClick={toggleMobileMenu} aria-label="Cerrar menú"><X className="h-6 w-6" /></button></div><nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">{navigationItems.map(item => ( <button key={item.view} className={`w-full flex items-center space-x-3 p-3 text-sm rounded-lg ${ currentView === item.view ? 'bg-primary/10 text-primary font-semibold' : 'text-gray-600 hover:bg-gray-100' }`} onClick={() => handleViewChange(item.view)}> <item.icon className="h-5 w-5 shrink-0" /> <span>{item.label}</span> </button> ))} </nav></div></> )}

            {/* Área Contenido Principal */}
            <div className="lg:col-span-9 xl:col-span-10 space-y-6">
              {/* Vista Home */}
              {currentView === 'home' && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {/* Tarjeta Bienvenida */}
                    <div className="bg-gradient-to-br from-primary to-blue-600 rounded-xl shadow-lg p-5 text-white border border-blue-700"> <div className="flex justify-between items-start mb-3"> <div> <p className="text-sm font-medium opacity-90">Hola de nuevo,</p> <h2 className="text-2xl font-bold truncate"> {patientData?.name ?? 'Paciente'} </h2> <p className="text-xs opacity-80 mt-1 flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</p> </div> <div className="flex-shrink-0 h-11 w-11 bg-white/20 rounded-full flex items-center justify-center ring-2 ring-white/30"><Sunrise className="h-6 w-6" /></div> </div> <p className="text-xs opacity-90 mt-2">¡Que tengas un excelente día!</p> </div>
                    {/* Tarjeta Próxima Cita */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 cursor-pointer hover:shadow-md group transition-shadow"> <div className="flex justify-between items-start mb-3"> <div> <p className="text-sm text-gray-500 font-medium">Próxima Cita</p> <h2 className="text-xl font-bold text-gray-800">{formatDate(patientData?.proxima_consulta)}</h2> <p className="text-xs text-gray-500 mt-1 truncate">Ver detalles en Calendario</p> </div> <div className="shrink-0 h-11 w-11 bg-gradient-to-br from-accent/80 to-accent rounded-full flex items-center justify-center shadow group-hover:scale-110"><CalendarIcon className="h-5 w-5 text-white" /></div> </div> <span className="text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">Ver detalles</span> </div>
                    {/* Tarjeta Clima */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5"> <div className="flex justify-between items-start mb-3"> <div> <p className="text-sm text-gray-500 capitalize">{weatherData.day}</p> <h2 className="text-xl font-bold">{loadingWeather ? '...' : (weatherData.temp !== null ? `${weatherData.temp}°C` : '--')}</h2> <p className="text-xs text-gray-500 mt-1 truncate">{weatherData.condition} • {weatherData.location}</p> </div> <div className={`shrink-0 h-11 w-11 rounded-full flex items-center justify-center shadow ${loadingWeather ? 'bg-gray-400 animate-pulse' : 'bg-gradient-to-br from-blue-400 to-cyan-400'}`}>{weatherData.icon}</div> </div> <p className="text-xs text-gray-500">Clima actual.</p> </div>
                  </div>
                  {/* Tabla Citas */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-5 py-4 border-b flex justify-between items-center"> <h3 className="text-lg font-semibold">Citas Próximas</h3> <button className="text-sm font-medium text-primary hover:text-primary/80" onClick={() => handleViewChange('appointments')}> Ver todas </button> </div>
                    {loadingAppointments ? ( <div className="h-40 flex items-center justify-center text-gray-500">Cargando citas...</div> ) : appointments.length > 0 ? ( <div className="overflow-x-auto"> <table className="min-w-full divide-y"> <thead className="bg-gray-50/50"> <tr> <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th> <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hora</th> <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Tipo</th> <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Doctor</th> </tr> </thead> <tbody className="bg-white divide-y"> {appointments.slice(0, 4).map((appt) => ( <tr key={appt.id} className="hover:bg-gray-50"> <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{formatDate(appt.appointment_date)}</td> <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{formatTime(appt.appointment_time)}</td> <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 hidden md:table-cell">{appt.tipo_consulta || 'General'}</td> <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{appt.doctor_name || 'No asignado'}</td> </tr> ))} </tbody> </table> </div> ) : ( <div className="h-40 flex flex-col items-center justify-center text-center px-6 py-4"><CalendarIcon className="h-10 w-10 text-gray-400 mb-3" /><p className="text-sm text-gray-500">No tienes citas próximas.</p><button onClick={() => handleViewChange('appointments')} className="mt-3 text-sm font-medium text-primary hover:underline">Agendar cita</button></div> )}
                 </div>
                </>
              )}
              {/* Vistas no-Home, no-Perfil */}
              {currentView !== 'home' && currentView !== 'profile' && (
                <ContentPanel view={currentView as any} patientId={patientData?.id} onClose={() => handleViewChange('home')} />
              )}
              {/* Vista Perfil */}
              {currentView === 'profile' && patientData && (
                <div className="space-y-6">
                  {/* Tarjeta Código Lealtad */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 md:p-6">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6"><div><h3 className="text-lg font-semibold">Código Identificación</h3><p className="text-sm text-gray-600 mb-3">Usa este código para identificarte.</p><p className="text-2xl font-bold text-primary font-mono tracking-widest bg-gray-100 px-4 py-2 rounded-md inline-block break-all">{patientData?.surecode || loyaltyCode || 'No Generado'}</p></div><div className="flex flex-col sm:flex-row md:flex-col gap-3 mt-2 md:mt-0 shrink-0">{(!patientData?.surecode && !loyaltyCode) && ( <button onClick={generateLoyaltyCode} disabled={isGeneratingCode} className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 shadow disabled:opacity-70"> {isGeneratingCode ? <><span className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></span><span>Generando...</span></> : <><QrCode className="h-4 w-4" /> <span>Generar Código</span></>} </button> )}{(patientData?.surecode || loyaltyCode) && ( <button onClick={() => setShowBarcode(p => !p)} className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"> <QrCode className="h-4 w-4" /> <span>{showBarcode ? 'Ocultar Barras' : 'Mostrar Barras'}</span> </button> )}</div></div>{(patientData?.surecode || loyaltyCode) && showBarcode && ( <div className="mt-6 p-4 bg-white rounded-lg border overflow-x-auto max-w-md mx-auto flex justify-center"> <Barcode value={patientData?.surecode || loyaltyCode} width={1.8} height={60} margin={10} displayValue={false} background="#ffffff" lineColor="#000000" /> </div> )}
                  </div>
                  {/* Tarjeta Info Personal */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                     <div className="px-5 py-4 border-b flex justify-between items-center"> <h3 className="text-lg font-semibold">Información Personal</h3> </div>
                     <div className="px-5 py-5 sm:px-6 grid grid-cols-1 sm:grid-cols-3 gap-6">
                        {/* Columna Foto Perfil */}
                        <div className="sm:col-span-1 flex flex-col items-center sm:items-start">
                            <dt className="text-sm font-medium text-gray-500 mb-2">Foto de perfil</dt>
                            <div className="relative group">
                                {patientData?.Foto_paciente ? ( <img src={patientData.Foto_paciente} alt="Foto" className="h-32 w-32 rounded-full object-cover border-2 border-gray-200 shadow-sm group-hover:opacity-75 transition-opacity" onError={(e)=>{e.currentTarget.src='/placeholder-user.png';}}/> ) : ( <div className="h-32 w-32 rounded-full bg-gray-100 flex items-center justify-center border group-hover:opacity-75 transition-opacity"> <User className="h-16 w-16 text-gray-400" /> </div> )}
                                <button type="button" onClick={startCamera} disabled={isUploadingPhoto} className="absolute inset-0 h-32 w-32 rounded-full bg-black bg-opacity-0 group-hover:bg-opacity-40 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50" aria-label="Cambiar foto"> {isUploadingPhoto ? <UploadCloud className="h-8 w-8 animate-pulse" /> : <Camera className="h-8 w-8" />} </button>
                            </div>
                            {/* Botón "Añadir Foto" si no existe */}
                            {!patientData?.Foto_paciente && !isUploadingPhoto && (
                                <button type="button" onClick={startCamera} className="mt-3 text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-md hover:bg-primary/20 flex items-center gap-1">
                                     <Camera size={14} /> Añadir Foto
                                </button>
                            )}
                            {isUploadingPhoto && <p className="text-xs text-gray-500 mt-2 animate-pulse">Subiendo...</p>}
                        </div>
                        {/* Otros Detalles */}
                        <dl className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
                            {[ { label: 'Nombre', value: patientData?.name }, { label: 'Nacimiento', value: formatDate(patientData?.date_of_birth) }, { label: 'Correo', value: patientData?.email || user?.email }, { label: 'Teléfono', value: patientData?.phone }, { label: 'Género', value: patientData?.gender }, { label: 'Tipo sangre', value: patientData?.blood_type }, { label: 'Alergias', value: patientData?.allergies }, ].map(item => item.value && item.value !== 'Fecha inválida' && item.value !== 'No programada' ? ( <div key={item.label} className={`${item.label === 'Alergias' ? 'sm:col-span-2' : 'sm:col-span-1'}`}> <dt className="text-sm font-medium text-gray-500">{item.label}</dt> <dd className={`mt-1 text-sm ${item.label === 'Alergias' ? 'whitespace-pre-wrap' : ''}`}>{item.value}</dd> </div> ) : item.label === 'Nombre' || item.label === 'Correo' ? ( <div key={item.label} className="sm:col-span-1"><dt className="text-sm font-medium text-gray-500">{item.label}</dt><dd className="mt-1 text-sm text-gray-500 italic">N/A</dd></div> ) : null)}
                        </dl>
                     </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

       {/* Navegación Móvil FAB */}
       <div className="lg:hidden fixed bottom-6 right-6 z-40">
            {mobileFabMenuOpen && (
                <div className="absolute bottom-0 right-0 mb-20 mr-0 flex flex-col items-end space-y-3"> {/* Aumentar mb */}
                    {navigationItems.filter(item => item.view !== 'home').reverse().map((item, index) => (
                        <button key={item.view} onClick={() => handleViewChange(item.view)} className={`flex items-center justify-center w-12 h-12 bg-white rounded-full shadow-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all duration-300 ease-out ${mobileFabMenuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}`} style={{ transitionDelay: `${index * 50}ms` }} aria-label={item.label} >
                            <item.icon className={`h-5 w-5 ${currentView === item.view ? 'text-primary' : 'text-gray-600'}`} />
                        </button>
                    ))}
                </div>
            )}
             <button onClick={toggleMobileFabMenu} className={`w-16 h-16 rounded-full flex items-center justify-center text-white shadow-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all duration-300 ease-in-out transform ${mobileFabMenuOpen ? 'bg-red-500 hover:bg-red-600 rotate-45' : 'bg-primary hover:bg-primary/90'}`} aria-expanded={mobileFabMenuOpen} aria-label={mobileFabMenuOpen ? "Cerrar menú" : "Abrir menú"} >
                <Plus className={`h-7 w-7 transition-transform duration-200 ${mobileFabMenuOpen ? 'rotate-0' : ''}`} /> {/* El CSS del botón padre maneja la rotación */}
            </button>
       </div>
       {mobileFabMenuOpen && ( <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={toggleMobileFabMenu} aria-hidden="true"></div> )}

       {/* Canvas y Modal Cámara */}
       <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
       {showCameraModal && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4">
             <div className="bg-white p-4 sm:p-6 rounded-lg shadow-xl max-w-sm w-full mx-auto">
                 <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4 text-center">Capturar Foto</h3>
                 <div className="relative w-full aspect-[9/16] bg-gray-800 rounded overflow-hidden mb-4 border"> <video ref={videoRef} playsInline className="absolute inset-0 w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} ></video> {!cameraStream && <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">Iniciando...</div>} </div>
                 <div className="flex justify-center space-x-4"> <button type="button" onClick={capturePhoto} disabled={!cameraStream} className="inline-flex items-center justify-center px-5 py-2 border border-transparent rounded-full shadow-sm text-base font-medium text-white bg-primary hover:bg-primary/90 disabled:opacity-50"> <Camera className="h-5 w-5" /> </button> <button type="button" onClick={stopCamera} className="inline-flex items-center justify-center px-4 py-2 border rounded-md shadow-sm text-sm font-medium bg-white hover:bg-gray-50"> Cancelar </button> </div>
             </div>
         </div>
        )}
    </div>
  );
};

// Definiciones CSS simplificadas (puedes ponerlas en tu archivo CSS global)
/*
.input-style { @apply w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors; }
.btn-primary { @apply bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 font-semibold shadow-md hover:shadow-lg; }
*/

export default Paciente_Interfaz;
