import React, { useState, useEffect } from "react"; 
import {
  Menu,
  X,
  CheckCircle,
  ArrowRight,
  LineChart,
  Pill,
  Stethoscope,
  UserCircle,
  ShieldCheck,
  Sparkles,
  MoveUpRight, // Alternative arrow for links/cards
  Sun, // Icon for light mode
  Moon, // Icon for dark mode
} from "lucide-react";

// --- Light Mode Color Palette ---
const colors = {
  primary: "#4d7c6f",
  primaryLight: "#6b9c8f",
  primaryDark: "#3a5e54",
  primaryGlow: "rgba(77, 124, 111, 0.3)",
  primarySubtleGlow: "rgba(77, 124, 111, 0.15)",
  secondaryAccent: "#84ccb6",
  secondaryAccentGlow: "rgba(132, 204, 182, 0.2)",
  glassBg: "rgba(255, 255, 255, 0.6)",
  glassBgLight: "rgba(255, 255, 255, 0.8)",
  glassBgSubtle: "rgba(255, 255, 255, 0.9)",
  glassBorder: "rgba(255, 255, 255, 0.4)",
  glassBorderHighlight: "rgba(255, 255, 255, 0.8)",
  textHeading: "#1a2e29", // Dark Green/Black
  textBody: "#374151", // Gray-700
  textMuted: "#525f70", // Darker Gray-600
  borderSoft: "rgba(77, 124, 111, 0.1)",
  borderFocus: "rgba(77, 124, 111, 0.6)",
  white: "#ffffff",
  offWhite: "#f8fbfb", // Light background base
  bgGradientLight: "#f5f8f7", // Light green gradient part
  deepShadow: "rgba(58, 94, 84, 0.15)",
  lightSource: "rgba(255, 255, 255, 0.15)",
};

// --- Dark Mode Color Palette ---
const darkColors = {
  primary: "#6b9c8f", // Often lighten primary for dark mode visibility
  primaryLight: "#84ccb6", // Even lighter
  primaryDark: "#4d7c6f", // Base green as dark variant
  primaryGlow: "rgba(107, 156, 143, 0.3)", // Glow using lighter primary
  primarySubtleGlow: "rgba(107, 156, 143, 0.15)",
  secondaryAccent: "#9ee0ca", // Brighter accent
  secondaryAccentGlow: "rgba(158, 224, 202, 0.2)",
  glassBg: "rgba(31, 41, 55, 0.5)", // Dark Gray 800 base for glass
  glassBgLight: "rgba(55, 65, 81, 0.7)", // Dark Gray 700 lighter glass
  glassBgSubtle: "rgba(17, 24, 39, 0.8)", // Dark Gray 900 subtle glass
  glassBorder: "rgba(75, 85, 99, 0.4)", // Gray 600 border
  glassBorderHighlight: "rgba(107, 114, 128, 0.5)", // Gray 500 highlight
  textHeading: "#f9fafb", // Gray 50
  textBody: "#d1d5db", // Gray 300
  textMuted: "#9ca3af", // Gray 400
  borderSoft: "rgba(55, 65, 81, 0.3)", // Gray 700 soft border
  borderFocus: "rgba(107, 156, 143, 0.7)", // Lighter primary focus
  white: "#111827", // Dark base instead of pure white (Gray 900)
  offWhite: "#111827", // Dark BG base (Gray 900)
  bgGradientLight: "#1f2937", // Dark gradient part (Gray 800)
  deepShadow: "rgba(0, 0, 0, 0.25)", // Darker shadow base
  lightSource: "rgba(255, 255, 255, 0.05)", // Much subtler light source
};

// --- Button Styles ---
const btnBase = `inline-flex items-center justify-center rounded-xl text-sm font-medium transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60 disabled:pointer-events-none transform hover:-translate-y-0.5 active:translate-y-0 dark:focus-visible:ring-offset-gray-900`;

const btnPrimary = `${btnBase} text-white h-11 px-7 shadow-[0_4px_10px_-1px] dark:shadow-[0_4px_10px_-1px] border focus-visible:ring-[${colors.borderFocus}] dark:focus-visible:ring-[${darkColors.borderFocus}]`;

const btnSecondary = `${btnBase} h-11 px-7 shadow-[0_2px_5px_-1px_rgba(0,0,0,0.06),inset_0_1px_1px] dark:shadow-[0_2px_5px_-1px_rgba(0,0,0,0.3),inset_0_1px_1px] border focus-visible:ring-[${colors.borderFocus}] dark:focus-visible:ring-[${darkColors.borderFocus}]`;

const btnText = `text-sm font-medium hover:text-[${colors.primary}] dark:hover:text-[${darkColors.primary}] focus:text-[${colors.primary}] dark:focus:text-[${darkColors.primary}] outline-none rounded-md px-1.5 py-1 focus-visible:ring-1 focus-visible:ring-[${colors.primary}]/50 dark:focus-visible:ring-[${darkColors.primary}]/50 focus-visible:bg-[${colors.primary}]/10 dark:focus-visible:bg-[${darkColors.primary}]/20 transition-all duration-200`;

// --- Noise Pattern ---
const subtleNoisePatternURL = `url("data:image/svg+xml,%3Csvg viewBox='0 0 300 300' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`;


export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false); // Dark mode state

  useEffect(() => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedTheme = localStorage.getItem('theme');
    // Default to light unless saved 'dark' or prefers dark and no save
    const initialMode = savedTheme ? savedTheme === 'dark' : prefersDark;

    setIsDarkMode(initialMode);

    if (initialMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem('theme', newMode ? 'dark' : 'light');
    if (newMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Select current theme's colors
  const currentColors = isDarkMode ? darkColors : colors;

  // Memoize styles that depend on currentColors to avoid unnecessary recalculations
  // (Example for complex button styles)
  const primaryBtnStyle = React.useMemo(() => ({
    background: `linear-gradient(to bottom right, ${currentColors.primaryLight}, ${currentColors.primary})`,
    color: isDarkMode ? darkColors.textHeading : colors.white,
    borderColor: `${currentColors.primaryDark}/30`,
    boxShadow: `0 4px 10px -1px ${currentColors.deepShadow}, inset 0 1px 1px ${currentColors.lightSource}`,
    focusVisibleRingOffset: isDarkMode ? darkColors.offWhite : colors.offWhite // Needed for correct ring offset
  }), [isDarkMode, currentColors]);

  const secondaryBtnStyle = React.useMemo(() => ({
    backgroundColor: currentColors.glassBgSubtle,
    color: currentColors.primaryDark, // Explicit assignment needed
    borderColor: currentColors.glassBorder,
    boxShadow: `0 2px 5px -1px ${isDarkMode ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.06)'}, inset 0 1px 1px ${currentColors.glassBorderHighlight}`,
    focusVisibleRingOffset: isDarkMode ? darkColors.offWhite : colors.offWhite
  }), [isDarkMode, currentColors]);

  // Hover styles as separate functions for clarity (could also be objects)
   const primaryBtnHoverStyle = {
      background: `linear-gradient(to bottom right, ${currentColors.primary}, ${currentColors.secondaryAccent})`,
      boxShadow: `0 6px 14px -2px ${currentColors.deepShadow}, inset 0 1px 2px ${currentColors.lightSource}`,
      filter: 'brightness(1.1)',
   };
   const secondaryBtnHoverStyle = {
      backgroundColor: isDarkMode ? darkColors.glassBgLight : colors.white+'/95',
      borderColor: `${isDarkMode ? darkColors.primary : colors.primary}/40`,
      boxShadow: `0 4px 10px -2px ${isDarkMode ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.1)'}`, // Adjust hover shadow
   };

  return (
    <div
      className="flex min-h-screen flex-col overflow-x-hidden antialiased"
      style={{
        backgroundColor: currentColors.offWhite,
        color: currentColors.textBody,
      }}
    >
      {/* === Header === */}
      <header className="sticky top-0 z-50 w-full border-b backdrop-blur-xl"
              style={{
                backgroundColor: `${isDarkMode ? currentColors.glassBg : colors.glassBg}/70`,
                borderColor: currentColors.glassBorder,
                backgroundImage: subtleNoisePatternURL,
                backgroundBlendMode: isDarkMode ? 'overlay' : 'soft-light',
                backgroundSize: '300px 300px',
                backgroundPosition: '0 0',
                opacity: isDarkMode ? 0.5 : 0.98,
                boxShadow: `0 2px 10px -2px ${isDarkMode ? 'rgba(0,0,0, 0.2)' : 'rgba(77, 124, 111, 0.1)'}`,
              }}
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex h-20 items-center justify-between">
          {/* Logo */}
          <a href="/" className="flex items-center gap-3 text-xl font-semibold group" style={{ color: currentColors.textHeading }}>
            <div className={`p-1 rounded-lg shadow-sm group-hover:shadow-md transition-shadow ${isDarkMode ? 'bg-gray-700/50' : 'bg-gradient-to-br from-white/80 to-white/50'}`}>
              <img src="/logo.png" alt="Carelux Point Logo" className="h-9 w-9 group-hover:scale-105 transition-transform duration-300 ease-out" />
            </div>
            <span className={`group-hover:text-[${currentColors.primary}] transition-colors duration-200`}>
              Carelux Point
            </span>
          </a>

          {/* Desktop Actions + Theme Toggle */}
          <div className="hidden md:flex items-center gap-5">
             <a href="/login">
               <button
                  className={btnSecondary.replace('h-11', 'h-10').replace('px-7', 'px-5')}
                  style={secondaryBtnStyle}
                   onMouseEnter={e => Object.assign(e.currentTarget.style, secondaryBtnHoverStyle)}
                   onMouseLeave={e => Object.assign(e.currentTarget.style, secondaryBtnStyle)} // Reset to base style
               >Iniciar Sesión</button>
             </a>
             <a href="/register">
               <button
                   className={btnPrimary.replace('h-11', 'h-10').replace('px-7', 'px-5')}
                   style={primaryBtnStyle}
                    onMouseEnter={e => Object.assign(e.currentTarget.style, primaryBtnHoverStyle)}
                    onMouseLeave={e => Object.assign(e.currentTarget.style, primaryBtnStyle)} // Reset to base style
               >
                 Comenzar Gratis
               </button>
             </a>

             {/* Dark Mode Toggle Button */}
              
          </div>

          {/* Mobile Menu Button */}
           <button
               className={`md:hidden inline-flex items-center justify-center rounded-lg p-2.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-inset ${
                    isDarkMode ? 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-200 focus:ring-gray-500'
                               : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:ring-indigo-500'}`
               }
               onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
               aria-label="Toggle menu"
               aria-expanded={mobileMenuOpen}
           >
             {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
           </button>
        </div>

        {/* Mobile Menu Panel */}
         {mobileMenuOpen && (
           <div className="absolute top-full inset-x-0 md:hidden shadow-xl border-t backdrop-blur-md" style={{ backgroundColor: `${currentColors.glassBgLight}/90`, borderColor: currentColors.glassBorder }}>
             <div className="px-5 pt-5 pb-7 space-y-5">
                <div className="flex flex-col gap-4">
                    {/* Mobile Buttons (Re-apply logic if needed, styles should cascade mostly) */}
                    <a href="/login" className="w-full">
                        <button className={`${btnSecondary} w-full h-12 text-base`}
                                style={secondaryBtnStyle}>Iniciar Sesión</button>
                    </a>
                    <a href="/register" className="w-full">
                         <button className={`${btnPrimary} w-full h-12 text-base`}
                                style={primaryBtnStyle}>Comenzar Gratis</button>
                    </a>
                     {/* Mobile Dark Mode Toggle */}
                      <button
                          onClick={() => { toggleDarkMode(); setMobileMenuOpen(false); }} // Close menu on toggle
                          className={`w-full flex items-center justify-center gap-2 p-3 rounded-lg transition-colors duration-200 ${isDarkMode ? 'text-yellow-400 bg-gray-700/50 hover:bg-gray-600/60' : 'text-indigo-700 bg-indigo-100 hover:bg-indigo-200/70'}`}
                      >
                         {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                         <span>{isDarkMode ? "Modo Claro" : "Modo Oscuro"}</span>
                      </button>
                </div>
             </div>
           </div>
         )}
      </header>

      <main className="flex-1">
        {/* === Hero Section === */}
        <section
          className="relative w-full pt-28 pb-32 md:pt-36 md:pb-40 lg:pt-44 lg:pb-48 overflow-hidden"
          style={{
             background: isDarkMode
               ? `linear-gradient(155deg, ${darkColors.offWhite} 15%, ${darkColors.bgGradientLight} 60%, ${darkColors.primarySubtleGlow} 110%)`
               : `linear-gradient(155deg, ${colors.white} 15%, ${colors.bgGradientLight} 60%, ${colors.primarySubtleGlow} 110%)`,
          }}
        >
           <div className="absolute inset-0 opacity-50 dark:opacity-30 mix-blend-soft-light dark:mix-blend-lighten pointer-events-none z-0">
               <div className="absolute -top-1/4 left-1/4 w-1/2 h-1/2 rounded-full" style={{ background: `radial-gradient(circle, ${currentColors.secondaryAccent} 30%, transparent 70%)`, filter: 'blur(100px)' }}></div>
               <div className="absolute -bottom-1/4 right-1/4 w-2/5 h-2/5 rounded-full" style={{ background: `radial-gradient(circle, ${currentColors.primary} 30%, transparent 70%)`, filter: 'blur(120px)' }}></div>
           </div>

           <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="grid lg:grid-cols-2 gap-x-16 gap-y-12 items-center">
              {/* Text Content */}
              <div className="max-w-xl text-left animate-fade-in-up">
                <span className="inline-block text-xs font-semibold uppercase tracking-widest mb-4 px-4 py-1.5 rounded-full" style={{ color: currentColors.primaryDark, background: `linear-gradient(to right, ${currentColors.primarySubtleGlow}, ${currentColors.secondaryAccentGlow})` }}>
                  Plataforma Conectada
                </span>
                <h1 className="text-5xl font-bold tracking-tighter sm:text-6xl md:text-7xl mb-6 !leading-tight" style={{ color: currentColors.textHeading }}>
                   Prescripción <span style={{ color: currentColors.primary }}>Digital</span> Segura y Eficiente.
                </h1>
                <p className="text-lg md:text-xl mb-12 leading-relaxed" style={{ color: currentColors.textBody }}>
                  Optimiza flujos, mejora la seguridad y conecta a profesionales y pacientes con nuestra solución integral.
                </p>
                {/* Hero Buttons */}
                <div className="flex flex-col sm:flex-row gap-5">
                   <a href="/register">
                    <button
                         className={`${btnPrimary} text-base px-8 py-3.5 w-full sm:w-auto shadow-xl hover:shadow-2xl`}
                         style={primaryBtnStyle}
                           onMouseEnter={e => Object.assign(e.currentTarget.style, primaryBtnHoverStyle)}
                            onMouseLeave={e => Object.assign(e.currentTarget.style, primaryBtnStyle)}
                    >
                       <span>Comienza Ahora</span>
                       <ArrowRight className="ml-2 h-5 w-5" />
                    </button>
                  </a>
                  <a href="#interfaces">
                     <button
                         className={`${btnSecondary} text-base px-8 py-3.5 w-full sm:w-auto`}
                         style={secondaryBtnStyle}
                         onMouseEnter={e => Object.assign(e.currentTarget.style, secondaryBtnHoverStyle)}
                            onMouseLeave={e => Object.assign(e.currentTarget.style, secondaryBtnStyle)}
                     >
                       Ver Plataforma
                    </button>
                  </a>
                </div>
                 <div className="flex items-center gap-3 text-sm mt-10" style={{ color: currentColors.textMuted }}>
                   <ShieldCheck className="h-5 w-5 flex-shrink-0" style={{color: currentColors.primary}} strokeWidth={2}/>
                   <span>Máxima seguridad y cumplimiento normativo. Certificado.</span>
                 </div>
               </div>

              {/* Visual Element */}
              <div className="flex justify-center lg:justify-end relative group animate-fade-in">
                 <div className="relative w-full max-w-lg aspect-square">
                    {/* Back Layer */}
                     <div className="absolute inset-4 rounded-3xl opacity-50 group-hover:opacity-70 transition-opacity duration-500"
                         style={{ background: `radial-gradient(circle at center, ${currentColors.primaryGlow} 0%, transparent 70%)`, filter: 'blur(50px)'}}></div>

                     {/* Main Glass Layer */}
                    <div className="absolute inset-0 rounded-3xl p-1.5 shadow-2xl overflow-hidden transition-all duration-500 group-hover:shadow-[0_10px_40px_-10px]"
                          style={{
                            background: `linear-gradient(145deg, ${currentColors.glassBorderHighlight}, ${currentColors.glassBorder})`,
                            boxShadow: `0 10px 40px -10px ${currentColors.deepShadow}`
                          }}
                        >
                        <div className="w-full h-full rounded-[20px] relative overflow-hidden"
                             style={{
                                 backgroundColor: currentColors.glassBg,
                                 backdropFilter: 'blur(18px)',
                                 backgroundImage: subtleNoisePatternURL,
                                 backgroundSize: '150px 150px',
                                 backgroundBlendMode: 'overlay',
                                 opacity: isDarkMode ? 0.2 : 0.4,
                            }}>
                             {/* Inner light source effect */}
                             <div className="absolute -top-1/3 -left-1/3 w-2/3 h-2/3 rounded-full opacity-30 group-hover:opacity-50 transition-opacity"
                                   style={{background: `radial-gradient(circle, ${isDarkMode ? 'rgba(209,213,219,0.5)' : 'rgba(255,255,255,0.5)' } 0%, transparent 70%)`, filter: 'blur(30px)'}}></div>
                       </div>
                    </div>

                     {/* Floating Content Layer */}
                     <div className="absolute inset-8 flex flex-col items-center justify-center transition-transform duration-500 ease-out group-hover:scale-105">
                        <img src="/logo.png" alt="Carelux Point Icon" className="relative z-10 w-1/3 h-1/3 mb-4 opacity-95 drop-shadow-xl transition-all duration-500 group-hover:opacity-100" />
                        <h3 className="text-lg font-semibold text-center" style={{color: currentColors.textHeading}}>Carelux Point</h3>
                        <p className="text-xs text-center" style={{color: currentColors.textMuted}}>Prescripción Inteligente</p>
                         <LineChart className="absolute top-5 right-5 h-8 w-8 opacity-20 group-hover:opacity-30 group-hover:-rotate-6 transition-all duration-500" style={{color: currentColors.primary}}/>
                         <Stethoscope className="absolute bottom-5 left-5 h-9 w-9 opacity-20 group-hover:opacity-30 group-hover:rotate-3 transition-all duration-500" style={{color: currentColors.primary}}/>
                     </div>
                     {/* Top Highlight Border */}
                     <div className="absolute inset-0 rounded-3xl border border-t-[${currentColors.glassBorderHighlight}] border-x-transparent border-b-transparent pointer-events-none opacity-80"></div>
                 </div>
               </div>
            </div>
           </div>
         </section>

        {/* === Section Divider === */}
        <div className="w-full h-16 md:h-24" style={{background: `linear-gradient(to bottom, ${currentColors.primarySubtleGlow}, transparent)`}}></div>


        {/* === Features/Benefits Section === */}
        <section className="w-full pb-24 md:pb-32" style={{ backgroundColor: currentColors.offWhite }}>
           <div className="container mx-auto px-4 sm:px-6 lg:px-8">
             <div className="text-center max-w-3xl mx-auto mb-20">
                <h2 className="text-4xl font-bold tracking-tight md:text-5xl mb-5" style={{ color: currentColors.textHeading }}>
                    Diseñado para <span style={{ color: currentColors.primary }}>Eficiencia y Confianza</span>
                </h2>
                <p className="text-lg" style={{ color: currentColors.textBody }}>
                   Ventajas clave que transforman tu práctica diaria con tecnología segura y fácil de usar.
                </p>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
               <RicherFeatureItem icon={ShieldCheck} title="Seguridad Inquebrantable" description="Encriptación de grado militar y protocolos de cumplimiento estrictos para la máxima protección de datos." isDarkMode={isDarkMode}/>
               <RicherFeatureItem icon={Sparkles} title="Experiencia Fluida" description="Interfaz intuitiva y moderna, diseñada para una navegación sin esfuerzo y una adopción rápida por todo el equipo." isDarkMode={isDarkMode}/>
               <RicherFeatureItem icon={LineChart} title="Acceso Unificado" description="Gestión centralizada disponible 24/7 desde cualquier dispositivo, asegurando continuidad y control total." isDarkMode={isDarkMode}/>
             </div>
           </div>
         </section>

         {/* === Section Divider (Reversed Gradient) === */}
          <div className="w-full h-16 md:h-24" style={{background: `linear-gradient(to top, ${currentColors.primarySubtleGlow}, transparent)`}}></div>


        {/* === Interfaces Section (Corrected Layering) === */}
        <section id="interfaces" className="w-full py-24 md:py-32 lg:py-40 relative overflow-hidden group/section"
                 style={{
                     backgroundColor: currentColors.bgGradientLight, // Base color
                     borderTop: `1px solid ${currentColors.borderSoft}`,
                     borderBottom: `1px solid ${currentColors.borderSoft}`
                     // Opacity and noise handled by ::before pseudo-element via global styles
                  }}>
           {/* Background Glow */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
               <div className="w-1/2 h-1/2 rounded-full opacity-25" style={{ background: `radial-gradient(circle, ${currentColors.secondaryAccentGlow} 0%, ${currentColors.primaryGlow} 70%, transparent 100%)`, filter: `blur(${isDarkMode ? '180px': '150px'})` }}></div>
            </div>
            {/* Content Container */}
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
             <div className="text-center max-w-3xl mx-auto mb-20">
               <span className="inline-block text-xs font-semibold uppercase tracking-widest mb-3 px-4 py-1.5 rounded-full" style={{ color: currentColors.primaryDark, background: `linear-gradient(to right, ${currentColors.primarySubtleGlow}, ${currentColors.secondaryAccentGlow})` }}>
                 Nuestra Plataforma
               </span>
               <h2 className="text-4xl font-bold tracking-tight md:text-5xl mb-4" style={{ color: currentColors.textHeading }}>
                 Un <span style={{color: currentColors.primary}}>Entorno Adaptado</span> a Cada Rol
               </h2>
               <p className="text-lg" style={{ color: currentColors.textBody }}>
                 Interfaces optimizadas y específicas que simplifican las tareas de administradores, farmacéuticos, médicos y pacientes.
               </p>
             </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
               {/* Pass isDarkMode to children */}
               <RicherInterfaceCard
                  icon={LineChart} title="Portal Administrador"
                  features={["Dashboard de métricas clave", "Gestión granular de permisos", "Auditoría y reportes avanzados"]}
                  isDarkMode={isDarkMode}
               />
               <RicherInterfaceCard
                  icon={Pill} title="Portal Farmacia"
                  features={["Validación rápida de e-recetas", "Inventario y alertas de stock", "Registro de dispensación seguro"]}
                  isDarkMode={isDarkMode}
               />
               <RicherInterfaceCard
                  icon={Stethoscope} title="Portal Médico"
                  features={["Creación inteligente de recetas", "Acceso a historial clínico unificado", "Soporte de decisión clínica"]}
                  isDarkMode={isDarkMode}
                />
               <RicherInterfaceCard
                   icon={UserCircle} title="Portal Paciente"
                   features={["Consulta de tratamientos activos", "Recordatorios y plan de medicación", "Comunicación segura con médico"]}
                   isDarkMode={isDarkMode}
               />
            </div>
          </div>
        </section>


        {/* === CTA Section === */}
        <section className="w-full py-28 md:py-36 relative overflow-hidden"
                 style={{ background: `linear-gradient(135deg, ${currentColors.primaryDark} 0%, ${currentColors.primary} 60%, ${currentColors.secondaryAccent} 100%)` }}>
              <div className="absolute inset-0 opacity-10 dark:opacity-5 mix-blend-overlay dark:mix-blend-screen pointer-events-none" style={{backgroundImage: `linear-gradient(45deg, rgba(255,255,255,0.1) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.1) 75%, rgba(255,255,255,0.1)), linear-gradient(45deg, rgba(255,255,255,0.1) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.1) 75%, rgba(255,255,255,0.1))`, backgroundSize: '40px 40px', backgroundPosition: '0 0, 20px 20px'}}></div>

             <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
                 <Sparkles className={`h-12 w-12 mx-auto mb-6 opacity-70 ${isDarkMode ? 'text-gray-400' : 'text-white/50'}`} />
                 <h2 className="text-4xl font-bold text-white sm:text-5xl md:text-6xl mb-6 max-w-4xl mx-auto !leading-tight drop-shadow-lg" style={{ color: isDarkMode ? darkColors.textHeading : colors.white }}>
                  Transforma Tu Flujo de Prescripción Hoy Mismo.
                 </h2>
                 <p className={`text-lg md:text-xl max-w-2xl mx-auto mb-12 ${isDarkMode ? 'text-gray-300/90' : 'text-white/90'}`}>
                   Únete a la revolución digital en salud. Empieza gratis y descubre el poder de Carelux Point.
                 </p>
                 <a href="/register">
                    {/* CTA Button - Special style */}
                    <button className={`${btnBase} text-lg font-semibold h-14 px-10 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 active:translate-y-0`}
                           style={{ // Explicit light/dark button style for CTA
                                background: isDarkMode ? darkColors.bgGradientLight : colors.white, // Changed BG for dark
                                color: currentColors.primary, // Use theme primary
                                border: `1px solid ${isDarkMode ? currentColors.borderSoft : 'transparent'}`,
                                focusVisibleRingOffset: isDarkMode ? darkColors.offWhite : colors.offWhite,
                           }}
                          onMouseEnter={e => {
                             e.currentTarget.style.backgroundColor = isDarkMode ? darkColors.white : colors.offWhite; // Brighter on hover
                             e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)'; // Pop effect
                           }}
                          onMouseLeave={e => {
                             e.currentTarget.style.backgroundColor = isDarkMode ? darkColors.bgGradientLight : colors.white; // Reset BG
                             e.currentTarget.style.transform = 'translateY(-2px)'; // Keep slight raise? Or reset fully?
                             // For full reset use: 'translateY(-1.5px)'; if original base is -1.5px translate
                          }}
                    >
                      Empieza Gratis Ahora
                      <ArrowRight className="ml-2.5 h-6 w-6" />
                   </button>
                 </a>
             </div>
         </section>
       </main>

      {/* === Footer === */}
      <footer className="w-full border-t pt-20 pb-16" style={{ backgroundColor: currentColors.white, borderColor: currentColors.borderSoft }}>
         <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-8 mb-16">
               {/* Logo & Desc */}
                <div className="col-span-1 md:col-span-3 lg:col-span-4">
                    <a href="/" className="flex items-center gap-3 text-xl font-semibold mb-5 group" style={{ color: currentColors.textHeading }}>
                         <div className={`p-1 rounded-lg shadow-sm group-hover:shadow-md transition-shadow ${isDarkMode ? 'bg-gray-700/50' : 'bg-gradient-to-br from-white/80 to-gray-50'}`}>
                            <img src="/logo.png" alt="Carelux Point" className="h-8 w-8 group-hover:rotate-[5deg] transition-transform" />
                        </div>
                        <span className={`group-hover:text-[${currentColors.primary}] transition-colors`}>Carelux Point</span>
                    </a>
                    <p className="text-sm pr-6" style={{ color: currentColors.textMuted }}>
                        Innovando en la salud digital para conectar profesionales y pacientes a través de prescripciones seguras y eficientes.
                    </p>
                </div>

                {/* Footer Columns */}
                {[ // Array for easier mapping/updates if needed
                  { title: 'Producto', links: ['Visión General', 'Médicos', 'Farmacias', 'Pacientes', 'Precios'] },
                  { title: 'Recursos', links: ['Centro de Ayuda', 'Blog & Noticias', 'Casos de Éxito', 'Documentación'] },
                  { title: 'Empresa', links: ['Sobre Nosotros', 'Carreras', 'Contacto'] },
                  { title: 'Legal', links: ['Privacidad', 'Términos de Uso', 'Política Cookies', 'Seguridad'] }
                ].map((col) => (
                    <div key={col.title} className="col-span-1 md:col-span-1 lg:col-span-2">
                        <h4 className="text-sm font-semibold mb-4 uppercase tracking-wider" style={{ color: currentColors.textHeading }}>{col.title}</h4>
                        <ul className="space-y-2.5 text-sm">
                            {col.links.map(link => (
                                <li key={link}><a href="#" className={btnText} style={{ color: currentColors.textMuted }}>{link}</a></li>
                            ))}
                        </ul>
                    </div>
                 ))}
             </div>
             {/* Copyright */}
             <div className="pt-10 border-t text-center text-xs" style={{ borderColor: currentColors.borderSoft, color: currentColors.textMuted }}>
                © {new Date().getFullYear()} Carelux Point Systems Inc. Todos los derechos reservados. Diseñado y desarrollado con ❤️.
             </div>
          </div>
        </footer>

       {/* Global Styles & Keyframes */}
       <style jsx global>{`
          /* Keyframes */
         @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
         @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
         @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

         /* Animation Classes */
         .animate-fade-in { animation: fadeIn 0.8s ease-out forwards; }
         .animate-fade-in-up { animation: fadeInUp 0.8s ease-out forwards; }
         .animate-spin-slow { animation: spin-slow 20s linear infinite; }

          /* Noise Pseudo-element Styling for #interfaces */
          #interfaces::before {
             content: '';
             position: absolute;
             inset: 0;
             background-image: ${subtleNoisePatternURL};
             background-size: 200px 200px;
             z-index: 0; /* Behind the content */
             pointer-events: none;
             opacity: 0.3; /* Default (light mode) */
             background-blend-mode: multiply; /* Default (light mode) */
             transition: opacity 0.4s ease-in-out, background-blend-mode 0.4s ease-in-out; /* Smooth transitions */
          }
          /* Dark mode adjustments for noise */
          .dark #interfaces::before {
             opacity: 0.15;
             background-blend-mode: screen; /* Use 'screen' or 'overlay' for dark */
          }

         /* Basic body/html adjustments */
         html {
            scroll-behavior: smooth;
            background-color: ${isDarkMode ? darkColors.offWhite : colors.offWhite};
            color-scheme: ${isDarkMode ? 'dark' : 'light'};
            transition: background-color 0.4s ease-in-out; /* Smooth bg transition */
          }
          body {
              overscroll-behavior-y: none; /* Prevent pull-to-refresh on mobile if desired */
          }
          /* Selection styling */
          ::selection {
              background-color: ${isDarkMode ? darkColors.primary : colors.primary };
              color: ${isDarkMode ? darkColors.white : colors.white };
          }
       `}</style>
     </div>
   );
 }


// --- Helper: Richer Feature Item ---
function RicherFeatureItem({ icon: Icon, title, description, isDarkMode }) {
  const currentColors = isDarkMode ? darkColors : colors;
  return (
    <div
      className="relative group flex flex-col items-center text-center p-8 rounded-2xl transition-all duration-300 ease-out border animate-fade-in-up"
      style={{
        animationDelay: '0.2s',
        backgroundColor: isDarkMode ? darkColors.bgGradientLight : colors.white,
        borderColor: isDarkMode ? currentColors.borderSoft : 'transparent',
        boxShadow: isDarkMode ? '0 4px 15px -3px rgba(0,0,0,0.2)' : '0 6px 15px -3px rgba(58,94,84,0.1)',
        // Added explicit transition properties
        transitionProperty: 'transform, box-shadow, border-color, background-color',
        transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)', // Tailwind default ease
        transitionDuration: '300ms',
      }}
    >
      {/* Conditional Border on Hover */}
       <div className="absolute inset-0 rounded-2xl border border-transparent group-hover:border-[${currentColors.primary}]/30 transition-colors duration-300 pointer-events-none"></div>
      {/* Background Shine Effect */}
       <div className="absolute top-0 left-0 w-full h-full rounded-2xl overflow-hidden opacity-0 group-hover:opacity-10 transition-opacity duration-500 pointer-events-none">
             <div className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] bg-gradient-radial from-[${currentColors.primarySubtleGlow}] via-transparent to-transparent animate-spin-slow"></div>
       </div>
      {/* Content */}
       <div className="relative z-10 flex flex-col items-center">
            <div className={`relative mb-6 w-16 h-16 flex items-center justify-center rounded-full shadow-lg transition-all duration-300 group-hover:shadow-xl`} style={{ background: `linear-gradient(145deg, ${isDarkMode ? currentColors.bgGradientLight : colors.white}, ${isDarkMode ? darkColors.white : colors.offWhite})`, border: `1px solid ${currentColors.borderSoft}` }}>
                 <div className={`p-3.5 rounded-full text-white transition-all duration-300 ease-out group-hover:scale-110 bg-gradient-to-br from-[${currentColors.primaryLight}] to-[${currentColors.primary}] group-hover:from-[${currentColors.primary}] group-hover:to-[${currentColors.secondaryAccent}]`}>
                     <Icon className="h-7 w-7" strokeWidth={1.75} />
                 </div>
                  <div className="absolute -inset-1 rounded-full opacity-0 group-hover:opacity-50 transition-opacity duration-300 pointer-events-none" style={{ background: `radial-gradient(circle, ${currentColors.primaryGlow} 0%, transparent 70%)`, filter: 'blur(12px)' }}></div>
            </div>
           <h3 className="text-xl font-semibold mb-3" style={{ color: currentColors.textHeading }}>{title}</h3>
           <p className="text-sm leading-relaxed px-2" style={{ color: currentColors.textMuted }}>{description}</p>
       </div>
   </div>
  );
}

// --- Helper: Richer Interface Card ---
function RicherInterfaceCard({ icon: Icon, title, features = [], isDarkMode }) {
  const currentColors = isDarkMode ? darkColors : colors;
  return (
    <div
      className="group relative flex flex-col rounded-2xl p-6 transition-all duration-300 ease-out shadow-xl hover:shadow-2xl transform hover:-translate-y-1.5 border overflow-hidden backdrop-blur-lg animate-fade-in-up"
      style={{
          animationDelay: '0.4s',
          backgroundColor: `${isDarkMode ? currentColors.glassBgLight : currentColors.glassBgLight}/80`,
          borderColor: currentColors.glassBorder,
          boxShadow: isDarkMode ? '0 8px 25px -5px rgba(0,0,0,0.3)' : '0 8px 25px -5px rgba(58,94,84,0.15)',
      }}
    >
        {/* Gradient Border */}
        <div className="absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-400 pointer-events-none z-0" style={{ background: `linear-gradient(145deg, ${currentColors.secondaryAccent}, ${currentColors.primary})` }}></div>
        {/* Inner highlight */}
        <div className="absolute inset-0 rounded-[15px] border border-[${currentColors.glassBorderHighlight}] opacity-50 group-hover:opacity-80 transition-opacity duration-400 pointer-events-none mix-blend-overlay z-0"></div>
        {/* Content */}
        <div className="relative z-10 flex flex-col h-full">
             <div className={`mb-6 w-14 h-14 flex items-center justify-center rounded-xl text-white shadow-lg bg-gradient-to-br from-[${currentColors.primaryLight}] to-[${currentColors.primary}] transition-all duration-300 group-hover:from-[${currentColors.primary}] group-hover:to-[${currentColors.secondaryAccent}] group-hover:scale-105 group-hover:-rotate-3`}>
                 <Icon className="h-7 w-7" strokeWidth={1.75} />
             </div>
            <h3 className="text-lg font-semibold mb-4" style={{ color: currentColors.textHeading }}>{title}</h3>
             <ul className="space-y-3 text-sm flex-grow mb-5">
                {features.map((feature, index) => (
                   <li key={index} className="flex items-start gap-3">
                      <CheckCircle className="h-4 w-4 flex-shrink-0 mt-0.5 group-hover:text-[${currentColors.secondaryAccent}] transition-colors" style={{color: currentColors.primary}} strokeWidth={2.5} />
                      <span className="opacity-90 group-hover:opacity-100 transition-opacity" style={{ color: currentColors.textBody }}>{feature || "Descripción pendiente"}</span>
                    </li>
                ))}
             </ul>
             <div className="mt-auto pt-2 border-t" style={{borderColor: `rgba(${ isDarkMode ? '255,255,255' : '0,0,0'}, 0.08)`}}>
                 <span className={`flex items-center text-xs font-medium transition-colors duration-300 group-hover:text-[${currentColors.primary}]`} style={{color: `${currentColors.primaryDark}/90`}}>
                    Explorar Funciones
                    <MoveUpRight className="ml-1.5 h-3.5 w-3.5 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 group-hover:-translate-y-0.5 transition-all duration-300" />
                </span>
            </div>
         </div>
     </div>
   );
 }
