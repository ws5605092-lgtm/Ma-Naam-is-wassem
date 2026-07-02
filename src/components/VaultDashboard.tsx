import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Image as ImageIcon, Video as VideoIcon, Lock, Unlock, Settings as SettingsIcon, 
  LogOut, Trash2, Download, FolderPlus, Folder, Plus, Search, ShieldCheck, 
  X, AlertTriangle, Calendar, FileText, ChevronLeft, ChevronRight, HardDrive, 
  FolderOpen, Move, Check, HelpCircle
} from 'lucide-react';
import { 
  getFiles, saveFile, deleteFile, getFolders, saveFolder, deleteFolder, 
  moveFile, getLogs, addLog, encryptBuffer, decryptBuffer, clearAllData, hashPin
} from '../utils/vaultDb';
import { VaultFile, VaultFolder, SecurityLog, VaultSettings } from '../types';

interface VaultDashboardProps {
  cryptoKey: CryptoKey;
  isMaster: boolean;
  onLock: () => void;
  vaultSettings: VaultSettings;
  onUpdateSettings: (settings: VaultSettings) => void;
}

export default function VaultDashboard({ cryptoKey, isMaster, onLock, vaultSettings, onUpdateSettings }: VaultDashboardProps) {
  const [activeTab, setActiveTab] = useState<'gallery' | 'folders' | 'logs' | 'settings'>('gallery');
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [folders, setFolders] = useState<VaultFolder[]>([]);
  const [logs, setLogs] = useState<SecurityLog[]>([]);
  
  // Gallery filters & states
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'images' | 'videos'>('all');
  const [selectedFolderId, setSelectedFolderId] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'size-desc' | 'size-asc'>('newest');
  
  // Decrypted URLs Cache to avoid re-decrypting every frame
  const [decryptedUrls, setDecryptedUrls] = useState<Record<string, string>>({});
  const [decryptingIds, setDecryptingIds] = useState<Record<string, boolean>>({});
  
  // Lightbox & Actions
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [newFolderName, setNewFolderName] = useState('');
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [movingFileId, setMovingFileId] = useState<string | null>(null);

  // Settings states
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [decoyPin, setDecoyPin] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [settingsSuccess, setSettingsSuccess] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Load basic records on boot
  useEffect(() => {
    loadData();
    
    // Auto lock timer on mouse idle
    let idleTimeout: NodeJS.Timeout;
    const resetIdle = () => {
      clearTimeout(idleTimeout);
      idleTimeout = setTimeout(() => {
        handleLock();
      }, 180000); // 3 minutes
    };

    window.addEventListener('mousemove', resetIdle);
    window.addEventListener('keypress', resetIdle);
    resetIdle();

    return () => {
      window.removeEventListener('mousemove', resetIdle);
      window.removeEventListener('keypress', resetIdle);
      clearTimeout(idleTimeout);
      
      // Revoke all decrypted blob URLs
      setDecryptedUrls(prev => {
        Object.keys(prev).forEach(key => URL.revokeObjectURL(prev[key]));
        return {};
      });
    };
  }, []);

  const loadData = async () => {
    try {
      const dbFiles = await getFiles();
      // Filter decoy files: Since files are encrypted with different keys,
      // decoy files will fail to decrypt with the master key and vice-versa.
      // We flag files based on their cryptographic success, or filter by isMaster.
      // To prevent decryption crashes on load, let's tag files with their vault scope:
      // When saving, we tag folderId or a custom property, or we just keep files separate.
      // Wait, let's keep things extremely robust: we can filter files by checking if they are
      // decryptable with the current key!
      // To do this elegantly without freezing, let's keep all files in the list, but only render
      // the ones that are for the current session.
      // Let's test decrypting a tiny metadata block or just let files belong to a specific vault scope.
      // Let's check: We can try to decrypt a test file or store a scope tag.
      // To keep it 100% clean, let's store a custom property in the db file, or simply save files with a tag.
      // Since our schema in `types.ts` has `folderId`, let's check: decoy files can just have the 'decoy' prefix or tag,
      // or we can test decrypting them. Let's check!
      // Let's filter files dynamically by trying to decrypt a 1-byte marker, or just add a session tag!
      // Actually, a session tag is incredibly robust and prevents browser Crypto errors from spamming the console.
      // Let's use `folderId` or a prefix, or we can simply verify decryptability.
      // Wait! Since files are in IndexedDB, let's filter them. To make it extremely elegant:
      // Let's filter files by checking if we can successfully decrypt them! If decryptBuffer throws an error,
      // then we know that file belongs to the other vault scope (and should be hidden).
      // This is beautiful because it relies purely on zero-knowledge math! If you have the decoy key,
      // the real files are completely indistinguishable from random noise, and they fail to decrypt,
      // leaving only the decoy files visible. That is true zero-knowledge design!
      
      // Let's test-decrypt files in the background to filter them.
      const filtered: VaultFile[] = [];
      for (const file of dbFiles) {
        try {
          // Attempt to decrypt a tiny slice (or the whole thing) to verify the key is correct.
          // AES-GCM is authenticated, so if the key is wrong, it immediately throws an error on decrypt!
          await decryptBuffer(file.data.slice(0, Math.min(file.data.byteLength, 1024)), cryptoKey, file.iv);
          filtered.push(file);
        } catch {
          // Failed to decrypt -> belongs to the other vault scope (Master vs Decoy). Skip!
        }
      }

      setFiles(filtered);
      
      const dbFolders = await getFolders();
      setFolders(dbFolders);

      const dbLogs = await getLogs();
      setLogs(dbLogs);
    } catch (err) {
      console.error('Error loading vault data:', err);
    }
  };

  // 2. Perform background lazy decryption of thumbnails as they enter view
  const decryptFileToUrl = async (file: VaultFile) => {
    if (decryptedUrls[file.id] || decryptingIds[file.id]) return;

    setDecryptingIds(prev => ({ ...prev, [file.id]: true }));
    try {
      const decryptedData = await decryptBuffer(file.data, cryptoKey, file.iv);
      const blob = new Blob([decryptedData], { type: file.type });
      const url = URL.createObjectURL(blob);
      setDecryptedUrls(prev => ({ ...prev, [file.id]: url }));
    } catch (err) {
      console.error('Failed to decrypt file:', file.name, err);
    } finally {
      setDecryptingIds(prev => ({ ...prev, [file.id]: false }));
    }
  };

  const handleLock = () => {
    // Revoke all memory blobs before exiting
    Object.keys(decryptedUrls).forEach(key => URL.revokeObjectURL(decryptedUrls[key]));
    onLock();
  };

  // 3. File upload and browser encryption pipeline
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    setIsUploading(true);
    setUploadProgress(10);

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        setUploadProgress(Math.round(10 + (i / selectedFiles.length) * 80));

        // Read file contents as ArrayBuffer
        const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as ArrayBuffer);
          reader.onerror = () => reject(reader.error);
          reader.readAsArrayBuffer(file);
        });

        // Encrypt ArrayBuffer
        const { encryptedData, ivHex } = await encryptBuffer(arrayBuffer, cryptoKey);

        const newVaultFile: VaultFile = {
          id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
          name: file.name,
          type: file.type || 'application/octet-stream',
          size: file.size,
          data: encryptedData,
          iv: ivHex,
          addedAt: Date.now(),
          folderId: selectedFolderId === 'all' ? 'root' : selectedFolderId
        };

        await saveFile(newVaultFile);
        await addLog({
          timestamp: Date.now(),
          event: 'unlock_success',
          details: `Encrypted and secured file: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`
        });
      }

      setUploadProgress(100);
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
        loadData();
      }, 500);

    } catch (err) {
      console.error('Upload failed:', err);
      setIsUploading(false);
      alert('Encryption or saving failed. Make sure your browser has storage space.');
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      // Simulate input event
      const fakeEvent = {
        target: { files: droppedFiles }
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      handleFileUpload(fakeEvent);
    }
  };

  // 4. Decrypt and Download back to original state
  const handleDownloadFile = async (file: VaultFile) => {
    try {
      const decryptedData = await decryptBuffer(file.data, cryptoKey, file.iv);
      const blob = new Blob([decryptedData], { type: file.type });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to decrypt and export file.');
    }
  };

  const handleDeleteFile = async (file: VaultFile) => {
    if (window.confirm(`Are you sure you want to permanently delete "${file.name}"? This action cannot be undone.`)) {
      try {
        await deleteFile(file.id);
        
        // Remove from cache
        if (decryptedUrls[file.id]) {
          URL.revokeObjectURL(decryptedUrls[file.id]);
          const newUrls = { ...decryptedUrls };
          delete newUrls[file.id];
          setDecryptedUrls(newUrls);
        }

        // If active in viewer, close it
        if (viewerIndex !== null && filteredFiles[viewerIndex]?.id === file.id) {
          setViewerIndex(null);
        }

        await addLog({
          timestamp: Date.now(),
          event: 'files_deleted',
          details: `Permanently deleted file: ${file.name}`
        });

        loadData();
      } catch {
        alert('Failed to delete file.');
      }
    }
  };

  // 5. Folder management
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      const folder: VaultFolder = {
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
        name: newFolderName.trim(),
        addedAt: Date.now()
      };

      await saveFolder(folder);
      setNewFolderName('');
      setShowFolderModal(false);
      loadData();
    } catch {
      alert('Failed to create folder.');
    }
  };

  const handleDeleteFolder = async (folderId: string, folderName: string) => {
    if (window.confirm(`Are you sure you want to delete the folder "${folderName}"? All files in this folder will be moved to the main directory.`)) {
      try {
        await deleteFolder(folderId);
        if (selectedFolderId === folderId) {
          setSelectedFolderId('all');
        }
        loadData();
      } catch {
        alert('Failed to delete folder.');
      }
    }
  };

  const handleMoveFile = async (fileId: string, destFolderId: string) => {
    try {
      await moveFile(fileId, destFolderId);
      setMovingFileId(null);
      loadData();
    } catch {
      alert('Failed to move file.');
    }
  };

  // 6. Settings Operations
  const handleUpdatePin = async () => {
    if (!newPin || newPin.length < 4 || newPin.length > 8) {
      setSettingsError('New PIN must be between 4 and 8 digits.');
      return;
    }
    if (newPin !== confirmNewPin) {
      setSettingsError('New PIN confirmations do not match.');
      return;
    }

    try {
      const currentHash = await hashPin(oldPin);
      if (currentHash !== vaultSettings.masterPinHash) {
        setSettingsError('Current Master PIN is incorrect.');
        return;
      }

      const newHash = await hashPin(newPin);
      const updatedSettings = {
        ...vaultSettings,
        masterPinHash: newHash
      };

      onUpdateSettings(updatedSettings);
      setOldPin('');
      setNewPin('');
      setConfirmNewPin('');
      setSettingsError('');
      setSettingsSuccess('Master PIN successfully updated! Use your new PIN next time.');
    } catch {
      setSettingsError('Error updating PIN.');
    }
  };

  const handleUpdateDecoyPin = async () => {
    if (decoyPin) {
      if (decoyPin.length < 4 || decoyPin.length > 8) {
        setSettingsError('Decoy PIN must be between 4 and 8 digits.');
        return;
      }
      const masterCheck = await hashPin(decoyPin);
      if (masterCheck === vaultSettings.masterPinHash) {
        setSettingsError('Decoy PIN cannot be identical to Master PIN.');
        return;
      }
    }

    try {
      const decoyHash = decoyPin ? await hashPin(decoyPin) : '';
      const updatedSettings = {
        ...vaultSettings,
        decoyPinHash: decoyHash
      };

      onUpdateSettings(updatedSettings);
      setSettingsError('');
      setSettingsSuccess(decoyPin ? 'Decoy PIN configured successfully!' : 'Decoy PIN removed successfully.');
    } catch {
      setSettingsError('Error configuring Decoy PIN.');
    }
  };

  const handleUpdateSecurityQuestion = async () => {
    if (!securityAnswer.trim()) {
      setSettingsError('Please provide a secure answer.');
      return;
    }

    try {
      const answerHash = await hashPin(securityAnswer.trim().toLowerCase());
      const updatedSettings = {
        ...vaultSettings,
        securityAnswerHash: answerHash
      };

      onUpdateSettings(updatedSettings);
      setSecurityAnswer('');
      setSettingsError('');
      setSettingsSuccess('Security question recovery answer updated!');
    } catch {
      setSettingsError('Error updating security question.');
    }
  };

  const handleFactoryReset = async () => {
    if (window.confirm('CRITICAL WARNING: This will permanently delete ALL encrypted files, folders, and settings from this browser database. Files are unrecoverable. Type "OK" to proceed.')) {
      const verification = window.prompt('Type "DELETE" to confirm complete database wipe:');
      if (verification === 'DELETE') {
        await clearAllData();
        alert('All data has been fully wiped. The app will now reload.');
        window.location.reload();
      }
    }
  };

  // Filtering & Sorting pipeline
  const filteredFiles = files
    .filter(f => {
      // Search
      const matchesSearch = f.name.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Type
      const isImage = f.type.startsWith('image/');
      const isVideo = f.type.startsWith('video/');
      const matchesType = 
        typeFilter === 'all' || 
        (typeFilter === 'images' && isImage) || 
        (typeFilter === 'videos' && isVideo);
      
      // Folder
      const matchesFolder = 
        selectedFolderId === 'all' || 
        (selectedFolderId === 'root' && (!f.folderId || f.folderId === 'root')) ||
        f.folderId === selectedFolderId;

      return matchesSearch && matchesType && matchesFolder;
    })
    .sort((a, b) => {
      if (sortBy === 'newest') return b.addedAt - a.addedAt;
      if (sortBy === 'oldest') return a.addedAt - b.addedAt;
      if (sortBy === 'size-desc') return b.size - a.size;
      if (sortBy === 'size-asc') return a.size - b.size;
      return 0;
    });

  // Space calculation
  const totalBytesUsed = files.reduce((acc, f) => acc + f.size, 0);
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      
      {/* 1. SECURE COMPACT SIDEBAR */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between z-10">
        <div>
          {/* Logo Brand Panel */}
          <div className="p-6 border-b border-slate-800/60 flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${isMaster ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-white uppercase">Secured Vault</h1>
              <p className="text-[10px] text-slate-500 font-mono tracking-wider">
                {isMaster ? 'MASTER MODE' : 'DECOY INTERFACE'}
              </p>
            </div>
          </div>

          {/* Nav Links */}
          <nav className="p-4 space-y-1">
            <button
              onClick={() => setActiveTab('gallery')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                activeTab === 'gallery' 
                  ? 'bg-slate-800 text-white border border-slate-700/50' 
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/40'
              }`}
            >
              <ImageIcon className="w-4 h-4 text-emerald-400" />
              <span>Media Library</span>
              <span className="ml-auto text-xs font-mono text-slate-500 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                {files.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('folders')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                activeTab === 'folders' 
                  ? 'bg-slate-800 text-white border border-slate-700/50' 
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/40'
              }`}
            >
              <Folder className="w-4 h-4 text-sky-400" />
              <span>Folders</span>
              <span className="ml-auto text-xs font-mono text-slate-500 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                {folders.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('logs')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                activeTab === 'logs' 
                  ? 'bg-slate-800 text-white border border-slate-700/50' 
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/40'
              }`}
            >
              <FileText className="w-4 h-4 text-purple-400" />
              <span>Security Logs</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                activeTab === 'settings' 
                  ? 'bg-slate-800 text-white border border-slate-700/50' 
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/40'
              }`}
            >
              <SettingsIcon className="w-4 h-4 text-slate-400" />
              <span>Vault Settings</span>
            </button>
          </nav>
        </div>

        {/* Bottom Utility controls */}
        <div className="p-4 border-t border-slate-800/60 space-y-3">
          {/* Quick Stats */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center gap-3">
            <HardDrive className="w-4 h-4 text-slate-500 flex-shrink-0" />
            <div className="overflow-hidden">
              <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Vault Storage</div>
              <div className="text-xs font-semibold text-slate-300 truncate">{formatBytes(totalBytesUsed)}</div>
            </div>
          </div>

          <button
            onClick={handleLock}
            className="w-full flex items-center justify-center space-x-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 hover:border-rose-500/30 font-medium py-2.5 px-4 rounded-xl text-xs cursor-pointer transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span>Panic Lock</span>
          </button>
        </div>
      </aside>

      {/* 2. PRIMARY CONTENT HUB */}
      <main className="flex-1 flex flex-col overflow-hidden bg-slate-950">
        
        {/* Top Header Controls bar */}
        <header className="h-16 border-b border-slate-800 flex items-center justify-between px-8 bg-slate-900/40 backdrop-blur-sm z-10">
          <div className="flex items-center space-x-4">
            <h2 className="text-lg font-bold text-white capitalize">
              {activeTab === 'gallery' ? 'Encrypted Media Library' : 
               activeTab === 'folders' ? 'Directories & Organization' : 
               activeTab === 'logs' ? 'Secured System Log' : 'Vault Parameters'}
            </h2>
            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 px-2.5 py-1 rounded-full text-[10px] font-mono font-medium text-emerald-400 shadow-inner">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>AES-GCM 256-BIT</span>
            </div>
          </div>

          {/* Action trigger for quick uploads in gallery view */}
          {activeTab === 'gallery' && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowFolderModal(true)}
                className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-semibold px-4 py-2 rounded-xl transition-all cursor-pointer"
              >
                <FolderPlus className="w-4 h-4 text-sky-400" />
                <span>New Folder</span>
              </button>
              <button
                onClick={triggerFileSelect}
                className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-lg shadow-emerald-500/10 cursor-pointer transition-all active:scale-[0.98]"
              >
                <Plus className="w-4 h-4" />
                <span>Secure Files</span>
              </button>
            </div>
          )}
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            multiple 
            accept="image/*,video/*" 
            className="hidden" 
          />
        </header>

        {/* Tab-driven Content Renderer */}
        <div className="flex-1 overflow-y-auto p-8 relative">

          {/* UPLOAD STATUS PANEL Overlay */}
          {isUploading && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute top-4 right-4 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-2xl z-20 flex flex-col gap-3 min-w-[280px]"
            >
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-emerald-400 animate-pulse">Encrypting & Storing...</span>
                <span className="font-mono text-slate-400">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                <div 
                  className="bg-emerald-500 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </motion.div>
          )}

          {/* A: GALLERY TAB */}
          {activeTab === 'gallery' && (
            <div className="space-y-6">
              
              {/* Filter controls row */}
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-900/30 p-4 border border-slate-800/60 rounded-2xl">
                
                {/* Search / Text filter */}
                <div className="relative w-full md:w-72">
                  <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search secure items..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs focus:outline-none focus:border-emerald-500 text-slate-100 transition-colors"
                  />
                </div>

                {/* Left controls: Category selectors */}
                <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 p-1 rounded-xl w-full md:w-auto overflow-x-auto">
                  <button
                    onClick={() => setTypeFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                      typeFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All Media
                  </button>
                  <button
                    onClick={() => setTypeFilter('images')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                      typeFilter === 'images' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Photos
                  </button>
                  <button
                    onClick={() => setTypeFilter('videos')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                      typeFilter === 'videos' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Videos
                  </button>
                </div>

                {/* Middle controls: Folder sorting */}
                <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                  <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 p-1 rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-slate-500 px-2">Folder:</span>
                    <select
                      value={selectedFolderId}
                      onChange={(e) => setSelectedFolderId(e.target.value)}
                      className="bg-transparent text-xs text-slate-300 focus:outline-none pr-4 font-medium"
                    >
                      <option value="all" className="bg-slate-900">All</option>
                      <option value="root" className="bg-slate-900">Uncategorized</option>
                      {folders.map(f => (
                        <option key={f.id} value={f.id} className="bg-slate-900">{f.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 p-1 rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-slate-500 px-2">Sort:</span>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="bg-transparent text-xs text-slate-300 focus:outline-none pr-4 font-medium"
                    >
                      <option value="newest" className="bg-slate-900">Newest</option>
                      <option value="oldest" className="bg-slate-900">Oldest</option>
                      <option value="size-desc" className="bg-slate-900">Size (Largest)</option>
                      <option value="size-asc" className="bg-slate-900">Size (Smallest)</option>
                    </select>
                  </div>
                </div>

              </div>

              {/* Secure drag and drop zone */}
              {files.length === 0 && (
                <div
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  className="border-2 border-dashed border-slate-800 hover:border-emerald-500/50 bg-slate-900/10 hover:bg-emerald-500/[0.01] rounded-3xl p-16 text-center transition-all cursor-pointer flex flex-col items-center gap-4"
                  onClick={triggerFileSelect}
                >
                  <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-full text-emerald-400">
                    <Unlock className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-md font-bold text-white mb-1">Your vault is completely empty</h3>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                      Drag and drop files here, or click to browse. Files will be converted to cryptographic buffers and secured completely in your browser sandboxed database.
                    </p>
                  </div>
                </div>
              )}

              {/* Secure Media Grid */}
              {files.length > 0 && (
                <div>
                  {filteredFiles.length === 0 ? (
                    <div className="text-center py-16 text-slate-500 text-sm">
                      No files match your current filters.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                      {filteredFiles.map((file, idx) => {
                        // Dynamically request decryption for thumbnail if not already done
                        decryptFileToUrl(file);

                        const isImage = file.type.startsWith('image/');
                        const isVideo = file.type.startsWith('video/');
                        const url = decryptedUrls[file.id];

                        return (
                          <motion.div
                            key={file.id}
                            layout
                            whileHover={{ y: -4 }}
                            className="group relative bg-slate-900 border border-slate-800/80 rounded-2xl overflow-hidden aspect-square flex flex-col cursor-pointer shadow-lg"
                            onClick={() => setViewerIndex(idx)}
                          >
                            {/* Rendering dynamic media decrypted image */}
                            <div className="flex-1 w-full bg-slate-950 flex items-center justify-center relative overflow-hidden">
                              {url ? (
                                isImage ? (
                                  <img 
                                    src={url} 
                                    alt={file.name} 
                                    referrerPolicy="no-referrer"
                                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                  />
                                ) : (
                                  <div className="relative w-full h-full">
                                    <video src={url} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
                                      <div className="p-2.5 bg-emerald-500/90 rounded-full text-white shadow-lg">
                                        <VideoIcon className="w-5 h-5 fill-white" />
                                      </div>
                                    </div>
                                  </div>
                                )
                              ) : (
                                <div className="animate-pulse flex flex-col items-center justify-center gap-2">
                                  <div className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-600">
                                    {isImage ? <ImageIcon className="w-5 h-5" /> : <VideoIcon className="w-5 h-5" />}
                                  </div>
                                  <span className="text-[9px] text-slate-500 tracking-wider uppercase">Decrypting...</span>
                                </div>
                              )}

                              {/* Corner Media Indicator Badge */}
                              <div className="absolute top-2.5 right-2.5 px-2 py-0.5 bg-slate-900/85 backdrop-blur-sm border border-slate-800 text-[9px] font-mono rounded text-slate-400 group-hover:text-emerald-400 group-hover:border-emerald-500/30 transition-colors">
                                {isImage ? 'IMG' : 'VID'}
                              </div>
                            </div>

                            {/* Label Footer */}
                            <div className="p-3 bg-slate-900/80 border-t border-slate-800/60 flex flex-col gap-0.5">
                              <span className="text-xs font-medium text-slate-200 truncate w-full group-hover:text-white transition-colors">
                                {file.name}
                              </span>
                              <span className="text-[10px] font-mono text-slate-500">
                                {(file.size / 1024).toFixed(0)} KB
                              </span>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

            </div>
          )}

          {/* B: FOLDERS TAB */}
          {activeTab === 'folders' && (
            <div className="space-y-6">
              
              <div className="flex justify-between items-center bg-slate-900/20 p-4 border border-slate-800 rounded-2xl">
                <div>
                  <h3 className="text-sm font-semibold text-white">Create folders to organize hidden media</h3>
                  <p className="text-xs text-slate-400 mt-1">Files in folders remain AES-encrypted. Deleting a folder moves its items to the main library.</p>
                </div>
                <button
                  onClick={() => setShowFolderModal(true)}
                  className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-semibold px-4 py-2 rounded-xl cursor-pointer"
                >
                  <FolderPlus className="w-4 h-4" />
                  <span>Create Folder</span>
                </button>
              </div>

              {folders.length === 0 ? (
                <div className="text-center py-16 text-slate-600 text-sm">
                  You haven't created any custom directories yet. Use the button above to categorize your items.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  
                  {/* Default / Root directory */}
                  <div
                    onClick={() => {
                      setSelectedFolderId('root');
                      setActiveTab('gallery');
                    }}
                    className="p-5 bg-slate-900/50 border border-slate-800 hover:border-slate-700 rounded-2xl flex items-center justify-between cursor-pointer transition-all hover:-translate-y-0.5"
                  >
                    <div className="flex items-center space-x-3.5">
                      <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-400">
                        <FolderOpen className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-white text-sm">Uncategorized</h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {files.filter(f => !f.folderId || f.folderId === 'root').length} items
                        </p>
                      </div>
                    </div>
                  </div>

                  {folders.map(folder => {
                    const count = files.filter(f => f.folderId === folder.id).length;
                    return (
                      <div
                        key={folder.id}
                        className="group relative p-5 bg-slate-900/50 border border-slate-800 hover:border-slate-700 rounded-2xl flex flex-col justify-between cursor-pointer transition-all hover:-translate-y-0.5"
                        onClick={() => {
                          setSelectedFolderId(folder.id);
                          setActiveTab('gallery');
                        }}
                      >
                        <div className="flex items-center space-x-3.5 mb-4">
                          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-sky-400 group-hover:text-emerald-400 transition-colors">
                            <Folder className="w-6 h-6" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-white text-sm group-hover:text-emerald-400 transition-colors">{folder.name}</h4>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {count} items
                            </p>
                          </div>
                        </div>

                        {/* Delete button (stop propagation so it doesn't open folder) */}
                        <div className="flex justify-end pt-2 border-t border-slate-850">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteFolder(folder.id, folder.name);
                            }}
                            className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg text-xs cursor-pointer transition-colors"
                            title="Delete Folder"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          )}

          {/* C: SECURITY LOGS TAB */}
          {activeTab === 'logs' && (
            <div className="space-y-6">
              
              <div className="flex justify-between items-center bg-slate-900/30 p-4 border border-slate-800 rounded-2xl">
                <div>
                  <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-purple-400" /> Intruder Detection & Activity Timeline
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">This log tracks lock access attempts. Events are kept purely local in your browser and are never uploaded.</p>
                </div>
              </div>

              <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl overflow-hidden shadow-xl">
                {logs.length === 0 ? (
                  <div className="text-center py-16 text-slate-600 text-sm">No security logs recorded yet.</div>
                ) : (
                  <div className="divide-y divide-slate-850">
                    {logs.map(log => (
                      <div key={log.id} className="p-4 flex items-start gap-4 hover:bg-slate-900/20 transition-colors">
                        <div className={`p-2 rounded-lg mt-0.5 ${
                          log.event === 'unlock_success' ? 'bg-emerald-500/10 text-emerald-400' :
                          log.event === 'decoy_unlock' ? 'bg-amber-500/10 text-amber-400' :
                          'bg-rose-500/10 text-rose-400'
                        }`}>
                          <Lock className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-xs font-semibold text-white">
                              {log.event === 'unlock_success' ? 'Master Vault Accessed' :
                               log.event === 'decoy_unlock' ? 'Decoy Vault Triggered' :
                               log.event === 'failed_attempt' ? 'Failed Unlock Attempt' : 
                               log.event === 'files_deleted' ? 'Secured Items Erased' : 'Security Log Entry'}
                            </span>
                            <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(log.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                            {log.details}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* D: SETTINGS TAB */}
          {activeTab === 'settings' && (
            <div className="space-y-6 max-w-2xl">
              
              {settingsSuccess && (
                <div className="p-4 bg-emerald-500/15 border border-emerald-500/20 text-emerald-300 rounded-xl text-xs flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>{settingsSuccess}</span>
                </div>
              )}

              {settingsError && (
                <div className="p-4 bg-rose-500/15 border border-rose-500/20 text-rose-300 rounded-xl text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <span>{settingsError}</span>
                </div>
              )}

              {/* Box 1: Change Master PIN */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-emerald-400" /> Change Master Vault PIN
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Provide your current PIN to authenticate, then set your new master vault access passcode.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="password"
                    inputMode="numeric"
                    placeholder="Current PIN"
                    value={oldPin}
                    onChange={(e) => {
                      setOldPin(e.target.value.replace(/\D/g, ''));
                      setSettingsError('');
                      setSettingsSuccess('');
                    }}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-center font-mono focus:outline-none focus:border-emerald-500"
                  />
                  <input
                    type="password"
                    inputMode="numeric"
                    placeholder="New PIN (4-8 digits)"
                    value={newPin}
                    onChange={(e) => {
                      setNewPin(e.target.value.replace(/\D/g, ''));
                      setSettingsError('');
                      setSettingsSuccess('');
                    }}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-center font-mono focus:outline-none focus:border-emerald-500"
                  />
                  <input
                    type="password"
                    inputMode="numeric"
                    placeholder="Confirm New PIN"
                    value={confirmNewPin}
                    onChange={(e) => {
                      setConfirmNewPin(e.target.value.replace(/\D/g, ''));
                      setSettingsError('');
                      setSettingsSuccess('');
                    }}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-center font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <button
                  onClick={handleUpdatePin}
                  className="bg-slate-850 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700/50 text-xs font-semibold px-4 py-2 rounded-xl transition-all cursor-pointer"
                >
                  Update Master PIN
                </button>
              </div>

              {/* Box 2: Change Decoy PIN */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-500" /> Configure Decoy Trap PIN
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Type a separate trap PIN below. Entering this PIN on the calculator display will open a completely clean decoy dashboard structure, shielding your real encrypted content from observers.
                </p>
                <div className="flex gap-3">
                  <input
                    type="password"
                    inputMode="numeric"
                    placeholder="Decoy PIN (leave blank to delete)"
                    value={decoyPin}
                    onChange={(e) => {
                      setDecoyPin(e.target.value.replace(/\D/g, ''));
                      setSettingsError('');
                      setSettingsSuccess('');
                    }}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-center font-mono focus:outline-none focus:border-amber-500 max-w-xs"
                  />
                  <button
                    onClick={handleUpdateDecoyPin}
                    className="bg-slate-850 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700/50 text-xs font-semibold px-4 py-2 rounded-xl transition-all cursor-pointer"
                  >
                    Save Decoy Configuration
                  </button>
                </div>
              </div>

              {/* Box 3: Update Security Recovery */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-sky-400" /> Update Security Answer
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Question: <strong className="text-slate-200">{vaultSettings.securityQuestion}</strong>. Change your security answer hash in case you are concerned about security.
                </p>
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="New answer (not case-sensitive)"
                    value={securityAnswer}
                    onChange={(e) => {
                      setSecurityAnswer(e.target.value);
                      setSettingsError('');
                      setSettingsSuccess('');
                    }}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-sky-500 max-w-xs"
                  />
                  <button
                    onClick={handleUpdateSecurityQuestion}
                    className="bg-slate-850 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700/50 text-xs font-semibold px-4 py-2 rounded-xl transition-all cursor-pointer"
                  >
                    Save Security Answer
                  </button>
                </div>
              </div>

              {/* Box 4: Factory Wipe */}
              <div className="bg-rose-950/10 border border-rose-900/40 rounded-2xl p-6 space-y-4">
                <h3 className="text-sm font-bold text-rose-300 flex items-center gap-1.5">
                  <Trash2 className="w-4 h-4 text-rose-400" /> Permanent Database Factory Wipe
                </h3>
                <p className="text-xs text-rose-400/80 leading-relaxed">
                  This action is irreversible. All files are encrypted using cryptographic salt inside this local browser container database. Performing a factory reset permanently deletes everything, clearing browser storage.
                </p>
                <button
                  onClick={handleFactoryReset}
                  className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all cursor-pointer shadow-md shadow-rose-500/10 active:scale-[0.98]"
                >
                  Wipe Vault Completely
                </button>
              </div>

            </div>
          )}

        </div>
      </main>

      {/* 3. NEW FOLDER CREATION MODAL */}
      <AnimatePresence>
        {showFolderModal && (
          <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative"
            >
              <button
                onClick={() => setShowFolderModal(false)}
                className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className="text-md font-bold text-white mb-2 flex items-center gap-1.5">
                <FolderPlus className="w-5 h-5 text-emerald-400" /> Create Directory
              </h3>
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                Add a new private category folder. You can drag or move encrypted files inside to organize your vault.
              </p>

              <input
                type="text"
                placeholder="Enter folder name (e.g. Trips)"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 mb-4"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateFolder();
                }}
              />

              <div className="flex gap-2">
                <button
                  onClick={() => setShowFolderModal(false)}
                  className="w-1/3 bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-400 hover:text-white rounded-xl text-xs py-2.5 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateFolder}
                  className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold rounded-xl text-xs py-2.5 transition-all cursor-pointer"
                >
                  Create Folder
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 4. IMMERSIVE MEDIA VIEWER / DECRYPTION LIGHTBOX */}
      <AnimatePresence>
        {viewerIndex !== null && filteredFiles[viewerIndex] && (
          (() => {
            const file = filteredFiles[viewerIndex];
            const isImage = file.type.startsWith('image/');
            const isVideo = file.type.startsWith('video/');
            const decryptedUrl = decryptedUrls[file.id];

            return (
              <div className="fixed inset-0 bg-slate-950/95 flex flex-col z-50 font-sans">
                
                {/* Lightbox Header Bar */}
                <div className="h-16 bg-slate-900 border-b border-slate-800/80 flex items-center justify-between px-6">
                  <div className="min-w-0 flex items-center space-x-3">
                    <div className="p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-400">
                      {isImage ? <ImageIcon className="w-5 h-5" /> : <VideoIcon className="w-5 h-5" />}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-white truncate max-w-md">{file.name}</h3>
                      <p className="text-[10px] font-mono text-slate-500 mt-0.5">
                        {formatBytes(file.size)} • {file.type} • Secured {new Date(file.addedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {/* Actions & Exit */}
                  <div className="flex items-center space-x-2">
                    {/* Move to Folder picker */}
                    <div className="relative">
                      <button
                        onClick={() => setMovingFileId(movingFileId === file.id ? null : file.id)}
                        className="p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-300 hover:text-white text-xs flex items-center gap-1 cursor-pointer transition-colors"
                        title="Move directory"
                      >
                        <Move className="w-4 h-4 text-sky-400" />
                        <span className="hidden md:inline">Move</span>
                      </button>

                      {/* Folder migration Dropdown drawer */}
                      {movingFileId === file.id && (
                        <div className="absolute right-0 mt-2 bg-slate-900 border border-slate-800 rounded-xl p-2 w-48 shadow-2xl flex flex-col gap-1 z-50">
                          <span className="text-[9px] font-bold text-slate-500 uppercase px-2 py-1 select-none">Move to:</span>
                          <button
                            onClick={() => handleMoveFile(file.id, 'root')}
                            className="w-full text-left text-xs px-2 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 flex justify-between cursor-pointer"
                          >
                            <span>Uncategorized</span>
                            {(!file.folderId || file.folderId === 'root') && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                          </button>
                          {folders.map(f => (
                            <button
                              key={f.id}
                              onClick={() => handleMoveFile(file.id, f.id)}
                              className="w-full text-left text-xs px-2 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 flex justify-between cursor-pointer"
                            >
                              <span className="truncate">{f.name}</span>
                              {file.folderId === f.id && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => handleDownloadFile(file)}
                      className="p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-300 hover:text-white text-xs flex items-center gap-1 cursor-pointer transition-all"
                      title="Decrypt & Export"
                    >
                      <Download className="w-4 h-4 text-emerald-400" />
                      <span className="hidden md:inline">Decrypt</span>
                    </button>

                    <button
                      onClick={() => handleDeleteFile(file)}
                      className="p-2.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl text-rose-400 hover:text-rose-300 text-xs flex items-center gap-1 cursor-pointer transition-colors"
                      title="Secure delete"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span className="hidden md:inline">Delete</span>
                    </button>

                    <button
                      onClick={() => {
                        setViewerIndex(null);
                        setMovingFileId(null);
                      }}
                      className="p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-400 hover:text-white cursor-pointer transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Main viewport canvas */}
                <div className="flex-1 flex items-center justify-between p-4 relative">
                  
                  {/* Previous Item button */}
                  <button
                    onClick={() => {
                      if (viewerIndex > 0) setViewerIndex(viewerIndex - 1);
                    }}
                    disabled={viewerIndex === 0}
                    className="p-4 bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 rounded-full text-white cursor-pointer disabled:opacity-30 disabled:pointer-events-none transition-all z-10"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>

                  {/* Render decrypted file */}
                  <div className="flex-1 flex items-center justify-center max-w-4xl mx-auto h-full p-6 relative">
                    {decryptedUrl ? (
                      isImage ? (
                        <motion.img
                          initial={{ scale: 0.98, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          src={decryptedUrl}
                          alt={file.name}
                          referrerPolicy="no-referrer"
                          className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                        />
                      ) : isVideo ? (
                        <motion.video
                          initial={{ scale: 0.98, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          src={decryptedUrl}
                          controls
                          autoPlay
                          className="max-w-full max-h-full rounded-lg shadow-2xl bg-black"
                        />
                      ) : (
                        <div className="text-center p-8 bg-slate-900 border border-slate-800 rounded-2xl max-w-xs">
                          <FileText className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                          <h4 className="font-semibold text-white mb-2">Unsupported Type</h4>
                          <p className="text-xs text-slate-400 mb-4">This file type ({file.type}) cannot be previewed natively in the lightbox.</p>
                          <button
                            onClick={() => handleDownloadFile(file)}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 py-2 rounded-xl"
                          >
                            Decrypt & Export to Disk
                          </button>
                        </div>
                      )
                    ) : (
                      <div className="text-center animate-pulse">
                        <div className="p-4 bg-slate-900 rounded-2xl inline-block text-slate-400 border border-slate-800 mb-3">
                          <Lock className="w-8 h-8 animate-pulse text-emerald-400" />
                        </div>
                        <p className="text-xs text-slate-400 uppercase tracking-widest font-mono">Decrypting payload in-memory...</p>
                      </div>
                    )}
                  </div>

                  {/* Next Item button */}
                  <button
                    onClick={() => {
                      if (viewerIndex < filteredFiles.length - 1) setViewerIndex(viewerIndex + 1);
                    }}
                    disabled={viewerIndex === filteredFiles.length - 1}
                    className="p-4 bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 rounded-full text-white cursor-pointer disabled:opacity-30 disabled:pointer-events-none transition-all z-10"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>

                </div>

              </div>
            );
          })()
        )}
      </AnimatePresence>

    </div>
  );
}
