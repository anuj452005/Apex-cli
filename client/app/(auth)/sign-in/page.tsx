"use client"
import { useEffect } from "react"
import { LoginForm } from '@/components/login-form'
import { Spinner } from '@/components/ui/spinner';
import { authClient } from '@/lib/auth-client';
import { useRouter, useSearchParams } from 'next/navigation';
import React from 'react'

const Page = () => {
  const { data, isPending } = authClient.useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!isPending && data?.session && data?.user) {
      // Check for callback URL to redirect back to
      const callbackUrl = searchParams.get("callbackUrl")
      if (callbackUrl) {
        // Decode and redirect to the callback URL
        router.push(decodeURIComponent(callbackUrl))
      } else {
        router.push("/")
      }
    }
  }, [data, isPending, router, searchParams])

  if (isPending) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <Spinner />
      </div>
    )
  }

  return (
    <LoginForm />
  )
}

export default Page