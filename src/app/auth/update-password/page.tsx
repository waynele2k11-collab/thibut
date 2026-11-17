import type { Metadata } from "next";
import { UpdatePasswordForm } from "./UpdatePasswordForm";

export const metadata: Metadata = {
  title: "Update Password",
  description: "Set a new password for your Thi Bút account.",
  robots: { index: false, follow: false },
};

export default function UpdatePasswordPage() {
  return (
    <main className="flex-1 bg-background flex flex-col justify-center py-16 px-margin-mobile md:px-margin-desktop">
      <UpdatePasswordForm />
    </main>
  );
}
