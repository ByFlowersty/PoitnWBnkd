import React, { useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, ArrowLeft, MapPin } from 'lucide-react';
import supabase from '../../lib/supabaseClient'; // Asegúrate que la ruta es correcta
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import AppointmentScheduler from './AppointmentScheduler';
import Recetas from './Recetas';
import EREBUS from './EREBUS'; // Asegúrate que la ruta es correcta

// Fix para los iconos de Leaflet en producción con algunos bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

interface Pharmacy {
  id: string; // Asegúrate que el ID es realmente único
  nombre: string;
  ubicacion: string;
  telefono: string;
  horario_atencion: string;
  key_lux: string;
  id_administrador: string;
  lat?: number;
  lon?: number;
}

interface ContentPanelProps {
  view: 'appointments' | 'medications' | 'pharmacies' | 'EREBUS';
  patientId?: string;
  onClose: () => void;
}

const ContentPanel: React.FC<ContentPanelProps> = ({ view, onClose, patientId }) => {
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [loadingPharmacies, setLoadingPharmacies] = useState<boolean>(false);
  const [errorPharmacies, setErrorPharmacies] = useState<string | null>(null);
  const [selectedPharmacyId, setSelectedPharmacyId] = useState<string | null>(null);
  const [isGeocoding, setIsGeocoding] = useState<boolean>(false);

  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // --- Efectos y Lógica para Farmacias ---

  useEffect(() => {
    if (view === 'pharmacies') {
      const fetchPharmacies = async () => {
        setLoadingPharmacies(true);
        setErrorPharmacies(null);
        setIsGeocoding(false);
        setSelectedPharmacyId(null);
        const { data, error } = await supabase
          .from('farmacias') // Confirma nombre de tabla
          .select('*');

        if (error) {
          console.error('Error fetching pharmacies:', error);
          setErrorPharmacies('No se pudieron cargar las farmacias.');
        } else if (data) {
          // Asegurarse que el ID sea string y filtrar duplicados (como medida temporal si la BD no está limpia)
          const uniquePharmacies = data.reduce((acc, current) => {
            const x = acc.find(item => String(item.id) === String(current.id));
            if (!x) {
              return acc.concat([{ ...current, id: String(current.id) }]);
            } else {
              console.warn(`ID Duplicado encontrado y omitido en frontend: ${current.id}`);
              return acc;
            }
          }, [] as any[]); // Tipar correctamente si es posible
          setPharmacies(uniquePharmacies as Pharmacy[]);

        }
        setLoadingPharmacies(false);
      };

      fetchPharmacies();
    } else {
      setPharmacies([]);
    }
  }, [view]);

  useEffect(() => {
    let mapInstance: L.Map | null = null;
    if (view === 'pharmacies' && mapContainerRef.current && !mapRef.current) {
      const defaultLocation: L.LatLngTuple = [19.4326, -99.1332];
      mapInstance = L.map(mapContainerRef.current).setView(defaultLocation, 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(mapInstance);
      mapRef.current = mapInstance;
      const timerId = setTimeout(() => mapInstance?.invalidateSize(), 150);
      return () => clearTimeout(timerId);
    }
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  }, [view]);

  const handlePharmacyClick = async (pharmacy: Pharmacy) => {
    if (isGeocoding) return;
    console.log(`Clic en farmacia ID: ${pharmacy.id}, Nombre: ${pharmacy.nombre}`); // Log de clic
    setSelectedPharmacyId(pharmacy.id); // <-- Aquí se establece el ID seleccionado
    let lat: number | null = null;
    let lon: number | null = null;
    let addressToDisplay = pharmacy.ubicacion || 'Ubicación no disponible';

    try {
      if (pharmacy.ubicacion && pharmacy.ubicacion.includes(',')) {
        const coords = pharmacy.ubicacion.split(',');
        if (coords.length === 2) {
          const parsedLat = parseFloat(coords[0].trim());
          const parsedLon = parseFloat(coords[1].trim());
          if (!isNaN(parsedLat) && !isNaN(parsedLon) && parsedLat >= -90 && parsedLat <= 90 && parsedLon >= -180 && parsedLon <= 180) {
            lat = parsedLat;
            lon = parsedLon;
          }
        }
      }

      if (lat === null || lon === null) {
        if (pharmacy.lat && pharmacy.lon) {
          lat = pharmacy.lat;
          lon = pharmacy.lon;
        } else {
          if (!pharmacy.ubicacion || typeof pharmacy.ubicacion !== 'string' || pharmacy.ubicacion.trim() === '') {
            alert('La dirección de esta farmacia no es válida o está vacía.');
            return;
          }
          setIsGeocoding(true);
          try {
            const encodedAddress = encodeURIComponent(pharmacy.ubicacion);
            const response = await fetch(
              `https://nominatim.openstreetmap.org/search?q=${encodedAddress}&format=json&limit=1&countrycodes=mx`,
              {
                method: 'GET',
                headers: {
                    // IMPORTANTE: ¡¡CAMBIA ESTO!! Usa un User-Agent descriptivo y tu email.
                  'User-Agent': 'MIA_App/1.0 (soporte@mia-salud.com)' // ¡¡CAMBIA ESTO!!
                }
              }
            );
            if (!response.ok) throw new Error(`Error de red [${response.status}]: ${response.statusText}`);
            const data = await response.json();
            if (data && data.length > 0 && data[0].lat && data[0].lon) {
              lat = parseFloat(data[0].lat);
              lon = parseFloat(data[0].lon);
              setPharmacies(prev => prev.map(p => p.id === pharmacy.id ? { ...p, lat: lat, lon: lon } : p));
            } else {
              alert(`No se pudieron encontrar las coordenadas para la dirección:\n${addressToDisplay}`);
              lat = null; lon = null;
            }
          } catch (geoError: any) {
            alert(`Ocurrió un error al buscar la ubicación: ${geoError.message}`);
            lat = null; lon = null;
          } finally {
            setIsGeocoding(false);
          }
        }
      }

      if (lat !== null && lon !== null) {
        const newCenter: L.LatLngTuple = [lat, lon];
        if (mapRef.current) {
          mapRef.current.flyTo(newCenter, 16);
          if (markerRef.current) mapRef.current.removeLayer(markerRef.current);
          const newMarker = L.marker(newCenter).addTo(mapRef.current);
          newMarker.bindPopup(`<b>${pharmacy.nombre}</b><br>${addressToDisplay}`).openPopup();
          markerRef.current = newMarker;
        }
      } else if (!isGeocoding) {
         if (mapRef.current && markerRef.current) {
            mapRef.current.removeLayer(markerRef.current);
            markerRef.current = null;
         }
      }
    } catch (error) {
      console.error('Error general al manejar clic en farmacia:', error);
      alert('Ocurrió un error inesperado al seleccionar la farmacia.');
      setIsGeocoding(false);
    }
  };

  const renderPharmacyMap = () => {
    // --- LOGS PARA DEPURAR IDS DUPLICADOS ---
    console.log("--- Renderizando lista de farmacias ---");
    console.log("ID seleccionado:", selectedPharmacyId);
    const pharmacyIds = pharmacies.map(p => p.id);
    console.log("Todos los IDs en el estado:", pharmacyIds);
    const duplicateIds = pharmacyIds.filter((item, index) => pharmacyIds.indexOf(item) !== index);
    if (duplicateIds.length > 0) {
        console.warn("¡IDs DUPLICADOS ENCONTRADOS EN EL ESTADO!", duplicateIds);
    }
    // --- FIN DE LOGS PARA DEPURACIÓN ---

    return (
      <div className="bg-white rounded-xl shadow-md overflow-hidden h-full flex flex-col">
        <div className="p-4 md:p-5 border-b border-gray-200 flex items-center flex-shrink-0">
          <h3 className="text-lg font-semibold text-gray-800">Farmacias Cercanas</h3>
        </div>
        <div className="flex-grow overflow-y-auto p-4 md:p-5">
          <div className="mb-6 rounded-lg overflow-hidden border border-gray-200 relative">
            <div
              ref={mapContainerRef}
              className="h-64 md:h-80 w-full bg-gray-200"
              aria-label="Mapa de farmacias"
            />
            {isGeocoding && (
              <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10 pointer-events-none">
                <div className="text-center p-4 bg-white rounded shadow">
                  <svg className="animate-spin h-8 w-8 text-primary mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <p className="text-base font-medium text-gray-600">Buscando ubicación...</p>
                </div>
              </div>
            )}
          </div>

          {loadingPharmacies && <div className="text-center text-gray-600 py-10">Cargando farmacias...</div>}
          {errorPharmacies && <div className="text-center text-red-600 bg-red-100 border border-red-400 rounded p-4">{errorPharmacies}</div>}
          {!loadingPharmacies && !errorPharmacies && pharmacies.length === 0 && <div className="text-center text-gray-500 py-10">No hay farmacias disponibles.</div>}
          {!loadingPharmacies && !errorPharmacies && pharmacies.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {pharmacies.map((pharmacy) => {
                // --- LOG PARA VERIFICAR CADA TARJETA ---
                // console.log(`Renderizando tarjeta ID: ${pharmacy.id}, ¿Coincide con seleccionado (${selectedPharmacyId})?`, selectedPharmacyId === pharmacy.id);
                // --- FIN LOG ---
                return (
                  <div
                    // ¡IMPORTANTE! React usa 'key' para identificar elementos. IDs duplicados causan problemas aquí también.
                    // La lógica de filtrado de duplicados en useEffect ayuda, pero lo ideal es arreglar la BD.
                    key={`pharmacy-${pharmacy.id}-${Math.random()}`} // Añadir random como parche temporal si los IDs NO son únicos AÚN
                    onClick={() => handlePharmacyClick(pharmacy)}
                    className={`bg-white rounded-lg border transition-all duration-200 cursor-pointer overflow-hidden flex flex-col
                      ${selectedPharmacyId === pharmacy.id ? 'border-primary ring-2 ring-primary/50 shadow-lg' : 'border-gray-200 hover:shadow-md'}
                      ${isGeocoding && selectedPharmacyId === pharmacy.id ? 'opacity-60 cursor-wait' : 'hover:border-gray-300'}`
                    }
                    role="button"
                    tabIndex={isGeocoding ? -1 : 0}
                    aria-disabled={isGeocoding && selectedPharmacyId === pharmacy.id}
                    onKeyPress={(e) => !isGeocoding && (e.key === 'Enter' || e.key === ' ') && handlePharmacyClick(pharmacy)}
                  >
                    <div className="p-4 flex-grow">
                      <h4 className="text-base font-semibold text-gray-800 truncate mb-2" title={pharmacy.nombre}>{pharmacy.nombre}</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-start text-gray-600" title={pharmacy.ubicacion}>
                          <MapPin className="h-4 w-4 text-gray-400 mt-0.5 mr-2 flex-shrink-0" aria-hidden="true"/>
                          <span className="line-clamp-2">{pharmacy.ubicacion || 'Dirección no especificada'}</span>
                        </div>
                        <div className="flex items-center text-gray-600">
                          <CalendarIcon className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" aria-hidden="true"/>
                          <span>{pharmacy.horario_atencion || 'No especificado'}</span>
                        </div>
                      </div>
                    </div>
                     {pharmacy.telefono && (
                         <div className="p-4 pt-0 text-sm text-gray-600 border-t border-gray-100 mt-auto">
                           Tel: {pharmacy.telefono}
                         </div>
                     )}
                  </div>
                );
              })}
            </div>
           )}
        </div>
      </div>
    );
  };

  switch (view) {
    case 'appointments': return <AppointmentScheduler patientId={patientId} />;
    case 'medications': return <Recetas patientId={patientId} />;
    case 'pharmacies': return renderPharmacyMap();
    case 'EREBUS': return <EREBUS patientId={patientId}/>;
    default:
      const exhaustiveCheck: never = view;
      console.warn(`ContentPanel recibió una vista desconocida: ${exhaustiveCheck}`);
      return (
         <div className="p-6 bg-white rounded-xl shadow-md text-center text-gray-500">
             Contenido no disponible para la sección: {view}.
         </div>
      );
  }
};

export default ContentPanel;
