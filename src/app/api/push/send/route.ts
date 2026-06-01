import webpush from "web-push";
import { Receiver } from "@upstash/qstash";
import { NextRequest, NextResponse } from "next/server";

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function POST(req: NextRequest) {
  // QStash 서명 검증 — QStash에서만 호출 가능하도록 보안 처리
  const signature = req.headers.get("upstash-signature") ?? "";
  const body = await req.text();

  if (process.env.QSTASH_CURRENT_SIGNING_KEY && process.env.QSTASH_NEXT_SIGNING_KEY) {
    const receiver = new Receiver({
      currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
      nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY,
    });
    try {
      await receiver.verify({ signature, body, url: `${process.env.NEXT_PUBLIC_APP_URL}/api/push/send` });
    } catch {
      return NextResponse.json({ error: "서명 검증 실패" }, { status: 401 });
    }
  }

  const { subscription, exerciseName } = JSON.parse(body);

  if (!subscription) {
    return NextResponse.json({ error: "subscription이 없습니다" }, { status: 400 });
  }

  try {
    await webpush.sendNotification(
      subscription,
      JSON.stringify({
        title: "⏰ 휴식 종료!",
        body: `${exerciseName ?? "운동"} 다음 세트를 시작하세요!`,
        icon: "/icon-192x192.png",
        badge: "/icon-192x192.png",
        vibrate: [200, 100, 200, 100, 200],
        tag: "rest-timer",
        requireInteraction: true,
      })
    );
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    // 구독이 만료됐거나 취소된 경우 (410 Gone) → 정상 처리
    const err = e as { statusCode?: number };
    if (err?.statusCode === 410 || err?.statusCode === 404) {
      return NextResponse.json({ ok: true, reason: "subscription expired" });
    }
    console.error("[push/send]", e);
    return NextResponse.json({ error: "push 발송 실패" }, { status: 500 });
  }
}
