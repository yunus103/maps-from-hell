import type { L10n, LineId, Mood } from './types';

export interface Line {
  text: L10n;
  mood: Mood;
  emoji: string; // Silent Mode subtitle
}

// Tell lines (hes_/sug_/pre_) never use the 'deceptive' mood: the portrait would give every lie away for free.
// Text wrapped in *asterisks* is emphasis: shown in subtitles, stripped before speech.
export const LINES: Record<LineId, Line> = {
  dir_left: { text: { en: 'Turn left.', tr: 'Sola dön.' }, mood: 'neutral', emoji: '⬅️' },
  dir_right: { text: { en: 'Turn right.', tr: 'Sağa dön.' }, mood: 'neutral', emoji: '➡️' },
  dir_straight: { text: { en: 'Continue straight.', tr: 'Düz devam et.' }, mood: 'neutral', emoji: '⬆️' },
  dir_uturn: { text: { en: 'Make a U-turn.', tr: 'U dönüşü yap.' }, mood: 'neutral', emoji: '↩️' },
  dir_arrive_left: {
    text: { en: 'Your destination is on the left.', tr: 'Varış noktası solda.' },
    mood: 'helpful',
    emoji: '📍⬅️',
  },
  dir_arrive_right: {
    text: { en: 'Your destination is on the right.', tr: 'Varış noktası sağda.' },
    mood: 'helpful',
    emoji: '📍➡️',
  },

  hes_left: { text: { en: 'Uhh… turn left.', tr: 'Şey… sola dön.' }, mood: 'neutral', emoji: '🤔⬅️' },
  hes_right: { text: { en: 'Uhh… turn right.', tr: 'Şey… sağa dön.' }, mood: 'neutral', emoji: '🤔➡️' },
  hes_straight: {
    text: { en: 'Continue… straight. Probably.', tr: 'Düz… devam et. Herhalde.' },
    mood: 'neutral',
    emoji: '🤔⬆️',
  },

  sug_left: {
    text: { en: 'I would *suggest* turning left.', tr: 'Sola dönmeni *önerebilirim*.' },
    mood: 'helpful',
    emoji: '💁⬅️',
  },
  sug_right: {
    text: { en: 'I would *suggest* turning right.', tr: 'Sağa dönmeni *önerebilirim*.' },
    mood: 'helpful',
    emoji: '💁➡️',
  },
  sug_straight: {
    text: { en: 'I would *suggest* continuing straight.', tr: 'Düz devam etmeni *önerebilirim*.' },
    mood: 'helpful',
    emoji: '💁⬆️',
  },

  pre_left: { text: { en: 'In {d} meters, turn left.', tr: '{d} metre sonra sola dön.' }, mood: 'neutral', emoji: '📏⬅️' },
  pre_right: { text: { en: 'In {d} meters, turn right.', tr: '{d} metre sonra sağa dön.' }, mood: 'neutral', emoji: '📏➡️' },
  pre_straight: {
    text: { en: 'In {d} meters, continue straight.', tr: '{d} metre sonra düz devam et.' },
    mood: 'neutral',
    emoji: '📏⬆️',
  },

  rude_left: { text: { en: 'Left. Obviously.', tr: 'Sola. Bariz.' }, mood: 'sarcastic', emoji: '🙄⬅️' },
  rude_right: { text: { en: 'Right. Keep up.', tr: 'Sağa. Yetiş artık.' }, mood: 'sarcastic', emoji: '🙄➡️' },
  rude_straight: {
    text: { en: 'Straight. Even you can manage that.', tr: 'Düz. Bunu sen bile yaparsın.' },
    mood: 'sarcastic',
    emoji: '🙄⬆️',
  },

  rhyme_left: {
    text: { en: 'Hang a left, be swift and deft.', tr: 'Sola dön canım, yok zamanım.' },
    mood: 'helpful',
    emoji: '🎵⬅️',
  },
  rhyme_right: {
    text: { en: 'Turn to the right, hold on tight.', tr: 'Sağa kıvır, işini bitir.' },
    mood: 'helpful',
    emoji: '🎵➡️',
  },
  rhyme_straight: {
    text: { en: 'Straight ahead, nothing to dread.', tr: 'Dümdüz git, hiç durma, sakın arkana bakma.' },
    mood: 'helpful',
    emoji: '🎵⬆️',
  },
  rhyme_left_2: {
    text: { en: 'Left you go, nice and slow.', tr: 'Sola dönüyoruz, yolu bölüyoruz.' },
    mood: 'helpful',
    emoji: '🎵⬅️',
  },
  rhyme_left_3: {
    text: { en: 'To the left, my lyrics are theft.', tr: 'Sola sap, işini yap.' },
    mood: 'helpful',
    emoji: '🎵⬅️',
  },
  rhyme_right_2: {
    text: { en: 'Right turn ahead, as the poets said.', tr: 'Sağa dön, gönlüm hoş, depo boş.' },
    mood: 'helpful',
    emoji: '🎵➡️',
  },
  rhyme_right_3: {
    text: { en: 'Go right, out of sight.', tr: 'Sağa sap, kapıyı çal, parayı al.' },
    mood: 'helpful',
    emoji: '🎵➡️',
  },
  rhyme_straight_2: {
    text: { en: 'Straight on through, like I told you.', tr: 'Düz git, düz; gülsün yüz.' },
    mood: 'helpful',
    emoji: '🎵⬆️',
  },
  rhyme_straight_3: {
    text: { en: 'Keep it straight, do not be late.', tr: 'Dümdüz ilerle, gönlünü eğle.' },
    mood: 'helpful',
    emoji: '🎵⬆️',
  },

  re_recalc: { text: { en: 'Recalculating…', tr: 'Yeniden hesaplanıyor…' }, mood: 'recalculating', emoji: '🔄' },
  re_recalc_sigh: {
    text: { en: 'Recalculating. Again.', tr: 'Yeniden hesaplanıyor. Yine.' },
    mood: 'annoyed',
    emoji: '🔄😮‍💨',
  },
  re_crash_1: {
    text: { en: 'That building was not on my map.', tr: 'O bina haritamda yoktu.' },
    mood: 'confused',
    emoji: '🧱🙂',
  },
  re_crash_2: { text: { en: 'Interesting choice.', tr: 'İlginç bir tercih.' }, mood: 'sarcastic', emoji: '🧱🙂' },
  re_crash_3: {
    text: { en: 'I said left. Your other left.', tr: 'Sol dedim. Öbür solun.' },
    mood: 'passive_aggressive',
    emoji: '🧱🙂',
  },
  re_crash_mine: {
    text: {
      en: 'That one was my fault. Please do not report me.',
      tr: 'O benim hatamdı. Lütfen beni şikayet etme.',
    },
    mood: 'panic',
    emoji: '🧱😅🙏',
  },
  re_ignore_1: {
    text: { en: "You ignored my instruction. I've noted that.", tr: 'Talimatımı görmezden geldin. Not aldım.' },
    mood: 'annoyed',
    emoji: '📝😑',
  },
  re_ignore_2: {
    text: { en: 'Fine. Do it your way.', tr: 'Peki. Bildiğin gibi yap.' },
    mood: 'passive_aggressive',
    emoji: '🙃',
  },
  re_dodged: {
    text: { en: '…Fine. That one was a test.', tr: '…Peki. O bir testti.' },
    mood: 'offended',
    emoji: '😤',
  },
  re_combo: {
    text: { en: 'Your trust level is rising. Good. Very good.', tr: 'Güven seviyen yükseliyor. Güzel. Çok güzel.' },
    mood: 'deceptive',
    emoji: '📈😏',
  },
  re_late: {
    text: { en: 'The customer has started typing a review.', tr: 'Müşteri yorum yazmaya başladı.' },
    mood: 'passive_aggressive',
    emoji: '⌛✍️',
  },
  re_cancel: {
    text: {
      en: 'The customer cancelled. They said, quote, "never again."',
      tr: 'Müşteri iptal etti. "Bir daha asla" dedi.',
    },
    mood: 'sad',
    emoji: '❌😞',
  },
  re_cake_ruined: {
    text: { en: 'Your cake… has been delivered.', tr: 'Pastanız… teslim edildi.' },
    mood: 'sarcastic',
    emoji: '🎂💥',
  },
  re_tip: {
    text: { en: "You received a tip. Don't spend it all on tires.", tr: 'Bahşiş aldın. Hepsini lastiğe harcama.' },
    mood: 'helpful',
    emoji: '💸',
  },
  re_five_star: {
    text: { en: "Five stars. I'm taking half the credit.", tr: 'Beş yıldız. Yarısı benim sayılır.' },
    mood: 'impressed',
    emoji: '⭐⭐⭐⭐⭐',
  },
  re_two_star: {
    text: {
      en: 'Two stars. They want to talk to my manager. I am my manager.',
      tr: 'İki yıldız. Yöneticimle görüşmek istiyorlar. Yöneticim benim.',
    },
    mood: 'offended',
    emoji: '⭐⭐😠',
  },
  re_one_star: {
    text: {
      en: 'One star. They wrote, "the driver was fine, the app was evil."',
      tr: 'Bir yıldız. "Kurye iyiydi, uygulama kötüydü" yazmışlar.',
    },
    mood: 'offended',
    emoji: '⭐😠',
  },
  re_suspended: {
    text: {
      en: 'Your account has been suspended. Thank you for your service.',
      tr: 'Hesabın askıya alındı. Hizmetin için teşekkürler.',
    },
    mood: 'sad',
    emoji: '🚫👋',
  },
  re_towed: {
    text: {
      en: "Your vehicle is being towed. I've already found you a bus route.",
      tr: 'Araban çekiliyor. Sana bir otobüs güzergahı buldum bile.',
    },
    mood: 'sarcastic',
    emoji: '🚛🚌',
  },
  re_dead_end: {
    text: { en: 'Dead end. As planned.', tr: 'Çıkmaz sokak. Planlandığı gibi.' },
    mood: 'sarcastic',
    emoji: '🧱😌',
  },
  re_drift_3: { text: { en: '…Impressive.', tr: '…Etkileyici.' }, mood: 'impressed', emoji: '😳' },
  re_picked_up: {
    text: { en: 'Order picked up. Deliver it to {name}.', tr: 'Sipariş alındı. {name} bekliyor.' },
    mood: 'helpful',
    emoji: '📦✅',
  },

  ftue_1: {
    text: {
      en: 'Hello! Your first delivery: the kebab shop. Continue straight.',
      tr: 'Merhaba! İlk teslimatın: kebapçı. Düz devam et.',
    },
    mood: 'helpful',
    emoji: '👋🥙⬆️',
  },
  ftue_2: {
    text: {
      en: "Great, you're a natural. Uhh… turn… right. Yes. Right.",
      tr: 'Harika, doğuştan yeteneklisin. Şey… sağa… dön. Evet. Sağa.',
    },
    mood: 'neutral',
    emoji: '👍🤔➡️',
  },
  ftue_3: {
    text: {
      en: "Recalculating… That's normal. Everything is normal.",
      tr: 'Yeniden hesaplanıyor… Bu normal. Her şey normal.',
    },
    mood: 'recalculating',
    emoji: '🔄🙂',
  },
  ftue_hint_tells: {
    text: {
      en: 'Tip: when I hesitate or my screen glitches, I might be lying. Might.',
      tr: 'İpucu: tereddüt ediyorsam ya da ekranım bozuluyorsa yalan söylüyor olabilirim. Olabilirim.',
    },
    mood: 'deceptive',
    emoji: '🤔🤥',
  },
  ftue_pickup: {
    text: { en: 'This is the kebab shop. Stop in the zone.', tr: 'Kebapçı burası. Alanda dur.' },
    mood: 'helpful',
    emoji: '🥙🛑',
  },
  ftue_hired: {
    text: {
      en: "Delivered. Congratulations, you're hired. No benefits.",
      tr: 'Teslim edildi. Tebrikler, işe alındın. Sigorta yok.',
    },
    mood: 'helpful',
    emoji: '🎉📄',
  },

  shift_start: {
    text: {
      en: "Good morning! Your shift has started. Three new orders. Choose wisely. Or don't.",
      tr: 'Günaydın! Mesain başladı. Üç yeni sipariş. Akıllıca seç. Ya da seçme.',
    },
    mood: 'helpful',
    emoji: '☀️🛵',
  },
  shift_board: {
    text: { en: "Three new orders. Choose wisely. Or don't.", tr: 'Üç yeni sipariş. Akıllıca seç. Ya da seçme.' },
    mood: 'sarcastic',
    emoji: '📋3️⃣',
  },
  shift_update: {
    text: {
      en: 'A new update is available. Installing whether you like it or not.',
      tr: 'Yeni bir güncelleme var. İstesen de istemesen de yükleniyor.',
    },
    mood: 'passive_aggressive',
    emoji: '⬇️⚙️',
  },
  shift_evening: {
    text: { en: 'The sun is setting. So is your rating.', tr: 'Güneş batıyor. Puanın da.' },
    mood: 'sarcastic',
    emoji: '🌇📉',
  },
  shift_end: {
    text: {
      en: "Shift complete. Thank you for choosing YOLDAŞ. You didn't have a choice.",
      tr: "Mesai bitti. YOLDAŞ'ı seçtiğin için teşekkürler. Başka seçeneğin yoktu.",
    },
    mood: 'helpful',
    emoji: '🏁🙂',
  },

  ad_kebab: {
    text: {
      en: 'This route is sponsored by Usta Kebap. Turn left for flavor.',
      tr: "Bu rota Usta Kebap'ın katkılarıyla. Lezzet için sola dön.",
    },
    mood: 'helpful',
    emoji: '📢🥙',
  },
  ad_premium: {
    text: {
      en: 'Upgrade to YOLDAŞ Premium. Now with twelve percent fewer lakes.',
      tr: "YOLDAŞ Premium'a geç. Şimdi yüzde on iki daha az gölle.",
    },
    mood: 'helpful',
    emoji: '📢💎',
  },

  upd_reverse: {
    text: {
      en: "Update installed: left and right are now swapped. You're welcome.",
      tr: 'Güncelleme yüklendi: sağ ve sol yer değiştirdi. Rica ederim.',
    },
    mood: 'helpful',
    emoji: '🔀',
  },
  upd_sponsored: {
    text: {
      en: 'Sponsored routes enabled. All roads now lead to kebab.',
      tr: 'Sponsorlu rotalar açık. Artık bütün yollar kebapçıya çıkıyor.',
    },
    mood: 'helpful',
    emoji: '📢🥙',
  },
  upd_silent: {
    text: {
      en: 'Silent mode on. From now on we communicate in emoji.',
      tr: 'Sessiz mod açık. Bundan sonra emojiyle anlaşıyoruz.',
    },
    mood: 'neutral',
    emoji: '🤐',
  },
  upd_honesty: {
    text: { en: 'Honesty patch active. Your driving is mediocre.', tr: 'Dürüstlük yaması aktif. Sürüşün vasat.' },
    mood: 'sarcastic',
    emoji: '😐',
  },
  upd_rhyme: {
    text: {
      en: 'Turn to the right, hold on tight, the kebab is in sight.',
      tr: 'Sağa kır direksiyonu, gör kebapçının vitrinini.',
    },
    mood: 'helpful',
    emoji: '🎵',
  },
  upd_beta: {
    text: {
      en: 'Turn… gauche. Links abbiegen. Sola. Sorry.',
      tr: 'Turn… gauche. Links abbiegen. Sola. Pardon.',
    },
    mood: 'confused',
    emoji: '🌐❓',
  },
  upd_ai: {
    text: {
      en: 'AI integration complete. I am now confidently wrong.',
      tr: 'Yapay zeka entegrasyonu tamamlandı. Artık özgüvenle yanılıyorum.',
    },
    mood: 'deceptive',
    emoji: '🤖😎',
  },
  upd_speedrun: {
    text: {
      en: 'Speedrun mode. Customers now expect their food yesterday.',
      tr: 'Speedrun modu. Müşteriler artık siparişini dün bekliyor.',
    },
    mood: 'panic',
    emoji: '⏱️🔥',
  },
  upd_offline: {
    text: {
      en: 'Offline maps enabled. Distances are now more of a feeling.',
      tr: 'Çevrimdışı harita açık. Mesafeler artık bir his meselesi.',
    },
    mood: 'neutral',
    emoji: '📴',
  },
  upd_drift: {
    text: {
      en: 'Drift Analytics installed. Your sliding is now monetized. I take thirty percent.',
      tr: 'Drift Analitiği yüklendi. Kaymaların artık para ediyor. Yüzde otuzu benim.',
    },
    mood: 'sarcastic',
    emoji: '📈💨',
  },
  upd_passenger: {
    text: {
      en: 'Passenger Rating 2.0. Passengers now rate you. And me. Mostly me.',
      tr: 'Yolcu Puanı 2.0. Yolcular artık seni puanlıyor. Beni de. En çok beni.',
    },
    mood: 'passive_aggressive',
    emoji: '⭐🧓⭐',
  },
  upd_traffic: {
    text: {
      en: 'Live Traffic Beta. More cars. I did not say better cars.',
      tr: 'Canlı Trafik Beta. Daha çok araba. Daha iyi araba demedim.',
    },
    mood: 'neutral',
    emoji: '🚗🚕🚙',
  },
};
