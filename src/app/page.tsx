import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 bg-gray-50 p-8">
      <h1 className="text-3xl font-bold text-gray-800">勤怠管理システム</h1>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Link href="/stamp" className="w-full text-center bg-green-600 text-white py-4 rounded-lg text-lg font-medium hover:bg-green-700">
          打刻する
        </Link>
        <Link href="/manager/login" className="w-full text-center bg-blue-600 text-white py-4 rounded-lg text-lg font-medium hover:bg-blue-700">
          店長ログイン
        </Link>
        <Link href="/login" className="w-full text-center bg-gray-600 text-white py-4 rounded-lg text-lg font-medium hover:bg-gray-700">
          管理者・社労士ログイン
        </Link>
      </div>
    </main>
  );
}
