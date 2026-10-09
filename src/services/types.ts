export interface Track {
    type: 'local' | 'url';
    query: string;
    title: string;
    artist: string;
    duration: number; // in seconds
    url?: string; // Resolved youtube url
    thumbnail?: string; // URL обложки
}
