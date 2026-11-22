import type { MetadataRoute } from "next";

/** Lets phones install the platform as an app, with the bottom-tab layout. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DWP EARN MONEY",
    short_name: "DWP Earn",
    description: "Dashboard cuan berbasis tim agen: peluang, modal, risiko, dan akun nyata Anda.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#e9e3dc",
    theme_color: "#e9e3dc",
    lang: "id",
    categories: ["finance", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
