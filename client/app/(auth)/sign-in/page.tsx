"use client"
import { useEffect, Suspense } from "react"
import { LoginForm } from '@/components/login-form'
import { Spinner } from '@/components/ui/spinner';
import { authClient } from '@/lib/auth-client';
import { useRouter, useSearchParams } from 'next/navigation';
import React from 'react'

const SignInContent = () => {
  const { data, isPending } = authClient.useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!isPending && data?.session && data?.user) {
      const callbackUrl = searchParams.get("callbackUrl")
      if (callbackUrl) {
        router.push(decodeURIComponent(callbackUrl))
      } else {
        router.push("/")
      }
    }
  }, [data, isPending, router, searchParams]);

  if (isPending) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <Spinner />
      </div>
    )
  }

  return <LoginForm />
}

const Page = () => {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center h-screen">
        <Spinner />
      </div>
    }>
      <SignInContent />
    </Suspense>
  )
}

export default Page