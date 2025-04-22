import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar, Clock, User as UserIcon, FileText, Building, ChevronDown, ChevronUp, List, CreditCard, DollarSign, CheckCircle, AlertTriangle, Info, X // Añadido X para cerrar modal
} from 'lucide-react';
import supabase from '../../lib/supabaseClient'; // VERIFICA RUTA
import { toast, Toaster } from 'react-hot-toast'; // VERIFICA Toaster en App.tsx
import { User } from '@supabase/supabase-js';
import Barcode from 'react-barcode'; // <--- Importar librería
import { motion, AnimatePresence } from 'framer-motion'; // Para animación del modal

// --- Interfaces ---
interface AppointmentFormData { pharmacyId: number | null; date: string; time: string; reason: string; }
interface Pharmacy { id_farmacia: number; nombre: string; horario_atencion: string; }
// Interfaz Actualizada para UpcomingAppointment
interface UpcomingAppointment {
  id: number; // ID de la cita (bigint)
  horario_cita: string;
  dia_atencion: string;
  status: string | null;
  motivo_cita: string | null;
  farmacias: { nombre: string; } | null;
  // Añadir datos del pago asociado
  pago_e_cita: { // Supabase devuelve un array en joins así
    numero_recibo: string | null;
    estado_pago: string;
   }[] | null; // Puede ser null si no hay pago o error
}
interface PagoECita { /* ... (sin cambios) ... */ }

// --- Component ---
const AppointmentScheduler = () => {
  // --- State Variables ---
  const [selectedPharmacy, setSelectedPharmacy] = useState<Pharmacy | null>(null);
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [formData, setFormData] = useState<AppointmentFormData>({ pharmacyId: null, date: '', time: '', reason: '' });
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 4;
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [loadingPharmacies, setLoadingPharmacies] = useState(true);
  const [upcomingAppointments, setUpcomingAppointments] = useState<UpcomingAppointment[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(true);
  const [isAppointmentsVisible, setIsAppointmentsVisible] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | null>(null);
  const [receiptNumber, setReceiptNumber] = useState<string | null>(null);

  // --- NUEVOS ESTADOS: Modal Código de Barras ---
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const [selectedAppointmentForBarcode, setSelectedAppointmentForBarcode] = useState<UpcomingAppointment | null>(null);
  // --- Fin Nuevos Estados ---


  // --- Helper Functions ---
  const generateDates = useCallback(() => { /* ... (sin cambios) ... */ const dates: { date: string, display: string, isToday: boolean }[] = []; const today = new Date(); for (let i = 0; i < 14; i++) { const date = new Date(today); date.setDate(today.getDate() + i); if (date.getDay() !== 0 && date.getDay() !== 6) { const dS = date.toISOString().split('T')[0]; const isT = i === 0; const dO: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }; let dispS = date.toLocaleDateString('es-ES', dO).replace('.', ''); if (isT) { dispS = `Hoy (${dispS})`; } dates.push({ date: dS, display: dispS, isToday: isT }); } } return dates; }, []);
  const availableDates = useMemo(() => generateDates(), [generateDates]);
  const parseBusinessHours = useCallback((horarioAtencion: string | undefined): string[] => { /* ... (sin cambios) ... */ if (!horarioAtencion) return []; const times: string[] = []; const ranges = horarioAtencion.split(/ y |,|;/); const parseTimeRange = (range: string) => { const tM = range.match(/\d{1,2}:\d{2}/g); if (tM && tM.length >= 2) { const s = tM[0]; const eT = tM[tM.length - 1]; try { let cT = new Date(`1970-01-01T${s}:00`); const eD = new Date(`1970-01-01T${eT}:00`); if (isNaN(cT.getTime()) || isNaN(eD.getTime()) || eD <= cT) { console.warn(`Invalid time range: ${range}`); return; } while (cT < eD) { times.push(cT.toTimeString().slice(0, 5)); cT.setMinutes(cT.getMinutes() + 30); } } catch (e) { console.error("Time parse error:", range, e); } } else { console.warn(`Cannot parse time range: "${range}"`); } }; ranges.forEach(range => parseTimeRange(range.trim())); return times; }, []);
  const formatDate = (dateString: string | null | undefined) => { /* Helper opcional si lo usas */
      if (!dateString) return 'N/A';
      try {
          const date = new Date(dateString);
          const adjustedDate = dateString.includes('T') ? date : new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
          if (isNaN(adjustedDate.getTime())) return 'Fecha Inválida';
          return adjustedDate.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
      } catch (e) { console.error("Error formatting date:", dateString, e); return 'Error Fecha'; }
  };
  const formatTime = (timeString: string | null | undefined) => { /* Helper opcional si lo usas */
    if (!timeString) return 'N/A';
    try {
        const date = new Date(timeString);
        if (isNaN(date.getTime())) return 'Hora Inválida';
        return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch (e) { console.error("Error formatting time:", timeString, e); return 'Error Hora'; }
  };

  // --- Effects ---
  useEffect(() => { /* ... (Auth & Patient ID sin cambios) ... */ }, []);
  useEffect(() => { /* ... (Pharmacies sin cambios) ... */ }, []);
  useEffect(() => { /* ... (Occupied Times sin cambios) ... */ }, [formData.date, formData.pharmacyId, selectedPharmacy, parseBusinessHours]);

  // --- fetchUpcomingAppointments MODIFICADO ---
  const fetchUpcomingAppointments = useCallback(async () => {
    console.log("FETCH_APPTS: Called. Patient ID (UUID):", patientId);
    if (!patientId) {
      setUpcomingAppointments([]);
      setLoadingAppointments(false);
      return;
    }
    setLoadingAppointments(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error, status } = await supabase
        .from('citas')
        .select(`
          id,
          horario_cita,
          dia_atencion,
          status,
          motivo_cita,
          farmacias ( nombre ),
          pago_e_cita ( numero_recibo, estado_pago )
        `) // <-- Seleccionamos campos de pago_e_cita
        .eq('id_usuario', patientId)
        .gte('dia_atencion', today)
        .order('dia_atencion')
        .order('horario_cita');

      console.log("FETCH_APPTS: Resp for", patientId, { data, error, status });

      if (error && status !== 406) { // 406 puede ser normal si no hay filas
        throw error;
      }

      // Asegurarnos que el formato coincida con la interfaz UpcomingAppointment
      const formattedData = (data || []).map(appt => ({
          ...appt,
          // Aseguramos que pago_e_cita sea un array o null
          pago_e_cita: Array.isArray(appt.pago_e_cita) ? appt.pago_e_cita : null,
          // Filtrar si no tiene farmacia asociada (raro, pero por si acaso)
      })).filter(appt => appt.farmacias);

      setUpcomingAppointments(formattedData);

    } catch (error: any) {
      console.error('FETCH_APPTS Error:', error);
      toast.error(`Error cargando citas: ${error.message}`);
      setUpcomingAppointments([]);
    } finally {
      setLoadingAppointments(false);
    }
  }, [patientId]); // Dependencia principal

  useEffect(() => { // Trigger Fetch Upcoming Appointments
    if (!loadingUser && patientId) { fetchUpcomingAppointments(); }
    else if (!loadingUser && !patientId && currentUser) { setUpcomingAppointments([]); setLoadingAppointments(false); }
  }, [loadingUser, patientId, fetchUpcomingAppointments, currentUser]);


  // --- Manejadores de Eventos ---
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => { /* ... (sin cambios) ... */ };
  const handleNext = () => { /* ... (sin cambios) ... */ };
  const handleBack = () => { /* ... (sin cambios) ... */ };
  const handlePaymentMethodChange = (method: 'cash') => { /* ... (sin cambios) ... */ };
  const handleSubmit = async (e: React.FormEvent) => { /* ... (sin cambios) ... */ };

  // --- NUEVO: Manejador para abrir el modal ---
  const handleOpenBarcodeModal = (appointment: UpcomingAppointment) => {
    setSelectedAppointmentForBarcode(appointment);
    setIsBarcodeModalOpen(true);
  };
  // --- Fin Nuevo Manejador ---

  // --- Lógica de Renderizado ---
  const renderStepContent = () => { /* ... (sin cambios en los pasos 1 a 4) ... */ };

  // --- Renderizado Principal ---
  if (loadingUser) return <div className="loading-msg">Verificando sesión...</div>;
  if (!currentUser) return ( <div className="login-prompt"><h3 className="login-title">Acceso Requerido</h3><p>Necesitas iniciar sesión para agendar citas.</p></div> );
  if (!patientId) return ( <div className="login-prompt"><h3 className="login-title">Registro Incompleto</h3><p>No se encontró un registro de paciente asociado. Contacta a soporte.</p></div> );

  return (
    <div className="max-w-3xl mx-auto space-y-8 p-4 sm:p-6 lg:p-8">
      <Toaster position="top-center" reverseOrder={false} toastOptions={{ duration: 5000 }} />
      {/* --- Agendar Cita (Sin cambios estructurales) --- */}
      <div className="card-container">
         <div className="card-header"><h3 className="card-title">Agendar Nueva Cita</h3><p className="card-subtitle">¡Hola, {currentUser.email?.split('@')[0] || 'usuario'}!</p></div>
         <div className="step-indicator-container"><nav aria-label="Progress"><ol role="list" className="step-list">{[1, 2, 3, 4].map((step) => (<li key={step} className="flex-1">{step < currentStep ? (<div className="step completed"><span className="step-text">Paso {step}</span></div>) : step === currentStep ? (<div className="step current" aria-current="step"><span className="step-text">Paso {step}</span></div>) : (<div className="step upcoming"><span className="step-text">Paso {step}</span></div>)}</li>))}</ol></nav></div>
         <form onSubmit={currentStep === totalSteps ? handleSubmit : (e) => e.preventDefault()} className="card-form">
             <div className="min-h-[300px]">{renderStepContent()}</div>
             <div className="card-footer">
                 <button type="button" onClick={handleBack} disabled={currentStep === 1} className="btn-secondary">Atrás</button>
                 {currentStep < totalSteps ? (
                     <button type="button" onClick={handleNext} className="btn-primary">Siguiente</button>
                 ) : (
                     <button type="submit" className="btn-confirm">Confirmar Cita</button>
                 )}
            </div>
         </form>
      </div>

      {/* --- Sección Mis Citas (MODIFICADA) --- */}
      <div className="card-container">
        <button onClick={() => setIsAppointmentsVisible(!isAppointmentsVisible)} className="accordion-button" aria-expanded={isAppointmentsVisible} aria-controls="upcoming-appointments-list"><div className="flex items-center"><List className="w-5 h-5 mr-3 text-gray-600" /><h4 className="accordion-title">Mis Próximas Citas</h4></div>{isAppointmentsVisible ? (<ChevronUp className="accordion-icon" />) : (<ChevronDown className="accordion-icon" />)}</button>
        {isAppointmentsVisible && (
          <div id="upcoming-appointments-list" className="accordion-content">
             {loadingAppointments ? (
                <div className="loading-msg">Cargando citas...</div>
             ) : upcomingAppointments.length > 0 ? (
                <ul className="appointment-list">
                  {upcomingAppointments.map((appt) => {
                    // Extraer numero_recibo (si existe)
                    const receiptInfo = appt.pago_e_cita?.[0]; // Acceder al primer (y único esperado) registro de pago
                    const numeroRecibo = receiptInfo?.numero_recibo;

                    return (
                      // --- LIST ITEM AHORA CLICKABLE ---
                      <li
                        key={appt.id}
                        className="appointment-item cursor-pointer hover:bg-gray-50 transition-colors duration-150"
                        onClick={() => handleOpenBarcodeModal(appt)} // <-- Abre el modal
                        title={numeroRecibo ? "Ver código de barras del recibo" : "Ver detalles"} // Tooltip
                      >
                        <div className="appt-icon-container"><Calendar className="appt-icon" /></div>
                        <div className="appt-details">
                          <p className="appt-pharmacy">{appt.farmacias?.nombre || 'N/A'}</p>
                          <p className="appt-date">{formatDate(appt.dia_atencion)}</p> {/* Usar formatDate */}
                          <p className="appt-time">
                            <Clock className="inline-block w-4 h-4 mr-1 align-text-bottom"/>
                            {formatTime(appt.horario_cita)} {/* Usar formatTime */}
                            {appt.status && <span className={`status-badge status-${appt.status.toLowerCase().replace(' ','-')}`}>{appt.status}</span>}
                            {/* Indicar estado del pago si existe */}
                            {receiptInfo && (
                                <span className={`status-badge ml-2 ${receiptInfo.estado_pago === 'pagado' ? 'status-pagado' : 'status-pendiente'}`}>
                                    {receiptInfo.estado_pago === 'pagado' ? 'Pagado' : 'Pendiente'}
                                </span>
                            )}
                          </p>
                          {appt.motivo_cita && <p className="appt-reason text-sm text-gray-500 mt-1"><FileText className="inline-block w-4 h-4 mr-1 align-text-bottom"/>Motivo: {appt.motivo_cita}</p>}
                           {/* Mostrar recibo textual (opcional) */}
                           {numeroRecibo && <p className="text-xs text-gray-400 mt-1">Recibo: {numeroRecibo}</p>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
             ) : (
                <div className="empty-list-msg">No tienes citas programadas.</div>
             )}
          </div>
        )}
      </div>

      {/* --- NUEVO: Modal Código de Barras --- */}
      <AnimatePresence>
        {isBarcodeModalOpen && selectedAppointmentForBarcode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 backdrop-blur-sm"
            onClick={() => setIsBarcodeModalOpen(false)} // Cerrar al hacer clic fuera
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl relative text-center"
              onClick={(e) => e.stopPropagation()} // Evitar cerrar al hacer clic dentro
            >
              <button
                onClick={() => setIsBarcodeModalOpen(false)}
                className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
                aria-label="Cerrar modal"
              >
                <X className="h-5 w-5" />
              </button>

              <h3 className="text-lg font-semibold mb-2 text-gray-800">Detalles de la Cita</h3>
              <p className="text-sm text-gray-600 mb-1">
                 {selectedAppointmentForBarcode.farmacias?.nombre || 'Farmacia N/A'}
              </p>
              <p className="text-sm text-gray-600 mb-4">
                {formatDate(selectedAppointmentForBarcode.dia_atencion)} - {formatTime(selectedAppointmentForBarcode.horario_cita)}
              </p>

              {/* Renderizar código de barras si existe numero_recibo */}
              {selectedAppointmentForBarcode.pago_e_cita?.[0]?.numero_recibo ? (
                <div className="barcode-container bg-white p-4 inline-block border">
                   <Barcode
                      value={selectedAppointmentForBarcode.pago_e_cita[0].numero_recibo}
                      format="CODE128" // Formato común para recibos/IDs
                      width={2}        // Ancho de las barras
                      height={80}      // Altura del código
                      displayValue={true} // Mostrar el número debajo
                      fontSize={14}
                      margin={10}
                    />
                </div>
              ) : (
                <div className="my-8 p-4 bg-yellow-50 border border-yellow-200 rounded-md text-yellow-700 text-sm">
                   <AlertTriangle className="inline-block w-5 h-5 mr-2 align-text-bottom"/>
                   No se encontró un número de recibo para esta cita.
                </div>
              )}

               <p className={`mt-3 text-sm font-medium ${selectedAppointmentForBarcode.pago_e_cita?.[0]?.estado_pago === 'pagado' ? 'text-green-600' : 'text-orange-600'}`}>
                 Estado del Pago: {selectedAppointmentForBarcode.pago_e_cita?.[0]?.estado_pago?.toUpperCase() ?? 'Desconocido'}
               </p>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* --- Fin Modal --- */}


      {/* Estilos */}
      <style jsx global>{`
        /* ... (Estilos existentes sin cambios importantes) ... */
        .input-std { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #d1d5db; border-radius: 0.375rem; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); } .input-std:focus { outline: 2px solid transparent; outline-offset: 2px; border-color: #6366f1; --tw-ring-color: #6366f1; box-shadow: var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow); }
        .loading-msg { text-align: center; padding: 2.5rem; color: #6b7280; }
        .login-prompt { max-width: 36rem; margin: 2.5rem auto; padding: 1.5rem; background-color: white; border-radius: 0.5rem; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1); text-align: center; }
        .login-title { font-size: 1.125rem; font-weight: 600; color: #374151; margin-bottom: 1rem; } .login-prompt p { color: #4b5563; margin-bottom: 1.25rem; }
        .btn-primary { padding: 0.5rem 1rem; background-color: #4f46e5; color: white; border-radius: 0.375rem; font-weight: 500; transition: background-color 0.15s ease-in-out; display: inline-block; text-decoration: none; cursor: pointer; border: none;} .btn-primary:hover { background-color: #4338ca; } .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-secondary { padding: 0.5rem 1rem; background-color: white; color: #374151; border: 1px solid #d1d5db; border-radius: 0.375rem; font-weight: 500; transition: background-color 0.15s ease-in-out; cursor: pointer;} .btn-secondary:hover { background-color: #f9fafb; } .btn-secondary:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-confirm { padding: 0.5rem 1rem; background-color: #16a34a; color: white; border-radius: 0.375rem; font-weight: 500; transition: background-color 0.15s ease-in-out; cursor: pointer; border: none;} .btn-confirm:hover { background-color: #15803d; } .btn-confirm:disabled { opacity: 0.6; cursor: not-allowed; }
        .card-container { background-color: white; border-radius: 0.75rem; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1); overflow: hidden; margin-bottom: 2rem; }
        .card-header { padding: 1.25rem 1.5rem; background-color: #f9fafb; border-bottom: 1px solid #e5e7eb; } .card-title { font-size: 1.25rem; font-weight: 600; color: #111827; } .card-subtitle { margin-top: 0.25rem; font-size: 0.875rem; color: #6b7280; }
        .step-indicator-container { padding: 1rem 1.5rem; } .step-list { display: flex; align-items: center; gap: 1rem; } .step { flex: 1; display: flex; flex-direction: column; border-left-width: 4px; padding-left: 1rem; padding-top: 0.5rem; padding-bottom: 0.5rem; border-color: #e5e7eb; } .step.completed { border-color: #4f46e5; } .step.current { border-color: #4f46e5; } .step-text { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; } .step.completed .step-text, .step.current .step-text { color: #4f46e5; } @media (min-width: 768px) { .step { border-left-width: 0; border-top-width: 4px; padding-left: 0; padding-top: 1rem; padding-bottom: 0; } }
        .card-form { padding: 1.5rem; } .card-footer { display: flex; justify-content: space-between; align-items: center; padding: 1.5rem; margin-top: 1.5rem; border-top: 1px solid #e5e7eb; }
        .h4-label { display: block; font-size: 0.875rem; font-weight: 500; color: #374151; margin-bottom: 0.75rem; display: flex; align-items: center; } .icon-label { width: 1.25rem; height: 1.25rem; margin-right: 0.5rem; color: #6b7280; vertical-align: bottom; }
        .date-label { display: flex; flex-direction: column; align-items: center; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 0.5rem; cursor: pointer; transition: all 0.15s ease-in-out; text-align: center; min-height: 4rem; justify-content: center;} .date-label.available:hover { border-color: #a5b4fc; background-color: #eef2ff; } .date-label.selected { border-color: #6366f1; background-color: #e0e7ff; box-shadow: 0 0 0 2px #a5b4fc; } .date-label.border-indigo-400 { border-color: #818cf8; }
        .date-display { font-size: 0.8rem; font-weight: 500; color: #374151; line-height: 1.2; } .date-display.selected { color: #4338ca; } .date-label.available:hover .date-display { color: #4f46e5; } .date-display.font-semibold { font-weight: 600; }
        .time-label { display: flex; align-items: center; justify-content: center; padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 0.5rem; cursor: pointer; transition: all 0.15s ease-in-out; text-align: center; font-size: 0.875rem; } .time-label.available:hover { border-color: #a5b4fc; background-color: #eef2ff; color: #4f46e5; } .time-label.selected { border-color: #6366f1; background-color: #e0e7ff; box-shadow: 0 0 0 2px #a5b4fc; color: #4338ca; font-weight: 600; }
        .empty-slot-msg { text-align: center; padding: 1rem; color: #6b7280; background-color: #f9fafb; border-radius: 0.5rem; border: 1px solid #e5e7eb; }
        .summary-box { background-color: #f3f4f6; border: 1px solid #e5e7eb; padding: 1rem; border-radius: 0.5rem; space-y: 0.75rem; } .summary-title { font-size: 1rem; font-weight: 600; color: #1f2937; margin-bottom: 0.5rem; } .summary-item { display: flex; align-items: flex-start; font-size: 0.875rem; color: #4b5563; } .summary-icon { width: 1.25rem; height: 1.25rem; color: #4f46e5; margin-right: 0.75rem; flex-shrink: 0; margin-top: 0.125rem; }
        .accordion-button { width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.5rem; text-align: left; transition: background-color 0.15s ease-in-out; border: none; background: none;} .accordion-button:hover { background-color: #f9fafb; } .accordion-title { font-size: 1.125rem; font-weight: 500; color: #1f2937; } .accordion-icon { width: 1.5rem; height: 1.5rem; color: #6b7280; }
        .accordion-content { padding: 0 1.5rem 1.5rem 1.5rem; border-top: 1px solid #e5e7eb; }
        .appointment-list { list-style: none; padding: 0; margin: 0; padding-top: 1rem;}
        .appointment-item { display: flex; align-items: flex-start; gap: 1rem; padding: 1rem 0.5rem; /* Añadido padding para mejor click */ border-bottom: 1px solid #e5e7eb; border-radius: 0.375rem; /* Bordes redondeados suaves */}
        .appointment-item:last-child { border-bottom: none; }
        .appointment-item.cursor-pointer:hover { background-color: #f9fafb; /* slate-50 */}
        .appt-icon-container { flex-shrink: 0; width: 2.5rem; height: 2.5rem; border-radius: 9999px; background-color: #e0e7ff; display: flex; align-items: center; justify-content: center; } .appt-icon { width: 1.25rem; height: 1.25rem; color: #4f46e5; } .appt-details { flex: 1; min-width: 0; } .appt-pharmacy { font-size: 0.875rem; font-weight: 500; color: #111827; } .appt-date { font-size: 0.875rem; color: #6b7280; } .appt-time { font-size: 0.875rem; color: #6b7280; }
        .status-badge { display: inline-flex; align-items: center; padding: 0.125rem 0.625rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 500; line-height: 1; /* Para mejor alineación vertical */ }
        .status-activo { background-color: #dbeafe; color: #1e40af; }
        .status-pendiente { background-color: #ffedd5; color: #9a3412; } /* Naranja para pendiente */
        .status-pagado { background-color: #dcfce7; color: #166534; } /* Verde para pagado */
        /* Añade otros estilos de status si los tienes */
        .empty-list-msg { text-align: center; padding: 1.5rem; color: #6b7280; } .details-box { font-size: 0.875rem; color: #4b5563; background-color: #f9fafb; padding: 0.75rem; border-radius: 0.375rem; border: 1px solid #e5e7eb; }
        .appt-reason { font-style: italic; }
        .text-orange-600 { color: #ea580c; } /* Para el texto 'Pendiente' en resumen paso 4 */
        .barcode-container svg { display: block; margin: auto; } /* Centrar el SVG del barcode */
      `}</style>
    </div>
  );
};

export default AppointmentScheduler;
