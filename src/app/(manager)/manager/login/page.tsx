'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

const loginSchema = z.object({
  email: z.string().email('有効なメールアドレスを入力してください'),
  password: z.string().min(6, 'パスワードは6文字以上必要です'),
})

type LoginFormData = z.infer<typeof loginSchema>

type SessionResponse = {
  authenticated: true
  profile: {
    role: string
  }
  redirect_path: string
} | {
  authenticated: false
}

export default function ManagerLoginPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginFormData) => {
    setErrorMessage(null)
    const supabase = createSupabaseBrowserClient()

    try {
      setIsLoading(true)
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      })

      if (error) {
        setErrorMessage('メールアドレスまたはパスワードが違います')
        return
      }

      const response = await fetch('/api/auth/session')
      if (!response.ok) {
        setErrorMessage('ログインユーザーの権限情報を取得できませんでした')
        await supabase.auth.signOut()
        return
      }

      const session = (await response.json()) as SessionResponse
      if (!session.authenticated || session.profile.role !== 'manager') {
        setErrorMessage('店長権限のユーザーでログインしてください')
        await supabase.auth.signOut()
        return
      }

      if (session.redirect_path === '/manager/login') {
        setErrorMessage('担当店舗が設定されていません')
        await supabase.auth.signOut()
        return
      }

      router.replace(session.redirect_path)
      router.refresh()
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>店長ログイン</CardTitle>
          <CardDescription>店長用管理画面にログインします</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">メールアドレス</Label>
              <Input
                id="email"
                type="email"
                placeholder="example@example.com"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">パスワード</Label>
              <Input
                id="password"
                type="password"
                placeholder="パスワードを入力"
                {...register('password')}
              />
              {errors.password && (
                <p className="text-sm text-red-500">{errors.password.message}</p>
              )}
            </div>

            {errorMessage && (
              <p className="text-sm text-red-600">{errorMessage}</p>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'ログイン中...' : 'ログイン'}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t">
            <Link href="/" className="block">
              <Button variant="ghost" className="w-full">
                トップページに戻る
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
