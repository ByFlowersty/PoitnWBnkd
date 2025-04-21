import { useState, useEffect, useCallback } from 'react'; // Added useCallback
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
  // --- Added missing icons from previous version ---
  MapPin,
  ArrowLeft,
  Sun,
  Moon,
  Cloud,
  CloudFog,
  CloudDrizzle,
  CloudLightning,
  Snowflake,
  Info,
  AlertTriangle,
} from 'lucide-react';
import Barcode from 'react-barcode';
// Removed Header import as it seems defined inline now
// import Header from '../components/paciente/Header';
// Removed ContentPanel import, will use inline placeholders or assume it exists
// import ContentPanel from '../components/paciente/ContentPanel';
import supabase from '../lib/supabaseClient';
// --- Remove incorrect ToastProvider import ---
// import ToastProvider from '../components/providers/ToastProvider';
// --- Import react-hot-toast ---
import toast from 'react-hot-toast'; // Correct import for react-hot-toast

// --- Component Definition ---
const Paciente_Interfaz: React.FC = () => {
  // --- State Variables ---
  const [currentView, setCurrentView] = useState<string>('home');
  const [patientData, setPatientData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null); // Added error state
  const [loyaltyCode, setLoyaltyCode] = useState<string>('');
  const [showBarcode, setShowBarcode] = useState<boolean>(false);
  const [isGeneratingCode, setIsGeneratingCode] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState<boolean>(false); // Added loading state for appointments
  const [user, setUser] = useState<any>(null);
  const [showPatientForm, setShowPatientForm] = useState<boolean>(false);
  const [formData, setFormData] = useState({
    name: '',
    date_of_birth: '',
    gender: '',
    phone: ''
  });

  // --- Weather State ---
  const [weatherData, setWeatherData] = useState<{
    temp: number | null; // Initialize temp to null
    condition: string;
    location: string;
    day: string;
    icon: JSX.Element; // Added icon state
  }>({
    temp: null,
    condition: 'Cargando...',
    location: 'Obteniendo ubicación...',
    day: new Date().toLocaleDateString('es-ES', { weekday: 'long' }),
    icon: <Cloud className="h-5 w-5 text-white" /> // Default icon
  });
  const [loadingWeather, setLoadingWeather] = useState<boolean>(true); // Added loading state for weather

  // --- Fetch Appointments Function ---
  // Use useCallback to memoize if passed as prop or dependency
  const fetchAppointments = useCallback(async (patientId: string | null = null) => {
    // Use patientId from state if not provided, ensure user and patientData exist
    const idToFetch = patientId || patientData?.id;
    if (!idToFetch) {
      // console.log("Cannot fetch appointments without patient ID");
      return; // Exit if no ID is available
    }

    setLoadingAppointments(true);
    try {
      const { data, error } = await supabase
        .from('appointments')
        // --- Select specific fields and join doctor's name ---
        .select(`
          id,
          appointment_date,
          appointment_time,
          tipo_consulta,
          doctors ( name )
        `)
        .eq('patient_id', idToFetch)
        .order('appointment_date', { ascending: true })
        .order('appointment_time', { ascending: true }); // Order by time as well

      if (error) throw error;

      // Process data to flatten doctor name
      const processedAppointments = data?.map(appt => ({
        ...appt,
        doctor_name: appt.doctors?.name || 'Dr. Asignado' // Use optional chaining
      })) || [];

      setAppointments(processedAppointments);
    } catch (fetchError: any) {
      console.error('Error fetching appointments:', fetchError);
      // Use toast for non-critical errors like fetching appointments
      toast.error('Error al cargar las citas.');
    } finally {
      setLoadingAppointments(false);
    }
  }, [patientData?.id]); // Dependency on patientData.id


  // --- Authentication and Patient Data Check ---
  useEffect(() => {
    const checkAuthAndPatientData = async () => {
      setLoading(true);
      setError(null); // Reset error on load
      try {
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

        if (authError || !authUser) {
          // Use toast before redirecting
          toast.error('Sesión no válida. Redirigiendo a login...');
          // Give toast time to show
          setTimeout(() => {
            window.location.href = '/login';
          }, 1500);
          return;
        }

        setUser(authUser);

        // --- Use maybeSingle to handle 0 or 1 result without error ---
        const { data: patient, error: patientError } = await supabase
          .from('patients')
          .select('*')
          .eq('user_id', authUser.id)
          .maybeSingle(); // Use maybeSingle instead of single

        // Handle potential error during fetch
        if (patientError) {
            console.error("Database error fetching patient:", patientError);
            throw new Error("Error al contactar la base de datos para obtener perfil.");
        }

        if (!patient) {
          // No patient profile found, show the form
          setShowPatientForm(true);
          setLoading(false);
        } else {
          // Patient found, set data and fetch appointments
          setPatientData(patient);
          setLoyaltyCode(patient.surecode || ''); // Load existing code
          setShowPatientForm(false);
          setLoading(false);
          fetchAppointments(patient.id); // Fetch appointments for this patient
        }

      } catch (err: any) {
        console.error('Error checking auth and patient data:', err);
        setError(err.message || 'Ocurrió un error inesperado al cargar tus datos.'); // Set error state
        // Don't use toast here if showing a full error screen
        setLoading(false);
      }
    };

    checkAuthAndPatientData();
    // fetchAppointments is memoized, safe to include if needed, but called internally
  }, [fetchAppointments]);

  // --- Form Handling ---
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return; // Ensure user is set

    try {
      // --- Insert and select the new record ---
      const { data: newPatient, error } = await supabase
        .from('patients')
        .insert({
          user_id: user.id,
          email: user.email, // Make sure user.email exists and is correct
          name: formData.name,
          // Use null if date is empty, otherwise Supabase might error
          date_of_birth: formData.date_of_birth || null,
          gender: formData.gender || null,
          phone: formData.phone || null,
          created_at: new Date().toISOString()
        })
        .select() // Return the inserted row
        .single(); // Expect one row back

      if (error) throw error;

      // Update state with the newly created patient data
      setPatientData(newPatient);
      setShowPatientForm(false); // Hide form
      toast.success('Perfil guardado exitosamente!'); // Use toast for success
      fetchAppointments(newPatient.id); // Fetch appointments for the new profile

    } catch (err: any) { // Catch specific Supabase error type if needed
      console.error('Error saving patient data:', err);
      // Use toast for form submission errors
      toast.error(`Error al guardar el perfil: ${err.message || 'Inténtelo de nuevo.'}`);
    }
  };

  // --- Loyalty Code Generation ---
  const generateLoyaltyCode = async () => {
     // Use patientData.id for consistency if the relation is on patient id
    if (!patientData || !patientData.id) {
        toast.error('Datos del paciente no cargados para generar código.');
        return;
    }
    setIsGeneratingCode(true);
    try {
      const characters = 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789'; // Avoid ambiguous chars like O, 0, I, 1
      const codeLength = 10; // Reduced length slightly
      let result = '';
      for (let i = 0; i < codeLength; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
      }


      // Update the patient record with the new code
      const { error } = await supabase
        .from('patients')
        .update({ surecode: result })
        .eq('id', patientData.id); // Use patient's primary key 'id'

      if (error) throw error;

      setLoyaltyCode(result); // Update local state
      // Also update the main patientData state so UI reflects change immediately
      setPatientData((prev: any) => ({ ...prev, surecode: result }));
      toast.success('Código de identificación generado.'); // Use toast

    } catch (err: any) {
      console.error('Error updating loyalty code:', err);
      // Use toast for errors
      toast.error(`Error al generar el código: ${err.message || 'Inténtelo de nuevo.'}`);
    } finally {
      setIsGeneratingCode(false);
    }
  };


  // --- Weather Fetching Effect ---
  useEffect(() => {
    const fetchWeather = () => {
      if (!navigator.geolocation) {
        console.warn("Geolocation is not supported by this browser.");
        setWeatherData(prev => ({
             ...prev,
             temp: null,
             condition: 'Geolocalización no soportada',
             location: 'Desconocida',
             icon: <AlertTriangle className="h-5 w-5 text-white" />
        }));
        setLoadingWeather(false);
        return;
      }

      setLoadingWeather(true);
      navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          // Use environment variable or default for API endpoint
          const openMeteoApiEndpoint = import.meta.env.VITE_OPENMETEO_API_ENDPOINT || 'https://api.open-meteo.com/v1/forecast';
          const weatherApiUrl = `${openMeteoApiEndpoint}?latitude=${latitude}&longitude=${longitude}¤t=temperature_2m,weather_code&timezone=auto`;

          const response = await fetch(weatherApiUrl);
          if (!response.ok) {
             const errorData = await response.json().catch(() => ({}));
             throw new Error(`Weather API Error ${response.status}: ${errorData?.reason || response.statusText}`);
          }
          const data = await response.json();

          // --- Function to map weather code to condition and icon ---
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
              location: 'Tu ubicación', // Could use reverse geocoding API for city name
              day: new Date().toLocaleDateString('es-ES', { weekday: 'long' }),
            });
          } else {
            throw new Error("Datos del clima inválidos recibidos.");
          }

        } catch (fetchError: any) {
          console.error('Error fetching weather data:', fetchError);
          setWeatherData(prev => ({
            ...prev,
            temp: null,
            condition: 'Error al cargar',
            location: 'Desconocida',
            icon: <AlertTriangle className="h-5 w-5 text-white" />,
          }));
          // Optional: Show a non-blocking toast for weather errors
          // toast.error('No se pudo cargar el clima.');
        } finally {
          setLoadingWeather(false);
        }
      }, (geoError) => { // Handle geolocation error
        console.error("Error getting geolocation: ", geoError);
        setWeatherData(prev => ({
          ...prev,
          temp: null,
          condition: 'Ubicación denegada',
          location: 'Desconocida',
          icon: <MapPin className="h-5 w-5 text-white" />
        }));
        setLoadingWeather(false);
        // Optional: Show a non-blocking toast
        // toast.warn('No se pudo obtener la ubicación para el clima.');
      });
    };

    fetchWeather();
    // Optional: Refresh weather periodically
    // const intervalId = setInterval(fetchWeather, 15 * 60 * 1000);
    // return () => clearInterval(intervalId);
  }, []); // Empty dependency array, runs once on mount

  // --- UI Handlers ---
  const handleViewChange = (view: string) => {
    setCurrentView(view);
    setMobileMenuOpen(false); // Close mobile menu on navigation
  };

  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return 'No programada';
    try {
      const date = new Date(dateString);
      // Check if date is valid after parsing
      if (isNaN(date.getTime())) return 'Fecha inválida';
      return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) {
      console.error("Error formatting date:", dateString, e);
      return 'Error fecha';
    }
  };

  // Improved time formatting
  const formatTime = (timeString: string | null | undefined): string => {
    if (!timeString) return '--:--';
    // Handles HH:MM:SS or HH:MM
    try {
        const [hour, minute] = timeString.split(':');
        if (hour && minute) {
             const h = parseInt(hour, 10);
             const m = parseInt(minute, 10);
             if (!isNaN(h) && !isNaN(m)) {
                 return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
             }
        }
    } catch(e) {
        console.error("Error formatting time:", timeString, e);
    }
    return timeString; // Fallback to original string
  };


  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  // --- Render Logic ---

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-primary"></div>
      </div>
    );
  }

  // --- Added Error Display State ---
  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-red-50 p-4 text-center">
        <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
        <h2 className="text-xl font-semibold text-red-700 mb-2">Ocurrió un Error</h2>
        <p className="text-red-600 mb-6">{error}</p>
        <button
          onClick={() => window.location.reload()} // Simple reload action
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
        >
          Intentar de Nuevo
        </button>
      </div>
    );
  }


  if (showPatientForm) {
    // --- Patient Profile Creation Form ---
    // (Using the enhanced styling from the previous version)
    return (
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
                                max={new Date().toISOString().split("T")[0]} // Prevent future dates
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
    );
  }


  // --- Main Patient Interface ---
  // NOTE: Ensure <Toaster /> from react-hot-toast is rendered *outside* this component,
  // usually in your App.tsx or main layout file.
  // The <ToastProvider /> component defined earlier is NOT needed.
  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      {/* Remove the old ToastProvider rendering */}
      {/* <ToastProvider /> */}

      {/* --- Header (Simplified Inline Version) --- */}
      <header className="bg-white shadow-sm sticky top-0 z-30 border-b border-gray-200">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img
                src="/logo.png" // Ensure logo.png is in public folder
                alt="Carelux Logo"
                className="h-10 w-auto"
            />
            <h1 className="text-xl font-semibold text-gray-800 hidden sm:block">
              Portal Paciente
            </h1>
          </div>
          {/* Mobile menu button */}
          <button
            className="p-2 rounded-md text-gray-600 hover:text-primary hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary lg:hidden"
            onClick={toggleMobileMenu}
            aria-label="Abrir menú"
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>
      </header>

      {/* --- Main Content --- */}
      <main className="flex-1 pt-6 pb-24 lg:pb-8">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">

            {/* --- Sidebar (Desktop - Enhanced Styling) --- */}
            <aside className="lg:col-span-3 xl:col-span-2 hidden lg:block">
              <div className="sticky top-20 bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-1.5">
                {[
                  { view: 'home', label: 'Inicio', icon: Home },
                  { view: 'appointments', label: 'Calendario', icon: CalendarIcon },
                  { view: 'medications', label: 'Recetas', icon: FileText },
                  { view: 'EREBUS', label: 'EREBUS', icon: FileText }, // Placeholder
                  { view: 'pharmacies', label: 'Farmacias', icon: Package2 },
                  { view: 'profile', label: 'Perfil', icon: User }, // Use User icon for profile
                ].map(item => (
                  <button
                    key={item.view}
                    className={`w-full flex items-center space-x-3 p-3 text-sm rounded-lg transition-colors duration-150 ${
                      currentView === item.view
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

            {/* --- Mobile Menu Overlay (Enhanced Styling) --- */}
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
                          <img src="/logo.png" alt="Logo" className="h-8 w-auto"/>
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
                        className={`w-full flex items-center space-x-3 p-3 text-sm rounded-lg transition-colors duration-150 ${
                          currentView === item.view
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

            {/* --- Mobile Bottom Navigation (Enhanced Styling) --- */}
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
                       className={`flex flex-col items-center justify-center pt-1 transition-colors duration-150 ${
                         currentView === item.view ? 'text-primary' : 'text-gray-500 hover:text-primary'
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


            {/* --- Main Content Area --- */}
            <div className="lg:col-span-9 xl:col-span-10 space-y-6">

              {/* --- Top Cards (Home View Only - Enhanced Styling) --- */}
              {currentView === 'home' && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {/* Welcome Card */}
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

                  {/* Next Appointment Card */}
                  <div
                    className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 cursor-pointer hover:shadow-md transition-shadow group"
                    onClick={() => handleViewChange('appointments')}
                    role="button" tabIndex={0} aria-label="Ver próxima cita"
                  >
                     <div className="flex justify-between items-start mb-3">
                        <div>
                           <p className="text-sm text-gray-500 font-medium">Próxima Cita</p>
                           <h2 className="text-xl font-bold text-gray-800">
                             {/* --- Use appointments state --- */}
                             {appointments.length > 0 ? formatDate(appointments[0].appointment_date) : 'No hay citas'}
                           </h2>
                           <p className="text-xs text-gray-500 mt-1 truncate">
                             {/* --- Use appointments state --- */}
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

                  {/* Weather Card */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                     <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="text-sm text-gray-500 font-medium capitalize">{weatherData.day}</p>
                          <h2 className="text-xl font-bold text-gray-800">
                           {/* --- Use updated weather state --- */}
                           {loadingWeather ? '...' : (weatherData.temp !== null ? `${weatherData.temp}°C` : '--')}
                          </h2>
                          <p className="text-xs text-gray-500 mt-1 truncate">
                            {weatherData.condition} • {weatherData.location}
                          </p>
                        </div>
                        {/* --- Use dynamic weather icon --- */}
                        <div className={`flex-shrink-0 h-11 w-11 rounded-full flex items-center justify-center shadow ${loadingWeather ? 'bg-gray-400 animate-pulse' : 'bg-gradient-to-br from-blue-400 to-cyan-400'}`}>
                           {weatherData.icon}
                        </div>
                     </div>
                      <p className="text-xs text-gray-500">Clima actual en tu zona.</p>
                   </div>
                </div>
              )}

              {/* --- Appointments Table (Home View Only - Enhanced Styling) --- */}
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
                   {/* --- Handle loading state for appointments --- */}
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
                           {/* --- Slice to show limited appointments --- */}
                           {appointments.slice(0, 4).map((appt) => (
                             <tr key={appt.id} className="hover:bg-gray-50 transition-colors">
                               <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800">{formatDate(appt.appointment_date)}</td>
                               <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{formatTime(appt.appointment_time)}</td>
                               <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 hidden md:table-cell">{appt.tipo_consulta || 'General'}</td>
                               {/* --- Display fetched doctor name --- */}
                               <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{appt.doctor_name || 'No asignado'}</td>
                             </tr>
                           ))}
                         </tbody>
                       </table>
                     </div>
                   ) : (
                     // --- Improved empty state message ---
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

              {/* --- Dynamic Content Area (Non-Home Views) --- */}
              {/* Placeholder/Simplified version - Replace with actual ContentPanel or implementations */}
              {currentView !== 'home' && currentView !== 'profile' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h2 className="text-xl font-semibold mb-4 capitalize">{currentView}</h2>
                  {/* Example for Calendar View */}
                  {currentView === 'appointments' && (
                    <div>
                      <h3 className="text-lg font-semibold mb-3">Todas las Citas</h3>
                      {loadingAppointments ? <p>Cargando...</p> :
                       appointments.length > 0 ? (
                          <ul className="space-y-3">
                              {appointments.map(appt => (
                                  <li key={appt.id} className="p-3 border rounded-md bg-gray-50/80 hover:bg-gray-100 transition-colors">
                                      <p><strong>Fecha:</strong> {formatDate(appt.appointment_date)} - {formatTime(appt.appointment_time)}</p>
                                      <p><strong>Tipo:</strong> {appt.tipo_consulta || 'General'}</p>
                                      <p><strong>Doctor:</strong> {appt.doctor_name || 'No asignado'}</p>
                                  </li>
                              ))}
                          </ul>
                       ) : <p className="text-gray-500">No tienes citas programadas.</p>}
                    </div>
                  )}
                  {/* Add placeholders for other views */}
                   {currentView === 'medications' && <p className="text-gray-600">Listado de recetas médicas irá aquí.</p>}
                   {currentView === 'EREBUS' && <p className="text-gray-600">Interfaz o información de EREBUS irá aquí.</p>}
                   {currentView === 'pharmacies' && <p className="text-gray-600">Búsqueda o listado de farmacias irá aquí.</p>}

                  <button onClick={() => handleViewChange('home')} className="mt-6 text-primary hover:underline flex items-center gap-1 text-sm font-medium">
                     <ArrowLeft size={16}/> Volver al Inicio
                  </button>
                </div>
              )}

              {/* --- Profile View Content --- */}
              {currentView === 'profile' && patientData && ( // Ensure patientData is loaded
                <div className="space-y-6">
                  {/* Loyalty Code Card (Enhanced Styling) */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 md:p-6">
                     <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
                       <div>
                         <h3 className="text-lg font-semibold text-gray-800 mb-1">Código de Identificación</h3>
                         <p className="text-sm text-gray-600 mb-3">Usa este código para identificarte rápidamente.</p>
                         <p className="text-2xl font-bold text-primary font-mono tracking-widest bg-gray-100 px-4 py-2 rounded-md inline-block break-all">
                           {patientData?.surecode || loyaltyCode || 'No Generado'}
                         </p>
                       </div>
                       <div className="flex flex-col sm:flex-row md:flex-col gap-3 mt-2 md:mt-0 flex-shrink-0">
                          {(!patientData?.surecode && !loyaltyCode) && (
                            <button
                              onClick={generateLoyaltyCode}
                              disabled={isGeneratingCode}
                              className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 text-sm font-medium shadow disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                              {isGeneratingCode ? (
                                <> <span className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></span><span>Generando...</span> </>
                              ) : ( <> <QrCode className="h-4 w-4" /> <span>Generar Código</span> </>)}
                            </button>
                          )}
                          {(patientData?.surecode || loyaltyCode) && (
                            <button
                              onClick={() => setShowBarcode((prev) => !prev)}
                              className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 text-sm font-medium"
                            >
                               <QrCode className="h-4 w-4" />
                               <span>{showBarcode ? 'Ocultar Barras' : 'Mostrar Barras'}</span>
                            </button>
                          )}
                       </div>
                     </div>

                     {/* Barcode Display */}
                      {(patientData?.surecode || loyaltyCode) && showBarcode && (
                        <div className="mt-6 p-4 bg-white rounded-lg border border-gray-200 overflow-x-auto max-w-md mx-auto flex justify-center">
                          <Barcode
                            value={patientData?.surecode || loyaltyCode}
                            width={1.8} height={60} margin={10}
                            displayValue={false} // Value is shown above
                            background="#ffffff" lineColor="#000000"
                          />
                        </div>
                      )}
                  </div>

                  {/* Personal Information Card (Enhanced Styling) */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                     <div className="px-5 py-4 border-b border-gray-200 sm:px-6">
                       <h3 className="text-lg font-semibold text-gray-800">Información Personal</h3>
                     </div>
                     <div className="px-5 py-5 sm:px-6">
                       <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
                         {/* Use consistent data fields */}
                         {[
                           { label: 'Nombre completo', value: patientData?.name },
                           { label: 'Fecha de nacimiento', value: formatDate(patientData?.date_of_birth) },
                           { label: 'Correo electrónico', value: patientData?.email || user?.email },
                           { label: 'Teléfono', value: patientData?.phone },
                           { label: 'Género', value: patientData?.gender },
                         ].map(item => item.value && item.value !== 'Fecha inválida' && item.value !== 'No programada' ? ( // Render only if value exists and is valid
                           <div key={item.label} className="sm:col-span-1">
                             <dt className="text-sm font-medium text-gray-500">{item.label}</dt>
                             <dd className="mt-1 text-sm text-gray-900">{item.value}</dd>
                           </div>
                         ) : item.label === 'Nombre completo' || item.label === 'Correo electrónico' ? ( // Always show name/email placeholder if missing
                           <div key={item.label} className="sm:col-span-1">
                             <dt className="text-sm font-medium text-gray-500">{item.label}</dt>
                             <dd className="mt-1 text-sm text-gray-500 italic">No disponible</dd>
                           </div>
                         ): null)}
                       </dl>
                     </div>
                      {/* Optional Edit Button */}
                     {/* <div className="px-5 py-3 bg-gray-50 border-t border-gray-200 text-right sm:px-6">
                        <button className="text-sm font-medium text-primary hover:text-primary/80">Editar Perfil</button>
                     </div> */}
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
