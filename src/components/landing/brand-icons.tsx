"use client"

/* Brand marks for the download cards — proper platform logos instead of
   generic device icons. The Windows mark is the classic four-pane flag with
   the slight perspective and two-tone (light/dark blue) triangular shading of
   the Windows 10/11 style logo. The Apple mark is the standard silhouette and
   inherits its color (white on the dark download tiles). */

export function WindowsLogo({ size = 26 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 88 88"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      {/* top-left pane */}
      <path d="M0 12.4 L35.7 4.6 L35.7 40.4 Z" fill="#00A4EF" />
      <path d="M0 12.4 L0 40.4 L35.7 40.4 Z" fill="#0078D7" />
      {/* top-right pane */}
      <path d="M40.7 3.5 L88 3.5 L88 40.4 Z" fill="#00A4EF" />
      <path d="M40.7 3.5 L40.7 40.4 L88 40.4 Z" fill="#0078D7" />
      {/* bottom-left pane */}
      <path d="M0 47 L35.7 47 L35.7 83.5 Z" fill="#00A4EF" />
      <path d="M0 47 L0 75.5 L35.7 83.5 Z" fill="#0078D7" />
      {/* bottom-right pane */}
      <path d="M40.7 47 L88 47 L88 75.5 Z" fill="#00A4EF" />
      <path d="M40.7 47 L40.7 83.5 L88 75.5 Z" fill="#0078D7" />
    </svg>
  )
}

export function AppleLogo({ size = 26 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 384 512"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
    </svg>
  )
}