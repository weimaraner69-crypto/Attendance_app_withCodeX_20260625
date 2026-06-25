import { redirect } from 'next/navigation';

export default function StaffStampPage({
  params,
}: {
  params: { shopId: string; staffId: string };
}) {
  redirect(`/stamp/${params.shopId}`);
}
