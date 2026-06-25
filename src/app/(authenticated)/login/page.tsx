'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import type { UserRole } from '@/types'

type SessionResponse =
  | {
      authenticated: true
      profile: {
        role: UserRole
      }
      redirect_path: string
    }
  | {
      authenticated: false
    }

export default function LoginPage() {
  const router = useRouter()
  const [selectedRole, setSelectedRole] = useState<UserRole | ''>('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)

    if (!selectedRole) {
      setErrorMessage('ロールを選択してください')
      return
    }

    const supabase = createSupabaseBrowserClient()

    try {
      setIsLoading(true)
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
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
      if (!session.authenticated) {
        setErrorMessage('ログイン状態を確認できませんでした')
        await supabase.auth.signOut()
        return
      }

      if (session.profile.role !== selectedRole) {
        setErrorMessage('選択したロールとユーザー権限が一致しません')
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
    <main className="min-h-screen flex items-center justify-center p-8 bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>管理者・社労士ログイン</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label>ロール</Label>
              <Select value={selectedRole} onValueChange={(value) => setSelectedRole(value as UserRole)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="選択してください" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">オーナー</SelectItem>
                  <SelectItem value="sr">社労士</SelectItem>
                  <SelectItem value="staff">スタッフ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Input
              type="email"
              placeholder="メールアドレス"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <Input
              type="password"
              placeholder="パスワード"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            {errorMessage && (
              <p className="text-sm text-red-600">{errorMessage}</p>
            )}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'ログイン中...' : 'ログイン'}
            </Button>
          </form>
          <Link href="/" className="block">
            <Button variant="ghost" className="w-full">戻る</Button>
          </Link>
        </CardContent>
      </Card>
    </main>
  )
}
