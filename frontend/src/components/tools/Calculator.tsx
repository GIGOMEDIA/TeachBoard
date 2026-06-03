import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { X, Minus, Maximize2, Pin, RotateCcw } from 'lucide-react';

export default function Calculator() {
  const {
    isCalcVisible,
    isCalcMinimized,
    isCalcPinned,
    calcPosition,
    setCalcVisible,
    setCalcMinimized,
    setCalcPinned,
    setCalcPosition
  } = useStore();

  const [calcInput, setCalcInput] = useState('');
  const [calcResult, setCalcResult] = useState('');
  const [mode, setMode] = useState<'basic' | 'scientific' | 'solver'>('basic');
  const [history, setHistory] = useState<string[]>([]);

  // Equation solver state
  const [coeffA, setCoeffA] = useState('1');
  const [coeffB, setCoeffB] = useState('-5');
  const [coeffC, setCoeffC] = useState('6');
  const [solverResult, setSolverResult] = useState('');

  if (!isCalcVisible) return null;

  // Custom DOM drag handler
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isCalcPinned) return;
    
    // Disable drag on input fields or buttons
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input')) return;

    const startX = e.clientX - calcPosition.x;
    const startY = e.clientY - calcPosition.y;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      setCalcPosition({
        x: Math.max(10, Math.min(window.innerWidth - 300, moveEvent.clientX - startX)),
        y: Math.max(60, Math.min(window.innerHeight - 400, moveEvent.clientY - startY))
      });
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handlePressButton = (char: string) => {
    if (char === 'C') {
      setCalcInput('');
      setCalcResult('');
    } else if (char === '=') {
      calculateResult();
    } else if (char === 'del') {
      setCalcInput((prev) => prev.slice(0, -1));
    } else {
      setCalcInput((prev) => prev + char);
    }
  };

  const calculateResult = () => {
    try {
      let expr = calcInput
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/π/g, 'Math.PI')
        .replace(/e/g, 'Math.E')
        .replace(/sin\(/g, 'Math.sin(')
        .replace(/cos\(/g, 'Math.cos(')
        .replace(/tan\(/g, 'Math.tan(')
        .replace(/ln\(/g, 'Math.log(')
        .replace(/log\(/g, 'Math.log10(')
        .replace(/√\(/g, 'Math.sqrt(');

      const openBrackets = (expr.match(/\(/g) || []).length;
      const closeBrackets = (expr.match(/\)/g) || []).length;
      if (openBrackets > closeBrackets) {
        expr += ')'.repeat(openBrackets - closeBrackets);
      }

      const evalFunc = new Function(`return ${expr}`);
      const res = evalFunc();
      const finalRes = Number.isInteger(res) ? res.toString() : parseFloat(res.toFixed(6)).toString();

      setCalcResult(finalRes);
      setHistory((prev) => [`${calcInput} = ${finalRes}`, ...prev.slice(0, 9)]);
    } catch (err) {
      setCalcResult('Error');
    }
  };

  const solveQuadratic = () => {
    const a = parseFloat(coeffA);
    const b = parseFloat(coeffB);
    const c = parseFloat(coeffC);

    if (isNaN(a) || isNaN(b) || isNaN(c)) {
      setSolverResult('Enter valid coefficients');
      return;
    }

    if (a === 0) {
      if (b === 0) {
        setSolverResult(c === 0 ? 'Infinite solutions' : 'No solution');
      } else {
        setSolverResult(`Linear Root:\nx = ${(-c / b).toFixed(4)}`);
      }
      return;
    }

    const disc = b * b - 4 * a * c;
    if (disc > 0) {
      const r1 = (-b + Math.sqrt(disc)) / (2 * a);
      const r2 = (-b - Math.sqrt(disc)) / (2 * a);
      setSolverResult(`Two Real Roots:\nx₁ = ${r1.toFixed(4)}\nx₂ = ${r2.toFixed(4)}\nDiscriminant = ${disc.toFixed(2)}`);
    } else if (disc === 0) {
      const r = -b / (2 * a);
      setSolverResult(`One Repeated Root:\nx = ${r.toFixed(4)}\nDiscriminant = 0`);
    } else {
      const real = -b / (2 * a);
      const imag = Math.sqrt(-disc) / (2 * a);
      setSolverResult(
        `Complex Roots:\nx₁ = ${real.toFixed(4)} + ${imag.toFixed(4)}i\nx₂ = ${real.toFixed(4)} - ${imag.toFixed(4)}i`
      );
    }
  };

  const renderKey = (label: string, className = "bg-slate-700/50 hover:bg-slate-700/80") => (
    <button
      key={label}
      onClick={() => handlePressButton(label)}
      className={`h-9 rounded-lg font-semibold text-sm transition-all select-none ${className}`}
    >
      {label}
    </button>
  );

  return (
    <div
      style={{ left: calcPosition.x, top: calcPosition.y }}
      className={`absolute w-72 bg-slate-900/95 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl overflow-hidden z-[1000] flex flex-col transition-all duration-100 ${
        isCalcMinimized ? 'h-11' : ''
      }`}
    >
      {/* Header */}
      <div
        onMouseDown={handleMouseDown}
        className="h-11 bg-slate-800/80 border-b border-white/5 flex items-center justify-between px-3 cursor-move select-none"
      >
        <span className="text-slate-200 text-xs font-semibold tracking-wide">Scientific Calculator</span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setCalcPinned(!isCalcPinned)}
            className="p-1 hover:bg-slate-700/50 rounded transition-all"
            title={isCalcPinned ? "Unpin widget" : "Pin widget"}
          >
            <Pin size={13} className={isCalcPinned ? 'text-teal-400' : 'text-slate-400'} />
          </button>
          <button
            onClick={() => setCalcMinimized(!isCalcMinimized)}
            className="p-1 hover:bg-slate-700/50 rounded transition-all"
          >
            {isCalcMinimized ? <Maximize2 size={13} className="text-slate-400" /> : <Minus size={13} className="text-slate-400" />}
          </button>
          <button
            onClick={() => setCalcVisible(false)}
            className="p-1 hover:bg-red-500/20 rounded transition-all"
          >
            <X size={13} className="text-red-400" />
          </button>
        </div>
      </div>

      {/* Body */}
      {!isCalcMinimized && (
        <div className="p-3 flex flex-col gap-2">
          {/* Mode Switcher */}
          <div className="flex bg-black/30 p-0.5 rounded-lg border border-white/5 text-[11px] font-semibold text-slate-400">
            <button
              onClick={() => setMode('basic')}
              className={`flex-1 py-1 rounded-md text-center transition-all ${
                mode === 'basic' ? 'bg-primary text-white shadow' : 'hover:text-slate-200'
              }`}
            >
              Basic
            </button>
            <button
              onClick={() => setMode('scientific')}
              className={`flex-1 py-1 rounded-md text-center transition-all ${
                mode === 'scientific' ? 'bg-primary text-white shadow' : 'hover:text-slate-200'
              }`}
            >
              Scientific
            </button>
            <button
              onClick={() => setMode('solver')}
              className={`flex-1 py-1 rounded-md text-center transition-all ${
                mode === 'solver' ? 'bg-primary text-white shadow' : 'hover:text-slate-200'
              }`}
            >
              Solver
            </button>
          </div>

          {mode !== 'solver' ? (
            <div className="flex flex-col gap-2">
              {/* Screen */}
              <div className="bg-black/40 border border-white/5 rounded-xl p-2.5 h-16 flex flex-col justify-between items-end">
                <span className="text-slate-400 text-xs truncate max-w-full">{calcInput || '0'}</span>
                <span className="text-sky-400 text-lg font-bold truncate max-w-full">{calcResult || '0'}</span>
              </div>

              {/* Keys Grid */}
              <div className="flex flex-col gap-1">
                {mode === 'scientific' && (
                  <div className="grid grid-cols-4 gap-1.5 mb-1 text-[11px] font-medium text-slate-300">
                    {['sin(', 'cos(', 'tan(', '√('].map((fn) => (
                      <button
                        key={fn}
                        onClick={() => setCalcInput((p) => p + fn)}
                        className="py-1 rounded bg-slate-800/80 hover:bg-slate-800 transition-all"
                      >
                        {fn.slice(0, -1)}
                      </button>
                    ))}
                    {['ln(', 'log(', 'π', 'e'].map((fn) => (
                      <button
                        key={fn}
                        onClick={() => setCalcInput((p) => p + (fn === 'π' || fn === 'e' ? fn : fn))}
                        className="py-1 rounded bg-slate-800/80 hover:bg-slate-800 transition-all"
                      >
                        {fn.slice(0, -1) || fn}
                      </button>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-4 gap-1">
                  {['C', '(', ')', '÷'].map((label) =>
                    renderKey(label, label === 'C' ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-slate-800 text-sky-400 hover:bg-slate-800/80')
                  )}
                  {['7', '8', '9', '×'].map((label) =>
                    renderKey(label, isNaN(Number(label)) ? 'bg-slate-800 text-sky-400 hover:bg-slate-800/80' : undefined)
                  )}
                  {['4', '5', '6', '-'].map((label) =>
                    renderKey(label, isNaN(Number(label)) ? 'bg-slate-800 text-sky-400 hover:bg-slate-800/80' : undefined)
                  )}
                  {['1', '2', '3', '+'].map((label) =>
                    renderKey(label, isNaN(Number(label)) ? 'bg-slate-800 text-sky-400 hover:bg-slate-800/80' : undefined)
                  )}
                  {['del', '0', '.', '='].map((label) =>
                    renderKey(label, label === '=' ? 'bg-primary text-white hover:bg-primary-light' : undefined)
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Solver Form */
            <div className="h-[210px] overflow-y-auto flex flex-col gap-2.5">
              <span className="text-[11px] text-slate-400 text-center">Solve Equation: ax² + bx + c = 0</span>
              <div className="flex flex-col gap-1.5 px-2">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs font-semibold text-slate-300">a =</span>
                  <input
                    type="number"
                    value={coeffA}
                    onChange={(e) => setCoeffA(e.target.value)}
                    className="w-32 h-8 bg-black/30 border border-white/10 rounded-lg text-center text-xs text-white outline-none focus:border-teal-500/50"
                  />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs font-semibold text-slate-300">b =</span>
                  <input
                    type="number"
                    value={coeffB}
                    onChange={(e) => setCoeffB(e.target.value)}
                    className="w-32 h-8 bg-black/30 border border-white/10 rounded-lg text-center text-xs text-white outline-none focus:border-teal-500/50"
                  />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs font-semibold text-slate-300">c =</span>
                  <input
                    type="number"
                    value={coeffC}
                    onChange={(e) => setCoeffC(e.target.value)}
                    className="w-32 h-8 bg-black/30 border border-white/10 rounded-lg text-center text-xs text-white outline-none focus:border-teal-500/50"
                  />
                </div>
                <button
                  onClick={solveQuadratic}
                  className="mt-2 bg-teal-500 text-slate-950 font-bold text-xs py-2 rounded-lg hover:bg-teal-400 transition-all"
                >
                  Calculate Roots
                </button>
              </div>

              {solverResult && (
                <div className="bg-teal-500/10 border border-teal-500/20 rounded-lg p-2 text-[11px] text-teal-400 whitespace-pre-line leading-relaxed">
                  {solverResult}
                </div>
              )}
            </div>
          )}

          {/* History Footer */}
          {history.length > 0 && mode !== 'solver' && (
            <div className="border-t border-white/5 mt-1.5 pt-1.5 flex flex-col">
              <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold mb-1">
                <span>HISTORY</span>
                <button onClick={() => setHistory([])} className="hover:text-red-400">
                  <RotateCcw size={10} />
                </button>
              </div>
              <span className="text-slate-400 text-[11px] truncate">{history[0]}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
