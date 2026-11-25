import { templateConfig } from "@template/config";
import { ImageResponse } from "next/og";

export const alt = templateConfig.name;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Default social card built from template.config.ts. Override per page with its own opengraph-image.
export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        padding: 80,
        background: "#16171a",
        color: "#f4f4f6",
      }}
    >
      <div style={{ fontSize: 72, fontWeight: 700, letterSpacing: -2 }}>{templateConfig.name}</div>
      <div style={{ fontSize: 32, marginTop: 24, color: "#b4b6be", maxWidth: 900 }}>{templateConfig.description}</div>
    </div>,
    size,
  );
}
