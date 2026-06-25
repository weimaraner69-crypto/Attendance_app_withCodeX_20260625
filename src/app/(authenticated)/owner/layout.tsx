import { Button } from '@/components/ui/button'
import { requireAuthenticatedRole } from '@/lib/auth/session'

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  await requireAuthenticatedRole(['owner'])

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="border-b bg-white">
        <div className="max-w-6xl mx-auto px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">オーナー管理画面</h1>
          <form action="/auth/logout" method="post">
            <Button type="submit" variant="outline">ログアウト</Button>
          </form>
        </div>
      </nav>
      <div className="max-w-6xl mx-auto p-8">{children}</div>
    </div>
  )
}
