interface Props {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  testId?: string
}

/** Small, flat, squared-ish switch. Quiet on purpose. On phones the button's hit area pads out to 44×44 around it. */
export default function Switch({ checked, onChange, label, testId }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      data-testid={testId}
      onClick={() => onChange(!checked)}
      className="os-tap group -mr-2 -my-[7px] flex shrink-0 items-center justify-center px-2 outline-none"
    >
      <span
        aria-hidden="true"
        className={`relative block h-[16px] w-[28px] rounded-[5px] border transition-colors duration-150 group-focus-visible:ring-2 group-focus-visible:ring-os-ink/30 ${
          checked ? 'border-[#8a6a62] bg-[#a07e74]' : 'border-os-ink/20 bg-os-ink/[0.07]'
        }`}
      >
        <span
          className={`absolute top-[2px] h-[10px] w-[10px] rounded-[3px] transition-transform duration-150 ${
            checked ? 'translate-x-[14px] bg-os-cream' : 'translate-x-[2px] bg-os-ink/40'
          }`}
          style={{ left: 0 }}
        />
      </span>
    </button>
  )
}
