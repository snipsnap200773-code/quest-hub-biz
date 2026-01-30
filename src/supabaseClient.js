import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabaseの接続情報が読み込めません。 .envファイルを確認してください。");
}

/**
 * 🛡️ 1. メインクライアント（データベース・ストレージ用）
 * 修正内容：新しいプロジェクトでエラーの原因となる 'x-shop-id' ヘッダーを削除しました。
 * これにより、標準的な REST API 通信が可能になります。
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * ✉️ 2. 通知専用クライアント（Edge Functions用）
 * メインクライアントとのセッション衝突を避けるための設定を維持しています。
 */
export const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: 'sb-notification-auth-token',
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});