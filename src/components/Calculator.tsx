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
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-100 p-4 font-sans select-none">
      <div className="relative w-full max-w-[360px] bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl flex flex-col gap-5 overflow-hidden">
        {/* Stealth Security / Debug Header */}
        <div className="flex justify-between items-center text-[10px] font-mono font-medium tracking-widest text-neutral-600 px-1">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-700 animate-pulse" />
            <span>DEG</span>
          </div>
          {/* Stealthy forgot password trigger */}
          <button 
            onClick={onForgotPassword}
            className="hover:text-neutral-400 cursor-pointer transition-colors p-1"
            title="System Info"
          >
            SYS-9.2
          </button>
        </div>

        {/* Display Panel */}
        <div className="flex flex-col justify-end items-end h-28 px-2 bg-neutral-950/40 rounded-2xl border border-neutral-800/20 p-4 text-right overflow-hidden relative">
          <div className="text-xs text-neutral-500 font-mono h-5 overflow-hidden truncate w-full">
            {equation}
          </div>
          <div className="text-4xl md:text-5xl font-light text-white tracking-tight select-all w-full truncate font-sans">
            {display}
          </div>
          
          {/* History Icon Toggle */}
          <button 
            onClick={() => setShowHistory(!showHistory)}
            className="absolute top-3 left-3 text-neutral-600 hover:text-neutral-300 transition-colors p-1 cursor-pointer"
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
            className="bg-neutral-950 border border-neutral-800 rounded-2xl p-4 max-h-48 overflow-y-auto flex flex-col gap-2 font-mono text-xs text-neutral-400"
          >
            <div className="flex justify-between items-center border-b border-neutral-800 pb-2 mb-1">
              <span className="font-semibold text-[10px] uppercase tracking-wider text-neutral-500">Calculation History</span>
              <button 
                onClick={() => setHistory([])}
                className="text-neutral-500 hover:text-rose-400 flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" /> Clear
              </button>
            </div>
            {history.length === 0 ? (
              <div className="text-center py-4 text-neutral-600">No calculations recorded</div>
            ) : (
              history.map((h, i) => (
                <div key={i} className="py-1 border-b border-neutral-900/40 last:border-0 hover:text-neutral-200 transition-colors">
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
            className="h-14 rounded-full bg-neutral-800 text-neutral-200 font-medium text-lg hover:bg-neutral-700 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
          >
            C
          </button>
          <button 
            onClick={handleToggleSign}
            className="h-14 rounded-full bg-neutral-800 text-neutral-200 font-medium text-lg hover:bg-neutral-700 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
          >
            ±
          </button>
          <button 
            onClick={handlePercentage}
            className="h-14 rounded-full bg-neutral-800 text-neutral-200 font-medium text-lg hover:bg-neutral-700 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
          >
            %
          </button>
          <button 
            onClick={() => handleOperator('÷')}
            className="h-14 rounded-full bg-amber-500 text-white font-semibold text-xl hover:bg-amber-400 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
          >
            ÷
          </button>

          {/* Row 2 */}
          <button 
            onClick={() => handleNumber('7')}
            className="h-14 rounded-full bg-neutral-800/40 border border-neutral-800 text-white font-medium text-xl hover:bg-neutral-800 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
          >
            7
          </button>
          <button 
            onClick={() => handleNumber('8')}
            className="h-14 rounded-full bg-neutral-800/40 border border-neutral-800 text-white font-medium text-xl hover:bg-neutral-800 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
          >
            8
          </button>
          <button 
            onClick={() => handleNumber('9')}
            className="h-14 rounded-full bg-neutral-800/40 border border-neutral-800 text-white font-medium text-xl hover:bg-neutral-800 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
          >
            9
          </button>
          <button 
            onClick={() => handleOperator('×')}
            className="h-14 rounded-full bg-amber-500 text-white font-semibold text-xl hover:bg-amber-400 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
          >
            ×
          </button>

          {/* Row 3 */}
          <button 
            onClick={() => handleNumber('4')}
            className="h-14 rounded-full bg-neutral-800/40 border border-neutral-800 text-white font-medium text-xl hover:bg-neutral-800 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
          >
            4
          </button>
          <button 
            onClick={() => handleNumber('5')}
            className="h-14 rounded-full bg-neutral-800/40 border border-neutral-800 text-white font-medium text-xl hover:bg-neutral-800 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
          >
            5
          </button>
          <button 
            onClick={() => handleNumber('6')}
            className="h-14 rounded-full bg-neutral-800/40 border border-neutral-800 text-white font-medium text-xl hover:bg-neutral-800 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
          >
            6
          </button>
          <button 
            onClick={() => handleOperator('-')}
            className="h-14 rounded-full bg-amber-500 text-white font-semibold text-xl hover:bg-amber-400 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
          >
            −
          </button>

          {/* Row 4 */}
          <button 
            onClick={() => handleNumber('1')}
            className="h-14 rounded-full bg-neutral-800/40 border border-neutral-800 text-white font-medium text-xl hover:bg-neutral-800 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
          >
            1
          </button>
          <button 
            onClick={() => handleNumber('2')}
            className="h-14 rounded-full bg-neutral-800/40 border border-neutral-800 text-white font-medium text-xl hover:bg-neutral-800 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
          >
            2
          </button>
          <button 
            onClick={() => handleNumber('3')}
            className="h-14 rounded-full bg-neutral-800/40 border border-neutral-800 text-white font-medium text-xl hover:bg-neutral-800 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
          >
            3
          </button>
          <button 
            onClick={() => handleOperator('+')}
            className="h-14 rounded-full bg-amber-500 text-white font-semibold text-xl hover:bg-amber-400 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
          >
            +
          </button>

          {/* Row 5 */}
          <button 
            onClick={() => handleNumber('0')}
            className="col-span-2 h-14 rounded-full bg-neutral-800/40 border border-neutral-800 text-white font-medium text-xl hover:bg-neutral-800 active:scale-95 px-6 transition-all cursor-pointer flex items-center justify-start"
          >
            0
          </button>
          <button 
            onClick={handleDecimal}
            className="h-14 rounded-full bg-neutral-800/40 border border-neutral-800 text-white font-medium text-xl hover:bg-neutral-800 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
          >
            .
          </button>
          <button 
            onClick={handleEvaluate}
            className="h-14 rounded-full bg-emerald-600 text-white font-semibold text-2xl hover:bg-emerald-500 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
          >
            =
          </button>
        </div>
        
        {/* Anti-slop / Clean Footnote */}
        <div className="text-center text-[9px] text-neutral-700 tracking-wider">
          SOLAR POWERED DUAL DIODE SYSTEM
        </div>
      </div>
    </div>
  );
}
