import React, { useState } from 'react';
import { motion } from 'motion/react';
import { HelpCircle, KeyRound, AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { hashPin } from '../utils/vaultDb';

interface ForgotPasswordProps {
  securityQuestion: string;
  securityAnswerHash: string;
  onResetComplete: (newPin: string) => void;
  onBack: () => void;
}

export default function ForgotPassword({ securityQuestion, securityAnswerHash, onResetComplete, onBack }: ForgotPasswordProps) {
  const [answer, setAnswer] = useState('');
  const [isAnswered, setIsAnswered] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleVerifyAnswer = async () => {
    if (!answer.trim()) {
      setError('Please provide an answer.');
      return;
    }

    const hashedAttempt = await hashPin(answer.trim().toLowerCase());
    if (hashedAttempt === securityAnswerHash) {
      setIsAnswered(true);
      setError('');
    } else {
      setError('Incorrect answer to security question.');
    }
  };

  const handleResetPin = async () => {
    if (newPin.length < 4 || newPin.length > 8 || !/^\d+$/.test(newPin)) {
      setError('PIN must be a numeric code between 4 and 8 digits.');
      return;
    }
    if (newPin !== confirmPin) {
      setError('PINs do not match.');
      return;
    }

    onResetComplete(newPin);
    setSuccess(true);
    setError('');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#09090b] text-zinc-100 p-4 font-sans select-none">
      <div className="w-full max-w-md bg-[#18181b] border border-white/5 rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 h-2 w-full" />

        <div className="p-8">
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-2 bg-orange-500/10 rounded-lg text-orange-500">
              <KeyRound className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">Vault PIN Recovery</h1>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-lg text-sm flex items-start space-x-3"
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400 mt-0.5" />
              <span>{error}</span>
            </motion.div>
          )}

          {success ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6 text-center py-4"
            >
              <div className="flex justify-center">
                <div className="p-4 bg-orange-500/10 rounded-full text-orange-500">
                  <CheckCircle2 className="w-12 h-12 animate-bounce" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-medium text-white mb-2">PIN Reset Successfully!</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Your new master PIN has been saved. Please make sure to remember it. You can now go back to the calculator and enter your new PIN to unlock.
                </p>
              </div>
              <button
                onClick={onBack}
                className="w-full bg-[#111114] hover:bg-zinc-800 border border-white/5 text-white font-medium py-3 rounded-xl transition-all cursor-pointer"
              >
                Go to Calculator
              </button>
            </motion.div>
          ) : !isAnswered ? (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-md font-medium text-zinc-300 mb-2 flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-orange-400" /> Security Challenge
                </h2>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  To verify your ownership of the encrypted files, answer the security question you set up during initial registration.
                </p>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-black/20 border border-white/5 rounded-xl">
                  <label className="block text-[10px] uppercase font-bold text-orange-400 tracking-wider mb-1">
                    Your Question
                  </label>
                  <p className="text-sm text-white font-medium">{securityQuestion}</p>
                </div>

                <div>
                  <label className="block text-xs uppercase font-semibold text-zinc-400 tracking-wider mb-2">
                    Your Answer
                  </label>
                  <input
                    type="text"
                    value={answer}
                    onChange={(e) => {
                      setAnswer(e.target.value);
                      setError('');
                    }}
                    placeholder="Type answer here"
                    className="w-full bg-black/25 border border-white/5 rounded-xl px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-orange-500 transition-colors"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={onBack}
                  className="w-1/3 flex items-center justify-center space-x-1.5 bg-black/25 hover:bg-zinc-800 border border-white/5 text-zinc-400 hover:text-white rounded-xl transition-all cursor-pointer text-sm"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button
                  onClick={handleVerifyAnswer}
                  className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-medium py-3 px-6 rounded-xl transition-all cursor-pointer text-sm shadow-md"
                >
                  Verify Answer
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-md font-medium text-zinc-200 mb-2">Set New Master PIN</h2>
                <p className="text-xs text-zinc-400">
                  Authentication successful. Define a new numeric passcode to access your vault files.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs uppercase font-semibold text-zinc-400 tracking-wider mb-2">
                    Enter New PIN (4-8 digits)
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={8}
                    value={newPin}
                    onChange={(e) => {
                      setNewPin(e.target.value.replace(/\D/g, ''));
                      setError('');
                    }}
                    placeholder="••••"
                    className="w-full bg-black/25 border border-white/5 rounded-xl px-4 py-3.5 text-center text-xl tracking-widest text-orange-500 focus:outline-none focus:border-orange-500 transition-colors font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase font-semibold text-zinc-400 tracking-wider mb-2">
                    Confirm New PIN
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={8}
                    value={confirmPin}
                    onChange={(e) => {
                      setConfirmPin(e.target.value.replace(/\D/g, ''));
                      setError('');
                    }}
                    placeholder="••••"
                    className="w-full bg-black/25 border border-white/5 rounded-xl px-4 py-3.5 text-center text-xl tracking-widest text-orange-500 focus:outline-none focus:border-orange-500 transition-colors font-mono"
                  />
                </div>
              </div>

              <button
                onClick={handleResetPin}
                className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-medium py-3.5 px-6 rounded-xl shadow-lg transition-all cursor-pointer"
              >
                Save New PIN
              </button>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
