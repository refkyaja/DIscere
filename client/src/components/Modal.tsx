import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
  variant?: 'standard' | 'chalk';
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'md',
  variant = 'chalk',
}: ModalProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthStyles = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
  };

  const isChalk = variant === 'chalk';

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Dialog Modal'}
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity"
      style={{ zIndex: 999999 }}
      onClick={onClose}
    >
      <div
        className={`w-full ${maxWidthStyles[maxWidth]} ${
          isChalk
            ? 'bg-[#fbf6e9] text-[#1d3b2e] rounded-[28px] border-2 border-[#e8dfc8] shadow-[0_10px_0_rgba(0,0,0,0.2),0_20px_30px_rgba(0,0,0,0.3)]'
            : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800'
        } overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-150`}
        style={{ position: 'relative', zIndex: 1000000 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`flex items-center justify-between px-6 py-4 ${
            isChalk
              ? 'border-b-2 border-dashed border-[#e0d5b8]'
              : 'border-b border-slate-100 dark:border-slate-800'
          }`}
        >
          <h2
            className={
              isChalk
                ? 'portal-cv text-2xl sm:text-3xl text-[#1d3b2e]'
                : 'text-xl font-bold text-slate-800 dark:text-slate-100'
            }
          >
            {title || ''}
          </h2>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
              isChalk
                ? 'text-[#6b7d6c] hover:bg-[#e0d5b8] hover:text-[#1d3b2e]'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            aria-label="Tutup Dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>,
    document.body
  );
}
