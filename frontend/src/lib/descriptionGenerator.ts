// ── AI-Style 18+ Adult & Seductive Description Generator ──────────────────────

export interface DescriptionOption {
  id: string;
  label: string;
  badge: string;
  icon: string;
  text: string;
  wordCount: number;
}

interface GenerateParams {
  title: string;
  channelName?: string;
  actors?: string[];
  categories?: string[];
}

function cleanTitle(rawTitle: string): string {
  if (!rawTitle) return '';
  return rawTitle
    .replace(/\[[^\]]*\]/g, '') // remove [Tags]
    .replace(/\([^\)]*(?:1080p|720p|4k|fhd|hd|hevc|x264|x265)[^\)]*\)/gi, '') // remove resolution tags
    .replace(/\b(1080p|720p|480p|4k|fhd|hd|uhd|hevc|x264|x265|bluray|web-dl|rip)\b/gi, '')
    .replace(/\.(mp4|mkv|avi|mov|wmv|flv|webm)$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateDescriptionOptions(params: GenerateParams): DescriptionOption[] {
  const rawTitle = params.title || 'Featured 18+ Presentation';
  const cleaned = cleanTitle(rawTitle) || rawTitle.trim();
  const channel = params.channelName ? params.channelName.trim() : '';
  const actorsList = (params.actors || []).map(a => a.trim()).filter(Boolean);
  const categoriesList = (params.categories || []).map(c => c.trim()).filter(Boolean);

  const actorStr = actorsList.length > 0
    ? (actorsList.length === 1 
        ? actorsList[0] 
        : actorsList.length === 2 
          ? `${actorsList[0]} and ${actorsList[1]}` 
          : `${actorsList.slice(0, -1).join(', ')}, and ${actorsList[actorsList.length - 1]}`)
    : '';

  const genreStr = categoriesList.length > 0 ? categoriesList.slice(0, 2).join(' & ') : '18+ Adult';

  // ── Option 1: Seductive & Steamy Storyline (18+ Story-Driven) ──────────────
  const leadIn1 = [
    `In this sizzling 18+ release`,
    `In this steamy and seductive feature`,
    `In this tantalizing adult presentation`,
    `In this irresistibly hot production`,
  ];
  const channelPhrase1 = channel ? ` from ${channel}` : '';
  const actorPhrase1 = actorStr ? ` starring the gorgeous ${actorStr}` : '';
  const body1 = [
    `passions ignite and boundaries disappear in "${cleaned}". With magnetic chemistry and intense sensual tension building from the very start, every moment delivers pure adult pleasure and unforgettable excitement.`,
    `desire takes over in "${cleaned}". Featuring breathtaking on-screen chemistry and steamy encounters, this scene pulls you into an exhilarating world of pure passion and high-energy thrills.`,
    `the atmosphere turns intensely steamy in "${cleaned}". Masterfully directed to capture every seductive glance and passionate touch, this release builds up to an electrifying climax you won't forget.`,
  ];

  const text1 = `${randomPick(leadIn1)}${channelPhrase1}${actorPhrase1}, ${randomPick(body1)}`;

  // ── Option 2: Sensual & Passionate Synopsis (Sensual Adult) ────────────────
  const leadIn2 = [
    `Get ready for an intensely hot and passionate experience with "${cleaned}".`,
    `Indulge in pure seductive fantasy with "${cleaned}".`,
    `Turn up the heat with the sensual masterpiece "${cleaned}".`,
  ];
  const actorSentence2 = actorStr 
    ? `The stunning ${actorStr} delivers a wildly captivating performance full of seductive charm and raw erotic energy.` 
    : `Delivering a mesmerizing performance filled with undeniable sex appeal, tempting charm, and authentic passion.`;
  const genrePhrase2 = genreStr ? ` Bringing the best of ${genreStr.toLowerCase()} entertainment, ` : ' ';
  const closing2 = [
    `From the intimate opening moments to the explosive finale, this scene guarantees maximum viewing satisfaction.`,
    `An unforgettable adult encounter that will leave you craving more from start to finish.`,
    `Every sequence is packed with sizzling chemistry and pure, unfiltered passion.`,
  ];

  const text2 = `${randomPick(leadIn2)} ${actorSentence2}${genrePhrase2}it creates a deeply satisfying and steamy encounter. ${randomPick(closing2)}`;

  // ── Option 3: Spicy & High-Impact Preview (Short & Catchy) ─────────────────
  const actorLead3 = actorStr ? `The sexy ${actorStr} turns up the heat in` : 'Experience intense 18+ passion in';
  const punchyMiddle3 = [
    `Loaded with seductive chemistry, steamy moments, and non-stop adult excitement, this video is designed to thrill.`,
    `Packed with seductive energy, breathtaking beauty, and wild passion, every second delivers pure entertainment.`,
    `Featuring unforgettable highlights, sensual charm, and sensational adult performances, this is one steamy release you cannot miss.`,
  ];
  const channelEnding3 = channel ? `An absolute must-watch adult feature from ${channel}.` : `An essential spicy addition to your adult watchlist.`;

  const text3 = `${actorLead3} "${cleaned}". ${randomPick(punchyMiddle3)} ${channelEnding3}`;

  // ── Option 4: Premium FHD Adult Showcase (Glamour & Quality) ───────────────
  const qualityLead4 = [
    `Captured in crystal-clear Full HD clarity, "${cleaned}"`,
    `Delivering premium high-definition adult entertainment, "${cleaned}"`,
    `A visually stunning and ultra-sexy production, "${cleaned}"`,
  ];
  const actorPhrase4 = actorStr ? ` features the alluring ${actorStr} at their absolute sexiest` : ` showcases top-tier adult performers and seductive glamour`;
  const channelPhrase4 = channel ? ` presented by ${channel}` : '';
  const body4 = [
    `Combining rich visual clarity, steamy atmosphere, and magnetic charisma, this release sets a new standard for premium 18+ streaming.`,
    `With vibrant colors, intimate angles, and flawless adult chemistry, this video offers an irresistible and deeply satisfying sensory experience.`,
    `From start to finish, enjoy top-shelf adult production value, breathtaking sensual beauty, and pure excitement throughout.`,
  ];

  const text4 = `${randomPick(qualityLead4)}${channelPhrase4}${actorPhrase4}. ${randomPick(body4)}`;

  const options: DescriptionOption[] = [
    {
      id: 'steamy',
      label: 'Seductive & Steamy Storyline',
      badge: '18+ Story-Driven',
      icon: '🔥',
      text: text1.trim(),
      wordCount: text1.trim().split(/\s+/).length,
    },
    {
      id: 'sensual',
      label: 'Sensual & Passionate Synopsis',
      badge: '18+ Sensual',
      icon: '💋',
      text: text2.trim(),
      wordCount: text2.trim().split(/\s+/).length,
    },
    {
      id: 'spicy',
      label: 'Spicy & High-Impact',
      badge: '18+ Short & Hot',
      icon: '⚡',
      text: text3.trim(),
      wordCount: text3.trim().split(/\s+/).length,
    },
    {
      id: 'fhd_glamour',
      label: 'Premium FHD Adult Showcase',
      badge: '18+ Premium FHD',
      icon: '💎',
      text: text4.trim(),
      wordCount: text4.trim().split(/\s+/).length,
    },
  ];

  return options;
}
