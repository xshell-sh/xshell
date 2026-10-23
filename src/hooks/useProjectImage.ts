import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

const cache = new Map<string, string>();

// Icons render at 40px at most; 192px covers that at 200% interface zoom on a 2x display.
const THUMB_MAX_PX = 192;

// Downscale a raster image to a small thumbnail so a multi-hundred-KB logo isn't kept (and
// repeated in every sidebar/tab/header <img>) at full size. SVGs stay vector, GIFs keep
// their animation, and images already small enough are returned unchanged.
function toThumbnail(dataUrl: string): Promise<string> {
  if (dataUrl.startsWith("data:image/svg") || dataUrl.startsWith("data:image/gif")) return Promise.resolve(dataUrl);
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, THUMB_MAX_PX / Math.max(img.naturalWidth, img.naturalHeight));
      if (scale >= 1) { resolve(dataUrl); return; }
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(dataUrl); return; }
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const thumb = canvas.toDataURL("image/webp", 0.92);
      resolve(thumb.length < dataUrl.length ? thumb : dataUrl);
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export function useProjectImage(iconValue: string | undefined): string | null {
  const [dataUrl, setDataUrl] = useState<string | null>(() => {
    if (!iconValue?.startsWith("img:")) return null;
    return cache.get(iconValue) || null;
  });

  useEffect(() => {
    if (!iconValue?.startsWith("img:")) { setDataUrl(null); return; }
    if (cache.has(iconValue)) { setDataUrl(cache.get(iconValue)!); return; }
    let cancelled = false;
    invoke<string>("read_image_base64", { path: iconValue.slice(4) }).then(toThumbnail).then(url => {
      cache.set(iconValue, url);
      if (!cancelled) setDataUrl(url);
    }).catch(() => { if (!cancelled) setDataUrl(null); });
    return () => { cancelled = true; };
  }, [iconValue]);

  return dataUrl;
}
