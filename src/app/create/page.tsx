import type { Metadata } from "next";
import { CreateSessionBootstrap } from "./CreateSessionBootstrap";

export const metadata: Metadata = {
  title: "Personalization Studio — Create Custom Calligraphy",
  description:
    "Transform your name, quote, or story into authentic Vietnamese, Japanese, Chinese, or Korean calligraphy in the Thi Bút Studio.",
};

export default async function CreateIndexPage({
  searchParams,
}: {
  searchParams: Promise<{
    text?: string;
    tradition?: string;
    treatment?: string;
    galleryId?: string;
  }>;
}) {
  const params = await searchParams;

  return (
    <CreateSessionBootstrap
      text={params.text}
      tradition={params.tradition}
      treatment={params.treatment}
      galleryId={params.galleryId}
    />
  );
}
