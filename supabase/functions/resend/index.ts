import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// LINE通知用の定数
const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";

// 🆕 1. 訪問型判定キーワード
const VISIT_KEYWORDS = ['訪問', '出張', '代行', 'デリバリー', '清掃'];

// 🆕 2. 訪問型専用のデフォルト文章
const VISIT_DEFAULTS = {
  booking_sub: "【予約確定】訪問当日にお伺いするのを楽しみにしております",
  booking_body: "{name} 様\n\nご予約ありがとうございます。当日はご指定の場所へお伺いいたします。\n\n📅 日時: {start_time}\n📍 訪問先: {address}\n📋 メニュー: {services}\n👤 担当: {staff_name}",
  remind_sub: "【リマインド】明日、ご指定の場所へお伺いいたします",
  remind_body: "{name} 様\n\n明日のご予約確認です。お約束の時間にお伺いいたします。\n\n📅 日時: {start_time}\n📍 訪問先: {address}\n📋 メニュー: {services}\n\n当日、道中の状況により多少前後する場合はお電話いたします。",
};

// 🆕 3. 来店型（従来通り）のデフォルト文章
const STORE_DEFAULTS = {
  booking_sub: "【予約確定】ご来店をお待ちしております",
  booking_body: "{name} 様\n\nご予約ありがとうございます。当日お会いできるのを楽しみにしております。\n\n📅 日時: {start_time}\n🏨 場所: {shop_name}\n📋 メニュー: {services}\n👤 担当: {staff_name}",
  remind_sub: "【リマインド】明日、ご来店を心よりお待ちしております",
  remind_body: "{name} 様\n\n明日のご予約確認です。お気をつけてお越しくださいませ。\n\n📅 日時: {start_time}\n🏨 場所: {shop_name}\n📋 メニュー: {services}",
};

// 💡 プレースホルダー置換用の共通関数（全項目対応版）
function applyPlaceholders(template: string, data: any) {
  if (!template) return "";
  return template
    .replace(/{name}/g, data.customerName || "")
    .replace(/{furigana}/g, data.furigana || "")
    .replace(/{shop_name}/g, data.shopName || "")
    .replace(/{start_time}/g, data.startTime || "")
    .replace(/{staff_name}/g, data.staffName || "担当者なし")
    .replace(/{services}/g, data.services || "")
    .replace(/{address}/g, data.address || "")
    .replace(/{parking}/g, data.parking || "")
    .replace(/{building_type}/g, data.buildingType || "")
    .replace(/{care_notes}/g, data.careNotes || "")
    .replace(/{company_name}/g, data.companyName || "")
    .replace(/{symptoms}/g, data.symptoms || "")
    .replace(/{request_details}/g, data.requestDetails || "")
    .replace(/{notes}/g, data.notes || "")
    .replace(/{details}/g, data.details || "")
    .replace(/{cancel_url}/g, data.cancelUrl || "")
    .replace(/{official_url}/g, data.officialUrl || "");
}
// 💡 LINE送信用の共通関数（三土手さん本家ロジック）
async function safePushToLine(to: string, text: string, token: string, targetName: string) {
  if (!to || !token) return null;
  try {
    const res = await fetch(LINE_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ to, messages: [{ type: 'text', text }] }),
    });
    return res.ok;
  } catch (err) {
    console.error(`[${targetName}] LINE Push Error:`, err);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
const payload = await req.json();
    const { 
      type, shopId, customerEmail, customerName, shopName, 
      startTime, services, shopEmail, cancelUrl, lineUserId, 
      notifyLineEnabled, owner_email, dashboard_url, reservations_url, 
      reserve_url, password, ownerName, phone: ownerPhone, businessType,
      staffName,
      // 🆕 新しく追加された詳細項目を受け取る
      furigana, address, parking, buildingType, careNotes, 
      companyName, symptoms, requestDetails, notes
    } = payload;

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? "";
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? "";
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ==========================================
    // 🆕 パターンC：一斉リマインド送信 (本家ロジック完全維持 + カスタム対応)
    // ==========================================
// ✅【修正後：正しいコード】
if (type === 'remind_all') {
  const nowJST = new Date(new Date().getTime() + (9 * 60 * 60 * 1000));
  const currentHour = nowJST.getUTCHours();
  
  if (currentHour >= 20 || currentHour < 9) {
    return new Response(JSON.stringify({ 
      message: `現在は日本時間 ${currentHour}時 のため送信を控えます。9時以降に実行してください。` 
    }), { headers: corsHeaders });
  }

  const tomorrowJST = new Date(nowJST);
  tomorrowJST.setDate(tomorrowJST.getDate() + 1);
  const dateStr = tomorrowJST.toISOString().split('T')[0];

  const { data: resList, error: resError } = await supabaseAdmin
    .from('reservations')
    .select('*, profiles(*), staffs(name)')
    .gte('start_time', `${dateStr}T00:00:00.000Z`)
    .lte('start_time', `${dateStr}T23:59:59.999Z`)
    .eq('remind_sent', false)
    .eq('res_type', 'normal');

  if (resError) throw resError;
  console.log(`[REMIND_DEBUG] 検索日: ${dateStr}, 取得: ${resList?.length || 0}件`);

  if (!resList || resList.length === 0) {
    return new Response(JSON.stringify({ message: 'リマインド対象なし' }), { headers: corsHeaders });
  }
  
  const report = [];

  // ✅ ループは「1回だけ」回します
  for (const res of resList) {
    const shop = res.profiles;
    const info = res.options?.visit_info || {};
    const resTime = new Date(res.start_time).toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' });

    // メニュー名の組み立て
    const isMulti = res.options?.people && res.options.people.length > 1;
    const menuDisplayText = isMulti 
      ? res.options.people.map((p: any, i: number) => `${i + 1}人目: ${p.services.map((s: any) => s.name).join(', ')}`).join('\n')
      : (res.options?.services?.map((s: any) => s.name).join(', ') || res.options?.people?.[0]?.services?.map((s: any) => s.name).join(', ') || "メニューなし");

    const placeholderData = { 
      customerName: res.customer_name, 
      furigana: info.furigana || "",
      shopName: shop.business_name, 
      startTime: `${dateStr.replace(/-/g, '/')} ${resTime}〜`, 
      services: menuDisplayText, 
      staffName: res.staffs?.name || "店舗スタッフ", // 🆕 ここを追加！
      address: info.address || shop.address || "",
      parking: info.parking || "",
      cancelUrl: `https://quest-hub-five.vercel.app/shop/${shop.id}/reserve?cancel=${res.id}`,
      officialUrl: shop.custom_official_url 
    };

    let mailOk = false;
    let lineOk = false;

    // ✅ LINE IDの有無による完全仕分け
if (res.line_user_id) {
  if (shop.customer_line_remind_enabled !== false && shop.line_channel_access_token) {
    // 🆕 担当者名を追加したメッセージに変更
    const msg = `【${shop.business_name}】\n明日 ${resTime} よりご予約をお待ちしております。\n\n👤 お名前：${res.customer_name} 様\n👤 担当：${res.staffs?.name || '店舗スタッフ'}\n📋 内容：\n${menuDisplayText}\n\nお気をつけてお越しください！`;
    lineOk = await safePushToLine(res.line_user_id, msg, shop.line_channel_access_token, "REMIND");
  }
} else {
      // Web予約の場合（メールアドレスがあればメールを送る）
      if (shop.notify_mail_remind_enabled !== false && res.customer_email) {
        const subject = applyPlaceholders(shop.mail_sub_customer_remind || `【リマインド】明日のお越しをお待ちしております（${shop.business_name}）`, placeholderData);
        const html = `
          <div style="font-family: sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; padding: 25px; border-radius: 12px;">
            <h2 style="color: #2563eb;">明日、ご来店をお待ちしております</h2>
            <p>${res.customer_name} 様</p>
            <div style="background: #f8fafc; padding: 20px; border-radius: 10px; border: 1px solid #e2e8f0; margin: 20px 0;">
              <p style="margin: 5px 0;">📅 <strong>日時:</strong> ${dateStr.replace(/-/g, '/')} ${resTime}〜</p>
              <p style="margin: 5px 0;">📋 <strong>内容:</strong><br>${menuDisplayText}</p>
              <p style="margin: 5px 0;">📍 <strong>場所:</strong> ${info.address || shop.address || '店舗'}</p>
            </div>
          </div>`;

const mRes = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
              body: JSON.stringify({ from: `${shop.business_name} <infec@snipsnap.biz>`, to: [res.customer_email], subject, html })
            });
            mailOk = mRes.ok;
          }
        }

        // 送信処理（LINEまたはメール）が終わった後に1回だけDBを更新
        await supabaseAdmin.from('reservations').update({ remind_sent: true }).eq('id', res.id);
        report.push({ id: res.id, email: mailOk, line: lineOk });
      } // ここでループ終了
      
  return new Response(JSON.stringify({ report }), { status: 200, headers: corsHeaders });
}

    // ==========================================
    // 🚀 パターンA：店主様への歓迎メール ＆ 三土手さんへの通知送信 (本家ロジック完全維持)
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
          subject: `【新規申込】${shopName} 様がベータ版の利用を開始しました`,
          html: `<div style="padding: 20px; border: 2px solid #2563eb; border-radius: 12px;"><h2>🚀 新規登録通知</h2><p>店舗名: ${shopName} 様</p><p>代表者: ${ownerName} 様</p></div>`,
        }),
      });

      const welcomeData = await welcomeRes.json();
      return new Response(JSON.stringify(welcomeData), { status: 200, headers: corsHeaders });
    }

    // ==========================================
    // 🚀 パターンB・D・E：予約完了 ＆ キャンセル通知 (三土手さん指定の5パターン)
    // ==========================================
    const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', shopId).single();
    const currentToken = profile?.line_channel_access_token;
    const currentAdminId = profile?.line_admin_user_id;

const sendMail = async (to: string, isOwner: boolean) => {
      // ✅ 置換用データセット
const placeholderData = { 
        customerName, 
        shopName, 
        startTime, 
        services, 
        cancelUrl, 
        staffName: staffName || "店舗スタッフ", // 🆕 ここに staffName を追加！
        furigana, 
        address, 
        parking, 
        buildingType, 
        careNotes,
        companyName, 
        symptoms, 
        requestDetails, 
        notes,
        officialUrl: profile.custom_official_url || "" 
      };      
      const isVisit = VISIT_KEYWORDS.some(keyword => (profile.business_type || '').includes(keyword));
      const defaults = isVisit ? VISIT_DEFAULTS : STORE_DEFAULTS;

      let finalSubject = "";
      let finalHtml = "";

      if (type === 'cancel') {
        // --- キャンセル通知 ---
        if (isOwner) {
          finalSubject = applyPlaceholders(profile.mail_sub_shop_cancel || `【キャンセル通知】${customerName} 様`, placeholderData);
          const body = applyPlaceholders(profile.mail_body_shop_cancel || `${shopName} 管理者様\n予約がキャンセルされました。\nお客様: ${customerName}\n日時: ${startTime}`, placeholderData).replace(/\n/g, '<br>');
          finalHtml = `<div style="font-family:sans-serif;color:#333;">${body}</div>`;
        } else {
          finalSubject = applyPlaceholders(profile.mail_sub_customer_cancel || `キャンセル完了のお知らせ（${shopName}）`, placeholderData);
          const body = applyPlaceholders(profile.mail_body_customer_cancel || `${customerName} 様\n予約のキャンセルが完了しました。`, placeholderData).replace(/\n/g, '<br>');
          finalHtml = `<div style="font-family:sans-serif;color:#333;">${body}</div>`;
        }
      } else {
        // --- 予約確定通知（サンクスメール） ---
        if (isOwner) {
          // 店舗宛
          finalSubject = applyPlaceholders(profile.mail_sub_shop_booking || `【新着予約】${customerName} 様`, placeholderData);
          finalHtml = `
            <div lang="ja" style="font-family: sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; padding: 25px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
              <h2 style="color: #2563eb; margin-top: 0; font-size: 1.3rem; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">新着予約のお知らせ（店舗控え）</h2>
              <p style="margin: 20px 0 10px 0;">${shopName} 管理者様</p>
              <div style="background: #f8fafc; padding: 20px; border-radius: 10px; border: 1px solid #e2e8f0;">
                <p style="margin: 5px 0;">👤 <b>お客様:</b> ${customerName} 様 ${furigana ? `(${furigana})` : ''}</p>
                <p style="margin: 5px 0;">📅 <b>日時:</b> ${startTime}</p>
                <p style="margin: 5px 0;">👤 <b>担当:</b> ${staffName || '指名なし'}</p>
                <p style="margin: 5px 0;">📋 <b>メニュー:</b> ${services}</p>
              </div>
              <div style="margin-top: 20px; padding: 15px; border-left: 4px solid #cbd5e1; background: #fff;">
                <h3 style="margin: 0 0 10px 0; font-size: 0.9rem; color: #64748b;">📝 お客様の入力内容</h3>
                <div style="font-size: 0.9rem; color: #1e293b;">
                  ${address ? `<p style="margin: 4px 0;">📍 <b>住所:</b> ${address}</p>` : ''}
                  ${parking ? `<p style="margin: 4px 0;">🅿️ <b>駐車場:</b> ${parking}</p>` : ''}
                  ${notes ? `<p style="margin: 4px 0; border-top: 1px dashed #eee; padding-top: 10px;">💬 <b>備考:</b><br>${notes}</p>` : ''}
                </div>
              </div>
              <div style="margin-top: 25px; text-align: center;">
                <a href="https://quest-hub-five.vercel.app/admin/${shopId}/reservations" style="display: inline-block; background: #2563eb; color: #fff; padding: 12px 25px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 0.9rem;">予約台帳で確認する</a>
              </div>
            </div>`;
        } else {
          // お客様宛（サンクスメール）
          const subTemplate = profile.mail_sub_customer_booking || defaults.booking_sub;
          const bodyTemplate = profile.mail_body_customer_booking || defaults.booking_body;
          finalSubject = applyPlaceholders(subTemplate, placeholderData);
          const body = applyPlaceholders(bodyTemplate, placeholderData).replace(/\n/g, '<br>');
          finalHtml = `
            <div lang="ja" style="font-family: sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; padding: 25px; border-radius: 12px;">
              <h2 style="color: #2563eb; margin-top: 0;">${isVisit ? '訪問' : '予約'}確定のお知らせ</h2>
              <div>${body}</div>
              ${cancelUrl ? `<p style="font-size: 0.85rem; border-top: 1px solid #eee; padding-top: 15px; margin-top:20px;"><a href="${cancelUrl}" style="color: #2563eb;">ご予約の確認・キャンセルはこちら</a></p>` : ''}
            </div>`;
        }
      }

      return await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({ from: `${shopName} <infec@snipsnap.biz>`, to: [to], subject: finalSubject, html: finalHtml }),
      });
    };
// 🆕 1. 予約の入り口を判定 (payloadにLINE IDが含まれているか)
// ==========================================
    // 🚀 通知実行エリア（三土手さん指定の条件版）
    // ==========================================
    const isLineBooking = !!lineUserId;
    const isVisit = VISIT_KEYWORDS.some(keyword => (profile?.business_type || '').includes(keyword));

    // --- 1. お客様への通知（経路によってLINEかメールか出し分け） ---
    let customerResData = null;
    let customerLineSent = false;

    if (isLineBooking) {
      // 【LINE予約の場合】LINE通知のみ送る（設定がONの場合）
      if (profile?.customer_line_booking_enabled !== false && currentToken) {
        const customerMsg = type === 'cancel' 
          ? `【キャンセル完了】\n${customerName} 様、キャンセル手続きが完了いたしました。`
          : `${customerName}様\n${isVisit ? 'ご指定の場所へお伺いいたします。' : 'ご予約ありがとうございます。'}\n\n🏨 店名：${shopName}\n👤 担当：${staffName || '店舗スタッフ'}\n📅 日時：${startTime}〜\n\n📋 内容：\n${services}\n${isVisit ? `📍 訪問先：\n${address}` : ''}\n\n■予約確認・キャンセル\n${cancelUrl}`;
        
        customerLineSent = await safePushToLine(lineUserId, customerMsg, currentToken, "CUSTOMER");
      }
    } else if (customerEmail && customerEmail !== 'admin@example.com') {
      // 【ウェブ予約の場合】メール通知のみ送る
      const customerRes = await sendMail(customerEmail, false);
      customerResData = await customerRes.json();
    }

    // --- 2. 店主様（三土手さん）への通知 ---
    let shopResData = null;
    let shopLineSent = false;

    // A. 【メール通知】予約経路に関わらず必ず送る（最重要）
    if (shopEmail && shopEmail !== 'admin@example.com') {
      const shopRes = await sendMail(shopEmail, true);
      shopResData = await shopRes.json();
    }

    // B. 【LINE通知】LineSettingsで「新着通知を受け取る」がチェックされている場合のみ送る
    if (notifyLineEnabled === true && currentToken && currentAdminId) {
      let detailsText = address ? `\n📍 住: ${address}` : "";
      if (notes) detailsText += `\n💬 備: ${notes}`;
      const shopMsg = type === 'cancel' 
        ? `【予約キャンセル】\n👤 客: ${customerName} 様\n📅 日: ${startTime}〜`
        : `【新着予約】\n👤 客: ${customerName} 様${detailsText}\n📅 日: ${startTime}〜\n📋 メ: ${services}`;
      
      shopLineSent = await safePushToLine(currentAdminId, shopMsg, currentToken, "OWNER");
    }

    // 処理結果のレスポンス
    return new Response(JSON.stringify({ 
      success: true, 
      customerLine: customerLineSent, 
      shopLine: shopLineSent,
      shopEmailSent: !!shopResData,
      customerEmailSent: !!customerResData 
    }), { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    // エラーハンドリング
    console.error('[ERROR]', error.message);
    return new Response(
      JSON.stringify({ error: error.message }), 
      { status: 500, headers: corsHeaders }
    );
  }
}); // 👈 ここで Deno.serve を閉じます