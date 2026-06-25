import { requireManagerStore } from '@/lib/auth/session';

export default async function ManagerStoreLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { storeId: string };
}) {
  await requireManagerStore(params.storeId);

  return children;
}
