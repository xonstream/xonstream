import { Video, Channel, Actor, Category } from './types';

export const categories: Category[] = [
  { id: 'all', name: 'All', icon: '🌐' },
  { id: 'music', name: 'Music', icon: '🎵' },
  { id: 'gaming', name: 'Gaming', icon: '🎮' },
  { id: 'news', name: 'News', icon: '📰' },
  { id: 'live', name: 'Live', icon: '🔴' },
  { id: 'podcasts', name: 'Podcasts', icon: '🎙️' },
  { id: 'films', name: 'Films', icon: '🎬' },
  { id: 'sports', name: 'Sports', icon: '⚽' },
  { id: 'education', name: 'Education', icon: '📚' },
  { id: 'comedy', name: 'Comedy', icon: '😂' },
  { id: 'tech', name: 'Technology', icon: '💻' },
  { id: 'cooking', name: 'Cooking', icon: '🍳' },
];

export const channels: Channel[] = [
  {
    id: 'ch-1',
    name: 'TechVision',
    handle: '@techvision',
    logo: 'https://api.dicebear.com/7.x/initials/svg?seed=TV&backgroundColor=ff0000',
    banner: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&h=300&fit=crop',
    description: 'Your daily dose of tech reviews, unboxings, and the latest in technology. We cover smartphones, laptops, gadgets, and everything tech!',
    subscribers: 13600000,
    totalVideos: 980,
    verified: true,
  },
  {
    id: 'ch-2',
    name: 'MusicWorld',
    handle: '@musicworld',
    logo: 'https://api.dicebear.com/7.x/initials/svg?seed=MW&backgroundColor=3ea6ff',
    banner: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1200&h=300&fit=crop',
    description: 'The best music videos, live performances, and behind-the-scenes content from your favorite artists.',
    subscribers: 45200000,
    totalVideos: 2340,
    verified: true,
  },
  {
    id: 'ch-3',
    name: 'GameZone',
    handle: '@gamezone',
    logo: 'https://api.dicebear.com/7.x/initials/svg?seed=GZ&backgroundColor=00c853',
    banner: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1200&h=300&fit=crop',
    description: 'Epic gaming content! Walkthroughs, reviews, live streams, and esports highlights.',
    subscribers: 8900000,
    totalVideos: 1560,
    verified: true,
  },
  {
    id: 'ch-4',
    name: 'CookMaster',
    handle: '@cookmaster',
    logo: 'https://api.dicebear.com/7.x/initials/svg?seed=CM&backgroundColor=ff6d00',
    banner: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=1200&h=300&fit=crop',
    description: 'Delicious recipes from around the world. Easy cooking tutorials for everyone!',
    subscribers: 5400000,
    totalVideos: 780,
    verified: false,
  },
  {
    id: 'ch-5',
    name: 'ScienceHub',
    handle: '@sciencehub',
    logo: 'https://api.dicebear.com/7.x/initials/svg?seed=SH&backgroundColor=d500f9',
    banner: 'https://images.unsplash.com/photo-1507413245164-6160d8298b31?w=1200&h=300&fit=crop',
    description: 'Mind-blowing science experiments and explanations. Making science fun and accessible!',
    subscribers: 12100000,
    totalVideos: 650,
    verified: true,
  },
  {
    id: 'ch-6',
    name: 'TravelDiaries',
    handle: '@traveldiaries',
    logo: 'https://api.dicebear.com/7.x/initials/svg?seed=TD&backgroundColor=e91e63',
    banner: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1200&h=300&fit=crop',
    description: 'Explore the world with us! Travel vlogs, tips, and breathtaking destinations.',
    subscribers: 3200000,
    totalVideos: 420,
    verified: false,
  },
];

const thumbnails = [
  'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=640&h=360&fit=crop',
  'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=640&h=360&fit=crop',
  'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=640&h=360&fit=crop',
  'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=640&h=360&fit=crop',
  'https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=640&h=360&fit=crop',
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=640&h=360&fit=crop',
  'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=640&h=360&fit=crop',
  'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=640&h=360&fit=crop',
  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=640&h=360&fit=crop',
  'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=640&h=360&fit=crop',
  'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=640&h=360&fit=crop',
  'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=640&h=360&fit=crop',
  'https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=640&h=360&fit=crop',
  'https://images.unsplash.com/photo-1574375927938-d5a98e8d7e28?w=640&h=360&fit=crop',
  'https://images.unsplash.com/photo-1535016120720-40c646be5580?w=640&h=360&fit=crop',
  'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=640&h=360&fit=crop',
  'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=640&h=360&fit=crop',
  'https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=640&h=360&fit=crop',
];

const videoTitles = [
  'The Future of AI: What You Need to Know in 2024',
  'Building a Complete Web App from Scratch — Full Course',
  'Top 10 Gadgets That Changed Everything',
  'Epic Gaming Montage — Best Plays of the Year',
  'Learn React in 30 Minutes — Beginner Tutorial',
  'The Ultimate Cooking Challenge — 5 Star Meals',
  'How the Universe Actually Works — Mind Blown',
  'Remote Work Setup Tour — My 2024 Desk Setup',
  'Exploring Hidden Gems in Southeast Asia',
  'The Science Behind Your Morning Coffee',
  'Building My Dream PC — $5000 Budget',
  'Best Albums of 2024 — Full Review',
  'Live Concert Highlights — Summer Festival',
  'Fitness Routine That Actually Works',
  'Photography Tips for Absolute Beginners',
  'Cybersecurity Basics Everyone Should Know',
  'JavaScript Advanced Patterns Explained',
  'The Art of Minimalist Design',
  'Street Food Tour — Bangkok Edition',
  'Neural Networks Explained Simply',
  'Retro Gaming Collection Tour',
  'Making Music with Only Free Software',
  'Drone Cinematography Masterclass',
  'Why Clean Code Matters More Than You Think',
];

const durations = ['2:30', '15:42', '8:17', '22:05', '10:30', '45:12', '6:48', '31:20', '12:55', '18:33', '7:22', '25:10'];

export const videos: Video[] = Array.from({ length: 24 }, (_, i) => ({
  id: `v-${i + 1}`,
  title: videoTitles[i % videoTitles.length],
  thumbnail: thumbnails[i % thumbnails.length],
  duration: durations[i % durations.length],
  server1: `https://example.com/embed/server1/${i + 1}`,
  server2: `https://example.com/embed/server2/${i + 1}`,
  server3: `https://example.com/embed/server3/${i + 1}`,
  server4: `https://example.com/embed/server4/${i + 1}`,
  channelId: channels[i % channels.length].id,
  categoryIds: [categories[(i % (categories.length - 1)) + 1].id],
  description: `This is an amazing video about ${videoTitles[i % videoTitles.length].toLowerCase()}. Watch to learn more!`,
  uploadDate: `${(i % 28) + 1} Jun 2024`,
  views: Math.floor(Math.random() * 15000000) + 100000,
  likes: Math.floor(Math.random() * 500000) + 10000,
}));

export const actors: Actor[] = [
  { id: 'a-1', name: 'Alex Johnson', image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex', totalVideos: 9532 },
  { id: 'a-2', name: 'Sarah Chen', image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah', totalVideos: 7821 },
  { id: 'a-3', name: 'Mike Rivera', image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Mike', totalVideos: 6543 },
  { id: 'a-4', name: 'Emma Wilson', image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Emma', totalVideos: 5210 },
  { id: 'a-5', name: 'James Park', image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=James', totalVideos: 4320 },
  { id: 'a-6', name: 'Lisa Zhang', image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Lisa', totalVideos: 3890 },
  { id: 'a-7', name: 'David Kim', image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=David', totalVideos: 3210 },
  { id: 'a-8', name: 'Nina Patel', image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Nina', totalVideos: 2890 },
  { id: 'a-9', name: 'Carlos Ruiz', image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Carlos', totalVideos: 2450 },
  { id: 'a-10', name: 'Amy Brooks', image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Amy', totalVideos: 1980 },
  { id: 'a-11', name: 'Ryan Taylor', image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Ryan', totalVideos: 1650 },
  { id: 'a-12', name: 'Sophie Martin', image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sophie', totalVideos: 1420 },
  { id: 'a-13', name: 'Tom Harris', image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Tom', totalVideos: 1100 },
  { id: 'a-14', name: 'Rachel Lee', image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Rachel', totalVideos: 890 },
  { id: 'a-15', name: 'Chris Wang', image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Chris', totalVideos: 750 },
  { id: 'a-16', name: 'Diana Costa', image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Diana', totalVideos: 620 },
  { id: 'a-17', name: 'Kevin Moore', image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Kevin', totalVideos: 540 },
  { id: 'a-18', name: 'Julia Smith', image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Julia', totalVideos: 430 },
];

export function formatViews(views: number): string {
  if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M views`;
  if (views >= 1000) return `${(views / 1000).toFixed(0)}K views`;
  return `${views} views`;
}

export function formatSubscribers(subs: number): string {
  if (subs >= 1000000) return `${(subs / 1000000).toFixed(1)}M subscribers`;
  if (subs >= 1000) return `${(subs / 1000).toFixed(0)}K subscribers`;
  return `${subs} subscribers`;
}

export function getChannel(channelId: string): Channel | undefined {
  return channels.find(c => c.id === channelId);
}

export function getVideosByChannel(channelId: string): Video[] {
  return videos.filter(v => v.channelId === channelId);
}

export function getVideosByCategory(categoryId: string): Video[] {
  if (categoryId === 'all') return videos;
  return videos.filter(v => v.categoryIds.includes(categoryId));
}

export function searchVideos(query: string): Video[] {
  const q = query.toLowerCase();
  return videos.filter(v => 
    v.title.toLowerCase().includes(q) || 
    v.description.toLowerCase().includes(q)
  );
}
