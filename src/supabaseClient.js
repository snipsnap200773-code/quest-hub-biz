import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabaseの接続情報が読み込めません。");
}

/**
 * 🛡️ 1. メインクライアント（データベース・ストレージ用）
 * RLSガード（x-shop-id）を添えて通信します。
 * 標準の保存キー（sb-auth-token）を使用します。
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      'x-shop-id': window.location.pathname.split('/')[2] || '' 
    }
  }
});

/**
 * ✉️ 2. 通知専用クライアント（Edge Functions用）
 * 🆕 別の storageKey を指定することで、メインクライアントとの衝突を物理的に回避します。
 */
export const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: 'sb-notification-auth-token', // 🆕 衝突を避けるための別名
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});