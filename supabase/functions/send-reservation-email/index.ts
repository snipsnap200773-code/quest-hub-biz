import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// LINE通知用の定数
const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";

// 💡 プレースホルダー置換用の共通関数
function applyPlaceholders(template: string, data: any) {
  if (!template) return "";
  return template
    .replace(/{name}/g, data.customerName || "")
    .replace(/{shop_name}/g, data.shopName || "")
    .replace(/{start_time}/g, data.startTime || "")
    .replace(/{services}/g, data.services || "")
    .replace(/{cancel_url}/g, data.cancelUrl || "")
    .replace(/{official_url}/g, data.officialUrl || "");
}

// 💡 LINE送信用の共通関数（トークンを引数で受け取るように拡張）
async function safePushToLine(to: string, text: string, token: string, targetName: string) {
  if (!to || !token) return null;
  try {
    const res = await fetch(LINE_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ to, messages: [{ type: 'text', text }] }),
    });
    return res.ok;
  } catch (err) {
    console.error(`[${targetName}] LINE Push Error:`, err);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload = await req.json();
    const { 
      type,               // 'welcome' or 'remind_all' or 'cancel' or undefined (normal)
      shopId,             // 共通
      customerEmail,      // 予約用
      customerName,       // 予約用
      shopName,           // 共通
      startTime,          // 予約用
      services,           // 予約用
      shopEmail,          // 予約用
      cancelUrl,          // 予約用
      lineUserId,         // 予約用
      notifyLineEnabled,  // 予約用
      owner_email,
      dashboard_url,
      reservations_url,
      reserve_url,
      password,
      ownerName,
      phone: ownerPhone,
      businessType
    } = payload;
    
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? "";
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? "";
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ==========================================
    // 🆕 パターンC：一斉リマインド送信 (既存ロジック完全維持 + カスタム対応)
    // ==========================================
    if (type === 'remind_all') {
      const nowJST = new Date(new Date().getTime() + (9 * 60 * 60 * 1000));
      
      const currentHour = nowJST.getUTCHours();
      if (currentHour >= 23 || currentHour < 9) {
        return new Response(JSON.stringify({ 
          message: `現在は日本時間 ${currentHour}時 のため、深夜・早朝の送信を控えます。9時以降の実行時に送信されます。` 
        }), { headers: corsHeaders });
      }

      const tomorrowJST = new Date(nowJST);
      tomorrowJST.setDate(tomorrowJST.getDate() + 1);
      const dateStr = tomorrowJST.toISOString().split('T')[0];

      const { data: resList, error: resError } = await supabaseAdmin
        .from('reservations')
        .select('*, profiles(*)')
        .gte('start_time', `${dateStr}T00:00:00.000Z`)
        .lte('start_time', `${dateStr}T23:59:59.999Z`)
        .eq('remind_sent', false)
        .eq('res_type', 'normal');

      if (resError) throw resError;
      if (!resList || resList.length === 0) {
        return new Response(JSON.stringify({ message: 'リマインド対象なし' }), { headers: corsHeaders });
      }

      const report = [];

      for (const res of resList) {
        const shop = res.profiles;
        
        // 🛑 メールのリマインドが無効ならメールのみスキップ
        if (shop.notify_mail_remind_enabled === false) {
           await supabaseAdmin.from('reservations').update({ remind_sent: true }).eq('id', res.id);
           report.push({ id: res.id, email: "disabled", line: "check" });
           continue; 
        }

        const resTime = new Date(res.start_time).toLocaleTimeString('ja-JP', { 
          timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' 
        });
        
        // 🆕 💡 1名予約なら番号なしにするスマートロジック (完全維持)
        const isMulti = res.options?.people && res.options.people.length > 1;
        const menuDisplayHtml = isMulti 
          ? res.options.people.map((p: any, i: number) => `${i + 1}人目: ${p.services.map((s: any) => s.name).join(', ')}`).join('<br>')
          : (res.options?.people?.[0]?.services?.map((s: any) => s.name).join(', ') || res.customer_name);
        const menuDisplayText = isMulti 
          ? res.options.people.map((p: any, i: number) => `${i + 1}人目: ${p.services.map((s: any) => s.name).join(', ')}`).join('\n')
          : (res.options?.people?.[0]?.services?.map((s: any) => s.name).join(', ') || res.customer_name);

        const placeholderData = { customerName: res.customer_name, shopName: shop.business_name, startTime: `${dateStr.replace(/-/g, '/')} ${resTime}〜`, services: menuDisplayText, cancelUrl: '', officialUrl: shop.custom_official_url };

        // 文章の決定
        let subject = `【リマインド】明日のお越しをお待ちしております（${shop.business_name}）`;
        let html = "";

        if (shop.mail_sub_customer_remind && shop.mail_body_customer_remind) {
          subject = applyPlaceholders(shop.mail_sub_customer_remind, placeholderData);
          const body = applyPlaceholders(shop.mail_body_customer_remind, placeholderData).replace(/\n/g, '<br>');
          html = `<div style="font-family: sans-serif; color: #333; line-height: 1.6;">${body}</div>`;
        } else {
          html = `
            <div style="font-family: sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; padding: 25px; border-radius: 12px;">
              <h2 style="color: #2563eb;">明日、ご来店をお待ちしております</h2>
              <p>${res.customer_name} 様</p>
              <p>いつもご利用ありがとうございます。ご予約日の前日となりましたので、念のためご確認のご連絡です。</p>
              <div style="background: #f8fafc; padding: 20px; border-radius: 10px; border: 1px solid #e2e8f0; margin: 20px 0;">
                <p style="margin: 5px 0;">📅 <strong>日時:</strong> ${dateStr.replace(/-/g, '/')} ${resTime}〜</p>
                <p style="margin: 5px 0;">📋 <strong>内容:</strong><br>${menuDisplayHtml}</p>
                <p style="margin: 5px 0;">📍 <strong>場所:</strong> ${shop.address || '店舗までお越しください'}</p>
              </div>
              <p style="font-size: 0.85rem; color: #64748b;">※キャンセルの場合は、店舗へお電話にてご連絡ください。</p>
            </div>`;
        }

        const mailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
          body: JSON.stringify({ from: `${shop.business_name} <infec@snipsnap.biz>`, to: [res.customer_email], subject: subject, html: html })
        });

        let lineOk = false;
        if (shop.notify_line_remind_enabled && shop.line_channel_access_token && res.line_user_id) {
          const lineText = `【リマインド】\n明日 ${resTime} よりご予約を承っております。\n\nお名前：${res.customer_name} 様\n店舗：${shop.business_name}\n\n📋 内容：\n${menuDisplayText}\n\nお気をつけてお越しくださいませ！`;
          lineOk = await safePushToLine(res.line_user_id, lineText, shop.line_channel_access_token, "REMIND");
        }

        await supabaseAdmin.from('reservations').update({ remind_sent: true }).eq('id', res.id);
        report.push({ id: res.id, email: mailRes.ok, line: lineOk });
      }

      return new Response(JSON.stringify({ report }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ==========================================
    // 🚀 パターンA：店主様への歓迎メール ＆ 三土手さんへの通知送信 (既存ロジック完全維持)
    // ==========================================
    if (type === 'welcome') {
      const welcomeRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({
          from: 'SOLO 運営事務局 <infec@snipsnap.biz>',
          to: [owner_email],
          subject: `【SOLO】ベータ版へのご登録ありがとうございます！`,
          html: `
            <div style="font-family: sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; padding: 30px; border-radius: 12px;">
              <h1 style="color: #2563eb; font-size: 1.5rem; margin-top: 0;">${shopName} 様</h1>
              <p>この度は <strong>SOLO</strong> にお申し込みいただき、誠にありがとうございます。</p>
              <div style="background: #f1f5f9; padding: 20px; border-radius: 10px; margin: 25px 0;">
                <h2 style="font-size: 1rem; margin-top: 0; color: #1e293b; border-bottom: 2px solid #cbd5e1; padding-bottom: 8px;">🔑 管理者用ログイン情報</h2>
                <p style="margin: 15px 0 5px 0;"><strong>● 設定画面</strong><br><a href="${dashboard_url}">${dashboard_url}</a></p>
                <p style="margin: 15px 0 5px 0;"><strong>● 予約台帳</strong><br><a href="${reservations_url}">${reservations_url}</a></p>
                <p style="margin: 15px 0 5px 0;"><strong>● パスワード</strong><br><span style="color: #e11d48; font-weight: bold;">${password}</span></p>
              </div>
              <div style="background: #f0fdf4; padding: 20px; border-radius: 10px; margin: 25px 0; border: 1px solid #bbf7d0;">
                <h2 style="font-size: 1rem; margin-top: 0; color: #166534; border-bottom: 2px solid #bbf7d0; padding-bottom: 8px;">📅 お客様用 予約URL</h2>
                <p><a href="${reserve_url}" style="color: #15803d; font-weight: bold;">${reserve_url}</a></p>
              </div>
            </div>`,
        }),
      });

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({
          from: 'SOLO システム通知 <infec@snipsnap.biz>',
          to: ['snipsnap.2007.7.3@gmail.com'],
          subject: `【新規申込】${shopName} 様が利用を開始しました`,
          html: `
            <div style="font-family: sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 2px solid #2563eb; padding: 25px; border-radius: 12px;">
              <h2 style="color: #2563eb; margin-top: 0;">🚀 新規ベータ版申し込み通知</h2>
              <p>運営事務局 三土手様、お疲れ様です。新しい店舗の登録がありました！</p>
              <div style="background: #f8fafc; padding: 20px; border-radius: 10px; border: 1px solid #e2e8f0; margin: 20px 0;">
                <p style="margin: 5px 0;">🏪 <strong>店舗名:</strong> ${shopName} 様</p>
                <p style="margin: 5px 0;">👤 <strong>代表者:</strong> ${ownerName || '未入力'} 様</p>
                <p style="margin: 5px 0;">🏢 <strong>業種:</strong> ${businessType || '未選択'}</p>
              </div>
            </div>`,
        }),
      });

      const welcomeData = await welcomeRes.json();
      return new Response(JSON.stringify(welcomeData), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ==========================================
    // 🚀 パターンB・D・E：予約完了 ＆ キャンセル通知 (5パターン対応版)
    // ==========================================
    const { data: shopProfile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', shopId)
      .single();

    const currentToken = shopProfile?.line_channel_access_token;
    const currentAdminId = shopProfile?.line_admin_user_id;

    const sendMail = async (to: string, isOwner: boolean) => {
      const placeholderData = { customerName, shopName, startTime, services, cancelUrl, officialUrl: shopProfile.custom_official_url || "" };
      
      let finalSubject = "";
      let finalHtml = "";

      // 🔄 5つのパターンの出し分けロジック
      if (type === 'cancel') {
        // --- 【キャンセル処理】 ---
        if (isOwner) {
          // ④ 店舗宛：キャンセル通知
          const customSub = shopProfile.mail_sub_shop_cancel;
          const customBody = shopProfile.mail_body_shop_cancel;
          finalSubject = applyPlaceholders(customSub || `【キャンセル通知】${customerName} 様`, placeholderData);
          const body = applyPlaceholders(customBody || `${shopName} 管理者様\n\n以下の予約がキャンセルされました。\n\nお客様: ${customerName} 様\n日時: ${startTime}\nメニュー: ${services}`, placeholderData).replace(/\n/g, '<br>');
          finalHtml = `<div style="font-family: sans-serif; color: #333; line-height: 1.6;">${body}</div>`;
        } else {
          // ③ お客様宛：キャンセル完了
          const customSub = shopProfile.mail_sub_customer_cancel;
          const customBody = shopProfile.mail_body_customer_cancel;
          finalSubject = applyPlaceholders(customSub || `キャンセル完了のお知らせ（${shopName}）`, placeholderData);
          const body = applyPlaceholders(customBody || `${customerName} 様\n\nご予約のキャンセル手続きが完了いたしました。\nまたのご利用を心よりお待ちしております。`, placeholderData).replace(/\n/g, '<br>');
          finalHtml = `<div style="font-family: sans-serif; color: #333; line-height: 1.6;">${body}</div>`;
        }
      } else {
        // --- 【予約完了処理】 ---
        if (isOwner) {
          // ⑤ 店舗宛：新着予約通知
          const customSub = shopProfile.mail_sub_shop_booking;
          const customBody = shopProfile.mail_body_shop_booking;
          finalSubject = applyPlaceholders(customSub || `【新着予約】${customerName} 様`, placeholderData);
          const body = applyPlaceholders(customBody || `${shopName} 管理者様\n\n新しい予約が入りました。\n\nお客様: ${customerName} 様\n日時: ${startTime}\nメニュー: ${services}`, placeholderData).replace(/\n/g, '<br>');
          finalHtml = `<div style="font-family: sans-serif; color: #333; line-height: 1.6;">${body}</div>`;
        } else {
          // ① お客様宛：予約完了（カスタム or 標準カード）
          const customSub = shopProfile.mail_sub_customer_booking;
          const customBody = shopProfile.mail_body_customer_booking;
          
          if (customSub && customBody) {
            finalSubject = applyPlaceholders(customSub, placeholderData);
            const body = applyPlaceholders(customBody, placeholderData).replace(/\n/g, '<br>');
            finalHtml = `<div style="font-family: sans-serif; color: #333; line-height: 1.6;">${body}</div>`;
          } else {
            // 三土手さん設計のオリジナル標準カード
            finalSubject = `予約完了のお知らせ：${customerName} 様`;
            finalHtml = `
              <div style="font-family: sans-serif; color: #333; line-height: 1.6;">
                <h2 style="color: #2563eb;">予約完了のお知らせ</h2>
                <p><strong>${customerName} 様</strong></p>
                <p>この度は ${shopName} をご利用いただきありがとうございます。</p>
                <div style="background: #f8fafc; padding: 20px; border-radius: 10px; border: 1px solid #e2e8f0; margin: 20px 0;">
                  <p style="margin: 5px 0;">👤 <strong>お客様:</strong> ${customerName} 様</p>
                  <p style="margin: 5px 0;">📅 <strong>日時:</strong> ${startTime}</p>
                  <p style="margin: 5px 0;">📋 <strong>メニュー:</strong> ${services}</p>
                </div>
                ${cancelUrl ? `
                <div style="background: #f1f5f9; padding: 15px; border-radius: 10px; border: 1px solid #e2e8f0; margin: 20px 0;">
                  <p style="margin: 0; font-weight: bold; color: #64748b;">■ ご予約のキャンセル・変更について</p>
                  <p style="margin: 10px 0 0 0; font-size: 0.85rem; color: #64748b;">
                    ご予定が変わられた場合は、以下のリンクよりお手続きをお願いいたします。<br>
                    <a href="${cancelUrl}" style="color: #2563eb; text-decoration: underline;">ご予約のキャンセルはこちら</a>
                  </p>
                </div>` : ''}
                <p>ご確認のほど, よろしくお願いいたします。</p>
              </div>`;
          }
        }
      }

      return await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({ from: `${shopName} <infec@snipsnap.biz>`, to: [to], subject: finalSubject, html: finalHtml }),
      });
    };

    let customerResData = null;
    if (customerEmail) {
      const customerRes = await sendMail(customerEmail, false);
      customerResData = await customerRes.json();
    }
    let shopResData = null;
    if (shopEmail && shopEmail !== 'admin@example.com') {
      const shopRes = await sendMail(shopEmail, true);
      shopResData = await shopRes.json();
    }

    // LINE通知 (既存ロジック維持)
    let customerLineSent = false;
    let shopLineSent = false;

    if (lineUserId && currentToken) {
      const customerMsg = type === 'cancel' 
        ? `【キャンセル完了】\n${customerName} 様、予約のキャンセル手続きが完了いたしました。\nまたのご利用をお待ちしております。`
        : `${customerName}様\n\nご予約ありがとうございます。\n以下の内容で承りました。\n\n📅 日時: ${startTime}〜\n📋 メニュー: ${services}\n\nご来店を心よりお待ちしております！\n\n■キャンセル・変更について\n${cancelUrl}`;
      customerLineSent = await safePushToLine(lineUserId, customerMsg, currentToken, "CUSTOMER");
    }

    if (notifyLineEnabled !== false && currentToken && currentAdminId) {
      const shopMsg = type === 'cancel'
        ? `【予約キャンセル通知】\n\n👤 お客様: ${customerName} 様\n📅 日時: ${startTime}〜\n📋 メニュー: ${services}\n\nご確認をお願いいたします。`
        : `【新着予約】\n\n👤 お客様: ${customerName} 様\n📅 日時: ${startTime}〜\n📋 メニュー: ${services}\n\nご確認をお願いいたします。`;
      shopLineSent = await safePushToLine(currentAdminId, shopMsg, currentToken, "SHOP_OWNER");
    }

    return new Response(JSON.stringify({ 
      customerEmail: customerResData, 
      shopEmail: shopResData,
      customerLine: customerLineSent,
      shopLine: shopLineSent
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error("Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});