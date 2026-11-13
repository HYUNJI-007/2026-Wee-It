import React from 'react';

export type AppIconButtonSize = 'xs' | 'sm' | 'md';
export type AppIconButtonShape = 'rounded' | 'circle';
export type AppIconButtonVariant =
  | 'ghost'
  | 'outline'
  | 'active'
  | 'purple'
  | 'success'
  | 'danger';

interface AppIconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: React.ReactNode;
  label: string;
  mobileLabel?: string;
  size?: AppIconButtonSize;
  shape?: AppIconButtonShape;
  variant?: AppIconButtonVariant;
  active?: boolean;
}

export const AppIconButton: React.FC<AppIconButtonProps> = ({
  icon,
  label,
  mobileLabel,
  size = 'sm',
  shape = 'rounded',
  variant = 'ghost',
  active = false,
  className = '',
  type = 'button',
  ...rest
}) => {
  const sizeClass =
    size === 'md'
      ? 'app-icon-btn--md'
      : size === 'xs'
      ? 'app-icon-btn--xs'
      : '';
  const shapeClass = shape === 'circle' ? 'app-icon-btn--circle' : '';
  const effectiveVariant = active && variant === 'outline' ? 'active' : variant;
  const variantClass =
    effectiveVariant === 'ghost' ? '' : `app-icon-btn--${effectiveVariant}`;
  const mobileClass = mobileLabel ? 'has-mobile-label' : '';

  return (
    <button
      type={type}
      title={rest.title || label}
      aria-label={rest['aria-label'] || label}
      className={`app-icon-btn ${sizeClass} ${shapeClass} ${variantClass} ${mobileClass} ${className}`.trim()}
      {...rest}
    >
      {icon}
      {mobileLabel && <span className="app-icon-btn-label">{mobileLabel}</span>}
    </button>
  );
};

export type AppActionButtonVariant =
  | 'primary'
  | 'purple'
  | 'blue'
  | 'green'
  | 'secondary'
  | 'outline'
  | 'subtle'
  | 'danger'
  | 'neutral';

export type AppActionButtonSize = 'xs' | 'sm' | 'md' | 'lg';

interface AppActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  variant?: AppActionButtonVariant;
  size?: AppActionButtonSize;
  pill?: boolean;
  fullWidth?: boolean;
}

export const AppActionButton: React.FC<AppActionButtonProps> = ({
  startIcon,
  endIcon,
  variant = 'outline',
  size = 'md',
  pill = true,
  fullWidth = false,
  className = '',
  children,
  type = 'button',
  style,
  ...rest
}) => {
  return (
    <button
      type={type}
      className={`app-btn app-btn--${size} app-btn--${variant} ${pill ? 'app-btn--pill' : ''} ${className}`.trim()}
      style={{
        ...(fullWidth ? { width: '100%' } : {}),
        ...style
      }}
      {...rest}
    >
      {startIcon && <span className="app-btn-icon">{startIcon}</span>}
      <span>{children}</span>
      {endIcon && <span className="app-btn-icon">{endIcon}</span>}
    </button>
  );
};
