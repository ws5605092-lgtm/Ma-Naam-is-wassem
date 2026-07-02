import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Delete, HelpCircle, History, RotateCcw } from 'lucide-react';

interface CalculatorProps {
  onUnlock: (isMaster: boolean, pin: string) => void;
  masterPinHash: string;
  decoyPinHash: string;
  onForgotPassword: () => void;
}

export default function Calculator({ onUnlock, masterPinHash, decoyPinHash, onForgotPassword }: CalculatorProps) {
  const [display, setDisplay] = useState('0');
  const [equation, setEquation] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [isFresh, setIsFresh] = useState(true);

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      if (/[0-9]/.test(key)) {
        handleNumber(key);
      } else if (key === '.') {
        handleDecimal();
      } else if (['+', '-', '*', '/'].includes(key)) {
        handleOperator(key === '*' ? '×' : key === '/' ? '÷' : key);
      } else if (key === 'Enter' || key === '=') {
        handleEvaluate();
      } else if (key === 'Escape' || key === 'c' || key === 'C') {
        handleClear();
      } else if (key === 'Backspace') {
        handleBackspace();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [display, equation, isFresh]);

  const handleNumber = (num: string) => {
    if (isFresh || display === '0' || display === 'Error') {
      setDisplay(num);
      setIsFresh(false);
    } else {
      if (display.length < 12) {
        setDisplay(display + num);
      }
    }
  };

  const handleDecimal = () => {
    if (isFresh) {
      setDisplay('0.');
      setIsFresh(false);
      return;
    }
    if (!display.includes('.')) {
      setDisplay(display + '.');
    }
  };

  const handleOperator = (op: string) => {
    setIsFresh(true);
    if (equation && !isFresh) {
      // Evaluate first
      try {
        const val = evaluateEquation();
        setEquation(`${val} ${op}`);
        setDisplay(String(val));
      } catch {
        setDisplay('Error');
      }
    } else {
      setEquation(`${display} ${op}`);
    }
  };

  const handleClear = () => {
    setDisplay('0');
    setEquation('');
    setIsFresh(true);
  };

  const handleBackspace = () => {
    if (display.length > 1) {
      setDisplay(display.slice(0, -1));
    } else {
      setDisplay('0');
    }
  };

  const handleToggleSign = () => {
    if (display !== '0' && display !== 'Error') {
      if (display.startsWith('-')) {
        setDisplay(display.slice(1));
      } else {
        setDisplay('-' + display);
      }
    }
  };

  const handlePercentage = () => {
    if (display !== 'Error') {
      const num = parseFloat(display);
      setDisplay(String(num / 100));
      setIsFresh(true);
    }
  };

  const evaluateEquation = (): number => {
    if (!equation) return parseFloat(display);
    const parts = equation.split(' ');
    const num1 = parseFloat(parts[0]);
    const op = parts[1];
    const num2 = parseFloat(display);

    switch (op) {
      case '+': return num1 + num2;
      case '-': return num1 - num2;
      case '×': return num1 * num2;
      case '÷': 
        if (num2 === 0) throw new Error('Divide by zero');
        return num1 / num2;
      default: return num2;
    }
  };

  const handleEvaluate = async () => {
    // Check if entered display value matches PIN codes BEFORE evaluating math!
    const cleanPin = display.replace(/\D/g, ''); // Extract purely numbers for PIN check
    
    // Hash the PIN to compare
    if (cleanPin) {
      const encoder = new TextEncoder();
      const data = encoder.encode(cleanPin);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const attemptHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      if (attemptHash === masterPinHash) {
        onUnlock(true, cleanPin); // Master Vault
        return;
      } else if (decoyPinHash && attemptHash === decoyPinHash) {
        onUnlock(false, cleanPin); // Decoy Vault
        return;
      } else if (cleanPin === '987654321') {
        onForgotPassword();
        return;
      }
    }

    // Default: Just do standard math evaluations
    if (!equation) return;
    try {
      const result = evaluateEquation();
      // Format nice display string
      let resultStr = String(Number(result.toFixed(8)));
      if (resultStr.length > 12) {
        resultStr = result.toExponential(5);
      }
      
      const fullEq = `${equation} ${display} = ${resultStr}`;
      setHistory(prev => [fullEq, ...prev].slice(0, 20)); // Limit to 20 history logs
      setDisplay(resultStr);
      setEquation('');
      setIsFresh(true);
    } catch {
      setDisplay('Error');
      setEquation('');
      setIsFresh(true);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#09090b] text-zinc-100 p-4 font-sans select-none">
      <div className="relative w-full max-w-[360px] bg-[#18181b] border border-white/5 rounded-[2rem] p-8 shadow-2xl flex flex-col overflow-hidden">
        {/* Stealth Security / Debug Header */}
        <div className="flex justify-between items-center text-[10px] font-mono font-medium tracking-widest text-zinc-600 mb-6">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
            <span>DEG</span>
          </div>
          {/* Stealthy forgot password trigger */}
          <button 
            onClick={onForgotPassword}
            className="hover:text-zinc-400 cursor-pointer transition-colors"
            title="System Info"
          >
            SYS-9.2
          </button>
        </div>

        {/* Display Panel */}
        <div className="h-32 flex flex-col items-end justify-end mb-8 relative">
          <span className="text-zinc-500 text-[10px] uppercase tracking-widest mb-1">Stealth Active</span>
          {equation && (
            <div className="text-zinc-500 text-[11px] font-mono absolute top-0 right-0 max-w-[90%] truncate">
              {equation}
            </div>
          )}
          <div className="text-5xl font-light tracking-tight text-zinc-100 select-all truncate w-full text-right font-sans">
            {display}
          </div>
          
          {/* History Icon Toggle */}
          <button 
            onClick={() => setShowHistory(!showHistory)}
            className="absolute top-0 left-0 text-zinc-600 hover:text-zinc-300 transition-colors cursor-pointer p-1"
          >
            <History className="w-4 h-4" />
          </button>
        </div>

        {/* Interactive History Slider */}
        {showHistory && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-[#111114] border border-white/5 rounded-2xl p-4 max-h-48 overflow-y-auto flex flex-col gap-2 font-mono text-xs text-zinc-400 mb-6"
          >
            <div className="flex justify-between items-center border-b border-white/5 pb-2 mb-1">
              <span className="font-semibold text-[10px] uppercase tracking-wider text-zinc-500">Calculation History</span>
              <button 
                onClick={() => setHistory([])}
                className="text-zinc-500 hover:text-orange-400 flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" /> Clear
              </button>
            </div>
            {history.length === 0 ? (
              <div className="text-center py-4 text-zinc-600">No calculations recorded</div>
            ) : (
              history.map((h, i) => (
                <div key={i} className="py-1 border-b border-white/5 last:border-0 hover:text-zinc-200 transition-colors">
                  {h}
                </div>
              ))
            )}
          </motion.div>
        )}

        {/* Keyboard Layout Grid */}
        <div className="grid grid-cols-4 gap-3">
          {/* Row 1 */}
          <button 
            onClick={handleClear}
            className="h-14 rounded-2xl bg-zinc-800/40 text-orange-400 font-medium text-lg hover:bg-zinc-800 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
          >
            C
          </button>
          <button 
            onClick={handleToggleSign}
            className="h-14 rounded-2xl bg-zinc-800/40 text-orange-400 font-medium text-lg hover:bg-zinc-800 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
          >
            ±
          </button>
          <button 
            onClick={handlePercentage}
            className="h-14 rounded-2xl bg-zinc-800/40 text-orange-400 font-medium text-lg hover:bg-zinc-800 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
          >
            %
          </button>
          <button 
            onClick={() => handleOperator('÷')}
            className="h-14 rounded-2xl bg-orange-500/10 text-orange-500 font-semibold text-xl hover:bg-orange-500/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
          >
            ÷
          </button>

          {/* Row 2 */}
          <button 
            onClick={() => handleNumber('7')}
            className="h-14 rounded-2xl bg-zinc-800/80 text-white font-medium text-xl hover:bg-zinc-700 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
          >
            7
          </button>
          <button 
            onClick={() => handleNumber('8')}
            className="h-14 rounded-2xl bg-zinc-800/80 text-white font-medium text-xl hover:bg-zinc-700 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
          >
            8
          </button>
          <button 
            onClick={() => handleNumber('9')}
            className="h-14 rounded-2xl bg-zinc-800/80 text-white font-medium text-xl hover:bg-zinc-700 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
          >
            9
          </button>
          <button 
            onClick={() => handleOperator('×')}
            className="h-14 rounded-2xl bg-orange-500/10 text-orange-500 font-semibold text-xl hover:bg-orange-500/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
          >
            ×
          </button>

          {/* Row 3 */}
          <button 
            onClick={() => handleNumber('4')}
            className="h-14 rounded-2xl bg-zinc-800/80 text-white font-medium text-xl hover:bg-zinc-700 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
          >
            4
          </button>
          <button 
            onClick={() => handleNumber('5')}
            className="h-14 rounded-2xl bg-zinc-800/80 text-white font-medium text-xl hover:bg-zinc-700 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
          >
            5
          </button>
          <button 
            onClick={() => handleNumber('6')}
            className="h-14 rounded-2xl bg-zinc-800/80 text-white font-medium text-xl hover:bg-zinc-700 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
          >
            6
          </button>
          <button 
            onClick={() => handleOperator('-')}
            className="h-14 rounded-2xl bg-orange-500/10 text-orange-500 font-semibold text-xl hover:bg-orange-500/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
          >
            −
          </button>

          {/* Row 4 */}
          <button 
            onClick={() => handleNumber('1')}
            className="h-14 rounded-2xl bg-zinc-800/80 text-white font-medium text-xl hover:bg-zinc-700 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
          >
            1
          </button>
          <button 
            onClick={() => handleNumber('2')}
            className="h-14 rounded-2xl bg-zinc-800/80 text-white font-medium text-xl hover:bg-zinc-700 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
          >
            2
          </button>
          <button 
            onClick={() => handleNumber('3')}
            className="h-14 rounded-2xl bg-zinc-800/80 text-white font-medium text-xl hover:bg-zinc-700 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
          >
            3
          </button>
          <button 
            onClick={() => handleOperator('+')}
            className="h-14 rounded-2xl bg-orange-500/10 text-orange-500 font-semibold text-xl hover:bg-orange-500/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
          >
            +
          </button>

          {/* Row 5 */}
          <button 
            onClick={() => handleNumber('0')}
            className="col-span-2 h-14 rounded-2xl bg-zinc-800/80 text-white font-medium text-xl hover:bg-zinc-700 active:scale-95 px-6 transition-all cursor-pointer flex items-center justify-start"
          >
            0
          </button>
          <button 
            onClick={handleDecimal}
            className="h-14 rounded-2xl bg-zinc-800/80 text-white font-medium text-xl hover:bg-zinc-700 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
          >
            .
          </button>
          <button 
            onClick={handleEvaluate}
            className="h-14 rounded-2xl bg-orange-500 text-white font-semibold text-2xl hover:bg-orange-600 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
          >
            =
          </button>
        </div>
        
        {/* Stealth protocol info block */}
        <div className="mt-6 p-4 bg-black/20 rounded-xl border border-white/5">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-zinc-500">
            <span>Encryption Protocol</span>
            <span className="text-green-500 font-semibold">AES-256 Enabled</span>
          </div>
        </div>
      </div>
    </div>
  );
}
