import type { Metadata } from "next";
import { ResourceWorkspace } from "../../components/resource-workspace";

export const metadata: Metadata = { title: "Global templates" };
export default function TemplatesPage() { return <ResourceWorkspace kind="templates" />; }
