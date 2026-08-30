import { Suspense } from "react";
import { CompareView } from "@/components/CompareView";

export default function ComparePage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading comparison…</p>}>
      <CompareView />
    </Suspense>
  );
}
