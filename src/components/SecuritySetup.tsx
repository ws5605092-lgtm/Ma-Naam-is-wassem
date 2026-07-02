import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Shield, Lock, EyeOff, HelpCircle, CheckCircle2, ChevronRight, AlertCircle } from 'lucide-react';
import { hashPin } from '../utils/vaultDb';
import { VaultSettings } from '../types';

interface SecuritySetupProps {
  onSetupComplete: (settings: VaultSettings, masterPin: string) => void;
}

const SECURITY_QUESTIONS = [
  "What was the name of your first pet?",
  "In what city were you born?",
  "What is your mother's maiden name?",
  "What was the name of your first school?",
  "What is your favorite book or movie?"
];

export default function SecuritySetup({ onSetupComplete }: SecuritySetupProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [decoyPin, setDecoyPin] = useState('');
  const [selectedQuestion, setSelectedQuestion] = useState(SECURITY_QUESTIONS[0]);
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [error, setError] = useState('');

  const handleNextStep1 = () => {
    if (pin.length < 4 || pin.length > 8 || !/^\d+$/.test(pin)) {
      setError('PIN must be a numeric code between 4 and 8 digits.');
      return;
    }
    if (pin !== confirmPin) {
      setError('PINs do not match.');
      return;
    }
    setError('');
    setStep(2);
  };

  const handleNextStep2 = () => {
    if (decoyPin) {
      if (!/^\d+$/.test(decoyPin)) {
        setError('Decoy PIN must contain only digits.');
        return;
      }
      if (decoyPin === pin) {
        setError('Decoy PIN cannot be the same as your Master PIN.');
        return;
      }
      if (decoyPin.length < 4 || decoyPin.length > 8) {
        setError('Decoy PIN must be between 4 and 8 digits.');
        return;
      }
    }
    setError('');
    setStep(3);
  };

  const handleFinishSetup = async () => {
    if (!securityAnswer.trim()) {
      setError('Please provide an answer to your security question.');
      return;
    }

    try {
      const masterPinHash = await hashPin(pin);
      const decoyPinHash = decoyPin ? await hashPin(decoyPin) : '';
      const securityAnswerHash = await hashPin(securityAnswer.trim().toLowerCase());

      const settings: VaultSettings = {
        hasSetup: true,
        masterPinHash,
        decoyPinHash,
        securityQuestion: selectedQuestion,
        securityAnswerHash
      };

      onSetupComplete(settings, pin);
    } catch (err) {
      setError('An error occurred during security setup. Please try again.');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#09090b] text-zinc-100 p-4 font-sans select-none">
      <div className="w-full max-w-md bg-[#18181b] border border-white/5 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header decoration */}
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 h-2 w-full" />
        
        <div className="p-8">
          {/* Logo and steps tracker */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-orange-500/10 rounded-lg text-orange-500">
                <Shield className="w-6 h-6" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-white">Vault Security Setup</h1>
            </div>
            <div className="text-xs font-mono text-zinc-400 bg-black/20 px-2.5 py-1 rounded-md border border-white/5">
              Step {step} of 3
            </div>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-lg text-sm flex items-start space-x-3"
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-400" />
              <span>{error}</span>
            </motion.div>
          )}

          {/* STEP 1: Set Master PIN */}
          {step === 1 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-lg font-medium text-white mb-2 flex items-center gap-2">
                  <Lock className="w-5 h-5 text-orange-500" /> Define Master PIN
                </h2>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  This PIN is your secret key to unlock the private vault. You will enter this PIN on the calculator screen and click <strong className="text-orange-400">=</strong> to gain access.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs uppercase font-semibold text-zinc-400 tracking-wider mb-2">
                    Enter PIN (4-8 digits)
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={8}
                    value={pin}
                    onChange={(e) => {
                      setPin(e.target.value.replace(/\D/g, ''));
                      setError('');
                    }}
                    placeholder="••••"
                    className="w-full bg-black/25 border border-white/5 rounded-xl px-4 py-3.5 text-center text-2xl tracking-widest text-orange-500 focus:outline-none focus:border-orange-500 transition-colors font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase font-semibold text-zinc-400 tracking-wider mb-2">
                    Confirm PIN
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={8}
                    value={confirmPin}
                    onChange={(e) => {
                      setConfirmPin(e.target.value.replace(/\D/g, ''));
                      setError('');
                    }}
                    placeholder="••••"
                    className="w-full bg-black/25 border border-white/5 rounded-xl px-4 py-3.5 text-center text-2xl tracking-widest text-orange-500 focus:outline-none focus:border-orange-500 transition-colors font-mono"
                  />
                </div>
              </div>

              <button
                onClick={handleNextStep1}
                className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-medium py-3.5 px-6 rounded-xl shadow-lg shadow-orange-500/10 cursor-pointer active:scale-[0.98] transition-all"
              >
                <span>Continue</span>
                <ChevronRight className="w-5 h-5" />
              </button>
            </motion.div>
          )}

          {/* STEP 2: Configure Decoy PIN */}
          {step === 2 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-lg font-medium text-white mb-2 flex items-center gap-2">
                  <EyeOff className="w-5 h-5 text-orange-500" /> Setup Decoy PIN (Optional)
                </h2>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  If someone forces you to open this app, entering this <strong>Decoy PIN</strong> will unlock a completely fake, separate vault with non-sensitive placeholder contents.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs uppercase font-semibold text-zinc-400 tracking-wider mb-2">
                    Decoy PIN (4-8 digits, leave empty to skip)
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={8}
                    value={decoyPin}
                    onChange={(e) => {
                      setDecoyPin(e.target.value.replace(/\D/g, ''));
                      setError('');
                    }}
                    placeholder="•••• (Optional)"
                    className="w-full bg-black/25 border border-white/5 rounded-xl px-4 py-3.5 text-center text-2xl tracking-widest text-orange-400 focus:outline-none focus:border-orange-500 transition-colors font-mono"
                  />
                </div>

                <div className="p-3 bg-orange-500/5 border border-orange-500/10 rounded-lg text-xs text-orange-300 leading-relaxed flex gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-orange-400 mt-0.5" />
                  <span>
                    Must be different from your Master PIN. Leaving this blank disables decoy functionality. You can configure it later in Settings.
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="w-1/3 bg-black/25 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-white/5 font-medium py-3.5 px-4 rounded-xl transition-all cursor-pointer"
                >
                  Back
                </button>
                <button
                  onClick={handleNextStep2}
                  className="flex-1 flex items-center justify-center space-x-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-medium py-3.5 px-6 rounded-xl shadow-lg cursor-pointer active:scale-[0.98] transition-all"
                >
                  <span>{decoyPin ? 'Configure Decoy' : 'Skip & Continue'}</span>
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 3: Password Recovery Question */}
          {step === 3 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-lg font-medium text-white mb-2 flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-orange-500" /> Security Question
                </h2>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Your vault files are fully encrypted in the browser using your PIN. If you forget your PIN, this security question is the only way to recover access.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs uppercase font-semibold text-zinc-400 tracking-wider mb-2">
                    Choose a Question
                  </label>
                  <select
                    value={selectedQuestion}
                    onChange={(e) => setSelectedQuestion(e.target.value)}
                    className="w-full bg-black/25 border border-white/5 rounded-xl px-4 py-3.5 text-sm text-zinc-200 focus:outline-none focus:border-orange-500 transition-colors"
                  >
                    {SECURITY_QUESTIONS.map((q, idx) => (
                      <option key={idx} value={q} className="bg-[#18181b]">{q}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs uppercase font-semibold text-zinc-400 tracking-wider mb-2">
                    Your Answer
                  </label>
                  <input
                    type="text"
                    value={securityAnswer}
                    onChange={(e) => {
                      setSecurityAnswer(e.target.value);
                      setError('');
                    }}
                    placeholder="Enter answer (not case-sensitive)"
                    className="w-full bg-black/25 border border-white/5 rounded-xl px-4 py-3.5 text-sm text-zinc-200 focus:outline-none focus:border-orange-500 transition-colors"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(2)}
                  className="w-1/3 bg-black/25 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-white/5 font-medium py-3.5 px-4 rounded-xl transition-all cursor-pointer"
                >
                  Back
                </button>
                <button
                  onClick={handleFinishSetup}
                  className="flex-1 flex items-center justify-center space-x-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-medium py-3.5 px-6 rounded-xl shadow-lg shadow-orange-500/10 cursor-pointer hover:shadow-orange-500/20 active:scale-[0.98] transition-all"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Complete Setup</span>
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
