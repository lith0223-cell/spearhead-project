import { Client } from "@upstash/qstash";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  if (!process.env.QSTASH_TOKEN || !process.env.NEXT_PUBLIC_APP_URL) {
    return NextResponse.json({ error: "QStash not configured" }, { status: 503 });
  }

  const qstash = new Client({ token: process.env.QSTASH_TOKEN, baseUrl: process.env.QSTASH_URL });
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL;

  try {
    const { subscription, endTime, exerciseName, routineId, cancelMessageId } = await req.json();

    if (!subscription || !endTime) {
      return NextResponse.json({ error: "subscription과 endTime이 필요합니다" }, { status: 400 });
    }

    // 이전 QStash 메시지 취소 (새 타이머 시작 시 기존 예약 제거)
    if (cancelMessageId) {
      try {
        await qstash.messages.delete(cancelMessageId);
      } catch {
        // 이미 처리된 메시지일 수 있으므로 무시
      }
    }

    const delaySec = Math.max(1, Math.round((endTime - Date.now()) / 1000));

    const response = await qstash.publishJSON({
      url: `${APP_URL}/api/push/send`,
      delay: delaySec,
      body: { subscription, exerciseName: exerciseName ?? "운동", routineId },
    });

    return NextResponse.json({ ok: true, messageId: response.messageId });
  } catch (e) {
    console.error("[push/schedule]", e);
    return NextResponse.json({ error: "스케줄 등록 실패" }, { status: 500 });
  }
}

// 타이머 취소만 할 때 사용
export async function DELETE(req: NextRequest) {
  if (!process.env.QSTASH_TOKEN) {
    return NextResponse.json({ ok: true });
  }
  const qstash = new Client({ token: process.env.QSTASH_TOKEN, baseUrl: process.env.QSTASH_URL });
  try {
    const { messageId } = await req.json();
    if (messageId) {
      await qstash.messages.delete(messageId);
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true }); // 이미 처리됐을 수 있으므로 항상 ok
  }
}
