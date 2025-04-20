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
  User
} from 'lucide-react';
import Barcode from 'react-barcode';
import Header from '../components/paciente/Header';
import ContentPanel from '../components/paciente/ContentPanel';
import supabase from '../lib/supabaseClient';
import ToastProvider from '../components/providers/ToastProvider';

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

  // Verificar autenticación y datos del paciente
  useEffect(() => {
    const checkAuthAndPatientData = async () => {
      try {
        setLoading(true);
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !authUser) {
          // Redirigir a login si no está autenticado
          window.location.href = '/login';
          return;
        }
        
        setUser(authUser);
        
        // Verificar si existe en la tabla patients
        const { data: patient, error: patientError } = await supabase
          .from('patients')
          .select('*')
          .eq('user_id', authUser.id)
          .single();
          
        if (patientError || !patient) {
          setShowPatientForm(true);
          setLoading(false);
          return;
        }
        
        setPatientData(patient);
        setLoading(false);
        fetchAppointments();
      } catch (error) {
        console.error('Error checking auth and patient data:', error);
        setLoading(false);
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
    try {
      if (!user) return;
      
      const { error } = await supabase
        .from('patients')
        .insert({
          user_id: user.id,
          email: user.email,
          name: formData.name,
          date_of_birth: formData.date_of_birth,
          gender: formData.gender,
          phone: formData.phone,
          created_at: new Date().toISOString()
        });
        
      if (error) throw error;
      
      // Refrescar datos del paciente
      const { data: patient } = await supabase
        .from('patients')
        .select('*')
        .eq('user_id', user.id)
        .single();
        
      setPatientData(patient);
      setShowPatientForm(false);
      fetchAppointments();
    } catch (error) {
      console.error('Error saving patient data:', error);
      alert('Error al guardar los datos del paciente');
    }
  };

  const generateLoyaltyCode = async () => {
    setIsGeneratingCode(true);
    try {
      const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      const codeLength = 12;
      let result = '';
      for (let i = 0; i < codeLength; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
      }
      setLoyaltyCode(result);
    
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
    
      const { error } = await supabase
        .from('patients')
        .update({ surecode: result })
        .eq('user_id', user.id);
    
      if (error) throw error;
    } catch (error) {
      console.error('Error updating loyalty code:', error);
      alert('Error al generar el código de fidelización');
    } finally {
      setIsGeneratingCode(false);
    }
  };

  const fetchAppointments = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('patient_id', user.id)
        .order('appointment_date', { ascending: true });

      if (error) throw error;

      setAppointments(data || []);
    } catch (error) {
      console.error('Error fetching appointments:', error);
    }
  };

  const [weatherData, setWeatherData] = useState({
    temp: 0,
    condition: '',
    location: '',
    day: ''
  });

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const response = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&timezone=auto`
          );
          if (!response.ok) {
            throw new Error(`Weather API responded with status: ${response.status}`);
          }
          const data = await response.json();
          
          // Weather code mapping for conditions
          const getWeatherCondition = (code: number) => {
            const conditions: Record<number, string> = {
              0: 'Despejado',
              1: 'Mayormente despejado',
              2: 'Parcialmente nublado',
              3: 'Nublado',
              45: 'Neblina',
              48: 'Niebla',
              51: 'Llovizna ligera',
              53: 'Llovizna moderada',
              55: 'Llovizna intensa',
              61: 'Lluvia ligera',
              63: 'Lluvia moderada',
              65: 'Lluvia intensa',
              80: 'Lluvia ocasional',
              95: 'Tormenta'
            };
            return conditions[code] || 'No disponible';
          };

          if (data && data.current) {
            setWeatherData({
              temp: Math.round(data.current.temperature_2m),
              condition: getWeatherCondition(data.current.weather_code),
              location: 'Tu ubicación',
              day: new Date().toLocaleDateString('es-ES', { weekday: 'long' })
            });
          }
        } catch (error) {
          console.error('Error fetching weather data:', error);
          setWeatherData(prev => ({
            ...prev,
            temp: 0,
            condition: 'No disponible',
            location: 'Error',
            day: new Date().toLocaleDateString('es-ES', { weekday: 'long' })
          }));
        }
      });
    }
  }, []);

  const handleViewChange = (view: string) => {
    setCurrentView(view);
    setMobileMenuOpen(false);
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    if (!dateString) return 'No programada';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // Format time for display
  const formatTime = (timeString: string) => {
    if (!timeString) return '--:--';
    return timeString;
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (showPatientForm) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-md p-8 max-w-md w-full">
          <div className="flex items-center justify-center mb-6">
            <User className="h-10 w-10 text-primary mr-2" />
            <h2 className="text-2xl font-bold text-gray-800">Completa tu perfil</h2>
          </div>
          
          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo*</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleFormChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de nacimiento</label>
              <input
                type="date"
                name="date_of_birth"
                value={formData.date_of_birth}
                onChange={handleFormChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Género</label>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleFormChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Seleccionar...</option>
                <option value="Masculino">Masculino</option>
                <option value="Femenino">Femenino</option>
                <option value="Otro">Otro</option>
                <option value="Prefiero no decir">Prefiero no decir</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleFormChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            
            <div className="pt-4">
              <button
                type="submit"
                className="w-full bg-primary text-white py-2 px-4 rounded-md hover:bg-primary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              >
                Guardar información
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <ToastProvider />
      <div className="bg-white shadow-sm sticky top-0 z-30">
        {/* Simplified Header without notification and settings buttons */}
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center">
            <img 
              src="/logo.svg" 
              alt="Logo" 
              className="h-10 w-auto"
            />
            <h1 className="ml-3 text-xl font-semibold text-gray-900 hidden sm:block">
              {patientData?.nombre_completo || patientData?.name || 'Paciente'}
            </h1>
          </div>
          
          {/* Mobile menu button */}
          <button 
            className="p-2 rounded-md text-gray-500 hover:text-gray-600 sm:hidden"
            onClick={toggleMobileMenu}
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>
      </div>
      
      <main className="flex-1 pt-4 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Sidebar - Navigation (Desktop) */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow-md border-r border-gray-100 hidden sm:block">
              <div className="sticky top-24 p-4 space-y-2">
                <button 
                  className={`w-full flex items-center space-x-3 p-3 ${currentView === 'home' ? 'bg-primary/10 text-primary' : 'text-gray-700 hover:bg-gray-100'} rounded-xl`}
                  onClick={() => handleViewChange('home')}
                >
                  <Home className="h-5 w-5" />
                  <span className={currentView === 'home' ? "font-medium" : ""}>Inicio</span>
                </button>
                
                <button 
                  className={`w-full flex items-center space-x-3 p-3 ${currentView === 'appointments' ? 'bg-primary/10 text-primary' : 'text-gray-700 hover:bg-gray-100'} rounded-xl`}
                  onClick={() => handleViewChange('appointments')}
                >
                  <CalendarIcon className="h-5 w-5" />
                  <span className={currentView === 'appointments' ? "font-medium" : ""}>Calendario</span>
                </button>
                
                <button 
                  className={`w-full flex items-center space-x-3 p-3 ${currentView === 'medications' ? 'bg-primary/10 text-primary' : 'text-gray-700 hover:bg-gray-100'} rounded-xl`}
                  onClick={() => handleViewChange('medications')}
                >
                  <FileText className="h-5 w-5" />
                  <span className={currentView === 'medications' ? "font-medium" : ""}>Recetas</span>
                </button>
                
                <button 
                  className={`w-full flex items-center space-x-3 p-3 ${currentView === 'pharmacies' ? 'bg-primary/10 text-primary' : 'text-gray-700 hover:bg-gray-100'} rounded-xl`}
                  onClick={() => handleViewChange('pharmacies')}
                >
                  <Package2 className="h-5 w-5" />
                  <span className={currentView === 'pharmacies' ? "font-medium" : ""}>Farmacias</span>
                </button>

                <button 
                  className={`w-full flex items-center space-x-3 p-3 ${currentView === 'profile' ? 'bg-primary/10 text-primary' : 'text-gray-700 hover:bg-gray-100'} rounded-xl`}
                  onClick={() => handleViewChange('profile')}
                >
                  <QrCode className="h-5 w-5" />
                  <span className={currentView === 'profile' ? "font-medium" : ""}>Perfil</span>
                </button>
              </div>
            </div>
          
            {/* Mobile Menu Overlay */}
            {mobileMenuOpen && (
              <div className="fixed inset-0 z-20 bg-black bg-opacity-25 sm:hidden" onClick={toggleMobileMenu}>
                <div className="fixed inset-y-0 left-0 max-w-xs w-full bg-white shadow-xl z-30" onClick={e => e.stopPropagation()}>
                  <div className="p-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-medium text-gray-900">
                        {patientData?.nombre_completo || patientData?.name || 'Paciente'}
                      </h2>
                      <button 
                        className="p-2 rounded-md text-gray-500" 
                        onClick={toggleMobileMenu}
                      >
                        <X className="h-6 w-6" />
                      </button>
                    </div>
                  </div>
                  <nav className="px-2 py-4 space-y-1">
                    <button 
                      className={`w-full flex items-center space-x-3 p-3 ${currentView === 'home' ? 'bg-primary/10 text-primary' : 'text-gray-700 hover:bg-gray-100'} rounded-xl`}
                      onClick={() => handleViewChange('home')}
                    >
                      <Home className="h-5 w-5" />
                      <span className={currentView === 'home' ? "font-medium" : ""}>Inicio</span>
                    </button>
                    
                    <button 
                      className={`w-full flex items-center space-x-3 p-3 ${currentView === 'appointments' ? 'bg-primary/10 text-primary' : 'text-gray-700 hover:bg-gray-100'} rounded-xl`}
                      onClick={() => handleViewChange('appointments')}
                    >
                      <CalendarIcon className="h-5 w-5" />
                      <span className={currentView === 'appointments' ? "font-medium" : ""}>Calendario</span>
                    </button>
                    
                    <button 
                      className={`w-full flex items-center space-x-3 p-3 ${currentView === 'medications' ? 'bg-primary/10 text-primary' : 'text-gray-700 hover:bg-gray-100'} rounded-xl`}
                      onClick={() => handleViewChange('medications')}
                    >
                      <FileText className="h-5 w-5" />
                      <span className={currentView === 'medications' ? "font-medium" : ""}>Recetas</span>
                    </button>
                    
                    <button 
                      className={`w-full flex items-center space-x-3 p-3 ${currentView === 'pharmacies' ? 'bg-primary/10 text-primary' : 'text-gray-700 hover:bg-gray-100'} rounded-xl`}
                      onClick={() => handleViewChange('pharmacies')}
                    >
                      <Package2 className="h-5 w-5" />
                      <span className={currentView === 'pharmacies' ? "font-medium" : ""}>Farmacias</span>
                    </button>

                    <button 
                      className={`w-full flex items-center space-x-3 p-3 ${currentView === 'profile' ? 'bg-primary/10 text-primary' : 'text-gray-700 hover:bg-gray-100'} rounded-xl`}
                      onClick={() => handleViewChange('profile')}
                    >
                      <QrCode className="h-5 w-5" />
                      <span className={currentView === 'profile' ? "font-medium" : ""}>Perfil</span>
                    </button>
                  </nav>
                </div>
              </div>
            )}

            {/* Mobile Bottom Navigation Bar */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-10 sm:hidden">
              <div className="grid grid-cols-5 h-16">
                <button 
                  className={`flex flex-col items-center justify-center ${currentView === 'home' ? 'text-primary' : 'text-gray-600'}`}
                  onClick={() => handleViewChange('home')}
                >
                  <Home className="h-5 w-5" />
                  <span className="text-xs mt-1">Inicio</span>
                </button>
                <button 
                  className={`flex flex-col items-center justify-center ${currentView === 'appointments' ? 'text-primary' : 'text-gray-600'}`}
                  onClick={() => handleViewChange('appointments')}
                >
                  <CalendarIcon className="h-5 w-5" />
                  <span className="text-xs mt-1">Citas</span>
                </button>
                <button 
                  className={`flex flex-col items-center justify-center ${currentView === 'medications' ? 'text-primary' : 'text-gray-600'}`}
                  onClick={() => handleViewChange('medications')}
                >
                  <FileText className="h-5 w-5" />
                  <span className="text-xs mt-1">Recetas</span>
                </button>
                <button 
                  className={`flex flex-col items-center justify-center ${currentView === 'pharmacies' ? 'text-primary' : 'text-gray-600'}`}
                  onClick={() => handleViewChange('pharmacies')}
                >
                  <Package2 className="h-5 w-5" />
                  <span className="text-xs mt-1">Farmacias</span>
                </button>
                <button 
                  className={`flex flex-col items-center justify-center ${currentView === 'profile' ? 'text-primary' : 'text-gray-600'}`}
                  onClick={() => handleViewChange('profile')}
                >
                  <QrCode className="h-5 w-5" />
                  <span className="text-xs mt-1">Perfil</span>
                </button>
              </div>
            </div>
          
            {/* Main Content Area */}
            <div className="lg:col-span-10 space-y-6 pb-20 sm:pb-0">
              {/* Top Cards Row - Solo visible en home */}
              {currentView === 'home' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white rounded-xl shadow-md p-5" style={{borderTop: '4px solid var(--color-primary)'}}>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm text-gray-500 font-medium">Buenos días</p>
                        <h2 className="text-xl font-bold text-gray-800 font-inter">
                          {patientData?.nombre_completo || patientData?.name || 'Paciente'}
                        </h2>
                        <p className="text-xs text-gray-500 mt-1 flex items-center">
                          <Clock className="h-3 w-3 mr-1" />
                          {new Date().toLocaleTimeString('es-ES', {hour: '2-digit', minute:'2-digit'})}
                        </p>
                      </div>
                      <div className="h-10 w-10 bg-gradient-to-br from-primary to-primary/80 rounded-full flex items-center justify-center">
                        <Sunrise className="h-5 w-5 text-white" />
                      </div>
                    </div>
                  </div>
                  
                  <div 
                    className="bg-white rounded-xl shadow-md p-5 cursor-pointer"
                    onClick={() => handleViewChange('appointments')}
                    style={{borderTop: '4px solid var(--color-accent)'}}>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm text-gray-500 font-medium">Próxima cita</p>
                        <h2 className="text-xl font-bold text-gray-800 font-inter">
                          {patientData?.proxima_consulta ? formatDate(patientData.proxima_consulta) : 'No programada'}
                        </h2>
                        <p className="text-xs text-gray-500 mt-1">
                          Consulta {patientData?.tipo_consulta || 'general'}
                        </p>
                      </div>
                      <div className="h-10 w-10 bg-gradient-to-br from-accent to-accent/80 rounded-full flex items-center justify-center">
                        <CalendarIcon className="h-5 w-5 text-white" />
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-xl shadow-md p-5" style={{borderTop: '4px solid var(--color-accent)'}}>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm text-gray-500 font-medium">{weatherData.day}</p>
                        <h2 className="text-xl font-bold text-gray-800 font-inter">
                          {weatherData.temp}°
                        </h2>
                        <p className="text-xs text-gray-500 mt-1">
                          {weatherData.condition} • {weatherData.location}
                        </p>
                      </div>
                      <div className="h-10 w-10 bg-gradient-to-br from-blue-400 to-blue-300 rounded-full flex items-center justify-center">
                        <CloudRain className="h-5 w-5 text-white" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Appointments table - visible only in home view */}
              {currentView === 'home' && (
                <div className="bg-white rounded-xl shadow-md overflow-hidden">
                  <div className="border-b border-gray-200 px-6 py-4 flex justify-between items-center">
                    <h3 className="text-lg font-medium text-gray-900">Próximas citas</h3>
                    <button 
                      className="text-primary text-sm font-medium hover:text-primary/80"
                      onClick={() => handleViewChange('appointments')}
                    >
                      Ver todas
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Fecha
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Hora
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Tipo
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Doctor
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {appointments.length > 0 ? (
                          appointments.slice(0, 3).map((appointment, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {formatDate(appointment.appointment_date)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {formatTime(appointment.appointment_time)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {appointment.tipo_consulta || 'General'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {appointment.doctor_name || 'Dr. Asignado'}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} className="px-6 py-4 text-sm text-gray-500 text-center">
                              No hay citas programadas
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Content Panel - Siempre visible */}
              {currentView !== 'home' && (
                <ContentPanel
                  view={currentView}
                  onClose={() => handleViewChange('home')}
                />
              )}
              
              {/* Loyalty Code Card - Only show in profile view */}
              {currentView === 'profile' && (
                <div className="bg-white rounded-xl shadow-md p-5" style={{borderTop: '4px solid var(--color-primary)'}}>
                  <div className="flex flex-col space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm text-gray-500 font-medium">Código de Fidelización</p>
                        <h2 className="text-xl font-bold text-gray-800 font-mono">{patientData?.surecode || loyaltyCode}</h2>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-center justify-center space-y-4">
                      {showBarcode && (patientData?.surecode || loyaltyCode) && (
                        <div className="p-4 bg-white rounded-lg shadow-sm overflow-hidden">
                          <Barcode 
                            value={patientData?.surecode || loyaltyCode} 
                            width={1.5} 
                            height={50}
                            margin={5}
                            displayValue={true}
                          />
                        </div>
                      )}
                      {!patientData?.surecode && !loyaltyCode && (
                        <p className="text-sm text-gray-600 italic">
                          Genere un código para su perfil presionando el botón "Generar código"
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-4 justify-center">
                      {(!patientData?.surecode && !loyaltyCode) && (
                        <button
                          onClick={generateLoyaltyCode}
                          disabled={isGeneratingCode}
                          className="flex items-center space-x-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                        >
                          {isGeneratingCode ? (
                            <>
                              <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                              <span>Generando...</span>
                            </>
                          ) : (
                            <span>Generar código</span>
                          )}
                        </button>
                      )}

                      {(patientData?.surecode || loyaltyCode) && (
                        <button
                          onClick={() => setShowBarcode((prev) => !prev)}
                          className="px-4 py-2 bg-primary/10 text-primary rounded-lg"
                        >
                          {showBarcode ? 'Ocultar código de barras' : 'Ver código de barras'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Patient profile information - Only show in profile view */}
              {currentView === 'profile' && (
                <div className="bg-white rounded-xl shadow-md overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900">
                      Información personal
                    </h3>
                  </div>
                  <div className="px-6 py-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-gray-500">Nombre completo</p>
                        <p className="text-base text-gray-900">
                          {patientData?.nombre_completo || patientData?.name || 'No disponible'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">Fecha de nacimiento</p>
                        <p className="text-base text-gray-900">
                          {patientData?.date_of_birth ? formatDate(patientData.date_of_birth) : 'No disponible'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">Correo electrónico</p>
                        <p className="text-base text-gray-900">
                          {patientData?.email || user?.email || 'No disponible'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">Teléfono</p>
                        <p className="text-base text-gray-900">
                          {patientData?.phone || 'No disponible'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">Género</p>
                        <p className="text-base text-gray-900">
                          {patientData?.gender || 'No disponible'}
                        </p>
                      </div>
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
