'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { StampButton } from '@/components/stamp/StampButton'
import { GpsChecker } from '@/components/stamp/GpsChecker'
import { CorrectionRequestForm } from '@/components/stamp/CorrectionRequestForm'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function StaffStampPage({
  params,
}: {
  params: { shopId: string; staffId: string }
}) {
  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">打刻画面</h1>
          <Link href={`/stamp/${params.shopId}`}>
            <Button variant="outline">戻る</Button>
          </Link>
        </div>

        <Tabs defaultValue="stamp" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="stamp">打刻</TabsTrigger>
            <TabsTrigger value="correction">修正申請</TabsTrigger>
          </TabsList>

          <TabsContent value="stamp" className="space-y-6 mt-6">
            <GpsChecker shopId={params.shopId} />
            <StampButton shopId={params.shopId} staffId={params.staffId} />
          </TabsContent>

          <TabsContent value="correction" className="mt-6">
            <CorrectionRequestForm
              shopId={params.shopId}
              staffId={params.staffId}
            />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}
