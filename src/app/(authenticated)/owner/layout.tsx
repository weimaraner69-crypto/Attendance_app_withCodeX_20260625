import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="border-b bg-white">
        <div className="max-w-6xl mx-auto px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">オーナー管理画面</h1>
          <Link href="/login">
            <Button variant="outline">ログアウト</Button>
          </Link>
        </div>
      </nav>
      <div className="max-w-6xl mx-auto p-8">{children}</div>
    </div>
  )
}
