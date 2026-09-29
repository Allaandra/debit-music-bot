const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');
const fs = require('fs');
const mm = require('music-metadata');
const youtubedl = require('youtube-dl-exec');
const play = require('play-dl');

async function fixThumbnails() {
    // Импортируем spotify-url-info асинхронно, так как это ESM или требует fetch (node 18+)
    const spotifyUrlInfo = (await import('spotify-url-info')).default;
    const spotify = spotifyUrlInfo(fetch);

    const db = await open({
        filename: path.join(__dirname, 'database.sqlite'),
        driver: sqlite3.Database
    });

    const tracks = await db.all('SELECT * FROM tracks WHERE thumbnail IS NULL');
    console.log(`Found ${tracks.length} tracks without thumbnails. Updating...`);

    for (const track of tracks) {
        try {
            console.log(`Processing: ${track.id}`);
            let newThumbnail = null;

            if (track.type === 'local') {
                const filePath = path.join(__dirname, 'sounds', track.query);
                if (fs.existsSync(filePath)) {
                    const metadata = await mm.parseFile(filePath);
                    if (metadata.common.picture && metadata.common.picture.length > 0) {
                        const pic = metadata.common.picture[0];
                        const coversDir = path.join(__dirname, 'covers');
                        if (!fs.existsSync(coversDir)) fs.mkdirSync(coversDir);
                        const coverName = track.query.replace(/\.[^/.]+$/, "") + '.jpg';
                        fs.writeFileSync(path.join(coversDir, coverName), pic.data);
                        newThumbnail = `/covers/${encodeURIComponent(coverName)}`;
                    }
                }
            } else if (track.type === 'url') {
                let watchUrl = track.query;
                
                // Эмулируем логику из PlayerManager.ts
                if (track.query.includes('spotify.com')) {
                    const data = await spotify.getPreview(track.query);
                    const searchResult = await play.search(`${data.title} ${data.artist}`, { limit: 1 });
                    if (searchResult && searchResult.length > 0) watchUrl = searchResult[0].url;
                } else if (!track.query.includes('youtube.com') && !track.query.includes('youtu.be') && !track.query.includes('soundcloud.com')) {
                    const searchResult = await play.search(track.query, { limit: 1 });
                    if (searchResult && searchResult.length > 0) watchUrl = searchResult[0].url;
                }

                const info = await youtubedl(watchUrl, { dumpJson: true, f: 'bestaudio', noWarnings: true });
                newThumbnail = info.thumbnail;
            }

            if (newThumbnail) {
                await db.run('UPDATE tracks SET thumbnail = ? WHERE id = ?', [newThumbnail, track.id]);
                console.log(`✅ Updated thumbnail for track id ${track.id}`);
            } else {
                console.log(`⚠️ No thumbnail found for track id ${track.id}`);
            }
        } catch (e) {
            console.error(`❌ Error processing track id ${track.id}:`, e.message);
        }
    }
    console.log('Done!');
}

fixThumbnails();
