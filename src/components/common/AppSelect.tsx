import React from 'react';
import { ChevronDown } from 'lucide-react';

export interface AppSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  variant?: 'default' | 'pill' | 'compact';
  wrapperStyle?: React.CSSProperties;
  wrapperClassName?: string;
  chevronColor?: string;
}

export const AppSelect: React.FC<AppSelectProps> = ({
  variant = 'default',
  wrapperStyle,
  wrapperClassName = '',
  className = '',
  style,
  chevronColor = '#64748b',
  children,
  ...rest
}) => {
  const variantClass =
    variant === 'pill'
      ? 'app-select--pill'
      : variant === 'compact'
        ? 'app-select--compact'
        : '';

  return (
    <div
      className={`app-select-wrap ${variantClass} ${wrapperClassName}`.trim()}
      style={wrapperStyle}
    >
      <select
        className={`app-select ${variantClass} ${className}`.trim()}
        style={style}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown
        size={variant === 'compact' ? 14 : 16}
        strokeWidth={2.2}
        className="app-select-chevron"
        style={{ color: chevronColor }}
        aria-hidden="true"
      />
    </div>
  );
};
