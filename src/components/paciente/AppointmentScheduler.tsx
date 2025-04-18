import { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Clock,
  User as UserIcon, // Renombrado para evitar conflicto
  FileText,
  Building,
  ChevronDown,
  ChevronUp,
  List,
} from 'lucide-react';
import supabase from '../../lib/supabaseClient'; // Verifica la ruta
import { toast } from 'react-hot-toast';      // Asegúrate que está instalado y configurado
import { User } from '@supabase/supabase-js'; // Importar tipo User

// --- Interfaces ---
interface AppointmentFormData {
  pharmacyId: number | null;
  date: string;           // YYYY-MM-DD
  time: string;           // HH:mm
  reason: string;
}

interface Pharmacy {
  id_farmacia: number;
  nombre: string;
  horario_atencion: string;
}

interface UpcomingAppointment {
  id: number;
  horario_cita: string;     // ISO String (UTC from DB)
  dia_atencion: string;     // YYYY-MM-DD
  status: string | null;
  farmacias: {            // Joined data
    nombre: string;
  } | null;
}

// --- Component ---
const AppointmentScheduler = () => {
  // --- State Variables ---
  const [selectedPharmacy, setSelectedPharmacy] = useState<Pharmacy | null>(null);
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [formData, setFormData] = useState<AppointmentFormData>({
    pharmacyId: null, date: '', time: '', reason: ''
  });
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 3;
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [loadingPharmacies, setLoadingPharmacies] = useState(true);
  const [upcomingAppointments, setUpcomingAppointments] = useState<UpcomingAppointment[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(true);
  const [isAppointmentsVisible, setIsAppointmentsVisible] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  // --- Helper Functions (Definidas ANTES de usarlas) ---
  const generateDates = () => {
    const dates: { date: string, display: string }[] = [];
    const today = new Date();
    for (let i = 1; i <= 14; i++) {
      const date = new Date(today); date.setDate(today.getDate() + i);
      if (date.getDay() !== 0 && date.getDay() !== 6) {
        dates.push({ date: date.toISOString().split('T')[0], display: date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }).replace('.', '') });
      }
    } return dates;
   };
  const availableDates = useMemo(() => generateDates(), []);

  const parseBusinessHours = (horarioAtencion: string): string[] => {
    const times: string[] = []; const ranges = horarioAtencion.split(/ y |,|;/);
    const parseTimeRange = (range: string) => { const timeMatches = range.match(/\d{1,2}:\d{2}/g); if (timeMatches && timeMatches.length >= 2) { const start = timeMatches[0]; const end = timeMatches[timeMatches.length - 1]; try { let currentTime = new Date(`1970-01-01T${start}:00`); const endTime = new Date(`1970-01-01T${end}:00`); if (endTime <= currentTime) { console.warn(`Invalid range: ${range}`); return; } while (currentTime < endTime) { times.push(currentTime.toTimeString().slice(0, 5)); currentTime.setMinutes(currentTime.getMinutes() + 30); } } catch (e) { console.error("Time parse error:", range, e); } } else { console.warn(`Cannot parse range: ${range}`); } };
    ranges.forEach(range => parseTimeRange(range.trim())); return times;
   };

  // --- Effects ---
  useEffect(() => { // Obtener Usuario Autenticado
    let isMounted = true;
    const fetchUser = async () => {
      if (!isMounted) return; setLoadingUser(true);
      try {
        await supabase.auth.getSession(); // Espera a que la sesión se cargue si es necesario
        const { data: { user }, error } = await supabase.auth.getUser();
        console.log("AUTH: getUser response", { user, error }); // Log
        if (error) throw error;
        if (isMounted) setCurrentUser(user);
      } catch (error) {
        console.error("AUTH Error:", error); if (isMounted) setCurrentUser(null);
      } finally {
        if (isMounted) setLoadingUser(false);
      }
    };
    fetchUser();
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        const user = session?.user ?? null;
        setCurrentUser(user);
        // Busca citas usando el ID de AUTH.USERS (luego se necesitará ajustar si se quiere buscar por patients.id)
        // fetchUpcomingAppointments(user?.id); // Descomentar si se ajusta fetchUpcomingAppointments
        // Por ahora, se llamará desde el useEffect que depende de currentUser y loadingUser
         if (!user) { // Limpiar si cierra sesión
            setUpcomingAppointments([]);
            setLoadingAppointments(false);
        }
      }
    });
    return () => { isMounted = false; authListener?.subscription.unsubscribe(); };
  }, []);

  useEffect(() => { // Cargar Farmacias
    let isMounted = true; const fetchPharmacies = async () => { if (!isMounted) return; setLoadingPharmacies(true); try { const { data, error } = await supabase.from('farmacias').select('id_farmacia, nombre, horario_atencion'); if (error) throw error; if (isMounted) setPharmacies(data || []); } catch (error) { console.error('Pharmacies Error:', error); if (isMounted) toast.error('Error al cargar farmacias'); } finally { if (isMounted) setLoadingPharmacies(false); } }; fetchPharmacies(); return () => { isMounted = false; };
  }, []);

  useEffect(() => { // Obtener Horarios Ocupados
    let isMounted = true; const fetchOccupiedTimes = async () => { if (!formData.date || !formData.pharmacyId || !selectedPharmacy || !isMounted) { if (isMounted) setAvailableTimes(selectedPharmacy ? parseBusinessHours(selectedPharmacy.horario_atencion) : []); return; } try { const { data: citasOcupadas, error } = await supabase .from("citas").select("horario_cita").eq("id_farmacias", formData.pharmacyId).eq("dia_atencion", formData.date); if (error) throw error; if (!isMounted) return; const bookedTimes = citasOcupadas.map((cita) => { const d = new Date(cita.horario_cita); return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`; }); const allTimes = parseBusinessHours(selectedPharmacy.horario_atencion); const available = allTimes.filter(time => !bookedTimes.includes(time)); if (isMounted) setAvailableTimes(available); } catch (error) { console.error("Booked Times Error:", error); if (isMounted) { toast.error("Error al verificar horas."); setAvailableTimes(selectedPharmacy ? parseBusinessHours(selectedPharmacy.horario_atencion) : []); } } }; fetchOccupiedTimes(); return () => { isMounted = false; };
  }, [formData.date, formData.pharmacyId, selectedPharmacy]);

  // Función para cargar Citas Próximas (actualmente busca por patients.id si se le pasa)
  const fetchUpcomingAppointments = async (patientIdToSearch: string | undefined) => {
    console.log("FETCH_APPTS: Fetching appointments for patient ID:", patientIdToSearch);
    if (!patientIdToSearch) {
      setUpcomingAppointments([]); setLoadingAppointments(false); return;
    }
    setLoadingAppointments(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error, status } = await supabase
        .from('citas')
        .select(`id, horario_cita, dia_atencion, status, farmacias ( nombre )`)
        .eq('id_usuario', patientIdToSearch) // Busca por el ID que se le pasa (debería ser patients.id)
        .gte('dia_atencion', today)
        .order('dia_atencion').order('horario_cita');
      console.log("FETCH_APPTS: Response for patient", patientIdToSearch, { data, error, status });
      if (error && status !== 406) throw error;
      setUpcomingAppointments(data?.filter(appt => appt.farmacias) || []);
    } catch (error) {
      console.error('FETCH_APPTS Error:', error); toast.error('Error al cargar citas'); setUpcomingAppointments([]);
    } finally {
      setLoadingAppointments(false);
    }
  };

  // Efecto para cargar citas iniciales después de obtener el usuario Y encontrar su ID de paciente
  useEffect(() => {
    const findPatientAndFetchAppointments = async () => {
        if (!loadingUser && currentUser && currentUser.id) {
            console.log("FETCH_APPTS EFFECT: User loaded, finding patient ID for", currentUser.id);
            setLoadingAppointments(true); // Mostrar carga mientras se busca paciente + citas
            try {
                const { data: patientData, error: patientError } = await supabase
                    .from('patients')
                    .select('id')
                    .eq('user_id', currentUser.id)
                    .single();

                if (patientError && patientError.code !== 'PGRST116') throw patientError;

                if (patientData) {
                    console.log("FETCH_APPTS EFFECT: Found patient ID", patientData.id, "fetching appointments...");
                    fetchUpcomingAppointments(patientData.id); // Llama con el ID de paciente
                } else {
                    console.log("FETCH_APPTS EFFECT: No patient record found for user", currentUser.id);
                    setUpcomingAppointments([]); // No hay paciente, no hay citas
                    setLoadingAppointments(false);
                }
            } catch (error) {
                console.error("FETCH_APPTS EFFECT: Error finding patient", error);
                setUpcomingAppointments([]);
                setLoadingAppointments(false);
            }
        } else if (!loadingUser && !currentUser) {
            // Si terminó de cargar y no hay usuario, limpiar
            setUpcomingAppointments([]);
            setLoadingAppointments(false);
        }
    };

    findPatientAndFetchAppointments();
}, [currentUser, loadingUser]); // Depende del usuario y su estado de carga


  // --- Manejadores de Eventos ---
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => { /* ... (sin cambios) ... */
    const { name, value } = e.target; if (name === 'pharmacyId') { const id = value ? parseInt(value) : null; const sel = pharmacies.find(p => p.id_farmacia === id); setSelectedPharmacy(sel || null); setFormData(prev => ({ ...prev, pharmacyId: id, time: '', date: '' })); setAvailableTimes([]); } else if (name === 'date') { setFormData(prev => ({ ...prev, date: value, time: '' })); } else { setFormData(prev => ({ ...prev, [name]: value })); } };
  const handleNext = () => { /* ... (sin cambios) ... */
    if (currentStep === 1 && !formData.pharmacyId) { toast.error('Selecciona farmacia'); return; } if (currentStep === 2 && !formData.date) { toast.error('Selecciona fecha'); return; } if (currentStep === 2 && !formData.time) { toast.error('Selecciona hora'); return; } if (currentStep < totalSteps) setCurrentStep(prev => prev + 1); };
  const handleBack = () => { /* ... (sin cambios) ... */
    if (currentStep > 1) setCurrentStep(prev => prev - 1); };

  // handleSubmit - CON LÓGICA PARA BUSCAR patients.id
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("SUBMIT: Attempting. Current user:", currentUser);

    // 1. Verificar usuario autenticado
    if (!currentUser || !currentUser.id) { toast.error("Error de sesión."); return; }
    // 2. Validar formulario
    if (!formData.pharmacyId || !formData.date || !formData.time || !formData.reason.trim()) { toast.error("Completa campos."); return; }
    // 3. Validar fecha/hora
    const appointmentDateTimeLocal = new Date(`${formData.date}T${formData.time}:00`);
    if (isNaN(appointmentDateTimeLocal.getTime())) { toast.error("Fecha/hora inválida."); return; }

    // --- 4. BUSCAR EL ID DEL PACIENTE ---
    let patientIdToInsert: string | null = null;
    const toastIdFindPatient = toast.loading("Verificando paciente...");
    try {
      console.log(`SUBMIT: Searching patient with user_id = ${currentUser.id}`);
      const { data: patientData, error: patientError } = await supabase
        .from('patients').select('id').eq('user_id', currentUser.id).single();
      console.log("SUBMIT: Find patient response", { patientData, patientError });
      if (patientError && patientError.code !== 'PGRST116') throw new Error(`Error buscando paciente: ${patientError.message}`);
      if (!patientData) { console.error(`SUBMIT: No patient found for user ${currentUser.id}`); toast.error("Registro de paciente no encontrado.", { id: toastIdFindPatient }); return; }
      patientIdToInsert = patientData.id; // ID de la tabla 'patients'
      console.log(`SUBMIT: Found patient ID: ${patientIdToInsert}`);
      toast.dismiss(toastIdFindPatient);
    } catch (error: any) { console.error("Submit Error (find patient):", error); toast.error(`Error al verificar paciente: ${error.message || 'Desconocido'}`, { id: toastIdFindPatient }); return; }
    // --- FIN BÚSQUEDA ---

    // 5. Preparar datos para 'citas' USANDO el ID de paciente
    const citaData = {
      horario_cita: appointmentDateTimeLocal.toISOString(), // UTC
      dia_atencion: formData.date,
      id_usuario: patientIdToInsert, // <<< USA EL ID DE PATIENTS
      id_farmacias: formData.pharmacyId,
      status: 'Activo',
    };
    console.log("SUBMIT: Data for 'citas':", citaData);

    const toastIdSubmit = toast.loading("Agendando cita...");
    try {
      // 6. Insertar la cita
      const { error: insertError } = await supabase.from("citas").insert([citaData]);
      if (insertError) throw insertError;
      // 7. Éxito
      toast.success("¡Cita agendada!", { id: toastIdSubmit });
      setFormData({ pharmacyId: null, date: '', time: '', reason: '' }); setSelectedPharmacy(null); setAvailableTimes([]); setCurrentStep(1);
      fetchUpcomingAppointments(patientIdToInsert); // Refrescar usando el ID de paciente

    } catch (error: any) { console.error("Submit Error (insert cita):", error); toast.error(`No se pudo agendar: ${error.message || 'Error desconocido'}`, { id: toastIdSubmit }); }
  };

  // --- Lógica de Renderizado ---
  const renderStepContent = () => { /* ... (JSX de los pasos 1, 2, 3 como antes, usando availableDates) ... */
    switch (currentStep) {
       case 1: return ( <div className="space-y-6"> <label htmlFor="pharmacyId" className="block text-sm font-medium text-gray-700"><Building className="inline-block w-5 h-5 mr-2 align-text-bottom text-gray-500" />Selecciona farmacia</label> {loadingPharmacies ? (<div className="loading-msg">Cargando...</div>) : (<select id="pharmacyId" name="pharmacyId" value={formData.pharmacyId || ''} onChange={handleChange} className="input-std"><option value="" disabled>-- Elige --</option>{pharmacies.map((p) => (<option key={p.id_farmacia} value={p.id_farmacia}>{p.nombre} ({p.horario_atencion})</option>))}</select>)} {selectedPharmacy && (<div className="details-box"><p><strong>Horario:</strong> {selectedPharmacy.horario_atencion}</p></div>)} </div> );
       case 2: return ( <div className="space-y-8"> <div> <h4 className="h4-label"><Calendar className="icon-label" />Fecha</h4> <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-3">{availableDates.map((d, i) => (<label key={`${d.date}-${i}`} className={`date-label ${formData.date === d.date ? 'selected' : 'available'}`}><input type="radio" name="date" value={d.date} checked={formData.date === d.date} onChange={handleChange} className="sr-only" /><span className={`date-weekday ${formData.date === d.date ? 'selected' : ''}`}>{d.display.split(' ')[0]}</span><span className={`date-day ${formData.date === d.date ? 'selected' : ''}`}>{d.display.split(' ')[1]}</span></label>))}</div> </div> {formData.date && (<div> <h4 className="h4-label"><Clock className="icon-label" />Hora</h4> <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">{selectedPharmacy ? (availableTimes.length > 0 ? (availableTimes.map((t, i) => (<label key={`${t}-${i}`} className={`time-label ${formData.time === t ? 'selected' : 'available'}`}><input type="radio" name="time" value={t} checked={formData.time === t} onChange={handleChange} className="sr-only" /><span>{t}</span></label>))) : (<div className="col-span-full empty-slot-msg">No hay horarios disponibles.</div>)) : (<div className="col-span-full empty-slot-msg">Selecciona farmacia.</div>)}</div> </div>)} </div> );
       case 3: return ( <div className="space-y-6"> <div> <label htmlFor="reason" className="h4-label"><FileText className="icon-label" />Motivo</label> <textarea id="reason" name="reason" value={formData.reason} onChange={handleChange} rows={4} className="input-std" placeholder="Describe brevemente..." /> </div> <div className="summary-box"> <h4 className="summary-title">Resumen</h4> <div className="summary-item"><UserIcon className="summary-icon" /><p><strong className="font-medium">Paciente:</strong> {currentUser?.email || 'Usuario'}</p></div> <div className="summary-item"><Building className="summary-icon" /><p><strong className="font-medium">Farmacia:</strong> {selectedPharmacy?.nombre || 'N/A'}</p></div> <div className="summary-item"><Calendar className="summary-icon" /><p><strong className="font-medium">Fecha:</strong> {formData.date ? new Date(formData.date + 'T00:00:00').toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}</p></div> <div className="summary-item"><Clock className="summary-icon" /><p><strong className="font-medium">Hora:</strong> { formData.time ? new Date(`1970-01-01T${formData.time}:00`).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: true }) : 'N/A' }</p></div> <div className="summary-item"><FileText className="summary-icon" /><p><strong className="font-medium">Motivo:</strong> {formData.reason || <span className="italic text-gray-500">(No espec.)</span>}</p></div> </div> </div> );
       default: return null;
    }
   };

  // --- Renderizado Principal ---
  if (loadingUser) return <div className="loading-msg">Verificando sesión...</div>;
  if (!currentUser) return ( <div className="login-prompt"><h3 className="login-title">Acceso Requerido</h3><p>Necesitas iniciar sesión.</p><a href="/login" className="btn-primary">Iniciar Sesión</a></div> );

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-8">
      {/* Tarjeta Agendar Cita */}
      <div className="card-container">
         <div className="card-header"><h3 className="card-title">Agendar Nueva Cita</h3><p className="card-subtitle">¡Hola, {currentUser.email || 'usuario'}!</p></div>
         <div className="step-indicator-container"><nav aria-label="Progress"><ol role="list" className="step-list">{[1, 2, 3].map((step) => (<li key={step} className="flex-1">{step < currentStep ? (<div className="step completed"><span className="step-text">Paso {step}</span></div>) : step === currentStep ? (<div className="step current" aria-current="step"><span className="step-text">Paso {step}</span></div>) : (<div className="step upcoming"><span className="step-text">Paso {step}</span></div>)}</li>))}</ol></nav></div>
         <form onSubmit={handleSubmit} className="card-form"><div className="min-h-[250px]">{renderStepContent()}</div><div className="card-footer"><button type="button" onClick={handleBack} disabled={currentStep === 1} className="btn-secondary">Atrás</button>{currentStep < totalSteps ? (<button type="button" onClick={handleNext} className="btn-primary">Siguiente</button>) : (<button type="submit" className="btn-confirm">Confirmar Cita</button>)}</div></form>
      </div>

      {/* Sección Próximas Citas */}
      <div className="card-container">
        <button onClick={() => setIsAppointmentsVisible(!isAppointmentsVisible)} className="accordion-button" aria-expanded={isAppointmentsVisible} aria-controls="upcoming-appointments-list"><div className="flex items-center"><List className="w-5 h-5 mr-3 text-gray-600" /><h4 className="accordion-title">Próximas Citas</h4></div>{isAppointmentsVisible ? (<ChevronUp className="accordion-icon" />) : (<ChevronDown className="accordion-icon" />)}</button>
        {isAppointmentsVisible && (
          <div id="upcoming-appointments-list" className="accordion-content">
             {loadingAppointments ? (<div className="loading-msg">Cargando citas...</div>) : upcomingAppointments.length > 0 ? (<ul className="appointment-list">{upcomingAppointments.map((appt) => {const apptDate = new Date(appt.horario_cita); const isValid = !isNaN(apptDate.getTime()); return (<li key={appt.id} className="appointment-item"><div className="appt-icon-container"><Calendar className="appt-icon" /></div><div className="appt-details"><p className="appt-pharmacy">{appt.farmacias?.nombre || 'Farmacia N/A'}</p><p className="appt-date">{isValid ? new Date(appt.dia_atencion + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'Fecha N/A'}</p><p className="appt-time"><Clock className="inline-block w-4 h-4 mr-1 align-text-bottom"/>{isValid ? apptDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: true }) : 'Hora N/A'}{appt.status && <span className={`status-badge status-${appt.status.toLowerCase().replace(' ','-')}`}>{appt.status}</span>}</p></div></li>);})}</ul>) : (<div className="empty-list-msg">No tienes citas programadas.</div>)}
          </div>
        )}
      </div>
      {/* Placeholder CSS Classes (define these in your global CSS or Tailwind config) */}
      <style jsx global>{`
        .input-std { /* Example */ width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #d1d5db; border-radius: 0.375rem; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); }
        .loading-msg { text-align: center; padding: 2.5rem; color: #6b7280; }
        .login-prompt { max-width: 36rem; margin: 2.5rem auto; padding: 1.5rem; background-color: white; border-radius: 0.5rem; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1); text-align: center; }
        .login-title { font-size: 1.125rem; font-weight: 600; color: #374151; margin-bottom: 1rem; }
        .login-prompt p { color: #4b5563; margin-bottom: 1.25rem; }
        .btn-primary { padding: 0.5rem 1rem; background-color: #4f46e5; color: white; border-radius: 0.375rem; font-weight: 500; transition: background-color 0.15s ease-in-out; display: inline-block; text-decoration: none; }
        .btn-primary:hover { background-color: #4338ca; }
        .btn-secondary { padding: 0.5rem 1rem; background-color: white; color: #374151; border: 1px solid #d1d5db; border-radius: 0.375rem; font-weight: 500; transition: background-color 0.15s ease-in-out; }
        .btn-secondary:hover { background-color: #f9fafb; }
        .btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-confirm { padding: 0.5rem 1rem; background-color: #16a34a; color: white; border-radius: 0.375rem; font-weight: 500; transition: background-color 0.15s ease-in-out; }
        .btn-confirm:hover { background-color: #15803d; }
        .card-container { background-color: white; border-radius: 0.75rem; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1); overflow: hidden; }
        .card-header { padding: 1.25rem 1.5rem; background-color: #f9fafb; border-bottom: 1px solid #e5e7eb; }
        .card-title { font-size: 1.25rem; font-weight: 600; color: #111827; }
        .card-subtitle { margin-top: 0.25rem; font-size: 0.875rem; color: #6b7280; }
        .step-indicator-container { padding: 1rem 1.5rem; }
        .step-list { display: flex; align-items: center; gap: 1rem; }
        .step { flex: 1; display: flex; flex-direction: column; border-left-width: 4px; padding-left: 1rem; padding-top: 0.5rem; padding-bottom: 0.5rem; border-color: #e5e7eb; /* Default upcoming */ }
        .step.completed { border-color: #4f46e5; }
        .step.current { border-color: #4f46e5; }
        .step-text { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; /* Default upcoming */ }
        .step.completed .step-text, .step.current .step-text { color: #4f46e5; }
        @media (min-width: 768px) { .step { border-left-width: 0; border-top-width: 4px; padding-left: 0; padding-top: 1rem; padding-bottom: 0; } }
        .card-form { padding: 1.5rem; space-y: 1.5rem; }
        .card-footer { display: flex; justify-content: space-between; align-items: center; padding-top: 1.5rem; border-top: 1px solid #e5e7eb; }
        .h4-label { display: block; font-size: 0.875rem; font-weight: 500; color: #374151; margin-bottom: 0.75rem; display: flex; align-items: center; }
        .icon-label { width: 1.25rem; height: 1.25rem; margin-right: 0.5rem; color: #6b7280; vertical-align: bottom; }
        .date-label { display: flex; flex-direction: column; align-items: center; padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 0.5rem; cursor: pointer; transition: all 0.15s ease-in-out; text-align: center; }
        .date-label.available:hover { border-color: #a5b4fc; background-color: #eef2ff; }
        .date-label.selected { border-color: #6366f1; background-color: #eef2ff; ring: 2px; ring-color: #a5b4fc; }
        .date-weekday { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; color: #6b7280; }
        .date-weekday.selected { color: #4338ca; }
        .date-label.available:hover .date-weekday { color: #4f46e5; }
        .date-day { font-size: 1.125rem; font-weight: 700; margin-top: 0.25rem; color: #1f2937; }
        .date-day.selected { color: #4338ca; }
        .date-label.available:hover .date-day { color: #4f46e5; }
        .time-label { display: flex; align-items: center; justify-content: center; padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 0.5rem; cursor: pointer; transition: all 0.15s ease-in-out; text-align: center; font-size: 0.875rem; }
        .time-label.available:hover { border-color: #a5b4fc; background-color: #eef2ff; color: #4f46e5; }
        .time-label.selected { border-color: #6366f1; background-color: #eef2ff; ring: 2px; ring-color: #a5b4fc; color: #4338ca; font-weight: 600; }
        .empty-slot-msg { text-align: center; padding: 1rem; color: #6b7280; background-color: #f9fafb; border-radius: 0.5rem; border: 1px solid #e5e7eb; }
        .summary-box { background-color: #eef2ff; border: 1px solid #c7d2fe; padding: 1rem; border-radius: 0.5rem; space-y: 0.75rem; }
        .summary-title { font-size: 1rem; font-weight: 600; color: #3730a3; margin-bottom: 0.5rem; }
        .summary-item { display: flex; align-items: flex-start; font-size: 0.875rem; color: #4b5563; }
        .summary-icon { width: 1.25rem; height: 1.25rem; color: #4f46e5; margin-right: 0.75rem; flex-shrink: 0; margin-top: 0.125rem; }
        .accordion-button { width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.5rem; text-align: left; transition: background-color 0.15s ease-in-out; }
        .accordion-button:hover { background-color: #f9fafb; }
        .accordion-title { font-size: 1.125rem; font-weight: 500; color: #1f2937; }
        .accordion-icon { width: 1.5rem; height: 1.5rem; color: #6b7280; }
        .accordion-content { padding: 0 1.5rem 1.5rem 1.5rem; border-top: 1px solid #e5e7eb; }
        .appointment-list { list-style: none; padding: 0; margin: 0; divide-y: 1px solid #e5e7eb; padding-top: 1rem;}
        .appointment-item { display: flex; align-items: center; gap: 1rem; padding-top: 1rem; padding-bottom: 1rem; }
        .appt-icon-container { flex-shrink: 0; width: 2.5rem; height: 2.5rem; border-radius: 9999px; background-color: #e0e7ff; display: flex; align-items: center; justify-content: center; }
        .appt-icon { width: 1.25rem; height: 1.25rem; color: #4f46e5; }
        .appt-details { flex: 1; min-width: 0; }
        .appt-pharmacy { font-size: 0.875rem; font-weight: 500; color: #111827; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .appt-date { font-size: 0.875rem; color: #6b7280; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .appt-time { font-size: 0.875rem; color: #6b7280; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .status-badge { margin-left: 0.5rem; display: inline-flex; align-items: center; padding: 0.125rem 0.625rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 500; }
        .status-activo { background-color: #dbeafe; color: #1e40af; }
        .status-en-consulta { background-color: #fef9c3; color: #854d0e; }
        .status-terminada { background-color: #dcfce7; color: #166534; }
        .empty-list-msg { text-align: center; padding: 1.5rem; color: #6b7280; }
        .details-box { font-size: 0.875rem; color: #4b5563; background-color: #f9fafb; padding: 0.75rem; border-radius: 0.375rem; border: 1px solid #e5e7eb; }

      `}</style>
    </div>
  );
};

export default AppointmentScheduler;
