import Link from "next/link";
import { CheckCircle, ArrowRight } from "lucide-react";

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string; order?: string }>;
}) {
  const { session_id, order } = await searchParams;

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col font-body-md antialiased items-center justify-center">
      <main className="max-w-md w-full px-margin-mobile flex flex-col items-center text-center gap-6">
        <CheckCircle className="w-16 h-16 text-[#0A9E48]" />
        
        <h1 className="font-display-lg-mobile md:font-display-lg text-display-lg-mobile md:text-display-lg text-on-background">
          Payment Successful
        </h1>
        
        <p className="font-body-md text-body-md text-on-surface-variant">
          Your order <strong>{order}</strong> has been secured. Your personalized artwork is being finalized.
        </p>

        {session_id === "mock_stripe_session" && (
          <div className="bg-secondary/10 text-secondary border border-secondary/20 p-4 rounded-sm text-sm">
            Note: This was a simulated checkout because STRIPE_SECRET_KEY is missing. Add your Stripe keys to .env to process real payments.
          </div>
        )}

        <Link
          href="/"
          className="mt-4 bg-primary text-on-primary px-8 py-4 font-label-caps text-label-caps uppercase hover:bg-surface-tint transition-colors duration-300 flex items-center gap-2"
        >
          Return to Dashboard <ArrowRight className="w-4 h-4" />
        </Link>
      </main>
    </div>
  );
}
