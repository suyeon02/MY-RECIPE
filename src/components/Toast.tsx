import React, { useEffect } from 'react';

interface ToastProps {
  message: string;
  onClose: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({ message, onClose, duration = 2400 }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [message, onClose, duration]);

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-[#1e1e1e]/95 backdrop-blur text-white px-5 py-3 rounded-full text-sm font-medium shadow-2xl flex items-center gap-2 border border-white/10 animate-fade-in pointer-events-none">
      <span>✨</span>
      <span>{message}</span>
    </div>
  );
};
