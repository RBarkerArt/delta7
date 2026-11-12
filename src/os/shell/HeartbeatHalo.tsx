import { forwardRef } from 'react'

/** Warm, low-opacity halo behind the Delta7 tile. Driven by useHeartbeat (opacity/scale only). */
const HeartbeatHalo = forwardRef<HTMLDivElement>(function HeartbeatHalo(_, ref) {
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute -inset-[40%] rounded-full opacity-0"
      style={{
        background:
          'radial-gradient(circle closest-side at 50% 50%, rgba(255,200,150,0.9) 0%, rgba(255,186,138,0.62) 52%, rgba(246,160,120,0.22) 76%, rgba(240,150,120,0) 100%)',
        willChange: 'opacity, transform',
      }}
    />
  )
})

export default HeartbeatHalo
