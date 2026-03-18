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
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { chatWithGemini, researchTopic } from './services/gemini';
import { getTasks, saveTasks } from './services/tasks';
import { saveResearch } from './services/save-research';
import { getDocuments } from './services/documents';
import { STUDY_TOPICS, DAILY_QUOTES, StudyTask } from './constants';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'chat' | 'research' | 'schedule' | 'documents'>('home');
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
          <div className="w-10 h-10 bg-brand-primary rounded-full flex items-center justify-center text-white">
            <Scale size={20} />
          </div>
          <h1 className="hidden md:block text-xl font-serif font-bold text-brand-primary">AS Pro</h1>
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
  const [messages, setMessages] = useState<{ role: 'user' | 'model'; text: string }[]>([
    { role: 'model', text: 'Olá Flavia! Sou seu assistente especializado em Serviço Social. Em que posso te ajudar hoje? Podemos discutir legislação, ética ou algum caso específico.' }
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
      const history = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));
      
      const response = await chatWithGemini(userMsg, history);
      setMessages(prev => [...prev, { role: 'model', text: response.text || 'Desculpe, tive um problema ao processar sua resposta.' }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'model', text: 'Erro ao conectar com o assistente. Verifique sua conexão.' }]);
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
                <Markdown>{msg.text}</Markdown>
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-brand-primary text-white flex items-center justify-center">
              <Loader2 size={16} className="animate-spin" />
            </div>
            <div className="bg-brand-bg p-4 rounded-2xl rounded-tl-none border border-stone-100">
              <p className="text-sm text-stone-500 italic">Pensando...</p>
            </div>
          </div>
        )}
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
import { getDocuments } from './services/documents';

function DocumentsView() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);

  useEffect(() => {
    const loadDocuments = async () => {
      const docs = await getDocuments();
      setDocuments(docs);
    };
    loadDocuments();
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm">
        <h3 className="text-2xl font-serif font-bold mb-6">Documentos Armazenados</h3>
        <div className="space-y-3">
          {documents.map((doc) => (
            <button
              key={doc.id}
              onClick={() => setSelectedDoc(doc)}
              className="w-full text-left p-4 rounded-xl bg-stone-50 border border-stone-100 hover:border-brand-primary/20 transition-colors"
            >
              <p className="font-medium">{doc.filename}</p>
              <p className="text-sm text-stone-500">{new Date(doc.uploaded_at).toLocaleDateString()}</p>
            </button>
          ))}
          {documents.length === 0 && (
            <p className="text-stone-500 text-center py-8">Nenhum documento armazenado ainda.</p>
          )}
        </div>
      </div>

      {selectedDoc && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm"
        >
          <h4 className="text-xl font-serif font-bold mb-4">{selectedDoc.filename}</h4>
          <p className="text-stone-600">Documento selecionado. (Conteúdo pode ser exibido aqui futuramente)</p>
        </motion.div>
      )}
    </motion.div>
  );
}