import { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send } from 'lucide-react';
import { api } from '../lib/api';
import { User } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface Message {
  role: 'user' | 'bot' | 'system';
  text: string;
}

export default function Chatbot({ user }: { user: User }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'bot',
      text: `Hi ${user.name}! I'm your Smart Explorer AI. I can generate timetables, manage subjects, or answer scheduling questions.`,
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async (text?: string) => {
    const messageText = text || input;
    if (!messageText.trim()) return;

    setMessages((prev) => [...prev, { role: 'user', text: messageText }]);
    setInput('');
    setIsTyping(true);

    try {
      const response = await api.chat(messageText);
      const responseText = response?.text || "I'm not sure how to respond.";

      // Execution Layer
      if (responseText.includes('[ACTION_GENERATE]')) {
        if (user.role === 'admin') {
          await api.generateTimetable();
          setMessages((prev) => [
            ...prev,
            {
              role: 'bot',
              text: "Success! I've run the Genetic Algorithm and generated a new optimized timetable for you.",
            },
          ]);

          // Notify other components to refresh
          window.dispatchEvent(new CustomEvent('refresh-timetables'));
        } else {
          setMessages((prev) => [
            ...prev,
            {
              role: 'bot',
              text: "I'm sorry, but only administrators can trigger timetable generation.",
            },
          ]);
        }
        return;
      }

      setMessages((prev) => [...prev, { role: 'bot', text: responseText }]);
    } catch (err: any) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          role: 'bot',
          text: err?.message || 'I encountered an error while processing your request.',
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="w-full max-w-[320px] h-[480px] bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden mb-4"
          >
            {/* Header */}
            <div className="p-4 bg-white border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest">AI Assistant</h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            {/* Messages */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 scroll-smooth"
            >
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex flex-col max-w-[85%] text-[11px]',
                    m.role === 'user' ? 'ml-auto items-end' : 'items-start'
                  )}
                >
                  <div
                    className={cn(
                      'p-3 rounded-2xl shadow-sm leading-relaxed',
                      m.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-tr-none'
                        : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none'
                    )}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex items-center gap-1 p-2 bg-white border border-slate-200 rounded-full w-fit">
                  <div className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <div className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <div className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce" />
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-3 bg-white border-t border-slate-100">
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Ask about constraints..."
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                />
                <button
                  onClick={() => handleSend()}
                  className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-12 h-12 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-xl hover:scale-110 transition-all group relative overflow-hidden"
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
      </button>
    </div>
  );
}
