import React, { useState } from 'react';
import { Users, Lock, ArrowLeft } from 'lucide-react';
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from '../services/firebase';

const Login = ({ onLoginSuccess }) => {
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");

  const handleAdminLogin = async () => {
    if (!passwordInput) return alert("Digite a senha.");
    try {
      // Login fixo ou dinâmico
      const email = emailInput || "admin@teamebony.com";
      await signInWithEmailAndPassword(auth, email, passwordInput);
      onLoginSuccess();
    } catch (error) {
      console.error(error);
      alert("Acesso negado. Verifique a senha.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F7F7F5] p-4 font-sans">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100 animate-in fade-in zoom-in duration-500">
        <div className="bg-black p-8 text-center">
          <div className="w-14 h-14 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center mx-auto mb-4 shadow-inner">
            <span className="text-white font-bold text-lg tracking-wider">ON</span>
          </div>
          <h2 className="text-white text-lg font-bold">Gestão Consultoria Team Ebony</h2>
          <p className="text-gray-400 text-xs mt-1 uppercase tracking-widest opacity-80">Acesso Administrativo</p>
        </div>
        
        <div className="p-8 pt-10 space-y-5">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2 ml-1">E-mail</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Users className="h-5 w-5 text-gray-300 group-focus-within:text-black transition-colors" />
              </div>
              <input 
                type="email" 
                placeholder="admin@teamebony.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2 ml-1">Senha</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-300 group-focus-within:text-black transition-colors" />
              </div>
              <input 
                type="password" 
                placeholder="••••••••"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
                className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200"
              />
            </div>
          </div>

          <button 
            onClick={handleAdminLogin} 
            className="w-full flex items-center justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-black hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 transition-all transform active:scale-[0.98]"
          >
            Entrar no Sistema
            <ArrowLeft className="w-4 h-4 ml-2 rotate-180" />
          </button>
        </div>

        <div className="bg-gray-50 px-8 py-4 border-t border-gray-100 text-center">
          <p className="text-[10px] text-gray-400">Área restrita para treinadores.</p>
        </div>
      </div>
      <p className="mt-8 text-xs text-gray-400 font-medium opacity-50">Consultoria Ebony Team © 2025</p>
    </div>
  );
};

export default Login;