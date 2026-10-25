'use client';

import * as React from 'react';

interface TooltipContextType {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLElement>;
  tooltipId: string;
}

const TooltipContext = React.createContext<TooltipContextType | null>(null);

export interface TooltipProviderProps {
  children: React.ReactNode;
  delayDuration?: number;
  skipDelayDuration?: number;
}

export function TooltipProvider({ children }: TooltipProviderProps) {
  return <>{children}</>;
}

export interface TooltipProps {
  children: React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  delayDuration?: number;
}

export function Tooltip({
  children,
  open: controlledOpen,
  onOpenChange,
  delayDuration = 150,
}: TooltipProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLElement>(null);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const tooltipId = React.useId();

  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;

  const setIsOpen = React.useCallback(
    (open: boolean) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      if (open) {
        timeoutRef.current = setTimeout(() => {
          if (!isControlled) {
            setInternalOpen(true);
          }
          onOpenChange?.(true);
        }, delayDuration);
      } else {
        if (!isControlled) {
          setInternalOpen(false);
        }
        onOpenChange?.(false);
      }
    },
    [delayDuration, isControlled, onOpenChange]
  );

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="relative inline-flex items-center">
      <TooltipContext.Provider value={{ isOpen, setIsOpen, triggerRef, tooltipId }}>
        {children}
      </TooltipContext.Provider>
    </div>
  );
}

export interface TooltipTriggerProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
  asChild?: boolean;
}

export const TooltipTrigger = React.forwardRef<HTMLElement, TooltipTriggerProps>(
  ({ children, asChild, className = '', ...props }, ref) => {
    const context = React.useContext(TooltipContext);
    if (!context) {
      throw new Error('TooltipTrigger must be used within a Tooltip');
    }

    const { setIsOpen, tooltipId } = context;

    const handleMouseEnter = (e: React.MouseEvent<any>) => {
      setIsOpen(true);
      (props as any).onMouseEnter?.(e);
    };

    const handleMouseLeave = (e: React.MouseEvent<any>) => {
      setIsOpen(false);
      (props as any).onMouseLeave?.(e);
    };

    const handleFocus = (e: React.FocusEvent<any>) => {
      setIsOpen(true);
      (props as any).onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<any>) => {
      setIsOpen(false);
      (props as any).onBlur?.(e);
    };

    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<any>;
      return React.cloneElement(child, {
        ref,
        'aria-describedby': tooltipId,
        onMouseEnter: (e: React.MouseEvent<any>) => {
          handleMouseEnter(e);
          child.props?.onMouseEnter?.(e);
        },
        onMouseLeave: (e: React.MouseEvent<any>) => {
          handleMouseLeave(e);
          child.props?.onMouseLeave?.(e);
        },
        onFocus: (e: React.FocusEvent<any>) => {
          handleFocus(e);
          child.props?.onFocus?.(e);
        },
        onBlur: (e: React.FocusEvent<any>) => {
          handleBlur(e);
          child.props?.onBlur?.(e);
        },
      });
    }

    return (
      <span
        ref={ref as any}
        aria-describedby={tooltipId}
        className={`inline-flex items-center ${className}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...props}
      >
        {children}
      </span>
    );
  }
);
TooltipTrigger.displayName = 'TooltipTrigger';

export interface TooltipContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
}

export const TooltipContent = React.forwardRef<HTMLDivElement, TooltipContentProps>(
  ({ children, className = '', side = 'top', align = 'center', sideOffset = 8, ...props }, ref) => {
    const context = React.useContext(TooltipContext);
    if (!context) {
      throw new Error('TooltipContent must be used within a Tooltip');
    }

    const { isOpen, tooltipId } = context;

    if (!isOpen) return null;

    let positionClasses = '';

    if (side === 'top') {
      if (align === 'end') {
        positionClasses = 'bottom-full right-0 mb-2';
      } else if (align === 'start') {
        positionClasses = 'bottom-full left-0 mb-2';
      } else {
        positionClasses = 'bottom-full left-1/2 -translate-x-1/2 mb-2';
      }
    } else if (side === 'bottom') {
      if (align === 'end') {
        positionClasses = 'top-full right-0 mt-2';
      } else if (align === 'start') {
        positionClasses = 'top-full left-0 mt-2';
      } else {
        positionClasses = 'top-full left-1/2 -translate-x-1/2 mt-2';
      }
    } else if (side === 'left') {
      positionClasses = 'right-full top-1/2 -translate-y-1/2 mr-2';
    } else if (side === 'right') {
      positionClasses = 'left-full top-1/2 -translate-y-1/2 ml-2';
    }

    return (
      <div
        ref={ref}
        id={tooltipId}
        role="tooltip"
        className={`absolute z-50 pointer-events-none whitespace-normal rounded-xl bg-slate-900/95 border border-slate-700/90 px-3.5 py-2 text-xs font-medium text-slate-200 shadow-2xl backdrop-blur-md animate-in fade-in-0 zoom-in-95 duration-150 ${positionClasses} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);
TooltipContent.displayName = 'TooltipContent';
