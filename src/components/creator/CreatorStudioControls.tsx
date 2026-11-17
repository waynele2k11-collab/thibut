"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  Plus,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import {
  connectCreatorStripeAction,
  createCreatorDesignListingAction,
  onboardCreatorProfileAction,
  updateDesignPolicyAction,
} from "@/app/actions/creator-studio";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DEFAULT_STUDIO_FONT_OPTIONS,
  getCanonicalStudioFontValue,
} from "@/lib/studio/fontPairing";

export function CreatorOnboardingForm() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [slug, setSlug] = useState("");
  const [bio, setBio] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNameChange = (nextName: string) => {
    setDisplayName(nextName);
    if (!slug) {
      setSlug(
        nextName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 36)
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    const res = await onboardCreatorProfileAction({
      displayName,
      slug,
      bio: bio || undefined,
    });

    if (res.ok) {
      router.refresh();
      return;
    }

    setError(res.error || "Unable to activate creator profile");
    setSubmitting(false);
  };

  return (
    <Card className="p-8 space-y-6 bg-surface-container-lowest border-secondary/35">
      <div>
        <Badge variant="seal" className="mb-2">
          Artist Lineage Onboarding
        </Badge>
        <h2 className="font-headline-md text-headline-md text-on-background">
          Activate Your Creator Studio
        </h2>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">
          Establish your artist handle, publish licensed calligraphy works, and earn royalties on every personalized print or digital master.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
        <div>
          <label
            htmlFor="creator-display-name"
            className="font-label-caps text-label-caps uppercase text-on-surface-variant block mb-1.5"
          >
            Artist / Studio Display Name
          </label>
          <Input
            id="creator-display-name"
            required
            minLength={2}
            maxLength={60}
            value={displayName}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="e.g., Master Wei · Kyoto Brushworks"
          />
        </div>

        <div>
          <label
            htmlFor="creator-slug"
            className="font-label-caps text-label-caps uppercase text-on-surface-variant block mb-1.5"
          >
            Public Studio Handle (Slug)
          </label>
          <Input
            id="creator-slug"
            required
            minLength={3}
            maxLength={40}
            value={slug}
            onChange={(e) =>
              setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
            }
            placeholder="master-wei"
          />
        </div>

        <div>
          <label
            htmlFor="creator-bio"
            className="font-label-caps text-label-caps uppercase text-on-surface-variant block mb-1.5"
          >
            Artistic Philosophy (Optional)
          </label>
          <Input
            id="creator-bio"
            maxLength={280}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Contemporary Shodō and Vietnamese Thư Pháp..."
          />
        </div>

        {error && (
          <p role="alert" className="font-body-md text-sm text-error">
            {error}
          </p>
        )}

        <Button type="submit" disabled={submitting} size="lg">
          {submitting ? (
            <>
              <Loader2
                className="w-4 h-4 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
              Activating Studio...
            </>
          ) : (
            "Begin Artist Lineage"
          )}
        </Button>
      </form>
    </Card>
  );
}

export function StripeConnectPayoutButton({
  stripeAccountId,
}: {
  stripeAccountId: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleConnect = async () => {
    if (loading) return;
    setLoading(true);
    setMessage(null);
    const res = await connectCreatorStripeAction();
    if (res.ok && res.url) {
      window.location.href = res.url;
      return;
    }
    setMessage(res.error || "Unable to open Stripe Connect");
    setLoading(false);
  };

  return (
    <div className="flex flex-col items-start sm:items-end gap-2">
      {stripeAccountId ? (
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="default">Stripe Connected</Badge>
          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={handleConnect}
          >
            {loading ? (
              <Loader2
                className="w-3.5 h-3.5 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            ) : (
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span>Payout Settings</span>
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={handleConnect}
        >
          {loading ? (
            <Loader2
              className="w-3.5 h-3.5 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : (
            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
          )}
          <span>Connect Stripe Express</span>
        </Button>
      )}
      {message && (
        <p className="font-body-md text-xs text-error max-w-xs">{message}</p>
      )}
    </div>
  );
}

export function NewDesignListingPanel({
  remainingSlots,
}: {
  remainingSlots: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [phraseText, setPhraseText] = useState("");
  const [description, setDescription] = useState("");
  const [fontFamily, setFontFamily] = useState(
    getCanonicalStudioFontValue(DEFAULT_STUDIO_FONT_OPTIONS[0]!)
  );
  const [licenseDollars, setLicenseDollars] = useState("4.99");
  const [allowName, setAllowName] = useState(true);
  const [allowQuote, setAllowQuote] = useState(true);
  const [allowTranslation, setAllowTranslation] = useState(true);
  const [allowCalligraphy, setAllowCalligraphy] = useState(true);
  const [allowAIRestyle, setAllowAIRestyle] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: "ok" | "error";
    text: string;
  } | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setFeedback(null);

    const res = await createCreatorDesignListingAction({
      title,
      description: description || undefined,
      phraseText,
      fontFamily,
      licenseDollars,
      allowName,
      allowQuote,
      allowTranslation,
      allowCalligraphy,
      allowAIRestyle,
    });

    setSubmitting(false);
    if (res.ok) {
      setTitle("");
      setPhraseText("");
      setDescription("");
      setOpen(false);
      setFeedback({
        tone: "ok",
        text: "Calligraphy listing published with frozen v1.0 policy & license offers.",
      });
      router.refresh();
      return;
    }

    setFeedback({
      tone: "error",
      text: res.error || "Unable to publish listing",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {feedback && (
          <p
            role="status"
            className={`font-body-md text-sm inline-flex items-center gap-1.5 ${
              feedback.tone === "error" ? "text-error" : "text-primary"
            }`}
          >
            {feedback.tone === "ok" && (
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
            )}
            <span>{feedback.text}</span>
          </p>
        )}

        <Button
          onClick={() => setOpen((prev) => !prev)}
          disabled={remainingSlots <= 0}
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>{open ? "Close Publisher" : "Publish New Listing"}</span>
        </Button>
      </div>

      {open && (
        <Card className="p-6 bg-surface-container-lowest space-y-5">
          <div className="border-b border-surface-variant pb-3">
            <h3 className="font-headline-sm text-headline-sm text-primary">
              Publish Licensed Calligraphy Edition
            </h3>
            <p className="font-body-md text-xs text-on-surface-variant mt-1">
              Creates Design v1.0, immutable Policy v1.0 (AI Model Training locked Off per INV-010), and USD Royalty Offers.
            </p>
          </div>

          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="listing-title"
                  className="font-label-caps text-label-caps uppercase text-on-surface-variant block mb-1.5"
                >
                  Edition Title
                </label>
                <Input
                  id="listing-title"
                  required
                  minLength={2}
                  maxLength={80}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Shichitenhakki — Zen Resilience"
                />
              </div>

              <div>
                <label
                  htmlFor="listing-phrase"
                  className="font-label-caps text-label-caps uppercase text-on-surface-variant block mb-1.5"
                >
                  Calligraphy Characters / Phrase
                </label>
                <Input
                  id="listing-phrase"
                  required
                  maxLength={160}
                  value={phraseText}
                  onChange={(e) => setPhraseText(e.target.value)}
                  placeholder="e.g., 七転八起 or Tâm Bình An"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="listing-font"
                  className="font-label-caps text-label-caps uppercase text-on-surface-variant block mb-1.5"
                >
                  Verified Commercial Brush Font
                </label>
                <select
                  id="listing-font"
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value)}
                  className="w-full h-11 px-3 rounded border border-outline-variant bg-surface-container-lowest text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
                >
                  {DEFAULT_STUDIO_FONT_OPTIONS.map((f) => {
                    const val = getCanonicalStudioFontValue(f);
                    return (
                      <option key={f.id} value={val}>
                        {f.name} ({f.categoryLabel})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label
                  htmlFor="listing-royalty"
                  className="font-label-caps text-label-caps uppercase text-on-surface-variant block mb-1.5"
                >
                  Artist License Royalty (USD)
                </label>
                <Input
                  id="listing-royalty"
                  required
                  value={licenseDollars}
                  onChange={(e) => setLicenseDollars(e.target.value)}
                  placeholder="4.99"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="listing-desc"
                className="font-label-caps text-label-caps uppercase text-on-surface-variant block mb-1.5"
              >
                Curatorial Note (Optional)
              </label>
              <Input
                id="listing-desc"
                maxLength={400}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Meaning, brushwork notes, and recommended medium..."
              />
            </div>

            <fieldset className="pt-2">
              <legend className="font-label-caps text-label-caps uppercase text-on-surface-variant mb-2.5">
                Buyer Personalization Policy (INV-012)
              </legend>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {[
                  {
                    label: "Allow Name",
                    checked: allowName,
                    toggle: () => setAllowName((v) => !v),
                  },
                  {
                    label: "Allow Quote",
                    checked: allowQuote,
                    toggle: () => setAllowQuote((v) => !v),
                  },
                  {
                    label: "Allow Translation",
                    checked: allowTranslation,
                    toggle: () => setAllowTranslation((v) => !v),
                  },
                  {
                    label: "Allow Brush Swap",
                    checked: allowCalligraphy,
                    toggle: () => setAllowCalligraphy((v) => !v),
                  },
                  {
                    label: "Allow AI Restyle",
                    checked: allowAIRestyle,
                    toggle: () => setAllowAIRestyle((v) => !v),
                  },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    role="switch"
                    aria-checked={item.checked}
                    onClick={item.toggle}
                    className={`min-h-11 px-3 py-2 rounded border text-left flex items-center justify-between gap-2 cursor-pointer ${
                      item.checked
                        ? "border-primary bg-surface-container-low text-on-background"
                        : "border-surface-variant bg-surface-container-lowest text-on-surface-variant"
                    }`}
                  >
                    <span className="font-body-md text-xs font-medium">
                      {item.label}
                    </span>
                    <Badge variant={item.checked ? "default" : "outline"}>
                      {item.checked ? "On" : "Off"}
                    </Badge>
                  </button>
                ))}

                <div className="min-h-11 px-3 py-2 rounded border border-surface-variant bg-surface-container-low/60 flex items-center justify-between gap-2 opacity-80">
                  <span className="font-body-md text-xs text-on-surface-variant inline-flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                    AI Training (INV-010)
                  </span>
                  <Badge variant="outline">Locked Off</Badge>
                </div>
              </div>
            </fieldset>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2
                      className="w-4 h-4 animate-spin motion-reduce:animate-none"
                      aria-hidden="true"
                    />
                    Publishing...
                  </>
                ) : (
                  "Publish Edition"
                )}
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}

export function DesignPolicyQuickEditor({
  designId,
  versionNumber,
  initialPolicy,
}: {
  designId: string;
  versionNumber: number;
  initialPolicy: {
    allowName: boolean;
    allowQuote: boolean;
    allowTranslation: boolean;
    allowCalligraphy: boolean;
    allowAIRestyle: boolean;
  };
}) {
  const [editing, setEditing] = useState(false);
  const [currentVersion, setCurrentVersion] = useState(versionNumber);
  const [policy, setPolicy] = useState(initialPolicy);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    const res = await updateDesignPolicyAction({
      designId,
      ...policy,
    });
    setSaving(false);
    if (res.ok) {
      setCurrentVersion((v) => v + 1);
      setEditing(false);
      return;
    }
    setError(res.error || "Failed to save policy");
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1 font-label-caps text-[10px] uppercase text-secondary hover:underline cursor-pointer"
      >
        <Settings2 className="w-3.5 h-3.5" aria-hidden="true" />
        <span>Policy v{currentVersion}.0</span>
      </button>
    );
  }

  return (
    <div className="mt-2 p-3 rounded-lg bg-surface-container-low border border-surface-variant space-y-2.5 min-w-[240px]">
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ["allowName", "Name"],
            ["allowQuote", "Quote"],
            ["allowTranslation", "Translate"],
            ["allowCalligraphy", "Brush"],
            ["allowAIRestyle", "AI Restyle"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={policy[key]}
            onClick={() =>
              setPolicy((prev) => ({ ...prev, [key]: !prev[key] }))
            }
            className={`px-2 py-1 rounded text-[11px] border cursor-pointer ${
              policy[key]
                ? "bg-primary text-on-primary border-primary"
                : "bg-surface-container-lowest text-on-surface-variant border-outline-variant"
            }`}
          >
            {label}: {policy[key] ? "On" : "Off"}
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-error">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="px-3 py-1 rounded bg-secondary text-on-secondary font-label-caps text-[10px] uppercase cursor-pointer disabled:opacity-50"
        >
          {saving ? "Saving..." : `Save v${currentVersion + 1}.0`}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => setEditing(false)}
          className="px-2 py-1 font-label-caps text-[10px] uppercase text-on-surface-variant hover:text-primary cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
