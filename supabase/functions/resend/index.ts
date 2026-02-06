import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";

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
    const { type, shopId, customerEmail, customerName, shopName, startTime, services, shopEmail, cancelUrl, lineUserId, notifyLineEnabled, owner_email, dashboard_url, reservations_url, reserve_url, password, ownerName, phone: ownerPhone, businessType } = payload;
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? "";
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? "";
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', shopId).single();

    const sendMail = async (to: string, isOwner: boolean) => {
      const placeholderData = { customerName, shopName, startTime, services, cancelUrl, officialUrl: profile?.custom_official_url || "" };
      let subject = isOwner ? `【新着予約】${customerName} 様` : `予約完了のお知らせ：${customerName} 様`;
      let body = isOwner ? "新しい予約が入りました。" : "ご予約ありがとうございます。";
      if (type === 'cancel') {
        subject = isOwner ? `【キャンセル通知】${customerName} 様` : `キャンセル完了（${shopName}）`;
        body = isOwner ? "予約がキャンセルされました。" : "キャンセルを承りました。";
      }
      return await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({ from: `${shopName} <infec@snipsnap.biz>`, to: [to], subject, html: `<div style="font-family:sans-serif;line-height:1.6;">${body}<br>日時: ${startTime}<br>メニュー: ${services}</div>` })
      });
    };
    if (customerEmail) await sendMail(customerEmail, false);
    if (shopEmail && shopEmail !== 'admin@example.com') await sendMail(shopEmail, true);
    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});