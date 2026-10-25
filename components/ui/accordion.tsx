'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';

interface AccordionContextType {
  value: string | string[];
  onValueChange: (itemValue: string) => void;
  collapsible?: boolean;
}

const AccordionContext = React.createContext<AccordionContextType | null>(null);

interface AccordionProps {
  type?: 'single' | 'multiple';
  collapsible?: boolean;
  value?: string | string[];
  defaultValue?: string | string[];
  onValueChange?: (value: any) => void;
  children: React.ReactNode;
  className?: string;
}

export function Accordion({
  type = 'single',
  collapsible = true,
  value: controlledValue,
  defaultValue,
  onValueChange: controlledOnValueChange,
  children,
  className = '',
}: AccordionProps) {
  const [internalValue, setInternalValue] = React.useState<string | string[]>(
    defaultValue || (type === 'multiple' ? [] : '')
  );

  const isControlled = controlledValue !== undefined;
  const activeValue = isControlled ? controlledValue : internalValue;

  const handleValueChange = (itemValue: string) => {
    if (type === 'single') {
      const isCurrentlyActive = activeValue === itemValue;
      let nextValue = itemValue;
      if (isCurrentlyActive && collapsible) {
        nextValue = '';
      }
      if (!isControlled) {
        setInternalValue(nextValue);
      }
      controlledOnValueChange?.(nextValue);
    } else {
      const currentList = Array.isArray(activeValue) ? activeValue : [];
      const exists = currentList.includes(itemValue);
      const nextList = exists
        ? currentList.filter((v) => v !== itemValue)
        : [...currentList, itemValue];
      if (!isControlled) {
        setInternalValue(nextList);
      }
      controlledOnValueChange?.(nextList);
    }
  };

  return (
    <AccordionContext.Provider
      value={{
        value: activeValue,
        onValueChange: handleValueChange,
        collapsible,
      }}
    >
      <div className={`space-y-3 ${className}`}>{children}</div>
    </AccordionContext.Provider>
  );
}

interface AccordionItemProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

const AccordionItemContext = React.createContext<{ value: string; isOpen: boolean }>({
  value: '',
  isOpen: false,
});

export function AccordionItem({ value, children, className = '' }: AccordionItemProps) {
  const context = React.useContext(AccordionContext);
  if (!context) {
    throw new Error('AccordionItem must be used within an Accordion');
  }

  const isOpen = Array.isArray(context.value)
    ? context.value.includes(value)
    : context.value === value;

  return (
    <AccordionItemContext.Provider value={{ value, isOpen }}>
      <div
        className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
          isOpen
            ? 'bg-slate-900/90 border-emerald-500/30 shadow-lg shadow-emerald-500/5'
            : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700/80 hover:bg-slate-900/50'
        } ${className}`}
      >
        {children}
      </div>
    </AccordionItemContext.Provider>
  );
}

interface AccordionTriggerProps {
  children: React.ReactNode;
  className?: string;
}

export function AccordionTrigger({ children, className = '' }: AccordionTriggerProps) {
  const itemContext = React.useContext(AccordionItemContext);
  const accordionContext = React.useContext(AccordionContext);

  if (!itemContext || !accordionContext) {
    throw new Error('AccordionTrigger must be used within an AccordionItem');
  }

  const { value, isOpen } = itemContext;
  const { onValueChange } = accordionContext;

  return (
    <button
      type="button"
      onClick={() => onValueChange(value)}
      className={`w-full flex items-center justify-between p-5 text-left font-medium text-slate-100 transition-all ${className}`}
      aria-expanded={isOpen}
    >
      <div className="flex-1 pr-4">{children}</div>
      <div
        className={`w-8 h-8 rounded-xl flex items-center justify-center transition-transform duration-300 flex-shrink-0 ${
          isOpen
            ? 'rotate-180 bg-emerald-500/20 text-emerald-400'
            : 'bg-slate-800/60 text-slate-400'
        }`}
      >
        <ChevronDown className="w-4 h-4" />
      </div>
    </button>
  );
}

interface AccordionContentProps {
  children: React.ReactNode;
  className?: string;
}

export function AccordionContent({ children, className = '' }: AccordionContentProps) {
  const itemContext = React.useContext(AccordionItemContext);

  if (!itemContext) {
    throw new Error('AccordionContent must be used within an AccordionItem');
  }

  const { isOpen } = itemContext;

  if (!isOpen) return null;

  return (
    <div
      className={`px-5 pb-5 pt-1 text-slate-300 text-sm border-t border-slate-800/60 animate-in fade-in-50 duration-200 ${className}`}
    >
      {children}
    </div>
  );
}
