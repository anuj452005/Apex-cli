"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
    Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle
} from "@/components/ui/card";
import {
    Form, FormControl, FormField, FormItem, FormLabel, FormMessage
} from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { GithubIcon } from "lucide-react";
import { useState } from "react";

export function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isLoading, setIsLoading] = useState(false);

    const onSocialLogin = async (provider: "github" | "google") => {
        setIsLoading(true);
        try {

            const callbackUrl = searchParams.get("callbackUrl");

            const finalCallbackUrl = callbackUrl || process.env.NEXT_PUBLIC_AUTH_CALLBACK_URL || "https://apex-cli-fr.vercel.app";

            await authClient.signIn.social({
                provider,
                callbackURL: finalCallbackUrl,
            });
        } catch (error) {
            toast.error("Sign in failed. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="relative flex flex-col items-center justify-center min-h-[600px] w-full max-w-xl mx-auto p-4 animate-in fade-in duration-700">
            { }
            <div className="absolute -top-24 -left-24 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl" />
            <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl" />

            <div className="flex flex-col items-center justify-center space-y-6 z-10 w-full">
                <div className="relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                    <Image
                        src={"/login.svg"}
                        alt="Login Illustration"
                        height={400}
                        width={400}
                        className="relative w-64 h-64 md:w-80 md:h-80 drop-shadow-2xl"
                        priority
                    />
                </div>

                <div className="text-center space-y-2">
                    <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-400 bg-[length:200%_auto] animate-gradient">
                        Welcome Back
                    </h1>
                    <p className="text-zinc-400 text-sm md:text-base font-medium max-w-xs mx-auto">
                        Sign in to access your Terminal dashboard
                    </p>
                </div>

                <Card className="w-full bg-zinc-950/40 border-zinc-800/50 backdrop-blur-xl shadow-2xl overflow-hidden">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-lg font-semibold text-zinc-100 italic">Orbital CLI</CardTitle>
                        <CardDescription className="text-zinc-500">Choose your preferred login provider</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <div className="flex flex-col gap-3">
                            <Button
                                variant="outline"
                                className="w-full h-12 bg-zinc-900/50 hover:bg-zinc-800/80 border-zinc-800 text-zinc-100 transition-all duration-200 group relative overflow-hidden"
                                disabled={isLoading}
                                onClick={() => onSocialLogin("github")}
                            >
                                <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                <Image src={"/github.svg"} alt="Github" height={20} width={20} className="mr-2 dark:invert group-hover:scale-110 transition-transform" />
                                <span>Continue With GitHub</span>
                            </Button>

                            <Button
                                variant="outline"
                                className="w-full h-12 bg-zinc-900/50 hover:bg-zinc-800/80 border-zinc-800 text-zinc-100 transition-all duration-200 group relative overflow-hidden"
                                disabled={isLoading}
                                onClick={() => onSocialLogin("google")}
                            >
                                <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                <Image src={"/google.svg"} alt="Google" height={20} width={20} className="mr-2 group-hover:scale-110 transition-transform" />
                                <span>Continue With Google</span>
                            </Button>
                        </div>
                    </CardContent>
                    <CardFooter className="pt-0 justify-center">
                        <p className="text-xs text-zinc-600">
                            By continuing, you agree to our Terms of Service.
                        </p>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}
