import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { FEATURES, useFeature } from "@/lib/features";
import { saveFeatureFlag } from "@/components/admin/feature-admin";

export function FeatureActivationCard({
  featureKey,
  description,
}: {
  featureKey: string;
  description: string;
}) {
  const queryClient = useQueryClient();
  const def = FEATURES.find((f) => f.key === featureKey)?.default ?? false;
  const enabled = useFeature(featureKey, def);
  const [busy, setBusy] = useState(false);

  async function toggle(next: boolean) {
    setBusy(true);
    try {
      await saveFeatureFlag(queryClient, featureKey, next);
      toast.success(next ? "Fonctionnalité activée" : "Fonctionnalité désactivée");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Échec de l'enregistrement");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="rounded-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base">Activation</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <Switch
          checked={enabled}
          disabled={busy}
          onCheckedChange={(v) => void toggle(v)}
          aria-label="Activer la fonctionnalité"
        />
      </CardHeader>
      <CardContent className="pt-0 text-xs text-muted-foreground">
        {enabled ? "Activée" : "Désactivée"}
      </CardContent>
    </Card>
  );
}
