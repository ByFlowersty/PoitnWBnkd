import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Home, Calendar as CalendarIcon, Package2, FileText, Clock, Sunrise, QrCode, Menu, X, User,
  MapPin, ArrowLeft, Sun, Moon, Cloud, CloudFog, CloudDrizzle, CloudLightning, Snowflake,
  Info, AlertTriangle, CloudRain, Camera, UploadCloud, CheckCircle, Edit, Plus, CreditCard
} from 'lucide-react';
import Barcode from 'react-barcode';
import ContentPanel from '../components/paciente/ContentPanel';
import supabase from '../lib/supabaseClient';
import toast from 'react-hot-toast';

// Helper: Data URL to Blob
function dataURLtoBlob(dataurl: string): Blob | null {
    try { const arr = dataurl.split(','); if (arr.length < 2) { console.error("Invalid data URL format"); return null; } const mimeMatch = arr[0].match(/:(.*?);/); if (!mimeMatch || mimeMatch.length < 2) { console.error("Could not extract MIME type"); return null; } const mime = mimeMatch[1]; const bstr = atob(arr[1]); let n = bstr.length; const u8arr = new Uint8Array(n); while(n--){ u8arr[n] = bstr.charCodeAt(n); } return new Blob([u8arr], {type:mime}); } catch (e) { console.error("Error converting data URL to Blob:", e); return null; }
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false); // Menú lateral
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState<boolean>(true);
  const [user, setUser] = useState<any>(null);
  const [showPatientForm, setShowPatientForm] = useState<boolean>(false);
  const [formData, setFormData] = useState({ name: '', date_of_birth: '', gender: '', phone: '', blood_type: '', allergies: '' });
  const [showCameraModal, setShowCameraModal] = useState<boolean>(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [weatherData, setWeatherData] = useState<{ temp: number | null; condition: string; location: string; day: string; icon: JSX.Element; }>({ temp: null, condition: 'Cargando...', location: 'Obteniendo ubicación...', day: new Date().toLocaleDateString('es-ES', { weekday: 'long' }), icon: <Cloud className="h-5 w-5 text-white" /> });
  const [loadingWeather, setLoadingWeather] = useState<boolean>(true);
  const [mobileFabMenuOpen, setMobileFabMenuOpen] = useState<boolean>(false); // Menú radial

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
  const capturePhoto = () => {
      if (videoRef.current && canvasRef.current && cameraStream) { const video = videoRef.current; const canvas = canvasRef.current; const context = canvas.getContext('2d'); if (context) { canvas.width = video.videoWidth; canvas.height = video.videoHeight; context.translate(canvas.width, 0); context.scale(-1, 1); context.drawImage(video, 0, 0, canvas.width, canvas.height); context.setTransform(1, 0, 0, 1, 0, 0); const dataUrl = canvas.toDataURL('image/png');
          if (currentView === 'profile') { // Si estamos en perfil, actualiza directo
              handleProfilePhotoUpdate(dataUrl);
          } else { // Si estamos en form inicial, guarda para el submit
              setCapturedImage(dataUrl);
          }
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
          const bucketName = 'patients_photos'; // ¡¡¡ VERIFICA ESTE NOMBRE !!!
          const { error: uploadError } = await supabase.storage .from(bucketName) .upload(filePath, blob, { cacheControl: '3600', upsert: true, contentType: blob.type }); if (uploadError) throw uploadError;
          const { data: urlData } = supabase.storage .from(bucketName) .getPublicUrl(filePath); if (!urlData?.publicUrl) throw new Error("No se obtuvo URL pública."); toast.success("Foto subida."); return urlData.publicUrl;
      } catch (error: any) { console.error('Error uploadPhoto:', error); toast.error(`Error subiendo foto: ${error.message || '?'}`); return null; } finally { setIsUploadingPhoto(false); }
  };

  // --- Submit Formulario Creación (CON FOTO) ---
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!user) return; let photoUrl: string | null = null;
    if (capturedImage) { photoUrl = await uploadPhoto(capturedImage); if (!photoUrl) { return; } } // Detener si falla la subida
    try {
      const { data: newPatient, error } = await supabase .from('patients') .insert({ user_id: user.id, email: user.email, name: formData.name, date_of_birth: formData.date_of_birth || null, gender: formData.gender || null, phone: formData.phone || null, created_at: new Date().toISOString(), blood_type: formData.blood_type || null, allergies: formData.allergies || null, Foto_paciente: photoUrl /* Incluir URL */ }) .select().single(); if (error) throw error;
      setPatientData(newPatient); setShowPatientForm(false); toast.success('Perfil guardado!'); fetchAppointments(newPatient.id); setCapturedImage(null);
    } catch (err: any) { console.error('Error saving patient:', err); toast.error(`Error guardando perfil: ${err.message || '?'}`); }
  };

  // --- Actualizar Foto Perfil Existente ---
  const handleProfilePhotoUpdate = async (imageDataUrl: string) => {
      if (!patientData?.id || !user) { toast.error("Error: Faltan datos."); return; } const photoUrl = await uploadPhoto(imageDataUrl); if (photoUrl) { try {
          const { data, error } = await supabase .from('patients') .update({ Foto_paciente: photoUrl }) .eq('id', patientData.id) .select() .single(); if (error) throw error; if (data) setPatientData(data); else setPatientData((prev: any) => ({ ...prev, Foto_paciente: photoUrl })); toast.success("Foto actualizada."); } catch (updateError: any) { console.error('Error updating DB photo:', updateError); toast.error(`Error guardando foto: ${updateError.message}`); } }
  };

  // --- Generar Código Lealtad ---
  const generateLoyaltyCode = async () => {
    if (!patientData?.id) { toast.error('Faltan datos.'); return; } setIsGeneratingCode(true); try { const chars = 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789'; let code = ''; for (let i = 0; i < 10; i++) code += chars.charAt(Math.floor(Math.random() * chars.length)); const { error } = await supabase.from('patients').update({ surecode: code }).eq('id', patientData.id); if (error) throw error; setLoyaltyCode(code); setPatientData((prev: any) => ({ ...prev, surecode: code })); toast.success('Código generado.'); } catch (err: any) { console.error('Error generating code:', err); toast.error(`Error generando código: ${err.message || '?'}`); } finally { setIsGeneratingCode(false); }
  };

  // --- Fetch Clima ---
  useEffect(() => {
    const fetchWeather = () => { if (!navigator.geolocation) { console.warn("Geolocation disabled."); return; } setLoadingWeather(true); navigator.geolocation.getCurrentPosition(async (pos) => { const { latitude, longitude } = pos.coords; try { const api = import.meta.env.VITE_OPENMETEO_API_ENDPOINT || 'https://api.open-meteo.com/v1/forecast'; const url = `${api}?latitude=${latitude}&longitude=${longitude}¤t=temperature_2m,weather_code&timezone=auto`; const res = await fetch(url); if (!res.ok) throw new Error(`API Error ${res.status}`); const data = await res.json(); const getDetails = (code: number): { condition: string; icon: JSX.Element } => { const map: Record<number, { condition: string; icon: JSX.Element }> = { 0:{icon:<Sun/>,c:'Despejado'},1:{icon:<Sun/>,c:'Mayor. despejado'},2:{icon:<Cloud/>,c:'Parc. nublado'},3:{icon:<Cloud/>,c:'Nublado'},45:{icon:<CloudFog/>,c:'Niebla'},48:{icon:<CloudFog/>,c:'Niebla engelante'},51:{icon:<CloudDrizzle/>,c:'Llovizna ligera'},53:{icon:<CloudDrizzle/>,c:'Llovizna mod.'},55:{icon:<CloudRain/>,c:'Llovizna densa'},61:{icon:<CloudRain/>,c:'Lluvia ligera'},63:{icon:<CloudRain/>,c:'Lluvia mod.'},65:{icon:<CloudRain/>,c:'Lluvia fuerte'},71:{icon:<Snowflake/>,c:'Nieve ligera'},73:{icon:<Snowflake/>,c:'Nieve mod.'},75:{icon:<Snowflake/>,c:'Nieve fuerte'},80:{icon:<CloudRain/>,c:'Chubascos ligeros'},81:{icon:<CloudRain/>,c:'Chubascos mod.'},82:{icon:<CloudRain/>,c:'Chubascos viol.'},95:{icon:<CloudLightning/>,c:'Tormenta'},96:{icon:<CloudLightning/>,c:'Tormenta c/granizo lig.'},99:{icon:<CloudLightning/>,c:'Tormenta c/granizo fuer.'} }; const details = map[code] || {icon:<Cloud/>,c:'No disponible'}; return {condition: details.c, icon: React.cloneElement(details.icon, {className:"h-5 w-5 text-white"})}; }; if(data?.current){ const d=getDetails(data.current.weather_code); setWeatherData({ temp:Math.round(data.current.temperature_2m), condition:d.condition, icon:d.icon, location:'Tu ubicación', day:new Date().toLocaleDateString('es-ES',{weekday:'long'}) }); } else throw new Error("Clima inválido."); } catch (err:any) { console.error("Error fetching weather:",err); setWeatherData(p=>({...p, temp:null, condition:'Error', location:'?', icon:<AlertTriangle className="h-5 w-5 text-white"/>})); } finally { setLoadingWeather(false); } }, (geoErr) => { console.error("Geolocation error:",geoErr); setWeatherData(p=>({...p, temp:null, condition:'Ubic. denegada', location:'?', icon:<MapPin className="h-5 w-5 text-white"/>})); setLoadingWeather(false); }); }; fetchWeather();
  }, []);

  // --- Manejadores UI ---
  const handleViewChange = (view: string) => { setCurrentView(view); setMobileMenuOpen(false); setMobileFabMenuOpen(false); };
  const formatDate = (dateString: string | null | undefined): string => { if (!dateString) return 'No programada'; try { const date = new Date(dateString); if (isNaN(date.getTime())) return 'Fecha inválida'; return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return 'Error fecha'; } };
  const formatTime = (timeString: string | null | undefined): string => { if (!timeString) return '--:--'; try { const [h, m] = timeString.split(':'); if(h&&m){const hr=parseInt(h,10),min=parseInt(m,10);if(!isNaN(hr)&&!isNaN(min))return `${hr.toString().padStart(2,'0')}:${min.toString().padStart(2,'0')}`;} } catch(e){} return timeString; };
  const toggleMobileMenu = () => { setMobileMenuOpen(!mobileMenuOpen); }; // Lateral
  const toggleMobileFabMenu = () => { setMobileFabMenuOpen(!mobileFabMenuOpen); }; // Radial

  // --- Renderizado ---
  if (loading) { return <div className="min-h-screen flex items-center justify-center bg-slate-100"><div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-600"></div></div>; }
  if (error) { return <div className="min-h-screen flex flex-col items-center justify-center bg-red-50 p-4 text-center"><AlertTriangle className="h-12 w-12 text-red-500 mb-4" /><h2 className="text-xl font-semibold text-red-700 mb-2">Ocurrió un Error</h2><p className="text-red-600 mb-6">{error}</p><button onClick={() => window.location.reload()} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">Intentar de Nuevo</button></div>; }

  // --- Formulario Creación Perfil ---
  if (showPatientForm) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 max-w-lg w-full border border-slate-200">
          <div className="flex flex-col items-center justify-center mb-8 text-center"> <User className="h-16 w-16 text-indigo-600 mb-4" /> <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">Completa tu perfil</h2> <p className="text-slate-600 mt-2 text-sm sm:text-base">Necesitamos algunos datos para empezar.</p> </div>
          <form onSubmit={handleFormSubmit} className="space-y-5 sm:space-y-6">
            {/* Nombre */}
            <div> <label htmlFor="name" className="form-label">Nombre completo*</label> <input id="name" type="text" name="name" value={formData.name} onChange={handleFormChange} required className="form-input" placeholder="Ej: Ana García"/> </div>
            {/* Nacimiento y Género */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6"> <div> <label htmlFor="date_of_birth" className="form-label">Nacimiento</label> <input id="date_of_birth" type="date" name="date_of_birth" value={formData.date_of_birth} onChange={handleFormChange} className="form-input" max={new Date().toISOString().split("T")[0]}/> </div> <div> <label htmlFor="gender" className="form-label">Género</label> <select id="gender" name="gender" value={formData.gender} onChange={handleFormChange} className="form-select"> <option value="">Seleccionar...</option><option value="Masculino">Masculino</option><option value="Femenino">Femenino</option><option value="Otro">Otro</option><option value="Prefiero no decir">Prefiero no decir</option> </select> </div> </div>
            {/* Teléfono */}
            <div> <label htmlFor="phone" className="form-label">Teléfono</label> <input id="phone" type="tel" name="phone" value={formData.phone} onChange={handleFormChange} className="form-input" placeholder="Ej: 5512345678"/> </div>
            {/* Tipo Sangre */}
            <div> <label htmlFor="blood_type" className="form-label">Tipo sangre</label> <select id="blood_type" name="blood_type" value={formData.blood_type} onChange={handleFormChange} className="form-select"> <option value="">...</option> <option value="A+">A+</option><option value="A-">A-</option><option value="AB+">AB+</option><option value="AB-">AB-</option><option value="B+">B+</option><option value="B-">B-</option><option value="O+">O+</option><option value="O-">O-</option> <option value="Desconocido">No sé</option> </select> </div>
            {/* Alergias */}
            <div> <label htmlFor="allergies" className="form-label">Alergias</label> <textarea id="allergies" name="allergies" value={formData.allergies} onChange={handleFormChange} rows={3} className="form-textarea" placeholder="Ej: Penicilina, Polvo..." /> </div>
            {/* Captura de Foto */}
            <div>
                <label className="form-label">Foto de perfil (Opcional)</label>
                <div className="mt-1 flex items-center space-x-4">
                    {capturedImage ? ( <img src={capturedImage} alt="Foto Capturada" className="h-20 w-20 rounded-full object-cover border-2 border-indigo-300 shadow-sm" /> ) : ( <span className="inline-block h-20 w-20 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center border border-slate-300"> <User className="h-12 w-12 text-slate-400" /> </span> )}
                    <button type="button" onClick={startCamera} className="ml-5 bg-white py-2 px-3 border border-slate-300 rounded-lg shadow-sm text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 flex items-center gap-1.5 transition-colors"> <Camera className="h-4 w-4" aria-hidden="true" /> {capturedImage ? 'Tomar Otra' : 'Tomar Foto'} </button>
                </div>
                {isUploadingPhoto && ( <div className="mt-2 flex items-center text-sm text-slate-500"> <UploadCloud className="animate-pulse h-4 w-4 mr-1" /> Subiendo foto... </div> )}
            </div>
            {/* Botón Guardar */}
            <div className="pt-6"> <button type="submit" disabled={isUploadingPhoto} className="w-full btn-primary py-3 text-lg"> {isUploadingPhoto ? 'Guardando...' : 'Guardar y Continuar'} </button> </div>
          </form>
          {/* Canvas y Modal Cámara */}
          <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
          {showCameraModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4"> <div className="bg-white p-4 sm:p-6 rounded-lg shadow-xl max-w-sm w-full mx-auto"> <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4 text-center">Capturar Foto</h3> <div className="relative w-full aspect-[9/16] bg-gray-800 rounded overflow-hidden mb-4 border border-gray-300"> <video ref={videoRef} playsInline className="absolute inset-0 w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} ></video> {!cameraStream && <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">Iniciando...</div>} </div> <div className="flex justify-center space-x-4"> <button type="button" onClick={capturePhoto} disabled={!cameraStream} className="inline-flex items-center justify-center px-5 py-2 border border-transparent rounded-full shadow-sm text-base font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"> <Camera className="h-5 w-5" /> </button> <button type="button" onClick={stopCamera} className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"> Cancelar </button> </div> </div> </div>
           )}
        </div>
      </div>
    );
  }

  // --- Interfaz Principal ---
  const navigationItems = [
      { view: 'home', label: 'Inicio', icon: Home }, { view: 'appointments', label: 'Citas', icon: CalendarIcon },
      { view: 'medications', label: 'Recetas', icon: FileText }, { view: 'wallet', label: 'Cartera', icon: CreditCard },
      { view: 'pharmacies', label: 'Farmacias', icon: Package2 }, { view: 'profile', label: 'Perfil', icon: User },
  ];
  const fabMenuItems = navigationItems.filter(item => item.view !== 'home');

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      {/* Header */}
      <header className="bg-white shadow-md sticky top-0 z-30 border-b border-slate-200">
          <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center"> <div className="flex items-center gap-3"> <img src="/logo.png" alt="Logo" className="h-10 w-auto"/> <h1 className="text-xl font-semibold text-slate-900 hidden sm:block">Portal Paciente</h1> </div> <button className="p-2 rounded-md text-slate-600 hover:text-indigo-600 lg:hidden" onClick={toggleMobileMenu} aria-label="Abrir menú lateral"><Menu className="h-6 w-6" /></button> </div>
      </header>

      {/* Contenido Principal */}
      <main className="flex-1 pt-8 pb-28 lg:pb-10">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
            {/* Sidebar */}
            <aside className="lg:col-span-3 xl:col-span-2 hidden lg:block">
                 <div className="sticky top-24 bg-white rounded-xl shadow-lg border border-slate-200 p-5 space-y-2">{navigationItems.map(item => ( <button key={item.view} className={`w-full group flex items-center space-x-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors duration-150 ${ currentView === item.view ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800' }`} onClick={() => handleViewChange(item.view)}> <item.icon className={`h-5 w-5 shrink-0 ${currentView === item.view ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-500'}`} /> <span>{item.label}</span> </button> ))}</div>
            </aside>

             {/* Menú Lateral Móvil (Overlay) */}
            {mobileMenuOpen && ( <> <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden" onClick={toggleMobileMenu} aria-hidden="true"></div><div className="fixed inset-y-0 left-0 max-w-xs w-full bg-white shadow-xl z-50 lg:hidden flex flex-col" ><div className="p-4 border-b flex items-center justify-between"><div className="flex items-center gap-2"><img src="/logo.png" alt="Logo" className="h-8 w-auto"/><span className="text-lg font-semibold">Menú</span></div><button className="p-2 -mr-2 rounded-md text-gray-500 hover:bg-gray-100" onClick={toggleMobileMenu} aria-label="Cerrar menú"><X className="h-6 w-6" /></button></div><nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">{navigationItems.map(item => ( <button key={item.view} className={`w-full group flex items-center space-x-3 p-3 text-sm rounded-lg ${ currentView === item.view ? 'bg-indigo-100 text-indigo-700 font-medium' : 'text-slate-600 hover:bg-slate-100' }`} onClick={() => handleViewChange(item.view)}> <item.icon className={`h-5 w-5 shrink-0 ${currentView === item.view ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-500'}`} /> <span>{item.label}</span> </button> ))} </nav></div></> )}

            {/* Área Contenido Principal */}
            <div className="lg:col-span-9 xl:col-span-10 space-y-8">
              {/* Vista Home */}
              {currentView === 'home' && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl shadow-lg p-6 text-white border border-indigo-700"> <div className="flex justify-between items-start mb-4"> <div> <p className="text-base font-medium opacity-90">Hola de nuevo,</p> <h2 className="text-2xl font-semibold truncate"> {patientData?.name ?? 'Paciente'} </h2> <p className="text-sm opacity-80 mt-1.5 flex items-center gap-1.5"><Clock className="h-4 w-4" />{new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</p> </div> <div className="flex-shrink-0 h-12 w-12 bg-white/25 rounded-full flex items-center justify-center ring-2 ring-white/50"><Sunrise className="h-6 w-6" /></div> </div> <p className="text-sm opacity-90">¡Que tengas un excelente día!</p> </div>
                    <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 cursor-pointer hover:shadow-indigo-100 group transition-shadow" onClick={() => handleViewChange('appointments')}> <div className="flex justify-between items-start mb-4"> <div> <p className="text-sm font-medium text-slate-500">Próxima Cita</p> <h2 className="text-xl font-semibold text-slate-800 mt-1">{formatDate(patientData?.proxima_consulta)}</h2> <p className="text-sm text-slate-500 mt-1.5 truncate">Ver detalles en Calendario</p> </div> <div className="shrink-0 h-12 w-12 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-full flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform"><CalendarIcon className="h-6 w-6 text-white" /></div> </div> <span className="text-sm font-medium text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">Ver detalles</span> </div>
                    <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6"> <div className="flex justify-between items-start mb-4"> <div> <p className="text-sm font-medium text-slate-500 capitalize">{weatherData.day}</p> <h2 className="text-xl font-semibold mt-1">{loadingWeather ? '...' : (weatherData.temp !== null ? `${weatherData.temp}°C` : '--')}</h2> <p className="text-sm text-slate-500 mt-1.5 truncate">{weatherData.condition} • {weatherData.location}</p> </div> <div className={`shrink-0 h-12 w-12 rounded-full flex items-center justify-center shadow-lg ${loadingWeather ? 'bg-slate-400 animate-pulse' : 'bg-gradient-to-br from-sky-500 to-blue-500'}`}>{weatherData.icon && React.cloneElement(weatherData.icon, { className: "h-6 w-6 text-white"})}</div> </div> <p className="text-sm text-slate-500">Clima actual.</p> </div>
                  </div>
                  <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                    <div className="px-6 py-5 border-b border-slate-200 flex justify-between items-center"> <h3 className="text-xl font-semibold text-slate-800">Citas Próximas</h3> <button className="text-sm font-medium text-indigo-600 hover:text-indigo-800" onClick={() => handleViewChange('appointments')}> Ver todas </button> </div>
                    {loadingAppointments ? ( <div className="h-48 flex items-center justify-center text-slate-500">Cargando citas...</div> ) : appointments.length > 0 ? ( <div className="overflow-x-auto"> <table className="min-w-full divide-y divide-slate-200"> <thead className="bg-slate-50"> <tr> <th className="th-cell">Fecha</th> <th className="th-cell">Hora</th> <th className="th-cell hidden md:table-cell">Tipo</th> <th className="th-cell">Doctor</th> </tr> </thead> <tbody className="bg-white divide-y divide-slate-200"> {appointments.slice(0, 5).map((appt) => ( <tr key={appt.id} className="hover:bg-slate-50 transition-colors"> <td className="td-cell font-medium">{formatDate(appt.appointment_date)}</td> <td className="td-cell">{formatTime(appt.appointment_time)}</td> <td className="td-cell hidden md:table-cell">{appt.tipo_consulta || 'General'}</td> <td className="td-cell">{appt.doctor_name || 'No asignado'}</td> </tr> ))} </tbody> </table> </div> ) : ( <div className="h-48 flex flex-col items-center justify-center text-center px-6 py-4"><CalendarIcon className="h-12 w-12 text-slate-400 mb-4" /><p className="text-base text-slate-500">No tienes citas próximas.</p><button onClick={() => handleViewChange('appointments')} className="mt-4 text-sm font-medium text-indigo-600 hover:underline">Agendar cita</button></div> )}
                 </div>
                </>
              )}
              {/* Vistas no-Home, no-Perfil */}
              {currentView !== 'home' && currentView !== 'profile' && ( <ContentPanel view={currentView as any} patientId={patientData?.id} onClose={() => handleViewChange('home')} /> )}
              {/* Vista Perfil */}
              {currentView === 'profile' && patientData && (
                <div className="space-y-8">
                  {/* Tarjeta Código Lealtad */}
                  <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 md:p-8"> <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-5 mb-6"><div><h3 className="text-xl font-semibold text-slate-800 mb-1.5">Código de Identificación</h3><p className="text-sm text-slate-600 mb-4">Usa este código para identificarte rápidamente.</p><p className="text-3xl font-bold text-indigo-600 font-mono tracking-wider bg-slate-100 px-5 py-3 rounded-lg inline-block break-all shadow-inner">{patientData?.surecode || loyaltyCode || 'NO GENERADO'}</p></div><div className="flex flex-col sm:flex-row md:flex-col gap-3 mt-2 md:mt-0 shrink-0">{(!patientData?.surecode && !loyaltyCode) && ( <button onClick={generateLoyaltyCode} disabled={isGeneratingCode} className="btn-secondary py-2.5 px-5 text-sm"> {isGeneratingCode ? <><span className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-current mr-2"></span><span>Generando...</span></> : <><QrCode className="h-4 w-4 mr-2" /> <span>Generar Código</span></>} </button> )}{(patientData?.surecode || loyaltyCode) && ( <button onClick={() => setShowBarcode(p => !p)} className="btn-secondary py-2.5 px-5 text-sm"> <QrCode className="h-4 w-4 mr-2" /> <span>{showBarcode ? 'Ocultar Barras' : 'Mostrar Barras'}</span> </button> )}</div></div>{(patientData?.surecode || loyaltyCode) && showBarcode && ( <div className="mt-8 p-5 bg-white rounded-lg border border-slate-300 overflow-x-auto max-w-lg mx-auto flex justify-center shadow"> <Barcode value={patientData?.surecode || loyaltyCode} width={2} height={70} margin={15} displayValue={false} background="#ffffff" lineColor="#334155" /> </div> )}</div>
                  {/* Tarjeta Info Personal */}
                  <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                     <div className="px-6 py-5 border-b border-slate-200 flex justify-between items-center"> <h3 className="text-xl font-semibold text-slate-800">Información Personal</h3> </div>
                     <div className="px-6 py-6 grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-6">
                        {/* Columna Foto Perfil */}
                        <div className="md:col-span-1 flex flex-col items-center md:items-start">
                            <label className="block text-sm font-medium text-slate-500 mb-2">Foto de perfil</label>
                            <div className="relative group w-40 h-40">
                                {patientData?.Foto_paciente ? ( <img src={patientData.Foto_paciente} alt="Foto" className="w-full h-full rounded-full object-cover border-4 border-white shadow-lg group-hover:opacity-80 transition-opacity" onError={(e)=>{e.currentTarget.src='/placeholder-user.png';}}/> ) : ( <div className="w-full h-full rounded-full bg-slate-100 flex items-center justify-center border border-slate-300 group-hover:opacity-80 transition-opacity"> <User className="h-20 w-20 text-slate-400" /> </div> )}
                                <button type="button" onClick={startCamera} disabled={isUploadingPhoto} className="absolute inset-0 w-full h-full rounded-full bg-black bg-opacity-0 group-hover:bg-opacity-50 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200" aria-label={patientData?.Foto_paciente ? "Cambiar foto" : "Añadir foto"}> {isUploadingPhoto ? <UploadCloud className="h-10 w-10 animate-pulse" /> : <Camera className="h-10 w-10" />} </button>
                            </div>
                            {isUploadingPhoto && <p className="text-xs text-slate-500 mt-2 animate-pulse text-center md:text-left">Subiendo...</p>}
                             {/* Mensaje si no hay foto */}
                            {!patientData?.Foto_paciente && !isUploadingPhoto && (
                                <p className="text-xs text-slate-500 mt-2 text-center md:text-left">Añade una foto para completar tu perfil.</p>
                            )}
                        </div>
                        {/* Otros Detalles */}
                        <dl className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5 pt-2">
                            {[ { label: 'Nombre', value: patientData?.name }, { label: 'Nacimiento', value: formatDate(patientData?.date_of_birth) }, { label: 'Correo', value: patientData?.email || user?.email }, { label: 'Teléfono', value: patientData?.phone }, { label: 'Género', value: patientData?.gender }, { label: 'Tipo sangre', value: patientData?.blood_type }, { label: 'Alergias', value: patientData?.allergies }, ].map(item => item.value && item.value !== 'Fecha inválida' && item.value !== 'No programada' ? ( <div key={item.label} className={`${item.label === 'Alergias' ? 'sm:col-span-2' : 'sm:col-span-1'}`}> <dt className="text-sm font-medium text-slate-500">{item.label}</dt> <dd className={`mt-1 text-base text-slate-900 ${item.label === 'Alergias' ? 'whitespace-pre-wrap' : ''}`}>{item.value}</dd> </div> ) : item.label === 'Nombre' || item.label === 'Correo' ? ( <div key={item.label} className="sm:col-span-1"><dt className="text-sm font-medium text-slate-500">{item.label}</dt><dd className="mt-1 text-base text-slate-500 italic">No disponible</dd></div> ) : null)}
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
       <div className="lg:hidden">
            {mobileFabMenuOpen && ( <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={toggleMobileFabMenu} aria-hidden="true"></div> )}
            <div className={`fixed bottom-6 inset-x-0 flex justify-center items-center transition-opacity duration-300 ease-out z-50 ${ mobileFabMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none' }`} aria-hidden={!mobileFabMenuOpen} >
                <div className="relative w-64 h-64 flex items-center justify-center">
                    {fabMenuItems.map((item, index) => {
                        const totalItems = fabMenuItems.length; const angleIncrement = 180 / (totalItems + 1); const angle = -150 + (index + 1) * angleIncrement; const radius = 90; const angleRad = angle * (Math.PI / 180); const xPos = radius * Math.cos(angleRad); const yPos = radius * Math.sin(angleRad);
                        return (
                            <button key={item.view} onClick={() => handleViewChange(item.view)} className={`absolute flex flex-col items-center justify-center w-16 h-16 bg-white rounded-full shadow-lg hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-300 ease-out ${ mobileFabMenuOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-50' }`} style={{ transform: `translate(${xPos}px, ${yPos}px)`, transitionDelay: `${mobileFabMenuOpen ? index * 40 : (totalItems - 1 - index) * 30}ms` }} aria-label={item.label} >
                                <item.icon className={`h-6 w-6 mb-0.5 ${currentView === item.view ? 'text-blue-600' : 'text-slate-700'}`} /> <span className="text-[10px] font-medium text-slate-700">{item.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
            <div className="fixed bottom-6 inset-x-0 flex justify-center z-50 pointer-events-none">
                <button onClick={toggleMobileFabMenu} className={`w-16 h-16 rounded-full flex items-center justify-center text-white shadow-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-300 ease-in-out transform pointer-events-auto ${ mobileFabMenuOpen ? 'bg-slate-500 hover:bg-slate-600 rotate-[135deg]' : 'bg-blue-600 hover:bg-blue-700' }`} aria-expanded={mobileFabMenuOpen} aria-label={mobileFabMenuOpen ? "Cerrar menú" : "Abrir menú"} >
                    <Plus className={`h-8 w-8 transition-transform duration-300 ${mobileFabMenuOpen ? '' : ''}`} />
                </button>
            </div>
       </div>

       {/* Canvas y Modal Cámara */}
       <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
       {showCameraModal && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4">
             <div className="bg-white p-4 sm:p-6 rounded-lg shadow-xl max-w-sm w-full mx-auto">
                 <h3 className="text-lg font-medium leading-6 text-slate-900 mb-4 text-center">Capturar Foto</h3>
                 <div className="relative w-full aspect-[9/16] bg-slate-800 rounded overflow-hidden mb-4 border border-slate-300"> <video ref={videoRef} playsInline className="absolute inset-0 w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} ></video> {!cameraStream && <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">Iniciando...</div>} </div>
                 <div className="flex justify-center space-x-4"> <button type="button" onClick={capturePhoto} disabled={!cameraStream} className="inline-flex items-center justify-center px-5 py-2 border border-transparent rounded-full shadow-sm text-base font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"> <Camera className="h-5 w-5" /> </button> <button type="button" onClick={stopCamera} className="inline-flex items-center justify-center px-4 py-2 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"> Cancelar </button> </div>
             </div>
         </div>
        )}
    </div>
  );
};

// --- Clases CSS reutilizables sugeridas ---
// Se aplican directamente en el JSX ahora, pero puedes extraerlas
// .form-label { @apply block text-sm font-medium text-slate-700 mb-1.5; }
// .form-input, .form-select, .form-textarea { @apply mt-1 block w-full px-4 py-2.5 border border-slate-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring focus:ring-indigo-500 focus:ring-opacity-50 transition-colors text-base placeholder:text-slate-400; }
// .form-select { @apply bg-white appearance-none; }
// .btn-primary { @apply inline-flex items-center justify-center px-6 py-2.5 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors disabled:opacity-70 disabled:cursor-not-allowed; }
// .btn-secondary { @apply inline-flex items-center justify-center px-4 py-2 border border-slate-300 text-sm font-medium rounded-lg shadow-sm text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors disabled:opacity-70 disabled:cursor-not-allowed; }
// .th-cell { @apply px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider; }
// .td-cell { @apply px-6 py-4 whitespace-nowrap text-sm text-slate-700; }


export default Paciente_Interfaz;
