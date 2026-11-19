import type { Metadata } from "next";
import { ResourceWorkspace } from "../../components/resource-workspace";

export const metadata: Metadata = { title: "Discount coupons" };
export default function CouponsPage() { return <ResourceWorkspace kind="coupons" />; }
