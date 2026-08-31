import type { Metadata } from "next";
import { ConnectSources } from "@/components/ConnectSources";

export const metadata: Metadata = {
  title: "Connect — TruckersCompare",
  robots: { index: false, follow: false },
};

export default function ConnectPage() {
  return <ConnectSources />;
}
