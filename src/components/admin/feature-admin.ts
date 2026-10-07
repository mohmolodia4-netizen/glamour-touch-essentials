import type { QueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

type SettingsRow = {
  features: Record<string, unknown> | null;
  feature_config: Record<string, unknown> | null;
};

async function readRow(): Promise<SettingsRow> {
  const { data, error } = await (supabase as any)
    .from("app_settings")
    .select("features, feature_config")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? { features: {}, feature_config: {} }) as SettingsRow;
}

function refresh(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: ["public_settings"] });
  void queryClient.invalidateQueries({ queryKey: ["admin", "settings"] });
}

/** Saves app_settings.features[key], merging with the latest stored flags. */
export async function saveFeatureFlag(queryClient: QueryClient, key: string, enabled: boolean) {
  const row = await readRow();
  const { error } = await (supabase as any)
    .from("app_settings")
    .update({ features: { ...(row.features ?? {}), [key]: enabled } })
    .eq("id", 1);
  if (error) throw new Error(error.message);
  refresh(queryClient);
}

/** Saves app_settings.feature_config[key] (non-secret settings only). */
export async function saveFeatureConfig(
  queryClient: QueryClient,
  key: string,
  config: Record<string, unknown>,
) {
  const row = await readRow();
  const { error } = await (supabase as any)
    .from("app_settings")
    .update({ feature_config: { ...(row.feature_config ?? {}), [key]: config } })
    .eq("id", 1);
  if (error) throw new Error(error.message);
  refresh(queryClient);
}
