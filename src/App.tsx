/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  BookOpen,
  MessageSquare,
  Calendar,
  Search,
  Quote as QuoteIcon,
  CheckCircle2,
  Circle,
  Send,
  User,
  Bot,
  ChevronRight,
  Library,
  Scale,
  Heart,
  ExternalLink,
  Loader2,
  FileEdit,
  Trash2,
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { chatWithGemini, researchTopic } from './services/gemini';
import { getTasks, saveTasks } from './services/tasks';
import { saveResearch } from './services/save-research';
import { deleteDocument, getDocumentPreview, getDocuments, searchDocuments, type DocumentSearchResult, type SavedDocument } from './services/documents';
import { getNotes, createNote, updateNote, deleteNote, type Note } from './services/notes';
import { STUDY_TOPICS, DAILY_QUOTES, StudyTask } from './constants';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'chat' | 'research' | 'schedule' | 'documents' | 'notes'>('home');
  const [quote, setQuote] = useState(DAILY_QUOTES[0]);
  const [tasks, setTasks] = useState<StudyTask[]>([]);

  useEffect(() => {
    const loadTasks = async () => {
      const loadedTasks = await getTasks();
      setTasks(loadedTasks);
    };
    loadTasks();
  }, []);

  useEffect(() => {
    const randomQuote = DAILY_QUOTES[Math.floor(Math.random() * DAILY_QUOTES.length)];
    setQuote(randomQuote);
  }, []);

  const toggleTask = async (id: string) => {
    const newTasks = tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
    setTasks(newTasks);
    try {
      await saveTasks(newTasks);
    } catch (error) {
      console.error('Failed to save tasks:', error);
      // Optionally revert on error
    }
  };

  return (
    <div className="flex h-screen bg-brand-bg overflow-hidden">
      {/* Sidebar */}
      <nav className="w-20 md:w-64 bg-brand-paper border-r border-stone-200 flex flex-col">
        <div className="p-6 flex items-center gap-3">
          <img src="/centauro.gif" alt="Sistema Centauro" className="w-10 h-10 rounded-full" />
          <h1 className="hidden md:block text-xl font-serif font-bold text-brand-primary">Sistema Centauro</h1>
        </div>

        <div className="flex-1 px-3 space-y-2 mt-4">
          <NavItem 
            active={activeTab === 'home'} 
            onClick={() => setActiveTab('home')} 
            icon={<BookOpen size={20} />} 
            label="Início" 
          />
          <NavItem 
            active={activeTab === 'chat'} 
            onClick={() => setActiveTab('chat')} 
            icon={<MessageSquare size={20} />} 
            label="Agente IA" 
          />
          <NavItem 
            active={activeTab === 'research'} 
            onClick={() => setActiveTab('research')} 
            icon={<Search size={20} />} 
            label="Pesquisa" 
          />
          <NavItem 
            active={activeTab === 'schedule'} 
            onClick={() => setActiveTab('schedule')} 
            icon={<Calendar size={20} />} 
            label="Cronograma" 
          />
          <NavItem
            active={activeTab === 'documents'}
            onClick={() => setActiveTab('documents')}
            icon={<Library size={20} />}
            label="Documentos"
          />
          <NavItem
            active={activeTab === 'notes'}
            onClick={() => setActiveTab('notes')}
            icon={<FileEdit size={20} />}
            label="Notas"
          />
        </div>

        <div className="p-4 border-t border-stone-100">
          <div className="flex items-center gap-3 p-2 rounded-xl bg-stone-50">
            <div className="w-8 h-8 rounded-full bg-stone-200 flex items-center justify-center text-stone-600 font-bold">
              F
            </div>
            <div className="hidden md:block overflow-hidden">
              <p className="text-sm font-medium truncate">Flavia</p>
              <p className="text-xs text-stone-500 truncate">Assistente Social</p>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative">
        <div className="max-w-5xl mx-auto p-6 md:p-10">
          <AnimatePresence mode="wait">
            {activeTab === 'home' && (
              <motion.div
                key="home"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <header>
                  <h2 className="text-4xl font-serif font-bold text-stone-900 mb-2">Olá, Flavia.</h2>
                  <p className="text-stone-500 italic">"Onde quer que haja um direito violado, há um espaço para o Serviço Social."</p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Daily Quote Card */}
                  <div className="md:col-span-2 p-8 rounded-3xl bg-brand-primary text-white shadow-xl relative overflow-hidden">
                    <QuoteIcon className="absolute top-4 right-4 opacity-20" size={60} />
                    <div className="relative z-10">
                      <p className="text-2xl font-serif italic mb-6 leading-relaxed">
                        "{quote.text}"
                      </p>
                      <p className="text-sm uppercase tracking-widest opacity-80">— {quote.author}</p>
                    </div>
                  </div>

                  {/* Quick Stats/Reminder */}
                  <div className="p-6 rounded-3xl bg-white border border-stone-200 shadow-sm flex flex-col justify-between">
                    <div>
                      <h3 className="text-lg font-serif font-bold mb-4">Lembrete Ético</h3>
                      <p className="text-sm text-stone-600 leading-relaxed">
                        Lembre-se do compromisso com a autonomia, emancipação e plena expansão dos indivíduos sociais.
                      </p>
                    </div>
                    <div className="mt-6 pt-6 border-t border-stone-50">
                      <button 
                        onClick={() => setActiveTab('chat')}
                        className="w-full py-3 bg-stone-900 text-white rounded-xl text-sm font-medium hover:bg-stone-800 transition-colors flex items-center justify-center gap-2"
                      >
                        Falar com a IA <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Topics Grid */}
                  <section>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-serif font-bold">Temas de Estudo</h3>
                      <button className="text-sm text-brand-primary font-medium">Ver todos</button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {STUDY_TOPICS.slice(0, 6).map((topic) => (
                        <button 
                          key={topic}
                          className="p-4 rounded-2xl bg-white border border-stone-100 hover:border-brand-primary/30 hover:shadow-md transition-all text-left group"
                        >
                          <p className="text-sm font-medium text-stone-700 group-hover:text-brand-primary">{topic}</p>
                        </button>
                      ))}
                    </div>
                  </section>

                  {/* Mini Schedule */}
                  <section>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-serif font-bold">Próximas Metas</h3>
                      <button onClick={() => setActiveTab('schedule')} className="text-sm text-brand-primary font-medium">Cronograma</button>
                    </div>
                    <div className="space-y-3">
                      {tasks.slice(0, 3).map((task) => (
                        <div 
                          key={task.id}
                          className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-stone-100"
                        >
                          <button onClick={() => toggleTask(task.id)}>
                            {task.completed ? (
                              <CheckCircle2 className="text-emerald-500" size={22} />
                            ) : (
                              <Circle className="text-stone-300" size={22} />
                            )}
                          </button>
                          <div className={cn("flex-1", task.completed && "opacity-50 line-through")}>
                            <p className="text-sm font-medium">{task.title}</p>
                            <p className="text-xs text-stone-500">{task.topic}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              </motion.div>
            )}

            {activeTab === 'chat' && <AIChatView />}
            {activeTab === 'research' && <ResearchView />}
            {activeTab === 'schedule' && <ScheduleView tasks={tasks} setTasks={setTasks} toggleTask={toggleTask} />}
            {activeTab === 'documents' && <DocumentsView />}
            {activeTab === 'notes' && <NotesView />}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function NavItem({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 p-3 rounded-xl transition-all",
        active 
          ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20" 
          : "text-stone-500 hover:bg-stone-100 hover:text-stone-900"
      )}
    >
      <span className="flex-shrink-0">{icon}</span>
      <span className="hidden md:block font-medium text-sm">{label}</span>
    </button>
  );
}

function AIChatView() {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; text: string }[]>([
    { role: 'assistant', text: 'Olá Flavia! Sou seu assistente especializado em Serviço Social. Em que posso te ajudar hoje? Posso responder de forma objetiva sobre legislação, ética, políticas públicas ou um caso específico.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsLoading(true);

    try {
      const history = messages.slice(-8).map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));
      
      setMessages(prev => [...prev, { role: 'assistant', text: '' }]);

      const response = await chatWithGemini(userMsg, history, {
        onToken: (chunk) => {
          setMessages(prev => {
            const next = [...prev];
            const lastIndex = next.length - 1;
            if (lastIndex >= 0 && next[lastIndex]?.role === 'assistant') {
              next[lastIndex] = {
                ...next[lastIndex],
                text: `${next[lastIndex].text}${chunk}`,
              };
            }
            return next;
          });
        },
      });

      setMessages(prev => {
        const next = [...prev];
        const lastIndex = next.length - 1;
        if (lastIndex >= 0 && next[lastIndex]?.role === 'assistant' && !next[lastIndex].text.trim()) {
          next[lastIndex] = {
            ...next[lastIndex],
            text: response.text || 'Desculpe, tive um problema ao processar sua resposta.',
          };
        }
        return next;
      });
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'assistant', text: 'Erro ao conectar com o assistente. Verifique sua conexão.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col h-[calc(100vh-120px)] bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden"
    >
      <div className="p-4 border-bottom bg-stone-50 flex items-center gap-3">
        <div className="w-8 h-8 bg-brand-primary rounded-full flex items-center justify-center text-white">
          <Bot size={18} />
        </div>
        <div>
          <h3 className="font-serif font-bold">Agente de Aprendizagem</h3>
          <p className="text-xs text-stone-500">Especialista em Serviço Social</p>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((msg, i) => (
          <div key={i} className={cn("flex gap-3", msg.role === 'user' ? "flex-row-reverse" : "flex-row")}>
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
              msg.role === 'user' ? "bg-stone-900 text-white" : "bg-brand-primary text-white"
            )}>
              {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
            </div>
            <div className={cn(
              "max-w-[80%] p-4 rounded-2xl text-sm leading-relaxed",
              msg.role === 'user' 
                ? "bg-stone-100 text-stone-900 rounded-tr-none" 
                : "bg-brand-bg text-stone-800 border border-stone-100 rounded-tl-none"
            )}>
              <div className="markdown-body">
                {msg.role === 'assistant' && !msg.text.trim() && i === messages.length - 1 && isLoading ? (
                  <p className="text-sm text-stone-500 italic">Pensando...</p>
                ) : (
                  <Markdown>{msg.text}</Markdown>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-stone-100 bg-stone-50">
        <div className="flex gap-2">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Tire suas dúvidas sobre LOAS, ECA, Ética..." 
            className="flex-1 bg-white border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
          />
          <button 
            onClick={handleSend}
            disabled={isLoading}
            className="bg-brand-primary text-white p-3 rounded-xl hover:bg-brand-primary/90 transition-colors disabled:opacity-50"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function ResearchView() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<{ text: string; sources: any[] } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSearch = async () => {
    if (!query.trim() || isLoading) return;
    setIsLoading(true);
    try {
      const data = await researchTopic(query);
      setResult(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!result || isSaving) return;
    setIsSaving(true);
    try {
      await saveResearch(query, result.text);
      alert('Pesquisa armazenada com sucesso!');
    } catch (error) {
      console.error(error);
      alert('Erro ao armazenar pesquisa.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm">
        <h3 className="text-2xl font-serif font-bold mb-6">Pesquisa Especializada</h3>
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
            <input 
              type="text" 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Ex: Benefício de Prestação Continuada requisitos 2024" 
              className="w-full bg-stone-50 border border-stone-200 rounded-2xl pl-12 pr-4 py-4 focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            />
          </div>
          <button 
            onClick={handleSearch}
            disabled={isLoading}
            className="bg-stone-900 text-white px-8 rounded-2xl font-medium hover:bg-stone-800 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
            <span>Pesquisar</span>
          </button>
        </div>
      </div>

      {result && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-6 text-brand-primary">
            <Library size={24} />
            <h4 className="text-xl font-serif font-bold">Resultado da Pesquisa</h4>
          </div>
          <div className="markdown-body mb-8">
            <Markdown>{result.text}</Markdown>
          </div>
          
          {result.sources.length > 0 && (
            <div className="pt-6 border-t border-stone-100">
              <h5 className="text-sm font-bold text-stone-500 uppercase tracking-widest mb-4">Fontes e Referências</h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {result.sources.map((source, i) => (
                  <a 
                    key={i} 
                    href={source.web?.uri} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-100 hover:border-brand-primary/20 transition-colors group"
                  >
                    <span className="text-sm font-medium text-stone-700 truncate">{source.web?.title || 'Referência Externa'}</span>
                    <ExternalLink size={14} className="text-stone-400 group-hover:text-brand-primary" />
                  </a>
                ))}
              </div>
            </div>
          )}
          <div className="pt-6 border-t border-stone-100 flex justify-end">
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="bg-brand-primary text-white px-6 py-3 rounded-xl font-medium hover:bg-brand-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Library size={16} />}
              <span>Armazenar Pesquisa</span>
            </button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

function ScheduleView({ tasks, setTasks, toggleTask }: { tasks: StudyTask[]; setTasks: any; toggleTask: any }) {
  const [newTask, setNewTask] = useState('');
  const [selectedTopic, setSelectedTopic] = useState(STUDY_TOPICS[0]);

  const addTask = async () => {
    if (!newTask.trim()) return;
    const task: StudyTask = {
      id: Date.now().toString(),
      title: newTask,
      topic: selectedTopic,
      date: new Date().toISOString().split('T')[0],
      completed: false
    };
    const newTasks = [task, ...tasks];
    setTasks(newTasks);
    setNewTask('');
    try {
      await saveTasks(newTasks);
    } catch (error) {
      console.error('Failed to save tasks:', error);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8"
    >
      <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm">
        <h3 className="text-2xl font-serif font-bold mb-6">Programação de Estudos</h3>
        <div className="flex flex-col md:flex-row gap-4">
          <input 
            type="text" 
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            placeholder="O que vamos estudar hoje?" 
            className="flex-1 bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
          />
          <select 
            value={selectedTopic}
            onChange={(e) => setSelectedTopic(e.target.value)}
            className="bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 focus:outline-none"
          >
            {STUDY_TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <button 
            onClick={addTask}
            className="bg-brand-primary text-white px-6 py-3 rounded-xl font-medium hover:bg-brand-primary/90 transition-colors"
          >
            Adicionar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h4 className="font-serif font-bold text-lg flex items-center gap-2">
            <Calendar size={20} className="text-brand-primary" /> Pendentes
          </h4>
          {tasks.filter(t => !t.completed).map(task => (
            <div key={task.id} className="bg-white p-5 rounded-2xl border border-stone-100 shadow-sm flex items-center gap-4">
              <button onClick={() => toggleTask(task.id)}>
                <Circle className="text-stone-300" size={24} />
              </button>
              <div className="flex-1">
                <p className="font-medium">{task.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] uppercase tracking-wider bg-stone-100 px-2 py-0.5 rounded text-stone-500">{task.topic}</span>
                  <span className="text-[10px] text-stone-400">{task.date}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <h4 className="font-serif font-bold text-lg flex items-center gap-2">
            <CheckCircle2 size={20} className="text-emerald-500" /> Concluídos
          </h4>
          {tasks.filter(t => t.completed).map(task => (
            <div key={task.id} className="bg-white p-5 rounded-2xl border border-stone-100 shadow-sm flex items-center gap-4 opacity-60">
              <button onClick={() => toggleTask(task.id)}>
                <CheckCircle2 className="text-emerald-500" size={24} />
              </button>
              <div className="flex-1 line-through">
                <p className="font-medium">{task.title}</p>
                <p className="text-xs text-stone-400">{task.topic}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function DocumentsView() {
  const [documents, setDocuments] = useState<SavedDocument[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DocumentSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<SavedDocument | null>(null);
  const [preview, setPreview] = useState<{ previewText: string; hasContent: boolean } | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'pdf' | 'research' | 'other'>('all');

  useEffect(() => {
    const loadDocuments = async () => {
      const docs = await getDocuments();
      setDocuments(docs);
    };
    loadDocuments();
  }, []);

  const handleSearch = async (searchTerm: string = query) => {
    const term = searchTerm.trim();
    if (!term || isSearching) return;
    setIsSearching(true);
    try {
      const data = await searchDocuments(term);
      setResults(data.results || []);
      setHasSearched(true);
    } catch (error) {
      console.error('Document search error:', error);
      setResults([]);
      setHasSearched(true);
    } finally {
      setIsSearching(false);
    }
  };

  const loadPreview = async (doc: SavedDocument) => {
    setSelectedDoc(doc);
    setPreview(null);
    setIsPreviewLoading(true);
    try {
      const data = await getDocumentPreview(doc.id);
      setPreview({
        previewText: data.previewText || 'Sem conteúdo de pré-visualização disponível.',
        hasContent: !!data.hasContent,
      });
    } catch (error) {
      console.error('Failed to load document preview:', error);
      setPreview({
        previewText: 'Não foi possível carregar a pré-visualização deste documento.',
        hasContent: false,
      });
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleDeleteDocument = async (doc: SavedDocument) => {
    if (!confirm(`Excluir o documento "${doc.filename}"?`)) return;
    setIsDeleting(true);
    try {
      await deleteDocument(doc.id);
      const refreshed = await getDocuments();
      setDocuments(refreshed);
      if (selectedDoc?.id === doc.id) {
        setSelectedDoc(null);
        setPreview(null);
      }
    } catch (error) {
      console.error('Failed to delete document:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredDocuments = documents.filter((doc) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'research') return doc.file_path === 'research';
    if (activeFilter === 'pdf') return doc.mime_type?.includes('pdf') || doc.filename.toLowerCase().endsWith('.pdf');
    return doc.file_path !== 'research' && !(doc.mime_type?.includes('pdf') || doc.filename.toLowerCase().endsWith('.pdf'));
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm space-y-6">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-brand-primary font-semibold mb-2">Busca de fontes</p>
          <h3 className="text-2xl font-serif font-bold">Documentos, PDFs e sites</h3>
          <p className="text-stone-500 mt-2 max-w-2xl">
            Pesquise documentos reais. Esta seção retorna fontes clicáveis e a biblioteca local, não uma resposta em formato de chat.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Buscar por lei, tema, órgão, PDF ou site..."
                className="w-full pl-11 pr-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
              />
            </div>
            <button
              onClick={() => handleSearch()}
              disabled={isSearching || !query.trim()}
              className="bg-brand-primary text-white px-5 py-3 rounded-xl font-medium hover:bg-brand-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isSearching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              Buscar
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {['LOAS', 'ECA', 'Estatuto do Idoso', 'saúde mental', 'assistência social'].map((term) => (
              <button
                key={term}
                onClick={() => {
                  setQuery(term);
                  handleSearch(term);
                }}
                className="px-3 py-1.5 rounded-full bg-stone-100 text-stone-600 text-sm hover:bg-stone-200 transition-colors"
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      </div>

      {hasSearched && (
        <div className="grid gap-4">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-serif font-bold">Resultados da busca</h4>
            <p className="text-sm text-stone-500">{results.length} resultados</p>
          </div>

          {results.length === 0 ? (
            <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm text-center text-stone-500">
              Nenhum documento encontrado para essa busca.
            </div>
          ) : (
            results.map((doc) => {
              const body = (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={cn(
                          "px-2.5 py-1 rounded-full text-[11px] uppercase tracking-wider font-semibold",
                          doc.type === 'pdf' ? "bg-red-50 text-red-600" : doc.source === 'web' ? "bg-sky-50 text-sky-700" : "bg-emerald-50 text-emerald-700"
                        )}>
                          {doc.source === 'web' ? (doc.type === 'pdf' ? 'PDF da web' : 'Site') : 'Biblioteca local'}
                        </span>
                        <span className="text-xs text-stone-400">
                          {doc.source === 'web' ? 'Fonte externa' : 'Arquivo salvo'}
                        </span>
                      </div>
                      <h5 className="text-lg font-serif font-bold text-stone-900 truncate">{doc.title}</h5>
                      <p className="text-sm text-stone-500 mt-1 break-all">
                        {doc.url || doc.file_path || 'Documento local'}
                      </p>
                    </div>
                    {doc.url && <ExternalLink size={18} className="text-stone-400 flex-shrink-0 mt-1" />}
                  </div>

                  {doc.snippet && (
                    <p className="text-sm text-stone-600 mt-4 leading-relaxed">
                      {doc.snippet}
                    </p>
                  )}
                </>
              );

              return doc.url ? (
                <a
                  key={doc.id}
                  href={doc.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block bg-white p-6 rounded-3xl border border-stone-200 shadow-sm hover:border-brand-primary/20 hover:shadow-md transition-all"
                >
                  {body}
                </a>
              ) : (
                <div
                  key={doc.id}
                  className="block bg-white p-6 rounded-3xl border border-stone-200 shadow-sm"
                >
                  {body}
                </div>
              );
            })
          )}
        </div>
      )}

      <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h4 className="text-xl font-serif font-bold">Documentos salvos</h4>
            <p className="text-sm text-stone-500">{documents.length} itens persistidos no banco</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'all', label: 'Todos' },
              { key: 'research', label: 'Pesquisas' },
              { key: 'pdf', label: 'PDFs' },
              { key: 'other', label: 'Outros' },
            ].map((filter) => (
              <button
                key={filter.key}
                onClick={() => setActiveFilter(filter.key as typeof activeFilter)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-sm transition-colors",
                  activeFilter === filter.key
                    ? "bg-brand-primary text-white"
                    : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6">
          <div className="space-y-3">
            {filteredDocuments.map((doc) => {
              const isSelected = selectedDoc?.id === doc.id;
              const isResearch = doc.file_path === 'research';
              const isPdf = doc.mime_type?.includes('pdf') || doc.filename.toLowerCase().endsWith('.pdf');
              return (
                <button
                  key={doc.id}
                  onClick={() => loadPreview(doc)}
                  className={cn(
                    "w-full text-left p-4 rounded-2xl border transition-all",
                    isSelected
                      ? "bg-brand-primary text-white border-brand-primary shadow-lg shadow-brand-primary/20"
                      : "bg-stone-50 border-stone-100 hover:border-brand-primary/20"
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={cn(
                          "px-2.5 py-1 rounded-full text-[11px] uppercase tracking-wider font-semibold",
                          isResearch
                            ? (isSelected ? "bg-white/20 text-white" : "bg-emerald-50 text-emerald-700")
                            : isPdf
                              ? (isSelected ? "bg-white/20 text-white" : "bg-red-50 text-red-600")
                              : (isSelected ? "bg-white/20 text-white" : "bg-sky-50 text-sky-700")
                        )}>
                          {isResearch ? 'Pesquisa salva' : isPdf ? 'PDF' : 'Documento'}
                        </span>
                        <span className={cn("text-xs", isSelected ? "text-white/80" : "text-stone-400")}>
                          {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString('pt-BR') : 'Sem data'}
                        </span>
                      </div>
                      <p className={cn("font-medium truncate", isSelected ? "text-white" : "text-stone-900")}>
                        {doc.filename}
                      </p>
                      <p className={cn("text-sm mt-1", isSelected ? "text-white/80" : "text-stone-500")}>
                        {doc.file_path || 'Arquivo salvo'}
                      </p>
                    </div>
                    <ExternalLink size={16} className={cn("flex-shrink-0 mt-1", isSelected ? "text-white/80" : "text-stone-400")} />
                  </div>
                </button>
              );
            })}
            {filteredDocuments.length === 0 && (
              <p className="text-stone-500 text-center py-8">Nenhum documento salvo corresponde a este filtro.</p>
            )}
          </div>

          <div className="bg-stone-50 rounded-3xl border border-stone-100 p-6 min-h-[260px]">
            {selectedDoc ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-brand-primary font-semibold mb-2">Pré-visualização</p>
                    <h5 className="text-xl font-serif font-bold">{selectedDoc.filename}</h5>
                    <p className="text-sm text-stone-500 mt-1">
                      {selectedDoc.uploaded_at ? new Date(selectedDoc.uploaded_at).toLocaleDateString('pt-BR') : 'Sem data'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteDocument(selectedDoc)}
                    disabled={isDeleting}
                    className="p-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
                    title="Excluir documento"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {selectedDoc.file_path && selectedDoc.file_path !== 'research' && (
                    <a
                      href={`/api/documents/${selectedDoc.id}/download`}
                      className="px-3 py-1.5 rounded-full bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary/90 transition-colors"
                    >
                      Baixar arquivo
                    </a>
                  )}
                  {selectedDoc.file_path === 'research' && (
                    <a
                      href={`/api/documents/${selectedDoc.id}/download`}
                      className="px-3 py-1.5 rounded-full bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 transition-colors"
                    >
                      Baixar pesquisa
                    </a>
                  )}
                </div>

                <div className="bg-white rounded-2xl border border-stone-200 p-4">
                  {isPreviewLoading ? (
                    <div className="flex items-center gap-2 text-stone-500">
                      <Loader2 size={16} className="animate-spin" />
                      Carregando pré-visualização...
                    </div>
                  ) : preview ? (
                    <p className="text-sm text-stone-700 whitespace-pre-wrap leading-relaxed">
                      {preview.previewText}
                    </p>
                  ) : (
                    <p className="text-sm text-stone-500">Selecione um documento para ver a pré-visualização.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full min-h-[260px] flex flex-col items-center justify-center text-stone-400 text-center">
                <FileEdit size={48} className="mb-4 opacity-50" />
                <p className="text-lg">Selecione um documento salvo</p>
                <p className="text-sm mt-2 max-w-sm">
                  Aqui você vê o conteúdo ou um resumo extraído do documento salvo, além de poder excluí-lo.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function NotesView() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadNotes();
  }, []);

  const loadNotes = async () => {
    try {
      const loadedNotes = await getNotes();
      setNotes(loadedNotes);
    } catch (error) {
      console.error('Failed to load notes:', error);
    }
  };

  const handleNewNote = () => {
    setSelectedNote(null);
    setTitle('');
    setContent('');
    setIsEditing(true);
  };

  const handleSelectNote = (note: Note) => {
    setSelectedNote(note);
    setTitle(note.title);
    setContent(note.content);
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) return;
    setIsLoading(true);
    try {
      if (selectedNote) {
        await updateNote(selectedNote.id, title, content);
      } else {
        await createNote(title, content);
      }
      await loadNotes();
      setIsEditing(false);
      setSelectedNote(null);
      setTitle('');
      setContent('');
    } catch (error) {
      console.error('Failed to save note:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta nota?')) return;
    try {
      await deleteNote(id);
      await loadNotes();
      setSelectedNote(null);
      setTitle('');
      setContent('');
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to delete note:', error);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    if (selectedNote) {
      setTitle(selectedNote.title);
      setContent(selectedNote.content);
    } else {
      setTitle('');
      setContent('');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-serif font-bold">Minhas Notas</h3>
        <button
          onClick={handleNewNote}
          className="bg-brand-primary text-white px-6 py-3 rounded-xl font-medium hover:bg-brand-primary/90 transition-colors flex items-center gap-2"
        >
          <Plus size={20} />
          <span>Nova Nota</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Notes List */}
        <div className="lg:col-span-1 space-y-3">
          <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm">
            <h4 className="font-serif font-bold mb-4">Todas as Notas</h4>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {notes.map((note) => (
                <button
                  key={note.id}
                  onClick={() => handleSelectNote(note)}
                  className={cn(
                    "w-full text-left p-4 rounded-xl border transition-colors",
                    selectedNote?.id === note.id
                      ? "bg-brand-primary text-white border-brand-primary"
                      : "bg-stone-50 border-stone-100 hover:border-brand-primary/20"
                  )}
                >
                  <p className={cn("font-medium truncate", selectedNote?.id === note.id ? "text-white" : "text-stone-800")}>
                    {note.title}
                  </p>
                  <p className={cn("text-xs mt-1", selectedNote?.id === note.id ? "text-white/80" : "text-stone-500")}>
                    {new Date(note.updated_at).toLocaleDateString('pt-BR')}
                  </p>
                </button>
              ))}
              {notes.length === 0 && (
                <p className="text-stone-500 text-center py-8">Nenhuma nota criada ainda.</p>
              )}
            </div>
          </div>
        </div>

        {/* Note Editor/Viewer */}
        <div className="lg:col-span-2">
          <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm">
            {isEditing ? (
              <>
                <div className="mb-4">
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Título da nota"
                    className="w-full text-xl font-serif font-bold border-none focus:outline-none focus:ring-0 placeholder:text-stone-400"
                  />
                </div>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Escreva suas anotações aqui..."
                  className="w-full h-[400px] resize-none border-none focus:outline-none focus:ring-0 text-stone-700 leading-relaxed placeholder:text-stone-400"
                />
                <div className="flex gap-3 mt-6 pt-6 border-t border-stone-100">
                  <button
                    onClick={handleSave}
                    disabled={isLoading || !title.trim() || !content.trim()}
                    className="bg-brand-primary text-white px-6 py-3 rounded-xl font-medium hover:bg-brand-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                    <span>Salvar</span>
                  </button>
                  <button
                    onClick={handleCancel}
                    className="bg-stone-100 text-stone-700 px-6 py-3 rounded-xl font-medium hover:bg-stone-200 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </>
            ) : selectedNote ? (
              <>
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h4 className="text-2xl font-serif font-bold">{selectedNote.title}</h4>
                    <p className="text-sm text-stone-500 mt-1">
                      Criada em {new Date(selectedNote.created_at).toLocaleDateString('pt-BR')}
                      {selectedNote.updated_at !== selectedNote.created_at && (
                        <span> • Atualizada em {new Date(selectedNote.updated_at).toLocaleDateString('pt-BR')}</span>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsEditing(true)}
                      className="bg-stone-100 text-stone-700 p-3 rounded-xl hover:bg-stone-200 transition-colors"
                    >
                      <FileEdit size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(selectedNote.id)}
                      className="bg-red-50 text-red-600 p-3 rounded-xl hover:bg-red-100 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                <div className="prose prose-stone max-w-none">
                  <p className="text-stone-700 leading-relaxed whitespace-pre-wrap">{selectedNote.content}</p>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-[400px] text-stone-400">
                <FileEdit size={48} className="mb-4 opacity-50" />
                <p className="text-lg">Selecione uma nota ou crie uma nova</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
