import React, { useState } from 'react';
import { ActiveView } from '../types';

interface TauriTitlebarProps {
  onMinimize?: () => void;
  onMaximize?: () => void;
  onClose?: () => void;
  onSelectView?: (view: ActiveView) => void;
  contractName?: string;
}

export const TauriTitlebar: React.FC<TauriTitlebarProps> = ({
  onSelectView,
  contractName = 'contract-001.pdf',
}) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  const showDesktopNotice = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 2500);
  };

  return (
    <div className="h-8 bg-[#090d18] border-b border-[#1c2336] flex items-center justify-between px-3 select-none z-50 text-xs text-[#dae2fd]">
      {/* Left: Tauri macOS/Desktop traffic light controls & app badge */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 group">
          <button
            type="button"
            onClick={() => showDesktopNotice('Tauri Window: Close intercepted (Running in background)')}
            className="w-3 h-3 rounded-full bg-[#ef4444]/80 hover:bg-[#ef4444] flex items-center justify-center transition-colors"
            title="Close"
          >
            <span className="opacity-0 group-hover:opacity-100 text-[8px] text-[#450a0a] font-bold">✕</span>
          </button>
          <button
            type="button"
            onClick={() => showDesktopNotice('Tauri Window: Minimized to dock tray')}
            className="w-3 h-3 rounded-full bg-[#f59e0b]/80 hover:bg-[#f59e0b] flex items-center justify-center transition-colors"
            title="Minimize"
          >
            <span className="opacity-0 group-hover:opacity-100 text-[8px] text-[#451a03] font-bold">−</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setIsMaximized(!isMaximized);
              showDesktopNotice(isMaximized ? 'Tauri Window: Restored' : 'Tauri Window: Maximized');
            }}
            className="w-3 h-3 rounded-full bg-[#10b981]/80 hover:bg-[#10b981] flex items-center justify-center transition-colors"
            title="Toggle Fullscreen"
          >
            <span className="opacity-0 group-hover:opacity-100 text-[8px] text-[#064e3b] font-bold">⤢</span>
          </button>
        </div>

        <div className="flex items-center gap-2 pl-2 border-l border-[#222a3d]">
          <span className="font-mono text-[10px] text-[#ffc174] bg-[#222a3d] px-1.5 py-0.5 rounded font-semibold tracking-wider">
            TAURI v2.1
          </span>
          <span className="text-[#a08e7a] text-[11px] font-mono">
            solari-desktop-client
          </span>
        </div>
      </div>

      {/* Center: Active Document / Title */}
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-[14px] text-[#ffc174]">description</span>
        <span className="font-mono text-[11px] text-[#dae2fd] font-medium truncate max-w-[280px]">
          {contractName} — Solari Legal Auditor
        </span>
        <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#171f33] text-[#7bd0ff] font-mono border border-[#334155]/60">
          Sandbox v3.2
        </span>
      </div>

      {/* Right: Quick shortcuts and Tauri System Tray */}
      <div className="flex items-center gap-3">
        {notification && (
          <span className="text-[10px] text-[#38bdf8] animate-fade-in font-mono bg-[#111625] px-2 py-0.5 rounded border border-[#38bdf8]/40">
            {notification}
          </span>
        )}

        <div className="hidden sm:flex items-center gap-2 font-mono text-[10px] text-[#a08e7a]">
          <span className="px-1 py-0.5 bg-[#171f33] rounded border border-[#334155]">⌘R Audit</span>
          <span className="px-1 py-0.5 bg-[#171f33] rounded border border-[#334155]">⌘J JSON</span>
        </div>
        <div className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" title="Tauri IPC Socket: Connected" />
      </div>
    </div>
  );
};
