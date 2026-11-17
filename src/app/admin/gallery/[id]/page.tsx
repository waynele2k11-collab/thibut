import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import EditGalleryItemForm from "./EditGalleryItemForm";

export default async function EditGalleryItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const item = await prisma.galleryItem.findUnique({
    where: { id },
  });

  if (!item) {
    notFound();
  }

  const customImageUrl =
    item.mockupTransform &&
    typeof item.mockupTransform === "object" &&
    !Array.isArray(item.mockupTransform) &&
    typeof item.mockupTransform.customImageUrl === "string"
      ? item.mockupTransform.customImageUrl
      : undefined;

  return (
    <div className="max-w-2xl mx-auto py-8 space-y-6">
      <h1 className="font-headline-md text-headline-md text-primary">
        Edit Gallery Item
      </h1>

      <Card className="p-6">
        <h2 className="font-headline-sm text-headline-sm text-primary mb-1">
          {item.title}
        </h2>
        <p className="font-body-md text-xs text-on-surface-variant mb-6 font-mono">
          ID: {item.id}
        </p>

        <EditGalleryItemForm
          id={item.id}
          currentCustomImage={customImageUrl}
          productImageUrl={item.productImageUrl}
          listedPriceMinor={item.listedPriceMinor.toString()}
          currency={item.currency}
        />
      </Card>
    </div>
  );
}
