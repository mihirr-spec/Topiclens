import type { CSSProperties, ReactNode } from "react";

/**
 * Hand-drawn decorations for the newsprint / sketchbook theme. Paths are drawn
 * once by hand (not icons) and inherit currentColor, so the same doodle works
 * in black ink or blue ink.
 */

/** Put once per page: an SVG filter that roughens edges into torn paper. */
export function SketchDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
      <filter id="torn" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="4" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="7" xChannelSelector="R" yChannelSelector="G" />
      </filter>
      <filter id="ink" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="2" result="grain" />
        <feDisplacementMap in="SourceGraphic" in2="grain" scale="1.6" />
      </filter>
    </svg>
  );
}

/** A word circled in marker. */
export function Circled({ children, color, className = "" }: { children: ReactNode; color?: string; className?: string }) {
  return (
    <span className={`circled ${className}`} style={color ? ({ "--circle": color } as CSSProperties) : undefined}>
      {children}
      <svg viewBox="0 0 300 120" preserveAspectRatio="none" aria-hidden="true">
        <path d="M150 10 C 245 6, 296 30, 292 62 C 288 98, 210 114, 140 112 C 60 110, 6 92, 8 60 C 10 28, 70 8, 168 12 C 210 14, 240 22, 262 34" />
      </svg>
    </span>
  );
}

/** A scribbled underline that sits under a heading. */
export function Underline({ color, width = 220, className = "" }: { color?: string; width?: number; className?: string }) {
  return (
    <svg className={`underline-doodle ${className}`} viewBox="0 0 300 24" width={width} height={18} style={color ? { color } : undefined} aria-hidden="true">
      <path d="M4 14 C 60 6, 140 4, 296 10" />
      <path d="M20 20 C 90 13, 170 12, 270 16" />
    </svg>
  );
}

/** Short ink strokes radiating from a word ("= TopicLens ="). */
export function Rays({ side }: { side: "left" | "right" }) {
  return (
    <svg className={`rays rays-${side}`} viewBox="0 0 24 30" aria-hidden="true">
      {side === "left" ? (
        <><path d="M22 6 L6 2" /><path d="M22 15 L3 15" /><path d="M22 24 L6 28" /></>
      ) : (
        <><path d="M2 6 L18 2" /><path d="M2 15 L21 15" /><path d="M2 24 L18 28" /></>
      )}
    </svg>
  );
}

/** A loose curved arrow; rotate it with CSS. */
export function Arrow({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg className={`arrow-doodle ${className}`} style={style} viewBox="0 0 120 70" aria-hidden="true">
      <path d="M6 54 C 30 10, 74 6, 104 30" />
      <path d="M90 16 L106 31 L86 38" />
    </svg>
  );
}

export function Crown({ className = "" }: { className?: string }) {
  return (
    <svg className={`doodle ${className}`} viewBox="0 0 40 30" aria-hidden="true">
      <path d="M4 26 L6 8 L14 18 L20 4 L26 18 L34 8 L36 26 Z" />
    </svg>
  );
}

export function Star({ className = "" }: { className?: string }) {
  return (
    <svg className={`doodle ${className}`} viewBox="0 0 40 40" aria-hidden="true">
      <path d="M20 3 L25 36 L4 14 L37 14 L15 36 Z" />
    </svg>
  );
}

/** Dashes around something to show it's "shining". */
export function Sparks({ className = "" }: { className?: string }) {
  return (
    <svg className={`doodle sparks ${className}`} viewBox="0 0 40 40" aria-hidden="true">
      <path d="M8 4 L14 14" /><path d="M24 2 L22 12" /><path d="M36 10 L28 16" />
    </svg>
  );
}

/** The TopicLens wordmark with ink rays either side. */
export function Wordmark() {
  return (
    <span className="wordmark">
      <Rays side="left" />
      <span>TopicLens</span>
      <Rays side="right" />
    </span>
  );
}
