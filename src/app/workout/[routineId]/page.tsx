import WorkoutClient from "./WorkoutClient";

// 이 라우트는 클라이언트 라우팅으로만 진입하며 SSR 시 prerender 대상이 아님.
// "use client" 페이지에서는 dynamic 메타데이터가 적용되지 않으므로 server wrapper에서 명시.
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ routineId: string }> }) {
  const { routineId } = await params;
  return <WorkoutClient routineId={routineId} />;
}
