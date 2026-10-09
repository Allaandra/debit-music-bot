import { Track } from './types';

export class QueueManager {
    queue: Track[] = [];
    originalQueue: Track[] = [];
    history: Track[] = [];
    activePlaylistName: string = 'Main Library';
    
    shuffle: boolean = false;
    repeatMode: 'off' | 'track' | 'all' = 'off';

    setQueue(tracks: Track[], playlistName?: string) {
        this.queue = tracks;
        if (playlistName) {
            this.activePlaylistName = playlistName;
        }
        if (this.shuffle) {
            this.originalQueue = [...this.queue];
            this._shuffleQueue();
        } else {
            this.originalQueue = [];
        }
    }

    addToHistory(track: Track) {
        this.history.push(track);
    }

    getNext(currentTrack: Track | null): Track | null {
        if (this.repeatMode === 'track' && currentTrack) {
            return currentTrack;
        }

        if (this.queue.length > 0) {
            if (this.repeatMode === 'all' && currentTrack) {
                this.queue.push(currentTrack);
                if (this.shuffle && this.originalQueue.length > 0) {
                    this.originalQueue.push(currentTrack);
                }
            }
            return this.queue.shift() || null;
        } else {
            if (this.repeatMode === 'all' && currentTrack) {
                return currentTrack;
            }
            return null;
        }
    }

    getPrevious(currentTrack: Track | null): Track | null {
        if (this.history.length > 0) {
            const prevTrack = this.history.pop()!;
            if (currentTrack) {
                this.queue.unshift(currentTrack);
            }
            return prevTrack;
        }
        return null;
    }

    toggleShuffle() {
        this.shuffle = !this.shuffle;
        if (this.shuffle) {
            this.originalQueue = [...this.queue];
            this._shuffleQueue();
        } else {
            if (this.originalQueue.length > 0) {
                this.queue = [...this.originalQueue];
            }
        }
    }

    private _shuffleQueue() {
        for (let i = this.queue.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]];
        }
    }

    toggleRepeat() {
        if (this.repeatMode === 'off') this.repeatMode = 'all';
        else if (this.repeatMode === 'all') this.repeatMode = 'track';
        else this.repeatMode = 'off';
    }
}
