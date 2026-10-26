import { VoterApp } from "@/components/voter/VoterApp";
import { loadBallot } from "@/lib/ballot";

export const metadata = { title: "Pilih Paslon · Pemilu MPK" };

export default async function PilihPage() {
  const ballot = await loadBallot();
  return (
    <main className="flex min-h-dvh flex-col px-gutter py-5">
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col">
        <VoterApp initial={ballot} />
      </div>
    </main>
  );
}
