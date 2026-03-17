"use client"
import Image from "next/image"
import Link from "next/link"

export function AnimatedLogo({ size = 40 }: { size?: number }) {
  return (
    <Link href="/" className="inline-flex items-center gap-2">
      <Image
        src="/images/logo.png"
        alt="READAPT logo"
        width={size}
        height={size}
        className="float-soft drop-shadow"
        priority
      />
      <span className="sr-only">READAPT</span>
    </Link>
  )
}
