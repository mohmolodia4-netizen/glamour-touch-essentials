import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { initPixel } from "@/lib/pixel";
import { publicSettingsQuery } from "@/lib/store";

export function PixelLoader() {
  const { data: settings } = useQuery(publicSettingsQuery());

  useEffect(() => {
    initPixel(settings?.meta_pixel_id);
  }, [settings?.meta_pixel_id]);

  return null;
}
