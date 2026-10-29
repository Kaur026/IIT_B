import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Info, AlertCircle, X } from 'lucide-react';

export interface ToastItem {
  id: string;
  title: string;
  message?: string;
  type?: 'success' | 'info' | 'warning' | 'error';
}

interface ToastContextType {
  showToast: (title: string, message?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
  showPlaceholderToast: (featureName?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback(
    (title: string, message?: string, type: 'success' | 'info' | 'warning' | 'error' = 'success') => {
      const id = `${Date.now()}-${Math.random()}`;
      setToasts((prev) => [...prev, { id, title, message, type }]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    },
    []
  );

  const showPlaceholderToast = useCallback(
    (featureName?: string) => {
      showToast(
        'Feature unavailable',
        featureName ? `"${featureName}" is an illustrative link not implemented in this interface.` : undefined,
        'info'
      );
    },
    [showToast]
  );

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast, showPlaceholderToast }}>
      {children}
      {/* Toast Render Stack sliding in from top */}
      <div className="fixed top-20 right-4 sm:right-6 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.96 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-auto bg-[#0F172A] text-white p-4 rounded-2xl shadow-xl border border-white/20 flex items-start gap-3 backdrop-blur-md"
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold ${
                  toast.type === 'error'
                    ? 'bg-rose-100 text-rose-800'
                    : toast.type === 'info'
                    ? 'bg-[#D8E7FA] text-[#0F172A]'
                    : toast.type === 'warning'
                    ? 'bg-[#FEF3C7] text-[#92400E]'
                    : 'bg-[#CFEFD8] text-[#0F172A]'
                }`}
              >
                {toast.type === 'error' ? (
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                ) : toast.type === 'info' ? (
                  <Info className="w-4 h-4" />
                ) : toast.type === 'warning' ? (
                  <AlertCircle className="w-4 h-4" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
              </div>
              <div className="flex-1 text-xs">
                <p className="font-semibold text-slate-100">{toast.title}</p>
                {toast.message && <p className="text-slate-300 mt-0.5 leading-relaxed">{toast.message}</p>}
              </div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="text-slate-400 hover:text-white transition-colors"
                aria-label="Dismiss toast"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
