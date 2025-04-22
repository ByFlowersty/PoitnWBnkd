import React, { useState, useEffect } from "react";
import supabase from '../lib/supabaseClient'; // Ajusta la ruta
import PointOfSale from '../components/farmaceutico/PointOfSale'; // Ajusta la ruta
import Fidelizacion from '../components/farmaceutico/Fidelizacion'; // Ajusta la ruta
import TabNavigation from '../components/farmaceutico/TabNavigation'; // Ajusta la ruta
import InventoryManagement from '../components/farmaceutico/InventoryManagement'; // Ajusta la ruta
import Header from '../components/farmaceutico/Header'; // Ajusta la ruta
import '../App.css'; // Ajusta la ruta
import '../index.css'; // Ajusta la ruta
import { useNavigate } from 'react-router-dom';
import { Receipt, Loader2, AlertTriangle, ShoppingCart, Calendar as CalendarIcon } from "lucide-react"; // Iconos necesarios

// --- Interfaces ---
interface FarmaciaData {
  id_farmacia: string | number; // Puede ser number o string dependiendo de la DB
  nombre: string;
  ubicacion: string;
  horario_atencion: string;
  telefono?: string;
  id_administrador: string; // Asumo UUID
}

interface CartItem { // Para props de PointOfSale (si aún se usan)
  id: string; // Asumo ID del producto/medicamento
  cantidad: number;
  precio_en_pesos: number;
  unidades: number;
  [key: string]: any;
}

interface Product { // Para props de PointOfSale (si aún se usan)
  id: string; // Asumo ID del producto/medicamento
  nombre_medicamento: string;
  precio_en_pesos: number;
  unidades: number;
  [key: string]: any;
}

interface MedicamentoPorCaducar { // Para InventoryManagement
  id: string;
  nombre: string;
  fecha_caducidad: string;
  [key: string]: any;
}

interface MedicamentoSinMovimiento { // Para InventoryManagement
  id: string;
  nombre: string;
  ultima_venta: string;
  [key: string]: any;
}

// Interfaz unificada para mostrar tickets
interface Ticket {
    id: string; // Identificador único (ej: 'venta-123', 'cita-45')
    type: 'venta' | 'cita';
    receiptNumber: string | null; // Número de recibo de la venta o de pago_e_cita
    date: string; // Fecha en formato ISO string
    amount: number | null; // Monto total (puede ser null para citas pendientes)
    status?: string; // 'pendiente', 'pagado' (relevante para citas)
    details?: string; // Descripción corta (ej: "Venta TPV" o "Cita en Farmacia X")
    farmaciaNombre?: string | null; // Nombre de la farmacia (para citas)
}

function Interfaz_Farmaceutico() {
    const navigate = useNavigate();
    const [farmaciaData, setFarmaciaData] = useState<FarmaciaData | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [currentDateTime, setCurrentDateTime] = useState<Date>(new Date());
    const [activeTab, setActiveTab] = useState<string>('pos'); // Pestaña inicial

    // Estado para Patient ID (UUID)
    const [patientId, setPatientId] = useState<string | null>(null);

    // Estado para Tickets
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loadingTickets, setLoadingTickets] = useState<boolean>(false);
    const [ticketsError, setTicketsError] = useState<string | null>(null);

    // Estados necesarios para pasar como props (si los componentes hijos los requieren)
    // Si PointOfSale/InventoryManagement manejan su propio estado interno, puedes eliminar estos
    const [cartItems, setCartItems] = useState<CartItem[]>([]);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [productSearch, setProductSearch] = useState<string>('');
    const [productQuantity, setProductQuantity] = useState<number>(1);
    const [paymentMethod, setPaymentMethod] = useState<string>('efectivo');
    const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
    const [amountPaid, setAmountPaid] = useState<string>('');
    const [receiptNumber, setReceiptNumber] = useState<string | null>(null);
    const [medicamentosPorCaducar, setMedicamentosPorCaducar] = useState<MedicamentoPorCaducar[]>([]);
    const [medicamentosSinMovimiento, setMedicamentosSinMovimiento] = useState<MedicamentoSinMovimiento[]>([]);
    const [inventarioSearch, setInventarioSearch] = useState<string>('');
    const [filteredInventario, setFilteredInventario] = useState<any[]>([]);
    const [showAddMedicineModal, setShowAddMedicineModal] = useState<boolean>(false);
    const [clientName, setClientName] = useState<string>(''); // Añadido si PointOfSale lo necesita
    const [clientPhone, setClientPhone] = useState<string>(''); // Añadido si PointOfSale lo necesita
    const [idFarmaciaDisplay, setIdFarmaciaDisplay] = useState<string>(''); // Añadido si Inventory lo necesita


    // Update current date time
    useEffect(() => {
        const timer = setInterval(() => setCurrentDateTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Fetch farmacia data Y Patient ID
    useEffect(() => {
        const fetchInitialData = async () => {
            console.log("Fetching initial data...");
            setLoading(true);
            setError(null);
            setPatientId(null);
            setFarmaciaData(null);

            try {
                const { data: { user }, error: userError } = await supabase.auth.getUser();
                if (userError || !user) throw new Error(userError?.message || "Usuario no autenticado");
                console.log("User authenticated:", user.id);

                // Get Patient ID (from patients table)
                console.log("Fetching patient ID for user:", user.id);
                const { data: patientDataResult, error: patientError } = await supabase
                    .from('patients')
                    .select('id')
                    .eq('user_id', user.id) // <-- CONFIRMA COLUMNA user_id en patients
                    .single();

                if (patientError && patientError.code !== 'PGRST116') throw new Error(`Error buscando datos de paciente: ${patientError.message}`);

                const currentPatientId = patientDataResult?.id || null;
                setPatientId(currentPatientId);
                console.log("Patient ID found:", currentPatientId);

                // Get Pharmacy Data
                console.log("Fetching pharmacy data...");
                let farmaciaResult = null;
                const { data: workerData, error: workerError } = await supabase
                    .from('trabajadores')
                    .select('id_farmacia')
                    .eq('user_id', user.id)
                    .maybeSingle();

                 if (!workerError && workerData?.id_farmacia) {
                    console.log("User is a worker for pharmacy:", workerData.id_farmacia);
                    farmaciaResult = await supabase.from('farmacias').select('*').eq('id_farmacia', workerData.id_farmacia).single();
                 } else {
                    console.log("Checking if user is admin for any pharmacy...");
                    farmaciaResult = await supabase.from('farmacias').select('*').eq('id_administrador', user.id).maybeSingle(); // <-- CONFIRMA COLUMNA id_administrador
                 }

                if (farmaciaResult?.error) throw new Error(farmaciaResult.error.message);
                if (!farmaciaResult?.data) console.warn("No pharmacy found associated with this user.");

                setFarmaciaData(farmaciaResult?.data as FarmaciaData || null);
                console.log("Pharmacy data:", farmaciaResult?.data);

            } catch (err: any) {
                console.error('Error fetching initial data:', err);
                setError(err.message || "Ocurrió un error desconocido.");
                if (err.message.includes("autenticado")) {
                     setTimeout(() => navigate('/login'), 1500);
                }
            } finally {
                console.log("Finished fetching initial data.");
                setLoading(false);
            }
        };
        fetchInitialData();
    }, [navigate]);

    // Fetch Tickets (Ventas + Citas Pagadas/Pendientes)
    useEffect(() => {
        const fetchTickets = async () => {
            if (!patientId) {
                console.log("Fetch Tickets: No patientId, skipping.");
                setTickets([]);
                return;
            }
            console.log("Fetch Tickets: Starting for patientId:", patientId);
            setLoadingTickets(true);
            setTicketsError(null);
            setTickets([]);

            try {
                // 1. Fetch Ventas (POS Sales)
                const fetchVentasPromise = supabase
                    .from('ventas') // <--- CONFIRMA NOMBRE TABLA VENTAS
                    .select('id, receipt_number, created_at, total_amount') // <-- CONFIRMA NOMBRES COLUMNAS VENTA
                    .eq('paciente_id', patientId) // <-- CONFIRMA COLUMNA PACIENTE ID EN VENTAS
                    .order('created_at', { ascending: false })
                    .limit(50);

                // 2. Fetch Citas Pagadas/Pendientes (con nombre farmacia)
                const fetchCitasPromise = supabase
                    .from('pago_e_cita')
                    .select(`
                        id,
                        numero_recibo,
                        fecha_creacion,
                        precio,
                        estado_pago,
                        id_farmacia,
                        citas!inner ( id_usuario, dia_atencion, horario_cita ),
                        farmacias ( nombre )
                    `)
                    .eq('citas.id_usuario', patientId) // Filtro por paciente en la tabla citas
                    .order('fecha_creacion', { ascending: false })
                    .limit(50);

                const [ventasResult, citasResult] = await Promise.all([
                    fetchVentasPromise,
                    fetchCitasPromise
                ]);

                if (ventasResult.error) throw new Error(`Error al cargar ventas: ${ventasResult.error.message}`);
                if (citasResult.error) throw new Error(`Error al cargar pagos de citas: ${citasResult.error.message}`);

                // Mapear Ventas
                const ventasTickets: Ticket[] = (ventasResult.data || []).map(v => ({
                    id: `venta-${v.id}`,
                    type: 'venta',
                    receiptNumber: v.receipt_number || `V-${v.id}`,
                    date: v.created_at,
                    amount: v.total_amount,
                    status: 'pagado', // Ventas siempre pagadas
                    details: "Venta Productos",
                    farmaciaNombre: farmaciaData?.nombre || null, // Asume la farmacia actual si no hay otra info
                }));

                // Mapear Pagos de Citas
                const citasTickets: Ticket[] = (citasResult.data || [])
                    // Doble check (aunque el JOIN ya filtra)
                    .filter(p => p.citas?.id_usuario === patientId)
                    .map(p => ({
                        id: `cita-${p.id}`,
                        type: 'cita',
                        receiptNumber: p.numero_recibo,
                        date: p.fecha_creacion, // O usar citas.dia_atencion/horario_cita si se prefiere
                        amount: p.precio,
                        status: p.estado_pago,
                        details: `Consulta/Cita`,
                        farmaciaNombre: p.farmacias?.nombre || '(Farmacia no especificada)',
                    }));

                // Combinar y ordenar
                const allTickets = [...ventasTickets, ...citasTickets].sort((a, b) =>
                    new Date(b.date).getTime() - new Date(a.date).getTime()
                );

                console.log("Fetch Tickets: Combined tickets:", allTickets);
                setTickets(allTickets);

            } catch (err: any) {
                console.error("Fetch Tickets: Error:", err);
                setTicketsError(err.message || "No se pudieron cargar los tickets.");
                setTickets([]);
            } finally {
                console.log("Fetch Tickets: Finished.");
                setLoadingTickets(false);
            }
        };

        fetchTickets();
    }, [patientId, farmaciaData?.nombre]); // Depende de patientId y del nombre de la farmacia actual para las ventas

    // Helpers para formatear fecha y hora (copiados o importados)
    const formatDate = (dateString: string | null | undefined): string => {
        if (!dateString) return 'N/A';
        try { const date = new Date(dateString); if(isNaN(date.getTime())) return 'Inválida'; return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }); }
        catch (e) { return 'Error'; }
    };
    const formatTime = (timeString: string | null | undefined): string => {
        if (!timeString) return 'N/A';
        try { const date = new Date(timeString); if(isNaN(date.getTime())) return 'Inválida'; return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: true }); }
        catch (e) { return 'Error'; }
    };

    // Componente para la Lista de Tickets
    const TicketList = () => {
        if (!patientId) { // No mostrar nada si aún no hay ID de paciente
            return <p className="text-sm text-center text-gray-500 py-4">Inicia sesión para ver tu historial.</p>;
        }
        if (loadingTickets) {
            return <div className="text-center py-10"><Loader2 className="h-8 w-8 mx-auto animate-spin text-blue-500 mb-2" /><p className="text-sm text-gray-500">Cargando historial...</p></div>;
        }
        if (ticketsError) {
            return <div className="p-4 bg-red-50 border border-red-200 rounded-md text-center"><AlertTriangle className="h-6 w-6 mx-auto text-red-500 mb-2" /><p className="text-sm font-medium text-red-700">Error</p><p className="text-xs text-red-600 mt-1">{ticketsError}</p></div>;
        }
        if (tickets.length === 0) {
            return <div className="text-center py-10 text-gray-500"><Receipt className="h-10 w-10 mx-auto mb-2 text-gray-400" /><p>No hay tickets recientes.</p></div>;
        }
        return (
            <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar pr-2">
                {tickets.map((ticket) => (
                    <div key={ticket.id} className={`p-3 rounded-lg border flex justify-between items-start ${ticket.type === 'cita' && ticket.status === 'pendiente' ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-200'}`}>
                        <div className="flex-1 min-w-0 space-y-1">
                             <div className="text-xs text-gray-500 flex items-center gap-1.5">
                                 {ticket.type === 'venta' ? <ShoppingCart size={14} /> : <CalendarIcon size={14} />}
                                 <span>{formatDate(ticket.date)} - {formatTime(ticket.date)}</span>
                             </div>
                             <p className="text-sm font-medium text-gray-800 truncate" title={ticket.details}>{ticket.details || (ticket.type === 'venta' ? 'Venta Productos' : 'Cita')}</p>
                             {ticket.farmaciaNombre && <p className="text-xs text-gray-600">en: {ticket.farmaciaNombre}</p>}
                             <p className="text-xs text-gray-500 italic">Recibo: {ticket.receiptNumber || 'N/A'}</p>
                        </div>
                        <div className="text-right flex-shrink-0 ml-3 space-y-1">
                            <p className={`font-semibold text-base ${ticket.type === 'cita' && ticket.status === 'pendiente' ? 'text-orange-700' : 'text-blue-700'}`}>
                                ${ticket.amount !== null && ticket.amount !== undefined ? ticket.amount.toFixed(2) : '--.--'}
                            </p>
                            {ticket.type === 'cita' && (
                                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold inline-block ${ticket.status === 'pagado' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>
                                    {ticket.status === 'pagado' ? 'Pagado' : 'Pendiente'}
                                </span>
                            )}
                             {ticket.type === 'venta' && ( // Mostrar 'Pagado' para ventas si se desea
                                <span className="text-xs px-2 py-0.5 rounded-full font-semibold inline-block bg-green-100 text-green-800">
                                    Pagado
                                </span>
                             )}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    // --- Renderizado Principal ---
    if (loading) return ( <div className="flex items-center justify-center min-h-screen bg-gray-50"> {/* Loading Spinner */} <div className="text-center p-6 max-w-md w-full"> <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent mb-4"></div> <h2 className="text-lg font-medium text-gray-900">Cargando...</h2> <p className="mt-1 text-gray-600">Por favor espere...</p> </div> </div> );
    if (error) return ( <div className="flex items-center justify-center min-h-screen bg-gray-50"> {/* Error Message */} <div className="text-center p-6 max-w-md w-full bg-white rounded-lg shadow"> <AlertTriangle className="h-12 w-12 mx-auto text-red-500" /> <h2 className="text-lg font-medium text-red-800 mt-4">Error</h2> <p className="mt-1 text-red-600">{error}</p> <button onClick={() => navigate('/login')} className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"> Volver a Inicio de Sesión </button> </div> </div> );

    return (
        <div className="min-h-screen bg-gray-100">
            <Header currentDateTime={currentDateTime} pharmacyName={farmaciaData?.nombre} />
            {farmaciaData && (
                <header className="bg-white shadow">
                    <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8"> <div className="flex justify-between items-center"> <div> <h1 className="text-2xl font-bold text-gray-900">Farmacia: {farmaciaData.nombre}</h1> <div className="mt-1 text-sm text-gray-500"> <p>ID: {farmaciaData.id_farmacia} | Ubicación: {farmaciaData.ubicacion} | Horario: {farmaciaData.horario_atencion}</p> </div> </div> </div> </div>
                </header>
            )}
             {!farmaciaData && !loading && ( <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8"> <div className="p-4 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-700"> <p>No hay información de farmacia asociada a esta cuenta.</p> </div> </div> )}

            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                <div className="px-4 py-6 sm:px-0">
                    <TabNavigation activeTab={activeTab} setActiveTab={setActiveTab} />

                     {/* Mostrar Tickets SIEMPRE o mover dentro de una pestaña */}
                     <div className="my-6 bg-white shadow rounded-lg p-4 md:p-6">
                        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"> <Receipt className="text-gray-600" /> Mis Tickets Recientes </h2>
                        <TicketList />
                     </div>

                    {/* Contenido de Pestañas */}
                    <div className="mt-4">
                      {activeTab === 'pos' && farmaciaData && (
                          <PointOfSale /* Pasa aquí SOLO los props que PointOfSale aún necesite recibir desde fuera */ />
                      )}
                      {activeTab === 'pos' && !farmaciaData && (
                          <div className="text-center p-6 bg-white rounded-lg shadow"><p className="text-gray-500">Se requiere información de farmacia.</p></div>
                      )}

                      {activeTab === 'fidelizacion' && ( <Fidelizacion /> )}

                      {activeTab === 'inventario' && farmaciaData && (
                          <InventoryManagement /* Pasa aquí SOLO los props que Inventory necesite */ />
                      )}
                       {activeTab === 'inventario' && !farmaciaData && (
                           <div className="text-center p-6 bg-white rounded-lg shadow"><p className="text-gray-500">Se requiere información de farmacia.</p></div>
                      )}
                      {/* Puedes añadir más pestañas aquí */}
                   </div>
                </div>
            </main>
        </div>
    );
}

export default Interfaz_Farmaceutico;

// Estilos Adicionales (si no los tienes ya)
/*
<style>
  .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
  .custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 3px; }
  .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
</style>
*/
