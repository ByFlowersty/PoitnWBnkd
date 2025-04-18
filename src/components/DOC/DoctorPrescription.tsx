import React, { useState, useEffect, ChangeEvent, FormEvent, useCallback, useRef } from 'react';
import { User } from '@supabase/supabase-js';
import  supabase  from '../../lib/supabaseClient'; // Ajusta la ruta según tu proyecto

// --- Interfaces ---
interface Patient {
    id: string; user_id?: string | null; name: string; date_of_birth?: string | null; gender?: string | null; email?: string | null; phone?: string | null; address?: string | null; emergency_contact?: string | null; blood_type?: string | null; allergies?: string | null; profile_image?: string | null; frecuencia_cardiaca?: number | null; frecuencia_respiratoria?: number | null; temperatura_corporal?: number | null; tension_arterial?: string | null; altura?: number | null; talla?: string | null; peso?: number | null; edad?: number | null; correo_electronico?: string | null; nombre_completo?: string | null; proxima_consulta?: string | null; ultima_consulta?: string | null; tag_rfid?: string | null; vector_facial?: any | null; doctor_id?: string | null; created_at?: string | null; updated_at?: string | null; surecode?: string | null; emocion_registro?: string | null;
}
interface Trabajador {
    id: string; user_id: string; nombre: string; telefono?: string | null; email?: string | null; cedula_prof?: string | null; especialidad?: string | null; id_farmacia: number; rol: string; key_lux?: string | null; "CedulaProf"?: string | null; created_at?: string | null;
}
interface Cita {
    id: number; horario_cita: string; dia_atencion: string; id_usuario: string; created_at: string; last_updated_at: string; id_farmacias: number; status?: 'Activo' | 'En consulta' | 'Terminada' | null; patients?: { name: string } | null;
}
interface Medicamento {
    nombre: string; dosis: string; frecuencia: string; duracion: string;
}
interface RecetaBase {
    paciente_id: string; doctor_id: string; fecha_consulta: string; proxima_consulta?: string | null; medicamentos: Medicamento[]; indicaciones: string; farmacia?: string | null; diagnostico: string; descargable?: boolean | null; frecuencia_cardiaca?: number | null; frecuencia_respiratoria?: number | null; temperatura_corporal?: number | null; tension_arterial?: string | null; peso?: number | null; altura?: number | null; blood_type?: string | null; allergies?: string | null; motivo_consulta: string; antecedentes?: string | null; exploracion_fisica?: string | null; plan_tratamiento?: string | null; recomendaciones?: string | null; observaciones?: string | null;
}
interface RecetaInsert extends RecetaBase {}

// *** Interfaz RecetaHistorial CORREGIDA ***
interface RecetaHistorial extends Omit<RecetaBase,
    'doctor_id' | 'paciente_id' | 'farmacia' | 'indicaciones' | 'descargable' |
    'motivo_consulta' | 'antecedentes' | 'exploracion_fisica' | 'plan_tratamiento' |
    'recomendaciones' | 'observaciones' | 'frecuencia_cardiaca' | 'frecuencia_respiratoria' |
    'temperatura_corporal' | 'tension_arterial' | 'peso' | 'altura' | 'blood_type' |
    'allergies' | 'proxima_consulta'
> {
    id: string;
    fecha_emision: string;
    // fecha_consulta, diagnostico, medicamentos vienen de RecetaBase
    trabajadores?: { nombre: string } | null;
}

// --- Estado Inicial del Formulario ---
const initialPrescriptionState: Omit<RecetaInsert, 'doctor_id' | 'farmacia' | 'paciente_id'> = {
    fecha_consulta: new Date().toISOString().split('T')[0], proxima_consulta: null, medicamentos: [], indicaciones: '', diagnostico: '', motivo_consulta: '', frecuencia_cardiaca: null, frecuencia_respiratoria: null, temperatura_corporal: null, tension_arterial: '', peso: null, altura: null, blood_type: '', allergies: '', antecedentes: '', exploracion_fisica: '', plan_tratamiento: '', recomendaciones: '', observaciones: '', descargable: true,
};
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

// --- Componente Principal ---
const DoctorPrescription: React.FC = () => {
    // --- Estados ---
    const [loadingState, setLoadingState] = useState({ initial: true, patient: false });
    const [isRefreshingAppointments, setIsRefreshingAppointments] = useState<boolean>(false);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [authUser, setAuthUser] = useState<User | null>(null);
    const [doctor, setDoctor] = useState<Trabajador | null>(null);
    const [appointments, setAppointments] = useState<Cita[]>([]);
    const [selectedAppointmentId, setSelectedAppointmentId] = useState<number | null>(null);
    const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
    const [prescriptionData, setPrescriptionData] = useState<RecetaInsert>({ ...initialPrescriptionState, paciente_id: '', doctor_id: '', farmacia: '', });
    const [showRefreshReminder, setShowRefreshReminder] = useState<boolean>(false);
    const [isCarnetVisible, setIsCarnetVisible] = useState<boolean>(false);
    const [prescriptionHistory, setPrescriptionHistory] = useState<RecetaHistorial[]>([]);
    const [isFetchingHistory, setIsFetchingHistory] = useState<boolean>(false);
    const [historyError, setHistoryError] = useState<string | null>(null);

    // --- Refs ---
    const isMountedRef = useRef(true);
    const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

    // --- Funciones Auxiliares ---
    const getTodayDateString = () => new Date().toISOString().split('T')[0];
    const formatDate = (dateString: string | null | undefined) => {
        if (!dateString) return 'N/A';
        try { return new Date(dateString).toLocaleString('es-MX', { year: 'numeric', month: 'short', day: 'numeric', /* hour: '2-digit', minute: '2-digit' */ }); } catch { return dateString; }
    };

    // --- Funciones Fetch ---
    const fetchAppointmentsData = useCallback(async (pharmacyId: number, isInitialLoad = false) => {
        if (!isMountedRef.current) return;
        if (!isInitialLoad) { setIsRefreshingAppointments(true); setShowRefreshReminder(false); }
        else { setLoadingState(prev => ({ ...prev, initial: true })); }
        setError(null); const today = getTodayDateString(); console.log(`FETCHING appointments for pharmacy ${pharmacyId} on ${today} (Initial: ${isInitialLoad})`);
        try {
            const { data: citasData, error: citasError } = await supabase.from('citas').select(`id, horario_cita, dia_atencion, id_usuario, id_farmacias, status, patients ( name )`).eq('id_farmacias', pharmacyId).eq('dia_atencion', today).order('horario_cita', { ascending: true });
            if (!isMountedRef.current) return; if (citasError) { throw citasError; }
            console.log("Appointments fetched successfully:", citasData); setAppointments(citasData as Cita[]);
        } catch (err: any) { console.error("Error during fetchAppointmentsData:", err); if (isMountedRef.current) { setError(`Error al cargar citas: ${err.message}.`); setAppointments([]); } }
        finally { if (isMountedRef.current) { console.log(`FINALLY block for fetchAppointmentsData (Initial: ${isInitialLoad})`); if (isInitialLoad) { setLoadingState(prev => ({ ...prev, initial: false })); console.log(">>> Set loadingState.initial to false"); } else { setIsRefreshingAppointments(false); } } else { console.log("Component unmounted before finally."); } }
    }, [setAppointments, setError, setLoadingState, setIsRefreshingAppointments]);

    const fetchPrescriptionHistory = useCallback(async (patientId: string) => {
        if (!isMountedRef.current) return;
        setIsFetchingHistory(true); setHistoryError(null); setPrescriptionHistory([]); console.log(`Fetching prescription history for patient ${patientId}`);
        try {
            const { data, error } = await supabase.from('recetas').select(`id, fecha_consulta, diagnostico, medicamentos, fecha_emision, trabajadores ( nombre )`).eq('paciente_id', patientId).order('fecha_consulta', { ascending: false });
             if (!isMountedRef.current) return; if (error) { throw error; }
            console.log("Prescription history fetched:", data); setPrescriptionHistory(data as RecetaHistorial[]);
        } catch (err: any) { console.error("Error fetching prescription history:", err); if (isMountedRef.current) setHistoryError(`Error al cargar historial: ${err.message}`); }
        finally { if (isMountedRef.current) setIsFetchingHistory(false); }
    }, [setHistoryError, setIsFetchingHistory, setPrescriptionHistory]);

    const fetchPatientDetails = useCallback(async (patientId: string) => {
        if (!isMountedRef.current) return;
        setLoadingState(prev => ({ ...prev, patient: true })); setError(null); console.log(`Fetching details for patient ${patientId}`);
        try {
            const { data: patientData, error: patientError } = await supabase.from('patients').select('*').eq('id', patientId).single();
            if (!isMountedRef.current) return; if (patientError) { throw patientError; }
            console.log("Patient details fetched:", patientData); setSelectedPatient(patientData as Patient);
            setPrescriptionData(prev => ({ ...initialPrescriptionState, doctor_id: prev.doctor_id, farmacia: prev.farmacia, paciente_id: patientData.id, fecha_consulta: getTodayDateString(), blood_type: patientData.blood_type ?? '', allergies: patientData.allergies ?? '', peso: patientData.peso ?? null, altura: patientData.altura ?? null, }));
        } catch (err: any) { console.error('Error fetching patient details:', err); if (isMountedRef.current) { setError(`Error al cargar datos paciente: ${err.message}.`); setSelectedPatient(null); setPrescriptionData(prev => ({ ...initialPrescriptionState, doctor_id: prev.doctor_id, farmacia: prev.farmacia, paciente_id: '' })); } }
        finally { if (isMountedRef.current) setLoadingState(prev => ({ ...prev, patient: false })); }
    }, [setError, setLoadingState, setSelectedPatient, setPrescriptionData]);

    // --- Efectos ---
    useEffect(() => { // Auth/Doctor
        isMountedRef.current = true; setError(null); setLoadingState({ initial: true, patient: false });
        const fetchDoctorData = async (user: User) => { if (!isMountedRef.current) return; console.log("Fetching doctor data for:", user.id); try { const { data: dD, error: dE } = await supabase.from('trabajadores').select('*').eq('user_id', user.id).single(); if (!isMountedRef.current) return; if (dE) { throw dE; } if (dD && dD.rol === 'Doctor') { console.log("Doctor found:", dD.id); setDoctor(dD as Trabajador); setPrescriptionData(prev => ({...initialPrescriptionState, doctor_id: dD.id, farmacia: dD.id_farmacia.toString(), paciente_id: '' })); } else { throw new Error("Usuario no es Doctor o no encontrado."); } } catch (err: any) { console.error('Error fetching doctor data:', err); if (isMountedRef.current) { setError(`Error doctor: ${err.message}`); setDoctor(null); setLoadingState(prev => ({ ...prev, initial: false })); } } };
        supabase.auth.getSession().then(({ data: { session } }) => { if (!isMountedRef.current) return; if (session?.user) { setAuthUser(session.user); fetchDoctorData(session.user); } else { setError("No hay sesión."); setLoadingState({ initial: false, patient: false }); } });
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { if (!isMountedRef.current) return; const cU = session?.user ?? null; setAuthUser(cU); setDoctor(null); setAppointments([]); setSelectedAppointmentId(null); setSelectedPatient(null); setShowRefreshReminder(false); setIsCarnetVisible(false); setLoadingState({ initial: true, patient: false }); if (cU) { fetchDoctorData(cU); } else { setError("Sesión cerrada."); setLoadingState({ initial: false, patient: false }); } });
        return () => { isMountedRef.current = false; subscription?.unsubscribe(); if (refreshTimerRef.current) { clearInterval(refreshTimerRef.current); } };
    }, []);

    useEffect(() => { // Carga Inicial Citas
        if (doctor?.id_farmacia && loadingState.initial && isMountedRef.current) { console.log(`TRIGGERING initial appointments fetch...`); fetchAppointmentsData(doctor.id_farmacia, true); }
        else { console.log(`SKIPPING initial appointments fetch...`); }
    }, [doctor?.id_farmacia, fetchAppointmentsData]); // Quitado loadingState.initial de aquí

    useEffect(() => { // Timer
        if (refreshTimerRef.current) { clearInterval(refreshTimerRef.current); refreshTimerRef.current = null; }
        if (doctor && isMountedRef.current) { console.log("Starting timer."); refreshTimerRef.current = setInterval(() => { if (isMountedRef.current) { console.log("Timer triggered."); setShowRefreshReminder(true); } else if(refreshTimerRef.current) { clearInterval(refreshTimerRef.current); } }, REFRESH_INTERVAL_MS); }
    }, [doctor]);

    useEffect(() => { // Cargar Paciente
         if (selectedAppointmentId) { const sC = appointments.find(c => c.id === selectedAppointmentId); if (sC?.id_usuario) { if (!selectedPatient || selectedPatient.id !== sC.id_usuario) { fetchPatientDetails(sC.id_usuario); } } else { setSelectedPatient(null); setPrescriptionData(prev => ({ ...initialPrescriptionState, doctor_id: prev.doctor_id, farmacia: prev.farmacia, paciente_id: '' })); } }
         else { if (selectedPatient) { setSelectedPatient(null); setPrescriptionData(prev => ({ ...initialPrescriptionState, doctor_id: prev.doctor_id, farmacia: prev.farmacia, paciente_id: '' })); } }
    }, [selectedAppointmentId, appointments, fetchPatientDetails, selectedPatient]);

    // --- Handlers ---
    const handleSelectAppointment = (citaId: number) => { if (loadingState.patient || isRefreshingAppointments) return; const tA = appointments.find(c => c.id === citaId); if (tA?.status === 'Terminada' || citaId === selectedAppointmentId) return; if (isCarnetVisible) { setIsCarnetVisible(false); setPrescriptionHistory([]); setHistoryError(null); } setSelectedAppointmentId(citaId); };
    const handleRefreshAppointments = () => { if (doctor?.id_farmacia && !isRefreshingAppointments && isMountedRef.current) { fetchAppointmentsData(doctor.id_farmacia, false); } };
    const dismissRefreshReminder = () => { setShowRefreshReminder(false); };
    const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => { const { name, value, type } = e.target; const isNum = ['frecuencia_cardiaca', 'frecuencia_respiratoria', 'temperatura_corporal', 'peso', 'altura'].includes(name); const pVal = isNum ? (value === '' ? null : parseFloat(value)) : (type === 'checkbox' ? (e.target as HTMLInputElement).checked : value); setPrescriptionData(prev => ({ ...prev, [name]: pVal, })); };
    const handleMedicamentoChange = (index: number, field: keyof Medicamento, value: string) => { const uM = [...prescriptionData.medicamentos]; uM[index] = { ...uM[index], [field]: value }; setPrescriptionData(prev => ({ ...prev, medicamentos: uM })); };
    const addMedicamento = () => { setPrescriptionData(prev => ({ ...prev, medicamentos: [...prev.medicamentos, { nombre: '', dosis: '', frecuencia: '', duracion: '' }] })); };
    const removeMedicamento = (index: number) => { setPrescriptionData(prev => ({ ...prev, medicamentos: prev.medicamentos.filter((_, i) => i !== index) })); };
    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); if (!selectedPatient || !doctor || isSubmitting || loadingState.patient) { setError("Verifica selección, campos y carga."); return; } if (prescriptionData.medicamentos.length === 0) { setError("Añade al menos un medicamento."); return; } setIsSubmitting(true); setError(null); const fRD: RecetaInsert = { ...prescriptionData, paciente_id: selectedPatient.id, doctor_id: doctor.id, farmacia: doctor.id_farmacia.toString(), proxima_consulta: prescriptionData.proxima_consulta || null, frecuencia_cardiaca: prescriptionData.frecuencia_cardiaca || null, frecuencia_respiratoria: prescriptionData.frecuencia_respiratoria || null, temperatura_corporal: prescriptionData.temperatura_corporal || null, peso: prescriptionData.peso || null, altura: prescriptionData.altura || null, }; console.log("Submitting prescription:", fRD); try { const { data, error: iE } = await supabase.from('recetas').insert([fRD]).select().single(); if (iE) throw iE; console.log("Prescription created:", data); alert(`Receta creada con éxito! ID: ${data?.id}`); if (selectedAppointmentId) { const { error: uCE } = await supabase.from('citas').update({ status: 'Terminada', last_updated_at: new Date().toISOString() }).eq('id', selectedAppointmentId); if (uCE) console.warn("Error actualizando cita:", uCE); else { setAppointments(prev => prev.map(c => c.id === selectedAppointmentId ? { ...c, status: 'Terminada' } : c)); setSelectedAppointmentId(null); } } else { setSelectedAppointmentId(null); } } catch (err: any) { console.error('Error creating prescription:', err); setError(`Error al crear la receta: ${err.message}.`); } finally { setIsSubmitting(false); } };
    const handleOpenCarnet = () => { if (selectedPatient?.id && !isFetchingHistory) { setIsCarnetVisible(true); fetchPrescriptionHistory(selectedPatient.id); } };
    const handleCloseCarnet = () => { setIsCarnetVisible(false); setPrescriptionHistory([]); setHistoryError(null); };

    // --- Renderizado ---
    if (loadingState.initial) { return <div className="flex justify-center items-center h-screen text-xl font-semibold">Cargando datos iniciales...</div>; }
    if (!authUser) { return <div className="flex justify-center items-center h-screen text-xl text-red-600 font-semibold">{error || "Por favor, inicia sesión."}</div>; }
    if (!doctor) { return <div className="flex justify-center items-center h-screen text-xl text-red-600 font-semibold">{error || "No se pudo cargar info del doctor."}</div>; }

     return (
        <div className="flex h-screen bg-gray-100 relative">
            {/* Sidebar */}
            <aside className="w-64 lg:w-72 bg-white border-r border-gray-200 flex flex-col">
                 <div className="p-4 border-b border-gray-200 flex justify-between items-center"><div><h3 className="text-lg font-semibold text-gray-800">Citas ({new Date().toLocaleDateString()})</h3>{doctor && <p className="text-sm text-gray-500">Farmacia: #{doctor.id_farmacia}</p>}</div><button onClick={handleRefreshAppointments} disabled={isRefreshingAppointments || loadingState.initial} className={`p-1.5 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 transition-all duration-150 ${ isRefreshingAppointments || loadingState.initial ? 'bg-gray-200 text-gray-400 cursor-wait' : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-600' }`} title="Actualizar lista">{isRefreshingAppointments ? ( <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> ) : ( <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 00-15.357-2m15.357 2H15" /></svg> )}</button></div>
                 {showRefreshReminder && ( <div className="p-2 bg-yellow-100 border-b border-yellow-300 text-yellow-800 text-xs flex justify-between items-center animate-pulse"><span>¡Recarga la fila!</span><button onClick={dismissRefreshReminder} className="p-0.5 rounded hover:bg-yellow-200 focus:outline-none"><svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button></div> )}
                 <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {isRefreshingAppointments && appointments.length === 0 && <p className="text-gray-500 p-2">Actualizando...</p> }
                    {!loadingState.initial && !isRefreshingAppointments && appointments.length === 0 && <p className="text-gray-500 p-2">No hay citas para hoy.</p>}
                    {appointments.map((cita) => { const isFinished = cita.status === 'Terminada'; const isSelected = cita.id === selectedAppointmentId; const isLoadingPatient = loadingState.patient && isSelected; return ( <div key={cita.id} className={`p-3 rounded-md transition-colors duration-150 relative ${ isFinished ? 'opacity-60 bg-gray-100 cursor-not-allowed' : isLoadingPatient ? 'opacity-50 cursor-wait' : isSelected ? 'bg-indigo-100 border border-indigo-300 cursor-default' : 'bg-white hover:bg-gray-50 border border-transparent cursor-pointer' }`} onClick={() => !isFinished && handleSelectAppointment(cita.id)} title={isFinished ? "Consulta terminada" : `Seleccionar cita de ${cita.patients?.name ?? ''}`}> {isLoadingPatient && ( <div className="absolute inset-0 flex justify-center items-center bg-white bg-opacity-50 rounded-md"><svg className="animate-spin h-5 w-5 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75"></path></svg></div> )} <div className="flex justify-between items-center"><span className="font-medium text-gray-700">{new Date(cita.horario_cita).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ cita.status === 'Activo' ? 'bg-green-100 text-green-800' : cita.status === 'En consulta' ? 'bg-yellow-100 text-yellow-800' : cita.status === 'Terminada' ? 'bg-gray-200 text-gray-600' : 'bg-gray-100 text-gray-500' }`}>{cita.status ?? 'Pend.'}</span></div><p className="text-sm text-gray-600 mt-1 truncate">{cita.patients?.name ?? 'Paciente Desc..'}</p> </div> );})}
                 </div>
                 {error && error.includes("citas") && <p className="p-4 text-sm text-red-600">{error}</p>}
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto p-6 lg:p-8 relative">
                {error && !error.includes("citas") && ( <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert"><strong className="font-bold">Error: </strong><span className="block sm:inline">{error}</span></div> )}
                {!selectedPatient && !loadingState.patient && ( <div className="text-center text-gray-500 mt-10"><svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg><p className="mt-2">Selecciona una cita.</p></div> )}

                {(selectedPatient || loadingState.patient) && (
                    <div className={`max-w-4xl mx-auto transition-opacity duration-300 ${loadingState.patient ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                        {loadingState.patient && ( <div className="absolute top-4 right-4 p-2 bg-gray-200 rounded-md text-sm text-gray-700 z-10">Cargando paciente...</div> )}
                        <div className="bg-white shadow sm:rounded-lg mb-6">
                             <div className="px-4 py-5 sm:px-6 flex justify-between items-center"><div><h3 className="text-lg leading-6 font-medium text-gray-900">Información Paciente</h3><p className="mt-1 max-w-2xl text-sm text-gray-500">Detalles básicos.</p></div>{selectedPatient && ( <button onClick={handleOpenCarnet} disabled={isFetchingHistory} className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-cyan-600 hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"><svg xmlns="http://www.w3.org/2000/svg" className="-ml-0.5 mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" /></svg>Ver Carnet</button> )}</div>
                             <div className="border-t border-gray-200 px-4 py-5 sm:p-0"><dl className="sm:divide-y sm:divide-gray-200"><div className="py-3 sm:py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6"><dt className="text-sm font-medium text-gray-500">Nombre</dt><dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{selectedPatient?.name ?? '...'}</dd></div><div className="py-3 sm:py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6"><dt className="text-sm font-medium text-gray-500">Tipo Sangre</dt><dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{selectedPatient?.blood_type || '...'}</dd></div><div className="py-3 sm:py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6"><dt className="text-sm font-medium text-gray-500">Alergias</dt><dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{selectedPatient?.allergies || '...'}</dd></div></dl></div>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-6 bg-white shadow px-4 py-5 sm:rounded-lg sm:p-6">
                             <fieldset disabled={loadingState.patient || isSubmitting}><h3 className="text-lg font-medium leading-6 text-gray-900">Crear/Editar Receta</h3><hr/>
                                <div><h4 className="text-md font-medium text-gray-700 mb-3">Signos Vitales</h4><div className="grid grid-cols-1 gap-y-4 gap-x-4 sm:grid-cols-2 lg:grid-cols-3"><div><label htmlFor="frecuencia_cardiaca" className="block text-sm font-medium text-gray-700">Frec. Cardíaca (lpm)</label><input type="number" name="frecuencia_cardiaca" id="frecuencia_cardiaca" value={prescriptionData.frecuencia_cardiaca ?? ''} onChange={handleInputChange} className="input-style" /></div><div><label htmlFor="frecuencia_respiratoria" className="block text-sm font-medium text-gray-700">Frec. Respiratoria (rpm)</label><input type="number" name="frecuencia_respiratoria" id="frecuencia_respiratoria" value={prescriptionData.frecuencia_respiratoria ?? ''} onChange={handleInputChange} className="input-style" /></div><div><label htmlFor="temperatura_corporal" className="block text-sm font-medium text-gray-700">Temp. Corporal (°C)</label><input type="number" step="0.1" name="temperatura_corporal" id="temperatura_corporal" value={prescriptionData.temperatura_corporal ?? ''} onChange={handleInputChange} className="input-style" /></div><div><label htmlFor="tension_arterial" className="block text-sm font-medium text-gray-700">Tensión Arterial (mmHg)</label><input type="text" name="tension_arterial" id="tension_arterial" placeholder="Ej: 120/80" value={prescriptionData.tension_arterial ?? ''} onChange={handleInputChange} className="input-style" /></div><div><label htmlFor="peso" className="block text-sm font-medium text-gray-700">Peso (kg)</label><input type="number" step="0.1" name="peso" id="peso" value={prescriptionData.peso ?? ''} onChange={handleInputChange} className="input-style" /></div><div><label htmlFor="altura" className="block text-sm font-medium text-gray-700">Altura (cm)</label><input type="number" name="altura" id="altura" value={prescriptionData.altura ?? ''} onChange={handleInputChange} className="input-style" /></div></div></div><hr/>
                                <div><h4 className="text-md font-medium text-gray-700 mb-3">Detalles Consulta</h4><div><label htmlFor="motivo_consulta" className="block text-sm font-medium text-gray-700">Motivo de Consulta (*)</label><textarea id="motivo_consulta" name="motivo_consulta" rows={3} value={prescriptionData.motivo_consulta} onChange={handleInputChange} required className="textarea-style"></textarea></div><div className="mt-4"><label htmlFor="antecedentes" className="block text-sm font-medium text-gray-700">Antecedentes Relevantes</label><textarea id="antecedentes" name="antecedentes" rows={3} value={prescriptionData.antecedentes ?? ''} onChange={handleInputChange} className="textarea-style"></textarea></div><div className="mt-4"><label htmlFor="exploracion_fisica" className="block text-sm font-medium text-gray-700">Exploración Física</label><textarea id="exploracion_fisica" name="exploracion_fisica" rows={3} value={prescriptionData.exploracion_fisica ?? ''} onChange={handleInputChange} className="textarea-style"></textarea></div><div className="mt-4"><label htmlFor="diagnostico" className="block text-sm font-medium text-gray-700">Diagnóstico (*)</label><textarea id="diagnostico" name="diagnostico" rows={3} value={prescriptionData.diagnostico} onChange={handleInputChange} required className="textarea-style"></textarea></div></div><hr/>
                                <div><h4 className="text-md font-medium text-gray-700 mb-1">Medicamentos (*)</h4> {prescriptionData.medicamentos.length === 0 && !isSubmitting && (<p className="text-sm text-yellow-600">Añade al menos un medicamento.</p>)}<div className="space-y-3 mt-3">{prescriptionData.medicamentos.map((med, index) => (<div key={index} className="p-3 border border-gray-200 rounded-md bg-gray-50"><div className="grid grid-cols-1 gap-y-3 gap-x-4 sm:grid-cols-2 lg:grid-cols-5 items-end"><div className="lg:col-span-2"><label htmlFor={`med-nombre-${index}`} className="block text-xs font-medium text-gray-600">Nombre</label><input type="text" id={`med-nombre-${index}`} value={med.nombre} onChange={(e) => handleMedicamentoChange(index, 'nombre', e.target.value)} required className="input-style-sm" /></div><div><label htmlFor={`med-dosis-${index}`} className="block text-xs font-medium text-gray-600">Dosis</label><input type="text" id={`med-dosis-${index}`} value={med.dosis} onChange={(e) => handleMedicamentoChange(index, 'dosis', e.target.value)} required className="input-style-sm" /></div><div><label htmlFor={`med-frecuencia-${index}`} className="block text-xs font-medium text-gray-600">Frecuencia</label><input type="text" id={`med-frecuencia-${index}`} value={med.frecuencia} onChange={(e) => handleMedicamentoChange(index, 'frecuencia', e.target.value)} required className="input-style-sm" /></div><div className="flex items-end space-x-2"><div className="flex-1"><label htmlFor={`med-duracion-${index}`} className="block text-xs font-medium text-gray-600">Duración</label><input type="text" id={`med-duracion-${index}`} value={med.duracion} onChange={(e) => handleMedicamentoChange(index, 'duracion', e.target.value)} required className="input-style-sm" /></div><button type="button" onClick={() => removeMedicamento(index)} className="inline-flex items-center p-1.5 border border-transparent rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500" title="Eliminar medicamento"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button></div></div></div>))}</div><button type="button" onClick={addMedicamento} className="mt-3 inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"><svg xmlns="http://www.w3.org/2000/svg" className="-ml-0.5 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>Añadir Medicamento</button></div><hr/>
                                <div><h4 className="text-md font-medium text-gray-700 mb-3">Indicaciones y Seguimiento</h4><div><label htmlFor="indicaciones" className="block text-sm font-medium text-gray-700">Indicaciones Generales (*)</label><textarea id="indicaciones" name="indicaciones" rows={4} value={prescriptionData.indicaciones} onChange={handleInputChange} required className="textarea-style"></textarea></div><div className="mt-4"><label htmlFor="plan_tratamiento" className="block text-sm font-medium text-gray-700">Plan de Tratamiento Adicional</label><textarea id="plan_tratamiento" name="plan_tratamiento" rows={3} value={prescriptionData.plan_tratamiento ?? ''} onChange={handleInputChange} className="textarea-style"></textarea></div><div className="mt-4"><label htmlFor="recomendaciones" className="block text-sm font-medium text-gray-700">Recomendaciones</label><textarea id="recomendaciones" name="recomendaciones" rows={3} value={prescriptionData.recomendaciones ?? ''} onChange={handleInputChange} className="textarea-style"></textarea></div><div className="mt-4"><label htmlFor="observaciones" className="block text-sm font-medium text-gray-700">Observaciones</label><textarea id="observaciones" name="observaciones" rows={3} value={prescriptionData.observaciones ?? ''} onChange={handleInputChange} className="textarea-style"></textarea></div><div className="mt-4"><label htmlFor="proxima_consulta" className="block text-sm font-medium text-gray-700">Próxima Consulta (Opcional)</label><input type="date" id="proxima_consulta" name="proxima_consulta" value={prescriptionData.proxima_consulta ?? ''} min={prescriptionData.fecha_consulta} onChange={handleInputChange} className="input-style" /></div></div>
                                <div className="pt-5"><div className="flex justify-end"><button type="submit" disabled={loadingState.patient || isSubmitting || prescriptionData.medicamentos.length === 0} className={`ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white ${ (loadingState.patient || isSubmitting || prescriptionData.medicamentos.length === 0) ? 'bg-indigo-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500' }`}>{isSubmitting ? 'Guardando...' : 'Crear/Actualizar Receta'}</button></div>{isSubmitting && <p className="text-sm text-gray-500 mt-2 text-right">Enviando datos...</p>}</div>
                             </fieldset>
                        </form>
                    </div>
                )}
            </main>

            {/* Modal Carnet */}
            {isCarnetVisible && (
                <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity z-40 flex justify-center items-start pt-10 px-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col my-auto">
                        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-10"><h3 className="text-xl font-semibold text-gray-800">Carnet de Recetas: {selectedPatient?.name ?? 'Paciente'}</h3><button onClick={handleCloseCarnet} className="p-1 rounded-full text-gray-400 hover:bg-gray-200 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"><span className="sr-only">Cerrar</span><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button></div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {isFetchingHistory && ( <div className="text-center py-10"><svg className="animate-spin h-8 w-8 text-indigo-600 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75"></path></svg><p className="mt-2 text-gray-500">Cargando historial...</p></div> )}
                            {historyError && ( <div className="text-center py-10 text-red-600"><p>{historyError}</p></div> )}
                            {!isFetchingHistory && !historyError && prescriptionHistory.length === 0 && ( <div className="text-center py-10 text-gray-500"><p>No hay recetas anteriores registradas.</p></div> )}
                            {!isFetchingHistory && !historyError && prescriptionHistory.length > 0 && (
                                <ul className="divide-y divide-gray-200">
                                    {prescriptionHistory.map((receta) => (
                                        <li key={receta.id} className="py-5"><div className="grid grid-cols-1 lg:grid-cols-12 gap-x-6 gap-y-3">
                                            <div className="lg:col-span-3 text-sm text-gray-600 space-y-1"><p><strong className="text-gray-800">Fecha Consulta:</strong><br/> {formatDate(receta.fecha_consulta)}</p><p><strong className="text-gray-800">Emitida:</strong><br/> {formatDate(receta.fecha_emision)}</p><p><strong className="text-gray-800">Doctor:</strong><br/> {receta.trabajadores?.nombre ?? 'N/A'}</p></div>
                                            <div className="lg:col-span-9 space-y-3"><div><p className="text-sm font-semibold text-gray-800 mb-1">Diagnóstico:</p><p className="text-sm text-gray-700 bg-gray-50 p-3 rounded border border-gray-200 whitespace-pre-wrap">{receta.diagnostico || <span className="italic text-gray-400">No especificado</span>}</p></div><div><p className="text-sm font-semibold text-gray-800 mb-1">Medicamentos:</p>{(Array.isArray(receta.medicamentos) && receta.medicamentos.length > 0) ? ( <ul className="list-disc list-inside space-y-1.5 pl-4 text-sm text-gray-700 bg-indigo-50 p-3 rounded border border-indigo-100">{receta.medicamentos.map((med, medIndex) => ( <li key={medIndex}><strong className="font-semibold">{med.nombre || '?'}</strong>: {med.dosis || '?'} ({med.frecuencia || '?'}) - {med.duracion || '?'}</li> ))}</ul> ) : ( <p className="text-sm text-gray-500 italic pl-4">No se especificaron medicamentos.</p> )}</div></div>
                                        </div></li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Estilos Comunes */}
            <style jsx global>{`
                .input-style { margin-top: 0.25rem; display: block; width: 100%; border-width: 1px; border-color: #D1D5DB; border-radius: 0.375rem; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); padding-top: 0.5rem; padding-bottom: 0.5rem; padding-left: 0.75rem; padding-right: 0.75rem; outline: 2px solid transparent; outline-offset: 2px; }
                .input-style:focus { --tw-ring-color: #4F46E5; --tw-ring-offset-shadow: var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color); --tw-ring-shadow: var(--tw-ring-inset) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color); box-shadow: var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow, 0 0 #0000); border-color: #6366F1; }
                .input-style-sm { margin-top: 0.25rem; display: block; width: 100%; border-width: 1px; border-color: #D1D5DB; border-radius: 0.375rem; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); padding-top: 0.25rem; padding-bottom: 0.25rem; padding-left: 0.5rem; padding-right: 0.5rem; font-size: 0.875rem; line-height: 1.25rem; outline: 2px solid transparent; outline-offset: 2px; }
                .input-style-sm:focus { --tw-ring-color: #4F46E5; --tw-ring-offset-shadow: var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color); --tw-ring-shadow: var(--tw-ring-inset) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color); box-shadow: var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow, 0 0 #0000); border-color: #6366F1; }
                .textarea-style { margin-top: 0.25rem; display: block; width: 100%; border-width: 1px; border-color: #D1D5DB; border-radius: 0.375rem; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); padding-top: 0.5rem; padding-bottom: 0.5rem; padding-left: 0.75rem; padding-right: 0.75rem; outline: 2px solid transparent; outline-offset: 2px; font-size: 0.875rem; line-height: 1.25rem; }
                .textarea-style:focus { --tw-ring-color: #4F46E5; --tw-ring-offset-shadow: var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color); --tw-ring-shadow: var(--tw-ring-inset) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color); box-shadow: var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow, 0 0 #0000); border-color: #6366F1; }
            `}</style>
        </div>
    );
};

export default DoctorPrescription;