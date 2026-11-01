import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Taka Tracker",
    short_name: "Taka",
    description: "Plan daily spending and track every taka.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8f7f2",
    theme_color: "#0f5f66",
    icons: [
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  }
}
