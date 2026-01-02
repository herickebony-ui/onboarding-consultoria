import React, { useState, useEffect } from 'react';
import { collection, doc, updateDoc, setDoc, getDocs, deleteDoc } from "firebase/firestore";
import { Copy, Users, FileText, Settings, Plus, Trash2, Edit, Save, X, Search, FileSignature, Palette, CheckCircle, Loader, Share2, ArrowLeft, Link as LinkIcon, ChevronRight } from 'lucide-react';

import { db } from '../firebase'; 
import { generateSlug, applyStudentValuesToContract, generateContractPDF } from '../utils/utils';
import RichTextEditor from './RichTextEditor'; 

// --- COMPONENTE DASHBOARD (ADMIN) ---
const Dashboard = ({ 
    onSelectPlan, 
    onCreatePlan, 
    plans, 
    onDeletePlan, 
    onDuplicatePlan, 
    onUpdatePlanMeta, onUpdatePlanColor,
    students, 
    onCreateStudent, 
    onDeleteStudent, 
    onReloadData,
    onToggleDelivery
  }) => {
  
    // Controle das Abas
    const [activeTab, setActiveTab] = useState('students');
    // --- FILTROS DA LISTA (ATUALIZADO: BUSCA + ASSINADO) ---
    const [filterStatus, setFilterStatus] = useState('all'); 
    const [filterMonth, setFilterMonth] = useState(''); 
    const [searchTerm, setSearchTerm] = useState(''); // NOVO: Estado da busca
  
    // Lógica de Filtragem
    const filteredStudents = students.filter(student => {
        // 1. Filtro de Nome (Busca) - NOVO
        if (searchTerm) {
            const name = (student.name || "").toLowerCase();
            const term = searchTerm.toLowerCase();
            if (!name.includes(term)) return false;
        }
  
        // 2. Filtro de Mês
        if (filterMonth) {
            const studentDate = student.createdAt ? student.createdAt.substring(0, 7) : "";
            if (studentDate !== filterMonth) return false;
        }
  
        // 3. Filtro de Status
        if (filterStatus === 'all') return true;
  
        // Status Material
        if (filterStatus === 'pending') return !student.materialDelivered; // Quem NÃO recebeu
        if (filterStatus === 'delivered') return student.materialDelivered; // Quem JÁ recebeu
  
        // Status Contrato
        if (filterStatus === 'em_analise') return student.status === 'em_analise';
        if (filterStatus === 'waiting_sign') return student.status !== 'signed' && student.status !== 'em_analise';
        if (filterStatus === 'signed') return student.status === 'signed'; // NOVO: Filtro Assinado
  
        return true;
    });
  
    // --- ESTADOS DE FLUXOS ---
    const [newPlanName, setNewPlanName] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const [editingPlan, setEditingPlan] = useState(null);
    const [editName, setEditName] = useState("");
    const [duplicatingPlan, setDuplicatingPlan] = useState(null);
    const [duplicateName, setDuplicateName] = useState("");
  
    // --- ESTADOS DE ALUNOS & CONVITE ---
    const [isInviting, setIsInviting] = useState(false);
    const [editingStudentId, setEditingStudentId] = useState(null); // ID do aluno sendo editado/aprovado
    
    // Campos básicos do convite
    const [newStudentName, setNewStudentName] = useState("");
    const [newStudentPhone, setNewStudentPhone] = useState("");
    const [selectedPlanForStudent, setSelectedPlanForStudent] = useState("");
  
    // Campos para o Template Dinâmico
    const [selectedTemplateId, setSelectedTemplateId] = useState("");
    const [adminFieldValues, setAdminFieldValues] = useState({});
    // Estado para editar os dados extras do aluno (CPF, RG, etc.)
    const [extraData, setExtraData] = useState({ cpf: '', rg: '', email: '', address: '', birthDate: '', profession: '' });
    // --- NOVOS ESTADOS PARA O FLUXO DE APROVAÇÃO (WORD) ---
    const [approvalStep, setApprovalStep] = useState(1); // 1 = Formulário, 2 = Editor Final
    const [draftContract, setDraftContract] = useState(""); // O texto do contrato para editar
    // --- ESTADOS DE MODELOS (TEMPLATES) ---
    const [templates, setTemplates] = useState([]);
    const [isEditingTemplate, setIsEditingTemplate] = useState(false);
    const [currentTemplate, setCurrentTemplate] = useState({ id: '', name: '', content: '', fields: [] });
    const [newField, setNewField] = useState({ key: '', label: '', type: 'text', owner: 'student' });
  
    const handleSaveTemplate = async () => {
      if (!currentTemplate.name) return alert("Dê um nome ao modelo.");
      try {
        const id = currentTemplate.id || generateSlug(currentTemplate.name);
        await setDoc(doc(db, "contract_templates", id), {
          name: currentTemplate.name,
          content: currentTemplate.content,
          fields: currentTemplate.fields || [],
          updatedAt: new Date().toISOString()
        });
        alert("Modelo salvo!");
        setIsEditingTemplate(false);
        const q = await getDocs(collection(db, "contract_templates"));
        setTemplates(q.docs.map(d => ({ ...d.data(), id: d.id })));
      } catch (e) { alert("Erro ao salvar template"); console.error(e); }
    };
  
    const addFieldToTemplate = () => {
      if (!newField.key || !newField.label) return alert("Preencha Chave e Rótulo");
      const cleanKey = newField.key.replace(/[{}]/g, '').trim();
      setCurrentTemplate({ ...currentTemplate, fields: [...currentTemplate.fields, { ...newField, key: cleanKey }] });
      setNewField({ key: '', label: '', type: 'text', owner: 'student' });
    };
  
    const removeFieldFromTemplate = (idx) => {
      const newFields = [...currentTemplate.fields];
      newFields.splice(idx, 1);
      setCurrentTemplate({ ...currentTemplate, fields: newFields });
    };
  
    // --- EFEITOS (LOADERS) ---
    useEffect(() => {
      if (activeTab === 'templates' || isInviting) {
        const loadTemplates = async () => {
          try {
            const database = db; 
            if (!database) return;
            const q = await getDocs(collection(database, "contract_templates"));
            const data = q.docs.map(d => ({ ...d.data(), id: d.id }));
            setTemplates(data); 
            console.log("Templates carregados:", data.length);
          } catch (e) { console.error("Erro ao buscar templates:", e); }
        };
        loadTemplates();
      }
    }, [activeTab, isInviting]);
  
    // --- FUNÇÕES DE FLUXO ---
    const handleCreate = () => {
      if(!newPlanName) return;
      const id = generateSlug(newPlanName);
      const exists = plans.some(p => p.id === id);
      if(exists) { alert("Já existe um fluxo com este nome/ID."); return; }
      onCreatePlan(id, newPlanName);
    };
  
    const copyLink = (id) => {
      const url = `${window.location.origin}/?id=${id}`;
      navigator.clipboard.writeText(url);
      alert("Link copiado: " + url);
    };
  
    // --- FUNÇÃO QUE FALTAVA: COPIAR LINK DO ALUNO ---
    const copyStudentLink = (studentId) => {
      const url = `${window.location.origin}/?token=${studentId}`;
      navigator.clipboard.writeText(url);
      alert("Link de acesso do aluno copiado:\n" + url);
    };
  
    const saveEdit = () => {
      if (!editName) return alert("Nome obrigatório");
      onUpdatePlanMeta(editingPlan.id, editingPlan.id, editName);
      setEditingPlan(null);
    };
  
    const confirmDuplicate = () => {
      if (!duplicateName) return alert("Nome da cópia obrigatório");
      onDuplicatePlan(duplicatingPlan.id, duplicateName);
      setDuplicatingPlan(null);
    };
  
    // --- FUNÇÕES DE ALUNO (CONVITE INTELIGENTE & APROVAÇÃO) ---
    
    // Função para abrir o modal com os dados do aluno que veio do site
    // --- FUNÇÕES DE ALUNO (CONVITE INTELIGENTE & APROVAÇÃO) ---
    
    const openApproveModal = (student) => {
      setEditingStudentId(student.id);
      setNewStudentName(student.name);
      setNewStudentPhone(student.phone);
      setApprovalStep(1);
      // Carrega os dados extras para edição
      setExtraData({
          cpf: student.cpf || '',
          rg: student.rg || '',
          email: student.email || '',
          address: student.address || '',
          birthDate: student.birthDate || '',
          profession: student.profession || ''
      });
      setIsInviting(true);
    };
  
    // Função NOVA: Salva apenas os dados cadastrais E ATUALIZA A TELA
    const handleSaveDataOnly = async () => {
      if (!editingStudentId) return alert("Nenhum aluno selecionado para edição.");
      
      try {
         await updateDoc(doc(db, "students", editingStudentId), {
              name: newStudentName,
              phone: newStudentPhone.replace(/\D/g, ''),
              ...extraData // Salva CPF, RG, Endereço, etc.
          });
          
          // Força a atualização da lista na hora!
          if (onReloadData) {
              await onReloadData(); 
          }
          
          alert("✅ Dados do aluno atualizados com sucesso!");
      } catch (e) {
          console.error(e);
          alert("Erro ao salvar dados.");
      }
    };
  
  // 1. GERAR RASCUNHO (Passo A -> Passo B)
  const handleGenerateDraft = () => {
    if (!newStudentName || !newStudentPhone || !selectedPlanForStudent || !selectedTemplateId) {
      alert("Preencha Nome, WhatsApp, Fluxo e escolha um Modelo.");
      return;
    }
  
    const template = templates.find(t => t.id === selectedTemplateId);
    if (!template) return alert("Modelo não encontrado.");
  
    let html = template.content;
  
    // A. Preenche Variáveis Manuais (Admin - Valor, Duração, etc)
    const adminFields = template.fields.filter(f => f.owner === 'admin');
    for (const field of adminFields) {
      const val = adminFieldValues[field.key];
      if (!val) {
        alert(`O campo "${field.label}" é obrigatório.`);
        return;
      }
      const regex = new RegExp(`{{${field.key}}}`, 'g');
      html = html.replace(regex, val);
    }
  
    // B. O GRANDE DICIONÁRIO (Conecta Banco de Dados -> Contrato)
    const studentDataForMerge = {
        // Dados Básicos
        nome: newStudentName,
        telefone: newStudentPhone,
        
        // Dados Cadastrais (ExtraData)
        cpf: extraData.cpf,
        rg: extraData.rg,
        email: extraData.email,
        profissao: extraData.profession,
        endereco: extraData.address,
        
        // Formata a data (Ex: 1998-08-07 -> 07/08/1998)
        nascimento: extraData.birthDate ? new Date(extraData.birthDate).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : "",
    };
  
    // Aplica a tradução no texto
    html = applyStudentValuesToContract(html, studentDataForMerge);
  
    // C. Avança para o Editor Final
    setDraftContract(html);
    setApprovalStep(2);
  };
  
    // 2. FINALIZAR E ENVIAR (Passo B -> Firebase)
    const handleFinalizeInvite = async () => {
      const studentFields = templates.find(t => t.id === selectedTemplateId)?.fields.filter(f => f.owner === 'student') || [];
  
      const finalData = {
        name: newStudentName,
        phone: newStudentPhone.replace(/\D/g, ''),
        ...extraData, 
        planId: selectedPlanForStudent,
        contractText: draftContract || "", // Garante que não vá vazio
        pendingFields: studentFields,
        templateId: selectedTemplateId,
        status: 'pending',
        createdAt: new Date().toISOString()
      };
  
      try {
        if (editingStudentId) {
          await updateDoc(doc(db, "students", editingStudentId), finalData);
          alert("Contrato gerado e vinculado com sucesso!");
        } else {
          // Criação direta no Banco de Dados (Independente)
          await addDoc(collection(db, "students"), {
            ...finalData,
            createdAt: new Date().toISOString()
          });
        }
        
        // Reseta tudo
        setIsInviting(false);
        setEditingStudentId(null);
        setNewStudentName("");
        setNewStudentPhone("");
        setExtraData({ cpf: '', rg: '', email: '', address: '', birthDate: '', profession: '' });
        setAdminFieldValues({});
        setSelectedTemplateId("");
        setApprovalStep(1); // Volta para o passo 1
        
        if (onReloadData) await onReloadData();
  
      } catch (e) {
        console.error(e);
        alert("Erro ao salvar.");
      }
    };
  
    // --- RENDERIZAÇÃO DO DASHBOARD ---
    return (
      <div className="min-h-screen bg-gray-50 p-6 font-sans">
        <div className="max-w-6xl mx-auto">
          
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Gestão Consultoria Team Ebony</h1>
              <p className="text-gray-500">Gestão de Consultoria</p>
            </div>
            
            <div className="bg-white p-1 rounded-xl border border-gray-200 flex shadow-sm">
              <button onClick={() => setActiveTab('students')} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'students' ? 'bg-black text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}><Users className="w-4 h-4"/> Meus Alunos</button>
              <button onClick={() => setActiveTab('flows')} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'flows' ? 'bg-black text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}>Meus Fluxos</button>
              <button onClick={() => setActiveTab('templates')} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'templates' ? 'bg-black text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}><FileText className="w-4 h-4"/> Modelos</button>
            </div>
          </div>
  
          {/* --- ABA 1: MEUS FLUXOS --- */}
          {activeTab === 'flows' && (
            <div className="animate-in fade-in duration-300">
              {editingPlan && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                  <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
                    <h2 className="text-xl font-bold mb-4">Renomear Fluxo</h2>
                    <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full p-2 border border-gray-300 rounded mb-6"/>
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setEditingPlan(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancelar</button>
                      <button onClick={saveEdit} className="px-4 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700">Salvar</button>
                    </div>
                  </div>
                </div>
              )}
              {duplicatingPlan && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                  <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
                    <h2 className="text-xl font-bold mb-2">Duplicar Fluxo</h2>
                    <input autoFocus type="text" value={duplicateName} onChange={(e) => setDuplicateName(e.target.value)} className="w-full p-2 border border-gray-300 rounded mb-2"/>
                    <p className="text-xs text-gray-400 mb-6 font-mono">ID será: {generateSlug(duplicateName || 'novo-id')}</p>
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setDuplicatingPlan(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancelar</button>
                      <button onClick={confirmDuplicate} className="px-4 py-2 bg-black text-white rounded font-bold hover:bg-gray-800 flex items-center gap-2"><Copy className="w-4 h-4"/> Duplicar</button>
                    </div>
                  </div>
                </div>
              )}
  
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="bg-white p-6 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-center hover:border-blue-500 transition-colors min-h-[200px]">
                  {!isCreating ? (
                    <button onClick={() => setIsCreating(true)} className="flex flex-col items-center gap-2 w-full h-full py-8">
                      <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center"><Plus className="w-6 h-6"/></div>
                      <span className="font-bold text-gray-700">Criar Novo Fluxo</span>
                    </button>
                  ) : (
                    <div className="w-full animate-in fade-in">
                      <input autoFocus type="text" placeholder="Nome do Fluxo" className="w-full p-2 border border-gray-300 rounded mb-3 text-sm" value={newPlanName} onChange={e => setNewPlanName(e.target.value)} />
                      <div className="flex gap-2">
                        <button onClick={handleCreate} className="flex-1 bg-black text-white py-2 rounded text-sm font-bold">Criar</button>
                        <button onClick={() => setIsCreating(false)} className="px-3 bg-gray-100 rounded text-sm font-bold">X</button>
                      </div>
                    </div>
                  )}
                </div>
                {plans.map((plan) => (
                  <div 
                    key={plan.id} 
                    className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-all relative group flex flex-col justify-between min-h-[200px]"
                    style={{ 
                      // AQUI: A borda esquerda pega a cor escolhida (ou cinza se não tiver)
                      borderLeft: `6px solid ${plan.color || '#e5e7eb'}`,
                      borderTop: '1px solid #f3f4f6',
                      borderRight: '1px solid #f3f4f6',
                      borderBottom: '1px solid #f3f4f6'
                    }}
                  >
                    <div>
                      <div className="flex justify-between items-start mb-2 pl-2">
                        <h3 className="font-bold text-lg text-gray-900 leading-tight">{plan.name || plan.id}</h3>
                        
                        <div className="flex items-center gap-1">
                          {/* SELETOR DE COR */}
                          <div className="relative group/color">
                             <div 
                               className="w-6 h-6 rounded-full border border-gray-200 cursor-pointer shadow-sm"
                               style={{ backgroundColor: plan.color || '#ffffff' }}
                               title="Mudar cor da etiqueta"
                             />
                             <input 
                                type="color" 
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                onChange={(e) => onUpdatePlanColor(plan.id, e.target.value)}
                                value={plan.color || "#ffffff"}
                             />
                          </div>
  
                          {/* Botão de Editar Nome */}
                          <button onClick={() => {setEditingPlan(plan); setEditName(plan.name || plan.id)}} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
                            <Edit className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      
                      <p className="text-xs text-gray-400 font-mono mb-6 bg-gray-50 inline-block px-2 py-1 rounded ml-2">ID: {plan.id}</p>
                    </div>
  
                    <div className="space-y-2 pl-2">
                      <button onClick={() => onSelectPlan(plan.id)} className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 flex items-center justify-center gap-2">
                        <Settings className="w-4 h-4"/> Editar Fluxo
                      </button>
                      <div className="flex gap-2">
                        <button onClick={() => copyLink(plan.id)} className="flex-1 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center justify-center gap-2" title="Link Direto"><LinkIcon className="w-4 h-4"/> Link</button>
                        <button onClick={() => {setDuplicatingPlan(plan); setDuplicateName(`${plan.name} (Cópia)`)}} className="flex-1 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center justify-center gap-2"><Copy className="w-4 h-4"/> Duplicar</button>
                      </div>
                    </div>
                    
                    <button onClick={() => {if(confirm('Tem certeza?')) onDeletePlan(plan.id)}} className="absolute -top-2 -right-2 p-2 bg-white border border-gray-200 shadow-sm rounded-full text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity z-10"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            </div>
          )}
  
          {activeTab === 'students' && (
            <div className="animate-in fade-in duration-300">
              
              {/* --- DASHBOARD DE MÉTRICAS (MANTIDO) --- */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                  {/* Card 1: Total */}
                  <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
                      <div className="flex justify-between items-start">
                          <div>
                              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total de Alunos</p>
                              <h3 className="text-3xl font-black text-gray-900 mt-1">{students.length}</h3>
                          </div>
                          <div className="p-2 bg-gray-50 rounded-lg text-gray-400"><Users className="w-6 h-6"/></div>
                      </div>
                      <div className="mt-4 text-xs text-gray-400">Base total de cadastros</div>
                  </div>
  
                  {/* Card 2: Novos no Mês */}
                  <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
                      <div className="flex justify-between items-start">
                          <div>
                              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Novos (Mês)</p>
                              <h3 className="text-3xl font-black text-gray-900 mt-1">
                                  {students.filter(s => s.createdAt && s.createdAt.startsWith(new Date().toISOString().slice(0, 7))).length}
                              </h3>
                          </div>
                          <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><Plus className="w-6 h-6"/></div>
                      </div>
                      <div className="mt-4 text-xs text-blue-600 font-bold bg-blue-50 inline-block px-2 py-1 rounded self-start">
                          Crescimento Mensal
                      </div>
                  </div>
  
                  {/* Card 3: Pendente Assinatura */}
                  <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
                      <div className="flex justify-between items-start">
                          <div>
                              <p className="text-xs font-bold text-yellow-600 uppercase tracking-wider">Falta Assinar</p>
                              <h3 className="text-3xl font-black text-yellow-600 mt-1">
                                  {students.filter(s => s.status !== 'signed').length}
                              </h3>
                          </div>
                          <div className="p-2 bg-yellow-50 rounded-lg text-yellow-600"><FileSignature className="w-6 h-6"/></div>
                      </div>
                      <div className="mt-4 text-xs text-yellow-700">Aguardando contrato</div>
                  </div>
  
                  {/* Card 4: Pendente Entrega (Material) */}
                  <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
                      <div className="flex justify-between items-start">
                          <div>
                              <p className="text-xs font-bold text-red-600 uppercase tracking-wider">Falta Entregar</p>
                              <h3 className="text-3xl font-black text-red-600 mt-1">
                                  {students.filter(s => !s.materialDelivered).length}
                              </h3>
                          </div>
                          <div className="p-2 bg-red-50 rounded-lg text-red-600"><CheckCircle className="w-6 h-6"/></div>
                      </div>
                      <div className="mt-4 text-xs text-red-700">Alunos sem material</div>
                  </div>
              </div>
  
              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                  
                  {/* 1. Busca por Nome (NOVO) */}
                  <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"/>
                      <input 
                          type="text" 
                          placeholder="Buscar aluno..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-9 p-2 border border-gray-300 rounded-lg text-sm bg-white shadow-sm outline-none focus:border-black w-40"
                      />
                  </div>
  
                  {/* 2. Filtro Data */}
                  <input 
                      type="month" 
                      value={filterMonth}
                      onChange={(e) => setFilterMonth(e.target.value)}
                      className="p-2 border border-gray-300 rounded-lg text-sm bg-white shadow-sm outline-none focus:border-black"
                      title="Filtrar por mês de entrada"
                  />
                  
                  {/* 3. Filtro Status (COM OPÇÃO ASSINADO) */}
                  <select 
                      value={filterStatus} 
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="p-2 border border-gray-300 rounded-lg text-sm bg-white shadow-sm outline-none focus:border-black font-medium"
                  >
                      <option value="all">Todos os Alunos</option>
                      
                      <optgroup label="Status do Contrato">
                          <option value="em_analise">📋 Analisar Cadastro</option>
                          <option value="waiting_sign">✍️ Aguardando Assinatura</option>
                          <option value="signed">✅ Contrato Assinado</option> {/* NOVO */}
                      </optgroup>
  
                      <optgroup label="Status do Material">
                          <option value="pending">⏳ Material Pendente</option>
                          <option value="delivered">✅ Material Entregue</option>
                      </optgroup>
                  </select>
  
                  <button onClick={() => {
                    setEditingStudentId(null);
                    setNewStudentName("");
                    setNewStudentPhone("");
                    setExtraData({ cpf: '', rg: '', email: '', address: '', birthDate: '', profession: '' });
                    setApprovalStep(1);
                    setIsInviting(true);
                  }} className="bg-black text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-gray-800 transition-colors shadow-lg ml-auto md:ml-0">
                    <Plus className="w-5 h-5" /> <span className="hidden sm:inline">Novo Aluno</span>
                  </button>
                </div>
  
              {/* --- MODAL (MANTIDO) --- */}
              {isInviting && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                  <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden animate-in zoom-in duration-200">
                    
                    <div className="bg-gray-100 border-b border-gray-300 p-4 flex justify-between items-center">
                      <div>
                          <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                              {approvalStep === 1 ? (
                                  <><Users className="w-5 h-5"/> Passo 1: Dados & Negociação</>
                              ) : (
                                  <><FileSignature className="w-5 h-5"/> Passo 2: Revisão Final da Minuta (Word)</>
                              )}
                          </h3>
                          <p className="text-xs text-gray-500">
                              {approvalStep === 1 ? "Confira os dados do aluno e defina as regras do plano." : "Edite o texto final se necessário. O que estiver aqui será o contrato oficial."}
                          </p>
                      </div>
                      <button onClick={() => setIsInviting(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                          <X className="w-6 h-6 text-gray-500"/>
                      </button>
                    </div>
  
                    <div className="flex-1 flex overflow-hidden">
                      {approvalStep === 1 && (
                          <div className="w-full h-full overflow-y-auto bg-gray-50 p-6">
                              <div className="max-w-4xl mx-auto space-y-6">
                                  <div className="space-y-3">
                                      <label className="text-xs font-bold text-gray-400 uppercase">Dados Básicos</label>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                          <input type="text" value={newStudentName} onChange={(e) => setNewStudentName(e.target.value)} className="w-full p-3 border rounded-lg bg-white shadow-sm" placeholder="Nome Completo"/>
                                          <input type="text" value={newStudentPhone} onChange={(e) => setNewStudentPhone(e.target.value)} className="w-full p-3 border rounded-lg bg-white shadow-sm" placeholder="WhatsApp"/>
                                      </div>
                                  </div>
                                  <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
                                      <h4 className="font-bold text-gray-700 text-sm uppercase border-b pb-2 mb-2 flex items-center gap-2">
                                          <FileText className="w-4 h-4"/> Dados Cadastrais (Editável)
                                      </h4>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                          <input type="text" placeholder="CPF" value={extraData.cpf} onChange={e => setExtraData({...extraData, cpf: e.target.value})} className="w-full p-3 border rounded-lg text-sm"/>
                                          <input type="text" placeholder="RG" value={extraData.rg} onChange={e => setExtraData({...extraData, rg: e.target.value})} className="w-full p-3 border rounded-lg text-sm"/>
                                          <input type="date" value={extraData.birthDate} onChange={e => setExtraData({...extraData, birthDate: e.target.value})} className="w-full p-3 border rounded-lg text-sm"/>
                                          <input type="text" placeholder="Profissão" value={extraData.profession} onChange={e => setExtraData({...extraData, profession: e.target.value})} className="w-full p-3 border rounded-lg text-sm"/>
                                          <input type="text" placeholder="Endereço Completo" value={extraData.address} onChange={e => setExtraData({...extraData, address: e.target.value})} className="w-full p-3 border rounded-lg text-sm md:col-span-2"/>
                                          <input type="text" placeholder="Email" value={extraData.email} onChange={e => setExtraData({...extraData, email: e.target.value})} className="w-full p-3 border rounded-lg text-sm md:col-span-2"/>
                                      </div>
                                      {editingStudentId && (
                                          <button onClick={handleSaveDataOnly} className="w-full py-3 bg-blue-50 text-blue-600 font-bold rounded-lg hover:bg-blue-100 flex items-center justify-center gap-2 border border-blue-200 mt-4 transition-colors">
                                              <Save className="w-4 h-4"/> Salvar Alterações nos Dados
                                          </button>
                                      )}
                                  </div>
                                  <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
                                      <h4 className="font-bold text-gray-700 text-sm uppercase border-b pb-2 mb-2 flex items-center gap-2">
                                          <Settings className="w-4 h-4"/> Configuração do Contrato
                                      </h4>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                          <div className="space-y-1">
                                              <label className="text-xs font-bold text-gray-400 uppercase">Fluxo de Onboarding</label>
                                              <select value={selectedPlanForStudent} onChange={(e) => setSelectedPlanForStudent(e.target.value)} className="w-full p-3 border rounded-lg bg-white">
                                                  <option value="">Selecione o Fluxo...</option>
                                                  {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                              </select>
                                          </div>
                                          <div className="space-y-1">
                                              <label className="text-xs font-bold text-gray-400 uppercase">Modelo de Contrato</label>
                                              <select value={selectedTemplateId} onChange={(e) => {setSelectedTemplateId(e.target.value); setAdminFieldValues({});}} className="w-full p-3 border rounded-lg bg-white font-bold text-blue-800">
                                                  <option value="">Selecione o Modelo...</option>
                                                  {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                              </select>
                                          </div>
                                      </div>
                                      {selectedTemplateId && (
                                          <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 animate-in fade-in mt-4">
                                              <h4 className="text-xs font-bold text-yellow-700 uppercase mb-3">Variáveis de Negociação (Valores, Datas, etc)</h4>
                                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                  {templates.find(t => t.id === selectedTemplateId)?.fields?.filter(f => f.owner === 'admin').map((field, idx) => (
                                                      <div key={idx}>
                                                          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">{field.label}</label>
                                                          <input type={field.type === 'date' ? 'date' : 'text'} value={adminFieldValues[field.key] || ''} onChange={(e) => setAdminFieldValues({...adminFieldValues, [field.key]: e.target.value})} className="w-full p-2 border border-yellow-300 rounded bg-white text-sm font-medium"/>
                                                      </div>
                                                  ))}
                                              </div>
                                          </div>
                                      )}
                                  </div>
                              </div>
                          </div>
                      )}
                      {approvalStep === 2 && (
                          <div className="w-full h-full bg-gray-200 flex justify-center overflow-hidden">
                               <RichTextEditor isA4={true} value={draftContract} onChange={setDraftContract} />
                          </div>
                      )}
                    </div>
                    <div className="bg-white border-t border-gray-300 p-4 flex justify-end gap-3 z-50">
                      <button onClick={() => setIsInviting(false)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg font-bold transition-colors text-xs mr-auto">Cancelar</button>
                      {approvalStep === 1 ? (
                          <button onClick={handleGenerateDraft} className="px-8 py-3 bg-black text-white rounded-lg font-bold hover:bg-gray-800 shadow-lg flex items-center gap-2">
                              Próximo: Revisar Minuta <ChevronRight className="w-4 h-4"/>
                          </button>
                      ) : (
                          <>
                              <button onClick={() => setApprovalStep(1)} className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-bold hover:bg-gray-50">Voltar e Editar Dados</button>
                              <button onClick={handleFinalizeInvite} className="px-8 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 shadow-lg flex items-center gap-2">
                                  <CheckCircle className="w-4 h-4"/> Aprovar e Enviar Link
                              </button>
                          </>
                      )}
                    </div>
                  </div>
                </div>
              )}
  
              {/* TABELA DE ALUNOS (MANTIDA) */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {filteredStudents.length === 0 ? (
                  <div className="p-12 text-center text-gray-500">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-20"/>
                    <p>Nenhum aluno encontrado com estes filtros.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="p-4 text-xs font-bold text-gray-500 uppercase">Data Entrada</th>
                          <th className="p-4 text-xs font-bold text-gray-500 uppercase">Aluno</th>
                          <th className="p-4 text-xs font-bold text-gray-500 uppercase">Status</th>
                          <th className="p-4 text-xs font-bold text-gray-500 uppercase text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredStudents.map((student) => (
                          <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                            <td className="p-4 text-xs text-gray-500 font-mono">
                               {student.createdAt ? new Date(student.createdAt).toLocaleDateString('pt-BR') : '-'}
                            </td>
                            <td className="p-4">
                              <div className="font-bold text-gray-900">{student.name}</div>
                              <div className="text-xs text-gray-400">{student.phone}</div>
                            </td>
                            <td className="p-4">
                              {student.status === 'signed' ? (
                                  <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 py-1 px-2 rounded-full text-xs font-bold border border-green-200">
                                      <CheckCircle className="w-3 h-3"/> Assinado
                                  </span>
                              ) : student.status === 'em_analise' ? (
                                  <button onClick={() => openApproveModal(student)} className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 py-1 px-3 rounded-full text-xs font-bold border border-blue-200 hover:bg-blue-200 hover:scale-105 transition-all animate-pulse">
                                      <FileSignature className="w-3 h-3"/> Analisar Cadastro
                                  </button>
                              ) : (
                                  <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-700 py-1 px-2 rounded-full text-xs font-bold border border-yellow-200">
                                      <Loader className="w-3 h-3"/> Aguardando Assinatura
                                  </span>
                              )}
                            </td>
                            <td className="p-4 text-right flex justify-end gap-2 items-center">
                                
                                {/* Botão Entregue (Verde) */}
                                <button 
                                  onClick={() => onToggleDelivery(student)}
                                  className={`group flex items-center gap-1 px-3 py-1.5 rounded-lg border transition-all ${
                                      student.materialDelivered 
                                      ? 'bg-green-600 border-green-600 text-white shadow-md'
                                      : 'bg-white border-gray-300 text-gray-400 hover:border-green-400 hover:text-green-600'
                                  }`}
                                  title={student.materialDelivered ? "Material já entregue" : "Marcar como entregue"}
                                >
                                    {student.materialDelivered ? <CheckCircle className="w-4 h-4 fill-current" /> : <CheckCircle className="w-4 h-4" />}
                                    <span className="text-[10px] font-bold uppercase hidden xl:inline">
                                        {student.materialDelivered ? "Entregue" : "Pendente"}
                                    </span>
                                </button>
  
                                <div className="w-px h-6 bg-gray-200 mx-1"></div>
  
                                <button onClick={() => openApproveModal(student)} className="p-2 border border-gray-200 rounded-lg text-blue-600 hover:bg-blue-50" title="Editar">
                                  <Edit className="w-4 h-4" />
                                </button>
  
                                {student.status === 'signed' && (
                                    <button onClick={() => generateContractPDF(student)} className="p-2 border border-gray-200 rounded-lg text-green-600 hover:bg-green-50 hover:border-green-200" title="PDF">
                                        <FileSignature className="w-4 h-4" />
                                    </button>
                                )}
                                
                                <button onClick={() => copyStudentLink(student.id)} className="p-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-blue-50" title="Link">
                                    <Share2 className="w-4 h-4" />
                                </button>
                                
                                <button onClick={() => {if(confirm('Remover?')) onDeleteStudent(student.id)}} className="p-2 border border-gray-200 rounded-lg text-gray-400 hover:bg-red-50">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </td>
                          </tr>
                        ))}                    
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
          {activeTab === 'templates' && (
            <div className="animate-in fade-in duration-300">
              {!isEditingTemplate ? (
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-gray-800">Meus Modelos de Contrato</h2>
                    <button onClick={() => { setCurrentTemplate({ id: '', name: '', content: '', fields: [] }); setIsEditingTemplate(true); }} className="bg-black text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-gray-800 shadow-lg"><Plus className="w-5 h-5" /> Novo Modelo</button>
                  </div>
                  <div className="grid md:grid-cols-3 gap-4">
                    {templates.map(t => (
                      <div key={t.id} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all">
                        <h3 className="font-bold text-lg mb-2">{t.name}</h3>
                        <p className="text-xs text-gray-400 mb-4">ID: {t.id}</p>
                        <p className="text-sm text-gray-600 mb-4">{t.fields?.length || 0} variáveis configuradas.</p>
                        <button onClick={() => { setCurrentTemplate(t); setIsEditingTemplate(true); }} className="w-full py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-bold hover:bg-blue-100">Editar</button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow-xl border border-gray-200 flex flex-col h-[85vh]">
                  <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-xl">
                    <div className="flex items-center gap-4 flex-1">
                      <button onClick={() => setIsEditingTemplate(false)}><ArrowLeft className="w-5 h-5 text-gray-500"/></button>
                      <input type="text" placeholder="Nome do Modelo" value={currentTemplate.name} onChange={e => setCurrentTemplate({...currentTemplate, name: e.target.value})} className="bg-transparent font-bold text-lg outline-none w-full"/>
                    </div>
                    <button onClick={handleSaveTemplate} className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-green-700 flex items-center gap-2"><Save className="w-4 h-4"/> Salvar Modelo</button>
                  </div>
                  <div className="flex-1 overflow-hidden h-full flex flex-col md:flex-row">
                    <div className="w-full md:w-2/3 p-6 overflow-y-auto border-r border-gray-200">
                      <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Texto do Contrato</label>
                      <RichTextEditor isA4={true} value={currentTemplate.content} onChange={(html) => setCurrentTemplate({...currentTemplate, content: html})} />                  </div>
                    <div className="w-full md:w-1/3 p-6 bg-gray-50 overflow-y-auto">
                      <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Settings className="w-4 h-4"/> Variáveis</h3>
                      {/* --- BLOCO NOVO: A COLA DE VARIÁVEIS AUTOMÁTICAS --- */}
                      <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 mb-6 shadow-sm">
                        <h4 className="text-xs font-bold text-blue-800 uppercase mb-2 flex items-center gap-2">
                          <CheckCircle className="w-3 h-3"/> Automáticas (Já inclusas)
                        </h4>
                        <p className="text-[10px] text-blue-600 mb-3 leading-tight">
                          O sistema preenche estes dados sozinho com base no cadastro do aluno. Use exatamente assim:
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {['{{nome}}', '{{cpf}}', '{{rg}}', '{{endereco}}', '{{email}}', '{{telefone}}', '{{profissao}}', '{{nascimento}}'].map(tag => (
                            <div 
                              key={tag} 
                              className="bg-white border border-blue-100 rounded px-2 py-1 text-[10px] font-mono text-blue-700 font-bold text-center cursor-pointer hover:bg-blue-100 transition-colors" 
                              onClick={() => {navigator.clipboard.writeText(tag); alert(`Copiado: ${tag}`)}}
                              title="Clique para copiar"
                            >
                              {tag}
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* --------------------------------------------------- */}
                      <div className="bg-white p-4 rounded-xl border border-gray-200 mb-6 shadow-sm">
                        <h4 className="text-xs font-bold text-blue-600 uppercase mb-3">Nova Variável</h4>
                        <div className="space-y-3">
                          <div><label className="text-[10px] font-bold text-gray-400 uppercase">Chave</label><div className="flex items-center gap-1"><span className="text-gray-400 font-mono text-sm">{`{{`}</span><input type="text" value={newField.key} onChange={e => setNewField({...newField, key: e.target.value.replace(/[^a-z0-9_]/g, '')})} className="flex-1 p-1 border-b border-gray-300 outline-none font-mono text-sm bg-transparent"/><span className="text-gray-400 font-mono text-sm">{`}}`}</span></div></div>
                          <div><label className="text-[10px] font-bold text-gray-400 uppercase">Nome (Label)</label><input type="text" value={newField.label} onChange={e => setNewField({...newField, label: e.target.value})} className="w-full p-2 border border-gray-200 rounded text-sm"/></div>
                          <div className="grid grid-cols-2 gap-2">
                            <div><label className="text-[10px] font-bold text-gray-400 uppercase">Quem?</label><select value={newField.owner} onChange={e => setNewField({...newField, owner: e.target.value})} className="w-full p-2 border border-gray-200 rounded text-sm bg-white"><option value="student">Aluno</option><option value="admin">Eu (Admin)</option></select></div>
                            <div><label className="text-[10px] font-bold text-gray-400 uppercase">Tipo</label><select value={newField.type} onChange={e => setNewField({...newField, type: e.target.value})} className="w-full p-2 border border-gray-200 rounded text-sm bg-white"><option value="text">Texto</option><option value="number">Número</option><option value="money">Dinheiro</option><option value="date">Data</option></select></div>
                          </div>
                          <button onClick={addFieldToTemplate} className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 mt-2">Adicionar</button>
                        </div>
                      </div>
                      <div className="space-y-2">{currentTemplate.fields && currentTemplate.fields.map((field, idx) => (<div key={idx} className="bg-white p-3 rounded-lg border border-gray-200 flex justify-between items-center"><div><div className="font-mono text-xs font-bold text-blue-600 bg-blue-50 inline-block px-1 rounded mb-1">{`{{${field.key}}}`}</div><div className="text-xs text-gray-500">{field.label}</div></div><button onClick={() => removeFieldFromTemplate(idx)} className="text-gray-300 hover:text-red-500"><Trash2 className="w-4 h-4"/></button></div>))}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
  
        </div>
      </div>
    );
  };

  export default Dashboard;