import { ImageResponse } from "next/og";

import { getCurrentProject } from "@/lib/project";

// Rendered per-request — pulls brand_color + brand_suffix from the DB.
export const dynamic = "force-dynamic";
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default async function Icon() {
  const project = await getCurrentProject().catch(() => null);
  const color = project?.brandColor ?? "#1e3a8a";
  const suffix = project?.brandSuffix ?? "N";

  return new ImageResponse(
    (
      <div
        style={{
          background: color,
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontSize: 36,
          fontWeight: 700,
          fontFamily: "system-ui",
          letterSpacing: -1,
        }}
      >
        {suffix}
      </div>
    ),
    { ...size },
  );
}
