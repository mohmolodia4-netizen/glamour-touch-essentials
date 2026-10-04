import { createFileRoute } from "@tanstack/react-router";

// Placeholder endpoint reserved for future migration helper logic.
export const Route = createFileRoute("/api/public/migrate-helper")({
  server: {
    handlers: {
      GET: async () => {
        return Response.json({ ok: true, name: "migrate-helper" });
      },
    },
  },
});
