import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminMessaging } from '@/lib/firebaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const { title, body, url } = await req.json();

    if (!title || !body) {
      return NextResponse.json({ error: 'Missing title or body' }, { status: 400 });
    }

    // Fetch all registered agent tokens
    const tokensSnapshot = await adminDb.collection('agentFcmTokens').get();
    
    if (tokensSnapshot.empty) {
      return NextResponse.json({ message: 'No registered agents to notify' }, { status: 200 });
    }

    const tokens: string[] = [];
    tokensSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.token) {
        tokens.push(data.token);
      }
    });

    if (tokens.length === 0) {
      return NextResponse.json({ message: 'No valid tokens found' }, { status: 200 });
    }

    // Send multicast message
    const message = {
      notification: {
        title,
        body,
      },
      webpush: {
        fcmOptions: {
          link: url || 'https://agent.venzop.com',
        },
      },
      tokens,
    };

    const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
    const telegramChatId = process.env.TELEGRAM_CHAT_ID;
    
    const tasks: Promise<any>[] = [
      adminMessaging.sendEachForMulticast(message)
    ];

    if (telegramBotToken && telegramChatId) {
      const text = `🚨 *${title}*\n\n${body}\n\n[Open Venzop Agent](${url || 'https://agent.venzop.com'})`;
      tasks.push(
        fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: telegramChatId,
            text,
            parse_mode: 'Markdown',
          }),
        }).catch((err) => console.error('Telegram error:', err))
      );
    }
    
    const results = await Promise.allSettled(tasks);
    const fcmResult = results[0].status === 'fulfilled' ? results[0].value : { successCount: 0, failureCount: 0 };
    
    return NextResponse.json({ 
      success: true, 
      successCount: fcmResult.successCount || 0,
      failureCount: fcmResult.failureCount || 0
    });
  } catch (error: any) {
    console.error('Error sending push notification:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
