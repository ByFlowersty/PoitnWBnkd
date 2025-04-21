import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Home, Calendar as CalendarIcon, Package2, FileText, Clock, Sunrise, QrCode, Menu, X, User,
  MapPin, ArrowLeft, Sun, Moon, Cloud, CloudFog, CloudDrizzle, CloudLightning, Snowflake,
  Info, AlertTriangle, CloudRain, Camera, UploadCloud, CheckCircle, Edit // Added Edit icon
} from 'lucide-react';
import Barcode from 'react-barcode';
import ContentPanel from '../components/paciente/ContentPanel'; // Asegúrate que la ruta es correcta
import supabase from '../lib/supabaseClient';
import toast from 'react-hot-toast';

// Helper: Convierte Data URL (Base64) a Blob (sin cambios)
function dataURLtoBlob(dataurl: string): Blob | null { /* ... */ }

// --- Componente Principal ---
const Paciente_Interfaz: React.FC = () => {
  // --- Estados Generales (sin cambios) ---
  const [currentView, setCurrentView] = useState<string>('home');
  const [patientData, setPatientData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [loyaltyCode, setLoyaltyCode] = useState<string>('');
  // ... otros estados ...
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState<boolean>(true);
  const [user, setUser] = useState<any>(null);
  const [showPatientForm, setShowPatientForm] = useState<boolean>(false);
  const [formData, setFormData] = useState({ name: '', date_of_birth: '', gender: '', phone: '', blood_type: '', allergies: '' });
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [showBarcode, setShowBarcode] = useState<boolean>(false);
  const [isGeneratingCode, setIsGeneratingCode] = useState<boolean>(false);


  // --- Estados Cámara ---
  const [showCameraModal, setShowCameraModal] = useState<boolean>(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null); // Guarda Data URL temporalmente
  const [isUploadingPhoto, setIsUploadingPhoto] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // NUEVO: Estado para saber si la foto es para el perfil existente o nuevo
  const [isUpdatingProfilePhoto, setIsUpdatingProfilePhoto] = useState<boolean>(false);

  // --- Estado Clima ---
  const [weatherData, setWeatherData] = useState<{ temp: number | null; condition: string; location: string; day: string; icon: JSX.Element; }>({ temp: null, condition: 'Cargando...', location: 'Obteniendo ubicación...', day: new Date().toLocaleDateString('es-ES', { weekday: 'long' }), icon: <Cloud className="h-5 w-5 text-white" /> });
  const [loadingWeather, setLoadingWeather] = useState<boolean>(true);

  // --- Función para Obtener Citas (sin cambios) ---
  const fetchAppointments = useCallback(async (patientId: string | null = null) => { /* ... */ }, [patientData?.id]);

  // --- Efecto para Autenticación y Datos Iniciales (sin cambios) ---
  useEffect(() => { /* ... */ }, [fetchAppointments]);

  // --- Manejo de Cambios en Formularios (sin cambios) ---
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => { /* ... */ };

  // --- Funciones de Cámara (startCamera, stopCamera - sin cambios) ---
  const startCamera = async () => {
      // --- AÑADIR: Indicar si es para actualizar perfil ---
      setIsUpdatingProfilePhoto(currentView === 'profile'); // True si estamos en perfil
      // --- FIN AÑADIDO ---

      console.log("[Camera] Attempting start..."); if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { toast.error("La cámara no es soportada."); return; } setShowCameraModal(true); try { const constraints = { video: { facingMode: 'user', height: { ideal: 1280 }, width: { ideal: 720 } }, audio: false }; const mediaStream = await navigator.mediaDevices.getUserMedia(constraints); console.log("[Camera] Stream obtained:", mediaStream); setCameraStream(mediaStream); } catch (err: any) { console.error("[Camera] Error starting camera:", err.name, err.message); let errorMsg = `Error de cámara (${err.name}).`; if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") { errorMsg = "Permiso de cámara denegado."; } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") { errorMsg = "No se encontró cámara."; } else if (err.name === "NotReadableError" || err.name === "TrackStartError") { errorMsg = "Cámara ocupada o error hardware."; } else if (err.name === "OverconstrainedError" || err.name === "ConstraintNotSatisfiedError") { errorMsg = "Cámara no soporta configuración."; } toast.error(errorMsg); setShowCameraModal(false); setCameraStream(null); }
   };
  const stopCamera = useCallback(() => {
    console.log("[Camera] Stopping..."); if (cameraStream) { cameraStream.getTracks().forEach(track => track.stop()); } if (videoRef.current) { videoRef.current.srcObject = null; } setCameraStream(null); setShowCameraModal(false); setIsUpdatingProfilePhoto(false); // Resetear flag
  }, [cameraStream]);

  // --- MODIFICADO: capturePhoto - Llamar a la función de actualización si es necesario ---
  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current && cameraStream) { const video = videoRef.current; const canvas = canvasRef.current; const context = canvas.getContext('2d'); if (context) { canvas.width = video.videoWidth; canvas.height = video.videoHeight; context.translate(canvas.width, 0); context.scale(-1, 1); context.drawImage(video, 0, 0, canvas.width, canvas.height); context.setTransform(1, 0, 0, 1, 0, 0); const dataUrl = canvas.toDataURL('image/png');
        // --- MODIFICACIÓN ---
        if (isUpdatingProfilePhoto && patientData?.id) {
            // Si estamos actualizando desde el perfil, llamar a la función de actualización
            handleProfilePhotoUpdate(dataUrl);
        } else {
            // Si estamos en el formulario inicial, solo guardar para el submit
            setCapturedImage(dataUrl);
        }
        // --- FIN MODIFICACIÓN ---
        stopCamera(); // Detiene y cierra modal en ambos casos
    } else { toast.error("Error interno del canvas."); stopCamera(); } } else { toast.error("Error: Video o canvas no listos."); stopCamera(); }
  };

  // --- Efecto para Conectar Stream a Video (sin cambios) ---
  useEffect(() => { /* ... */ }, [cameraStream]);

  // --- Función para Subir Foto (sin cambios) ---
  const uploadPhoto = async (imageDataUrl: string): Promise<string | null> => { /* ... */ };

  // --- MODIFICADO: Envío del Formulario de Creación de Perfil (SIN FOTO) ---
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!user) return;
    // --- YA NO SE SUBE FOTO AQUÍ ---
    // let photoUrl: string | null = null;
    // if (capturedImage) { photoUrl = await uploadPhoto(capturedImage); }
    try {
      const { data: newPatient, error } = await supabase .from('patients') .insert({
          user_id: user.id, email: user.email, name: formData.name,
          date_of_birth: formData.date_of_birth || null, gender: formData.gender || null,
          phone: formData.phone || null, created_at: new Date().toISOString(),
          blood_type: formData.blood_type || null, allergies: formData.allergies || null,
          // Foto_paciente: photoUrl // <= YA NO SE INCLUYE AQUÍ
      }) .select().single();
      if (error) throw error;
      setPatientData(newPatient); // Actualizar datos del paciente localmente
      setShowPatientForm(false); // Ocultar formulario
      toast.success('Perfil guardado! Ahora puedes añadir tu foto.');
      // No necesitamos fetchAppointments aquí porque no hay citas aún
      // fetchAppointments(newPatient.id);
      setCapturedImage(null); // Limpiar imagen capturada si la hubo
    } catch (err: any) { console.error('Error saving patient data:', err); toast.error(`Error al guardar perfil: ${err.message || 'Inténtelo de nuevo.'}`); }
  };

  // --- NUEVA FUNCIÓN: Actualizar Foto de Perfil Existente ---
  const handleProfilePhotoUpdate = async (imageDataUrl: string) => {
      if (!patientData || !patientData.id || !user) {
          toast.error("No se pueden actualizar los datos del perfil.");
          return;
      }

      // 1. Subir la nueva foto
      const photoUrl = await uploadPhoto(imageDataUrl);

      // 2. Si la subida fue exitosa, actualizar la base de datos
      if (photoUrl) {
          try {
              // --- ¡¡¡ REEMPLAZA 'Foto_paciente' SI TU COLUMNA SE LLAMA DIFERENTE !!! ---
              const { data, error } = await supabase
                  .from('patients')
                  .update({ Foto_paciente: photoUrl })
                  .eq('id', patientData.id) // Usar el ID del paciente
                  .select() // Opcional: obtener el registro actualizado
                  .single();

              if (error) throw error;

              // Actualizar el estado local para reflejar el cambio inmediatamente
              if (data) {
                  setPatientData(data);
              } else {
                  // Si select() no devuelve data, actualizar manualmente
                   setPatientData((prev: any) => ({ ...prev, Foto_paciente: photoUrl }));
              }
              toast.success("Foto de perfil actualizada.");
              setCapturedImage(null); // Limpiar la imagen capturada

          } catch (updateError: any) {
              console.error('Error updating profile photo in DB:', updateError);
              toast.error(`Error al guardar la foto en el perfil: ${updateError.message}`);
              // Considerar borrar la foto recién subida si falla la actualización DB (más complejo)
          }
      } else {
          // El toast de error ya se mostró en uploadPhoto
          console.log("Upload failed, DB not updated.");
      }
  };


  // --- Generación Código Lealtad (sin cambios) ---
  const generateLoyaltyCode = async () => { /* ... */ };

  // --- Efecto para Obtener Clima (sin cambios) ---
  useEffect(() => { /* ... */ }, []);

  // --- ELIMINADO: Efecto para Notificación ---
  // useEffect(() => { ... }, [loading, error, patientData]);

  // --- Manejadores UI (sin cambios) ---
  const handleViewChange = (view: string) => { /* ... */ };
  const formatDate = (dateString: string | null | undefined): string => { /* ... */ };
  const formatTime = (timeString: string | null | undefined): string => { /* ... */ };
  const toggleMobileMenu = () => { /* ... */ };

  // --- Efecto Limpieza Cámara (sin cambios) ---
  useEffect(() => { return () => { if (cameraStream) { stopCamera(); } }; }, [cameraStream, stopCamera]);

  // --- Lógica de Renderizado ---
  if (loading) { /* ... Loading ... */ }
  if (error) { /* ... Error ... */ }

  // --- Formulario Creación de Perfil (AHORA SIN CÁMARA DIRECTA) ---
  if (showPatientForm) {
    return (
        <div className="min-h-screen bg-gradient-to-br from-primary/5 via-white to-accent/5 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-lg w-full border border-gray-100">
                 <div className="flex flex-col items-center justify-center mb-8 text-center"> <User className="h-16 w-16 text-primary mb-4" /> <h2 className="text-3xl font-bold text-gray-800">Completa tu perfil</h2> <p className="text-gray-600 mt-2">Necesitamos algunos datos.</p> </div>
                <form onSubmit={handleFormSubmit} className="space-y-5">
                    {/* Inputs: Name, DOB, Gender, Phone, Blood Type, Allergies */}
                    <div><label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1.5">Nombre completo*</label><input id="name" type="text" name="name" value={formData.name} onChange={handleFormChange} required className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors" placeholder="Ej: Ana García López"/></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5"> <div><label htmlFor="date_of_birth" className="block text-sm font-medium text-gray-700 mb-1.5">Fecha de nacimiento</label><input id="date_of_birth" type="date" name="date_of_birth" value={formData.date_of_birth} onChange={handleFormChange} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors" max={new Date().toISOString().split("T")[0]}/></div> <div><label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-1.5">Género</label><select id="gender" name="gender" value={formData.gender} onChange={handleFormChange} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors bg-white appearance-none"><option value="">Seleccionar...</option><option value="Masculino">Masculino</option><option value="Femenino">Femenino</option><option value="Otro">Otro</option><option value="Prefiero no decir">Prefiero no decir</option></select></div> </div>
                    <div><label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1.5">Teléfono</label><input id="phone" type="tel" name="phone" value={formData.phone} onChange={handleFormChange} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors" placeholder="Ej: 55 1234 5678"/></div>
                    <div> <label htmlFor="blood_type" className="block text-sm font-medium text-gray-700 mb-1.5">Tipo de sangre</label> <select id="blood_type" name="blood_type" value={formData.blood_type} onChange={handleFormChange} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors bg-white appearance-none"> <option value="">Seleccionar...</option> <option value="A+">A+</option> <option value="A-">A-</option> <option value="AB+">AB+</option> <option value="AB-">AB-</option> <option value="B+">B+</option> <option value="B-">B-</option> <option value="O+">O+</option> <option value="O-">O-</option> <option value="Desconocido">No lo sé</option> </select> </div>
                    <div> <label htmlFor="allergies" className="block text-sm font-medium text-gray-700 mb-1.5">Alergias conocidas</label> <textarea id="allergies" name="allergies" value={formData.allergies} onChange={handleFormChange} rows={3} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors" placeholder="Ej: Penicilina, Cacahuetes, Polvo..." /> </div>

                    {/* --- SECCIÓN CÁMARA ELIMINADA DEL FORMULARIO INICIAL --- */}

                    {/* Botón Submit */}
                    <div className="pt-4">
                        <button type="submit" className="w-full bg-primary text-white py-3 px-4 rounded-lg hover:bg-primary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 font-semibold text-lg shadow-md hover:shadow-lg">
                            Guardar y Continuar
                        </button>
                    </div>
                </form>
                 {/* Canvas y Modal (aún necesarios si se usan desde Perfil) */}
                 <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
                 {showCameraModal && ( /* ... JSX del modal cámara sin cambios ... */ )}
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
              {currentView === 'home' && ( /* ... JSX Home sin cambios ... */ )}
              {/* Panel Contenido Otras Vistas */}
              {currentView !== 'home' && currentView !== 'profile' && ( <ContentPanel view={currentView as any} patientId={patientData?.id} onClose={() => handleViewChange('home')} /> )}
              {/* Contenido Vista Perfil */}
              {currentView === 'profile' && patientData && (
                <div className="space-y-6">
                  {/* Tarjeta Código Lealtad (sin cambios) */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 md:p-6"> {/* ... */} </div>
                  {/* Tarjeta Info Personal - CON BOTÓN EDITAR FOTO */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                     <div className="px-5 py-4 border-b border-gray-200 sm:px-6 flex justify-between items-center"> <h3 className="text-lg font-semibold text-gray-800">Información Personal</h3> </div>
                     <div className="px-5 py-5 sm:px-6 grid grid-cols-1 sm:grid-cols-3 gap-6">
                        {/* Columna Foto Perfil con Botón */}
                        <div className="sm:col-span-1 flex flex-col items-center sm:items-start">
                            <dt className="text-sm font-medium text-gray-500 mb-2">Foto de perfil</dt>
                            <div className="relative group">
                                {patientData?.Foto_paciente ? ( <img src={patientData.Foto_paciente} alt="Foto de perfil" className="h-32 w-32 rounded-full object-cover border-2 border-gray-200 shadow-sm group-hover:opacity-75 transition-opacity" onError={(e) => { e.currentTarget.src = '/placeholder-user.png'; }} /> ) : ( <div className="h-32 w-32 rounded-full bg-gray-100 flex items-center justify-center border group-hover:opacity-75 transition-opacity"> <User className="h-16 w-16 text-gray-400" /> </div> )}
                                {/* Botón para activar la cámara */}
                                <button
                                    type="button"
                                    onClick={startCamera}
                                    disabled={isUploadingPhoto}
                                    className="absolute inset-0 h-32 w-32 rounded-full bg-black bg-opacity-0 group-hover:bg-opacity-40 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                                    aria-label="Cambiar foto de perfil"
                                >
                                     {isUploadingPhoto ? <UploadCloud className="h-8 w-8 animate-pulse" /> : <Camera className="h-8 w-8" />}
                                </button>
                            </div>
                            {isUploadingPhoto && <p className="text-xs text-gray-500 mt-2 animate-pulse">Subiendo...</p>}
                        </div>
                        {/* Otros Detalles */}
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
       {/* Canvas y Modal Cámara (se mantienen fuera del flujo principal pero se usan) */}
       <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
       {showCameraModal && ( /* ... JSX Modal Cámara ... */ )}
    </div>
  );
};

export default Paciente_Interfaz;
