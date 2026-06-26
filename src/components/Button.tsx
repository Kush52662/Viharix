import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: "sm" | "md" | "lg";
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  active?: boolean;
}

// 1. PrimaryButton (AirBnb Red/Rausch)
export const PrimaryButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, size = "md", startIcon, endIcon, className = "", ...props }, ref) => {
    const sizeClasses = {
      sm: "text-xs px-3 py-1.5 gap-1.5 rounded-lg",
      md: "text-sm px-4.5 py-2.5 gap-2 rounded-xl",
      lg: "text-base px-6 py-3.5 gap-2.5 rounded-xl",
    };

    return (
      <button
        ref={ref}
        type="button"
        className={`inline-flex items-center justify-center font-semibold text-white bg-[#ff385c] hover:bg-[#e00b41] active:scale-98 transition-all duration-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#ff385c]/40 disabled:opacity-50 disabled:pointer-events-none ${sizeClasses[size]} ${className}`}
        {...props}
      >
        {startIcon && <span className="flex-shrink-0">{startIcon}</span>}
        {children}
        {endIcon && <span className="flex-shrink-0">{endIcon}</span>}
      </button>
    );
  }
);
PrimaryButton.displayName = "PrimaryButton";

// 2. SecondaryButton (AirBnb Teal)
export const SecondaryButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, size = "md", startIcon, endIcon, className = "", ...props }, ref) => {
    const sizeClasses = {
      sm: "text-xs px-3 py-1.5 gap-1.5 rounded-lg",
      md: "text-sm px-4.5 py-2.5 gap-2 rounded-xl",
      lg: "text-base px-6 py-3.5 gap-2.5 rounded-xl",
    };

    return (
      <button
        ref={ref}
        type="button"
        className={`inline-flex items-center justify-center font-semibold text-white bg-[#008489] hover:bg-[#006f73] active:scale-98 transition-all duration-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#008489]/40 disabled:opacity-50 disabled:pointer-events-none ${sizeClasses[size]} ${className}`}
        {...props}
      >
        {startIcon && <span className="flex-shrink-0">{startIcon}</span>}
        {children}
        {endIcon && <span className="flex-shrink-0">{endIcon}</span>}
      </button>
    );
  }
);
SecondaryButton.displayName = "SecondaryButton";

// 3. PillButton (Neutral highly rounded light pill)
export const PillButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, size = "md", startIcon, endIcon, className = "", ...props }, ref) => {
    const sizeClasses = {
      sm: "text-xs px-3.5 py-1.5 gap-1 rounded-full",
      md: "text-sm px-5 py-2.5 gap-1.5 rounded-full",
      lg: "text-base px-7 py-3 gap-2 rounded-full",
    };

    return (
      <button
        ref={ref}
        type="button"
        className={`inline-flex items-center justify-center font-semibold text-[#222222] bg-[#f7f7f7] hover:bg-[#ebebeb] border border-[#e4e4e4] active:scale-98 transition-all duration-200 shadow-xs focus:outline-none focus:ring-2 focus:ring-neutral-200 disabled:opacity-50 disabled:pointer-events-none ${sizeClasses[size]} ${className}`}
        {...props}
      >
        {startIcon && <span className="flex-shrink-0">{startIcon}</span>}
        {children}
        {endIcon && <span className="flex-shrink-0">{endIcon}</span>}
      </button>
    );
  }
);
PillButton.displayName = "PillButton";

// 4. IconCircleButton (Circular layout for pure icon buttons)
export const IconCircleButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, size = "md", className = "", ...props }, ref) => {
    const sizeClasses = {
      sm: "w-8 h-8 p-1.5 text-xs",
      md: "w-10 h-10 p-2 text-sm",
      lg: "w-12 h-12 p-3 text-base",
    };

    return (
      <button
        ref={ref}
        type="button"
        className={`inline-flex items-center justify-center rounded-full border border-neutral-200 bg-white hover:bg-neutral-50 active:scale-95 transition-all duration-200 text-neutral-700 hover:text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-200 disabled:opacity-50 disabled:pointer-events-none shadow-xs ${sizeClasses[size]} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);
IconCircleButton.displayName = "IconCircleButton";

// 5. DestructiveButton (Red accent warning/delete)
export const DestructiveButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, size = "md", startIcon, endIcon, className = "", ...props }, ref) => {
    const sizeClasses = {
      sm: "text-xs px-3 py-1.5 gap-1.5 rounded-lg",
      md: "text-sm px-4.5 py-2.5 gap-2 rounded-xl",
      lg: "text-base px-6 py-3.5 gap-2.5 rounded-xl",
    };

    return (
      <button
        ref={ref}
        type="button"
        className={`inline-flex items-center justify-center font-semibold text-white bg-rose-600 hover:bg-rose-700 active:scale-98 transition-all duration-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-rose-500/40 disabled:opacity-50 disabled:pointer-events-none ${sizeClasses[size]} ${className}`}
        {...props}
      >
        {startIcon && <span className="flex-shrink-0">{startIcon}</span>}
        {children}
        {endIcon && <span className="flex-shrink-0">{endIcon}</span>}
      </button>
    );
  }
);
DestructiveButton.displayName = "DestructiveButton";

// 6. SegmentButton (Filters / tabs switcher)
export const SegmentButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, size = "md", startIcon, endIcon, active = false, className = "", ...props }, ref) => {
    const sizeClasses = {
      sm: "text-xs px-3 py-1.5 gap-1 rounded-full",
      md: "text-sm px-4.5 py-2.5 gap-1.5 rounded-full",
      lg: "text-base px-6 py-3 gap-2 rounded-full",
    };

    const activeClasses = active
      ? "bg-[#222222] text-white border border-[#222222] shadow-xs"
      : "bg-white hover:bg-[#f7f7f7] text-[#484848] border border-[#e4e4e4] hover:text-[#222222]";

    return (
      <button
        ref={ref}
        type="button"
        className={`inline-flex items-center justify-center font-semibold transition-all duration-200 active:scale-98 focus:outline-none focus:ring-2 focus:ring-neutral-200 disabled:opacity-50 disabled:pointer-events-none ${activeClasses} ${sizeClasses[size]} ${className}`}
        {...props}
      >
        {startIcon && <span className="flex-shrink-0">{startIcon}</span>}
        {children}
        {endIcon && <span className="flex-shrink-0">{endIcon}</span>}
      </button>
    );
  }
);
SegmentButton.displayName = "SegmentButton";
