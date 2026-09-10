"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Pause, Play } from "lucide-react"
import type { HyperframesPlayer } from "@hyperframes/player"
import { MIcon } from "./icons"

/* The <hyperframes-player> web component is not part of React's intrinsic
   elements — declare it so TS accepts the JSX tag. */
declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "hyperframes-player": DetailedHTMLProps<
        HTMLAttributes<HyperframesPlayer>,
        HyperframesPlayer
      >
    }
  }
}

export function Hero() {
  const playerRef = useRef<HyperframesPlayer | null>(null)
  const progressRef = useRef<HTMLDivElement | null>(null)

  const [playing, setPlaying] = useState(false)
  const [ready, setReady] = useState(false)
  const [hasError, setHasError] = useState(false)

  const scrollVideo = useCallback(() => {
    const frame = document.getElementById("lpVideoFrame")
    frame?.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [])

  /* Mount the HyperFrames composition on the player element and listen for
     playback events. The player module is loaded client-side only — its
     custom-element class extends HTMLElement, so importing it at module level
     would crash server-side rendering. Attributes are set imperatively so
     playback options (autoplay, loop, muted, audio-locked) are guaranteed
     regardless of how React serializes custom-element props. */
  useEffect(() => {
    let disposed = false
    let teardown: (() => void) | null = null
    void import("@hyperframes/player").then(() => {
      const el = playerRef.current
      if (!el || disposed) return

      el.setAttribute("src", "/demo/ukuu-demo.html")
      el.setAttribute("width", "1920")
      el.setAttribute("height", "1080")
      el.setAttribute("autoplay", "")
      el.setAttribute("loop", "")
      el.setAttribute("muted", "")
      el.setAttribute("audio-locked", "")

      const onReady = () => setReady(true)
      const onPlay = () => setPlaying(true)
      const onPause = () => setPlaying(false)
      const onTime = (e: Event) => {
        const { currentTime } = (e as CustomEvent<{ currentTime: number }>).detail ?? {}
        if (typeof currentTime === "number" && el.duration && progressRef.current) {
          progressRef.current.style.transform = `scaleX(${Math.min(1, currentTime / el.duration)})`
        }
      }
      const onError = () => setHasError(true)

      el.addEventListener("ready", onReady)
      el.addEventListener("play", onPlay)
      el.addEventListener("pause", onPause)
      el.addEventListener("timeupdate", onTime)
      el.addEventListener("error", onError)
      teardown = () => {
        el.removeEventListener("ready", onReady)
        el.removeEventListener("play", onPlay)
        el.removeEventListener("pause", onPause)
        el.removeEventListener("timeupdate", onTime)
        el.removeEventListener("error", onError)
      }
    })
    return () => {
      disposed = true
      teardown?.()
    }
  }, [])

  const togglePlay = useCallback(() => {
    const el = playerRef.current
    if (!el || hasError) return
    try {
      if (el.paused) {
        const p = el.play() as unknown as Promise<void> | undefined
        p?.catch?.(() => {})
      } else {
        el.pause()
      }
    } catch {
      /* ignore */
    }
  }, [hasError])

  return (
    <section className="lp-hero">
      <div className="lp-hero-aurora" aria-hidden="true" />
      <div className="lp-hero-aurora2" aria-hidden="true" />
      <div className="lp-hero-mesh" aria-hidden="true" />

      <div className="lp-hero-content">
        <p className="lp-hero-eyebrow">Remote HR platform · Africa</p>
        <h1 className="lp-hero-h1">
          HR software that
          <br />
          <span className="lp-gradient-text">runs your workforce.</span>
        </h1>
        <p className="lp-hero-sub">
          Onboard, track, approve, and schedule — one platform for the entire
          employee lifecycle.
        </p>

        <div className="lp-hero-actions">
          <a href="#cta" className="lp-btn-hero-primary">
            <MIcon name="arrow_forward" size={18} />
            Get started free
          </a>
          <button
            type="button"
            className="lp-btn-hero-secondary"
            onClick={scrollVideo}
          >
            <MIcon name="play_circle" size={20} />
            Watch the demo
          </button>
        </div>

        <div className="lp-hero-badges">
          <div className="lp-float-badge">
            <div
              className="lp-float-badge-icon"
              style={{ background: "rgba(20,163,127,0.15)" }}
            >
              <MIcon name="schedule" size={20} className="lp-ico-green" />
            </div>
            <div className="lp-float-badge-text">
              <strong>9 Modules</strong>
              Full HR suite
            </div>
          </div>
          <div className="lp-float-badge">
            <div
              className="lp-float-badge-icon"
              style={{ background: "rgba(216,156,17,0.15)" }}
            >
              <MIcon name="verified" size={20} className="lp-ico-gold" />
            </div>
            <div className="lp-float-badge-text">
              <strong>100%</strong>
              Statutory compliance
            </div>
          </div>
        </div>
      </div>

      <div className="lp-hero-preview" id="demo">
        <div className="lp-video" style={{ margin: "0 auto" }}>
          <div className="lp-video-frame" id="lpVideoFrame">
            {/* HyperFrames composition — a live, seekable product demo
                rendered from /demo/ukuu-demo.html (1920×1080). */}
            <hyperframes-player ref={playerRef} className="lp-player" />
            <div className="lp-video-vignette" aria-hidden="true" />

            {!ready && !hasError && (
              <div className="lp-video-loading" aria-hidden="true">
                <span />
              </div>
            )}

            {hasError ? (
              <div className="lp-video-error" role="status">
                Demo unavailable — check your connection and refresh.
              </div>
            ) : (
              <button
                type="button"
                aria-label={playing ? "Pause demo" : "Play demo"}
                className={`lp-play-overlay${playing ? " lp-play-overlay--playing" : ""}`}
                onClick={togglePlay}
              >
                {playing ? <Pause size={26} /> : <Play size={26} className="lp-play-tri" />}
              </button>
            )}

            <div className="lp-video-progress" aria-hidden="true">
              <div className="lp-video-progress-fill" ref={progressRef} />
            </div>
          </div>
        </div>
      </div>

      <div className="lp-scroll-hint" aria-hidden="true">
        <div className="lp-scroll-hint-line" />
        <span className="lp-scroll-hint-text">Scroll</span>
      </div>
    </section>
  )
}