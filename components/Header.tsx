import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const Header: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-20 bg-black/40 backdrop-blur-xl border-b border-white/10 shadow-2xl">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo / Brand */}
          <button
            onClick={() => navigate("/")}
            className="group flex items-center gap-2 sm:gap-3"
          >
            {/* Animated Icon - PILIH SALAH SATU */}
            
            {/* OPTION A: Brain/AI Icon (Recommended) */}
            <div className="relative w-10 h-10 sm:w-12 sm:h-12">
              <div className="absolute inset-0 bg-gradient-to-br from-brand-secondary to-brand-primary rounded-xl opacity-50 blur-lg group-hover:opacity-75 transition-opacity"></div>
              <div className="relative w-full h-full bg-gradient-to-br from-brand-primary to-brand-secondary rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-ping opacity-75"></div>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-300 rounded-full"></div>
              </div>
            </div>

 
            {/* Brand Text */}
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-xl sm:text-3xl font-black text-white group-hover:text-brand-secondary transition-colors duration-300">
                  Quiz<span className="text-brand-secondary group-hover:text-white">Gen</span>
                </span>
              </div>
              {/* Subtitle - NOW VISIBLE ON MOBILE TOO */}
              <span className="text-[10px] sm:text-[11px] text-gray-400 font-medium tracking-widest -mt-1">
                Smart Quiz Generator
              </span>
            </div>
          </button>

          {/* Desktop Navigation */}
          <nav className="hidden sm:flex items-center gap-3">
            <button
              onClick={() => navigate("/")}
              className="relative px-5 py-2.5 text-sm font-semibold text-gray-300 hover:text-white transition-colors duration-200 group"
            >
              Home
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-brand-secondary group-hover:w-full transition-all duration-300"></span>
            </button>
            
            <div className="w-px h-6 bg-white/10"></div>
            
            <button
              onClick={() => navigate("/login")}
              className="relative px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-brand-primary to-brand-secondary rounded-full overflow-hidden group shadow-lg shadow-brand-primary/25"
            >
              <span className="relative z-10">Teacher Login</span>
              <div className="absolute inset-0 bg-gradient-to-r from-brand-secondary to-brand-primary opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </button>
          </nav>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="sm:hidden relative p-2.5 text-gray-300 hover:text-white transition-colors group"
          >
            <div className="absolute inset-0 bg-white/5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <svg
              className={`relative w-6 h-6 transition-transform duration-300 ${isOpen ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d={isOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown with animation */}
      <div 
        className={`sm:hidden overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="bg-gradient-to-b from-gray-900/95 to-black/95 backdrop-blur-xl border-t border-white/5 shadow-2xl">
          <div className="px-4 py-4 space-y-2">
            <button
              onClick={() => {
                navigate("/");
                setIsOpen(false);
              }}
              className="flex items-center gap-3 w-full text-left px-4 py-3.5 text-gray-300 hover:text-white bg-white/0 hover:bg-white/5 rounded-xl transition-all duration-200 group"
            >
              <span className="text-xl group-hover:scale-110 transition-transform">🏠</span>
              <span className="font-semibold">Home</span>
            </button>
            
            <button
              onClick={() => {
                navigate("/login");
                setIsOpen(false);
              }}
              className="flex items-center gap-3 w-full text-left px-4 py-3.5 bg-gradient-to-r from-brand-primary to-brand-secondary text-white font-bold rounded-xl shadow-lg shadow-brand-primary/30 hover:shadow-xl hover:scale-[1.02] transition-all duration-200 group"
            >
              <span className="text-xl group-hover:scale-110 transition-transform">👨‍🏫</span>
              <span>Teacher Login</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;