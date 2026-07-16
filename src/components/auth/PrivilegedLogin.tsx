'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import type { UserRole } from '@/types'

type LoginVariant = 'manager' | 'admin'
type Screen = 'checking' | 'password' | 'pin' | 'pin-setup'

type LoginResponse = {
  authenticated: true
  requires_pin_setup?: boolean
  profile: {
    role: UserRole
    display_name: string
  }
  redirect_path?: string
} | {
  authenticated: false
  message?: string
  password_required?: boolean
}

type PinStatusResponse = {
  pin_available: boolean
  profile?: {
    role: UserRole
    display_name: string
  }
  expires_at?: string
}

const roleLabels: Record<UserRole, string> = {
  owner: 'オーナー',
  manager: '店長',
  sr: '社労士',
  staff: 'スタッフ',
}

function roleAllowed(variant: LoginVariant, role: UserRole) {
  return variant === 'manager' ? role === 'manager' : role !== 'manager'
}

function getResponseMessage(response: LoginResponse, fallback: string) {
  return response.authenticated ? fallback : response.message ?? fallback
}

export function PrivilegedLogin({ variant }: { variant: LoginVariant }) {
  const router = useRouter()
  const [screen, setScreen] = useState<Screen>('checking')
  const [selectedRole, setSelectedRole] = useState<UserRole | ''>(
    variant === 'manager' ? 'manager' : ''
  )
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pin, setPin] = useState('')
  const [pinConfirmation, setPinConfirmation] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [pinExpiresAt, setPinExpiresAt] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    void fetch('/api/auth/pin/status', { cache: 'no-store' })
      .then(async (response) => (await response.json()) as PinStatusResponse)
      .then((status) => {
        if (!active) return

        if (
          status.pin_available &&
          status.profile &&
          roleAllowed(variant, status.profile.role)
        ) {
          setSelectedRole(status.profile.role)
          setDisplayName(status.profile.display_name)
          setPinExpiresAt(status.expires_at ?? null)
          setScreen('pin')
          return
        }

        setScreen('password')
      })
      .catch(() => {
        if (active) setScreen('password')
      })

    return () => {
      active = false
    }
  }, [variant])

  const resetError = () => setErrorMessage(null)

  const finishLogin = async (session: LoginResponse) => {
    if (!session.authenticated || !session.redirect_path) {
      setErrorMessage(session.authenticated ? 'ログイン先を確認できませんでした' : session.message ?? 'ログインできませんでした')
      return
    }
    if (
      variant === 'manager' &&
      session.profile.role === 'manager' &&
      session.redirect_path === '/manager/login'
    ) {
      setErrorMessage('担当店舗が設定されていません')
      return
    }

    const nextPath = new URLSearchParams(window.location.search).get('next')
    const safeNextPath =
      nextPath?.startsWith('/') && !nextPath.startsWith('//') ? nextPath : null
    router.replace(session.profile.role === 'staff' && safeNextPath ? safeNextPath : session.redirect_path)
    router.refresh()
  }

  const handlePasswordLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    resetError()

    if (!selectedRole) {
      setErrorMessage('ロールを選択してください')
      return
    }

    const supabase = createSupabaseBrowserClient()

    try {
      setIsLoading(true)
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setErrorMessage('メールアドレスまたはパスワードが違います')
        return
      }

      if (selectedRole === 'staff') {
        const response = await fetch('/api/auth/session', { cache: 'no-store' })
        const session = (await response.json()) as LoginResponse
        if (
          !response.ok ||
          !session.authenticated ||
          session.profile.role !== selectedRole
        ) {
          setErrorMessage('選択したロールとユーザー権限が一致しません')
          await supabase.auth.signOut()
          return
        }
        await finishLogin(session)
        return
      }

      const response = await fetch('/api/auth/password/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expected_role: selectedRole }),
      })
      const session = (await response.json()) as LoginResponse
      if (!response.ok || !session.authenticated) {
        setErrorMessage(getResponseMessage(session, 'ログインユーザーの権限情報を取得できませんでした'))
        await supabase.auth.signOut()
        return
      }

      if (session.requires_pin_setup) {
        setDisplayName(session.profile.display_name)
        setPin('')
        setPinConfirmation('')
        setScreen('pin-setup')
        return
      }

      await finishLogin(session)
    } finally {
      setIsLoading(false)
    }
  }

  const handlePinUnlock = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    resetError()

    try {
      setIsLoading(true)
      const response = await fetch('/api/auth/pin/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      const session = (await response.json()) as LoginResponse

      if (!response.ok || !session.authenticated) {
        if (!session.authenticated && session.password_required) {
          setPin('')
          setScreen('password')
        }
        setErrorMessage(getResponseMessage(session, 'PINでログインできませんでした'))
        return
      }

      await finishLogin(session)
    } finally {
      setIsLoading(false)
    }
  }

  const handlePinSetup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    resetError()

    try {
      setIsLoading(true)
      const response = await fetch('/api/auth/pin/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin,
          pin_confirmation: pinConfirmation,
        }),
      })
      const session = (await response.json()) as LoginResponse

      if (!response.ok || !session.authenticated) {
        setErrorMessage(getResponseMessage(session, 'PINを設定できませんでした'))
        return
      }

      await finishLogin(session)
    } finally {
      setIsLoading(false)
    }
  }

  const title = variant === 'manager' ? '店長ログイン' : '管理者・社労士ログイン'

  if (screen === 'checking') {
    return (
      <main className="min-h-screen flex items-center justify-center p-8 bg-gray-50">
        <p className="text-sm text-gray-600">ログイン状態を確認しています...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-8 bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>
            {screen === 'pin' && `${displayName}さんの4桁PINを入力してください`}
            {screen === 'pin-setup' && `${displayName}さんの次回ログイン用PINを設定してください`}
            {screen === 'password' && 'メールアドレスとパスワードで本人確認します'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {screen === 'pin' && (
            <form onSubmit={handlePinUnlock} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-pin">PIN（4桁）</Label>
                <Input
                  id="login-pin"
                  type="password"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{4}"
                  maxLength={4}
                  value={pin}
                  onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))}
                  className="text-center text-2xl tracking-[0.5em]"
                  autoFocus
                  required
                />
              </div>
              {pinExpiresAt && (
                <p className="text-xs text-gray-500">
                  PINログイン有効期限: {new Date(pinExpiresAt).toLocaleString('ja-JP')}
                </p>
              )}
              {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
              <Button type="submit" className="w-full" disabled={isLoading || pin.length !== 4}>
                {isLoading ? '確認中...' : 'PINでログイン'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  resetError()
                  setPin('')
                  setScreen('password')
                }}
              >
                メールアドレスでログイン
              </Button>
            </form>
          )}

          {screen === 'pin-setup' && (
            <form onSubmit={handlePinSetup} className="space-y-4">
              <p className="text-sm text-gray-600">
                このPINは同じ端末で6時間以内に再ログインするときだけ使用できます。
              </p>
              <div className="space-y-2">
                <Label htmlFor="new-login-pin">新しいPIN（4桁）</Label>
                <Input
                  id="new-login-pin"
                  type="password"
                  inputMode="numeric"
                  autoComplete="new-password"
                  pattern="[0-9]{4}"
                  maxLength={4}
                  value={pin}
                  onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-login-pin">PINをもう一度入力</Label>
                <Input
                  id="confirm-login-pin"
                  type="password"
                  inputMode="numeric"
                  autoComplete="new-password"
                  pattern="[0-9]{4}"
                  maxLength={4}
                  value={pinConfirmation}
                  onChange={(event) => setPinConfirmation(event.target.value.replace(/\D/g, '').slice(0, 4))}
                  required
                />
              </div>
              {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || pin.length !== 4 || pinConfirmation.length !== 4}
              >
                {isLoading ? '設定中...' : 'PINを設定してログイン'}
              </Button>
            </form>
          )}

          {screen === 'password' && (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              {variant === 'admin' && (
                <div className="space-y-2">
                  <Label>ロール</Label>
                  <Select
                    value={selectedRole}
                    onValueChange={(value) => setSelectedRole(value as UserRole)}
                  >
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
              )}
              <div className="space-y-2">
                <Label htmlFor="email">メールアドレス</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">パスワード</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>
              {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'ログイン中...' : 'ログイン'}
              </Button>
            </form>
          )}

          <Link
            href="/"
            className={buttonVariants({ variant: 'ghost', className: 'w-full' })}
          >
            トップページに戻る
          </Link>
          {screen === 'pin' && selectedRole && (
            <p className="text-center text-xs text-gray-500">
              {roleLabels[selectedRole]}としてログイン
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
