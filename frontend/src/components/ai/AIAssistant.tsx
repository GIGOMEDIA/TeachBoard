import { useState } from 'react';
import { useStore } from '../../store/useStore';
import { Brain, Send, RotateCcw, X, CheckCircle } from 'lucide-react';

export default function AIAssistant() {
  const {
    isAIPanelVisible,
    setAIPanelVisible,
    aiChatMessages,
    aiLoading,
    sendToAI,
    clearAIChat
  } = useStore();

  const [inputText, setInputText] = useState('');

  if (!isAIPanelVisible) return null;

  const handleSend = () => {
    if (!inputText.trim()) return;
    sendToAI('ask', inputText);
    setInputText('');
  };

  const handleShortcut = (action: string, promptText: string) => {
    sendToAI(action, promptText);
  };

  return (
    <div className="absolute right-0 top-0 bottom-0 w-80 bg-slate-900/98 backdrop-blur border-l border-white/10 flex flex-col z-[500] select-none shadow-2xl">
      {/* Header */}
      <div className="h-14 border-b border-white/5 flex items-center justify-between px-4">
        <div className="flex items-center gap-2 text-teal-400">
          <Brain size={20} />
          <span className="text-slate-200 text-sm font-bold">AI Teaching Helper</span>
        </div>
        <button
          onClick={() => setAIPanelVisible(false)}
          className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 transition-all"
        >
          <X size={18} />
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 scrollbar-thin">
        {aiChatMessages.map((msg, idx) => (
          <div
            key={idx}
            className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
              msg.sender === 'user'
                ? 'bg-primary text-white self-end rounded-tr-none'
                : 'bg-slate-800/80 border border-white/5 text-slate-200 self-start rounded-tl-none'
            }`}
          >
            {msg.type === 'quiz' && msg.quizData ? (
              <div className="flex flex-col gap-3">
                <span className="font-bold text-teal-400 border-b border-white/5 pb-1 flex items-center gap-1.5">
                  <CheckCircle size={14} /> Interactive Quiz
                </span>
                {msg.quizData.map((q: any, qIdx: number) => (
                  <div key={qIdx} className="flex flex-col gap-1.5">
                    <span className="font-semibold text-slate-100">Q{qIdx + 1}: {q.question}</span>
                    <div className="flex flex-col gap-1 mt-1">
                      {q.options.map((opt: string, oIdx: number) => (
                        <button
                          key={oIdx}
                          onClick={() => alert(`EXPLANATION:\n${q.explanation}`)}
                          className={`text-left text-[11px] p-2 rounded-lg border border-white/5 bg-black/20 hover:bg-teal-500/10 hover:border-teal-500/30 transition-all text-slate-300 ${
                            oIdx === q.correctIndex ? 'hover:bg-teal-500/10' : ''
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="whitespace-pre-wrap select-text markdown-content">
                {msg.text}
              </div>
            )}
          </div>
        ))}
        {aiLoading && (
          <div className="bg-slate-800/50 border border-white/5 rounded-2xl rounded-tl-none px-3 py-2 text-xs text-slate-400 self-start animate-pulse">
            AI Assistant is preparing answer...
          </div>
        )}
      </div>

      {/* Prompt Shortcuts */}
      <div className="px-3 py-2 border-t border-white/5 bg-black/10">
        <div className="flex gap-1.5 overflow-x-auto pb-1 text-[10px] font-semibold text-teal-400">
          <button
            onClick={() => handleShortcut('solve', '3x^2 + 5x - 2 = 0')}
            className="flex-shrink-0 px-2.5 py-1 bg-teal-500/10 border border-teal-500/20 rounded-md hover:bg-teal-500/20 transition-all"
          >
            Solve: 3x² + 5x - 2 = 0
          </button>
          <button
            onClick={() => handleShortcut('quiz', 'Quadratic Equations')}
            className="flex-shrink-0 px-2.5 py-1 bg-teal-500/10 border border-teal-500/20 rounded-md hover:bg-teal-500/20 transition-all"
          >
            Quiz: Quadratics
          </button>
          <button
            onClick={() => handleShortcut('explain', 'Sine Wave Properties')}
            className="flex-shrink-0 px-2.5 py-1 bg-teal-500/10 border border-teal-500/20 rounded-md hover:bg-teal-500/20 transition-all"
          >
            Explain: Sine waves
          </button>
          <button
            onClick={() => handleShortcut('practice', 'Statistics Mean and Median')}
            className="flex-shrink-0 px-2.5 py-1 bg-teal-500/10 border border-teal-500/20 rounded-md hover:bg-teal-500/20 transition-all"
          >
            Practice: Stats
          </button>
        </div>
      </div>

      {/* Input box */}
      <div className="p-3 border-t border-white/5 bg-slate-900/50 flex gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask AI to solve or explain..."
          className="flex-1 h-9 bg-black/40 border border-white/10 rounded-lg px-3 text-xs text-white outline-none focus:border-primary/50"
        />
        <button
          onClick={handleSend}
          className="w-9 h-9 bg-primary hover:bg-primary-light text-white rounded-lg flex items-center justify-center transition-all"
        >
          <Send size={14} />
        </button>
        <button
          onClick={clearAIChat}
          className="w-9 h-9 bg-slate-800 hover:bg-slate-700/80 border border-white/5 text-red-400 hover:text-red-300 rounded-lg flex items-center justify-center transition-all"
          title="Clear Conversation"
        >
          <RotateCcw size={14} />
        </button>
      </div>
    </div>
  );
}
