import { redirect } from "next/navigation";

export default async function CreateIndex({ searchParams }: { searchParams: Promise<{ text?: string }> }) {
  const newSessionId = crypto.randomUUID();
  
  const params = await searchParams;
  const textParam = params.text ? `?text=${encodeURIComponent(params.text)}` : "";
  redirect(`/create/${newSessionId}${textParam}`);
}
