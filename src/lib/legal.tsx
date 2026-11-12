// Legal page texts in English and Hungarian. DRAFTS: have a lawyer check them before launch.
// Fill in every highlighted placeholder (search for <Ph>).
import Link from 'next/link';
import type { Lang } from './i18n/dict';

const Ph = ({ children }: { children: React.ReactNode }) => <span className="ph">{children}</span>;
type Doc = { title: string; updated: string; body: React.ReactNode };

const privacyEn: Doc = { title: 'Privacy policy', updated: 'Last updated: 12 November 2026', body: <>
  <h2>Who we are</h2>
  <p>UNIER is run by <Ph>operator name</Ph>, <Ph>address</Ph> (“we”). We decide how your data is used. Questions or requests: <Ph>privacy email</Ph>.</p>
  <h2>What we collect, and why</h2>
  <ul>
    <li><b>Your account:</b> email address, password (stored only in scrambled form), and an optional handle and name. We need these to run your account (GDPR Art. 6(1)(b)). If you choose Google sign-in, Google confirms your email address to us; Google’s own policy covers your Google account.</li>
    <li><b>Your signatures and reasons:</b> a signature shows a political opinion, which the law treats as sensitive. We only record signatures with your explicit consent (Art. 9(2)(a)), and we keep a record of when you gave or withdrew it, to be able to prove it. Signatures are private: nobody else can see them unless you switch that on, and petition targets and organisers only receive totals. With each signature we keep the approximate country of your internet connection, only to show totals per country in the petition’s delivery report; countries with fewer than 10 signers are grouped together. A reason is shown only if you choose. You can withdraw any signature, or your consent, at any time under You. Withdrawing consent deletes all your signatures.</li>
    <li><b>Official petitions elsewhere:</b> some petitions link to an official petition on another site (for example the European Citizens’ Initiative). Signing there is separate: that site collects your data under its own policy.</li>
    <li><b>Follows, settings and friends:</b> to show you updates and run the features you use (Art. 6(1)(b)). Friends see your signatures only if you switch that on. Friend requests nobody answers are deleted after 90 days. Your invite link holds a random code; making a new one stops the old link working.</li>
    <li><b>Profile and messages:</b> your handle, name, short bio and chosen topics are public (if you tell us you are under 18: friends only). Messages can only be sent between friends; only the two of you can read them, unless one of you reports a message, which shares that one message with our moderators. Blocking someone hides you from each other immediately. Messages are deleted with your account (Art. 6(1)(b)).</li>
    <li><b>Reports you send:</b> what you reported and the reason you gave. Only our moderators see a report; the person you reported is not told who reported them. We need this to deal with illegal or harmful content (Art. 6(1)(c) and (f), and the EU Digital Services Act). Reports are deleted automatically 12 months after we close them.</li>
    <li><b>Videos and petitions you post:</b> public once approved, under the name you choose (Art. 6(1)(b)). If we decline or remove something, you see our reason under You.</li>
    <li><b>What your feed learns:</b> a score per topic, based on what you watch, to choose your next videos (our legitimate interest, Art. 6(1)(f)). You can reset it or switch to a time-ordered feed under You at any time. If you are not signed in, this stays in your own browser.</li>
    <li><b>Mylo and the news:</b> Mylo’s mood and the news section use only public headlines from news outlets and overall totals on UNIER, such as how many people signed today. They never use data about you as a person.</li>
    <li><b>Technical data:</b> our hosting providers keep short-lived logs, including IP addresses, to keep the service secure (Art. 6(1)(f)).</li>
  </ul>
  <h2>Cookies and browser storage</h2>
  <p>We use no advertising, analytics or tracking cookies. We use only these:</p>
  <ul>
    <li><b>Login cookie</b> (<code>sb-…-auth-token</code>): keeps you signed in, until you sign out.</li>
    <li><b>lang</b>: the language you chose, for 1 year.</li>
    <li><b>geo</b>: the approximate country of your connection, for 24 hours. Used only to add your signature to the per-country totals.</li>
    <li><b>Browser storage</b>, which stays on your device: what the feed learned if you are not signed in (<code>unite-weights</code>), a signature you started before signing in, until it is done (<code>unier-pending-sign</code>), and that you closed a tip or Mylo already said hello today (<code>unier-install-dismissed</code>, <code>mylo-greeted</code>).</li>
  </ul>
  <h2>Who handles data for us</h2>
  <ul>
    <li>Supabase: database, login and video storage, in the EU (Frankfurt).</li>
    <li>Vercel: website hosting, servers in Frankfurt. Vercel is a US company and is bound by the EU Standard Contractual Clauses and the EU-US Data Privacy Framework.</li>
    <li><Ph>email provider</Ph>: sending login and update emails.</li>
    <li>Google: only if you choose Google sign-in.</li>
  </ul>
  <p>To show the news we read the public news feeds of outlets such as the BBC, The Guardian, Telex and HVG. We send them nothing about you. We never sell your data and never show ads based on it.</p>
  <h2>How long we keep it</h2>
  <ul>
    <li>Account, profile, settings, friends and messages: until you delete your account.</li>
    <li>Signatures: until you withdraw them, withdraw your consent, or delete your account. The record of your consent stays as long as your account does.</li>
    <li>Reports: 12 months after we close them (deleted automatically every day).</li>
    <li>Friend requests nobody answers: 90 days (deleted automatically).</li>
    <li>Provider logs: deleted after at most <Ph>30 days</Ph>.</li>
  </ul>
  <h2>Keeping it safe</h2>
  <p>All connections are encrypted. The database checks on every request who may see each row, so even our own website cannot read your private data unless you are signed in as you. Videos are stored privately and shown through short-lived links. If a breach puts you at risk, we tell you and the authority, as the law requires.</p>
  <h2>Your rights</h2>
  <p>You can see, correct, download or delete your data, restrict or object to how we use it, and withdraw consent at any time. Most of this works directly under You: “Download my data”, “Reset what the feed learned”, and “Delete my account and all data”. No decision with legal or similar effect on you is made automatically: a person reviews every moderation decision. For anything else, email <Ph>privacy email</Ph>; we answer within one month. You can also complain to the Hungarian data protection authority, NAIH (naih.hu), or the authority where you live.</p>
  <h2>Age</h2>
  <p>You can watch without an account. To create an account you must be at least 16. If you tell us you are under 18, your profile is shown to friends only, videos do not play by themselves, and break reminders come more often.</p>
  <h2>Changes</h2>
  <p>If we change this policy in a way that matters, we will tell you in the app before it applies.</p>
</> };

const privacyHu: Doc = { title: 'Adatvédelmi tájékoztató', updated: 'Utolsó módosítás: 2026. november 12.', body: <>
  <h2>Kik vagyunk</h2>
  <p>Az UNIER-t <Ph>üzemeltető neve</Ph>, <Ph>cím</Ph> üzemelteti („mi”). Mi döntünk arról, hogyan használjuk az adataidat. Kérdések, kérések: <Ph>adatvédelmi e-mail</Ph>.</p>
  <h2>Mit gyűjtünk és miért</h2>
  <ul>
    <li><b>A fiókod:</b> e-mail-cím, jelszó (csak titkosított formában tároljuk), valamint nem kötelező felhasználónév és név. Ezek a fiókod működtetéséhez kellenek (GDPR 6. cikk (1) b)). Ha Google-fiókkal lépsz be, a Google megerősíti nekünk az e-mail-címedet; a Google-fiókodra a Google saját szabályai vonatkoznak.</li>
    <li><b>Aláírásaid és indokaid:</b> az aláírás politikai véleményt fejez ki, amit a jog különleges adatként kezel. Csak a kifejezett hozzájárulásoddal rögzítjük (9. cikk (2) a)), és nyilvántartjuk, mikor adtad meg vagy vontad vissza, hogy ezt igazolni tudjuk. Az aláírások privátak: más nem látja őket, hacsak be nem kapcsolod, a petíciók címzettjei és szervezői csak összesített számokat kapnak. Minden aláírás mellé eltároljuk az internetkapcsolatod hozzávetőleges országát, kizárólag az átadási jelentés országonkénti összesítéséhez; a 10 aláírónál kisebb országokat összevonjuk. Az indokod csak akkor jelenik meg, ha te így döntesz. Bármelyik aláírást vagy a hozzájárulásodat bármikor visszavonhatod a Profil oldalon. A hozzájárulás visszavonása minden aláírásodat törli.</li>
    <li><b>Hivatalos petíciók máshol:</b> egyes petíciók egy másik oldalon futó hivatalos petícióra mutatnak (például az európai polgári kezdeményezésre). Az ottani aláírás külön dolog: azt az oldal a saját szabályai szerint kezeli.</li>
    <li><b>Követések, beállítások, ismerősök:</b> hogy megkapd a frissítéseket, és működjenek a használt funkciók (6. cikk (1) b)). Az ismerőseid csak akkor látják az aláírásaidat, ha ezt bekapcsolod. A megválaszolatlan ismerősnek jelöléseket 90 nap után töröljük. A meghívó linked egy véletlen kódot tartalmaz; ha újat kérsz, a régi link megszűnik.</li>
    <li><b>Profil és üzenetek:</b> a felhasználóneved, neved, rövid bemutatkozásod és a választott témáid nyilvánosak (ha jelezted, hogy 18 év alatti vagy: csak az ismerősöknek). Üzenetet csak ismerősök küldhetnek egymásnak; csak ti ketten olvashatjátok, kivéve ha valamelyikőtök bejelent egy üzenetet: ekkor az az egy üzenet a moderátorokhoz kerül. A letiltás azonnal elrejt titeket egymás elől. Az üzenetek a fiókoddal együtt törlődnek (6. cikk (1) b)).</li>
    <li><b>Bejelentéseid:</b> amit bejelentettél, és az indok, amit megadtál. A bejelentést csak a moderátoraink látják; a bejelentett személy nem tudja meg, ki jelentette be. Erre a jogellenes vagy ártalmas tartalmak kezeléséhez van szükség (6. cikk (1) c) és f), valamint az EU digitális szolgáltatásokról szóló rendelete). A bejelentéseket lezárásuk után 12 hónappal automatikusan töröljük.</li>
    <li><b>Feltöltött videók és petíciók:</b> jóváhagyás után nyilvánosak, az általad választott néven (6. cikk (1) b)). Ha valamit elutasítunk vagy eltávolítunk, az indokot a Profil oldalon látod.</li>
    <li><b>Amit a hírfolyamod tanul:</b> témánként egy pontszám a megnézett videók alapján, hogy kiválasszuk a következő videókat (jogos érdekünk, 6. cikk (1) f)). A Profil oldalon bármikor törölheted, vagy időrendi hírfolyamra válthatsz. Bejelentkezés nélkül ez csak a saját böngésződben tárolódik.</li>
    <li><b>Mylo és a hírek:</b> Mylo hangulata és a hírek rovat csak hírportálok nyilvános címeit és az UNIER összesített számait használja, például hogy ma hányan írtak alá. Rólad mint személyről semmilyen adatot nem használnak.</li>
    <li><b>Technikai adatok:</b> a tárhelyszolgáltatóink rövid ideig naplókat őriznek, köztük IP-címeket, a biztonság érdekében (6. cikk (1) f)).</li>
  </ul>
  <h2>Sütik és böngészőtárhely</h2>
  <p>Nem használunk reklám-, statisztikai vagy követő sütiket. Csak ezeket használjuk:</p>
  <ul>
    <li><b>Bejelentkezési süti</b> (<code>sb-…-auth-token</code>): bejelentkezve tart, amíg ki nem lépsz.</li>
    <li><b>lang</b>: a választott nyelv, 1 évig.</li>
    <li><b>geo</b>: az internetkapcsolatod hozzávetőleges országa, 24 óráig. Csak arra használjuk, hogy az aláírásod az országonkénti összesítésbe kerüljön.</li>
    <li><b>Böngészőtárhely</b>, ami a saját eszközödön marad: amit a hírfolyam tanult, ha nem vagy bejelentkezve (<code>unite-weights</code>), egy bejelentkezés előtt elkezdett aláírás, amíg el nem készül (<code>unier-pending-sign</code>), valamint hogy bezártál egy tippet, vagy Mylo ma már köszönt (<code>unier-install-dismissed</code>, <code>mylo-greeted</code>).</li>
  </ul>
  <h2>Kik kezelnek adatot a megbízásunkból</h2>
  <ul>
    <li>Supabase: adatbázis, bejelentkezés és videótárolás az EU-ban (Frankfurt).</li>
    <li>Vercel: a weboldal tárhelye, frankfurti szerverekkel. A Vercel amerikai cég, az EU általános szerződési feltételei és az EU–USA adatvédelmi keretrendszer kötik.</li>
    <li><Ph>e-mail-szolgáltató</Ph>: belépési és értesítő e-mailek küldése.</li>
    <li>Google: csak ha Google-fiókkal lépsz be.</li>
  </ul>
  <p>A hírekhez olyan hírportálok nyilvános hírcsatornáit olvassuk, mint a BBC, a The Guardian, a Telex vagy a HVG. Rólad semmit nem küldünk nekik. Az adataidat soha nem adjuk el, és nem használjuk hirdetésekhez.</p>
  <h2>Meddig őrizzük</h2>
  <ul>
    <li>Fiók, profil, beállítások, ismerősök és üzenetek: a fiók törléséig.</li>
    <li>Aláírások: amíg vissza nem vonod őket vagy a hozzájárulásodat, illetve amíg nem törlöd a fiókod. A hozzájárulásod nyilvántartása a fiókoddal együtt marad meg.</li>
    <li>Bejelentések: lezárásuk után 12 hónapig (naponta automatikusan töröljük).</li>
    <li>Megválaszolatlan ismerősnek jelölések: 90 napig (automatikusan töröljük).</li>
    <li>Szolgáltatói naplók: legfeljebb <Ph>30 nap</Ph> után törlődnek.</li>
  </ul>
  <h2>Biztonság</h2>
  <p>Minden kapcsolat titkosított. Az adatbázis minden kérésnél ellenőrzi, ki láthatja az adott sort, így még a saját weboldalunk sem fér hozzá a privát adataidhoz, csak ha te vagy bejelentkezve. A videókat privát tárhelyen őrizzük, és rövid ideig érvényes linkekkel jelenítjük meg. Ha adatvédelmi incidens veszélyt jelent rád, értesítünk téged és a hatóságot, ahogy a jog előírja.</p>
  <h2>Jogaid</h2>
  <p>Megnézheted, kijavíttathatod, letöltheted vagy töröltetheted az adataidat, kérheted a kezelés korlátozását, tiltakozhatsz ellene, és bármikor visszavonhatod a hozzájárulásodat. A legtöbb ilyen lépést közvetlenül a Profil oldalon megteheted: „Adataim letöltése”, „A hírfolyam által tanultak törlése” és „Fiókom és minden adatom törlése”. Rád nézve joghatással járó döntést nem hozunk automatikusan: minden moderálási döntést ember hoz meg. Minden más ügyben írj ide: <Ph>adatvédelmi e-mail</Ph>; egy hónapon belül válaszolunk. Panaszt tehetsz a Nemzeti Adatvédelmi és Információszabadság Hatóságnál (naih.hu), vagy a lakóhelyed szerinti hatóságnál.</p>
  <h2>Életkor</h2>
  <p>Nézni fiók nélkül is lehet. Fiókot 16 éves kortól hozhatsz létre. Ha jelzed, hogy 18 év alatti vagy, a profilod csak az ismerőseidnek látszik, a videók nem indulnak el maguktól, és gyakrabban kapsz szünetre emlékeztetőt.</p>
  <h2>Változások</h2>
  <p>Ha lényegesen módosítjuk ezt a tájékoztatót, előre szólunk az alkalmazásban.</p>
</> };

const termsEn: Doc = { title: 'Terms of use', updated: 'Last updated: 12 November 2026', body: <>
  <h2>What UNIER is</h2>
  <p>UNIER shows short videos about real issues, each linked to a petition you can sign. These terms apply when you use it. See also the <Link href="/privacy">privacy policy</Link>.</p>
  <h2>Who can use it</h2>
  <p>Anyone can watch. To sign, post or start a petition you need an account, and you must be at least 16. One account per person, so every signature counts once. You can delete your account at any time under You.</p>
  <h2>Petitions</h2>
  <ul>
    <li>A petition must be truthful, lawful and ask for something specific. Organisers are responsible for what they write.</li>
    <li>We review petitions before they go live, and may decline or remove ones that break these terms.</li>
    <li>Delivering a petition is the organiser’s job. UNIER cannot promise any result. Signatures on UNIER are not the same as an official petition with legal effect, unless the petition says it links to one.</li>
  </ul>
  <h2>Videos and links</h2>
  <ul>
    <li>You keep the rights to your videos. You allow UNIER to host, show and adapt them (for example trim them or blur faces) as part of the service, for as long as they are online.</li>
    <li>Only post what you filmed or may share, and what really happened. Never put yourself or others in danger for a shot.</li>
    <li>No hate, harassment, violence, private information about others, or deliberately false content.</li>
    <li>A video may link to another website, for example to donate or join an event. We check links when we review a video, but other websites are not ours and we are not responsible for them.</li>
  </ul>
  <h2>Being decent to people</h2>
  <p>Profiles and messages are for standing up together. No harassment, threats, spam or unwanted contact. Anyone can block you, and we may limit or close accounts that misuse messages.</p>
  <h2>Signing fairly</h2>
  <p>Up to 10 signatures per day. No fake accounts, bots or paid signatures. We may remove signatures and accounts that break this.</p>
  <h2>Mylo</h2>
  <p>Mylo, our little orange, shows a playful mood based on activity on UNIER and public headlines. He is a mascot, not news or advice.</p>
  <h2>Reporting and moderation</h2>
  <ul>
    <li>You can report any video, petition, profile or message, including content you believe is illegal. Tell us what it is and why; reports are reviewed by a person.</li>
    <li>If we remove, hide or limit something of yours, or your account, we tell you what we decided, which rule it was based on, and why.</li>
    <li>If you disagree, write to <Ph>contact email</Ph> within 6 months. Someone who did not make the first decision looks at it again and answers you. You can also turn to a certified out-of-court dispute body or a court.</li>
    <li>We may suspend, after a warning, accounts that often post clearly illegal content or often send clearly unfounded reports.</li>
  </ul>
  <h2>Liability</h2>
  <p>We work hard to keep UNIER available and accurate, but we provide it as it is. Nothing here limits rights you have under consumer law.</p>
  <h2>Law</h2>
  <p>Hungarian law applies. If we change these terms in a way that matters, we tell you in the app first.</p>
</> };

const termsHu: Doc = { title: 'Felhasználási feltételek', updated: 'Utolsó módosítás: 2026. november 12.', body: <>
  <h2>Mi az UNIER</h2>
  <p>Az UNIER rövid videókat mutat valódi ügyekről, mindegyikhez tartozik egy aláírható petíció. Ezek a feltételek vonatkoznak a használatára. Lásd még az <Link href="/privacy">adatvédelmi tájékoztatót</Link>.</p>
  <h2>Ki használhatja</h2>
  <p>Nézni bárki nézhet. Aláíráshoz, feltöltéshez vagy petíció indításához fiók kell, és legalább 16 évesnek kell lenned. Egy ember, egy fiók, így minden aláírás csak egyszer számít. A fiókodat bármikor törölheted a Profil oldalon.</p>
  <h2>Petíciók</h2>
  <ul>
    <li>A petíció legyen igaz, jogszerű, és kérjen valami konkrétat. A szervező felel azért, amit ír.</li>
    <li>Megjelenés előtt ellenőrizzük a petíciókat, és elutasíthatjuk vagy eltávolíthatjuk azokat, amelyek megsértik ezeket a feltételeket.</li>
    <li>A petíció átadása a szervező feladata. Az UNIER nem ígérhet eredményt. Az UNIER-en gyűjtött aláírás nem azonos a joghatással járó hivatalos petícióval, kivéve ha a petíció ilyenre mutat.</li>
  </ul>
  <h2>Videók és linkek</h2>
  <ul>
    <li>A videóid jogai nálad maradnak. Megengeded az UNIER-nek, hogy a szolgáltatás részeként tárolja, megjelenítse és átalakítsa őket (például megvágja vagy elhomályosítsa az arcokat), amíg elérhetők.</li>
    <li>Csak olyat tölts fel, amit te vettél fel vagy megoszthatsz, és ami valóban megtörtént. Egy felvételért se magadat, se mást ne sodorj veszélybe.</li>
    <li>Tilos a gyűlöletkeltés, zaklatás, erőszak, mások magánadatainak közzététele és a szándékosan hamis tartalom.</li>
    <li>Egy videó más weboldalra is mutathat, például adományozáshoz vagy egy eseményhez. A linkeket a videó ellenőrzésekor átnézzük, de a más weboldalak nem a mieink, és nem felelünk értük.</li>
  </ul>
  <h2>Tisztelet egymás iránt</h2>
  <p>A profilok és az üzenetek arra valók, hogy együtt álljunk ki. Tilos a zaklatás, fenyegetés, kéretlen üzenet és tolakodó kapcsolatfelvétel. Bárki letilthat, és a visszaélő fiókokat korlátozhatjuk vagy megszüntethetjük.</p>
  <h2>Tisztességes aláírás</h2>
  <p>Naponta legfeljebb 10 aláírás. Nincs álfiók, robot vagy fizetett aláírás. Az ezt megsértő aláírásokat és fiókokat eltávolíthatjuk.</p>
  <h2>Mylo</h2>
  <p>Mylo, a kis narancsunk, játékos hangulatot mutat az UNIER-en zajló aktivitás és a nyilvános hírcímek alapján. Ő kabalafigura, nem hír és nem tanács.</p>
  <h2>Bejelentés és moderálás</h2>
  <ul>
    <li>Bármelyik videót, petíciót, profilt vagy üzenetet bejelentheted, azt is, amit jogellenesnek tartasz. Írd meg, mi az és miért; a bejelentéseket ember nézi át.</li>
    <li>Ha eltávolítjuk, elrejtjük vagy korlátozzuk valamelyik tartalmadat vagy a fiókodat, megmondjuk, mit döntöttünk, melyik szabály alapján és miért.</li>
    <li>Ha nem értesz egyet, 6 hónapon belül írj ide: <Ph>kapcsolati e-mail</Ph>. Olyasvalaki nézi át újra, aki nem vett részt az első döntésben, és válaszol neked. Fordulhatsz tanúsított peren kívüli vitarendező testülethez vagy bírósághoz is.</li>
    <li>Figyelmeztetés után felfüggeszthetjük azokat a fiókokat, amelyek gyakran tesznek közzé nyilvánvalóan jogellenes tartalmat, vagy gyakran küldenek nyilvánvalóan alaptalan bejelentést.</li>
  </ul>
  <h2>Felelősség</h2>
  <p>Mindent megteszünk, hogy az UNIER elérhető és pontos legyen, de úgy biztosítjuk, ahogy van. Ez semmiben nem korlátozza a fogyasztóvédelmi jogaidat.</p>
  <h2>Jog</h2>
  <p>A magyar jog az irányadó. Ha lényegesen módosítjuk a feltételeket, előre szólunk az alkalmazásban.</p>
</> };

const imprintEn: Doc = { title: 'Imprint', updated: '', body: <>
  <ul>
    <li><b>Operator:</b> <Ph>full name or company name</Ph></li>
    <li><b>Address:</b> <Ph>address</Ph></li>
    <li><b>Email:</b> <Ph>contact email</Ph> (also our contact point for authorities and users under the EU Digital Services Act)</li>
    <li><b>Registration / tax number:</b> <Ph>if applicable</Ph></li>
    <li><b>Hosting:</b> Vercel Inc., vercel.com · Database and storage: Supabase Inc., supabase.com</li>
  </ul>
</> };
const imprintHu: Doc = { title: 'Impresszum', updated: '', body: <>
  <ul>
    <li><b>Üzemeltető:</b> <Ph>teljes név vagy cégnév</Ph></li>
    <li><b>Cím:</b> <Ph>cím</Ph></li>
    <li><b>E-mail:</b> <Ph>kapcsolati e-mail</Ph> (egyben a hatóságok és a felhasználók kapcsolattartási pontja az EU digitális szolgáltatásokról szóló rendelete szerint)</li>
    <li><b>Nyilvántartási / adószám:</b> <Ph>ha van</Ph></li>
    <li><b>Tárhely:</b> Vercel Inc., vercel.com · Adatbázis és tárolás: Supabase Inc., supabase.com</li>
  </ul>
</> };

export const LEGAL: Record<'privacy' | 'terms' | 'imprint', Record<Lang, Doc>> = {
  privacy: { en: privacyEn, hu: privacyHu },
  terms: { en: termsEn, hu: termsHu },
  imprint: { en: imprintEn, hu: imprintHu },
};
