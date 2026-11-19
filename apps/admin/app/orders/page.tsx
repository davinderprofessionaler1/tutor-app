import type { Metadata } from "next";
import { OrderWorkspace } from "../../components/order-workspace";

export const metadata: Metadata = { title: "Orders" };

export default function OrdersPage() {
  return <OrderWorkspace />;
}
