import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { createContext, useCallback, useContext, useState, React } from 'react';

interface Toast {
  id: number;
  message: string;
  type?: 'success' | 'error';
}

interface ToastContextProps {
  showToast: (message: string, type?: 'success' | 'error') => void;
}

const ToastContext = createContext<ToastContextProps>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToasts((prev) => [
      ...prev,
      { id: Date.now() + Math.random(), message, type },
    ]);
    setTimeout(() => {
      setToasts((prev) => prev.slice(1));
    }, 3200);
  }, []);

  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed z-50 left-1/2 top-6 -translate-x-1/2 flex flex-col gap-2 items-center pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.22 }}
              className={`pointer-events-auto flex items-center gap-2 px-4 py-2 rounded-xl shadow-lg text-sm font-medium ${toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}
            >
              <span>{toast.message}</span>
              <button onClick={() => removeToast(toast.id)} className="ml-2 p-1 rounded hover:bg-white/10">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
