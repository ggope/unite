// Legal page texts in English and Hungarian. DRAFTS: have a lawyer check them before launch.
// Fill in every highlighted placeholder (search for <Ph>).
import Link from 'next/link';
import type { Lang } from './i18n/dict';

const Ph = ({ children }: { children: React.ReactNode }) => <span className="ph">{children}</span>;
type Doc = { title: string; updated: string; body: React.ReactNode };

const privacyEn: Doc = { title: 'Privacy policy', updated: 'Last updated: 11 November 2026', body: <>
  <h2>Who we are</h2>
  <p>UNIER is run by <Ph>operator name</Ph>, <Ph>address</Ph> (“we”). We decide how your data is used. Questions or requests: <Ph>privacy email</Ph>.</p>
  <h2>What we collect, and why</h2>
  <ul>
    <li><b>Your account:</b> email address, password (stored only in scrambled form), and an optional handle and name. We need these to run your account (GDPR Art. 6(1)(b)).</li>
    <li><b>Your signatures and reasons:</b> a signature shows a political opinion, which the law treats as sensitive. We only record signatures with your explicit consent (Art. 9(2)(a)). Signatures are private: nobody else can see them, and petition targets only receive totals. With each signature we keep the approximate country of your internet connection, only to show totals per country in the petition's delivery report; countries with fewer than 10 signers are grouped together. A reason is shown only if you choose. You can withdraw any signature, or your consent, at any time under You. Withdrawing consent deletes all your signatures.</li>
    <li><b>Follows, settings and friends:</b> to show you updates and run the features you use (Art. 6(1)(b)). Friends see your signatures only if you switch that on.</li>
    <li><b>Videos and petitions you post:</b> public once approved, under the name you choose (Art. 6(1)(b)).</li>
    <li><b>What your feed learns:</b> a score per topic, based on what you watch, to choose your next videos (our legitimate interest, Art. 6(1)(f)). You can reset it or switch to a time-ordered feed under You. If you are not signed in, this stays in your own browser.</li>
    <li><b>Technical data:</b> our hosting providers keep short-lived logs, including IP addresses, to keep the service secure.</li>
  </ul>
  <h2>Cookies and storage</h2>
  <p>We use only what the site needs to work: a login cookie, a cookie that remembers your language, and browser storage for your feed and dismissed messages. No advertising or tracking cookies.</p>
  <h2>Who handles data for us</h2>
  <ul>
    <li>Supabase: database, login and video storage, in the EU (Frankfurt).</li>
    <li>Vercel: website hosting, servers in Frankfurt. Vercel is a US company and is bound by the EU Standard Contractual Clauses.</li>
    <li><Ph>email provider</Ph>: sending login and update emails.</li>
  </ul>
  <p>We never sell your data and never show ads based on it.</p>
  <h2>How long we keep it</h2>
  <p>Account data stays until you delete your account. Signatures stay until you withdraw them or delete your account. Moderation records are kept for <Ph>12 months</Ph>. Provider logs are deleted after <Ph>30 days</Ph>.</p>
  <h2>Your rights</h2>
  <p>You can see, correct, download or delete your data, object to how we use it, and withdraw consent at any time. Most of this works directly under You, including “Delete my account and all data”. For anything else, email <Ph>privacy email</Ph>. You can also complain to the Hungarian data protection authority, NAIH (naih.hu).</p>
  <h2>Age</h2>
  <p>You can watch without an account. To create an account you must be at least 16, or have a parent’s consent.</p>
  <h2>Changes</h2>
  <p>If we change this policy in a way that matters, we will tell you in the app before it applies.</p>
</> };

const privacyHu: Doc = { title: 'Adatvédelmi tájékoztató', updated: 'Utolsó módosítás: 2026. november 11.', body: <>
  <h2>Kik vagyunk</h2>
  <p>Az UNIER-t <Ph>üzemeltető neve</Ph>, <Ph>cím</Ph> üzemelteti („mi”). Mi döntünk arról, hogyan használjuk az adataidat. Kérdések, kérések: <Ph>adatvédelmi e-mail</Ph>.</p>
  <h2>Mit gyűjtünk és miért</h2>
  <ul>
    <li><b>A fiókod:</b> e-mail-cím, jelszó (csak titkosított formában tároljuk), valamint nem kötelező felhasználónév és név. Ezek a fiókod működtetéséhez kellenek (GDPR 6. cikk (1) b)).</li>
    <li><b>Aláírásaid és indokaid:</b> az aláírás politikai véleményt fejez ki, amit a jog különleges adatként kezel. Csak a kifejezett hozzájárulásoddal rögzítjük (9. cikk (2) a)). Az aláírások privátak: más nem látja őket, a petíciók címzettjei csak az összesített számot kapják meg. Minden aláírás mellé eltároljuk az internetkapcsolatod hozzávetőleges országát, kizárólag az átadási jelentés országonkénti összesítéséhez; a 10 aláírónál kisebb országokat összevonjuk. Az indokod csak akkor jelenik meg, ha te így döntesz. Bármelyik aláírást vagy a hozzájárulásodat bármikor visszavonhatod a Profil oldalon. A hozzájárulás visszavonása minden aláírásodat törli.</li>
    <li><b>Követések, beállítások, ismerősök:</b> hogy megkapd a frissítéseket, és működjenek a használt funkciók (6. cikk (1) b)). Az ismerőseid csak akkor látják az aláírásaidat, ha ezt bekapcsolod.</li>
    <li><b>Feltöltött videók és petíciók:</b> jóváhagyás után nyilvánosak, az általad választott néven (6. cikk (1) b)).</li>
    <li><b>Amit a hírfolyamod tanul:</b> témánként egy pontszám a megnézett videók alapján, hogy kiválasszuk a következő videókat (jogos érdekünk, 6. cikk (1) f)). A Profil oldalon törölheted, vagy időrendi hírfolyamra válthatsz. Bejelentkezés nélkül ez csak a saját böngésződben tárolódik.</li>
    <li><b>Technikai adatok:</b> a tárhelyszolgáltatóink rövid ideig naplókat őriznek, köztük IP-címeket, a biztonság érdekében.</li>
  </ul>
  <h2>Sütik és tárolás</h2>
  <p>Csak azt használjuk, ami a működéshez kell: egy bejelentkezési sütit, egy sütit a nyelvválasztásodhoz, és böngészőtárhelyet a hírfolyamhoz és a bezárt üzenetekhez. Nincsenek reklám- vagy követő sütik.</p>
  <h2>Kik kezelnek adatot a megbízásunkból</h2>
  <ul>
    <li>Supabase: adatbázis, bejelentkezés és videótárolás az EU-ban (Frankfurt).</li>
    <li>Vercel: a weboldal tárhelye, frankfurti szerverekkel. A Vercel amerikai cég, az EU általános szerződési feltételei kötik.</li>
    <li><Ph>e-mail-szolgáltató</Ph>: belépési és értesítő e-mailek küldése.</li>
  </ul>
  <p>Az adataidat soha nem adjuk el, és nem használjuk hirdetésekhez.</p>
  <h2>Meddig őrizzük</h2>
  <p>A fiókadatokat a fiók törléséig. Az aláírásokat addig, amíg vissza nem vonod őket, vagy nem törlöd a fiókod. A moderálási nyilvántartást <Ph>12 hónapig</Ph>. A szolgáltatói naplókat <Ph>30 nap</Ph> után töröljük.</p>
  <h2>Jogaid</h2>
  <p>Megnézheted, kijavíttathatod, letöltheted vagy töröltetheted az adataidat, tiltakozhatsz a kezelésük ellen, és bármikor visszavonhatod a hozzájárulásodat. A legtöbb ilyen lépést közvetlenül a Profil oldalon megteheted, köztük a „Fiókom és minden adatom törlése” gombbal. Minden más ügyben írj ide: <Ph>adatvédelmi e-mail</Ph>. Panaszt tehetsz a Nemzeti Adatvédelmi és Információszabadság Hatóságnál is (naih.hu).</p>
  <h2>Életkor</h2>
  <p>Nézni fiók nélkül is lehet. Fiókot 16 éves kortól, vagy szülői hozzájárulással hozhatsz létre.</p>
  <h2>Változások</h2>
  <p>Ha lényegesen módosítjuk ezt a tájékoztatót, előre szólunk az alkalmazásban.</p>
</> };

const termsEn: Doc = { title: 'Terms of use', updated: 'Last updated: 11 November 2026', body: <>
  <h2>What UNIER is</h2>
  <p>UNIER shows short videos about real issues, each linked to a petition you can sign. These terms apply when you use it. See also the <Link href="/privacy">privacy policy</Link>.</p>
  <h2>Who can use it</h2>
  <p>Anyone can watch. To sign, post or start a petition you need an account, and you must be at least 16. One account per person, so every signature counts once.</p>
  <h2>Petitions</h2>
  <ul>
    <li>A petition must be truthful, lawful and ask for something specific. Organisers are responsible for what they write.</li>
    <li>We review petitions before they go live, and may decline or remove ones that break these terms.</li>
    <li>Delivering a petition is the organiser’s job. UNIER cannot promise any result.</li>
  </ul>
  <h2>Videos</h2>
  <ul>
    <li>You keep the rights to your videos. You allow UNIER to host, show and adapt them (for example trim them) as part of the service, for as long as they are online.</li>
    <li>Only post what you filmed or may share, and what really happened. Never put yourself or others in danger for a shot.</li>
    <li>No hate, harassment, violence, private information about others, or deliberately false content.</li>
  </ul>
  <h2>Signing fairly</h2>
  <p>Up to 10 signatures per day. No fake accounts, bots or paid signatures. We may remove signatures and accounts that break this.</p>
  <h2>Reporting and moderation</h2>
  <p>You can report any video or petition. If we remove something of yours, we tell you why, and you can ask us to look again by writing to <Ph>contact email</Ph>.</p>
  <h2>Liability</h2>
  <p>We work hard to keep UNIER available and accurate, but we provide it as it is. Nothing here limits rights you have under consumer law.</p>
  <h2>Law</h2>
  <p>Hungarian law applies. If we change these terms in a way that matters, we tell you in the app first.</p>
</> };

const termsHu: Doc = { title: 'Felhasználási feltételek', updated: 'Utolsó módosítás: 2026. november 11.', body: <>
  <h2>Mi az UNIER</h2>
  <p>Az UNIER rövid videókat mutat valódi ügyekről, mindegyikhez tartozik egy aláírható petíció. Ezek a feltételek vonatkoznak a használatára. Lásd még az <Link href="/privacy">adatvédelmi tájékoztatót</Link>.</p>
  <h2>Ki használhatja</h2>
  <p>Nézni bárki nézhet. Aláíráshoz, feltöltéshez vagy petíció indításához fiók kell, és legalább 16 évesnek kell lenned. Egy ember, egy fiók, így minden aláírás csak egyszer számít.</p>
  <h2>Petíciók</h2>
  <ul>
    <li>A petíció legyen igaz, jogszerű, és kérjen valami konkrétat. A szervező felel azért, amit ír.</li>
    <li>Megjelenés előtt ellenőrizzük a petíciókat, és elutasíthatjuk vagy eltávolíthatjuk azokat, amelyek megsértik ezeket a feltételeket.</li>
    <li>A petíció átadása a szervező feladata. Az UNIER nem ígérhet eredményt.</li>
  </ul>
  <h2>Videók</h2>
  <ul>
    <li>A videóid jogai nálad maradnak. Megengeded az UNIER-nek, hogy a szolgáltatás részeként tárolja, megjelenítse és átalakítsa őket (például megvágja), amíg elérhetők.</li>
    <li>Csak olyat tölts fel, amit te vettél fel vagy megoszthatsz, és ami valóban megtörtént. Egy felvételért se magadat, se mást ne sodorj veszélybe.</li>
    <li>Tilos a gyűlöletkeltés, zaklatás, erőszak, mások magánadatainak közzététele és a szándékosan hamis tartalom.</li>
  </ul>
  <h2>Tisztességes aláírás</h2>
  <p>Naponta legfeljebb 10 aláírás. Nincs álfiók, robot vagy fizetett aláírás. Az ezt megsértő aláírásokat és fiókokat eltávolíthatjuk.</p>
  <h2>Bejelentés és moderálás</h2>
  <p>Bármelyik videót vagy petíciót bejelentheted. Ha eltávolítjuk valamelyik tartalmadat, megmondjuk, miért, és kérheted, hogy nézzük át újra: <Ph>kapcsolati e-mail</Ph>.</p>
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
