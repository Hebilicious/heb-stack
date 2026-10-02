import { defineConfig } from "@hebilicious/cssforge";

// Every colour the page paints, as OKLCH ramps whose step numbers read the same across families.
export default defineConfig({
  colors: {
    palette: {
      value: {
        alarm: { value: { 300: { hex: "#ff9a94" }, 500: { hex: "#d6453d" } } },
        factor: { value: { 300: { hex: "#ffc27a" }, 500: { hex: "#e38a1c" } } },
        ink: {
          value: {
            200: { hex: "#b7c0d1" },
            50: { hex: "#eef1f6" },
            500: { hex: "#4d5b78" },
            800: { hex: "#1c2538" },
            950: { hex: "#0b1020" },
          },
        },
        prime: { value: { 300: { hex: "#7ee0a8" }, 500: { hex: "#2fb873" } } },
      },
    },
  },
  primitives: {
    corner: { value: { radius: { value: { large: "14px", small: "6px" } } } },
    font: {
      value: {
        family: {
          value: {
            body: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
            mono: 'ui-monospace, SFMono-Regular, "JetBrains Mono", Consolas, monospace',
          },
        },
      },
    },
  },
  spacing: {
    custom: {
      size: {
        value: {
          1: "0.25rem",
          12: "3rem",
          2: "0.5rem",
          3: "0.75rem",
          4: "1rem",
          6: "1.5rem",
          8: "2rem",
        },
      },
    },
  },
  typography: {
    fluid: {
      text: {
        value: {
          maxFontSize: 18,
          maxTypeScale: 1.28,
          maxWidth: 1280,
          minFontSize: 15,
          minTypeScale: 1.2,
          minWidth: 320,
          negativeSteps: 1,
          positiveSteps: 4,
        },
      },
    },
  },
});
