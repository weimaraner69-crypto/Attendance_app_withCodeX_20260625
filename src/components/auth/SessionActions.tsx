import { Button } from '@/components/ui/button'

export function SessionActions() {
  return (
    <div className="flex items-center gap-2">
      <form action="/auth/lock" method="post">
        <Button type="submit" variant="outline">画面をロック</Button>
      </form>
      <form action="/auth/logout" method="post">
        <Button type="submit" variant="ghost">完全ログアウト</Button>
      </form>
    </div>
  )
}
