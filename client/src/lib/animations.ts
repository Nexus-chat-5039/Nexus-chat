/**
 * Shared animation configurations for GSAP
 * All animations respect prefers-reduced-motion
 */

export const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches

export const durations = {
  fast: 0.15,
  normal: 0.25,
  medium: 0.4,
  slow: 0.6,
  xslow: 0.8,
}

export const easings = {
  power2Out: "power2.out",
  power2In: "power2.in",
  power3Out: "power3.out",
  power3In: "power3.in",
  backOut: "back.out(1.7)",
  none: "none",
}

// Default entrance animation for page elements
export const fadeInUp = (duration = durations.medium, delay = 0) => ({
  opacity: 0,
  y: 20,
  duration: prefersReducedMotion() ? 0.01 : duration,
  delay,
  ease: easings.power2Out,
})

export const fadeInScale = (duration = durations.medium, delay = 0) => ({
  opacity: 0,
  scale: 0.95,
  duration: prefersReducedMotion() ? 0.01 : duration,
  delay,
  ease: easings.power2Out,
})

export const slideInRight = (duration = durations.normal, delay = 0) => ({
  opacity: 0,
  x: 30,
  duration: prefersReducedMotion() ? 0.01 : duration,
  delay,
  ease: easings.power2Out,
})

export const slideInLeft = (duration = durations.normal, delay = 0) => ({
  opacity: 0,
  x: -30,
  duration: prefersReducedMotion() ? 0.01 : duration,
  delay,
  ease: easings.power2Out,
})

// Page transition config
export const pageTransition = {
  exit: {
    opacity: 1,
    y: 0,
    duration: prefersReducedMotion() ? 0.01 : durations.fast,
    ease: easings.power2In,
  },
  enter: {
    opacity: 0,
    y: 12,
    duration: prefersReducedMotion() ? 0.01 : durations.medium,
    ease: easings.power2Out,
  },
}

// Stagger config for lists
export const staggerConfig = {
  default: 0.08,
  fast: 0.05,
  slow: 0.12,
}

// ScrollTrigger defaults
export const scrollTriggerDefaults = {
  start: "top 85%",
  once: true,
}
