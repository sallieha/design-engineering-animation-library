export interface LitGooFilterProps {
  id: string
  /** Filter region, in the user space of whatever references it. */
  width: number
  height: number
  /** Blur radius feeding the goo threshold — also how close two shapes get before they fuse. */
  blur?: number
  bodyColor?: string
  bodyOpacity?: number
  /** Specular rim highlight along the lit edge. */
  rim?: boolean
  shadowOpacity?: number
  shadowOffset?: number
  shadowBlur?: number
}

/**
 * The shared goo + glass-lighting SVG filter: blurs the opaque shapes it's
 * applied to, then thresholds the blurred alpha back to a hard edge
 * (anything still faintly overlapping after the blur fuses into one
 * connected shape, with the neck's smooth outline for free), then re-lights
 * the result — a translucent fill, a specular rim, and an outer-only drop
 * shadow — so it reads as this library's glass without `backdrop-filter`
 * (which silently fails under an SVG filter).
 */
export function LitGooFilter({
  id,
  width,
  height,
  blur = 5,
  bodyColor = '#ffffff',
  bodyOpacity = 0.07,
  rim = true,
  shadowOpacity = 0.4,
  shadowOffset = 7,
  shadowBlur = 6,
}: LitGooFilterProps) {
  return (
    <filter
      id={id}
      filterUnits="userSpaceOnUse"
      x="0"
      y="0"
      width={width}
      height={height}
      colorInterpolationFilters="sRGB"
    >
      <feGaussianBlur in="SourceGraphic" stdDeviation={blur} result="blur" />
      <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -10" result="goo" />
      <feFlood floodColor={bodyColor} floodOpacity={bodyOpacity} />
      <feComposite in2="goo" operator="in" result="body" />
      {rim && (
        <>
          <feGaussianBlur in="goo" stdDeviation="1.4" result="bump" />
          <feSpecularLighting
            in="bump"
            surfaceScale="4"
            specularConstant="0.8"
            specularExponent="24"
            lightingColor="#ffffff"
            result="spec"
          >
            <feDistantLight azimuth="225" elevation="42" />
          </feSpecularLighting>
          <feComposite in="spec" in2="goo" operator="in" result="rim" />
        </>
      )}
      <feOffset in="goo" dy={shadowOffset} result="shadowOffset" />
      <feGaussianBlur in="shadowOffset" stdDeviation={shadowBlur} result="shadowBlur" />
      <feFlood floodColor="#000000" floodOpacity={shadowOpacity} />
      <feComposite in2="shadowBlur" operator="in" result="shadowTint" />
      <feComposite in="shadowTint" in2="goo" operator="out" result="shadow" />
      <feMerge>
        <feMergeNode in="shadow" />
        <feMergeNode in="body" />
        {rim && <feMergeNode in="rim" />}
      </feMerge>
    </filter>
  )
}
