"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function TopNav() {
  const pathname = usePathname();

  const linkStyle = (path: string) =>
    `px-3 py-2 rounded-full text-sm ${
      pathname === path
        ? "bg-neutral-900 text-white"
        : "text-neutral-600 hover:bg-neutral-100"
    }`;

  return (
    <div className="w-full border-b bg-white">
      <div className="max-w-md mx-auto flex justify-between p-3">
        <Link href="/today" className={linkStyle("/today")}>
          Today
        </Link>

        <Link href="/calendar" className={linkStyle("/calendar")}>
          Calendar
        </Link>

        <Link href="/history" className={linkStyle("/history")}>
          History
        </Link>

        <Link href="/settings" className={linkStyle("/settings")}>
          Settings
        </Link>
      </div>
    </div>
  );
}
