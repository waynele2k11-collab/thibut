"use client";

import { useId, useState } from "react";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import {
  KEEPSAKE_FORMATS,
  KEEPSAKE_SIZES,
  formatKeepsakePrice,
  keepsakeOrderMailto,
  keepsakePriceCents,
  type KeepsakeFormatId,
  type KeepsakeSample,
} from "@/lib/custom/keepsakes";

const OPTION_BASE =
  "min-h-11 px-3 rounded border font-label-caps text-label-caps uppercase leading-normal transition-colors motion-reduce:transition-none cursor-pointer flex items-center justify-center text-center peer-focus-visible:ring-2 peer-focus-visible:ring-secondary";
const OPTION_ON = "border-primary bg-primary text-on-primary";
const OPTION_OFF =
  "border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-surface-container-high";

export function KeepsakeSampleCard({
  sample,
  priority = false,
}: {
  sample: KeepsakeSample;
  priority?: boolean;
}) {
  const groupId = useId();
  const [format, setFormat] = useState<KeepsakeFormatId>(sample.defaultFormat);
  const [sizeId, setSizeId] = useState<string>(KEEPSAKE_SIZES[1].id);

  const size = KEEPSAKE_SIZES.find((s) => s.id === sizeId) ?? KEEPSAKE_SIZES[0];
  const formatLabel =
    KEEPSAKE_FORMATS.find((f) => f.id === format)?.label ?? "";
  const price = formatKeepsakePrice(keepsakePriceCents(size, format));
  const orderHref = keepsakeOrderMailto(
    `${sample.title}, ${size.label}, ${formatLabel}`
  );

  return (
    <article className="flex flex-col bg-surface-container-lowest border border-surface-variant rounded-lg overflow-hidden">
      <div className="relative aspect-[3/2] bg-surface-container">
        <Image
          src={sample.imageSrc}
          alt={sample.imageAlt}
          fill
          priority={priority}
          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
          className="object-cover"
        />
      </div>

      <div className="flex flex-col flex-1 p-5 md:p-6 gap-5">
        <div>
          <p className="font-label-caps text-label-caps uppercase text-secondary mb-2">
            {sample.occasion}
          </p>
          <h2 className="font-headline-sm text-headline-sm text-primary">
            {sample.title}
          </h2>
          <p lang="vi" className="font-body-md text-body-md text-on-surface mt-1">
            {sample.wording}
          </p>
          <p className="font-body-md text-body-md text-on-surface-variant mt-2">
            {sample.description}
          </p>
        </div>

        <fieldset>
          <legend className="font-label-caps text-label-caps uppercase text-on-surface-variant mb-2">
            Format
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {KEEPSAKE_FORMATS.map((option) => (
              <label key={option.id} className="relative">
                <input
                  type="radio"
                  name={`${groupId}-format`}
                  value={option.id}
                  checked={format === option.id}
                  onChange={() => setFormat(option.id)}
                  className="peer sr-only"
                />
                <span
                  className={`${OPTION_BASE} ${
                    format === option.id ? OPTION_ON : OPTION_OFF
                  }`}
                >
                  {option.label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="font-label-caps text-label-caps uppercase text-on-surface-variant mb-2">
            Size
          </legend>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-2 xl:grid-cols-4 gap-2">
            {KEEPSAKE_SIZES.map((option) => (
              <label key={option.id} className="relative">
                <input
                  type="radio"
                  name={`${groupId}-size`}
                  value={option.id}
                  checked={sizeId === option.id}
                  onChange={() => setSizeId(option.id)}
                  className="peer sr-only"
                />
                <span
                  className={`${OPTION_BASE} whitespace-nowrap ${
                    sizeId === option.id ? OPTION_ON : OPTION_OFF
                  }`}
                >
                  {option.label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-auto pt-5 border-t border-surface-variant">
          <div
            aria-live="polite"
            className="flex items-baseline justify-between gap-3 mb-1"
          >
            <span className="font-body-md text-body-md text-on-surface-variant">
              {size.label} · {formatLabel}
            </span>
            <span className="font-headline-md text-headline-md text-primary">
              {price}
            </span>
          </div>
          {sample.priceNote && (
            <p className="font-body-md text-body-md text-on-surface-variant mb-1">
              {sample.priceNote}
            </p>
          )}
          <a
            href={orderHref}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 min-h-12 bg-primary text-on-primary px-6 py-3 rounded font-label-caps text-label-caps uppercase hover:bg-secondary hover:text-on-secondary transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
          >
            Order This Style
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </a>
        </div>
      </div>
    </article>
  );
}
