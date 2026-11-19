import type * as THREE from 'three';
import type {
  CarSample,
  EdgeId,
  GamePhase,
  L10n,
  Mood,
  NavCommand,
  NavEvent,
  NodeId,
  PassengerDirector,
  PassengerId,
  PassengerView,
  Place,
  RoadGraph,
  Shift,
  ShiftEvent,
  ShiftState,
  Speaker,
  Turn,
  Voice,
} from './types';
import { createPassengerFigure } from './passengerFigure';

// Direction calls
const TIE = 1; // m: exits this close to the best cost are equally good (same rule as the navigator)
const FAKE_LIE_SHARE = 0.4; // a "1987" call points into a fake street this often (when there is one)
const TELL_1987 = 0.8; // a wrong call comes with its tell (a story from the past / "my cousin said") this often
const TELL_SHORTCUT = 0.6; // a right call comes with a concrete local reason this often; never on a wrong call
const AGREE_LINE = 0.3;
const YOLDAS_RETORT = 0.2;
const YOLDAS_SULK = 0.3;
const SPEAK_FALLBACK_DIST = 22; // m: say the call even if YOLDAŞ has not spoken yet
const EXIT_DIST = 12; // m from the node centre along the exit street before the exit counts
const RIGHT_TIP = 5; // ₺ × passengerMul: followed a right call
const IGNORED_TIP = 2; // ₺ × passengerMul: ignored a right call and took a worse road
// Reactions
const DRIFT_TIP_RATE = 3; // ₺/s × driftTaste × passengerMul
const DRIFT_LINE_GAP = 4;
const CRASH_IMPACT = 6;
const CRASH_GAP = 5;
const FAST_KMH = 70;
const FAST_HOLD = 1.5;
const SLOW_KMH = 15;
const SLOW_HOLD = 8;
const SPEED_LINE_GAP = 12;
const TALK_GAP = 2.5; // s between minor passenger lines
const CHATTER_MIN = 18;
const CHATTER_RANGE = 12;
const REACT_MIN = -0.5;
const REACT_MAX = 0.3;
const REACT_DECAY = 0.04; // per s back toward 0
const FIGURE_OUT = 3; // m from the place zone to the sidewalk
const CRASH_TTL = 4; // s a crash line may wait out nav lines: chaos is when it should land

type LineKey =
  | 'greet' | 'left' | 'right' | 'straight' | 'shortcut' | 'wrong' | 'agree' | 'toldYou' | 'smug' | 'sorry'
  | 'drift' | 'crash' | 'fast' | 'slow' | 'byeGood' | 'byeBad' | 'cancel' | 'chatter';

export interface PassengerDef {
  name: L10n;
  emoji: string;
  tagline: L10n; // card hint at how far to trust their directions
  color: number; // figure clothes
  speaker: Speaker;
  honesty: number; // chance a direction call is the true best exit
  callChance: number; // chance to call a direction at a junction YOLDAŞ called
  driftTaste: number; // -1 hates drifting (tip cut) .. +1 pays for it
  lines: Record<LineKey, L10n[]>; // drift = love lines for driftTaste > 0, hate lines otherwise; fast/slow may be empty
}

const t = (en: string, tr: string): L10n => ({ en, tr });
const en = (s: string): L10n => ({ en: s, tr: s }); // the tourist speaks English in both languages
const speaker = (label: L10n, pitch: number, rate: number, voiceRank: number, lang?: 'en'): Speaker => ({
  kind: 'passenger', label, pitch, rate, voiceRank, lang,
});

const TEYZE = t('Auntie Ayşe', 'Ayşe Teyze');
const ABI = t('Emre Abi', 'Emre Abi');
const PLAZA = t('Office Guy Kerem', 'Plazacı Kerem');
const TOURIST = t('Tourist Steve', 'Turist Steve');
const GRANDPA = t('Grandpa Nuri', 'Nuri Dede');
const BRIDE = t('Bride Selin', 'Gelin Selin');
const STUDENT = t('Student Deniz', 'Öğrenci Deniz');

export const PASSENGERS: Record<PassengerId, PassengerDef> = {
  teyze: {
    name: TEYZE,
    emoji: '👵',
    tagline: t('Knows every back street', 'Her ara sokağı bilir'),
    color: 0x7a4b8c,
    speaker: speaker(TEYZE, 1.5, 0.95, 1),
    honesty: 0.55,
    callChance: 0.7,
    driftTaste: -1,
    lines: {
      greet: [
        t('Hello son. Drive slowly, I have eggs.', 'Merhaba oğlum. Yavaş git, yumurta var.'),
        t('Oh, so young. Does your mother know you drive?', 'Aa, ne kadar genç. Annen biliyor mu araba sürdüğünü?'),
      ],
      left: [t('No no, left! Left!', 'Yok yok, sola! Sola!'), t('Turn left here, son.', 'Buradan sola dön oğlum.')],
      right: [t('Turn right here, son.', 'Buradan sağa dön oğlum.'), t('Right, son, right!', 'Sağa oğlum, sağa!')],
      straight: [t('Go straight, son, straight!', 'Düz git oğlum, düz!')],
      shortcut: [
        t('I know a shortcut. Trust your auntie.', 'Ben kestirme biliyorum. Teyzene güven.'),
        t('My sister-in-law lives there. It is shorter.', 'Görümcem orada oturuyor. Oradan daha kısa.'),
      ],
      wrong: [
        t('There used to be a bakery there. In 1987.', 'Orada eskiden bir fırın vardı. 1987\'de.'),
        t('That is how we went to my wedding.', 'Düğünüme oradan gitmiştik.'),
      ],
      agree: [t('See? Even the phone knows.', 'Bak, telefon bile biliyor.')],
      toldYou: [t('I told you, son. Nobody listens to auntie.', 'Ben sana dedim oğlum. Teyzeyi kimse dinlemiyor.')],
      smug: [t('See? Auntie knows. Write that down.', 'Gördün mü? Teyzen bilir. Yaz bunu bir kenara.')],
      sorry: [t('Hm. When did they close this? Nobody tells me anything.', 'Hıh. Bu ne zaman kapandı? Bana kimse bir şey söylemiyor.')],
      drift: [
        t('Slow down! I have eggs!', 'Yavaş! Yumurta var!'),
        t('Oh my God! Son, what are you doing!', 'Aman Allahım! Oğlum ne yapıyorsun!'),
        t('My blood pressure! Where are my pills?', 'Tansiyonum! Hapım nerede benim?'),
      ],
      crash: [t('Ay, my back! I will tell your mother!', 'Ay belim! Annene söyleyeceğim!')],
      fast: [t('This is not a highway, son!', 'Burası otoban değil oğlum!')],
      slow: [],
      byeGood: [t('You are a good boy. Here, for your tea.', 'Aferin sana. Al bu da çay parası.')],
      byeBad: [t('My son drives better. And he is a dentist.', 'Benim oğlum daha iyi sürer. Diş hekimi ama.')],
      cancel: [t('Stop the car! I am getting out here!', 'Durdur arabayı! Ben burada iniyorum!')],
      chatter: [
        t('Are you married? I have a niece. Very cultured.', 'Evli misin? Bir yeğenim var. Çok kültürlü.'),
        t('Do not listen to that phone. Phones know nothing.', 'O telefonu dinleme. Telefon ne bilir.'),
        t('Hello, Fatma? I am in the car. No, a courier. Yes, he looks hungry.', 'Alo Fatma? Arabadayım. Yok, kurye. Evet, aç gibi duruyor.'),
      ],
    },
  },

  abi: {
    name: ABI,
    emoji: '😎',
    tagline: t('Knows the night spots', 'Gece mekanlarını bilir'),
    color: 0x1f1f24,
    speaker: speaker(ABI, 0.8, 1.25, 2),
    honesty: 0.4,
    callChance: 0.45,
    driftTaste: 1,
    lines: {
      greet: [t('Abi! Finally! Let\'s go, let\'s go!', 'Abi! Nihayet! Bas bas bas!')],
      left: [t('Left, abi, left!', 'Sol abi, sol!')],
      right: [t('Hit the right, abi!', 'Sağa kır abi!')],
      straight: [t('Straight! Floor it!', 'Dümdüz! Gömmek lazım!')],
      shortcut: [t('I park here every night, I know it.', 'Her gece buraya park ediyorum, bilirim.')],
      wrong: [
        t('Trust me. I think. Maybe.', 'Güven bana. Sanırım. Galiba.'),
        t('My uncle said there was a road. In like 1987.', 'Dayım orada yol var demişti. 1987 falan.'),
      ],
      agree: [t('Phone gets it, abi!', 'Telefon da çakmış abi!')],
      toldYou: [t('I said it, abi! Why don\'t you listen!', 'Dedim abi! Neden dinlemiyorsun!')],
      smug: [t('Told you, abi. Night knowledge.', 'Dedim sana abi. Gece bilgisi.')],
      sorry: [t('Ehh. That wasn\'t there yesterday.', 'Eee. Dün orada değildi o.')],
      drift: [
        t('One more, abi! One more!', 'Bir daha abi! Bir daha!'),
        t('Drift it! Drift it!', 'Kaydır abi kaydır!'),
        t('I\'m filming this! Again!', 'Çekiyorum abi! Bir daha yap!'),
      ],
      crash: [t('Haha! That was nothing, abi! Keep going!', 'Haha! Bir şey olmadı abi, devam!')],
      fast: [t('Now we\'re talking, abi!', 'İşte bu abi!')],
      slow: [t('Abi, my grandma drives faster.', 'Abi babaannem daha hızlı sürüyor.')],
      byeGood: [t('You\'re a legend, abi! Keep the change!', 'Efsanesin abi! Üstü kalsın!')],
      byeBad: [t('Abi... that was so boring. Like a bus.', 'Abi... çok sıkıcıydı. Otobüs gibi.')],
      cancel: [t('I\'m out, abi! I\'ll walk!', 'Ben iniyorum abi! Yürürüm!')],
      chatter: [
        t('Abi, do you have an aux cable?', 'Abi aux kablon var mı?'),
        t('Hello, bro! On my way. Five minutes. Maybe twenty.', 'Alo kanka! Geliyorum. Beş dakika. Belki yirmi.'),
        t('Abi, is this a Şahin? Respect.', 'Abi bu Şahin mi? Saygılar.'),
      ],
    },
  },

  plaza: {
    name: PLAZA,
    emoji: '💼',
    tagline: t('Same commute every day', 'Her gün aynı yoldan geçer'),
    color: 0x2f4a6d,
    speaker: speaker(PLAZA, 1.0, 1.4, 1),
    honesty: 0.6,
    callChance: 0.5,
    driftTaste: -0.6,
    lines: {
      greet: [t('Hi, yes, hello. I have a meeting in four minutes.', 'Merhaba, evet. Dört dakikaya toplantım var.')],
      left: [t('Left. Quickly.', 'Sol. Hızlı.')],
      right: [t('Right, right, take the right.', 'Sağ, sağ, sağdan gir.')],
      straight: [t('Straight. Don\'t stop. Never stop.', 'Düz. Durma. Asla durma.')],
      shortcut: [t('I take it every day. Saves ninety seconds.', 'Her gün oradan geçiyorum. Doksan saniye kazandırıyor.')],
      wrong: [
        t('I think. My assistant usually does this part.', 'Sanırım. Bu kısmı genelde asistanım hallediyor.'),
        t('It was on a slide once. Q3, maybe.', 'Bir sunumda görmüştüm. Üçüncü çeyrek galiba.'),
      ],
      agree: [t('Fine. The app agrees. Synergy.', 'Tamam. Uygulama da aynı fikirde. Sinerji.')],
      toldYou: [t('That cost us forty seconds. It goes in the report.', 'Bu bize kırk saniye kaybettirdi. Rapora yazıyorum.')],
      smug: [t('See? Efficiency. You\'re welcome.', 'Gördün mü? Verimlilik. Rica ederim.')],
      sorry: [t('Okay. That road was deprecated. My bad.', 'Tamam. O yol kaldırılmış. Benim hatam.')],
      drift: [
        t('Please! My laptop is in the bag!', 'Lütfen! Çantada laptop var!'),
        t('I\'m on a call! Stop sliding!', 'Telefondayım! Kaymayı bırak!'),
      ],
      crash: [t('Great. Now my coffee is on my shirt.', 'Harika. Kahve gömleğime döküldü.')],
      fast: [],
      slow: [t('Faster, please. I have a meeting.', 'Daha hızlı lütfen. Toplantım var.')],
      byeGood: [t('On time. Five stars. Let\'s circle back.', 'Tam vaktinde. Beş yıldız. Sonra dönüş yaparım.')],
      byeBad: [t('I\'m late. I\'m writing an email about this.', 'Geç kaldım. Bununla ilgili mail atacağım.')],
      cancel: [t('Stop. I\'ll take a scooter.', 'Dur. Scooter\'a binerim.')],
      chatter: [
        t('Yes, Hakan, I\'m in the car. Share your screen.', 'Evet Hakan, arabadayım. Ekranını paylaş.'),
        t('Can you mute the GPS? I\'m in a meeting.', 'Navigasyonu sessize alır mısın? Toplantıdayım.'),
        t('Do you do invoices? For the company?', 'Fatura kesiyor musunuz? Şirkete?'),
      ],
    },
  },

  tourist: {
    name: TOURIST,
    emoji: '📸',
    tagline: t('Guidebook from 1987', 'Rehber kitabı 1987 baskı'),
    color: 0xe3a33b,
    speaker: speaker(TOURIST, 1.1, 1.0, 1, 'en'),
    honesty: 0.2,
    callChance: 0.4,
    driftTaste: 0.3,
    lines: {
      greet: [en('Merhaba! I learned one word. That was it.')],
      left: [en('Left! Sol? Sol!')],
      right: [en('Right! Sağ! Is that right?')],
      straight: [en('Straight! Düz! I love this word.')],
      shortcut: [en('I walked this street this morning. It works.')],
      wrong: [en('My guidebook says so. It is from 1987.'), en('I saw it on a postcard.')],
      agree: [en('Ha! The phone and I agree. We are friends now.')],
      toldYou: [en('I told you! I am basically a local now.')],
      smug: [en('Shortcut! I will put this in my blog!')],
      sorry: [en('Oh. The guidebook did not mention walls.')],
      drift: [en('Wow! For my Instagram! Again!'), en('Is this normal in Istanbul? I love it!')],
      crash: [en('Oof! Is that part of the tour?')],
      fast: [en('Whoa! Is there a speed limit here?')],
      slow: [],
      byeGood: [en('Teşekkürler! Five stars! Best tour ever!')],
      byeBad: [en('I will write a review. A long one.')],
      cancel: [en('I will walk! I have good shoes!')],
      chatter: [
        en('Is this... the Bosphorus?'),
        en('How do you say "I am lost" in Turkish? Asking for me.'),
        en('Mom! I am in a real Turkish car! No, it is fine!'),
      ],
    },
  },

  grandpa: {
    name: GRANDPA,
    emoji: '👴',
    tagline: t('Last drove in 1987', 'En son 1987\'de araba sürdü'),
    color: 0x5b4a36,
    speaker: speaker(GRANDPA, 0.6, 0.8, 2),
    honesty: 0.25,
    callChance: 0.45,
    driftTaste: -0.5,
    lines: {
      greet: [t('Good day, young man. I know this city like my own pocket.', 'Hayırlı günler evladım. Bu şehri avucumun içi gibi bilirim.')],
      left: [t('Turn left here, my boy.', 'Buradan sola kır evladım.')],
      right: [t('To the right, my boy.', 'Sağa evladım, sağa.')],
      straight: [t('Straight on, my boy. No rush.', 'Dümdüz devam evladım. Acele yok.')],
      shortcut: [t('My barber is there. Fifty years. Shortest way.', 'Berberim orada. Elli yıldır. En kısa yol.')],
      wrong: [
        t('In 1987 this was the fastest way.', '1987\'de en kısa yol buydu.'),
        t('My map says so. My map is from 1987.', 'Haritam öyle diyor. Haritam 1987 basımı.'),
        t('The tram used to pass here. Before the war. Which war, I forget.', 'Eskiden tramvay geçerdi buradan. Savaştan önce. Hangi savaş, unuttum.'),
      ],
      agree: [t('That little box is right. Good little box.', 'Bu küçük kutu haklı. Aferin küçük kutu.')],
      toldYou: [t('I told you, my boy. Young people never listen.', 'Söyledim evladım. Gençler hiç dinlemez.')],
      smug: [t('Fifty years in this city, my boy. Fifty years.', 'Elli yıl bu şehirde evladım. Elli yıl.')],
      sorry: [t('Hm. This wall is new. Seventies, maybe.', 'Hmm. Bu duvar yeni. Yetmişlerden kalma herhalde.')],
      drift: [
        t('Slowly, my boy! My heart is not new!', 'Yavaş evladım! Kalbim yeni değil!'),
        t('In my day, cars went straight!', 'Bizim zamanımızda arabalar düz giderdi!'),
      ],
      crash: [t('Oh! My teeth! Where are my teeth?', 'Ah! Takma dişim! Dişim nerede?')],
      fast: [t('Slow down! This is not a horse race!', 'Yavaşla! At yarışı mı bu!')],
      slow: [],
      byeGood: [t('God bless you, my boy. Here, buy yourself a simit.', 'Allah razı olsun evladım. Al, kendine bir simit al.')],
      byeBad: [t('In 1987, couriers had manners.', '1987\'de kuryelerin terbiyesi vardı.')],
      cancel: [t('Stop here. I will take the tram.', 'Dur burada. Ben tramvaya binerim.')],
      chatter: [
        t('In 1987 a simit was five kuruş. Five!', '1987\'de simit beş kuruştu. Beş!'),
        t('Did I tell you about my military service? No? Good. It was long.', 'Askerliğimi anlattım mı? Anlatmadım mı? İyi. Uzundu.'),
        t('This phone talks? In my day, maps did not talk back.', 'Bu telefon konuşuyor mu? Bizim zamanımızda haritalar laf sokmazdı.'),
      ],
    },
  },

  bride: {
    name: BRIDE,
    emoji: '👰',
    tagline: t('Was here for the rehearsal', 'Provaya buraya gelmişti'),
    color: 0xf2efe9,
    speaker: speaker(BRIDE, 1.6, 1.3, 1),
    honesty: 0.5,
    callChance: 0.5,
    driftTaste: -1,
    lines: {
      greet: [t('Drive! Drive! The wedding started ten minutes ago!', 'Sür! Sür! Düğün on dakika önce başladı!')],
      left: [t('Left! Left! Hurry!', 'Sol! Sol! Çabuk!')],
      right: [t('Right! Right now!', 'Sağ! Hemen sağ!')],
      straight: [t('Straight! Don\'t stop for anything!', 'Düz! Hiçbir şey için durma!')],
      shortcut: [t('The wedding hall is that way, I did the rehearsal!', 'Düğün salonu o tarafta, provaya geldim!')],
      wrong: [
        t('My cousin said! Or the caterer! Someone said!', 'Kuzenim dedi! Ya da catering! Biri dedi!'),
        t('My mother went this way in 1987. To her wedding!', 'Annem 1987\'de buradan gitmiş. Kendi düğününe!'),
      ],
      agree: [t('Yes! Listen to the phone! Listen to everyone!', 'Evet! Telefonu dinle! Herkesi dinle!')],
      toldYou: [t('I SAID it! Why does nobody listen to the bride!', 'Ben DEDİM! Neden kimse gelini dinlemiyor!')],
      smug: [t('See! I know where my own wedding is!', 'Gördün mü! Kendi düğünümün yerini biliyorum!')],
      sorry: [t('Okay, that was wrong. Don\'t tell my mother.', 'Tamam, yanlıştı. Anneme söyleme.')],
      drift: [
        t('My dress! My hair! My everything!', 'Gelinliğim! Saçım! Her şeyim!'),
        t('If my makeup moves, you are dead!', 'Makyajım bozulursa seni öldürürüm!'),
      ],
      crash: [t('My veil! Where is my veil!', 'Duvağım! Duvağım nerede!')],
      fast: [t('Yes! Faster! But don\'t slide!', 'Evet! Hızlı! Ama kayma!')],
      slow: [t('Why are we slow? I\'m getting married!', 'Neden yavaşız? Evleniyorum ben!')],
      byeGood: [t('You saved my wedding! You\'re invited! Not really.', 'Düğünümü kurtardın! Davetlisin! Şaka şaka.')],
      byeBad: [t('My hair is ruined. This is in the wedding video now.', 'Saçım mahvoldu. Bu artık düğün videosunda.')],
      cancel: [t('Stop! I\'ll run there in heels!', 'Dur! Topuklularla koşarım!')],
      chatter: [
        t('Mom? Yes, I\'m coming. No, the groom can wait.', 'Alo anne? Geliyorum. Yok, damat beklesin.'),
        t('Do I look okay? Don\'t answer. Drive.', 'İyi görünüyor muyum? Cevap verme. Sür.'),
        t('He\'d better be there. I swear.', 'Orada olsa iyi olur. Yemin ederim.'),
      ],
    },
  },

  student: {
    name: STUDENT,
    emoji: '🎧',
    tagline: t('Walks to the dorm every night', 'Her gece yurda yürür'),
    color: 0x3f7f6a,
    speaker: speaker(STUDENT, 1.0, 0.85, 2),
    honesty: 0.45,
    callChance: 0.35,
    driftTaste: 0.6,
    lines: {
      greet: [t('Hey. Can you go fast? I have an exam. In theory.', 'Selam. Hızlı gidebilir misin? Sınavım var. Teoride.')],
      left: [t('Uh... left. Left, yeah.', 'Şey... sol. Sol, evet.')],
      right: [t('Right. Go right.', 'Sağ. Sağa gir.')],
      straight: [t('Straight, bro.', 'Düz kanka.')],
      shortcut: [t('My dorm is that way. I walk it every night.', 'Yurt o tarafta. Her gece yürüyorum.')],
      wrong: [
        t('Google said so. Last year. Offline.', 'Google öyle dedi. Geçen sene. Çevrimdışı.'),
        t('I saw it in a meme. Memes don\'t lie.', 'Bir capste gördüm. Capsler yalan söylemez.'),
      ],
      agree: [t('Same as the phone. We\'re in sync.', 'Telefonla aynı. Senkronuz.')],
      toldYou: [t('Bro. I literally said it.', 'Kanka. Resmen söyledim.')],
      smug: [t('Ha. Student discount on time, too.', 'Ha. Zamandan da öğrenci indirimi.')],
      sorry: [t('Oops. My bad. Don\'t rate me.', 'Hay aksi. Benim hatam. Bana puan verme.')],
      drift: [t('Yo! That was sick! Again!', 'Oha! Çok iyiydi! Bir daha!'), t('Bro, I\'m posting this.', 'Kanka bunu paylaşıyorum.')],
      crash: [t('Ow. Okay. I\'m awake now.', 'Ay. Tamam. Uyandım şimdi.')],
      fast: [t('Okay, okay, we might make the exam!', 'Tamam tamam, sınava yetişebiliriz!')],
      slow: [],
      byeGood: [t('Thanks, bro. Sorry, I only have coins.', 'Sağ ol kanka. Kusura bakma, bozuk param var sadece.')],
      byeBad: [t('That was... a ride. I guess.', 'Bu... bir yolculuktu. Sanırım.')],
      cancel: [t('I\'ll take the bus. It\'s cheaper anyway.', 'Otobüse binerim. Zaten daha ucuz.')],
      chatter: [
        t('Do you have a charger? I\'m at three percent.', 'Şarj aletin var mı? Yüzde üçteyim.'),
        t('Is your GPS sarcastic? Mine is too.', 'Senin navigasyon da mı laf sokuyor? Benimki de.'),
        t('Mom? Yes, I\'m studying. In a car. It\'s a study car.', 'Alo anne? Evet, ders çalışıyorum. Arabada. Çalışma arabası bu.'),
      ],
    },
  },
};

const RETORTS: { text: L10n; mood: Mood; emoji: string }[] = [
  { text: t('Ignore the passenger. I am the navigator.', 'Yolcuyu dinleme. Navigasyon benim.'), mood: 'offended', emoji: '🙄📍' },
  { text: t('Passengers are not GPS certified.', 'Yolcuların GPS sertifikası yok.'), mood: 'annoyed', emoji: '🚫🛰️' },
  { text: t('I have satellites. They have opinions.', 'Bende uydu var. Onlarda fikir.'), mood: 'sarcastic', emoji: '🛰️🤷' },
];
const SULKS: { text: L10n; mood: Mood; emoji: string }[] = [
  { text: t('Lucky guess.', 'Şans eseri.'), mood: 'passive_aggressive', emoji: '😒' },
  { text: t('Fine. Write it down. It will not happen again.', 'Peki. Not et. Bir daha olmayacak.'), mood: 'offended', emoji: '📝😤' },
];

interface Ride {
  orderId: number;
  id: PassengerId;
  def: PassengerDef;
  aboard: boolean;
  tipDelta: number;
  react: number; // recent reactions, REACT_MIN..REACT_MAX, decays to 0
  driftAcc: number; // ₺ not yet applied
}

interface Call {
  node: NodeId;
  entry: EdgeId;
  exit: EdgeId; // the passenger's exit; -1 = no call at this junction (roll failed or agreed)
  turn: Turn;
  good: boolean; // exit is (one of) the true best
  costs: Map<EdgeId, number>;
  bestCost: number;
  text: L10n | null; // spoken after YOLDAŞ's line
  spoken: boolean; // handed to the voice
  heard: boolean; // the voice actually played it: only a heard call can cost or earn a tip
  reached: boolean; // the car has been inside the junction box
}

export function createPassengers(
  scene: THREE.Scene,
  graph: RoadGraph,
  voice: Voice,
  shift: Shift,
  rand: () => number = Math.random,
): PassengerDirector {
  const figure = createPassengerFigure(scene);
  const pickRand = <T>(a: T[]): T => a[Math.floor(rand() * a.length)];
  const incident = (e: EdgeId, n: NodeId) => graph.edges[e].a === n || graph.edges[e].b === n;

  let ride: Ride | null = null;
  let call: Call | null = null;
  let car: CarSample | null = null;
  let phase: GamePhase = 'title';
  let dropoff: Place | null = null;
  let passengerMul = 1;
  let comfort = 100;
  let blamedFake: EdgeId | null = null; // fake street the passenger sent the car into (sorry on the crash)
  let talkCd = 0;
  let driftCd = 0;
  let crashCd = 0;
  let speedCd = 0;
  let fastT = 0;
  let slowT = 0;
  let chatterT = CHATTER_MIN;
  const pub: PassengerView = { id: 'teyze', name: TEYZE, icon: '', aboard: false, mood: 1, wants: null, tipDelta: 0 };

  function speak(key: LineKey, critical = false, ttl?: number): boolean {
    if (!ride) return false;
    const lines = ride.def.lines[key];
    if (!lines.length) return false;
    voice.sayText(pickRand(lines), { speaker: ride.def.speaker, priority: 'react', critical, ttl });
    talkCd = TALK_GAP;
    return true;
  }

  function yoldas(pool: { text: L10n; mood: Mood; emoji: string }[]) {
    const l = pickRand(pool);
    voice.sayText(l.text, { mood: l.mood, emoji: l.emoji, priority: 'react' });
  }

  function tip(delta: number) {
    if (!ride || delta === 0 || phase !== 'driving') return;
    shift.adjustTip(delta);
    ride.tipDelta += delta;
  }

  function nudge(d: number) {
    if (ride) ride.react = Math.min(REACT_MAX, Math.max(REACT_MIN, ride.react + d));
  }

  // Same cost as the navigator: road length from node n through exit x to the place.
  function exitCost(n: NodeId, x: EdgeId, place: Place): number {
    const e = graph.edges[x];
    if (e.fake) return Infinity;
    if (place.edge === x) return (n === e.a ? place.t : 1 - place.t) * e.length;
    return e.length + graph.distToPlace(graph.other(x, n), place);
  }

  function onCommand(c: NavCommand) {
    if (!ride?.aboard || phase !== 'driving' || !car || !dropoff) return;
    if (c.node < 0 || c.said === 'arrive' || c.said === 'uturn') return;
    if (call && call.node === c.node) return; // one call per junction: a recalc re-issue keeps it
    call = null;
    const pos = graph.locate(car.x, car.z);
    if (pos.kind !== 'edge' || !incident(pos.edge, c.node)) return;
    const n = c.node;
    const entry = pos.edge;
    const none: Call = { node: n, entry, exit: -1, turn: 'straight', good: false, costs: new Map(), bestCost: 0, text: null, spoken: true, heard: false, reached: false };
    call = none;
    const exits = graph.nodes[n].edges.filter((x) => x !== entry);
    if (exits.length < 2 || rand() >= ride.def.callChance) return;

    const costs = new Map<EdgeId, number>();
    let bestCost = Infinity;
    for (const x of exits) {
      const cost = exitCost(n, x, dropoff);
      costs.set(x, cost);
      bestCost = Math.min(bestCost, cost);
    }
    if (bestCost === Infinity) return;
    const best = exits.filter((x) => costs.get(x)! <= bestCost + TIE);
    const fakes = exits.filter((x) => graph.edges[x].fake);
    const detours = exits.filter((x) => !graph.edges[x].fake && costs.get(x)! > bestCost + TIE);

    let exit: EdgeId;
    if (rand() < ride.def.honesty) exit = pickRand(best);
    else if (fakes.length && (rand() < FAKE_LIE_SHARE || !detours.length)) exit = pickRand(fakes);
    else if (detours.length) exit = pickRand(detours);
    else exit = pickRand(best); // nowhere wrong to send you: an honest call after all
    const good = costs.get(exit)! <= bestCost + TIE;
    const turn = graph.turn(graph.other(entry, n), n, graph.other(exit, n));
    if (turn === 'uturn') return;

    // Swap-L/R updates never touch passengers: compare with what YOLDAŞ actually said.
    if (turn === c.said) {
      if (rand() < AGREE_LINE) speak('agree');
      return;
    }
    const dir = pickRand(ride.def.lines[turn]);
    const tell = good ? (rand() < TELL_SHORTCUT ? 'shortcut' : null) : rand() < TELL_1987 ? 'wrong' : null;
    const tail = tell ? pickRand(ride.def.lines[tell]) : null;
    const text = tail ? { en: `${dir.en} ${tail.en}`, tr: `${dir.tr} ${tail.tr}` } : dir;
    call = { node: n, entry, exit, turn, good, costs, bestCost, text, spoken: false, heard: false, reached: false };
  }

  // After YOLDAŞ's own line, so the two never talk over each other and the nav line is never delayed.
  function speakCall(c: Call) {
    if (!ride || !c.text) return;
    c.spoken = true;
    voice.sayText(c.text, { speaker: ride.def.speaker, priority: 'react', onPlay: () => (c.heard = true) });
    talkCd = TALK_GAP;
    if (rand() < YOLDAS_RETORT) yoldas(RETORTS);
  }

  function resolve(c: Call, x: EdgeId) {
    call = null;
    if (c.exit < 0 || !c.heard) return; // a call the voice dropped never happened for the player
    const tookGood = (c.costs.get(x) ?? Infinity) <= c.bestCost + TIE;
    if (x === c.exit && c.good) {
      speak('smug', true);
      tip(Math.round(RIGHT_TIP * passengerMul));
      nudge(0.25);
      if (rand() < YOLDAS_SULK) yoldas(SULKS);
    } else if (x === c.exit) {
      if (graph.edges[x].fake) blamedFake = x;
      else speak('sorry');
    } else if (c.good && !tookGood) {
      speak('toldYou', true);
      tip(-Math.round(IGNORED_TIP * passengerMul));
      nudge(-0.2);
    }
  }

  function trackCall(c: Call, cs: CarSample) {
    if (!c.spoken) {
      const nd = graph.nodes[c.node];
      if (Math.hypot(cs.x - nd.x, cs.z - nd.z) < SPEAK_FALLBACK_DIST) speakCall(c);
    }
    const pos = graph.locate(cs.x, cs.z);
    if (pos.kind === 'off') return;
    if (pos.kind === 'node') {
      if (pos.node === c.node) c.reached = true;
      else call = null; // somewhere else entirely (placed/reset)
      return;
    }
    if (!incident(pos.edge, c.node)) {
      call = null;
      return;
    }
    const e = graph.edges[pos.edge];
    const fromNode = (c.node === e.a ? pos.t : 1 - pos.t) * e.length;
    // The entry street only counts as an exit (a U-turn) once the car has been in the junction.
    if (fromNode > EXIT_DIST && (pos.edge !== c.entry || c.reached)) resolve(c, pos.edge);
  }

  function react(dt: number, cs: CarSample, r: Ride) {
    const taste = r.def.driftTaste;
    if (cs.drifting && taste !== 0) {
      r.driftAcc += taste * DRIFT_TIP_RATE * passengerMul * dt;
      const whole = Math.trunc(r.driftAcc);
      if (whole !== 0) {
        tip(whole);
        r.driftAcc -= whole;
      }
      nudge(taste * 0.15 * dt);
      if (driftCd <= 0 && talkCd <= 0 && speak('drift')) driftCd = DRIFT_LINE_GAP;
    }
    if (cs.impact >= CRASH_IMPACT && crashCd <= 0) {
      crashCd = CRASH_GAP;
      speak('crash', false, CRASH_TTL);
      nudge(-0.3);
    }
    const kmh = cs.speed * 3.6;
    fastT = kmh > FAST_KMH ? fastT + dt : 0;
    slowT = kmh < SLOW_KMH ? slowT + dt : 0;
    if (speedCd <= 0 && talkCd <= 0) {
      if (fastT > FAST_HOLD && speak('fast')) {
        speedCd = SPEED_LINE_GAP;
        nudge(taste > 0 ? 0.1 : -0.1);
      } else if (slowT > SLOW_HOLD && speak('slow')) {
        speedCd = SPEED_LINE_GAP;
        nudge(-0.1);
      }
    }
    chatterT -= dt;
    if (chatterT <= 0) {
      chatterT = CHATTER_MIN + rand() * CHATTER_RANGE;
      voice.sayText(pickRand(r.def.lines.chatter), { speaker: r.def.speaker, priority: 'chatter' });
    }
  }

  function showFigure(p: Place, color: number) {
    const e = graph.edges[p.edge];
    const horizontal = graph.nodes[e.a].z === graph.nodes[e.b].z;
    // Outward (toward the curb the zone is next to): see roadGraph's place offset.
    const ox = horizontal ? 0 : p.side;
    const oz = horizontal ? -p.side : 0;
    figure.show(p.x + ox * FIGURE_OUT, p.z + oz * FIGURE_OUT, Math.atan2(-ox, -oz), color);
  }

  function reset() {
    ride = null;
    call = null;
    blamedFake = null;
    talkCd = driftCd = crashCd = speedCd = fastT = slowT = 0;
    chatterT = CHATTER_MIN;
    figure.hide();
  }

  return {
    update(dt, cs, state: ShiftState) {
      car = cs;
      phase = state.phase;
      passengerMul = state.mods.passengerMul;
      const order = state.order;
      const pid = order?.offer.item.passenger;
      if (!order || !pid) {
        if (ride) reset();
        return;
      }
      if (!ride || ride.orderId !== order.offer.id) {
        reset();
        ride = { orderId: order.offer.id, id: pid, def: PASSENGERS[pid], aboard: false, tipDelta: 0, react: 0, driftAcc: 0 };
      }
      const r = ride;
      r.aboard = order.phase === 'toDropoff';
      dropoff = order.offer.dropoff;
      comfort = order.packageHealth;
      if (r.aboard) figure.hide();
      else showFigure(order.offer.pickup, r.def.color);
      figure.update(dt);
      if (phase !== 'driving') return;

      talkCd -= dt;
      driftCd -= dt;
      crashCd -= dt;
      speedCd -= dt;
      r.react -= Math.sign(r.react) * Math.min(Math.abs(r.react), REACT_DECAY * dt);
      if (!r.aboard) return;
      if (call) trackCall(call, cs);
      react(dt, cs, r);
    },

    onNavEvent(e: NavEvent) {
      if (e.type === 'command') onCommand(e.command);
      else if (e.type === 'told') {
        if (call && !call.spoken && call.node === e.command.node) speakCall(call);
      } else if (e.type === 'fakeRoadHit' && e.edge === blamedFake) {
        blamedFake = null;
        speak('sorry');
      }
    },

    onShiftEvent(e: ShiftEvent) {
      if (!ride) return;
      if (e.type === 'pickedUp') {
        ride.aboard = true;
        chatterT = CHATTER_MIN + rand() * CHATTER_RANGE;
        speak('greet', true);
      } else if (e.type === 'delivered' && e.result.offer.item.passenger) {
        speak(e.result.stars >= 3 && ride.tipDelta >= 0 ? 'byeGood' : 'byeBad', true);
        call = null;
      } else if (e.type === 'cancelled' && ride.aboard) {
        // After a cancel that cost the shift, the continue prompt has already spoken: don't talk over it.
        if (shift.state.phase === 'driving') speak('cancel', true);
        call = null;
      }
    },

    view() {
      if (!ride) return null;
      pub.id = ride.id;
      pub.name = ride.def.name;
      pub.icon = `ui/people/${ride.id}.png`;
      pub.aboard = ride.aboard;
      pub.mood = Math.min(1, Math.max(0, 0.75 * (comfort / 100) + 0.15 + ride.react));
      pub.wants = ride.aboard && call && call.exit >= 0 && call.heard ? call.turn : null;
      pub.tipDelta = ride.tipDelta;
      return pub;
    },

    reset,
  };
}
