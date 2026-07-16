import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { CustomEase } from 'gsap/CustomEase'

gsap.registerPlugin(useGSAP, CustomEase)

export const glassSpringEase = CustomEase.create('aave-glass-spring', '0.22,1.15,0.36,1.06')

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export { gsap, useGSAP }
