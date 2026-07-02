import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldAlert, RefreshCw } from 'lucide-react';
import { VaultSettings, SecurityLog } from './types';
import { deriveKeyFromPin, addLog } from './utils/vaultDb';

// Components
import Calculator from './components/Calculator';
import SecuritySetup from './components/SecuritySetup';
import VaultDashboard from './components/VaultDashboard';
import ForgotPassword from './components/ForgotPassword';

const SETTINGS_LOCAL_STORAGE_KEY = 'calc_vault_settings';

export default function App() {
  const [hasSetup, setHasSetup] = useState<boolean | null>(null);
  const [vaultSettings, setVaultSettings] = useState<VaultSettings | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isMaster, setIsMaster] = useState(true);
  const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  // 1. Check for initial settings setup
  useEffect(() => {
    try {
      const storedSettings = localStorage.getItem(SETTINGS_LOCAL_STORAGE_KEY);
      if (storedSettings) {
        const parsed = JSON.parse(storedSettings) as VaultSettings;
        setVaultSettings(parsed);
        setHasSetup(true);
      } else {
        setHasSetup(false);
      }
    } catch (err) {
      console.error('Error reading vault configuration:', err);
      setHasSetup(false);
    }
  }, []);

  // 2. Process onboarding setup completion
  const handleSetupComplete = async (newSettings: VaultSettings, masterPin: string) => {
    try {
      localStorage.setItem(SETTINGS_LOCAL_STORAGE_KEY, JSON.stringify(newSettings));
      setVaultSettings(newSettings);
      setHasSetup(true);

      // Derive key and log successful initialization log
      const derived = await deriveKeyFromPin(masterPin);
      setCryptoKey(derived);
      setIsMaster(true);

      await addLog({
        timestamp: Date.now(),
        event: 'security_setup',
        details: 'Vault initialized and secured with AES-GCM 256-bit client-side keys.'
      });

      setIsUnlocked(true);
    } catch (err) {
      alert('Error during cryptographic setup. Please refresh and try again.');
    }
  };

  // 3. Process stealth unlock trigger
  const handleUnlock = async (isMasterMode: boolean, pinAttempt: string) => {
    try {
      const derived = await deriveKeyFromPin(pinAttempt);
      setCryptoKey(derived);
      setIsMaster(isMasterMode);
      
      await addLog({
        timestamp: Date.now(),
        event: isMasterMode ? 'unlock_success' : 'decoy_unlock',
        details: isMasterMode 
          ? 'Master vault unlocked successfully.' 
          : 'Decoy trap vault initialized. Genuine content quarantined.'
      });

      setIsUnlocked(true);
    } catch (err) {
      // Record failed login attempt logs for intruders!
      await addLog({
        timestamp: Date.now(),
        event: 'failed_attempt',
        details: 'Unauthorized PIN combination entered on calculator screen.'
      });
      alert('Incorrect passcode combination.');
    }
  };

  // 4. Update core vault parameters from settings panel
  const handleUpdateSettings = (updatedSettings: VaultSettings) => {
    localStorage.setItem(SETTINGS_LOCAL_STORAGE_KEY, JSON.stringify(updatedSettings));
    setVaultSettings(updatedSettings);
  };

  // 5. Handle master PIN recovery
  const handleRecoveryResetComplete = async (newMasterPin: string) => {
    if (!vaultSettings) return;

    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(newMasterPin);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const masterPinHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      const updatedSettings: VaultSettings = {
        ...vaultSettings,
        masterPinHash
      };

      localStorage.setItem(SETTINGS_LOCAL_STORAGE_KEY, JSON.stringify(updatedSettings));
      setVaultSettings(updatedSettings);

      await addLog({
        timestamp: Date.now(),
        event: 'pin_changed',
        details: 'Master passcode successfully modified via recovery challenge.'
      });

      setShowForgotPassword(false);
    } catch {
      alert('Failed to reset passcode.');
    }
  };

  // Prevent white flashes on loading settings
  if (hasSetup === null) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-100 font-mono">
        <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mb-4" />
        <span className="text-xs uppercase tracking-widest text-slate-500">Initializing Safe Environment...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 overflow-hidden select-none">
      <AnimatePresence mode="wait">
        
        {/* Onboarding Wizard view */}
        {!hasSetup && (
          <motion.div
            key="setup"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <SecuritySetup onSetupComplete={handleSetupComplete} />
          </motion.div>
        )}

        {/* PIN Recovery view */}
        {hasSetup && showForgotPassword && vaultSettings && (
          <motion.div
            key="forgot"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <ForgotPassword
              securityQuestion={vaultSettings.securityQuestion}
              securityAnswerHash={vaultSettings.securityAnswerHash}
              onResetComplete={handleRecoveryResetComplete}
              onBack={() => setShowForgotPassword(false)}
            />
          </motion.div>
        )}

        {/* Normal Stealth Mode (Calculator) view */}
        {hasSetup && !showForgotPassword && !isUnlocked && vaultSettings && (
          <motion.div
            key="calculator"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Calculator
              masterPinHash={vaultSettings.masterPinHash}
              decoyPinHash={vaultSettings.decoyPinHash}
              onForgotPassword={() => setShowForgotPassword(true)}
              onUnlock={(isMasterMode, pin) => {
                handleUnlock(isMasterMode, pin);
              }}
            />
          </motion.div>
        )}

        {/* Unlocked Private Vault view */}
        {hasSetup && isUnlocked && cryptoKey && vaultSettings && (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.99 }}
            transition={{ duration: 0.3 }}
          >
            <VaultDashboard
              cryptoKey={cryptoKey}
              isMaster={isMaster}
              vaultSettings={vaultSettings}
              onUpdateSettings={handleUpdateSettings}
              onLock={() => {
                setIsUnlocked(false);
                setCryptoKey(null);
              }}
            />
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
