export interface MusicTrack {
  id: string;
  name: string;
  artist: string;
  category: string;
  mood: string;
  duration: string;
  url: string;
  previewUrl: string;
}

export const musicCategories = [
  "Cinematic",
  "Upbeat",
  "Ambient",
  "Dramatic",
  "Peaceful",
  "Epic",
] as const;

export const musicMoods = [
  "Happy",
  "Sad",
  "Energetic",
  "Calm",
  "Tense",
  "Inspirational",
  "Mysterious",
  "Romantic",
] as const;

// Royalty-free music library
// In production, these would link to actual licensed tracks
export const musicLibrary: MusicTrack[] = [
  {
    id: "epic-adventure-1",
    name: "Epic Adventure",
    artist: "Cinematic Sounds",
    category: "Epic",
    mood: "Inspirational",
    duration: "3:45",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    previewUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
  },
  {
    id: "peaceful-morning-1",
    name: "Peaceful Morning",
    artist: "Ambient Waves",
    category: "Peaceful",
    mood: "Calm",
    duration: "2:30",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    previewUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
  },
  {
    id: "dramatic-tension-1",
    name: "Dramatic Tension",
    artist: "Score Masters",
    category: "Dramatic",
    mood: "Tense",
    duration: "4:15",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
    previewUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
  },
  {
    id: "upbeat-energy-1",
    name: "Upbeat Energy",
    artist: "Happy Tunes",
    category: "Upbeat",
    mood: "Energetic",
    duration: "3:00",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
    previewUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
  },
  {
    id: "ambient-space-1",
    name: "Ambient Space",
    artist: "Cosmic Sounds",
    category: "Ambient",
    mood: "Mysterious",
    duration: "5:20",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
    previewUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
  },
  {
    id: "cinematic-hero-1",
    name: "Cinematic Hero",
    artist: "Film Scores",
    category: "Cinematic",
    mood: "Inspirational",
    duration: "4:00",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3",
    previewUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3",
  },
  {
    id: "romantic-melody-1",
    name: "Romantic Melody",
    artist: "Love Themes",
    category: "Peaceful",
    mood: "Romantic",
    duration: "3:30",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3",
    previewUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3",
  },
  {
    id: "sad-piano-1",
    name: "Melancholy Piano",
    artist: "Emotional Keys",
    category: "Dramatic",
    mood: "Sad",
    duration: "2:45",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3",
    previewUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3",
  },
  {
    id: "happy-acoustic-1",
    name: "Happy Acoustic",
    artist: "Sunny Days",
    category: "Upbeat",
    mood: "Happy",
    duration: "3:15",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3",
    previewUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3",
  },
  {
    id: "epic-battle-1",
    name: "Epic Battle",
    artist: "War Drums",
    category: "Epic",
    mood: "Tense",
    duration: "4:30",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3",
    previewUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3",
  },
];

export const getMusicByCategory = (category: string) => {
  return musicLibrary.filter((track) => track.category === category);
};

export const getMusicByMood = (mood: string) => {
  return musicLibrary.filter((track) => track.mood === mood);
};

export const getMusicById = (id: string) => {
  return musicLibrary.find((track) => track.id === id);
};
