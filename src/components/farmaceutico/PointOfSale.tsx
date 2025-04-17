"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, ShoppingCart, User, Plus, Minus, X, CreditCard, DollarSign,
  AlertCircle, CheckCircle, Calendar, Trash2, QrCode, Loader2, Phone,
  AlertTriangle, Fingerprint, Camera
} from "lucide-react";
import QRCode from "qrcode";
import supabase from "../../lib/supabaseClient"; // Asegúrate que la ruta sea correcta
import RFIDReader from "../farmaceutico/RFIDReader"; // Asegúrate que la ruta sea correcta

// --- Interfaces ---
interface Product {
  upc: string;
  nombre_medicamento: string;
  precio_en_pesos: number;
  unidades: number;
  id_farmacia: number | string; // Columna que enlaza con farmacias.id_farmacia
  [key: string]: any;
}
interface CartItem extends Product {
  cantidad: number;
}
interface StockWarning {
  message: string;
  productId: string; // UPC del producto
}
interface Patient {
  id: string; // UUID de Supabase tabla patients
  name: string;
  surecode?: string;
  phone?: string;
  allergies?: string;
}
// Interfaz para datos esperados del componente RFIDReader
interface RFIDPatientData {
    id: string | number; // Puede ser UUID o ID numérico
    name: string;
    surecode?: string;
    phone?: string;
    allergies?: string;
    // ... otros campos que pueda devolver el lector/componente RFID
}

// --- Componente Principal ---
const PointOfSale = () => {
  // --- Estados POS ---
  const [productSearch, setProductSearch] = useState<string>("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productQuantity, setProductQuantity] = useState<number>(1);
  const [isSearchingDb, setIsSearchingDb] = useState<boolean>(false);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [stockWarning, setStockWarning] = useState<StockWarning | null>(null);
  const [selectedPatientData, setSelectedPatientData] = useState<Patient | null>(null);
  const [buyWithoutAccount, setBuyWithoutAccount] = useState<boolean>(false);
  const [showValidationMessage, setShowValidationMessage] = useState<boolean>(false);
  const [activeIdentificationModal, setActiveIdentificationModal] = useState<'code' | 'facial' | 'rfid' | null>(null);
  const [patientSearchQuery, setPatientSearchQuery] = useState<string>("");
  const [isSearchingPatient, setIsSearchingPatient] = useState<boolean>(false);
  const [patientSearchError, setPatientSearchError] = useState<string | null>(null);

  // --- Estado de Farmacia ---
  const [currentPharmacyId, setCurrentPharmacyId] = useState<number | string | null>(null);
  const [isLoadingPharmacyId, setIsLoadingPharmacyId] = useState<boolean>(true);
  const [pharmacyIdError, setPharmacyIdError] = useState<string | null>(null); // Error específico

  // --- useEffect para Obtener ID de Farmacia (CORREGIDO con user_id) ---
  useEffect(() => {
    const fetchPharmacyId = async () => {
      setIsLoadingPharmacyId(true);
      setPharmacyIdError(null); // Limpiar error previo
      try {
        // 1. Obtener el usuario autenticado actual
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
          throw new Error(authError?.message || "No se pudo obtener el usuario autenticado.");
        }
        console.log("Usuario autenticado ID:", user.id); // Log para verificar ID

        // 2. Consultar la tabla 'trabajadores' para obtener el 'id_farmacia'
        //    usando la columna 'user_id' para enlazar con auth.users
        const { data: workerData, error: workerError } = await supabase
          .from('trabajadores')         // Tabla correcta
          .select('id_farmacia')       // Columna correcta a seleccionar
          .eq('user_id', user.id)      // <<<--- COLUMNA DE ENLACE CORRECTA ('user_id')
          .single();                  // Esperamos un solo registro por trabajador

        // 3. Manejar errores de la consulta a 'trabajadores'
        if (workerError) {
            if (workerError.code === 'PGRST116') { // Código "No rows returned"
                console.error(`No se encontró trabajador con user_id = ${user.id}`);
                throw new Error("Registro de trabajador no encontrado para el usuario actual. No se pudo determinar la farmacia.");
            } else {
                 // Otro error de base de datos
                 console.error("Error DB buscando trabajador:", workerError);
                 throw new Error(`Error al buscar datos del trabajador: ${workerError.message}`);
            }
        }

        // 4. Validar que los datos y el id_farmacia existen
        if (!workerData || workerData.id_farmacia === null || workerData.id_farmacia === undefined) {
          // Esto podría pasar si la columna id_farmacia está vacía para ese trabajador
          console.error(`Trabajador encontrado (user_id=${user.id}), pero sin id_farmacia asociado.`);
          throw new Error("El registro del trabajador existe pero no tiene un ID de farmacia asociado.");
        }

        // 5. Establecer el ID de farmacia obtenido
        console.log("✅ ID de Farmacia obtenido para el trabajador:", workerData.id_farmacia);
        setCurrentPharmacyId(workerData.id_farmacia);

      } catch (error: any) {
        // Capturar cualquier error del bloque try
        console.error("❌ Error general obteniendo ID de farmacia:", error);
        setPharmacyIdError(error.message || "Ocurrió un error al cargar los datos de la farmacia.");
        setCurrentPharmacyId(null); // Asegurarse que quede nulo en caso de error
      } finally {
        // Siempre se ejecuta, para quitar el estado de carga
        setIsLoadingPharmacyId(false);
      }
    };

    fetchPharmacyId();
  }, []); // El array vacío asegura que se ejecute solo una vez al montar

  // --- Estados Cámara ---
  const [showCamera, setShowCamera] = useState<boolean>(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isCameraLoading, setIsCameraLoading] = useState<boolean>(false);

  // --- Estados Pago ---
  const [paymentMethod, setPaymentMethod] = useState<string>("efectivo");
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [amountPaid, setAmountPaid] = useState<string>("");
  const [receiptNumber, setReceiptNumber] = useState<number | string | null>(null);
  const [currentOrderId, setCurrentOrderId] = useState<number | string | null>(null);
  const [isGeneratingQR, setIsGeneratingQR] = useState<boolean>(false);
  const [mercadoPagoQrUrl, setMercadoPagoQrUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [isConfirmingCash, setIsConfirmingCash] = useState<boolean>(false);
  const [cashConfirmationError, setCashConfirmationError] = useState<string | null>(null);

  // --- Estados UI ---
  const [isSearchFocused, setIsSearchFocused] = useState<boolean>(false);

  // --- Funciones Auxiliares UI ---
  const getStockPercentage = (available: number, max: number): number => { if (max <= 0) return 100; return Math.min(100, Math.max(0, (available / max) * 100)); };
  const getStockLevelColor = (percentage: number): string => { if (percentage <= 20) return "bg-red-500"; if (percentage <= 50) return "bg-amber-500"; return "bg-emerald-500"; };

  // --- Funciones POS ---
  const handleProductSearch = useCallback(async (term: string) => {
    setProductSearch(term);
    setSearchResults([]);
    if (!currentPharmacyId || term.length < 3) {
      setIsSearchingDb(false);
      return;
    }
    setIsSearchingDb(true);
    try {
      const { data, error } = await supabase
        .from("medicamentos")
        .select("upc, nombre_medicamento, precio_en_pesos, unidades, id_farmacia")
        .eq('id_farmacia', currentPharmacyId)
        .ilike("nombre_medicamento", `%${term}%`)
        .order("nombre_medicamento")
        .limit(15);
      if (error) throw error;
      setSearchResults(data || []);
    } catch (err) {
      console.error("Fallo búsqueda producto:", err);
      setSearchResults([]);
    } finally {
      setIsSearchingDb(false);
    }
  }, [currentPharmacyId]);

  const handleSelectProduct = (product: Product) => {
      setSelectedProduct(product);
      setSearchResults([]);
      setProductSearch(product.nombre_medicamento);
      setProductQuantity(1);
      setIsSearchFocused(false);
      setStockWarning(null);
  };

  const handleAddToCart = () => {
      if (!selectedProduct) return;
      const stockCheckProduct = { ...selectedProduct };
      const existingItem = cartItems.find((item) => item.upc === selectedProduct.upc && item.id_farmacia === selectedProduct.id_farmacia); // Asegurar misma farmacia
      const currentInCart = existingItem ? existingItem.cantidad : 0;
      const needed = productQuantity;
      const totalAfterAdd = currentInCart + needed;

      if (totalAfterAdd > stockCheckProduct.unidades) {
          setStockWarning({ message: `Stock insuficiente (${stockCheckProduct.unidades} disp.)`, productId: stockCheckProduct.upc });
          setTimeout(() => { if(stockWarning?.productId === selectedProduct.upc) setStockWarning(null) }, 3000);
          return;
      }

      if (existingItem) {
          setCartItems(cartItems.map((item) =>
              item.upc === selectedProduct.upc && item.id_farmacia === selectedProduct.id_farmacia
                  ? { ...item, cantidad: totalAfterAdd }
                  : item
          ));
      } else {
          const qtyToAdd = Math.min(productQuantity, selectedProduct.unidades);
          if (qtyToAdd > 0) {
              // Asegurar que el id_farmacia se añade correctamente al carrito
              setCartItems([...cartItems, { ...selectedProduct, cantidad: qtyToAdd }]);
          } else {
              setStockWarning({ message: `No hay stock`, productId: selectedProduct.upc });
              setTimeout(() => { if(stockWarning?.productId === selectedProduct.upc) setStockWarning(null) }, 3000);
          }
      }
      setSelectedProduct(null);
      setProductSearch("");
      setProductQuantity(1);
      setSearchResults([]);
  };

  const handleRemoveFromCart = (upc: string) => { // Asume UPC es único en el carrito por ahora
      setCartItems(cartItems.filter((item) => item.upc !== upc));
      if (stockWarning?.productId === upc) {
          setStockWarning(null);
      }
  };

  const handleUpdateQuantity = (upc: string, newQuantity: number) => {
      if (newQuantity < 1) {
          return handleRemoveFromCart(upc);
      }
      const itemIndex = cartItems.findIndex((item) => item.upc === upc); // Encuentra índice
      if (itemIndex === -1) return; // Item no encontrado

      const item = cartItems[itemIndex];

      if (newQuantity > item.unidades) {
          setStockWarning({ message: `Stock max: ${item.unidades}`, productId: upc });
          setTimeout(() => { if (stockWarning?.productId === upc) setStockWarning(null); }, 3000);
          return;
      }

      // Crear nuevo array para evitar mutación directa
      const updatedCartItems = [...cartItems];
      updatedCartItems[itemIndex] = { ...item, cantidad: newQuantity };
      setCartItems(updatedCartItems);

      if (stockWarning?.productId === upc) {
          setStockWarning(null);
      }
  };

  const calculateTotal = useCallback((): number => {
      return cartItems.reduce((total, item) => total + item.precio_en_pesos * item.cantidad, 0);
  }, [cartItems]);

  const handlePatientSearchSubmit = async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (!patientSearchQuery.trim()) { setPatientSearchError("Ingrese código (surecode)"); return; }
      setIsSearchingPatient(true); setPatientSearchError(null); setSelectedPatientData(null);
      try {
          const { data, error } = await supabase.from("patients").select("id, name, surecode, phone, allergies").eq("surecode", patientSearchQuery.trim()).single();
          if (error) {
              if (error.code === "PGRST116") { setPatientSearchError("Paciente no encontrado."); }
              else { console.error("Error buscando paciente por código:", error); throw error; }
              setSelectedPatientData(null);
          } else if (data) { setSelectedPatientData(data as Patient); setPatientSearchError(null); closeSearchModal(); }
      } catch (err: any) { console.error("Error buscando paciente:", err); setPatientSearchError("Error al buscar paciente."); }
      finally { setIsSearchingPatient(false); }
  };

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { console.error("getUserMedia not supported"); setPatientSearchError("Tu navegador no soporta el acceso a la cámara."); setIsCameraLoading(false); setShowCamera(false); return; }
    console.log("[Camera] Attempting start..."); setPatientSearchError(null); setIsCameraLoading(true); setShowCamera(true);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      console.log("[Camera] Stream obtained:", mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play().catch(playErr => { console.error("[Camera] Error trying to play video:", playErr); setPatientSearchError("No se pudo iniciar el video de la cámara."); mediaStream.getTracks().forEach(track => track.stop()); setShowCamera(false); setStream(null); throw playErr; });
        if (videoRef.current.paused) { throw new Error("Video did not start playing."); }
        setStream(mediaStream); console.log("[Camera] Stream assigned and playing.");
      } else { console.error("[Camera] videoRef.current is NULL!"); setPatientSearchError("No se pudo acceder al elemento de video."); mediaStream.getTracks().forEach(track => track.stop()); setShowCamera(false); setStream(null); }
    } catch (err: any) {
      console.error("[Camera] Error starting camera:", err.name, err.message);
      let errorMsg = `Error de cámara (${err.name}). Intenta de nuevo.`;
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") { errorMsg = "Permiso de cámara denegado. Habilítalo en tu navegador."; }
      else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") { errorMsg = "No se encontró ninguna cámara conectada."; }
      else if (err.name === "NotReadableError" || err.name === "TrackStartError") { errorMsg = "La cámara está ocupada o hubo un error de hardware."; }
      else if (err.name === "OverconstrainedError" || err.name === "ConstraintNotSatisfiedError") { errorMsg = "La cámara no soporta la configuración solicitada."; }
      setPatientSearchError(errorMsg); setShowCamera(false); setStream(null);
    } finally { setIsCameraLoading(false); console.log("[Camera] Start attempt finished."); }
  }, [setPatientSearchError, setIsCameraLoading, setShowCamera, setStream]);

  const stopCamera = useCallback(() => {
    console.log("[Camera] Stopping...");
    if (stream) { stream.getTracks().forEach(track => track.stop()); console.log("[Camera] Tracks stopped."); }
    if (videoRef.current) { videoRef.current.srcObject = null; videoRef.current.load(); }
    setStream(null); setShowCamera(false); setIsCameraLoading(false);
  }, [stream]);

  useEffect(() => {
    const isFacialModalOpen = activeIdentificationModal === 'facial';
    if (!isFacialModalOpen && stream) { stopCamera(); }
    return () => { if (stream) { stopCamera(); } };
  }, [activeIdentificationModal, stream, stopCamera]);

  const deselectPatient = () => { setSelectedPatientData(null); setPatientSearchQuery(""); setPatientSearchError(null); setShowValidationMessage(false); };
  const validateClientInfo = (): boolean => { const isValid = buyWithoutAccount || !!selectedPatientData; setShowValidationMessage(!isValid); return isValid; };
  const handleBuyWithoutAccount = () => { const newVal = !buyWithoutAccount; setBuyWithoutAccount(newVal); if (newVal) { deselectPatient(); } };

  // --- Lógica de Pago (Frontend llama a Backend) ---
  const generateMercadoPagoQrCode = useCallback(async () => {
      if (isGeneratingQR || mercadoPagoQrUrl) return;
      const total = calculateTotal();
      if (total <= 0) { setQrError("El monto total debe ser mayor a cero."); return; }
      const description = `Venta POS #${Date.now().toString().slice(-5)}`;
      setIsGeneratingQR(true); setQrError(null); setCurrentOrderId(null);
      try {
          // Incluir payment_method y asegurarse que cartItems tenga id_farmacia
          const body = {
              amount: total,
              description,
              paciente_id: selectedPatientData?.id || null,
              compra_sin_cuenta: buyWithoutAccount,
              cartItems, // cartItems ya debe tener id_farmacia de handleAddToCart
              id_farmacia: currentPharmacyId, // ID de la farmacia actual
              payment_method: 'mercadoPagoQR' // Especificar método
          };
          console.log("Enviando a /create_order (MP QR):", body); // Log para depurar
          const response = await fetch('https://point-production-4b80.up.railway.app/create_order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
          const data = await response.json();
          console.log("Respuesta de /create_order (MP QR):", data); // Log para depurar
          if (!response.ok) { throw new Error(data.message || `Error ${response.status} creando preferencia MP.`); }
          if (data.init_point_url && data.order_id) {
              setCurrentOrderId(data.order_id);
              const qrDataURL = await QRCode.toDataURL(data.init_point_url, { errorCorrectionLevel: 'L', margin: 1, scale: 5 });
              setMercadoPagoQrUrl(qrDataURL);
          } else { throw new Error('Respuesta inválida del servidor (falta URL/order_id).'); }
      } catch (err: any) { console.error("Error generando QR de Mercado Pago:", err); setQrError(err.message || "Error de red o del servidor al generar QR."); }
      finally { setIsGeneratingQR(false); }
  }, [cartItems, selectedPatientData, buyWithoutAccount, isGeneratingQR, mercadoPagoQrUrl, calculateTotal, currentPharmacyId]);

  const handleCheckout = () => {
      if (cartItems.length === 0) return;
      if (!validateClientInfo()) return;
      setMercadoPagoQrUrl(null); setQrError(null); setIsGeneratingQR(false); setCurrentOrderId(null);
      setCashConfirmationError(null); setIsConfirmingCash(false); setAmountPaid("");
      setShowPaymentModal(true);
  };

  useEffect(() => { if (showPaymentModal && paymentMethod === 'mercadoPagoQR') { generateMercadoPagoQrCode(); } }, [showPaymentModal, paymentMethod, generateMercadoPagoQrCode]);

  const resetPOSState = useCallback(() => {
    console.log("Resetting POS State...");
    stopCamera();
    setCartItems([]); setSelectedPatientData(null); setPatientSearchQuery(""); setPatientSearchError(null);
    setActiveIdentificationModal(null); setBuyWithoutAccount(false); setShowPaymentModal(false);
    setReceiptNumber(null); setAmountPaid(""); setPaymentMethod("efectivo"); setMercadoPagoQrUrl(null);
    setIsGeneratingQR(false); setQrError(null); setCurrentOrderId(null); setSelectedProduct(null);
    setProductSearch(""); setProductQuantity(1); setSearchResults([]); setShowValidationMessage(false);
    setIsConfirmingCash(false); setCashConfirmationError(null); setIsSearchFocused(false);
    setIsSearchingDb(false); setIsSearchingPatient(false); setStockWarning(null);
  }, [stopCamera]);

  const handleCompletePayment = async () => {
      setCashConfirmationError(null);
      const total = calculateTotal();
      const description = `Venta POS ${paymentMethod === 'efectivo' ? 'Efectivo' : 'MP QR'} #${Date.now().toString().slice(-5)}`;
      // Asegurarse que todos los datos necesarios se envían, incluyendo payment_method
      const orderBody = {
          amount: total,
          description,
          paciente_id: selectedPatientData?.id || null,
          compra_sin_cuenta: buyWithoutAccount,
          cartItems, // Ya deben tener id_farmacia
          id_farmacia: currentPharmacyId, // Farmacia que realiza la venta
          payment_method: paymentMethod // Método seleccionado
      };

      if (paymentMethod === 'efectivo') {
          if (!amountPaid || Number.parseFloat(amountPaid) < total) { setCashConfirmationError("El monto recibido es insuficiente."); return; }
          setIsConfirmingCash(true);
          try {
              console.log("Enviando a /create_order (Efectivo):", orderBody); // Log para depurar
              const response = await fetch('https://point-production-4b80.up.railway.app/create_order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(orderBody) });
              const data = await response.json();
              console.log("Respuesta de /create_order (Efectivo):", data); // Log para depurar
              if (!response.ok) {
                  // Si hay errores de stock, mostrarlos
                  if (response.status === 409 && data.stockErrors) {
                      setCashConfirmationError(`Error de stock: ${data.stockErrors.join(', ')}`);
                  } else {
                      setCashConfirmationError(data.message || `Error ${response.status} del servidor.`);
                  }
                  throw new Error(data.message || `Error ${response.status}`);
              }
              // Éxito para efectivo
              const newReceipt = data.receipt_number || data.order_id;
              setReceiptNumber(newReceipt);
              setTimeout(resetPOSState, 4000);
          } catch (error: any) { console.error("Error creando/confirmando efectivo:", error); /* El error ya se muestra */ }
          finally { setIsConfirmingCash(false); }
      } else if (paymentMethod === 'mercadoPagoQR') {
          // Simular éxito si QR/Orden existen (backend confirma)
          if (mercadoPagoQrUrl && !qrError && currentOrderId) {
              console.log(`Venta MP QR (Orden ${currentOrderId}) esperando confirmación externa.`);
              setReceiptNumber(currentOrderId);
              setTimeout(resetPOSState, 4000);
          } else { console.error("Intento de completar pago MP QR sin QR/orden válidos."); setQrError("No se pudo completar. Intente generar el QR de nuevo."); }
      }
  };

  const openSearchModal = (method: 'code' | 'facial' | 'rfid') => {
      setPatientSearchQuery(""); setPatientSearchError(null); setIsSearchingPatient(false);
      if (method !== 'facial' && stream) { stopCamera(); }
      setActiveIdentificationModal(method);
  };
  const closeSearchModal = () => { if (stream) { stopCamera(); } setActiveIdentificationModal(null); };

  // --- RENDERIZADO JSX ---
  if (isLoadingPharmacyId) { return ( <div className="min-h-screen bg-gray-100 flex items-center justify-center"><Loader2 className="h-12 w-12 text-blue-600 animate-spin" /><span className="ml-4 text-lg text-gray-700">Cargando...</span></div> ); }
  if (pharmacyIdError) { return ( <div className="min-h-screen bg-red-50 flex items-center justify-center p-4"><div className="text-center bg-white p-8 rounded-lg shadow-md border border-red-200 max-w-md"><AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" /><h2 className="text-xl font-semibold text-red-800">Error</h2><p className="text-red-600 mt-2">{pharmacyIdError}</p><button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm">Reintentar</button></div></div> ); }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <header className="mb-8 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-800">Punto de Venta</h1>
          <span className="text-sm font-medium text-gray-500 bg-gray-200 px-3 py-1 rounded-full">Farmacia ID: {currentPharmacyId}</span>
        </header>

        {/* Layout Principal */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Panel Izquierdo */}
          <div className="lg:col-span-2 space-y-6">
            {/* Búsqueda Producto */}
            <div className="bg-white rounded-xl shadow p-6 border border-gray-200 relative">
               <div className="relative">
                 <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">{isSearchingDb ? (<Loader2 className="h-5 w-5 text-gray-400 animate-spin" />) : (<Search className="h-5 w-5 text-gray-400" />)}</div>
                 <input type="text" placeholder="Buscar medicamento..." className="w-full pl-12 pr-10 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" value={productSearch} onChange={(e) => handleProductSearch(e.target.value)} onFocus={() => setIsSearchFocused(true)} onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)} />
                 {productSearch && (<button onClick={() => { setProductSearch(""); setSearchResults([]); setIsSearchingDb(false); }} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600" title="Limpiar"><X className="h-5 w-5" /></button> )}
               </div>
               <AnimatePresence>
                 {isSearchFocused && productSearch.length > 2 && (searchResults.length > 0 || isSearchingDb) && (
                   <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="mt-1 bg-white rounded-b-lg border-x border-b border-gray-200 shadow-lg overflow-hidden absolute w-[calc(100%-3rem)] z-20">
                     <div className="max-h-60 overflow-y-auto divide-y divide-gray-100">
                       {isSearchingDb && searchResults.length === 0 && (<div className="p-4 text-center text-sm text-gray-500 flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin"/> Buscando...</div>)}
                       {!isSearchingDb && searchResults.length === 0 && (<div className="p-4 text-center text-sm text-gray-500">No se encontraron resultados.</div>)}
                       {searchResults.map((product) => (
                           <div key={product.upc + '-' + product.id_farmacia} className="p-3 hover:bg-blue-50 cursor-pointer" onClick={() => handleSelectProduct(product)}>
                             <div className="flex justify-between items-center">
                               <div><h4 className="font-medium text-sm text-gray-800">{product.nombre_medicamento}</h4><p className="text-xs text-gray-500">UPC: {product.upc}</p></div>
                               <div className="text-right flex-shrink-0 ml-4"><p className="font-semibold text-blue-600 text-sm">${product.precio_en_pesos?.toFixed(2)}</p><span className={`text-xs px-1.5 py-0.5 rounded-full ${ getStockLevelColor(getStockPercentage(product.unidades, 100)).replace('bg-','').replace('-500','-100') } text-${getStockLevelColor(getStockPercentage(product.unidades, 100)).replace('bg-','').replace('-500','-700')}`}>{product.unidades} disp.</span></div>
                             </div>
                           </div>
                       ))}
                     </div>
                   </motion.div>
                 )}
               </AnimatePresence>
             </div>

            {/* Producto Seleccionado */}
            <AnimatePresence>
              {selectedProduct && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="bg-white rounded-xl shadow p-6 border border-gray-200">
                    <div className="flex justify-between items-start mb-4">
                        <div><h2 className="text-lg font-semibold text-gray-800">{selectedProduct.nombre_medicamento}</h2><p className="text-sm text-gray-500">UPC: {selectedProduct.upc}</p></div>
                        <div className="flex items-center gap-2"><span className="text-xl font-bold text-blue-600">${selectedProduct.precio_en_pesos?.toFixed(2)}</span><button onClick={() => setSelectedProduct(null)} className="p-1 text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50" title="Deseleccionar"><X className="h-4 w-4" /></button></div>
                    </div>
                    <div className="flex flex-wrap gap-4 items-center">
                        <div className="flex-grow min-w-[120px]"> <label className="text-xs text-gray-500 block mb-1">Stock Disp: {selectedProduct.unidades}</label> <div className="h-2 bg-gray-200 rounded-full overflow-hidden"><div className={`h-full rounded-full ${getStockLevelColor(getStockPercentage(selectedProduct.unidades, Math.max(1, selectedProduct.unidades)))}`} style={{ width: `${getStockPercentage(selectedProduct.unidades, Math.max(1, selectedProduct.unidades))}%` }}></div></div> </div>
                        <div className="flex items-center border border-gray-300 rounded-lg"><button onClick={() => productQuantity > 1 && setProductQuantity(productQuantity - 1)} className="px-3 py-2 text-gray-600 hover:bg-gray-100 disabled:opacity-50" disabled={productQuantity <= 1 || selectedProduct.unidades <= 0}><Minus className="h-4 w-4" /></button><input type="number" min="1" max={selectedProduct.unidades} value={productQuantity} onChange={(e) => { const v = parseInt(e.target.value); if (!isNaN(v)) { if (v <= 0) setProductQuantity(1); else if (v > selectedProduct.unidades) setProductQuantity(selectedProduct.unidades); else setProductQuantity(v); } else if (e.target.value === '') { setProductQuantity(1); }}} onBlur={(e) => { const v = parseInt(e.target.value); if (isNaN(v) || v <= 0) setProductQuantity(1);}} className="w-14 text-center border-x border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 py-2" disabled={selectedProduct.unidades <= 0}/> <button onClick={() => productQuantity < selectedProduct.unidades && setProductQuantity(productQuantity + 1)} className="px-3 py-2 text-gray-600 hover:bg-gray-100 disabled:opacity-50" disabled={productQuantity >= selectedProduct.unidades || selectedProduct.unidades <= 0}><Plus className="h-4 w-4" /></button></div>
                        <button onClick={handleAddToCart} className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-1.5 text-sm font-medium" disabled={selectedProduct.unidades <= 0 || productQuantity <= 0}><ShoppingCart className="h-4 w-4" /><span>Agregar</span></button>
                    </div>
                    {stockWarning && stockWarning.productId === selectedProduct.upc && (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-800 flex items-center gap-1.5"><AlertCircle className="h-4 w-4 flex-shrink-0" /><p>{stockWarning.message}</p></motion.div>)}
                  </motion.div>
              )}
            </AnimatePresence>

            {/* Sección Paciente */}
            <div className="bg-white rounded-xl shadow p-6 border border-gray-200">
                <div className="flex justify-between items-center mb-4"> <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2"> <User className="h-5 w-5 text-blue-600" /> Paciente </h2> <button onClick={handleBuyWithoutAccount} className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${ buyWithoutAccount ? "bg-blue-600 text-white ring-2 ring-offset-1 ring-blue-600" : "bg-gray-100 text-gray-700 hover:bg-gray-200" }`}>{buyWithoutAccount ? "Venta General ✓" : "Venta General"} </button> </div>
                {showValidationMessage && (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2"><AlertCircle className="h-5 w-5 flex-shrink-0" /><span>Se requiere paciente o "Venta General".</span></motion.div>)}
                <AnimatePresence> {selectedPatientData && !buyWithoutAccount && ( <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg relative overflow-hidden"> <button onClick={deselectPatient} title="Quitar paciente" className="absolute top-2 right-2 p-1 text-red-500 hover:text-red-700 rounded-full hover:bg-red-100"><X className="h-4 w-4" /></button> <p className="font-semibold text-green-800 text-base">{selectedPatientData.name}</p> <p className="text-xs text-gray-600">ID: {selectedPatientData.id.substring(0, 8)}...</p> {selectedPatientData.surecode && <p className="text-xs text-gray-600">Código: {selectedPatientData.surecode}</p>} <p className="text-xs text-gray-600">Tel: {selectedPatientData.phone || 'N/A'}</p> </motion.div> )} </AnimatePresence>
                {!selectedPatientData && !buyWithoutAccount && ( <div className="pt-2"> <label className="block text-sm font-medium text-gray-600 mb-2">Identificar Paciente por:</label> <div className="grid grid-cols-1 sm:grid-cols-3 gap-3"> <button onClick={() => openSearchModal('code')} className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 hover:border-gray-400"> <Search className="h-4 w-4"/> Código </button> <button onClick={() => openSearchModal('facial')} className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 hover:border-gray-400"> <Camera className="h-4 w-4"/> Facial </button> <button onClick={() => openSearchModal("rfid")} className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 hover:border-gray-400"> <Fingerprint className="h-4 w-4"/> RFID </button> </div> </div> )}
            </div>
          </div>

          {/* Panel Derecho */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow p-6 border border-gray-200 sticky top-6">
                <div className="flex justify-between items-center mb-4 pb-4 border-b"> <h2 className="text-lg font-semibold flex items-center gap-2"> <ShoppingCart className="h-5 w-5 text-blue-600" /> Carrito </h2> <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold"> {cartItems.reduce((acc, item) => acc + item.cantidad, 0)} items </span> </div>
                {cartItems.length === 0 ? ( <div className="py-10 text-center text-gray-500"> <ShoppingCart className="h-10 w-10 mx-auto mb-2 text-gray-400" /> <p>El carrito está vacío.</p> </div> ) : ( <div className="space-y-3 max-h-[calc(100vh-35rem)] overflow-y-auto pr-2 -mr-2 mb-4 custom-scrollbar"> {cartItems.map((item) => ( <motion.div key={item.upc + '-' + item.id_farmacia} layout initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -10 }} className="p-3 border rounded-lg flex gap-3 items-center relative"> <div className="flex-1 min-w-0"> <p className="font-medium text-sm truncate" title={item.nombre_medicamento}>{item.nombre_medicamento}</p> <p className="text-xs text-gray-500">${item.precio_en_pesos.toFixed(2)} c/u</p> </div> <div className="flex items-center border rounded"> <button onClick={() => handleUpdateQuantity(item.upc, item.cantidad - 1)} className="px-2 py-1 text-gray-600 hover:bg-gray-100 disabled:opacity-50" disabled={item.cantidad <= 1}><Minus className="h-3 w-3" /></button> <span className="px-2 text-sm font-medium">{item.cantidad}</span> <button onClick={() => handleUpdateQuantity(item.upc, item.cantidad + 1)} className="px-2 py-1 text-gray-600 hover:bg-gray-100 disabled:opacity-50" disabled={item.cantidad >= item.unidades}><Plus className="h-3 w-3" /></button> </div> <p className="font-semibold text-sm w-16 text-right">${(item.precio_en_pesos * item.cantidad).toFixed(2)}</p> <button onClick={() => handleRemoveFromCart(item.upc)} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Quitar"><Trash2 className="h-4 w-4" /></button> {stockWarning && stockWarning.productId === item.upc && (<div className="absolute -bottom-5 right-10 p-1 bg-yellow-100 border border-yellow-300 rounded text-xs text-yellow-800 z-10 shadow">{stockWarning.message}</div> )} </motion.div> ))} </div> )}
                {cartItems.length > 0 && ( <div className="border-t pt-4 space-y-4"> <div className="flex justify-between font-semibold text-lg"> <span>Total:</span> <span className="text-blue-600">${calculateTotal().toFixed(2)}</span> </div> <div className="space-y-2"> <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">Método Pago</label> <div className="grid grid-cols-2 gap-2"> <button onClick={() => setPaymentMethod("efectivo")} className={`py-2.5 px-2 rounded-lg border flex items-center justify-center gap-1.5 transition ${ paymentMethod === "efectivo" ? "bg-blue-600 border-blue-600 text-white ring-2 ring-offset-1 ring-blue-500" : "bg-white border-gray-300 text-gray-700 hover:border-gray-400" }`}> <DollarSign className="h-4 w-4" /> <span className="text-sm font-medium">Efectivo</span> </button> <button onClick={() => setPaymentMethod("mercadoPagoQR")} className={`py-2.5 px-2 rounded-lg border flex items-center justify-center gap-1.5 transition ${ paymentMethod === "mercadoPagoQR" ? "bg-blue-600 border-blue-600 text-white ring-2 ring-offset-1 ring-blue-500" : "bg-white border-gray-300 text-gray-700 hover:border-gray-400" }`}> <QrCode className="h-4 w-4" /> <span className="text-sm font-medium">MP QR</span> </button> </div> </div> <button onClick={handleCheckout} disabled={cartItems.length === 0 || (!buyWithoutAccount && !selectedPatientData)} className={`w-full py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition ${ (cartItems.length === 0 || (!buyWithoutAccount && !selectedPatientData)) ? "bg-gray-300 text-gray-500 cursor-not-allowed" : "bg-green-600 text-white hover:bg-green-700 active:bg-green-800" }`}> <CheckCircle className="h-5 w-5" /> <span>Proceder al Pago</span> </button> {showValidationMessage && (<p className="text-xs text-red-600 text-center mt-1">Selecciona paciente o "Venta General".</p> )} </div> )}
            </div>
          </div>

        </div> {/* Fin Grid Layout */}
      </div> {/* Fin Container */}

      {/* --- Modales --- */}
       <AnimatePresence>
         {activeIdentificationModal && (
           <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-40 backdrop-blur-sm" onClick={closeSearchModal}>
             <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl relative" onClick={(e) => e.stopPropagation()}>
               <button onClick={closeSearchModal} className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100"><X className="h-5 w-5" /></button>
               {/* Código */}
               {activeIdentificationModal === 'code' && ( <div className="space-y-4"> <h3 className="text-lg font-semibold flex items-center gap-2"><Search className="h-5 w-5 text-blue-600" /> Buscar por Código</h3> <form onSubmit={handlePatientSearchSubmit}> <label htmlFor="patient-code-search" className="block text-sm font-medium text-gray-600 mb-1">Código (Surecode)</label> <div className="flex gap-2"> <input id="patient-code-search" type="text" placeholder="Ingrese código..." className={`flex-grow px-3 py-2 border rounded-md focus:outline-none focus:ring-1 ${ isSearchingPatient ? 'bg-gray-100' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500' }`} value={patientSearchQuery} onChange={(e) => setPatientSearchQuery(e.target.value)} disabled={isSearchingPatient} autoFocus /> <button type="submit" className={`px-4 py-2 rounded-md text-white flex items-center justify-center gap-1.5 text-sm font-medium ${ isSearchingPatient || !patientSearchQuery.trim() ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800' }`} disabled={isSearchingPatient || !patientSearchQuery.trim()}> {isSearchingPatient ? <Loader2 className="h-4 w-4 animate-spin"/> : <Search className="h-4 w-4" />} <span>Buscar</span> </button> </div> </form> {patientSearchError && !isCameraLoading && !showCamera && (<p className="text-sm text-red-600 mt-2 flex items-center gap-1"><AlertCircle size={16}/> {patientSearchError}</p>)} </div> )}
               {/* RFID */}
               {activeIdentificationModal === 'rfid' && ( <div className="space-y-4"> <h3 className="text-lg font-semibold flex items-center gap-2 justify-center"> <Fingerprint className="h-5 w-5 text-blue-600" /> Identificación RFID </h3> <RFIDReader onPatientIdentified={(patientData: RFIDPatientData) => { console.log("RFID Data:", patientData); const patient: Patient = { id: patientData.id.toString(), name: patientData.name, surecode: patientData.surecode, phone: patientData.phone, allergies: patientData.allergies }; setSelectedPatientData(patient); setPatientSearchError(null); setTimeout(closeSearchModal, 500); }} onError={(errorMessage: string) => { console.error("RFID Error:", errorMessage); setPatientSearchError(`Error RFID: ${errorMessage}`); }} /> {patientSearchError && (<p className="text-sm text-red-600 mt-2 text-center flex items-center justify-center gap-1"><AlertCircle size={16}/> {patientSearchError}</p>)} </div> )}
               {/* Facial */}
               {activeIdentificationModal === 'facial' && ( <div className="space-y-4 text-center"> <h3 className="text-lg font-semibold flex items-center justify-center gap-2"> <Camera className="h-5 w-5 text-blue-600" /> Reconocimiento Facial </h3> <div className="relative rounded-lg overflow-hidden bg-gray-900 aspect-video max-w-xs mx-auto border-2 border-gray-300"> <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover block transform scale-x-[-1] transition-opacity ${ showCamera && !isCameraLoading && stream ? 'opacity-100' : 'opacity-0' }`} onLoadedMetadata={() => console.log("[Camera] Metadata loaded")} onError={(e) => console.error("[Camera] Video error:", e)}></video> <div className={`absolute inset-0 flex flex-col items-center justify-center p-4 ${showCamera && !isCameraLoading && stream ? 'opacity-0 pointer-events-none' : 'opacity-100 bg-black bg-opacity-50'}`}> {isCameraLoading ? ( <> <Loader2 className="h-8 w-8 text-blue-300 animate-spin mb-2" /> <span className="text-sm text-gray-300">Iniciando...</span> </> ) : patientSearchError ? ( <div className="text-center"> <AlertTriangle className="h-8 w-8 text-red-400 mb-2 mx-auto"/> <span className="text-xs text-red-300">{patientSearchError}</span> </div> ) : ( <> <Camera className="h-12 w-12 text-gray-500 opacity-50 mb-2" /> <span className="text-sm text-gray-400">Cámara OFF</span> </> )} </div> </div> <div className="flex justify-center gap-3"> {!showCamera && !isCameraLoading && ( <button onClick={startCamera} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm flex items-center gap-1.5"> <Camera className="h-4 w-4"/>Activar </button> )} {showCamera && !isCameraLoading && stream && ( <button onClick={stopCamera} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm flex items-center gap-1.5"> <X className="h-4 w-4"/>Detener </button> )} {isCameraLoading && ( <button className="px-4 py-2 bg-gray-500 text-white rounded-lg cursor-wait text-sm flex items-center gap-1.5" disabled> <Loader2 className="h-4 w-4 animate-spin"/> Cargando... </button> )} </div> {showCamera && !isCameraLoading && stream && ( <button className="mt-2 px-4 py-2 bg-gray-400 text-white rounded-lg cursor-not-allowed text-sm" disabled> Identificar (N/I) </button> )} {!isCameraLoading && !patientSearchError && showCamera && stream && ( <p className="text-xs text-gray-500 mt-2">Alinea tu rostro. (N/I).</p> )} </div> )}
             </motion.div>
           </motion.div>
         )}
       </AnimatePresence>

      {/* Modal de Pago */}
      <AnimatePresence>
        {showPaymentModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} transition={{ type: "spring", stiffness: 300, damping: 25 }} className="bg-white rounded-xl max-w-sm w-full p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              {receiptNumber ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center"> <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-4 border-4 border-green-200"><CheckCircle className="h-8 w-8 text-green-600" /></div> <h3 className="text-xl font-semibold">¡Venta Completada!</h3> <p className="text-sm text-gray-500 mt-1">Orden #{receiptNumber}</p> <p className="mt-4 text-2xl font-bold">Total: ${calculateTotal().toFixed(2)}</p> {paymentMethod === "efectivo" && amountPaid && Number.parseFloat(amountPaid) >= calculateTotal() && ( <div className="mt-2 text-sm text-gray-600 bg-gray-50 p-2 rounded-md"> <span>Pagado: ${Number.parseFloat(amountPaid).toFixed(2)}</span> | <span className="font-medium">Cambio: ${(Number.parseFloat(amountPaid) - calculateTotal()).toFixed(2)}</span> </div> )} {paymentMethod === "mercadoPagoQR" && ( <p className="mt-2 text-sm text-blue-600 flex items-center justify-center gap-1"> <QrCode size={16}/> (Pago MP Iniciado) </p> )} <div className="mt-5 p-2 bg-gray-100 rounded text-xs text-gray-500 flex items-center justify-center gap-1"><Loader2 className="h-3 w-3 animate-spin"/> Reiniciando...</div> </motion.div>
              ) : (
                <> <div className="flex justify-between items-center mb-4 pb-4 border-b"> <h3 className="text-lg font-semibold">Confirmar Pago</h3> <button onClick={() => setShowPaymentModal(false)} className="p-1 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100"><X className="h-5 w-5" /></button> </div> <div className="space-y-4"> <div className="text-center"> <span className="text-sm text-gray-500 block">Total</span> <span className="text-3xl font-bold text-blue-600">${calculateTotal().toFixed(2)}</span> </div> {paymentMethod === "efectivo" && ( <div className="space-y-2"> <label htmlFor="amount-paid" className="block text-sm font-medium">Monto Recibido</label> <div className="relative"> <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">$</span> <input id="amount-paid" type="number" min={0} step="0.01" placeholder={calculateTotal().toFixed(2)} className={`block w-full pl-7 pr-4 py-2 border rounded-md shadow-sm text-lg ${ cashConfirmationError ? 'border-red-500 ring-red-500' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500' }`} value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} autoFocus /> </div> {cashConfirmationError && (<p className="text-xs text-red-600 mt-1 flex items-center gap-1"><AlertCircle size={14} /> {cashConfirmationError}</p>)} {amountPaid && Number.parseFloat(amountPaid) >= calculateTotal() && ( <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1}} className="bg-green-50 p-2 rounded-md text-center mt-2 border border-green-200"> <span className="text-sm text-green-700 block">Cambio</span> <span className="text-xl font-bold text-green-600">${(Number.parseFloat(amountPaid) - calculateTotal()).toFixed(2)}</span> </motion.div> )} </div> )} {paymentMethod === "mercadoPagoQR" && ( <div className="text-center py-3"> {isGeneratingQR && ( <div className="flex flex-col items-center text-gray-500 py-5"><Loader2 className="h-6 w-6 animate-spin mb-2" /><p className="text-sm">Generando QR...</p></div> )} {qrError && ( <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm text-left"><p className="font-medium mb-1 flex items-center gap-1"><AlertTriangle size={16}/> Error:</p><p className="text-xs">{qrError}</p><button onClick={generateMercadoPagoQrCode} className="mt-2 text-xs text-blue-600 hover:underline font-medium">Reintentar</button></div> )} {mercadoPagoQrUrl && !isGeneratingQR && !qrError && ( <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1}} className="flex flex-col items-center"><p className="mb-2 text-sm text-gray-600 font-medium">Escanear con App MP:</p><img src={mercadoPagoQrUrl} alt="Código QR Mercado Pago" className="w-48 h-48 border-2 p-0.5 rounded-md" /></motion.div> )} </div> )} </div> <div className="mt-6 flex gap-3"> <button onClick={() => setShowPaymentModal(false)} className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm font-medium"> Cancelar </button> <button onClick={handleCompletePayment} disabled={ isConfirmingCash || (paymentMethod === 'efectivo' && (!amountPaid || Number.parseFloat(amountPaid) < calculateTotal())) || (paymentMethod === 'mercadoPagoQR' && (isGeneratingQR || !!qrError || !mercadoPagoQrUrl)) } className={`flex-1 px-4 py-2 rounded-md text-white flex items-center justify-center gap-1.5 text-sm font-medium transition ${ isConfirmingCash ? 'bg-yellow-500 cursor-wait' : (paymentMethod === 'efectivo' && (!amountPaid || Number.parseFloat(amountPaid) < calculateTotal())) || (paymentMethod === 'mercadoPagoQR' && (isGeneratingQR || !!qrError || !mercadoPagoQrUrl)) ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 active:bg-green-800' }`}> {isConfirmingCash ? <Loader2 className="h-4 w-4 animate-spin"/> : <CheckCircle className="h-4 w-4" />} <span>{isConfirmingCash ? 'Confirmando...' : (paymentMethod === 'mercadoPagoQR' ? 'Completar (MP)' : 'Completar Venta')}</span> </button> </div> </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div> // Fin Div Principal
  ); // Fin Return
}; // Fin Componente

export default PointOfSale;
