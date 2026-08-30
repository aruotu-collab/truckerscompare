import type { Metadata } from "next";
import { ConnectShiply } from "@/components/ConnectShiply";

export const metadata: Metadata = {
  title: "Connect Shiply — TruckersCompare",
  robots: { index: false, follow: false },
};

export default function ConnectPage() {
  return <ConnectShiply />;
}
