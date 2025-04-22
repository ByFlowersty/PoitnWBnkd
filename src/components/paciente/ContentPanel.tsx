import { useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, ArrowLeft, MapPin } from 'lucide-react';
import supabase from '../../lib/supabaseClient';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import AppointmentScheduler from './AppointmentScheduler';
import Recetas from './Recetas';
import EREBUS from './EREBUS';

// ... (resto de imports y fix de iconos de Leaflet) ...

interface Pharmacy {
  id: string;
  nombre: string;
  ubicacion: string; // Puede ser "lat,lon" o una dirección completa
  telefono: string;
  horario_atencion: string;
  key_lux: string;
  id_administrador: string;
  // Campos opcionales para almacenar coordenadas cacheadas en el estado
  lat?: number;
  lon?: number;
}

// ... (resto de la interfaz ContentPanelProps) ...

const ContentPanel = ({ view, onClose, patientId }: ContentPanelProps) => {
  // Mantén el tipo original, pero podrías añadir lat/lon opcionales si cacheas
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [loadingPharmacies, setLoadingPharmacies] = useState<boolean>(false);
  const [errorPharmacies, setErrorPharmacies] = useState<string | null>(null);
  const [selectedPharmacyId, setSelectedPharmacyId] = useState<string | null>(null);
  const [isGeocoding, setIsGeocoding] = useState<boolean>(false); // Estado para indicar carga de geocodificación

  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // ... (useEffect para fetchPharmacies - sin cambios aquí, la geocodificación se hará al hacer clic) ...
  useEffect(() => {
    if (view === 'pharmacies') {
      const fetchPharmacies = async () => {
        setLoadingPharmacies(true);
        setErrorPharmacies(null);
        setIsGeocoding(false); // Reset geocoding state
        setSelectedPharmacyId(null); // Reset selection
        const { data, error } = await supabase
          .from('farmacias')
          .select('*');

        if (error) {
          console.error('Error fetching pharmacies:', error);
          setErrorPharmacies('No se pudieron cargar las farmacias.');
        } else if (data) {
          // Aquí NO hacemos geocodificación aún, solo cargamos los datos
          setPharmacies(data as Pharmacy[]);
        }
        setLoadingPharmacies(false);
      };

      fetchPharmacies();
    } else {
      setPharmacies([]);
    }
  }, [view]);

  // ... (useEffect para inicializar/destruir mapa - sin cambios) ...
  useEffect(() => {
    let mapInstance: L.Map | null = null;
    // ... (resto del código de inicialización del mapa) ...
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  }, [view]);


  // --- MODIFICADO: Manejar clic en farmacia con geocodificación ---
  const handlePharmacyClick = async (pharmacy: Pharmacy) => { // <--- Hacer async
    if (isGeocoding) return; // Evitar clics múltiples mientras se geocodifica

    setSelectedPharmacyId(pharmacy.id);
    let lat: number | null = null;
    let lon: number | null = null;
    let addressToDisplay = pharmacy.ubicacion; // Guardar la dirección original para el popup

    try {
      // 1. Intentar parsear como "lat,lon" primero
      if (pharmacy.ubicacion && pharmacy.ubicacion.includes(',')) {
        const coords = pharmacy.ubicacion.split(',');
        if (coords.length === 2) {
          const parsedLat = parseFloat(coords[0].trim());
          const parsedLon = parseFloat(coords[1].trim());
          if (!isNaN(parsedLat) && !isNaN(parsedLon)) {
            lat = parsedLat;
            lon = parsedLon;
            console.log(`Usando coordenadas existentes para ${pharmacy.nombre}:`, lat, lon);
          }
        }
      }

      // 2. Si no se parseó o no era formato lat,lon, intentar geocodificar
      if (lat === null || lon === null) {
        if (!pharmacy.ubicacion || typeof pharmacy.ubicacion !== 'string' || pharmacy.ubicacion.trim() === '') {
          console.error('Dirección inválida o vacía:', pharmacy.ubicacion);
          alert('La dirección de esta farmacia no es válida.');
          return;
        }

        // Si tenemos lat/lon cacheados en el estado, usarlos (opcional pero mejora UX)
        if (pharmacy.lat && pharmacy.lon) {
            lat = pharmacy.lat;
            lon = pharmacy.lon;
            console.log(`Usando coordenadas cacheadas para ${pharmacy.nombre}:`, lat, lon);
        } else {
            // Geocodificar usando Nominatim
            console.log(`Geocodificando dirección para ${pharmacy.nombre}:`, pharmacy.ubicacion);
            setIsGeocoding(true); // Indicar que estamos buscando coords

            try {
              const encodedAddress = encodeURIComponent(pharmacy.ubicacion);
              // IMPORTANTE: Cambia 'TuAppNombre/1.0 (tuemail@dominio.com)' por info real.
              //             Es requerido por la política de uso de Nominatim.
              const response = await fetch(
                `https://nominatim.openstreetmap.org/search?q=${encodedAddress}&format=json&limit=1&countrycodes=mx`, // Limitar a México (opcional)
                {
                  method: 'GET',
                  headers: {
                    'User-Agent': 'MIA_App/1.0 (soporte@mia-salud.com)' // ¡¡CAMBIA ESTO!!
                  }
                }
              );

              if (!response.ok) {
                throw new Error(`Error de red [${response.status}]: ${response.statusText}`);
              }

              const data = await response.json();

              if (data && data.length > 0) {
                lat = parseFloat(data[0].lat);
                lon = parseFloat(data[0].lon);
                console.log('Geocodificación exitosa:', lat, lon);

                // Opcional: Actualizar el estado para cachear las coordenadas
                // Esto evita volver a llamar a la API si se hace clic de nuevo
                setPharmacies(prevPharmacies =>
                  prevPharmacies.map(p =>
                    p.id === pharmacy.id ? { ...p, lat: lat, lon: lon } : p
                  )
                );

              } else {
                console.error('No se encontraron coordenadas para:', pharmacy.ubicacion);
                alert(`No se pudieron encontrar las coordenadas para la dirección:\n${pharmacy.ubicacion}`);
                setIsGeocoding(false);
                return; // Detener si no se encontraron coordenadas
              }
            } catch (geoError: any) {
              console.error('Error durante la geocodificación:', geoError);
              alert(`Ocurrió un error al buscar la ubicación: ${geoError.message}`);
              setIsGeocoding(false);
              return; // Detener en caso de error
            } finally {
              setIsGeocoding(false); // Asegurarse de quitar el estado de carga
            }
        } // Fin del else (necesidad de geocodificar)
      } // Fin del if (lat o lon eran null)


      // 3. Si tenemos coordenadas (parseadas o geocodificadas), mover el mapa
      if (lat !== null && lon !== null) {
        const newCenter: [number, number] = [lat, lon];

        if (mapRef.current) {
          mapRef.current.flyTo(newCenter, 16); // Zoom más cercano

          if (markerRef.current) {
            mapRef.current.removeLayer(markerRef.current);
          }

          const newMarker = L.marker(newCenter).addTo(mapRef.current);
          // Mostrar nombre y dirección original en el popup
          newMarker.bindPopup(`<b>${pharmacy.nombre}</b><br>${addressToDisplay}`).openPopup();
          markerRef.current = newMarker;
        }
      } else {
        // Esto no debería ocurrir si la lógica anterior es correcta, pero por si acaso
        console.error('Error inesperado: No se obtuvieron coordenadas válidas para', pharmacy.nombre);
        alert('No se pudo mostrar la farmacia en el mapa.');
      }

    } catch (error) {
      console.error('Error general al manejar clic en farmacia:', error);
      alert('Ocurrió un error inesperado al seleccionar la farmacia.');
      setIsGeocoding(false); // Asegurarse de resetear el estado de carga
    }
  };

  // --- Renderizado Específico para Farmacias ---
  const renderPharmacyMap = () => {
    // ... (Inicio del JSX del contenedor, header, mapa) ...
          <div className="mb-6 rounded-lg overflow-hidden border border-gray-200 relative"> {/* Añadir relative para el loader */}
            <div
              ref={mapContainerRef}
              className="h-64 md:h-80 w-full bg-gray-100"
              aria-label="Mapa de farmacias"
            />
            {isGeocoding && ( // Mostrar overlay de carga sobre el mapa si aplica (o en otro lugar)
              <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
                <div className="text-center">
                   {/* Puedes usar un spinner aquí */}
                  <p className="text-lg font-semibold text-gray-700 animate-pulse">Buscando ubicación...</p>
                </div>
              </div>
            )}
          </div>


          {/* Lista de Farmacias */}
          {/* ... (resto del código de renderizado de la lista, sin cambios significativos) ... */}
          {/* Podrías añadir un indicador visual si isGeocoding es true y selectedPharmacyId coincide */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {pharmacies.map((pharmacy) => (
                <div
                  key={`pharmacy-${pharmacy.id}`}
                  onClick={() => handlePharmacyClick(pharmacy)}
                  className={`bg-white rounded-lg border ${
                    selectedPharmacyId === pharmacy.id ? 'border-primary ring-2 ring-primary/50' : 'border-gray-200'
                  } hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden ${isGeocoding && selectedPharmacyId === pharmacy.id ? 'opacity-50 cursor-wait' : ''}`} // <- Estilo de carga opcional
                  role="button"
                  tabIndex={isGeocoding ? -1 : 0} // Deshabilitar tabulación mientras carga
                  aria-disabled={isGeocoding && selectedPharmacyId === pharmacy.id} // Indicar que está deshabilitado temporalmente
                  onKeyPress={(e) => !isGeocoding && e.key === 'Enter' && handlePharmacyClick(pharmacy)} // Accesibilidad
                >
                  {/* ... Contenido de la tarjeta de farmacia ... */}
                  <div className="p-4">
                    <h4 className="text-base font-semibold text-gray-800 truncate mb-2">{pharmacy.nombre}</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-start text-gray-600">
                        <MapPin className="h-4 w-4 text-gray-400 mt-0.5 mr-2 flex-shrink-0" />
                        {/* Mostrar siempre la dirección original */}
                        <span className="line-clamp-2">{pharmacy.ubicacion}</span>
                      </div>
                      {/* ... Resto de detalles (horario, teléfono) ... */}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          {/* ... (Cierre del renderPharmacyMap y del componente) ... */}
  };

  // ... (Switch principal y exportación del componente) ...
  switch (view) {
    case 'appointments':
      return <AppointmentScheduler />;
    case 'medications':
      return <Recetas />;
    case 'pharmacies':
      return renderPharmacyMap();
    case 'EREBUS':
      return <EREBUS />;
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
