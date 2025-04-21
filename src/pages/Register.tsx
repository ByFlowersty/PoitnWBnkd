import { useState, type ChangeEvent, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import supabase from "../lib/supabaseClient";
import { FcGoogle } from "react-icons/fc";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "../components/ui/card";
import {
  EyeIcon,
  EyeOffIcon,
  UserIcon,
  MailIcon,
  LockIcon,
  PhoneIcon,
  CalendarIcon,
} from "lucide-react";

interface FormData {
  nombre_completo: string;
  email: string;
  password: string;
  telefono: string;
  date_of_birth: string;
  gender: string;
}

export default function Register() {
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
  const navigate = useNavigate();

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (step === 1) {
      // Basic validation for step 1 fields before proceeding
      if (!formData.nombre_completo || !formData.email || !formData.password) {
         setMessage({ text: "Por favor completa todos los campos obligatorios (*).", type: "error" });
         return;
      }
       // Optional: Add more specific password validation here if needed beyond the pattern
       const passwordPattern = /^(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;
       if (!passwordPattern.test(formData.password)) {
         setMessage({ text: "La contraseña debe tener al menos 8 caracteres y un carácter especial.", type: "error" });
         return;
       }

      setMessage({ text: "", type: "" }); // Clear previous messages
      setStep(2);
      return;
    }

    // Step 2 logic
    if (!termsAccepted) {
      setMessage({
        text: "Debes aceptar los términos y condiciones para continuar.",
        type: "error",
      });
      return;
    }

    setLoading(true);
    setMessage({ text: "", type: "" });

    try {
      // 1. Registrar usuario en Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.nombre_completo,
            role: selectedRole,
            // Add phone to user metadata if desired, useful for easy access
            // phone: formData.telefono,
          },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Registro fallido, no se obtuvo el usuario."); // Added check

      // 2. Guardar en la tabla correspondiente según el rol
      if (selectedRole === "administrador") {
        const { error: adminError } = await supabase.from("administradores").insert([
          {
            id: authData.user.id, // Ensure this matches your table's PK constraint if it's UUID
            nombre: formData.nombre_completo,
            email: formData.email,
            telefono: formData.telefono || null, // Handle potential empty string
          },
        ]);

        if (adminError) throw adminError;

        setMessage({
          text: "¡Administrador registrado! Por favor verifica tu email para activar tu cuenta.",
          type: "success",
        });
         // Optionally clear form or redirect to a confirmation page
         setFormData({
           nombre_completo: "", email: "", password: "", telefono: "", date_of_birth: "", gender: "",
         });
         setStep(1);
         setTermsAccepted(false);


      } else if (selectedRole === "paciente") {
        const patientData = {
          user_id: authData.user.id, // Ensure this matches your FK constraint
          name: formData.nombre_completo,
          email: formData.email,
          phone: formData.telefono || null, // Use null for empty optional fields
          date_of_birth: formData.date_of_birth || null,
          gender: formData.gender || null,
          // created_at is usually handled by Supabase default value, but explicit is fine
          created_at: new Date().toISOString(),
        };

        const { error: patientError } = await supabase.from("patients").insert([patientData]);

        if (patientError) throw patientError;

        // Instead of immediately navigating, maybe show a success message and wait for email verification?
        // Or, if email verification is disabled or you handle unverified users, navigate:
        setMessage({
          text: `¡Bienvenido ${formData.nombre_completo}! Revisa tu correo para verificar tu cuenta. Serás redirigido...`,
          type: "success",
        });
        // Delay navigation slightly to let user read message
        setTimeout(() => {
             navigate("/paciente", {
             // Pass minimal state, user data should be fetched after login/verification
             state: {
                 welcomeMessage: `¡Bienvenido ${formData.nombre_completo}!`,
                 // Avoid passing sensitive data like user ID directly in state if possible
                 // It's better to fetch user session/data on the target page
             },
             });
        }, 3000); // 3 second delay

        return; // Prevent form reset below for patient redirection
      }


    } catch (error: any) { // Type assertion for error
      console.error("Registration Error:", error); // Log the full error for debugging
      setMessage({
        // Provide more specific common error messages
        text: error.message === 'User already registered'
              ? "Este correo electrónico ya está registrado. Intenta iniciar sesión."
              : error.message || "Error en el registro. Por favor intenta nuevamente.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setLoading(true); // Show loading indicator during OAuth redirect
    setMessage({ text: "", type: "" });
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          // Redirect should ideally go to a page that handles the OAuth callback
          // and then determines where to send the user (e.g., profile setup or dashboard)
          // Using /paciente directly might work if your app structure handles new Google users there.
          redirectTo: `${window.location.origin}/paciente`, // Ensure this page handles session creation
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
          // You might want to add default role metadata for Google signups if needed
          // data: { role: 'paciente' } // This syntax might be incorrect, check Supabase docs for OAuth metadata
        },
      });

      if (error) throw error;
      // Note: Redirection happens externally, so further code here might not execute immediately.
    } catch (error: any) {
      console.error("Google Sign Up Error:", error);
      setMessage({
        text: `Error con Google: ${error.message}`,
        type: "error",
      });
      setLoading(false); // Turn off loading if OAuth fails before redirect
    }
    // setLoading(false); // Should likely be turned off on the page redirected TO
  };

  return (
    // Updated gradient start color
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-sky-50 to-white p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
           {/* Updated logo background color */}
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-sky-100 mb-4">
            <img
              src="/logo.png" // Ensure this path is correct relative to your public folder
              alt="Carelux Point Logo"
              width="64" // Adjust size if needed
              height="64"
              className="opacity-90 p-1" // Added padding if logo touches edge
            />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Carelux Point</h1>
          <p className="text-gray-500 mt-1">Regístrate, es gratis</p>
        </div>

        <Card className="w-full shadow-lg"> {/* Added shadow */}
          <CardHeader>
            <CardTitle className="text-xl text-center">Crear cuenta</CardTitle>
            <CardDescription className="text-center">
              {step === 1
                ? "Ingresa tus datos de acceso"
                : "Completa tu perfil"}
            </CardDescription>
          </CardHeader>

          {/* Role Selector */}
          <div className="px-6 pb-4"> {/* Adjusted padding */}
            <div className="flex items-center justify-center border rounded-md p-1 bg-gray-50"> {/* Changed style */}
              <button
                type="button"
                onClick={() => { setSelectedRole("paciente"); setStep(1); setMessage({ text: "", type: "" }); }} // Reset step on role change
                disabled={loading}
                // Updated selected background/text color
                className={`flex-1 px-3 py-1.5 text-sm rounded-md transition-colors duration-200 ${
                  selectedRole === "paciente"
                    ? "bg-[#29abe2] text-white font-medium shadow-sm"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                Soy Paciente
              </button>
              <button
                type="button"
                onClick={() => { setSelectedRole("administrador"); setStep(1); setMessage({ text: "", type: "" });}} // Reset step on role change
                disabled={loading}
                 // Updated selected background/text color
                className={`flex-1 px-3 py-1.5 text-sm rounded-md transition-colors duration-200 ${
                  selectedRole === "administrador"
                    ? "bg-[#29abe2] text-white font-medium shadow-sm"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                Soy Administrador
              </button>
            </div>
          </div>


          {message.text && (
            <div
              className={`mx-6 mb-4 p-3 text-sm rounded-md border ${
                message.type === "success"
                  ? "bg-green-50 text-green-700 border-green-200" // Success message retains green color
                  : "bg-red-50 text-red-700 border-red-200"      // Error message retains red color
              }`}
              role="alert" // Added accessibility role
            >
              {message.text}
            </div>
          )}

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {step === 1 ? (
                <>
                  {/* Step 1 Fields */}
                  <div className="space-y-1">
                    <label
                      htmlFor="nombre_completo"
                      className="text-sm font-medium text-gray-700 flex items-center gap-1.5" // Reduced gap
                    >
                      <UserIcon className="h-4 w-4 text-gray-500" /> {/* Icon color */}
                      Nombre Completo *
                    </label>
                    <Input
                      id="nombre_completo"
                      name="nombre_completo"
                      type="text"
                      placeholder="Ej: Juan Pérez García"
                      required
                      value={formData.nombre_completo}
                      onChange={handleChange}
                      disabled={loading}
                      aria-required="true" // Accessibility
                      // Updated focus ring color
                      className="focus:ring-[#29abe2]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="email"
                      className="text-sm font-medium text-gray-700 flex items-center gap-1.5"
                    >
                      <MailIcon className="h-4 w-4 text-gray-500" />
                      Correo electrónico *
                    </label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="tu@email.com"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      disabled={loading}
                      aria-required="true"
                      // Updated focus ring color
                      className="focus:ring-[#29abe2]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="password"
                      className="text-sm font-medium text-gray-700 flex items-center gap-1.5"
                    >
                      <LockIcon className="h-4 w-4 text-gray-500" />
                      Contraseña *
                    </label>
                    <div className="relative">
                      <Input
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        required
                        minLength={8} // Correct attribute placement
                        value={formData.password}
                        onChange={handleChange}
                        pattern='^(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$' // Use single quotes or escape inside double
                        title="La contraseña debe tener al menos 8 caracteres y un carácter especial." // Correct attribute placement
                        disabled={loading}
                        aria-required="true"
                        aria-describedby="password-hint" // Accessibility
                        // Updated focus ring color
                        className="focus:ring-[#29abe2]"
                      />
                      <button
                        type="button"
                        // Updated focus ring color
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#29abe2] rounded" // Added focus style
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} // Accessibility
                      >
                        {showPassword ? (
                          <EyeOffIcon className="h-5 w-5" />
                        ) : (
                          <EyeIcon className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                    <p id="password-hint" className="text-xs text-gray-500">
                      Mínimo 8 caracteres y un carácter especial (ej: !, @, #, $). {/* Updated text */}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  {/* Step 2 Fields */}
                  <div className="space-y-1">
                    <label
                      htmlFor="telefono"
                      className="text-sm font-medium text-gray-700 flex items-center gap-1.5"
                    >
                      <PhoneIcon className="h-4 w-4 text-gray-500" />
                      Teléfono{" "}
                      <span className="text-xs text-gray-400">(Opcional)</span>
                    </label>
                    <Input
                      id="telefono"
                      name="telefono"
                      type="tel"
                      placeholder="+52 123 456 7890"
                      value={formData.telefono}
                      onChange={handleChange}
                      disabled={loading}
                       // Updated focus ring color
                      className="focus:ring-[#29abe2]"
                    />
                  </div>

                  {/* Fields only for 'paciente' role in step 2 */}
                  {selectedRole === "paciente" && (
                    <>
                      <div className="space-y-1">
                        <label
                          htmlFor="date_of_birth"
                          className="text-sm font-medium text-gray-700 flex items-center gap-1.5"
                        >
                          <CalendarIcon className="h-4 w-4 text-gray-500" />
                          Fecha de nacimiento{" "}
                          <span className="text-xs text-gray-400">
                            (Opcional)
                          </span>
                        </label>
                        <Input
                          id="date_of_birth"
                          name="date_of_birth"
                          type="date"
                          value={formData.date_of_birth}
                          onChange={handleChange}
                          max={new Date().toISOString().split("T")[0]} // Prevent future dates
                          disabled={loading}
                           // Updated focus ring color and width
                          className="block w-full focus:ring-[#29abe2]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label
                          htmlFor="gender"
                          className="text-sm font-medium text-gray-700 block" // Block label for select
                        >
                          Género{" "}
                          <span className="text-xs text-gray-400">
                            (Opcional)
                          </span>
                        </label>
                        <select
                          id="gender"
                          name="gender"
                          value={formData.gender}
                          onChange={handleChange}
                          disabled={loading}
                           // Updated focus ring color
                          className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#29abe2] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" // Style similar to Input
                        >
                          <option value="">Seleccionar...</option>
                          <option value="masculino">Masculino</option>
                          <option value="femenino">Femenino</option>
                          <option value="otro">Otro</option>
                          <option value="prefiero_no_decir">
                            Prefiero no decir
                          </option>
                        </select>
                      </div>
                    </>
                  )}

                  {/* Terms and Conditions Checkbox */}
                  <div className="flex items-start mt-4 pt-2"> {/* Adjusted spacing */}
                    <input
                      id="terms"
                      type="checkbox"
                      checked={termsAccepted}
                      onChange={() => setTermsAccepted(!termsAccepted)}
                      disabled={loading}
                       // Updated checkbox color and focus ring
                      className="h-4 w-4 mt-0.5 text-[#29abe2] focus:ring-[#29abe2] border-gray-300 rounded"
                    />
                    <label
                      htmlFor="terms"
                      className="ml-2 block text-sm text-gray-700"
                    >
                      He leído y acepto los{" "}
                      <Link
                        to="/terms" // Make sure this route exists
                        target="_blank" // Open in new tab
                        rel="noopener noreferrer" // Security best practice
                         // Updated link color and hover color
                        className="font-medium text-[#29abe2] hover:text-[#1f8acb] hover:underline"
                      >
                        Términos y Condiciones
                      </Link>{" "}
                      y la{" "}
                       <Link
                        to="/privacy" // Make sure this route exists
                        target="_blank"
                        rel="noopener noreferrer"
                        // Updated link color and hover color
                        className="font-medium text-[#29abe2] hover:text-[#1f8acb] hover:underline"
                      >
                        Política de Privacidad
                      </Link>.*
                    </label>
                  </div>
                </>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                // Updated background, hover, focus colors
                className="w-full bg-[#29abe2] hover:bg-[#1f8acb] focus:ring-[#29abe2]"
                disabled={loading || (step === 2 && !termsAccepted)} // Disable if loading or terms not accepted in step 2
              >
                {loading ? (
                  <span className="flex items-center justify-center"> {/* Centering */}
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" // Adjusted margin
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    <span>
                      {step === 1 ? "Verificando..." : "Registrando..."}
                    </span>
                  </span>
                ) : step === 1 ? (
                  "Continuar al paso 2"
                ) : (
                  "Completar Registro"
                )}
              </Button>

              {/* Google Sign Up Button - Only on Step 1 for Pacientes */}
              {step === 1 && selectedRole === "paciente" && (
                <>
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-200"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-white text-gray-500">
                        O regístrate con
                      </span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline" // Use outline variant
                    onClick={handleGoogleSignUp}
                    disabled={loading}
                     // Updated focus ring color
                    className="w-full flex items-center justify-center gap-2 py-2 px-4 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#29abe2]"
                  >
                    <FcGoogle className="h-5 w-5" />
                    <span>Continuar con Google</span>
                  </Button>
                </>
              )}

              {/* Back Button - Only on Step 2 */}
              {step === 2 && (
                <Button
                  type="button"
                  variant="ghost" // Use ghost variant for secondary action
                  onClick={() => { setStep(1); setMessage({ text: "", type: "" }); }} // Clear message on go back
                  disabled={loading}
                  // Updated text color, hover color, and hover background
                  className="w-full text-sm text-[#29abe2] hover:text-[#1f8acb] hover:bg-sky-50 mt-2" // Using sky-50 for light hover bg
                >
                  ← Volver al paso anterior {/* Added arrow */}
                </Button>
              )}
            </form>
          </CardContent>

          <CardFooter className="flex flex-col items-center space-y-4 pt-4 pb-6"> {/* Adjusted padding */}
            <p className="text-sm text-center text-gray-600">
              ¿Ya tienes una cuenta?{" "}
              <Link
                to="/login" // Ensure this route exists
                 // Updated link color and hover color
                className="font-medium text-[#29abe2] hover:text-[#1f8acb] hover:underline"
              >
                Iniciar sesión
              </Link>
            </p>
          </CardFooter>
        </Card>

        {/* Footer Links */}
        <div className="mt-8 text-center text-xs text-gray-500">
          <p>
            © {new Date().getFullYear()} Carelux Point. Todos los derechos reservados.
          </p>
          <div className="flex justify-center space-x-4 mt-2">
             {/* Updated link hover color */}
            <Link to="/terms" className="hover:text-[#29abe2] hover:underline">
              Términos
            </Link>
             {/* Updated link hover color */}
            <Link to="/privacy" className="hover:text-[#29abe2] hover:underline">
              Privacidad
            </Link>
             {/* Updated link hover color */}
            <Link to="/help" className="hover:text-[#29abe2] hover:underline">
              Ayuda
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
