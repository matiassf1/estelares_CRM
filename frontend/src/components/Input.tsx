import { forwardRef } from 'react';

interface Props extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

const Input = forwardRef<HTMLInputElement, Props>(({ label, className = '', ...props }, ref) => (
  <div>
    {label && (
      <label className="block text-[10px] font-semibold uppercase tracking-[0.2em] mb-1.5" style={{ color: '#C9A84C' }}>
        {label}
      </label>
    )}
    <input ref={ref} className={`input-field ${className}`} {...props} />
  </div>
));

Input.displayName = 'Input';
export default Input;
