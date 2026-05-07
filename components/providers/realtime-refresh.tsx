"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { createBrowserClient } from "@/lib/supabase/client";

const watchedTables = [
  "medicines",
  "medicine_batches",
  "sales",
  "sale_items",
  "purchases",
  "purchase_items",
  "sales_returns",
  "store_settings",
  "notifications"
];

export function RealtimeRefresh() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createBrowserClient();
    const channel = supabase.channel("medicore-live-sync");

    watchedTables.forEach((table) => {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table
        },
        () => {
          router.refresh();
        }
      );
    });

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
