import * as React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'destructive' | 'warning' | 'info' | 'success';
}

const alertVariants = {
  default: 'bg-slate-900/90 text-slate-100 border-slate-800 shadow-md',
  destructive: 'border-red-500/40 bg-red-950/40 text-red-200 shadow-md shadow-red-950/20 [&>svg]:text-red-400',
  warning: 'border-amber-500/40 bg-amber-950/30 text-amber-200 shadow-md shadow-amber-950/20 [&>svg]:text-amber-400',
  info: 'border-cyan-500/40 bg-cyan-950/30 text-cyan-200 shadow-md shadow-cyan-950/20 [&>svg]:text-cyan-400',
  success: 'border-emerald-500/40 bg-emerald-950/30 text-emerald-200 shadow-md shadow-emerald-950/20 [&>svg]:text-emerald-400',
};

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = 'default', ...props }, ref) => (
    <div
      ref={ref}
      role="alert"
      className={cn(
        'relative w-full rounded-xl border p-4 backdrop-blur-md transition-all [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-slate-200',
        alertVariants[variant],
        className
      )}
      {...props}
    />
  )
);
Alert.displayName = 'Alert';

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn('mb-1.5 font-bold leading-none tracking-tight text-sm flex items-center gap-2', className)}
    {...props}
  />
));
AlertTitle.displayName = 'AlertTitle';

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('text-xs leading-relaxed text-slate-300 [&_p]:leading-relaxed', className)}
    {...props}
  />
));
AlertDescription.displayName = 'AlertDescription';

export { Alert, AlertTitle, AlertDescription };
