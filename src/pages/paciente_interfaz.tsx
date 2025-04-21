import { useState, useEffect } from 'react';
import {
    Home,
    Calendar as CalendarIcon,
    Package2,
    FileText,
    Clock,
    Sunrise,
    CloudRain,
    QrCode,
    Menu,
    X,
    User,
    MapPin, // Usado en farmacias si se muestran aquí
    ArrowLeft, // Para botón de volver
    Sun, // Icono alternativo clima
    Moon, // Icono alternativo clima
    Cloud, // Icono alternativo clima
    CloudFog, // Icono alternativo clima
    CloudDrizzle, // Icono alternativo clima
    CloudLightning, // Icono alternativo clima
    Snowflake, // Icono alternativo clima
    Info, // Para mensajes informativos
    AlertTriangle, // Para errores
} from 'lucide-react';
import Barcode from 'react-barcode';
import Header from '../components/paciente/Header';
import ContentPanel from '../components/paciente/ContentPanel';
import supabase from '../lib/supabaseClient';
import ToastProvider,  useToast  from '../components/providers/ToastProvider';


// --- Variables de Entorno (Ejemplo con Vite) ---
const openMeteoApiEndpoint = import.meta.env.VITE_OPENMETEO_API_ENDPOINT || 'https://api.open-meteo.com/v1/forecast';
const erebusApiEndpoint = import.meta.env.VITE_EREBUS_API_ENDPOINT || 'https://erebus-production.up.railway.app';

// --- Componente Principal ---

const Paciente_Interfaz: React.FC = () => {
    const [currentView, setCurrentView] = useState<string>('home');
    const [patientData, setPatientData] = useState<any>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [loyaltyCode, setLoyaltyCode] = useState<string>('');
    const [showBarcode, setShowBarcode] = useState<boolean>(false);
    const [isGeneratingCode, setIsGeneratingCode] = useState<boolean>(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
    const [appointments, setAppointments] = useState<any[]>([]);
    const [loadingAppointments, setLoadingAppointments] = useState<boolean>(false);
    const [user, setUser] = useState<any>(null);
    const [showPatientForm, setShowPatientForm] = useState<boolean>(false);
    const [formData, setFormData] = useState({
        name: '',
        date_of_birth: '',
        gender: '',
        phone: ''
    });

    // --- CORRECCIÓN 2: Llamar al hook useToast DESPUÉS de asegurarse que el Provider está activo ---
    // La llamada está bien aquí, pero el Provider debe envolver el componente (ver return)
    const { showToast } = useToast(); // Hook para mostrar notificaciones

    // --- Datos del Clima ---
    const [weatherData, setWeatherData] = useState({
        temp: null as number | null,
        condition: 'Cargando...',
        location: 'Obteniendo ubicación...',
        day: new Date().toLocaleDateString('es-ES', { weekday: 'long' }),
        icon: <Cloud className="h-5 w-5 text-white" />, // Icono por defecto
    });
    const [loadingWeather, setLoadingWeather] = useState<boolean>(true);

    // --- Autenticación y Datos del Paciente ---
    useEffect(() => {
        const checkAuthAndPatientData = async () => {
            setLoading(true);
            setError(null);
            try {
                const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

                if (authError || !authUser) {
                    // Es importante que showToast funcione aquí, por eso el Provider debe estar "arriba"
                    showToast('Error de autenticación. Redirigiendo a login...', 'error');
                    // Dar tiempo al toast a mostrarse antes de redirigir
                    setTimeout(() => {
                        window.location.href = '/login';
                    }, 1500);
                    return;
                }
                setUser(authUser);

                const { data: patient, error: patientError } = await supabase
                    .from('patients')
                    .select('*')
                    .eq('user_id', authUser.id)
                    .maybeSingle();

                if (patientError) {
                    console.error("Error fetching patient data:", patientError);
                    throw new Error("Error al cargar datos del paciente.");
                }

                if (!patient) {
                    setShowPatientForm(true);
                    setLoading(false);
                } else {
                    setPatientData(patient);
                    setLoyaltyCode(patient.surecode || '');
                    setShowPatientForm(false);
                    setLoading(false);
                    fetchAppointments(patient.id); // Usar patient.id directamente
                }

            } catch (err: any) {
                console.error('Error general en checkAuthAndPatientData:', err);
                const errorMessage = err.message || 'Ocurrió un error inesperado al cargar la información.';
                setError(errorMessage);
                showToast(errorMessage, 'error');
                setLoading(false);
            }
        };

        checkAuthAndPatientData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showToast]); // showToast es ahora una dependencia estable del hook

    // --- Formulario del Paciente ---
    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        try {
            const { data: newPatient, error } = await supabase
                .from('patients')
                .insert({
                    user_id: user.id,
                    email: user.email, // Asegúrate que user.email existe
                    name: formData.name,
                    date_of_birth: formData.date_of_birth || null,
                    gender: formData.gender || null,
                    phone: formData.phone || null,
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            if (error) throw error;

            setPatientData(newPatient);
            setShowPatientForm(false);
            showToast('Perfil creado exitosamente.', 'success');
            fetchAppointments(newPatient.id); // Usar el id del paciente recién creado

        } catch (err: any) {
            console.error('Error saving patient data:', err);
            showToast(`Error al guardar el perfil: ${err.message || 'Inténtelo de nuevo.'}`, 'error');
        }
    };

    // --- Código de Fidelización (SureCode) ---
    const generateLoyaltyCode = async () => {
        // Usar patientData.id en lugar de user.id para la query si la FK es patient_id
        if (!patientData || !patientData.id) return;
        setIsGeneratingCode(true);
        try {
            const characters = 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789';
            const codeLength = 10;
            let result = '';
            for (let i = 0; i < codeLength; i++) {
                result += characters.charAt(Math.floor(Math.random() * characters.length));
            }

            const { error } = await supabase
                .from('patients')
                .update({ surecode: result })
                .eq('id', patientData.id); // Asumiendo que la PK de patients es 'id'

            if (error) throw error;

            setLoyaltyCode(result);
            setPatientData((prev: any) => ({ ...prev, surecode: result }));
            showToast('Código generado exitosamente.', 'success');

        } catch (err: any) {
            console.error('Error updating loyalty code:', err);
            showToast(`Error al generar el código: ${err.message || 'Inténtelo de nuevo.'}`, 'error');
        } finally {
            setIsGeneratingCode(false);
        }
    };

    // --- Citas ---
    const fetchAppointments = async (patientId: string) => {
        if (!patientId) return;
        setLoadingAppointments(true);
        try {
            // Unir con doctors para obtener el nombre
            const { data, error } = await supabase
                .from('appointments')
                .select(`
                    *,
                    doctors ( name )
                `)
                .eq('patient_id', patientId)
                .order('appointment_date', { ascending: true })
                .order('appointment_time', { ascending: true }); // Añadir orden por hora

            if (error) throw error;

            // Procesar para aplanar el nombre del doctor
            const processedAppointments = data?.map(appt => ({
                ...appt,
                // Acceder al nombre del doctor desde el objeto anidado
                doctor_name: appt.doctors?.name || 'Dr. No Asignado' // Usar optional chaining
            })) || [];
            setAppointments(processedAppointments);

        } catch (err: any) {
            console.error('Error fetching appointments:', err);
            // Considerar mostrar un toast aquí si es importante para el usuario saber que falló
            // showToast(`Error al cargar citas: ${err.message}`, 'warning');
        } finally {
            setLoadingAppointments(false);
        }
    };


    // --- Clima ---
    useEffect(() => {
        const fetchWeather = () => {
            if (!navigator.geolocation) {
                console.warn("Geolocation is not supported by this browser.");
                setWeatherData(prev => ({ ...prev, condition: 'Geolocalización no soportada', location: 'Desconocida', icon: <AlertTriangle className="h-5 w-5 text-white" /> }));
                setLoadingWeather(false);
                return;
            }

            setLoadingWeather(true);
            navigator.geolocation.getCurrentPosition(async (position) => {
                const { latitude, longitude } = position.coords;
                try {
                    const weatherApiUrl = `${openMeteoApiEndpoint}?latitude=${latitude}&longitude=${longitude}¤t=temperature_2m,weather_code&timezone=auto`;
                    const response = await fetch(weatherApiUrl);
                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        throw new Error(`Error ${response.status}: ${errorData?.reason || response.statusText}`);
                    }
                    const data = await response.json();

                    const getWeatherDetails = (code: number): { condition: string; icon: JSX.Element } => {
                        const conditions: { [key: number]: { condition: string; icon: JSX.Element } } = {
                          0: { condition: 'Despejado', icon: <Sun className="h-5 w-5 text-white" /> },
                          1: { condition: 'Mayormente despejado', icon: <Sun className="h-5 w-5 text-white" /> },
                          2: { condition: 'Parcialmente nublado', icon: <Cloud className="h-5 w-5 text-white" /> },
                          3: { condition: 'Nublado', icon: <Cloud className="h-5 w-5 text-white" /> },
                          45: { condition: 'Niebla', icon: <CloudFog className="h-5 w-5 text-white" /> },
                          48: { condition: 'Niebla engelante', icon: <CloudFog className="h-5 w-5 text-white" /> },
                          51: { condition: 'Llovizna ligera', icon: <CloudDrizzle className="h-5 w-5 text-white" /> },
                          53: { condition: 'Llovizna moderada', icon: <CloudDrizzle className="h-5 w-5 text-white" /> },
                          55: { condition: 'Llovizna densa', icon: <CloudRain className="h-5 w-5 text-white" /> },
                          61: { condition: 'Lluvia ligera', icon: <CloudRain className="h-5 w-5 text-white" /> },
                          63: { condition: 'Lluvia moderada', icon: <CloudRain className="h-5 w-5 text-white" /> },
                          65: { condition: 'Lluvia fuerte', icon: <CloudRain className="h-5 w-5 text-white" /> },
                          71: { condition: 'Nieve ligera', icon: <Snowflake className="h-5 w-5 text-white" /> },
                          73: { condition: 'Nieve moderada', icon: <Snowflake className="h-5 w-5 text-white" /> },
                          75: { condition: 'Nieve fuerte', icon: <Snowflake className="h-5 w-5 text-white" /> },
                          80: { condition: 'Chubascos ligeros', icon: <CloudRain className="h-5 w-5 text-white" /> },
                          81: { condition: 'Chubascos moderados', icon: <CloudRain className="h-5 w-5 text-white" /> },
                          82: { condition: 'Chubascos violentos', icon: <CloudRain className="h-5 w-5 text-white" /> },
                          95: { condition: 'Tormenta', icon: <CloudLightning className="h-5 w-5 text-white" /> },
                          96: { condition: 'Tormenta con granizo ligero', icon: <CloudLightning className="h-5 w-5 text-white" /> },
                          99: { condition: 'Tormenta con granizo fuerte', icon: <CloudLightning className="h-5 w-5 text-white" /> },
                        };
                        return conditions[code] ?? { condition: 'No disponible', icon: <Cloud className="h-5 w-5 text-white" /> };
                      };

                    if (data?.current) {
                        const details = getWeatherDetails(data.current.weather_code);
                        setWeatherData({
                            temp: Math.round(data.current.temperature_2m),
                            condition: details.condition,
                            icon: details.icon,
                            location: 'Tu ubicación', // Podrías usar una API de geocodificación inversa si necesitas la ciudad
                            day: new Date().toLocaleDateString('es-ES', { weekday: 'long' }),
                        });
                    } else {
                        throw new Error("Datos del clima no válidos recibidos.");
                    }

                } catch (err: any) {
                    console.error('Error fetching weather data:', err);
                    setWeatherData(prev => ({
                        ...prev,
                        temp: null,
                        condition: 'Error al cargar clima',
                        location: 'Desconocida',
                        icon: <AlertTriangle className="h-5 w-5 text-white" />,
                    }));
                    // showToast(`Error al obtener clima: ${err.message}`, 'warning'); // Opcional
                } finally {
                    setLoadingWeather(false);
                }
            }, (geoError) => {
                console.error("Error getting geolocation: ", geoError);
                setWeatherData(prev => ({
                    ...prev,
                    temp: null,
                    condition: 'Ubicación denegada',
                    location: 'Desconocida',
                    icon: <MapPin className="h-5 w-5 text-white" />
                }));
                setLoadingWeather(false);
                // showToast('No se pudo obtener la ubicación para el clima.', 'warning'); // Opcional
            });
        };

        fetchWeather();
        const intervalId = setInterval(fetchWeather, 15 * 60 * 1000); // Refrescar cada 15 minutos
        return () => clearInterval(intervalId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // No necesita showToast como dependencia aquí

    // --- Navegación y UI ---
    const handleViewChange = (view: string) => {
        setCurrentView(view);
        setMobileMenuOpen(false);
    };

    const formatDate = (dateString: string | null | undefined): string => {
        if (!dateString) return 'No programada';
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return 'Fecha inválida';
            return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
        } catch (e) {
            console.error("Error formatting date:", dateString, e);
            return 'Error fecha';
        }
    };

    const formatTime = (timeString: string | null | undefined): string => {
        if (!timeString) return '--:--';
        // Intenta parsear asumiendo HH:MM:SS o HH:MM
        try {
             const date = new Date(`1970-01-01T${timeString}`);
             if (isNaN(date.getTime())) return timeString; // Devuelve original si no es parseable
             return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false });
        } catch(e) {
            console.error("Error formatting time:", timeString, e);
            return timeString; // Devuelve original en caso de error
        }
    };


    const toggleMobileMenu = () => {
        setMobileMenuOpen(!mobileMenuOpen);
    };

    // --- Renderizado Condicional ---

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-primary"></div>
            </div>
        );
    }

    // El ToastProvider debe envolver TODO el contenido que pueda necesitar toasts,
    // incluyendo los estados de error y el formulario de perfil.
    return (
        // --- CORRECCIÓN 3: Envolver todo el retorno del componente con ToastProvider ---
        // Esto asegura que useToast() funcione en cualquier parte del componente.
        // Idealmente, este Provider estaría en un nivel superior (App.tsx o main.tsx)
        // envolviendo toda la aplicación, pero para que este componente funcione
        // de forma autónoma como está escrito, lo ponemos aquí.
        <ToastProvider>
            {error ? (
                <div className="min-h-screen flex flex-col items-center justify-center bg-red-50 p-4 text-center">
                    <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
                    <h2 className="text-xl font-semibold text-red-700 mb-2">Ocurrió un Error</h2>
                    <p className="text-red-600 mb-6">{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                    >
                        Intentar de Nuevo
                    </button>
                </div>
            ) : showPatientForm ? (
                // --- Formulario de Creación de Perfil ---
                <div className="min-h-screen bg-gradient-to-br from-primary/5 via-white to-accent/5 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl p-8 max-w-lg w-full border border-gray-100">
                        <div className="flex flex-col items-center justify-center mb-8 text-center">
                            <User className="h-16 w-16 text-primary mb-4" />
                            <h2 className="text-3xl font-bold text-gray-800">Completa tu perfil</h2>
                            <p className="text-gray-600 mt-2">Necesitamos algunos datos para personalizar tu experiencia.</p>
                        </div>
                        <form onSubmit={handleFormSubmit} className="space-y-5">
                            <div>
                                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1.5">Nombre completo*</label>
                                <input
                                    id="name" type="text" name="name" value={formData.name} onChange={handleFormChange} required
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                                    placeholder="Ej: Ana García López"
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                    <label htmlFor="date_of_birth" className="block text-sm font-medium text-gray-700 mb-1.5">Fecha de nacimiento</label>
                                    <input
                                        id="date_of_birth" type="date" name="date_of_birth" value={formData.date_of_birth} onChange={handleFormChange}
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                                        max={new Date().toISOString().split("T")[0]} // Evitar fechas futuras
                                    />
                                </div>
                                <div>
                                    <label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-1.5">Género</label>
                                    <select
                                        id="gender" name="gender" value={formData.gender} onChange={handleFormChange}
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors bg-white appearance-none"
                                    >
                                        <option value="">Seleccionar...</option>
                                        <option value="Masculino">Masculino</option>
                                        <option value="Femenino">Femenino</option>
                                        <option value="Otro">Otro</option>
                                        <option value="Prefiero no decir">Prefiero no decir</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1.5">Teléfono</label>
                                <input
                                    id="phone" type="tel" name="phone" value={formData.phone} onChange={handleFormChange}
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                                    placeholder="Ej: 55 1234 5678"
                                />
                            </div>
                            <div className="pt-4">
                                <button
                                    type="submit"
                                    className="w-full bg-primary text-white py-3 px-4 rounded-lg hover:bg-primary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 font-semibold text-lg shadow-md hover:shadow-lg"
                                >
                                    Guardar y Continuar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            ) : (
                // --- Interfaz Principal ---
                <div className="min-h-screen flex flex-col bg-gray-100">
                    {/* El ToastProvider ya está envolviendo todo */}

                    {/* --- Header Fijo --- */}
                    <header className="bg-white shadow-sm sticky top-0 z-30 border-b border-gray-200">
                        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <img src="/logo.png" alt="Carelux Logo" className="h-10 w-auto" /> {/* Asegúrate que logo.png esté en public/ */}
                                <h1 className="text-xl font-semibold text-gray-800 hidden sm:block">
                                    Portal Paciente
                                </h1>
                            </div>
                            <button
                                className="p-2 rounded-md text-gray-600 hover:text-primary hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary lg:hidden"
                                onClick={toggleMobileMenu}
                                aria-label="Abrir menú"
                            >
                                <Menu className="h-6 w-6" />
                            </button>
                        </div>
                    </header>

                    {/* --- Contenido Principal --- */}
                    <main className="flex-1 pt-6 pb-24 lg:pb-8">
                        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">

                                {/* --- Sidebar (Desktop) --- */}
                                <aside className="lg:col-span-3 xl:col-span-2 hidden lg:block">
                                    <div className="sticky top-20 bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-1.5">
                                        {[
                                            { view: 'home', label: 'Inicio', icon: Home },
                                            { view: 'appointments', label: 'Calendario', icon: CalendarIcon },
                                            { view: 'medications', label: 'Recetas', icon: FileText },
                                            { view: 'EREBUS', label: 'EREBUS', icon: FileText }, // Considera un icono más apropiado
                                            { view: 'pharmacies', label: 'Farmacias', icon: Package2 },
                                            { view: 'profile', label: 'Perfil', icon: User },
                                        ].map(item => (
                                            <button
                                                key={item.view}
                                                className={`w-full flex items-center space-x-3 p-3 text-sm rounded-lg transition-colors duration-150 ${currentView === item.view
                                                    ? 'bg-primary/10 text-primary font-semibold'
                                                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
                                                    }`}
                                                onClick={() => handleViewChange(item.view)}
                                            >
                                                <item.icon className="h-5 w-5 flex-shrink-0" />
                                                <span>{item.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </aside>

                                {/* --- Área de Contenido --- */}
                                <div className="lg:col-span-9 xl:col-span-10 space-y-6">

                                    {/* --- Tarjetas Superiores (Solo en Home) --- */}
                                    {currentView === 'home' && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                                            {/* Tarjeta Bienvenida */}
                                            <div className="bg-gradient-to-br from-primary/80 to-primary rounded-xl shadow-lg p-5 text-white">
                                                <div className="flex justify-between items-start mb-3">
                                                    <div>
                                                        <p className="text-sm font-medium opacity-90">Hola de nuevo,</p>
                                                        <h2 className="text-2xl font-bold truncate">
                                                            {patientData?.name || 'Paciente'}
                                                        </h2>
                                                        <p className="text-xs opacity-80 mt-1 flex items-center gap-1.5">
                                                            <Clock className="h-3.5 w-3.5" />
                                                            {new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                                        </p>
                                                    </div>
                                                    <div className="flex-shrink-0 h-11 w-11 bg-white/20 rounded-full flex items-center justify-center ring-2 ring-white/30">
                                                        <Sunrise className="h-6 w-6" />
                                                    </div>
                                                </div>
                                                <p className="text-xs opacity-90 mt-2">¡Que tengas un excelente día!</p>
                                            </div>

                                            {/* Tarjeta Próxima Cita */}
                                            <div
                                                className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 cursor-pointer hover:shadow-md transition-shadow group"
                                                onClick={() => handleViewChange('appointments')}
                                                role="button" tabIndex={0} aria-label="Ver próxima cita"
                                            >
                                                <div className="flex justify-between items-start mb-3">
                                                    <div>
                                                        <p className="text-sm text-gray-500 font-medium">Próxima Cita</p>
                                                        <h2 className="text-xl font-bold text-gray-800">
                                                            {appointments.length > 0 ? formatDate(appointments[0].appointment_date) : 'No hay citas'}
                                                        </h2>
                                                        <p className="text-xs text-gray-500 mt-1 truncate">
                                                            {appointments.length > 0
                                                                ? `${formatTime(appointments[0].appointment_time)} - ${appointments[0].tipo_consulta || 'General'} con ${appointments[0].doctor_name || 'Dr. Asignado'}`
                                                                : 'Agenda tu próxima consulta'}
                                                        </p>
                                                    </div>
                                                    <div className="flex-shrink-0 h-11 w-11 bg-gradient-to-br from-accent/80 to-accent rounded-full flex items-center justify-center shadow transition-transform duration-300 group-hover:scale-110">
                                                        <CalendarIcon className="h-5 w-5 text-white" />
                                                    </div>
                                                </div>
                                                <span className="text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                                    Ver detalles
                                                </span>
                                            </div>

                                            {/* Tarjeta Clima */}
                                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                                                <div className="flex justify-between items-start mb-3">
                                                    <div>
                                                        <p className="text-sm text-gray-500 font-medium capitalize">{weatherData.day}</p>
                                                        <h2 className="text-xl font-bold text-gray-800">
                                                            {loadingWeather ? '...' : (weatherData.temp !== null ? `${weatherData.temp}°C` : '--')}
                                                        </h2>
                                                        <p className="text-xs text-gray-500 mt-1 truncate">
                                                            {weatherData.condition} • {weatherData.location}
                                                        </p>
                                                    </div>
                                                    <div className={`flex-shrink-0 h-11 w-11 rounded-full flex items-center justify-center shadow ${loadingWeather ? 'bg-gray-400 animate-pulse' : 'bg-gradient-to-br from-blue-400 to-cyan-400'}`}>
                                                        {weatherData.icon}
                                                    </div>
                                                </div>
                                                <p className="text-xs text-gray-500">Clima actual en tu zona.</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* --- Tabla Citas (Solo en Home) --- */}
                                    {currentView === 'home' && (
                                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                            <div className="px-5 py-4 border-b border-gray-200 flex justify-between items-center">
                                                <h3 className="text-lg font-semibold text-gray-800">Citas Próximas</h3>
                                                <button
                                                    className="text-sm font-medium text-primary hover:text-primary/80 focus:outline-none"
                                                    onClick={() => handleViewChange('appointments')}
                                                >
                                                    Ver todas
                                                </button>
                                            </div>
                                            {loadingAppointments ? (
                                                <div className="h-40 flex items-center justify-center text-gray-500">Cargando citas...</div>
                                            ) : appointments.length > 0 ? (
                                                <div className="overflow-x-auto">
                                                    <table className="min-w-full divide-y divide-gray-200">
                                                        <thead className="bg-gray-50/50">
                                                            <tr>
                                                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                                                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hora</th>
                                                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Tipo</th>
                                                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Doctor</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="bg-white divide-y divide-gray-200">
                                                            {appointments.slice(0, 4).map((appt) => ( // Mostrar hasta 4 citas
                                                                <tr key={appt.id} className="hover:bg-gray-50 transition-colors">
                                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800">{formatDate(appt.appointment_date)}</td>
                                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{formatTime(appt.appointment_time)}</td>
                                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 hidden md:table-cell">{appt.tipo_consulta || 'General'}</td>
                                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{appt.doctor_name || 'No asignado'}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            ) : (
                                                <div className="h-40 flex flex-col items-center justify-center text-center px-6 py-4">
                                                    <CalendarIcon className="h-10 w-10 text-gray-400 mb-3" />
                                                    <p className="text-sm text-gray-500">No tienes citas programadas próximamente.</p>
                                                    <button
                                                        onClick={() => handleViewChange('appointments')}
                                                        className="mt-3 text-sm font-medium text-primary hover:underline"
                                                    >
                                                        Agendar una cita
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* --- Panel de Contenido Dinámico (Otras Vistas) --- */}
                                    {/* // TODO: Implementar o importar ContentPanel si es necesario */}
                                    {currentView !== 'home' && currentView !== 'profile' && (
                                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                                            <h2 className="text-xl font-semibold mb-4 capitalize">{currentView}</h2>
                                            <p className="text-gray-600">Contenido para la vista "{currentView}" irá aquí.</p>
                                            {/* Ejemplo para EREBUS */}
                                            {currentView === 'EREBUS' && (
                                                <div className="mt-4">
                                                    <p>Información relacionada con EREBUS (API: {erebusApiEndpoint})</p>
                                                    {/* Aquí iría la lógica para interactuar con la API de EREBUS */}
                                                </div>
                                            )}
                                             {/* Ejemplo para Farmacias */}
                                             {currentView === 'pharmacies' && (
                                                <div className="mt-4">
                                                    <p>Funcionalidad de búsqueda o listado de farmacias.</p>
                                                     {/* Aquí podrías tener un mapa o una lista */}
                                                </div>
                                            )}
                                             {/* Ejemplo para Recetas */}
                                             {currentView === 'medications' && (
                                                <div className="mt-4">
                                                    <p>Listado de recetas médicas.</p>
                                                    {/* Aquí podrías listar las recetas del paciente */}
                                                </div>
                                            )}
                                             {/* Ejemplo para Calendario Completo */}
                                             {currentView === 'appointments' && (
                                                <div className="mt-4">
                                                    <h3 className="text-lg font-semibold mb-3">Todas las Citas</h3>
                                                    {loadingAppointments ? <p>Cargando...</p> :
                                                     appointments.length > 0 ? (
                                                        <ul className="space-y-3">
                                                            {appointments.map(appt => (
                                                                <li key={appt.id} className="p-3 border rounded-md bg-gray-50">
                                                                    <p><strong>Fecha:</strong> {formatDate(appt.appointment_date)} - {formatTime(appt.appointment_time)}</p>
                                                                    <p><strong>Tipo:</strong> {appt.tipo_consulta || 'General'}</p>
                                                                    <p><strong>Doctor:</strong> {appt.doctor_name || 'No asignado'}</p>
                                                                    {/* Añadir más detalles o acciones si es necesario */}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                     ) : <p>No hay citas programadas.</p>}
                                                </div>
                                            )}
                                            {/* Añadir botón de volver si no es 'home' */}
                                             <button onClick={() => handleViewChange('home')} className="mt-6 text-primary hover:underline flex items-center gap-1 text-sm">
                                                <ArrowLeft size={16}/> Volver al Inicio
                                             </button>
                                        </div>
                                        // Reemplaza este div con tu componente ContentPanel si lo tienes:
                                        // <ContentPanel
                                        //   view={currentView as any}
                                        //   patientId={patientData?.id} // Pasar el ID del paciente
                                        //   onClose={() => handleViewChange('home')}
                                        // />
                                    )}


                                    {/* --- Contenido de Perfil (Solo en Vista Profile) --- */}
                                    {currentView === 'profile' && patientData && ( // Asegurarse que patientData existe
                                        <div className="space-y-6">
                                            {/* Tarjeta Código de Fidelización */}
                                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 md:p-6">
                                                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
                                                    <div>
                                                        <h3 className="text-lg font-semibold text-gray-800 mb-1">Código de Identificación</h3>
                                                        <p className="text-sm text-gray-600 mb-3">Usa este código para identificarte rápidamente en tus visitas.</p>
                                                        <p className="text-2xl font-bold text-primary font-mono tracking-widest bg-gray-100 px-4 py-2 rounded-md inline-block break-all">
                                                            {patientData?.surecode || loyaltyCode || 'No Generado'}
                                                        </p>
                                                    </div>
                                                    <div className="flex flex-col sm:flex-row md:flex-col gap-3 mt-2 md:mt-0 flex-shrink-0">
                                                        {(!patientData?.surecode && !loyaltyCode) && (
                                                            <button
                                                                onClick={generateLoyaltyCode}
                                                                disabled={isGeneratingCode}
                                                                className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 text-sm font-medium shadow disabled:opacity-70"
                                                            >
                                                                {isGeneratingCode ? (
                                                                    <> <span className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></span><span>Generando...</span> </>
                                                                ) : ( <> <QrCode className="h-4 w-4" /> <span>Generar Código</span> </>)}
                                                            </button>
                                                        )}
                                                        {(patientData?.surecode || loyaltyCode) && (
                                                            <button
                                                                onClick={() => setShowBarcode((prev) => !prev)}
                                                                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 text-sm font-medium"
                                                            >
                                                                {showBarcode ? 'Ocultar Barras' : 'Mostrar Barras'}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Código de Barras */}
                                                {(patientData?.surecode || loyaltyCode) && showBarcode && (
                                                    <div className="mt-6 p-4 bg-white rounded-lg border border-gray-200 overflow-x-auto max-w-md mx-auto flex justify-center">
                                                        <Barcode
                                                            value={patientData?.surecode || loyaltyCode}
                                                            width={1.8} height={60} margin={10}
                                                            displayValue={false}
                                                            background="#ffffff" lineColor="#000000"
                                                        />
                                                    </div>
                                                )}
                                            </div>

                                            {/* Tarjeta Información Personal */}
                                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                                <div className="px-5 py-4 border-b border-gray-200 sm:px-6">
                                                    <h3 className="text-lg font-semibold text-gray-800">Información Personal</h3>
                                                </div>
                                                <div className="px-5 py-5 sm:px-6">
                                                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
                                                        {[
                                                            { label: 'Nombre completo', value: patientData?.name },
                                                            { label: 'Fecha de nacimiento', value: formatDate(patientData?.date_of_birth) },
                                                            { label: 'Correo electrónico', value: patientData?.email || user?.email }, // Fallback al email del usuario si no está en patient
                                                            { label: 'Teléfono', value: patientData?.phone },
                                                            { label: 'Género', value: patientData?.gender },
                                                            // Añade más campos si existen en tu tabla 'patients'
                                                            // { label: 'Dirección', value: patientData?.address },
                                                        ].map(item => item.value ? ( // Solo renderizar si hay valor
                                                            <div key={item.label} className="sm:col-span-1">
                                                                <dt className="text-sm font-medium text-gray-500">{item.label}</dt>
                                                                <dd className="mt-1 text-sm text-gray-900">{item.value}</dd>
                                                            </div>
                                                        ) : null)}
                                                    </dl>
                                                </div>
                                                {/* Botón Editar (funcionalidad futura) */}
                                                {/* <div className="px-5 py-3 bg-gray-50 border-t border-gray-200 text-right sm:px-6">
                                                    <button className="text-sm font-medium text-primary hover:text-primary/80 cursor-not-allowed opacity-50" disabled>Editar Perfil</button>
                                                </div> */}
                                            </div>
                                        </div>
                                    )}

                                </div> {/* Fin Columna Contenido Principal */}
                            </div> {/* Fin Grid Principal */}
                        </div> {/* Fin Max Width Container */}
                    </main>

                    {/* --- Navegación Inferior (Móvil) --- */}
                    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-20 lg:hidden shadow-[0_-2px_5px_rgba(0,0,0,0.05)]">
                        <div className="grid grid-cols-6 h-16">
                            {[
                                { view: 'home', label: 'Inicio', icon: Home },
                                { view: 'appointments', label: 'Citas', icon: CalendarIcon },
                                { view: 'medications', label: 'Recetas', icon: FileText },
                                { view: 'EREBUS', label: 'EREBUS', icon: FileText },
                                { view: 'pharmacies', label: 'Farmacias', icon: Package2 },
                                { view: 'profile', label: 'Perfil', icon: User },
                            ].map(item => (
                                <button
                                    key={item.view}
                                    className={`flex flex-col items-center justify-center pt-1 transition-colors duration-150 ${currentView === item.view ? 'text-primary' : 'text-gray-500 hover:text-primary'
                                        }`}
                                    onClick={() => handleViewChange(item.view)}
                                    aria-label={item.label}
                                >
                                    <item.icon className="h-5 w-5 mb-0.5" />
                                    <span className="text-[10px] font-medium tracking-tight text-center leading-tight">{item.label}</span>
                                </button>
                            ))}
                        </div>
                    </nav>

                    {/* --- Menú Lateral Móvil (Overlay) --- */}
                    {mobileMenuOpen && (
                        <>
                            {/* Backdrop */}
                            <div
                                className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden"
                                onClick={toggleMobileMenu} aria-hidden="true"
                            ></div>
                            {/* Panel */}
                            <div className="fixed inset-y-0 left-0 max-w-xs w-full bg-white shadow-xl z-40 lg:hidden flex flex-col" >
                                <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <img src="/logo.png" alt="Logo" className="h-8 w-auto" />
                                        <span className="text-lg font-semibold text-gray-800">Menú</span>
                                    </div>
                                    <button
                                        className="p-2 -mr-2 rounded-md text-gray-500 hover:bg-gray-100"
                                        onClick={toggleMobileMenu} aria-label="Cerrar menú"
                                    > <X className="h-6 w-6" /> </button>
                                </div>
                                <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
                                    {[
                                        { view: 'home', label: 'Inicio', icon: Home },
                                        { view: 'appointments', label: 'Calendario', icon: CalendarIcon },
                                        { view: 'medications', label: 'Recetas', icon: FileText },
                                        { view: 'EREBUS', label: 'EREBUS', icon: FileText },
                                        { view: 'pharmacies', label: 'Farmacias', icon: Package2 },
                                        { view: 'profile', label: 'Perfil', icon: User },
                                    ].map(item => (
                                        <button
                                            key={item.view}
                                            className={`w-full flex items-center space-x-3 p-3 text-sm rounded-lg transition-colors duration-150 ${currentView === item.view
                                                ? 'bg-primary/10 text-primary font-semibold'
                                                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
                                                }`}
                                            onClick={() => handleViewChange(item.view)}
                                        >
                                            <item.icon className="h-5 w-5 flex-shrink-0" />
                                            <span>{item.label}</span>
                                        </button>
                                    ))}
                                </nav>
                            </div>
                        </>
                    )}

                </div> // Fin Interfaz Principal
            )}
        </ToastProvider> // Fin del wrapper ToastProvider
    );
};

export default Paciente_Interfaz;
