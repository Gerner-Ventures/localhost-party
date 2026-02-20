"use client";

import posthog from "posthog-js";
import { useEffect } from "react";

export default function PostHogAnalytics() {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
      posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
        api_host:
          process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
        capture_pageview: true,
        capture_pageleave: true,
      });
    }
  }, []);

  return null;
}
