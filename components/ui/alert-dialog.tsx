'use client';

import * as React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface AlertDialogContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const AlertDialogContext = React.createContext<AlertDialogContextType | null>(null);

interface AlertDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export function AlertDialog({
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  children,
}: AlertDialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const handleOpenChange = (newOpen: boolean) => {
    if (!isControlled) {
      setInternalOpen(newOpen);
    }
    controlledOnOpenChange?.(newOpen);
  };

  return (
    <AlertDialogContext.Provider value={{ open, setOpen: handleOpenChange }}>
      {children}
    </AlertDialogContext.Provider>
  );
}

export function AlertDialogTrigger({
  children,
  asChild,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }) {
  const context = React.useContext(AlertDialogContext);
  if (!context) throw new Error('AlertDialogTrigger must be used within AlertDialog');

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      onClick: (e: React.MouseEvent) => {
        (children as any).props?.onClick?.(e);
        context.setOpen(true);
      },
    });
  }

  return (
    <button
      type="button"
      className={className}
      onClick={() => context.setOpen(true)}
      {...props}
    >
      {children}
    </button>
  );
}

export function AlertDialogContent({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const context = React.useContext(AlertDialogContext);
  if (!context) throw new Error('AlertDialogContent must be used within AlertDialog');

  if (!context.open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={() => context.setOpen(false)}
      />

      {/* Modal Dialog */}
      <div
        className={`relative z-50 w-full max-w-lg rounded-2xl bg-slate-950 border border-slate-800 p-6 shadow-2xl shadow-red-500/10 animate-in zoom-in-95 duration-200 ${className}`}
      >
        {children}
      </div>
    </div>
  );
}

export function AlertDialogHeader({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`flex flex-col space-y-2 text-left ${className}`}>{children}</div>;
}

export function AlertDialogTitle({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h3 className={`text-lg font-bold text-white flex items-center gap-2 ${className}`}>
      {children}
    </h3>
  );
}

export function AlertDialogDescription({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`text-sm text-slate-300 leading-relaxed ${className}`}>{children}</div>
  );
}

export function AlertDialogFooter({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 pt-4 mt-4 border-t border-slate-800/80 gap-2 sm:gap-0 ${className}`}
    >
      {children}
    </div>
  );
}

export function AlertDialogCancel({
  children = 'Cancelar',
  className = '',
  onClick,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const context = React.useContext(AlertDialogContext);
  if (!context) throw new Error('AlertDialogCancel must be used within AlertDialog');

  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors ${className}`}
      onClick={(e) => {
        onClick?.(e);
        context.setOpen(false);
      }}
      {...props}
    >
      {children}
    </button>
  );
}

export function AlertDialogAction({
  children,
  className = '',
  onClick,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center px-4 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-500 shadow-md shadow-red-500/20 transition-all ${className}`}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
}
