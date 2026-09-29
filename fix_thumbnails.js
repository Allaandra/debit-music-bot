const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');
const fs = require('fs');
const mm = require('music-metadata');
const youtubedl = require('youtube-dl-exec');

async function fixThumbnails() {
    const db = await open({
        filename: path.join(__dirname, 'database.sqlite'),
        driver: sqlite3.Database
    });

    const tracks = await db.all('SELECT * FROM tracks WHERE thumbnail IS NULL');
    console.log(`Found ${tracks.length} tracks without thumbnails. Updating...`);

    for (const track of tracks) {
        try {
            console.log(`Processing: ${track.title}`);
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
                const info = await youtubedl(track.query, { dumpJson: true, f: 'bestaudio', noWarnings: true });
                newThumbnail = info.thumbnail;
            }

            if (newThumbnail) {
                await db.run('UPDATE tracks SET thumbnail = ? WHERE id = ?', [newThumbnail, track.id]);
                console.log(`✅ Updated thumbnail for ${track.title}`);
            } else {
                console.log(`⚠️ No thumbnail found for ${track.title}`);
            }
        } catch (e) {
            console.error(`❌ Error processing ${track.title}:`, e.message);
        }
    }
    console.log('Done!');
}

fixThumbnails();
