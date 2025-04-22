import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar, Clock, User as UserIcon, FileText, Building, ChevronDown, ChevronUp, List, CreditCard, DollarSign, CheckCircle, AlertTriangle
} from 'lucide-react';
import supabase from '../../lib/supabaseClient'; // VERIFICA RUTA
import { toast, Toaster } from 'react-hot-toast'; // VERIFICA Toaster en App.tsx
import { User } from '@supabase/supabase-js';

// --- Interfaces ---
interface AppointmentFormData { pharmacyId: number | null; date: string; time: string; reason: string; }
interface Pharmacy { id_farmacia: number; nombre: string; horario_atencion: string; }
interface UpcomingAppointment { id: number; horario_cita: string; dia_atencion: string; status: string | null; motivo_cita: string | null; /* Añadido */ farmacias: { nombre: string; } | null; }
interface CardDetails { cardholderName: string; cardNumber: string; expiryDate: string; cvv: string; }
// Interfaz para los datos de la nueva tabla (referencia)
interface PagoECita {
  id?: number | string; // Opcional porque la DB lo genera
  cita_id: number; // O UUID si usas UUID en citas.id
  metodo_pago: string;
  numero_recibo?: string | null;
  estado_pago: string;
  // fecha_creacion: string; // La DB lo genera
}

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
  const [patientId, setPatientId] = useState<string | null>(null); // Asegúrate que el tipo coincida con tu tabla patients.id (string si es UUID, number si es int)
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | null>(null);
  const [receiptNumber, setReceiptNumber] = useState<string | null>(null); // Almacena el recibo generado para efectivo
  // const [cardDetails, setCardDetails] = useState<CardDetails>({ cardholderName: '', cardNumber: '', expiryDate: '', cvv: '' }); // Comentado o eliminado si no se usa tarjeta

  // --- Helper Functions ---
  const generateDates = useCallback(() => { /* ... (sin cambios) ... */ const dates: { date: string, display: string, isToday: boolean }[] = []; const today = new Date(); for (let i = 0; i < 14; i++) { const date = new Date(today); date.setDate(today.getDate() + i); if (date.getDay() !== 0 && date.getDay() !== 6) { const dS = date.toISOString().split('T')[0]; const isT = i === 0; const dO: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }; let dispS = date.toLocaleDateString('es-ES', dO).replace('.', ''); if (isT) { dispS = `Hoy (${dispS})`; } dates.push({ date: dS, display: dispS, isToday: isT }); } } return dates; }, []);
  const availableDates = useMemo(() => generateDates(), [generateDates]);
  const parseBusinessHours = useCallback((horarioAtencion: string | undefined): string[] => { /* ... (sin cambios, pero ahora es useCallback) ... */ if (!horarioAtencion) return []; const times: string[] = []; const ranges = horarioAtencion.split(/ y |,|;/); const parseTimeRange = (range: string) => { const tM = range.match(/\d{1,2}:\d{2}/g); if (tM && tM.length >= 2) { const s = tM[0]; const eT = tM[tM.length - 1]; try { let cT = new Date(`1970-01-01T${s}:00`); const eD = new Date(`1970-01-01T${eT}:00`); if (isNaN(cT.getTime()) || isNaN(eD.getTime()) || eD <= cT) { console.warn(`Invalid time range: ${range}`); return; } while (cT < eD) { times.push(cT.toTimeString().slice(0, 5)); cT.setMinutes(cT.getMinutes() + 30); } } catch (e) { console.error("Time parse error:", range, e); } } else { console.warn(`Cannot parse time range: "${range}"`); } }; ranges.forEach(range => parseTimeRange(range.trim())); return times; }, []);

  // --- Effects ---
  useEffect(() => { // Auth & Patient ID
    // ... (sin cambios significativos, asegura que patientId se establece correctamente) ...
    let isMounted = true; setLoadingUser(true);
    const fetchUserAndPatient = async () => { if (!isMounted) return; try { const { data: { session }, error: sE } = await supabase.auth.getSession(); if (sE) throw sE; const user = session?.user ?? null; if (isMounted) setCurrentUser(user); console.log("AUTH: Session User:", user); if (user?.id) { console.log(`AUTH: Finding patient ID for ${user.id}`); const { data: pD, error: pE } = await supabase.from('patients').select('id').eq('user_id', user.id).single(); if (pE && pE.code !== 'PGRST116') { throw new Error(`Error paciente: ${pE.message}`); } if (pD) { console.log("AUTH: Patient ID:", pD.id); if (isMounted) setPatientId(String(pD.id)); /* Asegúrate de que el tipo coincida */ } else { console.log("AUTH: No patient found."); if (isMounted) setPatientId(null); } } else { if (isMounted) setPatientId(null); } } catch (error: any) { console.error("AUTH/PATIENT Error:", error); if (isMounted) { setCurrentUser(null); setPatientId(null); toast.error(`Error sesión/paciente: ${error.message}`); } } finally { if (isMounted) setLoadingUser(false); } };
    fetchUserAndPatient();
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => { if (isMounted) { console.log("AUTH Listener:", _event); fetchUserAndPatient(); if (!session?.user) { setUpcomingAppointments([]); setLoadingAppointments(false); } } });
    return () => { isMounted = false; authListener?.subscription.unsubscribe(); };
  }, []);

  useEffect(() => { // Pharmacies
    // ... (sin cambios) ...
    let isMounted = true; const fetchPharmacies = async () => { if (!isMounted) return; setLoadingPharmacies(true); try { const { data, error } = await supabase.from('farmacias').select('id_farmacia, nombre, horario_atencion'); if (error) throw error; if (isMounted) setPharmacies(data || []); } catch (error: any) { console.error('Pharmacies Error:', error); if (isMounted) toast.error(`Error farmacias: ${error.message}`); } finally { if (isMounted) setLoadingPharmacies(false); } }; fetchPharmacies(); return () => { isMounted = false; };
  }, []);

  useEffect(() => { // Occupied Times
    // ... (sin cambios) ...
    let isMounted = true;
    const fetchOccupiedTimes = async () => { if (!formData.date || !formData.pharmacyId || !selectedPharmacy || !isMounted) { if (isMounted) setAvailableTimes(selectedPharmacy ? parseBusinessHours(selectedPharmacy.horario_atencion) : []); return; } console.log(`Checking occupied: ${formData.pharmacyId} on ${formData.date}`); try { const { data: cO, error } = await supabase .from("citas").select("horario_cita").eq("id_farmacias", formData.pharmacyId).eq("dia_atencion", formData.date); if (error) throw error; if (!isMounted) return; const bT = cO.map((cita) => { try { const d = new Date(cita.horario_cita); return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); } catch (e) { console.error("Err parsing booked:", cita.horario_cita, e); return null; } }).filter(t => t !== null); console.log("Booked (local):", bT); const allPT = parseBusinessHours(selectedPharmacy.horario_atencion); console.log("All possible:", allPT); let avail = allPT.filter(time => !bT.includes(time)); console.log("Avail after booked:", avail); const todayStr = new Date().toISOString().split('T')[0]; if (formData.date === todayStr) { const now = new Date(); const currentTimeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); console.log(`Filtering past for today. Now: ${currentTimeStr}`); avail = avail.filter(time => time >= currentTimeStr); console.log("Avail after past:", avail); } if (isMounted) setAvailableTimes(avail); } catch (error: any) { console.error("Booked Times Error:", error); if (isMounted) { toast.error(`Error horas: ${error.message}`); setAvailableTimes(selectedPharmacy ? parseBusinessHours(selectedPharmacy.horario_atencion) : []); } } };
    fetchOccupiedTimes(); return () => { isMounted = false; };
  }, [formData.date, formData.pharmacyId, selectedPharmacy, parseBusinessHours]); // parseBusinessHours añadido a dependencias por ser useCallback

  const fetchUpcomingAppointments = useCallback(async () => { // Upcoming Appointments (Añadir motivo_cita)
    console.log("FETCH_APPTS: Called. Patient ID:", patientId); if (!patientId) { setUpcomingAppointments([]); setLoadingAppointments(false); return; } setLoadingAppointments(true); try { const today = new Date().toISOString().split('T')[0]; // Recupera tambien motivo_cita
       const { data, error, status } = await supabase .from('citas') .select(` id, horario_cita, dia_atencion, status, motivo_cita, farmacias ( nombre ) `) .eq('id_usuario', patientId) // Asegúrate que el tipo de patientId coincida con id_usuario en la DB
       .gte('dia_atencion', today) .order('dia_atencion') .order('horario_cita'); console.log("FETCH_APPTS: Resp for", patientId, { data, error, status }); if (error && status !== 406) throw error; setUpcomingAppointments(data?.filter(appt => appt.farmacias) || []); } catch (error: any) { console.error('FETCH_APPTS Error:', error); toast.error(`Error citas: ${error.message}`); setUpcomingAppointments([]); } finally { setLoadingAppointments(false); }
  }, [patientId]); // patientId es la dependencia clave aquí

  useEffect(() => { // Trigger Fetch Upcoming Appointments
    if (!loadingUser && patientId) { fetchUpcomingAppointments(); }
    else if (!loadingUser && !patientId && currentUser) { // Si está logueado pero no es paciente
       setUpcomingAppointments([]); setLoadingAppointments(false); }
    // Si no está logueado, no hagas nada (ya se maneja en el return principal)
  }, [loadingUser, patientId, fetchUpcomingAppointments, currentUser]);


  // --- Manejadores de Eventos ---
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => { const { name, value } = e.target; if (name === 'pharmacyId') { const id = value ? parseInt(value) : null; const sel = pharmacies.find(p => p.id_farmacia === id); setSelectedPharmacy(sel || null); setFormData(prev => ({ ...prev, pharmacyId: id, time: '', date: '', reason: prev.reason /* Mantener motivo */ })); setAvailableTimes([]); } else if (name === 'date') { setFormData(prev => ({ ...prev, date: value, time: '' })); } else { setFormData(prev => ({ ...prev, [name]: value })); } };

  const handleNext = () => {
    if (currentStep === 1 && !formData.pharmacyId) { toast.error('Selecciona farmacia.'); return; }
    if (currentStep === 2 && !formData.date) { toast.error('Selecciona fecha.'); return; }
    if (currentStep === 2 && !formData.time) { toast.error('Selecciona hora.'); return; }
    if (currentStep === 3 && !paymentMethod) { toast.error('Selecciona un método de pago.'); return; }
    // Ya no validamos tarjeta aquí porque está oculta
    // if (currentStep === 3 && paymentMethod === 'card') { ... }
    if (currentStep < totalSteps) setCurrentStep(prev => prev + 1);
  };

  const handleBack = () => { if (currentStep > 1) setCurrentStep(prev => prev - 1); };

  const handlePaymentMethodChange = (method: 'cash' /*| 'card'*/) => { // Solo 'cash' es visible
    setPaymentMethod(method);
    if (method === 'cash') {
      // Genera un número de recibo "único" para esta sesión
      const newReceipt = `REC-EF-${Date.now().toString().slice(-6)}`;
      setReceiptNumber(newReceipt);
      console.log("Generated Cash Receipt (not saved yet):", newReceipt);
    } else {
      // Esto no debería ocurrir si el botón de tarjeta está comentado, pero por si acaso
      setReceiptNumber(null);
    }
  };

  // --- Manejadores de Tarjeta (Comentados/Eliminados si no se usan) ---
  // const handleCardInputChange = (e: React.ChangeEvent<HTMLInputElement>) => { ... };
  // const handleCardFormSubmit = (e: React.FormEvent) => { ... };

  // --- Submit FINAL (Paso 4) ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("FINAL SUBMIT: Attempting. User:", currentUser, "Patient ID:", patientId, "Payment:", paymentMethod, "Reason:", formData.reason);

    if (!currentUser || !currentUser.id) { toast.error("Error de sesión de usuario."); return; }
    if (!patientId) { toast.error("Identificador de paciente no encontrado."); return; }
    if (!formData.pharmacyId || !formData.date || !formData.time || !formData.reason.trim()) { toast.error("Por favor, completa todos los campos de la cita (Farmacia, Fecha, Hora, Motivo)."); return; }
    if (!paymentMethod) { toast.error("Método de pago no seleccionado."); return; }
    if (paymentMethod === 'cash' && !receiptNumber) { toast.error("Error generando el número de recibo para efectivo."); console.error("Cash payment selected but receiptNumber is null"); return; } // Sanity check

    // 1. Preparar datos de la Cita (incluyendo motivo)
    const localDateStr = formData.date;
    const localTimeStr = formData.time;
    const apptDTLocal = new Date(`${localDateStr}T${localTimeStr}:00`);
    if (isNaN(apptDTLocal.getTime())) {
      toast.error("Fecha/hora inválida seleccionada.");
      console.error("Invalid date/time combination:", `${localDateStr}T${localTimeStr}:00`);
      return;
    }
    const isoToSave = apptDTLocal.toISOString(); // Guarda en UTC como es estándar
    console.log(`FINAL SUBMIT: Local DateTime: ${localDateStr} ${localTimeStr}, ISO UTC to save: ${isoToSave}`);

    const citaData = {
      horario_cita: isoToSave, // Guardar como timestamp with timezone
      dia_atencion: formData.date, // Guardar solo la fecha para facilitar consultas por día
      id_usuario: patientId, // Asegúrate que el TIPO coincida con la columna en Supabase (number, string/uuid?)
      id_farmacias: formData.pharmacyId,
      status: 'Activo', // O el estado inicial que prefieras
      motivo_cita: formData.reason.trim(), // <-- AÑADIDO MOTIVO
    };
    console.log("FINAL SUBMIT: Cita data:", citaData);

    const tIdSubmit = toast.loading("Agendando cita y registrando pago...");

    try {
      // 2. Insertar la Cita y obtener su ID
      const { data: insertedCitaData, error: insertError } = await supabase
        .from("citas")
        .insert([citaData])
        .select('id') // Solicita solo el ID de la fila insertada
        .single(); // Esperamos una sola fila de vuelta

      if (insertError) {
        if (insertError.code === '23505') { // Código de violación de unicidad (podría ser horario duplicado)
          toast.error("El horario seleccionado ya no está disponible. Por favor, elige otro.", { id: tIdSubmit });
        } else if (insertError.message.includes('foreign key constraint')) { // Error común si patientId o pharmacyId no existen
           toast.error("Error de referencia: Verifica los datos de paciente o farmacia.", { id: tIdSubmit });
           console.error("FK Constraint Error:", insertError);
        }
         else {
          throw insertError; // Relanza otros errores
        }
        return; // Detiene la ejecución si hubo error en la cita
      }

      // Verificación crucial: ¿Se obtuvo el ID de la cita?
      if (!insertedCitaData || !insertedCitaData.id) {
          console.error("Failed to retrieve inserted appointment ID.", insertedCitaData);
          throw new Error("No se pudo obtener el ID de la cita recién creada.");
      }

      const newCitaId = insertedCitaData.id;
      console.log("FINAL SUBMIT: Cita created successfully with ID:", newCitaId);

      // 3. Insertar en la tabla pago_e_cita (SIEMPRE después de crear la cita)
      const pagoData: PagoECita = {
        cita_id: newCitaId, // Usar el ID de la cita recién creada
        metodo_pago: paymentMethod, // 'cash' o 'card' (aunque card esté oculto)
        numero_recibo: paymentMethod === 'cash' ? receiptNumber : null,
        estado_pago: paymentMethod === 'cash' ? 'completado_efectivo' : 'tarjeta_pendiente', // O 'completado_tarjeta_simulada' si se usara
      };
      console.log("FINAL SUBMIT: Pago data:", pagoData);

      const { error: pagoError } = await supabase
        .from("pago_e_cita")
        .insert([pagoData]);

      if (pagoError) {
        // Error al guardar el pago, la cita ya existe. ¿Qué hacer?
        // Opción: Informar al usuario que la cita está agendada pero hubo un problema con el registro del pago.
        console.error("Submit Error - Payment insertion failed:", pagoError);
        toast.error(
          `¡Cita agendada (ID: ${newCitaId})! PERO hubo un error registrando el pago: ${pagoError.message}. Contacta soporte si es necesario.`,
          { id: tIdSubmit, duration: 10000 } // Mensaje más largo
        );
        // NO hacer rollback automático de la cita desde el cliente por complejidad.
        // Se podría marcar la cita con un estado especial o loguear para revisión manual.
      } else {
        // ¡Éxito en ambos inserts!
        console.log("FINAL SUBMIT: Payment record created successfully.");
        const successMsg = paymentMethod === 'cash'
          ? `¡Cita agendada! Tu Nº Recibo: ${receiptNumber}`
          : "¡Cita agendada!"; // Mensaje genérico si no es efectivo
        toast.success(successMsg, { id: tIdSubmit, duration: 6000 });
      }

      // 4. Limpiar estado y volver al paso 1 (independientemente del error de pago, la cita se creó)
      setFormData({ pharmacyId: null, date: '', time: '', reason: '' });
      setSelectedPharmacy(null);
      setAvailableTimes([]);
      setPaymentMethod(null);
      setReceiptNumber(null);
      // setCardDetails({ cardholderName: '', cardNumber: '', expiryDate: '', cvv: '' }); // Limpiar si se usara
      setCurrentStep(1);
      fetchUpcomingAppointments(); // Recargar la lista de citas

    } catch (error: any) {
      console.error("Submit Error - General catch block:", error);
      toast.error(`No se pudo completar el proceso: ${error.message || 'Error desconocido'}`, { id: tIdSubmit });
    }
  };


  // --- Lógica de Renderizado ---
  const renderStepContent = () => {
    switch (currentStep) {
       case 1: return ( /* ... (sin cambios) ... */ <div className="space-y-6"> <label htmlFor="pharmacyId" className="block text-sm font-medium text-gray-700"> <Building className="inline-block w-5 h-5 mr-2 align-text-bottom text-gray-500" /> Selecciona farmacia </label> {loadingPharmacies ? ( <div className="loading-msg">Cargando farmacias...</div> ) : ( <select id="pharmacyId" name="pharmacyId" value={formData.pharmacyId || ''} onChange={handleChange} className="input-std"> <option value="" disabled>-- Elige una opción --</option> {pharmacies.map((p) => ( <option key={p.id_farmacia} value={p.id_farmacia}>{p.nombre}</option> ))} </select> )} {selectedPharmacy && ( <div className="details-box"> <p><strong>Horario General:</strong> {selectedPharmacy.horario_atencion}</p> </div> )} </div> );
       case 2: return ( /* ... (sin cambios) ... */ <div className="space-y-8"> <div> <h4 className="h4-label"><Calendar className="icon-label" />Fecha</h4> <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-3"> {availableDates.map((d) => ( <label key={d.date} className={`date-label ${formData.date === d.date ? 'selected' : 'available'} ${d.isToday ? 'border-indigo-400' : ''}`} title={d.isToday ? "Hoy" : ""}> <input type="radio" name="date" value={d.date} checked={formData.date === d.date} onChange={handleChange} className="sr-only" /> <span className={`date-display ${formData.date === d.date ? 'selected' : ''} ${d.isToday ? 'font-semibold' : ''}`}>{d.display}</span> </label> ))} </div> </div> {formData.date && ( <div> <h4 className="h4-label"><Clock className="icon-label" />Hora</h4> <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3"> {!selectedPharmacy ? ( <div className="col-span-full empty-slot-msg">Selecciona farmacia primero.</div> ) : availableTimes.length > 0 ? ( availableTimes.map((t, i) => ( <label key={`${t}-${i}`} className={`time-label ${formData.time === t ? 'selected' : 'available'}`}> <input type="radio" name="time" value={t} checked={formData.time === t} onChange={handleChange} className="sr-only" /> <span>{t}</span> </label> )) ) : ( <div className="col-span-full empty-slot-msg">No hay horarios disponibles para esta fecha.</div> )} </div> </div> )} </div> );
       // *** PASO 3 MODIFICADO: PAGO (TARJETA COMENTADA) ***
       case 3: return (
           <div className="space-y-6">
               {/* Comentario Opcional de Beta */}
               {/* <div className="text-center p-4 border border-yellow-300 bg-yellow-50 rounded-md"> <AlertTriangle className="inline-block w-6 h-6 mr-2 text-yellow-600" /> <strong className="font-semibold text-yellow-800">EN TRABAJO - DEMOSTRACIÓN BETA V3</strong> <p className="text-sm text-yellow-700 mt-1">Esta sección de pagos es solo una simulación.</p> </div> */}
               <h4 className="h4-label"><CreditCard className="icon-label" />Método de Pago</h4>
               <div className="flex flex-col sm:flex-row gap-4">
                   {/* --- Botón Efectivo --- */}
                   <button type="button" onClick={() => handlePaymentMethodChange('cash')} className={`flex-1 p-4 border rounded-lg flex flex-col items-center justify-center transition-all duration-150 ${ paymentMethod === 'cash' ? 'border-green-500 bg-green-50 ring-2 ring-green-300' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50' }`}>
                       <DollarSign className={`w-8 h-8 mb-2 ${paymentMethod === 'cash' ? 'text-green-600' : 'text-gray-500'}`} />
                       <span className={`font-medium ${paymentMethod === 'cash' ? 'text-green-700' : 'text-gray-700'}`}>Efectivo</span>
                   </button>

                   {/* --- Botón Tarjeta (Comentado) ---
                   <button
                       type="button"
                       onClick={() => handlePaymentMethodChange('card')}
                       className={`flex-1 p-4 border rounded-lg flex flex-col items-center justify-center transition-all duration-150 ${
                           paymentMethod === 'card'
                               ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-300'
                               : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                       }`}
                   >
                       <CreditCard className={`w-8 h-8 mb-2 ${paymentMethod === 'card' ? 'text-blue-600' : 'text-gray-500'}`} />
                       <span className={`font-medium ${paymentMethod === 'card' ? 'text-blue-700' : 'text-gray-700'}`}>Tarjeta (Simulación)</span>
                   </button>
                    */}
               </div>

               {/* --- Mensaje para Efectivo --- */}
               {paymentMethod === 'cash' && (
                   <div className="p-4 bg-green-100 border border-green-300 rounded-md text-center">
                       <CheckCircle className="inline-block w-5 h-5 mr-2 text-green-600"/>
                       <span className="text-sm font-medium text-green-800">
                           Pago en efectivo seleccionado. Nº Recibo Temporal: <strong className="font-bold">{receiptNumber}</strong>
                       </span>
                       <p className="text-xs text-green-700 mt-1">Este recibo se confirmará al finalizar la cita. Preséntalo al llegar.</p>
                   </div>
               )}

               {/* --- Formulario de Tarjeta (Comentado) ---
               {paymentMethod === 'card' && (
                   <div className="w-full max-w-[450px] mx-auto bg-white rounded-[26px] shadow-[0px_12px_26px_rgba(0,0,0,0.1)] p-5 border">
                       <form onSubmit={handleCardFormSubmit} className="flex flex-col gap-5">
                           {/* ... (contenido del formulario de tarjeta comentado) ... *}
                       </form>
                   </div>
               )}
                */}
           </div>
       );
       // *** CASO 4: MOTIVO Y RESUMEN (Sin cambios funcionales, solo muestra datos) ***
       case 4: return ( <div className="space-y-6"> <div> <label htmlFor="reason" className="h4-label"><FileText className="icon-label" />Motivo de la Consulta</label> <textarea id="reason" name="reason" value={formData.reason} onChange={handleChange} rows={4} required className="input-std" placeholder="Describe brevemente el motivo de tu visita..." /> </div> <div className="summary-box"> <h4 className="summary-title">Confirmar Detalles de la Cita</h4> <div className="summary-item"><UserIcon className="summary-icon" /><p><strong className="font-medium">Paciente:</strong> {currentUser?.email || 'Usuario'}</p></div> <div className="summary-item"><Building className="summary-icon" /><p><strong className="font-medium">Farmacia:</strong> {selectedPharmacy?.nombre || 'N/A'}</p></div> <div className="summary-item"><Calendar className="summary-icon" /><p><strong className="font-medium">Fecha:</strong> {formData.date ? new Date(formData.date + 'T00:00:00Z').toLocaleDateString('es-ES', { timeZone:'UTC', /* Importante usar UTC aquí si date es YYYY-MM-DD */ year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}</p></div> <div className="summary-item"><Clock className="summary-icon" /><p><strong className="font-medium">Hora:</strong> { formData.time ? new Date(`1970-01-01T${formData.time}:00`).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: true }) : 'N/A' }</p></div> {/* Muestra el método seleccionado y el recibo si es efectivo */} <div className="summary-item"><CreditCard className="summary-icon" /><p><strong className="font-medium">Pago:</strong> {paymentMethod === 'cash' ? `Efectivo (Recibo: ${receiptNumber})` : paymentMethod === 'card' ? 'Tarjeta (Simulado)' : 'No seleccionado'}</p></div><div className="summary-item"><FileText className="summary-icon" /><p><strong className="font-medium">Motivo:</strong> {formData.reason || <span className="italic text-gray-500">(No especificado)</span>}</p></div> </div> </div> );
       default: return null;
    }
   };

  // --- Renderizado Principal ---
  if (loadingUser) return <div className="loading-msg">Verificando sesión...</div>;
  if (!currentUser) return ( <div className="login-prompt"><h3 className="login-title">Acceso Requerido</h3><p>Necesitas iniciar sesión para agendar citas.</p></div> );
  // Asegurarse de que patientId no sea solo null, sino también que tenga un valor si el usuario está logueado
  if (!patientId) return ( <div className="login-prompt"><h3 className="login-title">Registro Incompleto</h3><p>No se encontró un registro de paciente asociado a tu cuenta. Por favor, contacta a soporte.</p></div> );

  return (
    <div className="max-w-3xl mx-auto space-y-8 p-4 sm:p-6 lg:p-8">
      {/* <Toaster position="top-center" reverseOrder={false} /> Añadir si no está globalmente en App.tsx */}
      <div className="card-container">
         <div className="card-header"><h3 className="card-title">Agendar Nueva Cita</h3><p className="card-subtitle">¡Hola, {currentUser.email?.split('@')[0] || 'usuario'}!</p></div>
         <div className="step-indicator-container"><nav aria-label="Progress"><ol role="list" className="step-list">{[1, 2, 3, 4].map((step) => (<li key={step} className="flex-1">{step < currentStep ? (<div className="step completed"><span className="step-text">Paso {step}</span></div>) : step === currentStep ? (<div className="step current" aria-current="step"><span className="step-text">Paso {step}</span></div>) : (<div className="step upcoming"><span className="step-text">Paso {step}</span></div>)}</li>))}</ol></nav></div>
         {/* El onSubmit solo se activa en el último paso con el botón de tipo "submit" */}
         <form onSubmit={currentStep === totalSteps ? handleSubmit : (e) => e.preventDefault()} className="card-form">
             <div className="min-h-[300px]">{renderStepContent()}</div>
             <div className="card-footer">
                 <button type="button" onClick={handleBack} disabled={currentStep === 1} className="btn-secondary">Atrás</button>
                 {currentStep < totalSteps ? (
                     // El botón Siguiente avanza los pasos, no envía el formulario final
                     // No necesitamos lógica especial aquí ahora que la tarjeta está oculta
                     <button type="button" onClick={handleNext} className="btn-primary">Siguiente</button>
                 ) : (
                     // Solo en el último paso, este botón SÍ envía el formulario (type="submit")
                     <button type="submit" className="btn-confirm">Confirmar Cita</button>
                 )}
            </div>
         </form>
      </div>
      {/* --- Sección Mis Citas (Añadido motivo_cita si existe) --- */}
      <div className="card-container">
        <button onClick={() => setIsAppointmentsVisible(!isAppointmentsVisible)} className="accordion-button" aria-expanded={isAppointmentsVisible} aria-controls="upcoming-appointments-list"><div className="flex items-center"><List className="w-5 h-5 mr-3 text-gray-600" /><h4 className="accordion-title">Mis Próximas Citas</h4></div>{isAppointmentsVisible ? (<ChevronUp className="accordion-icon" />) : (<ChevronDown className="accordion-icon" />)}</button>
        {isAppointmentsVisible && (
          <div id="upcoming-appointments-list" className="accordion-content">
             {loadingAppointments ? (<div className="loading-msg">Cargando citas...</div>) : upcomingAppointments.length > 0 ? (<ul className="appointment-list">{upcomingAppointments.map((appt) => { let dD = 'N/A'; let dT = 'N/A'; let iV = false; if (appt.horario_cita) { try { const dU = new Date(appt.horario_cita); if (!isNaN(dU.getTime())) { iV = true; dD = dU.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }); dT = dU.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: true }); } } catch (e) { console.error("Err format date:", appt.horario_cita, e); } } return (<li key={appt.id} className="appointment-item"><div className="appt-icon-container"><Calendar className="appt-icon" /></div><div className="appt-details"><p className="appt-pharmacy">{appt.farmacias?.nombre || 'N/A'}</p><p className="appt-date">{dD}</p><p className="appt-time"><Clock className="inline-block w-4 h-4 mr-1 align-text-bottom"/>{dT}{appt.status && <span className={`status-badge status-${appt.status.toLowerCase().replace(' ','-')}`}>{appt.status}</span>}</p>{/* Mostrar motivo si existe */} {appt.motivo_cita && <p className="appt-reason text-sm text-gray-500 mt-1"><FileText className="inline-block w-4 h-4 mr-1 align-text-bottom"/>Motivo: {appt.motivo_cita}</p>}</div></li>);})}</ul>) : (<div className="empty-list-msg">No tienes citas programadas.</div>)}
          </div>
        )}
      </div>
      {/* Estilos (Añadido estilo para appt-reason si es necesario) */}
      <style jsx global>{`
        /* ... (Estilos existentes sin cambios) ... */
        .input-std { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #d1d5db; border-radius: 0.375rem; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); } .input-std:focus { outline: 2px solid transparent; outline-offset: 2px; border-color: #6366f1; --tw-ring-color: #6366f1; box-shadow: var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow); }
        .loading-msg { text-align: center; padding: 2.5rem; color: #6b7280; }
        .login-prompt { max-width: 36rem; margin: 2.5rem auto; padding: 1.5rem; background-color: white; border-radius: 0.5rem; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1); text-align: center; }
        .login-title { font-size: 1.125rem; font-weight: 600; color: #374151; margin-bottom: 1rem; } .login-prompt p { color: #4b5563; margin-bottom: 1.25rem; }
        .btn-primary { padding: 0.5rem 1rem; background-color: #4f46e5; color: white; border-radius: 0.375rem; font-weight: 500; transition: background-color 0.15s ease-in-out; display: inline-block; text-decoration: none; cursor: pointer; border: none;} .btn-primary:hover { background-color: #4338ca; } .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-secondary { padding: 0.5rem 1rem; background-color: white; color: #374151; border: 1px solid #d1d5db; border-radius: 0.375rem; font-weight: 500; transition: background-color 0.15s ease-in-out; cursor: pointer;} .btn-secondary:hover { background-color: #f9fafb; } .btn-secondary:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-confirm { padding: 0.5rem 1rem; background-color: #16a34a; color: white; border-radius: 0.375rem; font-weight: 500; transition: background-color 0.15s ease-in-out; cursor: pointer; border: none;} .btn-confirm:hover { background-color: #15803d; } .btn-confirm:disabled { opacity: 0.6; cursor: not-allowed; }
        .card-container { background-color: white; border-radius: 0.75rem; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1); overflow: hidden; margin-bottom: 2rem; /* Añadido margen inferior */ }
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
        .appointment-list { list-style: none; padding: 0; margin: 0; /* divide-y no funciona bien con React, mejor usar border-bottom */ padding-top: 1rem;} .appointment-item { display: flex; align-items: flex-start; gap: 1rem; padding-top: 1rem; padding-bottom: 1rem; border-bottom: 1px solid #e5e7eb; } .appointment-item:last-child { border-bottom: none; } /* Evita doble borde */ .appt-icon-container { flex-shrink: 0; width: 2.5rem; height: 2.5rem; border-radius: 9999px; background-color: #e0e7ff; display: flex; align-items: center; justify-content: center; } .appt-icon { width: 1.25rem; height: 1.25rem; color: #4f46e5; } .appt-details { flex: 1; min-width: 0; } .appt-pharmacy { font-size: 0.875rem; font-weight: 500; color: #111827; } .appt-date { font-size: 0.875rem; color: #6b7280; } .appt-time { font-size: 0.875rem; color: #6b7280; }
        .status-badge { margin-left: 0.5rem; display: inline-flex; align-items: center; padding: 0.125rem 0.625rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 500; } .status-activo { background-color: #dbeafe; color: #1e40af; } .status-en-consulta { background-color: #fef9c3; color: #854d0e; } .status-terminada { background-color: #d1fae5; color: #065f46; }
        .empty-list-msg { text-align: center; padding: 1.5rem; color: #6b7280; } .details-box { font-size: 0.875rem; color: #4b5563; background-color: #f9fafb; padding: 0.75rem; border-radius: 0.375rem; border: 1px solid #e5e7eb; }
        /* Estilo opcional para el motivo en la lista de citas */
        .appt-reason { font-style: italic; }
        /* Estilos específicos para inputs del form de tarjeta (ya no necesarios si está comentado) */
        /* ... */
      `}</style>
    </div>
  );
};

export default AppointmentScheduler;
