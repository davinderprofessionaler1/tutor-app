import type { Metadata } from "next";
import { VideoWorkspace } from "../../components/video-workspace";

export const metadata: Metadata = { title: "Video library" };
export default function VideosPage() { return <VideoWorkspace />; }
