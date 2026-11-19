// Customer flavour: names, ticket notes, delivery reactions and worried phone calls.
import type { DeliveryResult, L10n } from './types';

const same = (s: string): L10n => ({ en: s, tr: s });

export const CUSTOMER_NAMES: L10n[] = [
  same('Ayşe Hanım'), same('Mehmet Bey'), { en: 'Auntie Fatma', tr: 'Fatma Teyze' },
  { en: 'Uncle Hüseyin', tr: 'Hüseyin Amca' }, same('Zeynep'), same('Emre'), same('Elif'), same('Burak'),
  same('Selin'), same('Murat Abi'), same('Cem'), same('Deniz'), same('Gökhan Bey'), same('Esra Hanım'),
  same('Oğuz'), same('Canan Abla'), same('Serkan'), same('Tuğba'), { en: 'Master Volkan', tr: 'Volkan Usta' },
  { en: 'Auntie Nermin', tr: 'Nermin Teyze' }, { en: 'Grandpa İbrahim', tr: 'İbrahim Dede' }, same('Berk'),
  same('Melis'), same('Kerem'), same('Duygu'), same('Hakan Bey'), same('Sevgi Hanım'), same('Yusuf'),
  same('Gizem'), same('Barış'), same('Ozan'), same('Pınar'), same('Erdem'), { en: 'Auntie Hatice', tr: 'Hatice Teyze' },
  same('Tarık'), same('Ceren'), same('Levent Bey'), same('Sinan'), same('Büşra'), same('Metin Abi'),
  same('Ebru Hanım'), { en: 'Kemal from the 3rd floor', tr: '3. kattan Kemal' },
  { en: "The muhtar's nephew", tr: 'Muhtarın yeğeni' }, { en: 'Building manager Nuri', tr: 'Yönetici Nuri Bey' },
  { en: 'Doorman Recep', tr: 'Kapıcı Recep' }, { en: 'Anonymous (cat avatar)', tr: 'Anonim (kedi profilli)' },
  { en: 'Lawyer Sibel', tr: 'Avukat Sibel' }, { en: 'Engin (night owl)', tr: 'Engin (gece kuşu)' },
];

export const NOTES: L10n[] = [
  { en: 'Ring twice, the dog is asleep.', tr: 'Zile iki kere bas, köpek uyuyor.' },
  { en: "Don't ring! The baby just fell asleep.", tr: 'Zile basma! Bebek daha yeni uyudu.' },
  { en: 'Third floor, no elevator. Sorry.', tr: 'Üçüncü kat, asansör yok. Kusura bakma.' },
  { en: 'Leave it with the doorman. He knows.', tr: 'Kapıcıya bırak, o bilir.' },
  { en: "Call when you arrive. I won't answer, but call.", tr: 'Gelince ara. Açmam ama ara.' },
  { en: 'The green door. No, the other green door.', tr: 'Yeşil kapı. Yok, öbür yeşil kapı.' },
  { en: "Bring it up quietly, I'm hiding it from my wife.", tr: 'Sessizce getir, eşimden saklıyorum.' },
  { en: "Please hurry, I'm starving.", tr: 'Ne olur acele et, açlıktan ölüyorum.' },
  { en: "Don't trust the GPS. The street is behind the mosque.", tr: "GPS'e güvenme. Sokak caminin arkasında." },
  { en: 'Bring change for a 200.', tr: "200'lüğe bozuk getir." },
  { en: "If my mom answers, you're my friend from school.", tr: 'Annem açarsa okuldan arkadaşımsın.' },
  { en: 'Say hi to the cat on the stairs.', tr: 'Merdivendeki kediye selam söyle.' },
  { en: "Don't park in front of the garage, Uncle Necati gets angry.", tr: 'Garajın önüne park etme, Necati Amca kızıyor.' },
  { en: "The door number fell off. It's the one with the satellite dishes.", tr: 'Kapı numarası düştü. Çanak antenli bina.' },
  { en: 'Knock softly, the neighbour complains.', tr: 'Kapıyı yavaş çal, komşu şikâyet ediyor.' },
  { en: "I'm in the park across the street. Wave.", tr: 'Karşıdaki parktayım. El salla.' },
  { en: 'The last courier got lost. Please be better.', tr: 'Önceki kurye kayboldu. Lütfen daha iyi ol.' },
  { en: 'Five stars if you smile.', tr: 'Gülümsersen beş yıldız.' },
  { en: 'I tipped in advance. Just kidding.', tr: 'Bahşişi peşin verdim. Şaka şaka.' },
  { en: 'The intercom is broken. Shout "Deliveryyy!"', tr: 'Diyafon bozuk. "Siparişşş!" diye bağır.' },
  { en: 'My name is on the bell, but misspelled.', tr: 'Zilde adım yazıyor ama yanlış yazılmış.' },
  { en: "Don't take the shortcut through the market. Trust me.", tr: 'Pazarın içinden kestirme yapma. Bana güven.' },
  { en: 'Wipe your shoes.', tr: 'Ayakkabılarını sil.' },
  { en: "I'm watching you on the map. Every turn.", tr: 'Seni haritadan izliyorum. Her dönüşü.' },
  { en: "Please don't honk, grandma has a weak heart.", tr: 'Korna çalma, babaannemin kalbi var.' },
  { en: 'Bring napkins. Bring ten napkins.', tr: 'Peçete getir. On tane peçete getir.' },
  { en: 'Our street is on the map but not in real life. Good luck.', tr: 'Sokağımız haritada var ama gerçekte yok. Kolay gelsin.' },
  { en: 'Come up, the tea is ready.', tr: 'Yukarı gel, çay demlendi.' },
  { en: 'If no one answers, knock on the window.', tr: 'Kimse açmazsa cama vur.' },
  { en: "Today is my birthday. No pressure.", tr: 'Bugün doğum günüm. Baskı yok.' },
  { en: "Avoid the street with the stairs. Your car won't fit.", tr: 'Merdivenli sokağa girme. Araba sığmaz.' },
  { en: 'My dad is paying. He will also complain.', tr: 'Babam ödeyecek. Söylenecek de.' },
  { en: 'Hurry, the match starts soon.', tr: 'Acele et, maç başlamak üzere.' },
  { en: "Don't let the neighbour's kid see it. He'll want some.", tr: 'Komşunun çocuğu görmesin, ister.' },
  { en: "I'm on a video call. Just leave it at the door.", tr: 'Görüntülü toplantıdayım. Kapıya bırak.' },
  { en: 'Second building after the bakery. Or the third.', tr: 'Fırından sonraki ikinci bina. Ya da üçüncü.' },
  { en: 'The dog is friendly. Mostly.', tr: 'Köpek uysaldır. Genelde.' },
  { en: 'I gave the last courier one star. He knows why.', tr: 'Son kuryeye bir yıldız verdim. Nedenini o biliyor.' },
  { en: 'Use the back entrance, they are painting the front.', tr: 'Arka kapıdan gel, önü boyanıyor.' },
  { en: 'YOLDAŞ sent the last courier into the sea. Be careful.', tr: 'YOLDAŞ önceki kuryeyi denize yolladı. Dikkat et.' },
  { en: "Don't talk to my aunt, she will feed you.", tr: 'Teyzemle konuşma, seni doyurur.' },
  { en: "I'll lower a basket from the balcony.", tr: 'Balkondan sepet sarkıtacağım.' },
  { en: 'Gate code: 1987. Classic.', tr: 'Bahçe kapısı şifresi: 1987. Klasik.' },
  { en: 'The neighbours are nosy. Act natural.', tr: 'Komşular meraklı. Doğal davran.' },
  { en: "Third time I'm ordering this. Third time's the charm.", tr: 'Üçüncü kez sipariş ediyorum. Üçüncüde olur.' },
];

// Item-specific notes (keyed by ItemDef.id) are preferred over the generic ones. Passenger items always get one.
export const ITEM_NOTES: Record<string, L10n[]> = {
  doner: [
    { en: 'Extra sauce, no onions. Okay, some onions.', tr: 'Bol soslu, soğansız. Tamam, biraz soğan.' },
    { en: "If it's cold, I'll know.", tr: 'Soğuk gelirse anlarım.' },
  ],
  lahmacun: [
    { en: 'Lemon and parsley on the side, please.', tr: 'Limon ve maydanoz ayrı olsun.' },
    { en: 'Two for me, zero for my brother.', tr: 'İkisi benim, kardeşime sıfır.' },
  ],
  pide: [
    { en: 'Sliced, please. Grandpa has no teeth.', tr: 'Dilimli olsun. Dedemin dişi yok.' },
    { en: 'Cheese, mince, mixed. All of them.', tr: 'Kaşarlı, kıymalı, karışık. Hepsinden.' },
  ],
  adana: [{ en: 'Spicy. No, spicier.', tr: 'Acılı. Yok, daha acılı.' }],
  simit: [
    { en: 'Breakfast is getting cold. Well, the tea is.', tr: 'Kahvaltı soğuyor. Yani çay soğuyor.' },
    { en: "Don't feed the seagulls on the way.", tr: 'Yolda martılara verme.' },
  ],
  pogaca: [{ en: 'Cheese ones only. Olive ones are a betrayal.', tr: 'Sadece peynirli. Zeytinli ihanettir.' }],
  groceries: [
    { en: "Don't squash the tomatoes.", tr: 'Domatesleri ezme.' },
    { en: "If they're out of bread, bring bread anyway.", tr: 'Ekmek kalmadıysa yine de ekmek getir.' },
  ],
  bouquet: [
    { en: "It's an apology. A big one.", tr: 'Özür buketi. Büyük bir özür.' },
    { en: "Don't tell her who sent it.", tr: 'Kimin gönderdiğini söyleme.' },
  ],
  catfood: [
    { en: 'The cat ordered this. I just paid.', tr: 'Bunu kedi sipariş etti. Ben sadece ödedim.' },
    { en: "Pamuk hasn't eaten in twenty minutes.", tr: 'Pamuk yirmi dakikadır bir şey yemedi.' },
  ],
  birdseed: [{ en: 'For Maviş. She sings when it arrives.', tr: 'Maviş için. Gelince şarkı söyler.' }],
  charger: [{ en: "My phone is at 1%. I'm writing this at 1%.", tr: "Telefonum %1. Bunu %1'le yazıyorum." }],
  phone_case: [{ en: "Pink with glitter. Don't judge.", tr: 'Simli pembe. Yargılama.' }],
  school_supplies: [
    { en: "Homework is due tomorrow morning. Don't ask.", tr: 'Ödev yarın sabah teslim. Sorma.' },
    { en: 'Blue folder, not red. Red is bad luck.', tr: 'Mavi dosya, kırmızı değil. Kırmızı uğursuz.' },
  ],
  cake: [
    { en: "It's a surprise! Don't ring!", tr: 'Sürpriz! Zile basma!' },
    { en: 'The candles are inside. Do not light them.', tr: 'Mumlar içinde. Sakın yakma.' },
  ],
  wedding_cake: [
    { en: 'The wedding starts in an hour. The cake is the guest of honour.', tr: 'Düğün bir saat sonra. Pasta baş misafir.' },
    { en: 'Four tiers. Four. Please.', tr: 'Dört kat. Dört. Lütfen.' },
  ],
  eggs: [
    { en: 'My mother counts them.', tr: 'Annem sayar.' },
    { en: 'If one breaks, the whole building hears about it.', tr: 'Biri kırılırsa bütün apartman duyar.' },
  ],
  fish: [
    { en: 'His name is Bulut. Be gentle.', tr: 'Adı Bulut. Nazik ol.' },
    { en: 'Bulut gets carsick.', tr: "Bulut'u araba tutuyor." },
  ],
  cat: [
    { en: "He bites. He's a good boy, but he bites.", tr: 'Isırır. İyi çocuktur ama ısırır.' },
    { en: "Don't make eye contact with Paşa.", tr: "Paşa'yla göz göze gelme." },
  ],
  tea_glasses: [{ en: "Grandma's set. Twelve glasses, twelve saucers.", tr: 'Babaannemin takımı. On iki bardak, on iki tabak.' }],
  phone: [
    { en: "Don't open it. I'll know.", tr: 'Açma. Anlarım.' },
    { en: 'No screen protector yet. Careful.', tr: 'Ekran koruyucusu yok. Dikkat.' },
  ],
  vase_flowers: [{ en: "Crystal vase. My mother-in-law's. God help us.", tr: 'Kristal vazo. Kaynanamın. Allah yardımcımız olsun.' }],
  baklava: [
    { en: 'Do not tilt. The syrup goes everywhere.', tr: 'Eğme. Şerbeti her yere akar.' },
    { en: 'If a slice is missing, I will count.', tr: 'Bir dilim eksikse sayarım.' },
  ],
  tv: [{ en: "The final is tonight. Don't scratch it.", tr: 'Final bu akşam. Çizme.' }],
  icecream: [
    { en: "Hurry, it's 35 degrees outside!", tr: 'Acele et, dışarısı 35 derece!' },
    { en: "Pistachio. If it melts, it's soup.", tr: 'Fıstıklı. Erirse çorba olur.' },
  ],
  maras: [{ en: "The ice cream man said it doesn't melt. Let's see.", tr: 'Dondurmacı erimez dedi. Bakalım.' }],
  medicine: [
    { en: 'Grandma is waiting.', tr: 'Babaannem bekliyor.' },
    { en: 'Cough syrup. Cough cough. Hurry.', tr: 'Öksürük şurubu. Öhö öhö. Acele et.' },
  ],
  formula: [{ en: 'The baby is crying. The neighbours are crying.', tr: 'Bebek ağlıyor. Komşular da ağlıyor.' }],
  documents: [
    { en: 'The notary closes at five. Sharp.', tr: 'Noter beşte kapanıyor. Tam beşte.' },
    { en: 'Sign nothing on the way.', tr: 'Yolda hiçbir şey imzalama.' },
  ],
  iskender: [
    { en: 'The butter on top must still be sizzling.', tr: 'Üstündeki tereyağı cızırdamalı.' },
    { en: 'Cold İskender is a crime.', tr: 'Soğuk İskender suçtur.' },
  ],
  kunefe: [{ en: "The cheese must stretch. That's the rule.", tr: 'Peynir uzamalı. Kural bu.' }],
  watermelon: [
    { en: 'Knock on it first. If it sounds wrong, bring another.', tr: 'Önce tıklat. Sesi kötüyse başkasını getir.' },
    { en: 'Fifth floor. The elevator is decorative.', tr: 'Beşinci kat. Asansör süs.' },
  ],
  water_jug: [
    { en: 'One jug. For now.', tr: 'Bir damacana. Şimdilik.' },
    { en: 'Leave it at the door, my back hurts.', tr: 'Kapıya bırak, belim ağrıyor.' },
  ],
  rice: [{ en: 'For the wedding pilaf. Five hundred guests.', tr: 'Düğün pilavı için. Beş yüz kişilik.' }],
  washing_machine: [
    { en: 'The old one flooded the downstairs neighbour. Hurry.', tr: 'Eskisi alt komşuyu su bastı. Acele et.' },
    { en: 'Fourth floor, narrow stairs. Good luck.', tr: 'Dördüncü kat, merdiven dar. Kolay gelsin.' },
  ],
  cat_litter: [{ en: "Urgent. Very urgent. Don't ask why.", tr: 'Acil. Çok acil. Nedenini sorma.' }],
  printer: [{ en: 'It jams on Mondays. Today is Monday.', tr: 'Pazartesileri kâğıt sıkıştırıyor. Bugün pazartesi.' }],
  ficus: [
    { en: 'His name is Fikret. He has seen things.', tr: 'Adı Fikret. Çok şey gördü.' },
    { en: "Don't let the leaves fall. He's sensitive.", tr: 'Yaprakları dökülmesin. Hassastır.' },
  ],
  p_teyze: [
    { en: 'To the bazaar, son. Not too fast.', tr: 'Pazara oğlum. Çok hızlı değil.' },
    { en: 'I know a shortcut. Trust your auntie.', tr: 'Ben kestirme biliyorum. Teyzene güven.' },
  ],
  p_abi: [
    { en: 'Turn the music up, abi. And drift.', tr: 'Müziği aç abi. Bir de kaydır.' },
    { en: "Don't go straight. Straight is boring.", tr: 'Düz gitme abi. Düz sıkıcı.' },
  ],
  p_plaza: [
    { en: 'Meeting in six minutes. Go, go, go.', tr: 'Altı dakikaya toplantı. Bas, bas, bas.' },
    { en: "I'm on a call. Don't talk. Drive faster.", tr: 'Telefondayım. Konuşma. Hızlı sür.' },
  ],
  p_tourist: [
    { en: 'The famous Bosphorus, please? Is close, yes?', tr: 'The famous Bosphorus, please? Is close, yes?' },
    { en: 'My guidebook says turn left at the pigeon.', tr: 'My guidebook says turn left at the pigeon.' },
  ],
  p_grandpa: [
    { en: 'I know the way. Nothing has changed since 1987.', tr: "Yolu bilirim. 1987'den beri hiçbir şey değişmedi." },
    { en: 'Take the tram road. What do you mean, there is no tram?', tr: 'Tramvay yolundan git. Ne demek tramvay yok?' },
  ],
  p_bride: [
    { en: 'The wedding started ten minutes ago!', tr: 'Düğün on dakika önce başladı!' },
    { en: 'Mind the dress! Mind the dress!', tr: 'Gelinliğe dikkat! Gelinliğe!' },
  ],
  p_student: [
    { en: "Exam in twenty minutes. I haven't slept.", tr: 'Yirmi dakikaya sınav var. Hiç uyumadım.' },
    { en: 'Wake me up when we get there.', tr: 'Varınca uyandır.' },
  ],
};

type ReactionKey = 'fast' | 'late' | 'damaged' | 'ruined' | 'heavy' | 'heavyDamaged';

export const CUSTOMER_LINES: Record<ReactionKey, L10n[]> = {
  fast: [
    { en: 'Finally! Thank you!', tr: 'Nihayet! Sağ ol!' },
    { en: 'That was fast. Suspiciously fast.', tr: 'Çok hızlıydı. Şüpheli derecede hızlı.' },
    { en: 'Did you teleport?', tr: 'Işınlandın mı?' },
  ],
  late: [
    { en: 'Did you walk here?', tr: 'Yürüyerek mi geldin?' },
    { en: 'I aged waiting for you.', tr: 'Seni beklerken yaşlandım.' },
    { en: 'I ordered this yesterday. It feels like it.', tr: 'Bunu dün sipariş ettim. Öyle hissediyorum.' },
  ],
  damaged: [
    { en: 'Why is it… tilted?', tr: 'Bu neden… eğik?' },
    { en: 'It looks… experienced.', tr: 'Biraz… hırpalanmış gibi.' },
  ],
  ruined: [
    { en: 'Is this… soup?', tr: 'Bu… çorba mı?' },
    { en: "I'll just… frame it.", tr: 'Ben bunu… çerçeveletirim.' },
  ],
  heavy: [
    { en: 'Up to the fifth floor, please. Just kidding. Unless…', tr: 'Beşinci kata çıkarır mısın? Şaka şaka. Ama yani…' },
    { en: 'Can you carry it inside? My back.', tr: 'İçeri taşır mısın? Belim.' },
  ],
  heavyDamaged: [
    { en: 'Why does it rattle now?', tr: 'Bu neden şimdi takırdıyor?' },
    { en: 'It was not this shape in the photo.', tr: 'Fotoğrafta bu şekilde değildi.' },
  ],
};

const ITEM_LINES: Record<string, Partial<Record<'ok' | 'damaged' | 'ruined' | 'late', L10n[]>>> = {
  cake: {
    ok: [{ en: 'Perfect! Not a crumb out of place!', tr: 'Mükemmel! Bir kırıntı bile yerinden oynamamış!' }],
    damaged: [{ en: 'Is that… my cake?', tr: 'Bu… benim pastam mı?' }],
    ruined: [{ en: "It's a cake smoothie now.", tr: 'Pasta smoothie olmuş.' }],
  },
  wedding_cake: {
    ok: [{ en: 'All four tiers! The bride will cry!', tr: 'Dört katı da sağlam! Gelin ağlayacak!' }],
    damaged: [{ en: 'Why does it have three and a half tiers?', tr: 'Bu neden üç buçuk katlı?' }],
    ruined: [{ en: 'We will tell the guests it is modern art.', tr: 'Misafirlere modern sanat deriz.' }],
  },
  eggs: {
    damaged: [{ en: 'Some of these are already omelettes.', tr: 'Bazıları çoktan omlet olmuş.' }],
    ruined: [{ en: 'I ordered eggs, not scrambled eggs.', tr: 'Yumurta istedim, çılbır değil.' }],
  },
  fish: {
    ok: [{ en: "Bulut! You're alive!", tr: 'Bulut! Yaşıyorsun!' }],
    damaged: [{ en: 'Bulut looks dizzy.', tr: "Bulut'un başı dönüyor galiba." }],
    ruined: [{ en: 'Bulut? BULUT?!', tr: 'Bulut? BULUT?!' }],
  },
  cat: {
    ok: [{ en: 'Paşa forgives you. Barely.', tr: 'Paşa seni affetti. Zar zor.' }],
    damaged: [{ en: 'Why is Paşa staring at you like that?', tr: 'Paşa sana neden öyle bakıyor?' }],
  },
  icecream: {
    ok: [{ en: "Still frozen! You're a hero!", tr: 'Hâlâ donmuş! Kahramansın!' }],
    late: [{ en: "It's a milkshake now. Thanks.", tr: 'Milkshake olmuş. Sağ ol.' }],
  },
  maras: { late: [{ en: 'It melted. They said it never melts.', tr: 'Erimiş. Hani erimezdi?' }] },
  medicine: {
    ok: [{ en: 'Grandma says thank you. In her own way.', tr: 'Babaannem teşekkür ediyor. Kendince.' }],
    late: [{ en: 'Grandma got better on her own. Thanks anyway.', tr: 'Babaannem kendi kendine iyileşti. Yine de sağ ol.' }],
  },
  iskender: { late: [{ en: 'The butter has fossilized.', tr: 'Tereyağı fosilleşmiş.' }] },
  documents: { late: [{ en: 'The notary closed. I will live here now.', tr: 'Noter kapandı. Artık burada yaşıyorum.' }] },
  washing_machine: { damaged: [{ en: 'Why is the washing machine making that noise already?', tr: 'Çamaşır makinesi neden şimdiden bu sesi çıkarıyor?' }] },
  watermelon: { damaged: [{ en: 'You pre-sliced it. Thanks, I guess.', tr: 'Dilimlemişsin. Sağ ol herhalde.' }] },
  ficus: { ok: [{ en: 'Fikret looks happy. He never looks happy.', tr: 'Fikret mutlu görünüyor. Hiç mutlu görünmez.' }] },
};

const pickOne = (list: L10n[], rand: () => number) => list[Math.floor(rand() * list.length)];

// The customer's reaction at the door, or null when the delivery wasn't remarkable.
// condition: the package's last packageHealth (fragile health / heavy box condition).
export function customerLine(result: DeliveryResult, condition: number, rand: () => number): L10n | null {
  const id = result.offer.item.id;
  const kind = result.offer.package;
  const item = ITEM_LINES[id];
  if (result.ruined) return pickOne(item?.ruined ?? CUSTOMER_LINES.ruined, rand);
  if (kind === 'fragile' && condition < 50) return pickOne(item?.damaged ?? CUSTOMER_LINES.damaged, rand);
  if (kind === 'heavy' && condition < 50) return pickOne(item?.damaged ?? CUSTOMER_LINES.heavyDamaged, rand);
  if (result.late) return pickOne(item?.late ?? CUSTOMER_LINES.late, rand);
  if (kind === 'heavy' && rand() < 0.5) return pickOne(CUSTOMER_LINES.heavy, rand);
  if (result.stars >= 5) return pickOne(item?.ok ?? CUSTOMER_LINES.fast, rand);
  return null;
}

// The customer calling because the tracker shows their package having a bad time.
export const PHONE_LINES: L10n[] = [
  { en: 'Hello? Is my order okay? I heard a crash. From here.', tr: 'Alo? Siparişim iyi mi? Buradan bir gürültü duydum.' },
  { en: 'Why is the map showing you going sideways?', tr: 'Harita neden seni yan yan gidiyor gösteriyor?' },
  { en: "Please tell me you're not drifting.", tr: 'Lütfen drift yapmadığını söyle.' },
  { en: "I can see you on the map. You're spinning.", tr: 'Seni haritada görüyorum. Dönüp duruyorsun.' },
  { en: 'Is everything alright? Be honest.', tr: 'Her şey yolunda mı? Dürüst ol.' },
];

export const PHONE_ITEM_LINES: Record<string, L10n> = {
  cake: { en: 'Is the cake okay? The writing on top too?', tr: 'Pasta iyi mi? Üstündeki yazı da?' },
  wedding_cake: { en: 'The bride is asking about the cake. What do I tell her?', tr: 'Gelin pastayı soruyor. Ne diyeyim?' },
  eggs: { en: 'Are the eggs okay? All thirty?', tr: 'Yumurtalar iyi mi? Otuzu da?' },
  fish: { en: 'Is Bulut okay? Put him on the phone.', tr: "Bulut iyi mi? Telefonu ona ver." },
  cat: { en: 'Is that Paşa screaming? Why is Paşa screaming?', tr: 'Bağıran Paşa mı? Paşa neden bağırıyor?' },
  tea_glasses: { en: "I hear clinking. Why do I hear clinking?", tr: 'Şıngırtı duyuyorum. Neden şıngırtı duyuyorum?' },
  baklava: { en: 'Is the syrup still in the tray?', tr: 'Şerbet hâlâ tepside mi?' },
  vase_flowers: { en: "My mother-in-law is asking about the vase. I'm sweating.", tr: 'Kaynanam vazoyu soruyor. Terliyorum.' },
};
