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
  MoveUpRight,
  Sun,
  Moon,
} from "lucide-react";

// --- Light Mode Color Palette (Azul) ---
const colors = {
  primary: "#29abe2",
  primaryLight: "#5bc0eb",
  primaryDark: "#1a7ca8",
  primaryGlow: "rgba(41, 171, 226, 0.3)",
  primarySubtleGlow: "rgba(41, 171, 226, 0.15)",
  secondaryAccent: "#90e0ef",
  secondaryAccentGlow: "rgba(144, 224, 239, 0.2)",
  glassBg: "rgba(255, 255, 255, 0.6)",
  glassBgLight: "rgba(255, 255, 255, 0.8)",
  glassBgSubtle: "rgba(255, 255, 255, 0.9)",
  glassBorder: "rgba(255, 255, 255, 0.4)",
  glassBorderHighlight: "rgba(255, 255, 255, 0.8)",
  textHeading: "#0a2e3d",
  textBody: "#374151",
  textMuted: "#525f70",
  borderSoft: "rgba(41, 171, 226, 0.1)",
  borderFocus: "rgba(41, 171, 226, 0.6)",
  white: "#ffffff",
  offWhite: "#f5f9fa",
  bgGradientLight: "#e6f4f9",
  deepShadow: "rgba(26, 124, 168, 0.15)",
  lightSource: "rgba(255, 255, 255, 0.15)",
};

// --- Dark Mode Color Palette (Azul) ---
const darkColors = {
  primary: "#5bc0eb",
  primaryLight: "#90e0ef",
  primaryDark: "#29abe2",
  primaryGlow: "rgba(91, 192, 235, 0.3)",
  primarySubtleGlow: "rgba(91, 192, 235, 0.15)",
  secondaryAccent: "#caf0f8",
  secondaryAccentGlow: "rgba(202, 240, 248, 0.2)",
  glassBg: "rgba(31, 41, 55, 0.5)",
  glassBgLight: "rgba(55, 65, 81, 0.7)",
  glassBgSubtle: "rgba(17, 24, 39, 0.8)",
  glassBorder: "rgba(75, 85, 99, 0.4)",
  glassBorderHighlight: "rgba(107, 114, 128, 0.5)",
  textHeading: "#f0f9ff",
  textBody: "#d1d5db",
  textMuted: "#9ca3af",
  borderSoft: "rgba(55, 65, 81, 0.3)",
  borderFocus: "rgba(91, 192, 235, 0.7)",
  white: "#111827",
  offWhite: "#111827",
  bgGradientLight: "#1f2937",
  deepShadow: "rgba(0, 0, 0, 0.25)",
  lightSource: "rgba(255, 255, 255, 0.05)",
};

// Resto del código permanece igual hasta el componente LandingPage...

export default function LandingPage() {
  // ... (código anterior igual)

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
                boxShadow: `0 2px 10px -2px ${isDarkMode ? 'rgba(0,0,0, 0.2)' : 'rgba(41, 171, 226, 0.1)'}`,
              }}
      >
        {/* ... (resto del header igual) */}
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
           {/* ... (resto del hero igual) */}
        </section>

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

         {/* === CTA Section === */}
        <section className="w-full py-28 md:py-36 relative overflow-hidden"
                 style={{ background: `linear-gradient(135deg, ${currentColors.primaryDark} 0%, ${currentColors.primary} 60%, ${currentColors.secondaryAccent} 100%)` }}>
              {/* ... (resto del CTA igual) */}
         </section>
       </main>

      {/* === Footer === */}
      <footer className="w-full border-t pt-20 pb-16" style={{ backgroundColor: currentColors.white, borderColor: currentColors.borderSoft }}>
         {/* ... (resto del footer igual) */}
      </footer>
    </div>
  );
}

// Los componentes helper (RicherFeatureItem y RicherInterfaceCard) permanecen igual
