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

    const response = await adminMessaging.sendEachForMulticast(message);
    
    // Telegram Notification
    const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
    const telegramChatId = process.env.TELEGRAM_CHAT_ID;
    
    if (telegramBotToken && telegramChatId) {
      try {
        const text = `🚨 *${title}*\n\n${body}\n\n[Open Venzop Agent](${url || 'https://agent.venzop.com'})`;
        await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: telegramChatId,
            text,
            parse_mode: 'Markdown',
          }),
        });
      } catch (telegramError) {
        console.error('Failed to send Telegram notification:', telegramError);
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      successCount: response.successCount,
      failureCount: response.failureCount
    });
  } catch (error: any) {
    console.error('Error sending push notification:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
