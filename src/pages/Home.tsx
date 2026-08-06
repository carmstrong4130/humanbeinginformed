import { useEffect } from "react";

import USMap from "@/components/USMap";

export default function Home() {
  useEffect(() => {
    document.title = "Be Informed — what's being voted on, when, y whom?";
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-[960px] flex-col items-center px-6 py-20">
      <h1 className="text-[44px] font-semibold tracking-tight text-ink sm:text-[56px]">
        Be Informed
      </h1>
      <p className="mt-3 text-center text-[19px] text-inksec sm:text-[21px]">
        what&apos;s being voted on, when, y whom?
      </p>

      <div className="mt-16 w-full max-w-[900px]">
        <USMap />
      </div>
    </main>
  );
}
