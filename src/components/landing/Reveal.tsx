"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"

export function Reveal({
  children,
  className = "",
  delay = 0,
  as: Tag = "div",
}: {
  children: ReactNode
  className?: string
  delay?: number
  as?: "div" | "section" | "li" | "span"
}) {
  const ref = useRef<HTMLElement | null>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setInView(true)
            observer.disconnect()
          }
        })
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <Tag
      ref={ref as React.Ref<HTMLElement>}
      className={`lp-reveal ${inView ? "lp-in" : ""} ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  )
}
