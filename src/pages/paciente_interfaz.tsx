import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Home, Calendar as CalendarIcon, Package2, FileText, Clock, Sunrise, QrCode, Menu, X, User,
  MapPin, ArrowLeft, Sun, Moon, Cloud, CloudFog, CloudDrizzle, CloudLightning, Snowflake,
  Info, AlertTriangle, CloudRain, Camera, UploadCloud, CheckCircle
} from 'lucide-react';
import Barcode from 'react-barcode';
import ContentPanel from '../components/paciente/ContentPanel';
import supabase from '../lib/supabaseClient';
import toast from 'react-hot-toast';

// Helper dataURLtoBlob (sin cambios)
function dataURLtoBlob(dataurl: string): Blob | null { /* ... */ }

const Paciente_Interfaz: React.FC = () => {
  // --- Estados (sin cambios) ---
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
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [weatherData, setWeatherData] = useState<{ temp: number | null; condition: string; location: string; day: string; icon: JSX.Element; }>({ temp: null, condition: 'Cargando...', location: 'Obteniendo ubicación...', day: new Date().toLocaleDateString('es-ES', { weekday: 'long' }), icon: <Cloud className="h-5 w-5 text-white" /> });
  const [loadingWeather, setLoadingWeather] = useState<boolean>(true);

  // --- Fetch Appointments (sin cambios) ---
  const fetchAppointments = useCallback(async (patientId: string | null = null) => { /* ... */ }, [patientData?.id]);

  // --- Auth Check (sin cambios) ---
  useEffect(() => { /* ... */ }, [fetchAppointments]);

  // --- Form Handling (sin cambios) ---
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => { /* ... */ };

  // --- MODIFICADO: startCamera ---
  const startCamera = async () => {
    console.log("[Camera] Attempting start...");
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.error("La cámara no es soportada.");
        return;
    }
    setShowCameraModal(true); // Mostrar modal inmediatamente (tendrá el estado "cargando")
    try {
        const constraints = { video: { facingMode: 'user', height: { ideal: 1280 }, width: { ideal: 720 } }, audio: false };
        const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log("[Camera] Stream obtained:", mediaStream);
        // --- SOLO actualiza el estado del stream ---
        setCameraStream(mediaStream);
        // --- NO intentes acceder a videoRef aquí ---

    } catch (err: any) {
        console.error("[Camera] Error starting camera:", err.name, err.message);
        let errorMsg = `Error de cámara (${err.name}). Intenta de nuevo.`;
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") { errorMsg = "Permiso de cámara denegado. Habilítalo en tu navegador."; }
        else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") { errorMsg = "No se encontró ninguna cámara conectada."; }
        else if (err.name === "NotReadableError" || err.name === "TrackStartError") { errorMsg = "La cámara está ocupada o hubo un error de hardware."; }
        else if (err.name === "OverconstrainedError" || err.name === "ConstraintNotSatisfiedError") { errorMsg = "La cámara no soporta la configuración solicitada."; }
        toast.error(errorMsg);
        setShowCameraModal(false); // Cierra el modal si hay error al obtener stream
        setCameraStream(null); // Asegura limpiar el stream
    }
    // No hay 'finally' para setIsCameraLoading aquí, se controla por el estado del stream
  };

  // --- MODIFICADO: useEffect para conectar el stream al video ---
  useEffect(() => {
    // Este efecto se ejecuta DESPUÉS de que el componente se renderiza
    // y cuando cameraStream cambia (y el modal ya debería estar visible)
    if (cameraStream && videoRef.current) {
        console.log("[Camera Effect] Stream existe y videoRef existe. Asignando srcObject.");
        videoRef.current.srcObject = cameraStream;
        videoRef.current.play().catch(playError => {
            console.error("[Camera Effect] Error al reproducir video:", playError);
            toast.error("No se pudo iniciar la vista previa de la cámara.");
            // Considera llamar a stopCamera aquí si falla el play
            // stopCamera(); // Podrías llamarla si quieres cerrar el modal en este error
        });
    } else {
        console.log("[Camera Effect] No se asigna srcObject.", { hasStream: !!cameraStream, hasVideoRef: !!videoRef.current });
    }

    // Limpieza opcional si el stream cambia mientras el componente está montado
    // aunque stopCamera se encarga de la mayoría al desmontar o cerrar modal.
    // return () => {
    //   if (videoRef.current) {
    //     videoRef.current.srcObject = null;
    //   }
    // };
  }, [cameraStream]); // Depende SOLO del stream

  // --- stopCamera (sin cambios, pero verifica que limpie srcObject) ---
  const stopCamera = useCallback(() => {
    console.log("[Camera] Stopping...");
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        console.log("[Camera] Tracks stopped.");
    }
    if (videoRef.current) {
        videoRef.current.srcObject = null; // Asegura limpiar la referencia
        // videoRef.current.load(); // load() a veces es necesario
    }
    setCameraStream(null);
    setShowCameraModal(false);
  }, [cameraStream]);

  // --- capturePhoto (sin cambios) ---
  const capturePhoto = () => { /* ... */ };

  // --- uploadPhoto (sin cambios) ---
  const uploadPhoto = async (imageDataUrl: string): Promise<string | null> => { /* ... */ };

  // --- handleFormSubmit (sin cambios) ---
  const handleFormSubmit = async (e: React.FormEvent) => { /* ... */ };

  // --- generateLoyaltyCode (sin cambios) ---
  const generateLoyaltyCode = async () => { /* ... */ };

  // --- Weather Effect (sin cambios) ---
  useEffect(() => { /* ... */ }, []);

  // --- UI Handlers (sin cambios) ---
  const handleViewChange = (view: string) => { /* ... */ };
  const formatDate = (dateString: string | null | undefined): string => { /* ... */ };
  const formatTime = (timeString: string | null | undefined): string => { /* ... */ };
  const toggleMobileMenu = () => { /* ... */ };

  // --- Cleanup Effect for Camera on Unmount (sin cambios) ---
  useEffect(() => { return () => { if (cameraStream) { stopCamera(); } }; }, [cameraStream, stopCamera]);


  // --- Render Logic ---
  if (loading) { /* ... Loading ... */ }
  if (error) { /* ... Error ... */ }

  // --- Profile Creation Form ---
  if (showPatientForm) {
    return (
        // Contenedor principal del formulario
        <div className="min-h-screen bg-gradient-to-br from-primary/5 via-white to-accent/5 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-lg w-full border border-gray-100">
                {/* Título e icono del formulario */}
                <div className="flex flex-col items-center justify-center mb-8 text-center"> <User className="h-16 w-16 text-primary mb-4" /> <h2 className="text-3xl font-bold text-gray-800">Completa tu perfil</h2> <p className="text-gray-600 mt-2">Necesitamos algunos datos.</p> </div>
                {/* Formulario */}
                <form onSubmit={handleFormSubmit} className="space-y-5">
                    {/* Campos: Nombre, Fecha Nac, Género, Teléfono, Tipo Sangre, Alergias... */}
                    <div><label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1.5">Nombre completo*</label><input id="name" type="text" name="name" value={formData.name} onChange={handleFormChange} required className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors" placeholder="Ej: Ana García López"/></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5"> <div><label htmlFor="date_of_birth" className="block text-sm font-medium text-gray-700 mb-1.5">Fecha de nacimiento</label><input id="date_of_birth" type="date" name="date_of_birth" value={formData.date_of_birth} onChange={handleFormChange} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors" max={new Date().toISOString().split("T")[0]}/></div> <div><label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-1.5">Género</label><select id="gender" name="gender" value={formData.gender} onChange={handleFormChange} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors bg-white appearance-none"><option value="">Seleccionar...</option><option value="Masculino">Masculino</option><option value="Femenino">Femenino</option><option value="Otro">Otro</option><option value="Prefiero no decir">Prefiero no decir</option></select></div> </div>
                    <div><label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1.5">Teléfono</label><input id="phone" type="tel" name="phone" value={formData.phone} onChange={handleFormChange} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors" placeholder="Ej: 55 1234 5678"/></div>
                    <div> <label htmlFor="blood_type" className="block text-sm font-medium text-gray-700 mb-1.5">Tipo de sangre</label> <select id="blood_type" name="blood_type" value={formData.blood_type} onChange={handleFormChange} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors bg-white appearance-none"> <option value="">Seleccionar...</option> <option value="A+">A+</option> <option value="A-">A-</option> <option value="AB+">AB+</option> <option value="AB-">AB-</option> <option value="B+">B+</option> <option value="B-">B-</option> <option value="O+">O+</option> <option value="O-">O-</option> <option value="Desconocido">No lo sé</option> </select> </div>
                    <div> <label htmlFor="allergies" className="block text-sm font-medium text-gray-700 mb-1.5">Alergias conocidas</label> <textarea id="allergies" name="allergies" value={formData.allergies} onChange={handleFormChange} rows={3} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors" placeholder="Ej: Penicilina, Cacahuetes, Polvo..." /> </div>
                    {/* Sección Cámara */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Foto de perfil (Opcional)</label>
                        <div className="mt-1 flex items-center space-x-4">
                            {capturedImage ? ( <img src={capturedImage} alt="Foto Capturada" className="h-20 w-20 rounded-full object-cover border-2 border-primary shadow-sm" /> ) : ( <span className="inline-block h-20 w-20 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center border"> <User className="h-12 w-12 text-gray-300" /> </span> )}
                            <button type="button" onClick={startCamera} className="ml-5 bg-white py-2 px-3 border border-gray-300 rounded-md shadow-sm text-sm leading-4 font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary flex items-center gap-1.5"> <Camera className="h-4 w-4" aria-hidden="true" /> {capturedImage ? 'Tomar Otra' : 'Tomar Foto'} </button>
                        </div>
                        {isUploadingPhoto && ( <div className="mt-2 flex items-center text-sm text-gray-500"> <UploadCloud className="animate-pulse h-4 w-4 mr-1" /> Subiendo foto... </div> )}
                    </div>
                    {/* Botón Submit */}
                    <div className="pt-4"> <button type="submit" disabled={isUploadingPhoto} className="w-full bg-primary text-white py-3 px-4 rounded-lg hover:bg-primary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 font-semibold text-lg shadow-md hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"> {isUploadingPhoto ? 'Guardando...' : 'Guardar y Continuar'} </button> </div>
                </form>

                 {/* Canvas Oculto */}
                 <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>

                 {/* Modal Cámara */}
                 {showCameraModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4">
                        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-xl max-w-sm w-full mx-auto">
                            <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4 text-center">Capturar Foto</h3>
                            {/* Contenedor Video Vertical */}
                            <div className="relative w-full aspect-[9/16] bg-gray-800 rounded overflow-hidden mb-4 border border-gray-300">
                                <video ref={videoRef} playsInline className="absolute inset-0 w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} ></video>
                                {/* Mostrar 'Iniciando...' sólo si AÚN no hay stream */}
                                {!cameraStream && <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">Iniciando cámara...</div>}
                            </div>
                            {/* Botones Modal */}
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

  // --- Main Patient Interface ---
  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-30 border-b border-gray-200">
          <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center"> <div className="flex items-center gap-3"> <img src="/logo.png" alt="Carelux Logo" className="h-10 w-auto"/> <h1 className="text-xl font-semibold text-gray-800 hidden sm:block">Portal Paciente</h1> </div> <button className="p-2 rounded-md text-gray-600 hover:text-primary hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary lg:hidden" onClick={toggleMobileMenu} aria-label="Abrir menú"><Menu className="h-6 w-6" /></button> </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 pt-6 pb-24 lg:pb-8">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">

            {/* Sidebar (Desktop) */}
            <aside className="lg:col-span-3 xl:col-span-2 hidden lg:block">
                <div className="sticky top-20 bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-1.5">{[ { view: 'home', label: 'Inicio', icon: Home }, { view: 'appointments', label: 'Calendario', icon: CalendarIcon }, { view: 'medications', label: 'Recetas', icon: FileText }, { view: 'EREBUS', label: 'EREBUS', icon: FileText }, { view: 'pharmacies', label: 'Farmacias', icon: Package2 }, { view: 'profile', label: 'Perfil', icon: User }, ].map(item => ( <button key={item.view} className={`w-full flex items-center space-x-3 p-3 text-sm rounded-lg transition-colors duration-150 ${ currentView === item.view ? 'bg-primary/10 text-primary font-semibold' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800' }`} onClick={() => handleViewChange(item.view)}> <item.icon className="h-5 w-5 flex-shrink-0" /> <span>{item.label}</span> </button> ))}</div>
            </aside>

            {/* Mobile Menu Overlay */}
            {mobileMenuOpen && ( <> <div className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden" onClick={toggleMobileMenu} aria-hidden="true"></div><div className="fixed inset-y-0 left-0 max-w-xs w-full bg-white shadow-xl z-40 lg:hidden flex flex-col" ><div className="p-4 border-b border-gray-200 flex items-center justify-between"><div className="flex items-center gap-2"><img src="/logo.png" alt="Logo" className="h-8 w-auto"/><span className="text-lg font-semibold text-gray-800">Menú</span></div><button className="p-2 -mr-2 rounded-md text-gray-500 hover:bg-gray-100" onClick={toggleMobileMenu} aria-label="Cerrar menú"> <X className="h-6 w-6" /> </button></div><nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">{[ { view: 'home', label: 'Inicio', icon: Home }, { view: 'appointments', label: 'Calendario', icon: CalendarIcon }, { view: 'medications', label: 'Recetas', icon: FileText }, { view: 'EREBUS', label: 'EREBUS', icon: FileText }, { view: 'pharmacies', label: 'Farmacias', icon: Package2 }, { view: 'profile', label: 'Perfil', icon: User }, ].map(item => ( <button key={item.view} className={`w-full flex items-center space-x-3 p-3 text-sm rounded-lg transition-colors duration-150 ${ currentView === item.view ? 'bg-primary/10 text-primary font-semibold' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800' }`} onClick={() => handleViewChange(item.view)}> <item.icon className="h-5 w-5 flex-shrink-0" /> <span>{item.label}</span> </button> ))} </nav></div></> )}

            {/* Mobile Bottom Navigation */}
            <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-20 lg:hidden shadow-[0_-2px_5px_rgba(0,0,0,0.05)]"> <div className="grid grid-cols-6 h-16">{[ { view: 'home', label: 'Inicio', icon: Home }, { view: 'appointments', label: 'Citas', icon: CalendarIcon }, { view: 'medications', label: 'Recetas', icon: FileText }, { view: 'EREBUS', label: 'EREBUS', icon: FileText }, { view: 'pharmacies', label: 'Farmacias', icon: Package2 }, { view: 'profile', label: 'Perfil', icon: User }, ].map(item => ( <button key={item.view} className={`flex flex-col items-center justify-center pt-1 transition-colors duration-150 ${ currentView === item.view ? 'text-primary' : 'text-gray-500 hover:text-primary' }`} onClick={() => handleViewChange(item.view)} aria-label={item.label}> <item.icon className="h-5 w-5 mb-0.5" /> <span className="text-[10px] font-medium tracking-tight text-center leading-tight">{item.label}</span> </button> ))} </div> </nav>

            {/* Main Content Area Column */}
            <div className="lg:col-span-9 xl:col-span-10 space-y-6">

              {/* Home View Specific Content */}
              {currentView === 'home' && (
                <>
                  {/* Top Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {/* Welcome Card */}
                    <div className="bg-gradient-to-br from-primary to-blue-600 rounded-xl shadow-lg p-5 text-white"> <div className="flex justify-between items-start mb-3"> <div> <p className="text-sm font-medium opacity-90">Hola de nuevo,</p> <h2 className="text-2xl font-bold truncate"> {patientData?.name ?? 'Paciente'} </h2> <p className="text-xs opacity-80 mt-1 flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</p> </div> <div className="flex-shrink-0 h-11 w-11 bg-white/20 rounded-full flex items-center justify-center ring-2 ring-white/30"><Sunrise className="h-6 w-6" /></div> </div> <p className="text-xs opacity-90 mt-2">¡Que tengas un excelente día!</p> </div>
                    {/* Next Appointment Card */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 cursor-pointer hover:shadow-md transition-shadow group" onClick={() => handleViewChange('appointments')} role="button" tabIndex={0} aria-label="Ver próxima cita"> <div className="flex justify-between items-start mb-3"> <div> <p className="text-sm text-gray-500 font-medium">Próxima Cita</p> <h2 className="text-xl font-bold text-gray-800">{formatDate(patientData?.proxima_consulta)}</h2> <p className="text-xs text-gray-500 mt-1 truncate">Ver detalles en Calendario</p> </div> <div className="flex-shrink-0 h-11 w-11 bg-gradient-to-br from-accent/80 to-accent rounded-full flex items-center justify-center shadow transition-transform duration-300 group-hover:scale-110"><CalendarIcon className="h-5 w-5 text-white" /></div> </div> <span className="text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">Ver detalles</span> </div>
                    {/* Weather Card */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5"> <div className="flex justify-between items-start mb-3"> <div> <p className="text-sm text-gray-500 font-medium capitalize">{weatherData.day}</p> <h2 className="text-xl font-bold text-gray-800">{loadingWeather ? '...' : (weatherData.temp !== null ? `${weatherData.temp}°C` : '--')}</h2> <p className="text-xs text-gray-500 mt-1 truncate">{weatherData.condition} • {weatherData.location}</p> </div> <div className={`flex-shrink-0 h-11 w-11 rounded-full flex items-center justify-center shadow ${loadingWeather ? 'bg-gray-400 animate-pulse' : 'bg-gradient-to-br from-blue-400 to-cyan-400'}`}>{weatherData.icon}</div> </div> <p className="text-xs text-gray-500">Clima actual en tu zona.</p> </div>
                  </div>
                  {/* Appointments Table */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-200 flex justify-between items-center"> <h3 className="text-lg font-semibold text-gray-800">Citas Próximas</h3> <button className="text-sm font-medium text-primary hover:text-primary/80 focus:outline-none" onClick={() => handleViewChange('appointments')}> Ver todas </button> </div>
                    {loadingAppointments ? ( <div className="h-40 flex items-center justify-center text-gray-500">Cargando citas...</div> ) : appointments.length > 0 ? ( <div className="overflow-x-auto"> <table className="min-w-full divide-y divide-gray-200"> <thead className="bg-gray-50/50"> <tr> <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th> <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hora</th> <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Tipo</th> <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Doctor</th> </tr> </thead> <tbody className="bg-white divide-y divide-gray-200"> {appointments.slice(0, 4).map((appt) => ( <tr key={appt.id} className="hover:bg-gray-50 transition-colors"> <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800">{formatDate(appt.appointment_date)}</td> <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{formatTime(appt.appointment_time)}</td> <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 hidden md:table-cell">{appt.tipo_consulta || 'General'}</td> <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{appt.doctor_name || 'No asignado'}</td> </tr> ))} </tbody> </table> </div> ) : ( <div className="h-40 flex flex-col items-center justify-center text-center px-6 py-4"><CalendarIcon className="h-10 w-10 text-gray-400 mb-3" /><p className="text-sm text-gray-500">No tienes citas programadas próximamente.</p><button onClick={() => handleViewChange('appointments')} className="mt-3 text-sm font-medium text-primary hover:underline">Agendar una cita</button></div> )}
                 </div>
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
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 md:p-6"> <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6"><div><h3 className="text-lg font-semibold text-gray-800 mb-1">Código de Identificación</h3><p className="text-sm text-gray-600 mb-3">Usa este código para identificarte rápidamente.</p><p className="text-2xl font-bold text-primary font-mono tracking-widest bg-gray-100 px-4 py-2 rounded-md inline-block break-all">{patientData?.surecode || loyaltyCode || 'No Generado'}</p></div><div className="flex flex-col sm:flex-row md:flex-col gap-3 mt-2 md:mt-0 flex-shrink-0">{(!patientData?.surecode && !loyaltyCode) && ( <button onClick={generateLoyaltyCode} disabled={isGeneratingCode} className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 text-sm font-medium shadow disabled:opacity-70 disabled:cursor-not-allowed"> {isGeneratingCode ? ( <> <span className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></span><span>Generando...</span> </> ) : ( <> <QrCode className="h-4 w-4" /> <span>Generar Código</span> </>)} </button> )}{(patientData?.surecode || loyaltyCode) && ( <button onClick={() => setShowBarcode((prev) => !prev)} className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 text-sm font-medium"> <QrCode className="h-4 w-4" /> <span>{showBarcode ? 'Ocultar Barras' : 'Mostrar Barras'}</span> </button> )}</div></div>{(patientData?.surecode || loyaltyCode) && showBarcode && ( <div className="mt-6 p-4 bg-white rounded-lg border border-gray-200 overflow-x-auto max-w-md mx-auto flex justify-center"> <Barcode value={patientData?.surecode || loyaltyCode} width={1.8} height={60} margin={10} displayValue={false} background="#ffffff" lineColor="#000000" /> </div> )}</div>
                  {/* Personal Information Card */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                     <div className="px-5 py-4 border-b border-gray-200 sm:px-6 flex justify-between items-center"> <h3 className="text-lg font-semibold text-gray-800">Información Personal</h3> </div>
                     <div className="px-5 py-5 sm:px-6 grid grid-cols-1 sm:grid-cols-3 gap-6">
                        {/* Profile Picture */}
                        <div className="sm:col-span-1 flex flex-col items-center sm:items-start"> <dt className="text-sm font-medium text-gray-500 mb-2">Foto de perfil</dt> {patientData?.Foto_paciente ? ( <img src={patientData.Foto_paciente} alt="Foto de perfil" className="h-32 w-32 rounded-full object-cover border-2 border-gray-200 shadow-sm" onError={(e) => { e.currentTarget.src = '/placeholder-user.png'; }} /> ) : ( <div className="h-32 w-32 rounded-full bg-gray-100 flex items-center justify-center border"> <User className="h-16 w-16 text-gray-400" /> </div> )} </div>
                        {/* Other Details */}
                        <dl className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
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
