import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Lock, Eye, EyeOff } from 'lucide-react';

export default function PasswordInput({ className, ...props }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
      <Input
        {...props}
        type={visible ? 'text' : 'password'}
        className={`pl-10 pr-10 ${className || ''}`}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible(v => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
      >
        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}
