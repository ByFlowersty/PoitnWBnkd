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
  // Consider adding a more specific icon for EREBUS if available, e.g., Shield, Database, Brain etc.
  // For now, we'll reuse FileText as you did.
} from 'lucide-react';
import Barcode from 'react-barcode';
// Removed Header import as it wasn't used in the final header structure
// import Header from '../components/paciente/Header';
import ContentPanel from '../components/paciente/ContentPanel';
import supabase from '../lib/supabaseClient';
import ToastProvider from '../components/providers/ToastProvider';
import EREBUS from '../components/paciente/EREBUS'; // Ensure this path is correct

const Paciente_Interfaz: React.FC = () => {
  const [currentView, setCurrentView] = useState<string>('home');
  const [patientData, setPatientData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loyaltyCode, setLoyaltyCode] = useState<string>('');
  const [showBarcode, setShowBarcode] = useState<boolean>(false);
  const [isGeneratingCode, setIsGeneratingCode] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [showPatientForm, setShowPatientForm] = useState<boolean>(false);
  const [formData, setFormData] = useState({
    name: '',
    date_of_birth: '',
    gender: '',
    phone: ''
  });

  // --- Start of Existing useEffect and functions (no changes needed here) ---
  useEffect(() => {
    const checkAuthAndPatientData = async () => {
      try {
        setLoading(true);
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

        if (authError || !authUser) {
          window.location.href = '/login';
          return;
        }

        setUser(authUser);

        const { data: patient, error: patientError } = await supabase
          .from('patients')
          .select('*')
          .eq('user_id', authUser.id)
          .single();

        if (patientError && patientError.code !== 'PGRST116') { // PGRST116 means no rows found, which is expected for new users
            console.error("Error fetching patient data:", patientError);
            // Handle other errors if needed
        }


        if (!patient) {
          setShowPatientForm(true);
          setLoading(false);
          return;
        }

        setPatientData(patient);
        setLoading(false);
        fetchAppointments(authUser.id); // Pass user id directly
      } catch (error) {
        console.error('Error checking auth and patient data:', error);
        setLoading(false);
        // Maybe show an error toast to the user
      }
    };

    checkAuthAndPatientData();
  }, []);

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return; // Guard clause

    try {
      const { error } = await supabase
        .from('patients')
        .insert({
          user_id: user.id,
          email: user.email,
          name: formData.name,
          date_of_birth: formData.date_of_birth || null, // Handle empty date
          gender: formData.gender || null, // Handle empty gender
          phone: formData.phone || null, // Handle empty phone
          created_at: new Date().toISOString()
        });

      if (error) throw error;

      // Refrescar datos del paciente
      const { data: newPatient, error: fetchError } = await supabase
        .from('patients')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (fetchError) throw fetchError;

      setPatientData(newPatient);
      setShowPatientForm(false);
      fetchAppointments(user.id); // Fetch appointments for the new patient
    } catch (error) {
      console.error('Error saving patient data:', error);
      alert('Error al guardar los datos del paciente. Por favor, inténtelo de nuevo.'); // More user-friendly error
    }
  };


  const generateLoyaltyCode = async () => {
    if (!user) return; // Ensure user exists
    setIsGeneratingCode(true);
    try {
      const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      const codeLength = 12;
      let result = '';
      for (let i = 0; i < codeLength; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
      }


      const { error } = await supabase
        .from('patients')
        .update({ surecode: result })
        .eq('user_id', user.id)
        .select() // Important: Select to get the updated data back
        .single(); // Assuming only one patient per user_id

      if (error) throw error;

      // Update local state immediately after successful DB update
      setLoyaltyCode(result);
      // Also update patientData state if it's being used to display the code elsewhere
      setPatientData((prevData: any) => ({ ...prevData, surecode: result }));


    } catch (error) {
      console.error('Error updating loyalty code:', error);
      alert('Error al generar el código de fidelización. Inténtelo de nuevo.');
    } finally {
      setIsGeneratingCode(false);
    }
  };

  // Modified to accept patientId
 const fetchAppointments = async (patientId: string) => {
    if (!patientId) return; // Ensure we have an ID
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          doctors ( name )
        `) // Fetch doctor's name directly
        .eq('patient_id', patientId)
        .order('appointment_date', { ascending: true });

      if (error) throw error;

      // Process data to flatten doctor name if needed, or adjust component rendering
       const processedAppointments = data?.map(appt => ({
         ...appt,
         doctor_name: appt.doctors?.name || 'Dr. Asignado' // Handle null doctor relation
       })) || [];


      setAppointments(processedAppointments);
    } catch (error) {
      console.error('Error fetching appointments:', error);
       // Consider showing a toast notification for fetch errors
    }
  };


  const [weatherData, setWeatherData] = useState({
    temp: 0,
    condition: '',
    location: '',
    day: ''
  });

  // Weather useEffect (keep as is)
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          // Using a different free weather API as open-meteo sometimes requires attribution or has limits
          // Using WeatherAPI.com (requires a free API key)
          // Replace 'YOUR_API_KEY' with your actual key from weatherapi.com
          // const apiKey = 'YOUR_WEATHERAPI_KEY'; // Store securely, e.g., in .env
          // const weatherResponse = await fetch(`https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${latitude},${longitude}&aqi=no&lang=es`);

          // Alternative without API Key (Open-Meteo):
           const response = await fetch(
             `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}¤t=temperature_2m,weather_code&timezone=auto`
           );


          if (!response.ok) {
            throw new Error(`Weather API responded with status: ${response.status}`);
          }
          const data = await response.json();

          // Weather code mapping for conditions (Open-Meteo specific)
          const getWeatherCondition = (code: number): string => {
             const conditions: { [key: number]: string } = {
                 0: 'Despejado', 1: 'Mayormente despejado', 2: 'Parcialmente nublado', 3: 'Nublado',
                 45: 'Niebla', 48: 'Niebla engelante',
                 51: 'Llovizna ligera', 53: 'Llovizna moderada', 55: 'Llovizna densa',
                 56: 'Llovizna helada ligera', 57: 'Llovizna helada densa',
                 61: 'Lluvia ligera', 63: 'Lluvia moderada', 65: 'Lluvia fuerte',
                 66: 'Lluvia helada ligera', 67: 'Lluvia helada fuerte',
                 71: 'Nieve ligera', 73: 'Nieve moderada', 75: 'Nieve fuerte',
                 77: 'Granos de nieve',
                 80: 'Chubascos ligeros', 81: 'Chubascos moderados', 82: 'Chubascos violentos',
                 85: 'Chubascos de nieve ligeros', 86: 'Chubascos de nieve fuertes',
                 95: 'Tormenta ligera o moderada',
                 96: 'Tormenta con granizo ligero', 99: 'Tormenta con granizo fuerte'
             };
             return conditions[code] ?? 'No disponible';
           };


           if (data && data.current) {
             setWeatherData({
               temp: Math.round(data.current.temperature_2m),
               condition: getWeatherCondition(data.current.weather_code),
               location: 'Tu ubicación', // Open-Meteo doesn't provide city name easily
               day: new Date().toLocaleDateString('es-ES', { weekday: 'long' })
             });
           } else {
              throw new Error("Invalid weather data structure");
           }

        } catch (error) {
          console.error('Error fetching weather data:', error);
          setWeatherData(prev => ({
            ...prev,
            temp: 0, // Or use '--'
            condition: 'No disponible',
            location: 'Error',
            day: new Date().toLocaleDateString('es-ES', { weekday: 'long' })
          }));
        }
      }, (error) => { // Handle geolocation error
          console.error("Error getting geolocation: ", error);
          setWeatherData(prev => ({
            ...prev,
            temp: 0,
            condition: 'Ubicación denegada',
            location: 'Desconocida',
            day: new Date().toLocaleDateString('es-ES', { weekday: 'long' })
          }));
      });
    } else {
        // Geolocation not supported
        console.log("Geolocation is not supported by this browser.");
        setWeatherData(prev => ({
            ...prev,
            temp: 0,
            condition: 'Geolocalización no soportada',
            location: 'Desconocida',
            day: new Date().toLocaleDateString('es-ES', { weekday: 'long' })
        }));
    }
  }, []); // Empty dependency array ensures this runs once on mount

  const handleViewChange = (view: string) => {
    setCurrentView(view);
    setMobileMenuOpen(false); // Close mobile menu on view change
  };

  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return 'No programada';
    try {
        const date = new Date(dateString);
        // Check if date is valid after parsing
        if (isNaN(date.getTime())) {
            return 'Fecha inválida';
        }
        // Adjust for potential timezone issues if the date string doesn't include timezone info
        // Assuming the date string is in UTC or local, depending on how it's stored
        const localDate = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
        return localDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) {
        console.error("Error formatting date:", dateString, e);
        return 'Error de fecha';
    }
};

const formatTime = (timeString: string | null | undefined): string => {
    if (!timeString) return '--:--';
    // Assuming timeString is in "HH:MM:SS" or "HH:MM" format
    const parts = timeString.split(':');
    if (parts.length >= 2) {
        // Basic validation for hours and minutes
        const hour = parseInt(parts[0], 10);
        const minute = parseInt(parts[1], 10);
        if (!isNaN(hour) && !isNaN(minute) && hour >= 0 && hour < 24 && minute >= 0 && minute < 60) {
             return `${parts[0]}:${parts[1]}`;
        }
    }
    // Return original or fallback if format is unexpected
    return timeString;
};


  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };
  // --- End of Existing useEffect and functions ---


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (showPatientForm) {
    // --- Patient Form Component (keep as is) ---
    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full border border-gray-100">
            <div className="flex flex-col items-center justify-center mb-6 text-center">
              <User className="h-12 w-12 text-primary mb-3" />
              <h2 className="text-2xl font-bold text-gray-800">Completa tu perfil</h2>
              <p className="text-sm text-gray-600 mt-1">Necesitamos algunos datos básicos para continuar.</p>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Nombre completo*</label>
                <input
                  id="name"
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleFormChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-focus focus:border-primary-focus"
                  placeholder="Ej: Juan Pérez García"
                />
              </div>

              <div>
                <label htmlFor="date_of_birth" className="block text-sm font-medium text-gray-700 mb-1">Fecha de nacimiento</label>
                <input
                  id="date_of_birth"
                  type="date"
                  name="date_of_birth"
                  value={formData.date_of_birth}
                  onChange={handleFormChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-focus focus:border-primary-focus"
                  max={new Date().toISOString().split("T")[0]} // Prevent future dates
               />
              </div>

              <div>
                <label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-1">Género</label>
                <select
                  id="gender"
                  name="gender"
                  value={formData.gender}
                  onChange={handleFormChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-focus focus:border-primary-focus bg-white"
                >
                  <option value="">Seleccionar...</option>
                  <option value="Masculino">Masculino</option>
                  <option value="Femenino">Femenino</option>
                  <option value="Otro">Otro</option>
                  <option value="Prefiero no decir">Prefiero no decir</option>
                </select>
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                <input
                  id="phone"
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleFormChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-focus focus:border-primary-focus"
                  placeholder="Ej: 55 1234 5678"
                />
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full bg-primary text-white py-2.5 px-4 rounded-md hover:bg-primary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 font-medium"
                >
                  Guardar información
                </button>
              </div>
            </form>
          </div>
        </div>
      );
  }

  // --- Main Interface ---
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <ToastProvider />
      {/* --- Header --- */}
      <div className="bg-white shadow-sm sticky top-0 z-30 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center">
          <div className="flex items-center">
            <img
              src="/logo.png" // Make sure this path is correct relative to public folder
              alt="Logo"
              className="h-10 w-auto" // Adjust size as needed
            />
            <h1 className="ml-3 text-xl font-semibold text-gray-800 hidden sm:block">
              {/* Use consistent field name */}
              {patientData?.name || 'Paciente'}
            </h1>
          </div>

          {/* Mobile menu button */}
          <button
            className="p-2 rounded-md text-gray-500 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary sm:hidden"
            onClick={toggleMobileMenu}
            aria-label="Abrir menú"
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>
      </div>

      <main className="flex-1 pt-4 sm:pt-6 pb-20 sm:pb-6"> {/* Added padding bottom for mobile nav */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* --- Left Sidebar (Desktop) --- */}
            <div className="lg:col-span-3 xl:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 hidden lg:block">
              {/* Sticky wrapper for navigation */}
              <div className="sticky top-20 p-4 space-y-2"> {/* Adjust top value based on header height */}
                  <button
                    className={`w-full flex items-center space-x-3 p-3 text-sm ${currentView === 'home' ? 'bg-primary/10 text-primary font-medium' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'} rounded-lg transition-colors duration-150`}
                    onClick={() => handleViewChange('home')}
                  >
                    <Home className="h-5 w-5 flex-shrink-0" />
                    <span>Inicio</span>
                  </button>

                  <button
                    className={`w-full flex items-center space-x-3 p-3 text-sm ${currentView === 'appointments' ? 'bg-primary/10 text-primary font-medium' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'} rounded-lg transition-colors duration-150`}
                    onClick={() => handleViewChange('appointments')}
                  >
                    <CalendarIcon className="h-5 w-5 flex-shrink-0" />
                    <span>Calendario</span>
                  </button>

                  <button
                    className={`w-full flex items-center space-x-3 p-3 text-sm ${currentView === 'medications' ? 'bg-primary/10 text-primary font-medium' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'} rounded-lg transition-colors duration-150`}
                    onClick={() => handleViewChange('medications')}
                  >
                    <FileText className="h-5 w-5 flex-shrink-0" />
                    <span>Recetas</span>
                  </button>

                  {/* EREBUS Button - Desktop */}
                  <button
                      className={`w-full flex items-center space-x-3 p-3 text-sm ${currentView === 'EREBUS' ? 'bg-primary/10 text-primary font-medium' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'} rounded-lg transition-colors duration-150`}
                      onClick={() => handleViewChange('EREBUS')}
                    >
                      {/* Consider a different Icon if available */}
                      <FileText className="h-5 w-5 flex-shrink-0" />
                      <span>EREBUS</span>
                  </button>


                  <button
                    className={`w-full flex items-center space-x-3 p-3 text-sm ${currentView === 'pharmacies' ? 'bg-primary/10 text-primary font-medium' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'} rounded-lg transition-colors duration-150`}
                    onClick={() => handleViewChange('pharmacies')}
                  >
                    <Package2 className="h-5 w-5 flex-shrink-0" />
                    <span>Farmacias</span>
                  </button>

                  <button
                    className={`w-full flex items-center space-x-3 p-3 text-sm ${currentView === 'profile' ? 'bg-primary/10 text-primary font-medium' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'} rounded-lg transition-colors duration-150`}
                    onClick={() => handleViewChange('profile')}
                  >
                    <QrCode className="h-5 w-5 flex-shrink-0" /> {/* Using QrCode for Profile link */}
                    <span>Perfil</span>
                  </button>
              </div>
            </div>

            {/* --- Mobile Menu Overlay --- */}
            {mobileMenuOpen && (
              <>
                {/* Backdrop */}
                <div
                    className="fixed inset-0 z-30 bg-black/30 backdrop-blur-sm sm:hidden"
                    onClick={toggleMobileMenu}
                    aria-hidden="true"
                 ></div>
                {/* Panel */}
                 <div className="fixed inset-y-0 left-0 max-w-xs w-full bg-white shadow-xl z-40 sm:hidden flex flex-col" >
                   <div className="p-4 border-b border-gray-200">
                     <div className="flex items-center justify-between">
                       {/* Logo/Title in mobile menu */}
                       <div className="flex items-center">
                           <img src="/logo.png" alt="Logo" className="h-8 w-auto"/>
                           <span className="ml-2 text-lg font-semibold text-gray-800">Menú</span>
                       </div>
                       <button
                         className="p-2 rounded-md text-gray-500 hover:bg-gray-100"
                         onClick={toggleMobileMenu}
                         aria-label="Cerrar menú"
                       >
                         <X className="h-6 w-6" />
                       </button>
                     </div>
                   </div>
                   <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
                     {/* Replicated buttons from desktop sidebar */}
                     <button
                        className={`w-full flex items-center space-x-3 p-3 text-sm ${currentView === 'home' ? 'bg-primary/10 text-primary font-medium' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'} rounded-lg transition-colors duration-150`}
                        onClick={() => handleViewChange('home')}
                      >
                        <Home className="h-5 w-5 flex-shrink-0" />
                        <span>Inicio</span>
                      </button>

                      <button
                        className={`w-full flex items-center space-x-3 p-3 text-sm ${currentView === 'appointments' ? 'bg-primary/10 text-primary font-medium' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'} rounded-lg transition-colors duration-150`}
                        onClick={() => handleViewChange('appointments')}
                      >
                        <CalendarIcon className="h-5 w-5 flex-shrink-0" />
                        <span>Calendario</span>
                      </button>

                      <button
                        className={`w-full flex items-center space-x-3 p-3 text-sm ${currentView === 'medications' ? 'bg-primary/10 text-primary font-medium' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'} rounded-lg transition-colors duration-150`}
                        onClick={() => handleViewChange('medications')}
                      >
                        <FileText className="h-5 w-5 flex-shrink-0" />
                        <span>Recetas</span>
                      </button>

                      {/* EREBUS Button - Mobile Overlay */}
                       <button
                         className={`w-full flex items-center space-x-3 p-3 text-sm ${currentView === 'EREBUS' ? 'bg-primary/10 text-primary font-medium' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'} rounded-lg transition-colors duration-150`}
                         onClick={() => handleViewChange('EREBUS')}
                       >
                         <FileText className="h-5 w-5 flex-shrink-0" /> {/* Adjust icon if needed */}
                         <span>EREBUS</span>
                       </button>

                      <button
                        className={`w-full flex items-center space-x-3 p-3 text-sm ${currentView === 'pharmacies' ? 'bg-primary/10 text-primary font-medium' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'} rounded-lg transition-colors duration-150`}
                        onClick={() => handleViewChange('pharmacies')}
                      >
                        <Package2 className="h-5 w-5 flex-shrink-0" />
                        <span>Farmacias</span>
                      </button>

                      <button
                        className={`w-full flex items-center space-x-3 p-3 text-sm ${currentView === 'profile' ? 'bg-primary/10 text-primary font-medium' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'} rounded-lg transition-colors duration-150`}
                        onClick={() => handleViewChange('profile')}
                      >
                        <QrCode className="h-5 w-5 flex-shrink-0" />
                        <span>Perfil</span>
                      </button>
                   </nav>
                 </div>
               </>
            )}

            {/* --- Mobile Bottom Navigation Bar --- */}
            {/* ***** FIX HERE ***** */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-20 lg:hidden">
              {/* Change grid-cols-5 to grid-cols-6 */}
              <div className="grid grid-cols-6 h-16">
                <button
                  className={`flex flex-col items-center justify-center pt-2 ${currentView === 'home' ? 'text-primary' : 'text-gray-500 hover:text-primary'}`}
                  onClick={() => handleViewChange('home')}
                  aria-label="Inicio"
                >
                  <Home className="h-5 w-5" />
                  <span className="text-xs mt-1 font-medium">Inicio</span>
                </button>
                <button
                  className={`flex flex-col items-center justify-center pt-2 ${currentView === 'appointments' ? 'text-primary' : 'text-gray-500 hover:text-primary'}`}
                  onClick={() => handleViewChange('appointments')}
                  aria-label="Citas"
                >
                  <CalendarIcon className="h-5 w-5" />
                  <span className="text-xs mt-1 font-medium">Citas</span>
                </button>
                <button
                  className={`flex flex-col items-center justify-center pt-2 ${currentView === 'medications' ? 'text-primary' : 'text-gray-500 hover:text-primary'}`}
                  onClick={() => handleViewChange('medications')}
                  aria-label="Recetas"
                >
                  <FileText className="h-5 w-5" />
                  <span className="text-xs mt-1 font-medium">Recetas</span>
                </button>

                {/* ***** ADD EREBUS BUTTON HERE ***** */}
                <button
                  className={`flex flex-col items-center justify-center pt-2 ${currentView === 'EREBUS' ? 'text-primary' : 'text-gray-500 hover:text-primary'}`}
                  onClick={() => handleViewChange('EREBUS')}
                  aria-label="EREBUS"
                >
                  <FileText className="h-5 w-5" /> {/* Adjust icon if needed */}
                  <span className="text-xs mt-1 font-medium">EREBUS</span>
                </button>

                <button
                  className={`flex flex-col items-center justify-center pt-2 ${currentView === 'pharmacies' ? 'text-primary' : 'text-gray-500 hover:text-primary'}`}
                  onClick={() => handleViewChange('pharmacies')}
                  aria-label="Farmacias"
                >
                  <Package2 className="h-5 w-5" />
                  <span className="text-xs mt-1 font-medium">Farmacias</span>
                </button>
                <button
                  className={`flex flex-col items-center justify-center pt-2 ${currentView === 'profile' ? 'text-primary' : 'text-gray-500 hover:text-primary'}`}
                  onClick={() => handleViewChange('profile')}
                  aria-label="Perfil"
                >
                  <QrCode className="h-5 w-5" />
                  <span className="text-xs mt-1 font-medium">Perfil</span>
                </button>
              </div>
            </div>
            {/* ***** END FIX AREA ***** */}


            {/* --- Main Content Area --- */}
            {/* Adjusted grid span for content */}
            <div className="lg:col-span-9 xl:col-span-10 space-y-6">
               {/* --- Top Cards Row (Home View Only) --- */}
              {currentView === 'home' && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {/* Welcome Card */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                         <p className="text-sm text-gray-500 font-medium">Buenos días</p>
                         <h2 className="text-xl font-bold text-gray-800 truncate">
                          {/* Use consistent field name */}
                           {patientData?.name || 'Paciente'}
                         </h2>
                         <p className="text-xs text-gray-500 mt-1 flex items-center">
                           <Clock className="h-3 w-3 mr-1.5 text-gray-400" />
                           {new Date().toLocaleTimeString('es-ES', {hour: '2-digit', minute:'2-digit'})}
                         </p>
                      </div>
                      <div className="flex-shrink-0 h-10 w-10 bg-gradient-to-br from-primary to-primary/80 rounded-full flex items-center justify-center shadow">
                        <Sunrise className="h-5 w-5 text-white" />
                      </div>
                    </div>
                    {/* Optional: Add a small action or info here */}
                    {/* <p className="text-xs text-gray-600">¡Que tengas un buen día!</p> */}
                  </div>

                  {/* Next Appointment Card */}
                  <div
                    className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => handleViewChange('appointments')}
                    role="button"
                    tabIndex={0} // Make it focusable
                    aria-label="Ver próxima cita"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="text-sm text-gray-500 font-medium">Próxima cita</p>
                        <h2 className="text-xl font-bold text-gray-800">
                           {/* Find the next upcoming appointment */}
                          {appointments.length > 0 ? formatDate(appointments[0].appointment_date) : 'No programada'}
                        </h2>
                        <p className="text-xs text-gray-500 mt-1 truncate">
                           {appointments.length > 0 ? `${formatTime(appointments[0].appointment_time)} - ${appointments[0].tipo_consulta || 'General'}` : 'Programa una cita'}
                        </p>
                      </div>
                      <div className="flex-shrink-0 h-10 w-10 bg-gradient-to-br from-accent to-accent/80 rounded-full flex items-center justify-center shadow">
                        <CalendarIcon className="h-5 w-5 text-white" />
                      </div>
                    </div>
                    {/* <p className="text-xs text-primary font-medium">Ver detalles</p> */}
                  </div>

                  {/* Weather Card */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="text-sm text-gray-500 font-medium capitalize">{weatherData.day}</p>
                        <h2 className="text-xl font-bold text-gray-800">
                          {weatherData.temp !== 0 ? `${weatherData.temp}°C` : '--'}
                        </h2>
                        <p className="text-xs text-gray-500 mt-1 truncate">
                          {weatherData.condition} • {weatherData.location}
                        </p>
                      </div>
                      <div className="flex-shrink-0 h-10 w-10 bg-gradient-to-br from-blue-400 to-blue-300 rounded-full flex items-center justify-center shadow">
                        {/* Choose an icon based on condition? */}
                        <CloudRain className="h-5 w-5 text-white" />
                      </div>
                    </div>
                     {/* <p className="text-xs text-gray-600">Clima actual</p> */}
                 </div>
                </div>
              )}

              {/* --- Appointments Table (Home View Only) --- */}
              {currentView === 'home' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="border-b border-gray-200 px-5 py-4 sm:px-6 sm:py-4 flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-gray-800">Próximas Citas</h3>
                    <button
                      className="text-sm font-medium text-primary hover:text-primary/80 focus:outline-none"
                      onClick={() => handleViewChange('appointments')}
                    >
                      Ver todas
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50/50">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Fecha
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Hora
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                            Tipo
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Doctor
                          </th>
                           <th scope="col" className="relative px-6 py-3">
                             <span className="sr-only">Acciones</span>
                           </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {appointments.length > 0 ? (
                          appointments.slice(0, 3).map((appointment) => ( // Use appointment.id if available
                            <tr key={appointment.id || appointment.appointment_date} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800">
                                {formatDate(appointment.appointment_date)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                {formatTime(appointment.appointment_time)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 hidden sm:table-cell">
                                {appointment.tipo_consulta || 'General'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                {appointment.doctor_name || 'No asignado'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                               {/* Add actions like 'Details' if needed */}
                               {/* <button onClick={() => handleViewChange('appointments')} className="text-primary hover:text-primary/80">Detalles</button> */}
                               </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5} className="px-6 py-10 text-sm text-gray-500 text-center">
                              No tienes citas programadas próximamente.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* --- Content Panel (Handles other views) --- */}
               {/* Render ContentPanel OR Profile specific cards based on view */}
               {currentView !== 'home' && currentView !== 'profile' && (
                 <ContentPanel
                    view={currentView}
                    // Pass necessary data or fetch functions if ContentPanel needs them
                    patientId={user?.id}
                    patientData={patientData}
                    appointments={appointments}
                    fetchAppointments={() => fetchAppointments(user?.id)} // Allow refetching
                 />
               )}


              {/* --- Profile View Specific Cards --- */}
              {currentView === 'profile' && (
                <>
                 {/* Loyalty Code Card */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                    <div className="flex flex-col space-y-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm text-gray-500 font-medium">Código de Identificación (SureCode)</p>
                          <h2 className="text-xl font-bold text-gray-800 font-mono tracking-wider">
                             {/* Display code from patientData first, fallback to state */}
                             {patientData?.surecode || loyaltyCode || 'No generado'}
                          </h2>
                        </div>
                        <QrCode className="h-6 w-6 text-primary flex-shrink-0" />
                      </div>

                      <div className="flex flex-col items-center justify-center space-y-4 pt-2">
                         {/* Conditional rendering for barcode */}
                         {(patientData?.surecode || loyaltyCode) && showBarcode && (
                           <div className="p-4 bg-white rounded-lg border border-gray-200 overflow-hidden max-w-xs w-full">
                             <Barcode
                               value={patientData?.surecode || loyaltyCode}
                               width={1.5} // Adjust for better readability
                               height={50}
                               margin={10} // Add some margin
                               displayValue={true}
                               fontSize={14}
                             />
                           </div>
                         )}
                         {/* Message if no code exists */}
                          {!patientData?.surecode && !loyaltyCode && (
                            <p className="text-sm text-gray-600 italic text-center px-4">
                              Genera tu código único para identificarte fácilmente en tus visitas.
                            </p>
                          )}
                      </div>

                      <div className="flex flex-wrap gap-3 justify-center pt-2">
                        {/* Generate button only if no code exists */}
                         {!patientData?.surecode && !loyaltyCode && (
                           <button
                             onClick={generateLoyaltyCode}
                             disabled={isGeneratingCode}
                             className="flex items-center justify-center space-x-2 px-5 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 text-sm font-medium disabled:opacity-70"
                           >
                             {isGeneratingCode ? (
                               <>
                                 <span className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></span>
                                 <span>Generando...</span>
                               </>
                             ) : (
                               <span>Generar Código</span>
                             )}
                           </button>
                         )}

                         {/* Show/Hide Barcode button only if code exists */}
                          {(patientData?.surecode || loyaltyCode) && (
                            <button
                              onClick={() => setShowBarcode((prev) => !prev)}
                              className="px-5 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 text-sm font-medium"
                            >
                              {showBarcode ? 'Ocultar Código de Barras' : 'Mostrar Código de Barras'}
                            </button>
                          )}
                      </div>
                    </div>
                  </div>

                 {/* Patient Profile Info Card */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-200 sm:px-6">
                      <h3 className="text-lg font-semibold text-gray-800">
                        Información Personal
                      </h3>
                    </div>
                    <div className="px-5 py-5 sm:px-6">
                       <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-6">
                          <div className="sm:col-span-1">
                             <dt className="text-sm font-medium text-gray-500">Nombre completo</dt>
                             <dd className="mt-1 text-sm text-gray-900">
                               {patientData?.name || 'No disponible'}
                             </dd>
                           </div>
                           <div className="sm:col-span-1">
                             <dt className="text-sm font-medium text-gray-500">Fecha de nacimiento</dt>
                             <dd className="mt-1 text-sm text-gray-900">
                               {formatDate(patientData?.date_of_birth) || 'No disponible'}
                             </dd>
                           </div>
                           <div className="sm:col-span-1">
                             <dt className="text-sm font-medium text-gray-500">Correo electrónico</dt>
                             <dd className="mt-1 text-sm text-gray-900 truncate">
                               {patientData?.email || user?.email || 'No disponible'}
                             </dd>
                           </div>
                           <div className="sm:col-span-1">
                             <dt className="text-sm font-medium text-gray-500">Teléfono</dt>
                             <dd className="mt-1 text-sm text-gray-900">
                               {patientData?.phone || 'No disponible'}
                             </dd>
                           </div>
                           <div className="sm:col-span-1">
                             <dt className="text-sm font-medium text-gray-500">Género</dt>
                             <dd className="mt-1 text-sm text-gray-900">
                               {patientData?.gender || 'No disponible'}
                             </dd>
                           </div>
                           {/* Add more fields if needed */}
                        </dl>
                     </div>
                      {/* Optional: Add an Edit button */}
                     {/* <div className="px-5 py-3 bg-gray-50 border-t border-gray-200 text-right sm:px-6">
                        <button className="text-sm font-medium text-primary hover:text-primary/80">
                          Editar Perfil
                        </button>
                     </div> */}
                  </div>
                </>
              )}


            </div> {/* End Main Content Area Column */}
          </div> {/* End Main Grid */}
        </div> {/* End Max Width Container */}
      </main>
    </div>
  );
};

export default Paciente_Interfaz;
