import { notFound } from "next/navigation";
import TestMuxClient from "./test-mux-client";

/**
 * Dev-only Mux test harness. It is explicitly opt-in even outside production:
 * set NEXT_PUBLIC_ENABLE_TEST_MUX=true to expose it in non-production builds.
 */
export default function TestMuxPage() {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.NEXT_PUBLIC_ENABLE_TEST_MUX !== "true"
  ) {
    notFound();
  }

  return <TestMuxClient />;
}
