import React from 'react';

type ToggleProps = {
  label: string;
  checked: boolean;
  onChange: (v:boolean)=>void;
  disabled?: boolean;
  title?: string;
  id?: string;
};
export function Toggle({label, checked, onChange, disabled, title, id}: ToggleProps){
  const toggleId = id || `tgl-${label.replace(/\s+/g,'-').toLowerCase()}`;
  return (
    <label className="toggle" title={title}>
      <span>{label}</span>
      <span className="switch">
        <input
          id={toggleId}
          type="checkbox"
          checked={checked}
          onChange={e=>onChange(e.target.checked)}
          disabled={disabled}
          aria-label={label}
        />
        <span className="knob"></span>
      </span>
    </label>
  );
}
