interface Props {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  testId?: string
}

/** Small, flat, squared-ish switch. Quiet on purpose. */
export default function Switch({ checked, onChange, label, testId }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      data-testid={testId}
      onClick={() => onChange(!checked)}
      className={`relative h-[16px] w-[28px] shrink-0 rounded-[5px] border outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-os-ink/30 ${
        checked ? 'border-[#8a6a62] bg-[#a07e74]' : 'border-os-ink/20 bg-os-ink/[0.07]'
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute top-[2px] h-[10px] w-[10px] rounded-[3px] transition-transform duration-150 ${
          checked ? 'translate-x-[14px] bg-os-cream' : 'translate-x-[2px] bg-os-ink/40'
        }`}
        style={{ left: 0 }}
      />
    </button>
  )
}
