// src/constants/industryMaster.js

export const INDUSTRY_PRESETS = {
  visiting: {
    label: "🏠 訪問美容・訪問サービス",
    fields: ['name', 'furigana', 'phone', 'address', 'parking', 'building_type', 'care_notes']
  },
  beauty: {
    label: "✂️ 美容室・ヘアサロン",
    fields: ['name', 'furigana', 'phone', 'email', 'request_details']
  },
  nail: {
    label: "💅 ネイル・アイラッシュ",
    fields: ['name', 'furigana', 'phone', 'email', 'request_details']
  },
  esthetic: {
    label: "💆 エステ・リラクゼーション",
    fields: ['name', 'furigana', 'phone', 'email', 'symptoms', 'request_details']
  },
  clinic: {
    label: "🏥 病院・クリニック・接骨院",
    fields: ['name', 'furigana', 'phone', 'email', 'symptoms', 'request_details']
  },
  school: {
    label: "🎓 教室・スクール・習い事",
    fields: ['name', 'furigana', 'email', 'phone', 'symptoms']
  },
  event: {
    label: "🏢 イベント・ビジネス・セミナー",
    fields: ['name', 'email', 'company_name', 'request_details']
  },
  hospitality: {
    label: "🍴 飲食・ホテル・おもてなし",
    fields: ['name', 'phone', 'email', 'request_details']
  },
// 🆕 テスト用の新項目を追加！
  test_new: {
    label: "🚀 未知の新業種",
    fields: ['name', 'phone', 'notes'] // お名前、電話、備考だけONにする設定
  }
};

// 他の画面でプルダウンを作るために、ラベルだけの配列も書き出しておく
export const INDUSTRY_LABELS = Object.values(INDUSTRY_PRESETS).map(item => item.label);