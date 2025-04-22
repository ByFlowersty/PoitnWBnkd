import { useState, type ChangeEvent, type FormEvent, useRef, useEffect, useCallback } from "react"; // Added useRef, useEffect, useCallback
import { Link, useNavigate } from "react-router-dom";
import supabase from "../lib/supabaseClient"; // Adjust path if needed
import { FcGoogle } from "react-icons/fc";
import { Button } from "../components/ui/button"; // Keep existing
import { Input } from "../components/ui/input";   // Keep existing
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "../components/ui/card"; // Keep existing
import {
  EyeIcon,
  EyeOffIcon,
  UserIcon,
  MailIcon,
  LockIcon,
  PhoneIcon,
  CalendarIcon,
  DropletIcon,     // Icon for blood type
  ShieldAlertIcon, // Icon for allergies
  Camera,          // Icon for Camera actions
  X as XIcon,      // Using alias for X icon
  UploadCloud,     // For upload status indication
} from "lucide-react"; // Assuming lucide-react is installed and OK
import toast from 'react-hot-toast'; // Added for camera/upload feedback

// --- Interfaces ---
interface FormData {
  nombre_completo: string;
  email: string;
  password: string;
  telefono: string;
  date_of_birth: string;
  gender: string;
}

// --- Constants ---
const bloodTypes = ['A+', 'A-', 'AB+', 'AB-', 'B+', 'B-', 'O+', 'O-'] as const;
type BloodType = typeof bloodTypes[number] | "";

// --- Helper Function ---
function dataURLtoBlob(dataurl: string): Blob | null {
    try {
        const arr = dataurl.split(',');
        if (arr.length < 2) return null;
        const mimeMatch = arr[0].match(/:(.*?);/);
        if (!mimeMatch || mimeMatch.length < 2) return null;
        const mime = mimeMatch[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while(n--){ u8arr[n] = bstr.charCodeAt(n); }
        return new Blob([u8arr], {type:mime});
    } catch (e) { console.error("Error converting data URL to Blob:", e); return null; }
}

// --- Component ---
export default function Register() {
  // --- State ---
  const [formData, setFormData] = useState<FormData>({
    nombre_completo: "", email: "", password: "", telefono: "", date_of_birth: "", gender: "",
  });
  const [message, setMessage] = useState({ text: "", type: "" });
  const [selectedRole, setSelectedRole] = useState("paciente");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Patient Specific State (Step 2)
  const [bloodType, setBloodType] = useState<BloodType>("");
  const [allergies, setAllergies] = useState<string>("");

  // Camera State (Replaces file state)
  const [showCameraModal, setShowCameraModal] = useState<boolean>(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null); // Base64 Data URL
  const [isUploadingPhoto, setIsUploadingPhoto] = useState<boolean>(false); // Track photo upload separately

  // --- Hooks ---
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null); // Ref for video element
  const canvasRef = useRef<HTMLCanvasElement>(null); // Ref for canvas element (hidden)

  // --- Handlers ---
  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    if (name in formData) { setFormData(prev => ({ ...prev, [name]: value })); }
    else if (name === "allergies") { setAllergies(value); }
    else if (name === "blood_type") { setBloodType(value as BloodType); }
    else if (name === "gender") { setFormData(prev => ({ ...prev, gender: value })); }
  };

  // --- Camera Functions ---
  const startCamera = async () => {
      setMessage({ text: "", type: "" }); // Clear previous messages
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          toast.error("Tu navegador no soporta el acceso a la cámara.");
          return;
      }
      setShowCameraModal(true); // Show modal immediately
      try {
          // Try higher resolution first, fallback if needed
          const constraints = { video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false };
          const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
          setCameraStream(mediaStream);
      } catch (err: any) {
          console.error("Error accessing camera:", err.name, err.message);
          // Simplified error handling, refer to Paciente_Interfaz for more details if needed
          let errorMsg = "Error al iniciar la cámara.";
          if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
              errorMsg = "Permiso de cámara denegado. Habilítalo en los ajustes de tu navegador.";
          } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
              errorMsg = "No se encontró ninguna cámara.";
          } else if (err.name === "NotReadableError") {
              errorMsg = "La cámara está en uso por otra aplicación.";
          }
          toast.error(errorMsg);
          setShowCameraModal(false); // Hide modal on error
          setCameraStream(null);
      }
  };

  const stopCamera = useCallback(() => {
      if (cameraStream) {
          cameraStream.getTracks().forEach(track => track.stop());
      }
      if (videoRef.current) {
          videoRef.current.srcObject = null; // Detach stream from video element
      }
      setCameraStream(null);
      setShowCameraModal(false); // Ensure modal is hidden
  }, [cameraStream]);

  const capturePhoto = () => {
      if (videoRef.current && canvasRef.current && cameraStream) {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          const context = canvas.getContext('2d');
          if (context) {
              // Set canvas dimensions to match video stream dimensions
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;

              // Flip the image horizontally for mirror effect
              context.translate(canvas.width, 0);
              context.scale(-1, 1);

              // Draw the video frame onto the canvas
              context.drawImage(video, 0, 0, canvas.width, canvas.height);

              // Reset transformation
              context.setTransform(1, 0, 0, 1, 0, 0);

              // Get the image data as a Base64 encoded PNG
              const dataUrl = canvas.toDataURL('image/png');
              setCapturedImage(dataUrl);
              stopCamera(); // Close camera modal after capture
          } else {
              toast.error("No se pudo obtener el contexto del canvas.");
              stopCamera();
          }
      } else {
          toast.error("La cámara no está lista para capturar.");
          stopCamera();
      }
  };

  // --- Effects ---
  // Effect to connect camera stream to video element
  useEffect(() => {
      if (cameraStream && videoRef.current) {
          videoRef.current.srcObject = cameraStream;
          videoRef.current.play().catch(playError => {
              console.error("Error playing video stream:", playError);
              toast.error("No se pudo mostrar la vista previa de la cámara.");
              stopCamera(); // Stop if playback fails
          });
      }
      // Cleanup function: Stop camera when component unmounts or stream changes
      return () => {
          if (cameraStream && videoRef.current && !videoRef.current.paused) {
               // Optional: Explicitly stop tracks if needed during cleanup
               // cameraStream.getTracks().forEach(track => track.stop());
          }
      };
  }, [cameraStream, stopCamera]); // Add stopCamera dependency

  // Effect for overall component unmount cleanup
   useEffect(() => {
       // Return cleanup function for when the component unmounts
       return () => {
           if (cameraStream) {
               stopCamera(); // Ensure camera is stopped on unmount
           }
       };
   }, [cameraStream, stopCamera]); // Depend on stream and stop function


  const resetPatientStep2State = useCallback(() => {
    setBloodType("");
    setAllergies("");
    setCapturedImage(null); // Clear captured image
    if (cameraStream) { // Stop camera if it was left open somehow
        stopCamera();
    }
    // isUploadingPhoto is handled by submit logic
  }, [cameraStream, stopCamera]); // Add dependencies


  // --- Form Submission ---
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // --- Step 1 Logic ---
    if (step === 1) {
      if (!formData.nombre_completo || !formData.email || !formData.password) { setMessage({ text: "Por favor completa todos los campos obligatorios (*).", type: "error" }); return; }
      const passwordPattern = /^(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;
      if (!passwordPattern.test(formData.password)) { setMessage({ text: "La contraseña debe tener al menos 8 caracteres y un carácter especial.", type: "error" }); return; }
      setMessage({ text: "", type: "" }); setStep(2); return;
    }

    // --- Step 2 Logic ---
    if (!termsAccepted) { setMessage({ text: "Debes aceptar los términos y condiciones para continuar.", type: "error" }); return; }

    setLoading(true); // Overall form loading
    setMessage({ text: "", type: "" });

    try {
      // 1. Sign Up User
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email, password: formData.password, options: { data: { full_name: formData.nombre_completo, role: selectedRole } },
      });
      if (authError) throw authError;
      if (!authData.user) throw new Error("Registro fallido, no se obtuvo el usuario.");
      const userId = authData.user.id;

      // 2. Insert data based on role
      if (selectedRole === "administrador") {
        const { error: adminError } = await supabase.from("administradores").insert([ { id: userId, nombre: formData.nombre_completo, email: formData.email, telefono: formData.telefono || null }, ]);
        if (adminError) throw adminError;
        setMessage({ text: "¡Administrador registrado! Por favor verifica tu email.", type: "success" });
        setFormData({ nombre_completo: "", email: "", password: "", telefono: "", date_of_birth: "", gender: "" });
        setStep(1); setTermsAccepted(false);

      } else if (selectedRole === "paciente") {
        let photoUrl: string | null = null;

        // 2a. Upload Photo (if captured)
        if (capturedImage) {
          setIsUploadingPhoto(true); // Start photo upload indicator
          setMessage({ text: "Subiendo foto...", type: "info" });
          const blob = dataURLtoBlob(capturedImage);

          if (!blob) {
            throw new Error("Error al procesar la imagen capturada.");
          }

          const fileExt = blob.type.split('/')[1] || 'png';
          const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
          const filePath = `${userId}/${fileName}`; // User-specific folder

          // --- REEMPLAZA 'patient-photos' CON TU BUCKET REAL ---
          const bucketName = 'patient-photos';
          console.log(`Uploading to bucket: ${bucketName}, path: ${filePath}`);
          // ------------------------------------------------------

          const { error: uploadError } = await supabase.storage
            .from(bucketName)
            .upload(filePath, blob, { cacheControl: '3600', upsert: false, contentType: blob.type }); // Use blob.type

          setIsUploadingPhoto(false); // Stop photo upload indicator

          if (uploadError) {
            console.error("Photo Upload Error:", uploadError);
            throw new Error(`Error al subir la foto: ${uploadError.message}. Verifica los permisos del bucket.`);
          }

          // --- REEMPLAZA 'patient-photos' CON TU BUCKET REAL ---
          const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(filePath);
          // ------------------------------------------------------
           if (!urlData?.publicUrl) { console.warn("Could not get public URL for uploaded photo."); }
           else { photoUrl = urlData.publicUrl; }
          setMessage({ text: "", type: "" }); // Clear "uploading" message
        }

        // 2b. Prepare Patient Data
        const patientData = {
          user_id: userId, name: formData.nombre_completo, email: formData.email,
          phone: formData.telefono || null, date_of_birth: formData.date_of_birth || null,
          gender: formData.gender || null, blood_type: bloodType || null,
          allergies: allergies || null, Foto_paciente: photoUrl, // Saved URL or null
          created_at: new Date().toISOString(),
        };

        // 2c. Insert Patient Data
        const { error: patientError } = await supabase.from("patients").insert([patientData]);
        if (patientError) throw patientError;

        setMessage({ text: `¡Bienvenido ${formData.nombre_completo}! Revisa tu correo para verificar tu cuenta. Serás redirigido...`, type: "success", });
        resetPatientStep2State(); // Reset patient specific state (including captured image)
        setTimeout(() => { navigate("/paciente", { state: { welcomeMessage: `¡Bienvenido ${formData.nombre_completo}!` } }); }, 3000);
        return;
      }

    } catch (error: any) {
      console.error("Registration Error:", error);
      // Clear captured image on error too
      if (capturedImage && error.message.includes("foto")) {
          setCapturedImage(null);
      }
      setMessage({ text: error.code === '23505' || error.message?.includes('duplicate key value') ? "Este correo electrónico ya está registrado. Intenta iniciar sesión." : error.message?.includes('Email rate limit exceeded') ? "Se ha superado el límite de envío de correos. Intenta más tarde." : error.message || "Error en el registro. Por favor intenta nuevamente.", type: "error", });
    } finally {
      setLoading(false); // Stop overall form loading
      setIsUploadingPhoto(false); // Ensure photo loading indicator is off
    }
  };

  // --- Google Sign Up ---
  const handleGoogleSignUp = async () => {
      // ... (Google sign up logic remains the same - photo/details need post-signup collection)
       setLoading(true); setMessage({ text: "", type: "" }); try { const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/paciente`, queryParams: { access_type: "offline", prompt: "consent" }, }, }); if (error) throw error; } catch (error: any) { console.error("Google Sign Up Error:", error); setMessage({ text: `Error con Google: ${error.message}`, type: "error" }); setLoading(false); }
  };

  // --- Styles ---
  const primaryButtonClasses = "w-full bg-[#29abe2] text-white hover:bg-[#1f8acb] focus-visible:ring-[#29abe2]";
  const googleButtonClasses = "w-full flex items-center justify-center gap-2 py-2 px-4 border border-input rounded-md text-sm font-medium text-foreground bg-background hover:bg-accent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#29abe2]";
  const backButtonClasses = "w-full text-sm text-[#29abe2] hover:text-[#1f8acb] mt-2";
  const inputFocusClass = "focus-visible:ring-[#29abe2]";
  const standardControlClasses = `w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#29abe2] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50`;
  const textareaClasses = standardControlClasses.replace('h-10', 'min-h-[80px]');
  const checkboxFocusClass = "focus:ring-[#29abe2]";
  const textColor = "text-gray-700";
  const labelColor = "text-gray-700";

  // --- Render ---
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-sky-50 to-white p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-sky-100 mb-4"> <img src="/logo.png" alt="Logo" width="64" height="64" className="opacity-90 p-1"/> </div>
          <h1 className="text-3xl font-bold text-gray-900">Carelux Point</h1>
          <p className="text-gray-500 mt-1">Regístrate, es gratis</p>
        </div>

        {/* Registration Card */}
        <Card className="w-full shadow-lg">
           {/* ... CardHeader and Role Selector (same as before) ... */}
           <CardHeader>
             <CardTitle className="text-xl text-center">Crear cuenta</CardTitle>
             <CardDescription className="text-center">
               {step === 1 ? "Ingresa tus datos de acceso" : "Completa tu perfil"}
             </CardDescription>
           </CardHeader>

           {/* Role Selector */}
           <div className="px-6">
             <div className="flex items-center justify-center border-b border-gray-200 mb-4">
               <div onClick={() => { if (!loading) { setSelectedRole("paciente"); setStep(1); setMessage({ text: "", type: "" }); resetPatientStep2State();} }} className={`relative px-4 py-2 text-sm cursor-pointer ${selectedRole === "paciente" ? "text-[#29abe2] font-medium" : "text-gray-600 hover:text-gray-900"}`} > Paciente {selectedRole === "paciente" && (<div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#29abe2] rounded-t"></div>)} </div>
               <div className="h-5 w-px bg-gray-300 mx-1"></div>
               <div onClick={() => { if (!loading) { setSelectedRole("administrador"); setStep(1); setMessage({ text: "", type: "" }); resetPatientStep2State();} }} className={`relative px-4 py-2 text-sm cursor-pointer ${selectedRole === "administrador" ? "text-[#29abe2] font-medium" : "text-gray-600 hover:text-gray-900"}`} > Administrador {selectedRole === "administrador" && (<div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#29abe2] rounded-t"></div>)} </div>
             </div>
           </div>

           {/* Message Area */}
           {message.text && ( <div className={`mx-6 mb-4 p-3 text-sm rounded-md border ${ message.type === "success" ? "bg-green-50 text-green-700 border-green-200" : message.type === "error" ? "bg-red-50 text-red-700 border-red-200" : "bg-blue-50 text-blue-700 border-blue-200" }`} role={message.type === 'error' ? 'alert' : 'status'} > {message.text} </div> )}

          {/* Form Content */}
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* --- STEP 1 FIELDS (Same as before) --- */}
              {step === 1 && (
                 <>
                     {/* Nombre Completo */} <div className="space-y-1"> <label htmlFor="nombre_completo" className={`text-sm font-medium ${labelColor} flex items-center gap-1.5`}> <UserIcon className="h-4 w-4 text-gray-500" /> Nombre Completo * </label> <Input id="nombre_completo" name="nombre_completo" type="text" required value={formData.nombre_completo} onChange={handleChange} disabled={loading} aria-required="true" className={`${inputFocusClass}`} /> </div>
                     {/* Correo Electrónico */} <div className="space-y-1"> <label htmlFor="email" className={`text-sm font-medium ${labelColor} flex items-center gap-1.5`}> <MailIcon className="h-4 w-4 text-gray-500" /> Correo electrónico * </label> <Input id="email" name="email" type="email" required value={formData.email} onChange={handleChange} disabled={loading} aria-required="true" className={`${inputFocusClass}`} /> </div>
                     {/* Contraseña */} <div className="space-y-1"> <label htmlFor="password" className={`text-sm font-medium ${labelColor} flex items-center gap-1.5`}> <LockIcon className="h-4 w-4 text-gray-500" /> Contraseña * </label> <div className="relative"> <Input id="password" name="password" type={showPassword ? "text" : "password"} placeholder="••••••••" required minLength={8} value={formData.password} onChange={handleChange} pattern='^(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$' title="Mínimo 8 caracteres y un símbolo especial." disabled={loading} aria-required="true" aria-describedby="password-hint" className={`${inputFocusClass}`} /> <button type="button" className={`absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 ${checkboxFocusClass} rounded`} onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}> {showPassword ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />} </button> </div> <p id="password-hint" className="text-xs text-gray-500"> Mínimo 8 caracteres y un carácter especial (ej: !, @, #, $).</p> </div>
                 </>
              )}

              {/* --- STEP 2 FIELDS --- */}
              {step === 2 && (
                <>
                  {/* Teléfono (Optional) */} <div className="space-y-1"> <label htmlFor="telefono" className={`text-sm font-medium ${labelColor} flex items-center gap-1.5`}> <PhoneIcon className="h-4 w-4 text-gray-500" /> Teléfono <span className="text-xs text-gray-400">(Opcional)</span> </label> <Input id="telefono" name="telefono" type="tel" value={formData.telefono} onChange={handleChange} disabled={loading} className={`${inputFocusClass}`} /> </div>
                  {/* === Fields only for 'paciente' role in Step 2 === */}
                  {selectedRole === 'paciente' && (
                    <>
                      {/* Fecha Nacimiento */} <div className="space-y-1"> <label htmlFor="date_of_birth" className={`text-sm font-medium ${labelColor} flex items-center gap-1.5`}> <CalendarIcon className="h-4 w-4 text-gray-500" /> Fecha de nacimiento <span className="text-xs text-gray-400">(Opcional)</span> </label> <Input id="date_of_birth" name="date_of_birth" type="date" value={formData.date_of_birth} onChange={handleChange} max={new Date().toISOString().split("T")[0]} disabled={loading} className={`block w-full ${inputFocusClass}`} /> </div>
                      {/* Género */} <div className="space-y-1"> <label htmlFor="gender" className={`text-sm font-medium ${labelColor} block`}> Género <span className="text-xs text-gray-400">(Opcional)</span> </label> <select id="gender" name="gender" value={formData.gender} onChange={handleChange} disabled={loading} className={standardControlClasses}> <option value="">Seleccionar...</option> <option value="masculino">Masculino</option> <option value="femenino">Femenino</option> <option value="otro">Otro</option> <option value="prefiero_no_decir">Prefiero no decir</option> </select> </div>
                      {/* Tipo Sangre */} <div className="space-y-1"> <label htmlFor="blood_type" className={`text-sm font-medium ${labelColor} flex items-center gap-1.5`}> <DropletIcon className="h-4 w-4 text-gray-500" /> Tipo de Sangre <span className="text-xs text-gray-400">(Opcional)</span> </label> <select id="blood_type" name="blood_type" value={bloodType} onChange={handleChange} disabled={loading} className={standardControlClasses} > <option value="">Seleccionar...</option> {bloodTypes.map((type) => (<option key={type} value={type}>{type}</option>))} </select> </div>
                      {/* Alergias */} <div className="space-y-1"> <label htmlFor="allergies" className={`text-sm font-medium ${labelColor} flex items-center gap-1.5`}> <ShieldAlertIcon className="h-4 w-4 text-gray-500" /> Alergias <span className="text-xs text-gray-400">(Opcional, separadas por coma)</span> </label> <textarea id="allergies" name="allergies" rows={3} placeholder="Ej: Penicilina, Polvo, Polen..." value={allergies} onChange={handleChange} disabled={loading} className={textareaClasses} /> </div>

                      {/* Foto Paciente (CAMERA) */}
                      <div className="space-y-2">
                        <label className={`text-sm font-medium ${labelColor} block`}>
                          Foto de Paciente <span className="text-xs text-gray-400">(Opcional)</span>
                        </label>
                        <div className="flex items-center gap-4">
                           {/* Preview Area */}
                            <div className="h-16 w-16 rounded-full border border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-gray-50">
                            {capturedImage ? (
                              <img src={capturedImage} alt="Foto capturada" className="h-full w-full object-cover" />
                            ) : (
                              <UserIcon className="h-8 w-8 text-gray-400" />
                            )}
                          </div>
                          {/* "Tomar Foto" Button */}
                          <Button type="button" variant="outline" onClick={startCamera} disabled={loading || isUploadingPhoto} className={`text-sm ${inputFocusClass}`}>
                             <Camera className="h-4 w-4 mr-2" />
                             {capturedImage ? "Tomar Otra" : "Tomar Foto"}
                          </Button>
                        </div>
                        {isUploadingPhoto && ( <div className="mt-1 flex items-center text-xs text-blue-600"> <UploadCloud className="animate-pulse h-3.5 w-3.5 mr-1" /> Subiendo foto... </div> )}
                      </div>
                    </>
                  )} {/* End patient-only fields */}

                  {/* Terms and Conditions */} <div className="flex items-start mt-4 pt-2"> <input id="terms" type="checkbox" checked={termsAccepted} onChange={() => setTermsAccepted(!termsAccepted)} disabled={loading} className={`h-4 w-4 mt-0.5 text-[#29abe2] ${checkboxFocusClass} border-gray-300 rounded`} /> <label htmlFor="terms" className={`ml-2 block text-sm ${textColor}`}> He leído y acepto los{" "} <Link to="/terms" target="_blank" rel="noopener noreferrer" className="font-medium text-[#29abe2] hover:text-[#1f8acb] hover:underline"> Términos </Link> y la{" "} <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="font-medium text-[#29abe2] hover:text-[#1f8acb] hover:underline"> Política de Privacidad </Link>.* </label> </div>
                </>
              )} {/* End Step 2 */}

              {/* --- ACTION BUTTONS --- */}
              <Button type="submit" className={primaryButtonClasses} disabled={loading || isUploadingPhoto || (step === 2 && !termsAccepted)}>
                {loading ? ( <span className="flex items-center justify-center"><svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> <span>{isUploadingPhoto ? "Subiendo foto..." : (step === 1 ? "Verificando..." : "Registrando...")}</span></span>
                ) : step === 1 ? ( "Continuar" ) : ( "Registrarse" ) }
              </Button>

              {/* Google Sign Up Button */} {step === 1 && selectedRole === "paciente" && ( <> <div className="relative my-4"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div><div className="relative flex justify-center text-sm"><span className="px-2 bg-card text-muted-foreground"> O regístrate con </span></div></div> <button type="button" onClick={handleGoogleSignUp} disabled={loading} className={googleButtonClasses}> <FcGoogle className="h-5 w-5" /><span>Google</span> </button> </> )}
              {/* Back Button */} {step === 2 && ( <button type="button" onClick={() => { setStep(1); setMessage({ text: "", type: "" }); }} disabled={loading} className={backButtonClasses}> Volver al paso anterior </button> )}
            </form>
             {/* Hidden Canvas for capturing photo frame */}
             <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
          </CardContent>

           {/* ... CardFooter and Copyright/Footer Links (same as before) ... */}
           <CardFooter className="flex flex-col items-center space-y-4 pt-4 pb-6"> <p className="text-sm text-center text-gray-600"> ¿Ya tienes una cuenta?{" "} <Link to="/login" className="font-medium text-[#29abe2] hover:text-[#1f8acb] hover:underline"> Iniciar sesión </Link> </p> </CardFooter>
        </Card>

         <div className="mt-8 text-center text-xs text-gray-500"> <p>© {new Date().getFullYear()} Carelux Point. Todos los derechos reservados.</p> <div className="flex justify-center space-x-4 mt-2"> <Link to="/terms" className="hover:text-[#29abe2] hover:underline">Términos</Link> <Link to="/privacy" className="hover:text-[#29abe2] hover:underline">Privacidad</Link> <Link to="/help" className="hover:text-[#29abe2] hover:underline">Ayuda</Link> </div> </div>

      </div> {/* End max-w-md */}

        {/* --- CAMERA MODAL --- */}
        {showCameraModal && (
           <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4 backdrop-blur-sm">
               <div className="bg-white p-4 sm:p-6 rounded-lg shadow-xl max-w-sm w-full mx-auto border border-gray-200">
                   <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4 text-center">Tomar Foto</h3>
                   {/* Video Preview Container */}
                   <div className="relative w-full aspect-[9/16] bg-gray-900 rounded overflow-hidden mb-4 border border-gray-300">
                       <video
                           ref={videoRef}
                           playsInline // Important for mobile devices
                           autoPlay // Start playing automatically once stream is attached
                           muted // Mute audio to avoid feedback loops if audio was enabled
                           className="absolute inset-0 w-full h-full object-cover"
                           style={{ transform: 'scaleX(-1)' }} // Mirror effect
                       ></video>
                       {!cameraStream && (
                           <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm font-medium">
                               Iniciando cámara...
                           </div>
                       )}
                   </div>
                   {/* Action Buttons */}
                   <div className="flex justify-center space-x-4">
                       <button
                           type="button"
                           onClick={capturePhoto}
                           disabled={!cameraStream} // Disable if stream isn't ready
                           className="inline-flex items-center justify-center px-5 py-2 border border-transparent rounded-full shadow-sm text-base font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                           aria-label="Capturar Foto"
                       >
                           <Camera className="h-5 w-5" />
                       </button>
                       <button
                           type="button"
                           onClick={stopCamera} // Use stopCamera to close modal
                           className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                       >
                           Cancelar
                       </button>
                   </div>
               </div>
           </div>
       )}
       {/* --- END CAMERA MODAL --- */}

    </div> // End container div
  );
}
