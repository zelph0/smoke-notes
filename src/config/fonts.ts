// Fonts are part of the theme: the /new-app styling step may swap these.
// Each font exposes a CSS variable that src/app/globals.css maps to font-sans / font-heading / font-mono.
import { Geist_Mono, Onest, Unbounded } from "next/font/google";

export const fontSans = Onest({ variable: "--font-family-sans", subsets: ["latin"] });
export const fontHeading = Unbounded({
  variable: "--font-family-heading",
  subsets: ["latin"],
  weight: ["700", "800"],
});
export const fontMono = Geist_Mono({ variable: "--font-family-mono", subsets: ["latin"] });

export const fontVariables = [fontSans.variable, fontHeading.variable, fontMono.variable].join(" ");
