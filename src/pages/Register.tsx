import { useState, type ChangeEvent, type FormEvent, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import supabase from "../lib/supabaseClient"; // Adjust path if needed
import { FcGoogle } from "react-icons/fc";
import { Button } from "../components/ui/button"; // Assuming shadcn/ui
import { Input } from "../components/ui/input";   // Assuming shadcn/ui
import { Textarea } from "../components/ui/textarea"; // Import Textarea
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select"; // Assuming shadcn/ui Select for blood type
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "../components/ui/card"; // Assuming shadcn/ui
import {
  EyeIcon,
  EyeOffIcon,
  UserIcon,
  MailIcon,
  LockIcon,
  PhoneIcon,
  CalendarIcon,
  UploadCloudIcon, // Icon for upload button/placeholder
  DropletIcon,    // Icon for blood type
  ShieldAlertIcon, // Icon for allergies
} from "lucide-react";

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
const bloodTypes = ['A+', 'A-', 'AB+', 'AB-', 'B+', 'B-', 'O+', 'O-'] as const; // Use 'as const' for better type safety
type BloodType = typeof bloodTypes[number] | ""; // Define type based on the array

// --- Component ---
export default function Register() {
  // --- State ---
  const [formData, setFormData] = useState<FormData>({
    nombre_completo: "",
    email: "",
    password: "",
    telefono: "",
    date_of_birth: "",
    gender: "",
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
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // --- Hooks ---
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Effects ---
  // Cleanup effect for photo preview URL
  useEffect(() => {
    let currentPreview = photoPreview; // Capture current preview URL
    return () => {
      if (currentPreview) {
        URL.revokeObjectURL(currentPreview);
        // console.log("Revoked URL:", currentPreview); // For debugging
      }
    };
  }, [photoPreview]); // Run when photoPreview changes

  // --- Handlers ---
  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;

    // Handle standard form data fields
    if (name in formData) {
        setFormData(prev => ({ ...prev, [name]: value }));
    }
    // Handle patient-specific text/select fields directly (can be combined if names match state keys)
    else if (name === "allergies") {
        setAllergies(value);
    }
    // Note: Blood type is handled by ShadCN Select's onValueChange below
    // Note: Photo is handled by handlePhotoChange below
  };

  const handleBloodTypeChange = (value: BloodType) => {
    setBloodType(value);
  };

  const handlePhotoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;

    // Revoke previous preview URL before setting new one
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
      setPhotoPreview(null); // Clear preview state immediately
      // console.log("Revoked previous URL in handlePhotoChange"); // For debugging
    }

    setPhotoFile(file);

    if (file) {
      const previewUrl = URL.createObjectURL(file);
      setPhotoPreview(previewUrl);
      // console.log("Created new URL:", previewUrl); // For debugging
    }
  };

  // Function to trigger the hidden file input
  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Function to reset patient-specific step 2 state
  const resetPatientStep2State = () => {
    setBloodType("");
    setAllergies("");
    setPhotoFile(null);
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
      setPhotoPreview(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ""; // Clear the file input visually
    }
  }

  // --- Form Submission ---
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // --- Step 1 Logic ---
    if (step === 1) {
      if (!formData.nombre_completo || !formData.email || !formData.password) {
        setMessage({ text: "Por favor completa todos los campos obligatorios (*).", type: "error" });
        return;
      }
      const passwordPattern = /^(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;
      if (!passwordPattern.test(formData.password)) {
        setMessage({ text: "La contraseña debe tener al menos 8 caracteres y un carácter especial.", type: "error" });
        return;
      }
      setMessage({ text: "", type: "" });
      setStep(2); // Move to step 2
      return; // Stop execution here for step 1
    }

    // --- Step 2 Logic ---
    if (!termsAccepted) {
      setMessage({ text: "Debes aceptar los términos y condiciones para continuar.", type: "error" });
      return;
    }

    setLoading(true);
    setMessage({ text: "", type: "" });

    try {
      // 1. Sign Up User in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.nombre_completo, // Pass full_name in metadata
            role: selectedRole,                 // Pass role in metadata
          },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Registro fallido, no se obtuvo el usuario.");

      const userId = authData.user.id;

      // 2. Insert data based on role
      if (selectedRole === "administrador") {
        const { error: adminError } = await supabase.from("administradores").insert([
          {
            id: userId,
            nombre: formData.nombre_completo,
            email: formData.email,
            telefono: formData.telefono || null,
            // Add any other admin-specific fields here
          },
        ]);
        if (adminError) throw adminError;

        setMessage({ text: "¡Administrador registrado! Por favor verifica tu email.", type: "success" });
        // Reset form for admin
        setFormData({ nombre_completo: "", email: "", password: "", telefono: "", date_of_birth: "", gender: "" });
        setStep(1);
        setTermsAccepted(false);
        // No reset for patient specific state needed here

      } else if (selectedRole === "paciente") {
        let photoUrl: string | null = null;

        // 2a. Upload Photo if exists (for Patient)
        if (photoFile) {
          setMessage({ text: "Subiendo foto...", type: "info" });
          const fileExt = photoFile.name.split('.').pop();
          const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
          const filePath = `${userId}/${fileName}`; // IMPORTANT: Use user ID in path for RLS policies

          const { error: uploadError } = await supabase.storage
            .from("patient-photos") // Your bucket name
            .upload(filePath, photoFile, {
              cacheControl: '3600',
              upsert: false, // Don't overwrite (unique name should prevent anyway)
            });

          if (uploadError) {
            console.error("Photo Upload Error:", uploadError);
            // Attempt to revoke preview URL on upload error
             if (photoPreview) {
                 URL.revokeObjectURL(photoPreview);
                 setPhotoPreview(null); // Still clear preview state
             }
            throw new Error(`Error al subir la foto: ${uploadError.message}. Verifica los permisos del bucket.`);
          }

          // Get public URL (ensure bucket allows public reads via policy if needed)
          const { data: urlData } = supabase.storage
            .from("patient-photos")
            .getPublicUrl(filePath);

           if (!urlData || !urlData.publicUrl) {
               console.warn("Could not get public URL for uploaded photo. Storing path instead or null.");
               // photoUrl = filePath; // Option: Store the path if URL fails
           } else {
               photoUrl = urlData.publicUrl;
           }
          setMessage({ text: "", type: "" }); // Clear "uploading" message
        }

        // 2b. Prepare Patient Data
        const patientData = {
          user_id: userId, // Link to the auth user
          name: formData.nombre_completo,
          email: formData.email,
          phone: formData.telefono || null,
          date_of_birth: formData.date_of_birth || null,
          gender: formData.gender || null,
          // === NEW PATIENT FIELDS ===
          blood_type: bloodType || null,
          allergies: allergies || null,
          Foto_paciente: photoUrl, // The public URL or null
          // ==========================
          created_at: new Date().toISOString(), // Add timestamps if your table expects them
        };

        // 2c. Insert Patient Data
        const { error: patientError } = await supabase.from("patients").insert([patientData]);

        if (patientError) throw patientError;

        setMessage({
          text: `¡Bienvenido ${formData.nombre_completo}! Revisa tu correo para verificar tu cuenta. Serás redirigido...`,
          type: "success",
        });

        // Reset patient specific state AFTER successful insert
        resetPatientStep2State();

        // Redirect after a delay
        setTimeout(() => {
          navigate("/paciente", { // Or dashboard, adjust as needed
            state: { welcomeMessage: `¡Bienvenido ${formData.nombre_completo}!` },
          });
        }, 3000);
        // No need to reset formData or step here, as we are navigating away
        return; // Explicitly return after patient success path
      }

    } catch (error: any) {
      console.error("Registration Error:", error);
       // Attempt to revoke preview URL on general error ONLY if it was potentially related to the photo
       if (photoPreview && error.message.includes("foto")) {
           URL.revokeObjectURL(photoPreview);
           setPhotoPreview(null);
           setPhotoFile(null); // Also clear the file state
           if (fileInputRef.current) fileInputRef.current.value = "";
       }
      setMessage({
        text: error.code === '23505' || error.message?.includes('duplicate key value') // Check for Supabase unique constraint error
              ? "Este correo electrónico ya está registrado. Intenta iniciar sesión."
              : error.message?.includes('Email rate limit exceeded')
              ? "Se ha superado el límite de envío de correos. Intenta más tarde."
              : error.message || "Error en el registro. Por favor intenta nuevamente.",
        type: "error",
      });
    } finally {
      setLoading(false);
      // Reset general form fields ONLY if it was an admin success (handled inside admin logic)
      // or if there was an error and we stay on the page.
       if (message.type === 'error') {
           // Optionally decide if you want to clear password on error
           // setFormData(prev => ({ ...prev, password: "" }));
       }
    }
  };

  // --- Google Sign Up ---
  const handleGoogleSignUp = async () => {
    setLoading(true);
    setMessage({ text: "", type: "" });
    try {
        // IMPORTANT: Google Sign Up won't collect blood type, allergies, photo here.
        // This data needs to be collected AFTER successful sign-in/redirect,
        // typically on the user's profile page or a dedicated "complete profile" step.
        // The role might be set via a trigger/function based on email domain,
        // or you might need a post-signup step to select role and add patient data.
        // This example redirects to /paciente, assuming a patient role after Google sign-up.
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/paciente`, // Adjust redirect as needed
           queryParams: {
             access_type: "offline",
             prompt: "consent",
           },
           // You might attempt to pass role or other basic info if needed and supported
           // data: { role: 'paciente' } // Check Supabase docs if this is reliable for OAuth
        },
      });

      if (error) throw error;
      // Redirect happens automatically, no need to setLoading(false) here unless error
    } catch (error: any) {
      console.error("Google Sign Up Error:", error);
      setMessage({ text: `Error con Google: ${error.message}`, type: "error" });
      setLoading(false);
    }
  };

  // --- Styles ---
  const primaryButtonClasses = "w-full bg-[#29abe2] text-white hover:bg-[#1f8acb] focus-visible:ring-[#29abe2]";
  const googleButtonClasses = "w-full flex items-center justify-center gap-2 py-2 px-4 border border-input rounded-md text-sm font-medium text-foreground bg-background hover:bg-accent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#29abe2]";
  const backButtonClasses = "w-full text-sm text-[#29abe2] hover:text-[#1f8acb] mt-2";
  const inputFocusClass = "focus-visible:ring-[#29abe2]";
  const selectFocusClass = "focus:ring-[#29abe2]"; // Standard select focus might differ
  const checkboxFocusClass = "focus:ring-[#29abe2]";
  const textColor = "text-gray-700";
  const labelColor = "text-gray-700";
  const placeholderColor = "placeholder:text-muted-foreground";
  const borderColor = "border-input"; // Assuming standard input border from theme

  // --- Render ---
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-sky-50 to-white p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-sky-100 mb-4">
            <img src="/logo.png" alt="Logo" width="64" height="64" className="opacity-90 p-1"/>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Carelux Point</h1>
          <p className="text-gray-500 mt-1">Regístrate, es gratis</p>
        </div>

        {/* Registration Card */}
        <Card className="w-full shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl text-center">Crear cuenta</CardTitle>
            <CardDescription className="text-center">
              {step === 1 ? "Ingresa tus datos de acceso" : "Completa tu perfil"}
            </CardDescription>
          </CardHeader>

          {/* Role Selector */}
          <div className="px-6">
            <div className="flex items-center justify-center border-b border-gray-200 mb-4">
              {/* Paciente Tab */}
              <div
                onClick={() => { if (!loading) { setSelectedRole("paciente"); setStep(1); setMessage({ text: "", type: "" }); resetPatientStep2State();} }}
                className={`relative px-4 py-2 text-sm cursor-pointer ${selectedRole === "paciente" ? "text-[#29abe2] font-medium" : "text-gray-600 hover:text-gray-900"}`}
              >
                Paciente
                {selectedRole === "paciente" && (<div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#29abe2] rounded-t"></div>)}
              </div>
              <div className="h-5 w-px bg-gray-300 mx-1"></div> {/* Separator */}
              {/* Administrador Tab */}
              <div
                onClick={() => { if (!loading) { setSelectedRole("administrador"); setStep(1); setMessage({ text: "", type: "" }); resetPatientStep2State();} }}
                className={`relative px-4 py-2 text-sm cursor-pointer ${selectedRole === "administrador" ? "text-[#29abe2] font-medium" : "text-gray-600 hover:text-gray-900"}`}
              >
                Administrador
                {selectedRole === "administrador" && (<div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#29abe2] rounded-t"></div>)}
              </div>
            </div>
          </div>

          {/* Message Area */}
          {message.text && (
            <div
              className={`mx-6 mb-4 p-3 text-sm rounded-md border ${
                message.type === "success" ? "bg-green-50 text-green-700 border-green-200" :
                message.type === "error" ? "bg-red-50 text-red-700 border-red-200" :
                "bg-blue-50 text-blue-700 border-blue-200" // Info style
              }`}
              role={message.type === 'error' ? 'alert' : 'status'} // Use alert for errors
            >
              {message.text}
            </div>
          )}

          {/* Form Content */}
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* --- STEP 1 FIELDS --- */}
              {step === 1 && (
                <>
                  {/* Nombre Completo */}
                  <div className="space-y-1">
                    <label htmlFor="nombre_completo" className={`text-sm font-medium ${labelColor} flex items-center gap-1.5`}>
                      <UserIcon className="h-4 w-4 text-gray-500" /> Nombre Completo *
                    </label>
                    <Input id="nombre_completo" name="nombre_completo" type="text" required value={formData.nombre_completo} onChange={handleChange} disabled={loading} aria-required="true" className={`${inputFocusClass} ${placeholderColor} ${borderColor}`} />
                  </div>

                  {/* Correo Electrónico */}
                  <div className="space-y-1">
                    <label htmlFor="email" className={`text-sm font-medium ${labelColor} flex items-center gap-1.5`}>
                      <MailIcon className="h-4 w-4 text-gray-500" /> Correo electrónico *
                    </label>
                    <Input id="email" name="email" type="email" required value={formData.email} onChange={handleChange} disabled={loading} aria-required="true" className={`${inputFocusClass} ${placeholderColor} ${borderColor}`} />
                  </div>

                  {/* Contraseña */}
                  <div className="space-y-1">
                    <label htmlFor="password" className={`text-sm font-medium ${labelColor} flex items-center gap-1.5`}>
                      <LockIcon className="h-4 w-4 text-gray-500" /> Contraseña *
                    </label>
                    <div className="relative">
                      <Input id="password" name="password" type={showPassword ? "text" : "password"} placeholder="••••••••" required minLength={8} value={formData.password} onChange={handleChange} pattern='^(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$' title="Mínimo 8 caracteres y un símbolo especial." disabled={loading} aria-required="true" aria-describedby="password-hint" className={`${inputFocusClass} ${placeholderColor} ${borderColor}`} />
                      <button type="button" className={`absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 ${checkboxFocusClass} rounded`} onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>
                        {showPassword ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                      </button>
                    </div>
                    <p id="password-hint" className="text-xs text-gray-500"> Mínimo 8 caracteres y un carácter especial (ej: !, @, #, $).</p>
                  </div>
                </>
              )}

              {/* --- STEP 2 FIELDS --- */}
              {step === 2 && (
                <>
                  {/* Teléfono (Optional) */}
                  <div className="space-y-1">
                    <label htmlFor="telefono" className={`text-sm font-medium ${labelColor} flex items-center gap-1.5`}>
                      <PhoneIcon className="h-4 w-4 text-gray-500" /> Teléfono <span className="text-xs text-gray-400">(Opcional)</span>
                    </label>
                    <Input id="telefono" name="telefono" type="tel" value={formData.telefono} onChange={handleChange} disabled={loading} className={`${inputFocusClass} ${placeholderColor} ${borderColor}`} />
                  </div>

                  {/* === Fields only for 'paciente' role in Step 2 === */}
                  {selectedRole === 'paciente' && (
                    <>
                      {/* Fecha de Nacimiento (Optional) */}
                      <div className="space-y-1">
                        <label htmlFor="date_of_birth" className={`text-sm font-medium ${labelColor} flex items-center gap-1.5`}>
                          <CalendarIcon className="h-4 w-4 text-gray-500" /> Fecha de nacimiento <span className="text-xs text-gray-400">(Opcional)</span>
                        </label>
                        <Input id="date_of_birth" name="date_of_birth" type="date" value={formData.date_of_birth} onChange={handleChange} max={new Date().toISOString().split("T")[0]} disabled={loading} className={`block w-full ${inputFocusClass} ${borderColor}`} />
                      </div>

                      {/* Género (Optional) */}
                      <div className="space-y-1">
                        <label htmlFor="gender" className={`text-sm font-medium ${labelColor} block`}>
                          Género <span className="text-xs text-gray-400">(Opcional)</span>
                        </label>
                        {/* Using standard select for broader compatibility, wrap with Shadcn if available */}
                        <select id="gender" name="gender" value={formData.gender} onChange={handleChange} disabled={loading} className={`w-full h-10 rounded-md border ${borderColor} bg-background px-3 py-2 text-sm ring-offset-background ${placeholderColor} focus:outline-none focus:ring-2 ${selectFocusClass} focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50`}>
                          <option value="">Seleccionar...</option>
                          <option value="masculino">Masculino</option>
                          <option value="femenino">Femenino</option>
                          <option value="otro">Otro</option>
                          <option value="prefiero_no_decir">Prefiero no decir</option>
                        </select>
                      </div>

                      {/* Tipo de Sangre (Optional) */}
                      <div className="space-y-1">
                         <label htmlFor="blood_type_select" className={`text-sm font-medium ${labelColor} flex items-center gap-1.5`}>
                          <DropletIcon className="h-4 w-4 text-gray-500" /> Tipo de Sangre <span className="text-xs text-gray-400">(Opcional)</span>
                        </label>
                        {/* Using ShadCN Select component */}
                        <Select value={bloodType} onValueChange={handleBloodTypeChange} disabled={loading}>
                          <SelectTrigger id="blood_type_select" className={`w-full ${selectFocusClass} ${borderColor}`}>
                            <SelectValue placeholder="Seleccionar..." />
                          </SelectTrigger>
                          <SelectContent>
                            {bloodTypes.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Alergias (Optional) */}
                      <div className="space-y-1">
                         <label htmlFor="allergies" className={`text-sm font-medium ${labelColor} flex items-center gap-1.5`}>
                          <ShieldAlertIcon className="h-4 w-4 text-gray-500" /> Alergias <span className="text-xs text-gray-400">(Opcional, separadas por coma)</span>
                        </label>
                        <Textarea id="allergies" name="allergies" rows={3} placeholder="Ej: Penicilina, Polvo, Polen..." value={allergies} onChange={handleChange} disabled={loading} className={`${inputFocusClass} ${placeholderColor} ${borderColor}`} />
                      </div>

                      {/* Foto Paciente (Optional) */}
                      <div className="space-y-2">
                        <label className={`text-sm font-medium ${labelColor} block`}>
                          Foto de Paciente <span className="text-xs text-gray-400">(Opcional)</span>
                        </label>
                        <div className="flex items-center gap-4">
                           {/* Actual Hidden File Input */}
                           <input type="file" id="photo" name="photo" accept="image/png, image/jpeg, image/jpg" onChange={handlePhotoChange} disabled={loading} ref={fileInputRef} className="hidden" />
                           {/* Preview Area / Placeholder */}
                            <div className="h-16 w-16 rounded-full border border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-gray-50">
                            {photoPreview ? (
                              <img src={photoPreview} alt="Vista previa" className="h-full w-full object-cover" />
                            ) : (
                              <UserIcon className="h-8 w-8 text-gray-400" /> // Placeholder icon
                            )}
                          </div>
                          {/* Upload/Change Button */}
                          <Button type="button" variant="outline" onClick={triggerFileInput} disabled={loading} className={`text-sm ${inputFocusClass}`}>
                             <UploadCloudIcon className="h-4 w-4 mr-2" />
                             {photoFile ? "Cambiar Foto" : "Seleccionar Foto"}
                          </Button>
                        </div>
                         {photoFile && (
                              <p className="text-xs text-gray-500 italic truncate" title={photoFile.name}>
                                Archivo: {photoFile.name}
                              </p>
                          )}
                         <p className="text-xs text-gray-500">Permitido: JPG, PNG, JPEG. Máx 5MB (si aplica).</p>
                      </div>
                    </>
                  )} {/* End patient-only fields */}

                  {/* Terms and Conditions */}
                  <div className="flex items-start mt-4 pt-2">
                    <input id="terms" type="checkbox" checked={termsAccepted} onChange={() => setTermsAccepted(!termsAccepted)} disabled={loading} className={`h-4 w-4 mt-0.5 text-[#29abe2] ${checkboxFocusClass} border-gray-300 rounded`} />
                    <label htmlFor="terms" className={`ml-2 block text-sm ${textColor}`}>
                      He leído y acepto los{" "}
                      <Link to="/terms" target="_blank" rel="noopener noreferrer" className="font-medium text-[#29abe2] hover:text-[#1f8acb] hover:underline"> Términos y Condiciones </Link> y la{" "}
                      <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="font-medium text-[#29abe2] hover:text-[#1f8acb] hover:underline"> Política de Privacidad </Link>.*
                    </label>
                  </div>
                </>
              )} {/* End Step 2 */}

              {/* --- ACTION BUTTONS --- */}

              {/* Submit/Continue Button */}
              <Button type="submit" className={primaryButtonClasses} disabled={loading || (step === 2 && !termsAccepted)}>
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>{step === 1 ? "Verificando..." : "Registrando..."}</span>
                  </span>
                ) : step === 1 ? (
                  "Continuar"
                ) : (
                  "Registrarse"
                )}
              </Button>

              {/* Google Sign Up Button (Only Step 1 & Patient) */}
              {step === 1 && selectedRole === "paciente" && (
                <>
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
                    <div className="relative flex justify-center text-sm"><span className="px-2 bg-card text-muted-foreground"> O regístrate con </span></div>
                  </div>
                  <button type="button" onClick={handleGoogleSignUp} disabled={loading} className={googleButtonClasses}>
                    <FcGoogle className="h-5 w-5" />
                    <span>Google</span>
                  </button>
                </>
              )}

              {/* Back Button (Only Step 2) */}
              {step === 2 && (
                <button type="button" onClick={() => { setStep(1); setMessage({ text: "", type: "" }); /* No need to reset patient state here, handled by role change */ }} disabled={loading} className={backButtonClasses}>
                  Volver al paso anterior
                </button>
              )}
            </form>
          </CardContent>

          {/* Footer Links */}
          <CardFooter className="flex flex-col items-center space-y-4 pt-4 pb-6">
            <p className="text-sm text-center text-gray-600">
              ¿Ya tienes una cuenta?{" "}
              <Link to="/login" className="font-medium text-[#29abe2] hover:text-[#1f8acb] hover:underline"> Iniciar sesión </Link>
            </p>
          </CardFooter>
        </Card>

        {/* Copyright/Footer Links */}
        <div className="mt-8 text-center text-xs text-gray-500">
          <p>© {new Date().getFullYear()} Carelux Point. Todos los derechos reservados.</p>
          <div className="flex justify-center space-x-4 mt-2">
            <Link to="/terms" className="hover:text-[#29abe2] hover:underline">Términos</Link>
            <Link to="/privacy" className="hover:text-[#29abe2] hover:underline">Privacidad</Link>
            <Link to="/help" className="hover:text-[#29abe2] hover:underline">Ayuda</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
