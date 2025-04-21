import { useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, ArrowLeft, MapPin } from 'lucide-react';
import supabase from '../../lib/supabaseClient'; // Asegúrate que la ruta es correcta desde este archivo
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import AppointmentScheduler from './AppointmentScheduler';
import Recetas from './Recetas';
import EREBUS from './EREBUS'; // <<<--- 1. IMPORTADO EREBUS (Ajusta la ruta si es necesario)

// Fix para los iconos de Leaflet en producción
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

interface Pharmacy {
  id: string;
  nombre: string;
  ubicacion: string; // Esperamos "lat,lon" como string
  telefono: string;
  horario_atencion: string;
  key_lux: string; // No usado actualmente en el panel
  id_administrador: string; // No usado actualmente en el panel
}

interface ContentPanelProps {
  // <<<--- 2. ACTUALIZADO TIPO DE VIEW (Añadido EREBUS, quitado home)
  view: 'appointments' | 'medications' | 'pharmacies' | 'EREBUS';
  // <<<--- Considera pasar más props si los componentes hijos las necesitan (e.g., patientId)
  patientId?: string; // Ejemplo de prop adicional
  onClose: () => void; // onClose sigue siendo útil para el botón de volver en Farmacias
}

// <<<--- Considera recibir props adicionales aquí si son necesarias
const ContentPanel = ({ view, onClose, patientId }: ContentPanelProps) => {
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [loadingPharmacies, setLoadingPharmacies] = useState<boolean>(false); // Estado de carga
  const [errorPharmacies, setErrorPharmacies] = useState<string | null>(null); // Estado de error
  const [selectedPharmacyId, setSelectedPharmacyId] = useState<string | null>(null); // Usar string para ID
  // const [mapCenter, setMapCenter] = useState<[number, number]>([19.370442, -99.175322]); // El centro se actualiza dinámicamente

  // Referencias para el mapa
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // --- Efectos y Lógica para Farmacias ---

  // Cargar farmacias solo cuando la vista es 'pharmacies'
  useEffect(() => {
    if (view === 'pharmacies') {
      const fetchPharmacies = async () => {
        setLoadingPharmacies(true);
        setErrorPharmacies(null);
        const { data, error } = await supabase
          .from('farmacias')
          .select('*');

        if (error) {
          console.error('Error fetching pharmacies:', error);
          setErrorPharmacies('No se pudieron cargar las farmacias.');
        } else if (data) {
          setPharmacies(data as Pharmacy[]); // Asegurar el tipo
        }
        setLoadingPharmacies(false);
      };

      fetchPharmacies();
    } else {
      // Limpiar farmacias si la vista cambia para evitar mostrar datos viejos brevemente
      setPharmacies([]);
    }
  }, [view]); // Dependencia: 'view'

  // Inicializar o destruir mapa basado en la vista 'pharmacies'
  useEffect(() => {
    let mapInstance: L.Map | null = null;

    if (view === 'pharmacies' && mapContainerRef.current && !mapRef.current) {
      const defaultLocation: [number, number] = [19.4326, -99.1332]; // Centro de CDMX como default
      mapInstance = L.map(mapContainerRef.current, {
          // Opciones adicionales si son necesarias
      }).setView(defaultLocation, 12); // Zoom un poco más alejado inicialmente

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19, // Limitar zoom máximo
      }).addTo(mapInstance);

      mapRef.current = mapInstance;

      // Forzar invalidación de tamaño después de un breve retraso
      // Esto ayuda si el contenedor del mapa no era visible inmediatamente
      const timerId = setTimeout(() => {
        mapInstance?.invalidateSize();
      }, 150); // Un poco más de tiempo

      // Limpieza del timeout si el componente se desmonta antes
      return () => clearTimeout(timerId);
    }

    // Función de limpieza para cuando la vista cambia o el componente se desmonta
    return () => {
      if (mapRef.current) {
        mapRef.current.remove(); // Destruir instancia del mapa
        mapRef.current = null;
        markerRef.current = null; // Limpiar referencia al marcador
      }
    };
  }, [view]); // Re-ejecutar solo si la vista cambia

  // Manejar clic en farmacia
  const handlePharmacyClick = (pharmacy: Pharmacy) => {
    try {
      setSelectedPharmacyId(pharmacy.id); // Usar ID como string

      // Validar y parsear ubicación
      if (!pharmacy.ubicacion || typeof pharmacy.ubicacion !== 'string') {
        console.error('Dato de ubicación inválido:', pharmacy.ubicacion);
        alert('La ubicación de esta farmacia no está disponible.');
        return;
      }

      const coords = pharmacy.ubicacion.split(',');
      if (coords.length !== 2) {
        console.error('Formato de ubicación incorrecto (debe ser "lat,lon"):', pharmacy.ubicacion);
        alert('El formato de la ubicación es incorrecto.');
        return;
      }

      const lat = parseFloat(coords[0].trim());
      const lon = parseFloat(coords[1].trim());

      if (isNaN(lat) || isNaN(lon)) {
        console.error('Latitud o longitud inválida:', pharmacy.ubicacion);
        alert('Las coordenadas de la ubicación son inválidas.');
        return;
      }

      const newCenter: [number, number] = [lat, lon];
      // setMapCenter(newCenter); // No es necesario si usamos flyTo directamente

      if (mapRef.current) {
        // Mover el mapa suavemente
        mapRef.current.flyTo(newCenter, 16); // Zoom más cercano al seleccionar

        // Eliminar marcador anterior si existe
        if (markerRef.current) {
          mapRef.current.removeLayer(markerRef.current);
        }

        // Añadir nuevo marcador y abrir popup
        const newMarker = L.marker(newCenter).addTo(mapRef.current);
        newMarker.bindPopup(`<b>${pharmacy.nombre}</b>`).openPopup(); // Popup más simple

        // Guardar referencia al nuevo marcador
        markerRef.current = newMarker;
      }
    } catch (error) {
      console.error('Error al manejar clic en farmacia:', error);
      alert('Ocurrió un error al seleccionar la farmacia.');
    }
  };

  // --- Renderizado Específico para Farmacias ---
  const renderPharmacyMap = () => {
    return (
      // Añadir un contenedor con padding y fondo blanco si no lo tiene el padre
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {/* Header de la sección */}
        <div className="p-4 md:p-5 border-b border-gray-200 flex items-center">
           {/* Botón de volver (opcional si siempre se muestra el sidebar/nav) */}
          {/* <button onClick={onClose} className="mr-3 text-gray-500 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100">
            <ArrowLeft className="h-5 w-5" />
          </button> */}
          <h3 className="text-lg font-semibold text-gray-800">Farmacias Cercanas</h3>
        </div>

        {/* Contenido principal de farmacias */}
        <div className="p-4 md:p-5">
          {/* Mapa */}
          <div className="mb-6 rounded-lg overflow-hidden border border-gray-200">
            <div
              ref={mapContainerRef}
              className="h-64 md:h-80 w-full bg-gray-100" // Fondo mientras carga
              aria-label="Mapa de farmacias"
            />
          </div>

          {/* Lista de Farmacias */}
          {loadingPharmacies && <p className="text-center text-gray-600 py-4">Cargando farmacias...</p>}
          {errorPharmacies && <p className="text-center text-red-600 py-4">{errorPharmacies}</p>}
          {!loadingPharmacies && !errorPharmacies && pharmacies.length === 0 && (
              <p className="text-center text-gray-500 py-4">No hay farmacias disponibles.</p>
          )}
          {!loadingPharmacies && !errorPharmacies && pharmacies.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {pharmacies.map((pharmacy) => (
                <div
                  key={`pharmacy-${pharmacy.id}`}
                  onClick={() => handlePharmacyClick(pharmacy)}
                  className={`bg-white rounded-lg border ${
                    selectedPharmacyId === pharmacy.id ? 'border-primary ring-2 ring-primary/50' : 'border-gray-200'
                  } hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden`}
                  role="button"
                  tabIndex={0} // Hacerlo enfocable
                  onKeyPress={(e) => e.key === 'Enter' && handlePharmacyClick(pharmacy)} // Accesibilidad
                >
                  <div className="p-4">
                    <h4 className="text-base font-semibold text-gray-800 truncate mb-2">{pharmacy.nombre}</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-start text-gray-600">
                        <MapPin className="h-4 w-4 text-gray-400 mt-0.5 mr-2 flex-shrink-0" />
                        <span className="line-clamp-2">{pharmacy.ubicacion}</span> {/* Cortar texto largo */}
                      </div>
                      <div className="flex items-center text-gray-600">
                        <CalendarIcon className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" />
                        <span>{pharmacy.horario_atencion || 'No especificado'}</span>
                      </div>
                      {pharmacy.telefono && (
                           <div className="text-gray-600">
                             Tel: {pharmacy.telefono}
                           </div>
                       )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
           )}
        </div>
      </div>
    );
  };

  // --- Switch Principal para Renderizado ---
  switch (view) {
    case 'appointments':
      // Pasar props si AppointmentScheduler las necesita (e.g., patientId)
      return <AppointmentScheduler /* patientId={patientId} */ />;
    case 'medications':
      // Pasar props si Recetas las necesita (e.g., patientId)
      return <Recetas /* patientId={patientId} */ />;
    case 'pharmacies':
      return renderPharmacyMap();
    // <<<--- 4. AÑADIDO CASO EREBUS ---
    case 'EREBUS':
      // Pasar props si EREBUS las necesita (e.g., patientId)
      return <EREBUS /* patientId={patientId} */ />;
    // <<<--- 5. ELIMINADO CASO 'home' ---
    // case 'home':
    //   return renderHomeContent(); // Ya no se maneja aquí
    // <<<--- 6. AÑADIDO DEFAULT ---
    default:
      console.warn(`ContentPanel recibió una vista desconocida: ${view}`);
      return (
         <div className="p-6 bg-white rounded-xl shadow-md text-center text-gray-500">
             Contenido no disponible para esta sección.
         </div>
      );
  }
};

export default ContentPanel;
