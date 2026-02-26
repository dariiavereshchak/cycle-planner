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
}
