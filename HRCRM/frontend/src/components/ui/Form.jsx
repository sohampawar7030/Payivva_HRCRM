import { useState } from 'react'

const FIELDS = {
  text: ({ field, value, onChange, error }) => (
    <input
      className={`input ${error ? 'invalid' : ''}`}
      type="text"
      id={field.name}
      value={value ?? ''}
      onChange={(e) => onChange(field.name, e.target.value)}
      placeholder={field.placeholder}
      disabled={field.disabled}
      maxLength={field.maxLength}
    />
  ),
  email: ({ field, value, onChange, error }) => (
    <input
      className={`input ${error ? 'invalid' : ''}`}
      type="email"
      id={field.name}
      value={value ?? ''}
      onChange={(e) => onChange(field.name, e.target.value)}
      placeholder={field.placeholder}
      disabled={field.disabled}
    />
  ),
  password: ({ field, value, onChange, error }) => (
    <input
      className={`input ${error ? 'invalid' : ''}`}
      type="password"
      id={field.name}
      value={value ?? ''}
      onChange={(e) => onChange(field.name, e.target.value)}
      placeholder={field.placeholder}
      disabled={field.disabled}
    />
  ),
  number: ({ field, value, onChange, error }) => (
    <input
      className={`input ${error ? 'invalid' : ''}`}
      type="number"
      id={field.name}
      value={value ?? ''}
      onChange={(e) => onChange(field.name, e.target.value)}
      placeholder={field.placeholder}
      disabled={field.disabled}
      min={field.min}
      max={field.max}
      step={field.step}
    />
  ),
  date: ({ field, value, onChange, error }) => (
    <input
      className={`input ${error ? 'invalid' : ''}`}
      type="date"
      id={field.name}
      value={value ? String(value).slice(0, 10) : ''}
      onChange={(e) => onChange(field.name, e.target.value)}
      disabled={field.disabled}
    />
  ),
  select: ({ field, value, onChange, error }) => (
    <select
      className={`select ${error ? 'invalid' : ''}`}
      id={field.name}
      value={value ?? ''}
      onChange={(e) => onChange(field.name, e.target.value)}
      disabled={field.disabled}
    >
      {field.placeholder && <option value="">{field.placeholder}</option>}
      {(field.options || []).map((o) => {
        const v = typeof o === 'object' ? o.value : o
        const l = typeof o === 'object' ? o.label : o
        return <option key={v} value={v}>{l}</option>
      })}
    </select>
  ),
  textarea: ({ field, value, onChange, error }) => (
    <textarea
      className={`textarea ${error ? 'invalid' : ''}`}
      id={field.name}
      value={value ?? ''}
      onChange={(e) => onChange(field.name, e.target.value)}
      placeholder={field.placeholder}
      disabled={field.disabled}
      rows={field.rows || 3}
    />
  ),
}

export function Field({ field, value, onChange, error }) {
  const render = FIELDS[field.type] || FIELDS.text
  return (
    <div className="field">
      {field.label && (
        <label htmlFor={field.name}>
          {field.label} {field.required && <span className="req">*</span>}
        </label>
      )}
      {render({ field, value, onChange, error })}
      {error && <div className="field-error">{error}</div>}
      {field.hint && !error && <div className="text-xs text-muted">{field.hint}</div>}
    </div>
  )
}

export function Checkbox({ label, checked, onChange, name, disabled }) {
  return (
    <label className="check-line">
      <input type="checkbox" name={name} checked={Boolean(checked)} onChange={(e) => onChange(e.target.checked)} disabled={disabled} />
      {label}
    </label>
  )
}

export function Radio({ label, checked, onChange, name, value }) {
  return (
    <label className="check-line">
      <input type="radio" name={name} value={value} checked={Boolean(checked)} onChange={() => onChange(value)} />
      {label}
    </label>
  )
}

export function ChipSelect({ options, selected = [], onChange, disabled }) {
  const [custom, setCustom] = useState('')
  const toggle = (opt) => {
    if (disabled) return
    if (opt === 'Other' || opt === 'Others') {
      if (selected.includes(opt)) {
        onChange(selected.filter((s) => s !== opt && s !== custom))
        setCustom('')
      } else {
        onChange([...selected, opt])
      }
      return
    }
    onChange(selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt])
  }
  const updateCustom = (e) => {
    if (disabled) return
    setCustom(e.target.value)
    const base = selected.filter((s) => s !== 'Other' && s !== 'Others' && s !== custom)
    onChange([...base, e.target.value].filter(Boolean))
  }
  return (
    <div>
      <div className="chip-grid">
        {options.map((opt) => (
          <label key={opt} className={`chip ${selected.includes(opt) ? 'selected' : ''} ${disabled ? 'disabled' : ''}`} onClick={(e) => { e.preventDefault(); toggle(opt) }}>
            <input type="checkbox" checked={selected.includes(opt)} readOnly disabled={disabled} tabIndex={-1} />
            {opt}
          </label>
        ))}
      </div>
      {(selected.includes('Other') || selected.includes('Others')) && (
        <input
          className="input mt-8"
          type="text"
          value={custom}
          onChange={updateCustom}
          placeholder="Specify custom skill / asset..."
          disabled={disabled}
        />
      )}
    </div>
  )
}