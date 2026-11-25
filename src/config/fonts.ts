// Fonts are part of the theme: the /new-app styling step may swap these.
// Each font exposes a CSS variable that src/app/globals.css maps to font-sans / font-heading / font-mono.
import { Geist, Geist_Mono } from "next/font/google";

export const fontSans = Geist({ variable: "--font-family-sans", subsets: ["latin"] });
export const fontHeading = Geist({
  variable: "--font-family-heading",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});
export const fontMono = Geist_Mono({ variable: "--font-family-mono", subsets: ["latin"] });

export const fontVariables = [fontSans.variable, fontHeading.variable, fontMono.variable].join(" ");
