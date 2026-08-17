import Link from "next/link";

export default function CartPage() {
  return (
    <div className="min-h-screen bg-background text-on-background flex flex-col items-center justify-center p-8">
      <h1 className="font-headline-md text-3xl text-primary mb-4">Your Cart is Empty</h1>
      <p className="font-body-md text-on-surface-variant mb-8">
        You haven't added any personalized artwork to your cart yet.
      </p>
      <Link 
        href="/create" 
        className="bg-primary text-on-primary px-8 py-3 rounded-sm font-label-caps uppercase hover:bg-surface-tint transition-colors"
      >
        Start Creating
      </Link>
    </div>
  );
}
