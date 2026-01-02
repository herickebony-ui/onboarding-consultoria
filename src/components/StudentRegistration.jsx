import React, { useState } from 'react';
import { collection, doc, setDoc } from "firebase/firestore";
import { CheckCircle, Loader } from 'lucide-react';
import { db } from '../firebase';

// --- NOVO COMPONENTE: PRÉ-CADASTRO PÚBLICO ---
const StudentRegistration = ({ db }) => {
    const [formData, setFormData] = useState({
      name: "", cpf: "", rg: "", email: "", phone: "",
      address: "", profession: "", birthDate: ""
    });
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
  
    const handleChange = (e) => {
      setFormData({ ...formData, [e.target.name]: e.target.value });
    };
  
    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!formData.name || !formData.phone || !formData.cpf) return alert("Preencha os campos obrigatórios.");
      
      setLoading(true);
      try {
        // Cria o aluno com status 'em_analise'
        const docRef = doc(collection(db, "students"));
        await setDoc(docRef, {
          ...formData,
          phone: formData.phone.replace(/\D/g, ''), // Limpa o telefone
          status: 'em_analise', // Status novo para sua aprovação
          createdAt: new Date().toISOString(),
          planId: null, // Ainda não tem plano
          templateId: null // Ainda não tem contrato
        });
        setSuccess(true);
      } catch (error) {
        console.error(error);
        alert("Erro ao enviar cadastro. Tente novamente.");
      } finally {
        setLoading(false);
      }
    };
  
    if (success) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F7F7F5] p-4">
          <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-md animate-in zoom-in">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8"/>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Cadastro Recebido!</h2>
            <p className="text-gray-600">Recebemos seus dados com sucesso. Nossa equipe vai analisar e entrará em contato pelo WhatsApp em breve para a assinatura do contrato.</p>
          </div>
        </div>
      );
    }
  
    return (
      <div className="min-h-screen bg-[#F7F7F5] py-10 px-4 font-sans flex items-center justify-center">
        <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-black p-6 text-white text-center">
            <h1 className="text-2xl font-bold">Ficha de Cadastro</h1>
            <p className="text-gray-400 text-sm mt-1">Preencha seus dados para iniciar a consultoria</p>
          </div>
          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome Completo *</label>
                <input name="name" required value={formData.name} onChange={handleChange} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-black transition-colors" placeholder="Seu nome completo" />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">CPF *</label>
                <input name="cpf" required value={formData.cpf} onChange={handleChange} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-black transition-colors" placeholder="000.000.000-00" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">RG *</label>
                <input name="rg" required value={formData.rg} onChange={handleChange} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-black transition-colors" placeholder="Registro Geral" />
              </div>
  
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Data de Nascimento *</label>
                <input name="birthDate" type="date" required value={formData.birthDate} onChange={handleChange} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-black transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Profissão *</label>
                <input name="profession" required value={formData.profession} onChange={handleChange} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-black transition-colors" placeholder="Sua profissão" />
              </div>
  
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Endereço Completo *</label>
                <input name="address" required value={formData.address} onChange={handleChange} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-black transition-colors" placeholder="Rua, Número, Bairro, Cidade - UF, CEP" />
              </div>
  
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">WhatsApp (com DDD) *</label>
                <input name="phone" type="tel" required value={formData.phone} onChange={handleChange} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-black transition-colors" placeholder="(00) 90000-0000" />
              </div>
  
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">E-mail *</label>
                <input name="email" type="email" required value={formData.email} onChange={handleChange} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-black transition-colors" placeholder="seu@email.com" />
              </div>
            </div>
  
            <button type="submit" disabled={loading} className="w-full py-4 bg-black text-white rounded-xl font-bold hover:bg-gray-800 transition-all flex items-center justify-center gap-2 shadow-lg mt-4">
              {loading ? <Loader className="w-5 h-5 animate-spin"/> : "Enviar Cadastro"}
            </button>
          </form>
        </div>
      </div>
    );
  };

  export default StudentRegistration;