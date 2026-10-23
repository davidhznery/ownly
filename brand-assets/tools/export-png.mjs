// Run from the project with Node and the existing sharp dependency.
import sharp from 'sharp';
import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
for (const dir of ['logos/exports', 'social/exports', 'colors-and-type']) {
  for (const file of await readdir(path.join(root, dir))) {
    if (!file.endsWith('.svg')) continue;
    const source = path.join(root, dir, file);
    const exportPath = source.replace(/\.svg$/, '.png');
    const input = sharp(source);
    if (dir === 'logos/exports') await input.resize({ width: file.includes('icon') ? 1024 : 2240 }).png().toFile(exportPath);
    else await input.png().toFile(exportPath);
    console.log(path.relative(root, exportPath));
  }
}
const files = ['post-square', 'post-portrait', 'story', 'facebook-profile', 'facebook-cover'];
const thumbnails = [];
for (let i = 0; i < files.length; i++) {
  const buffer = await sharp(path.join(root, 'social/exports', `${files[i]}.png`))
    .resize(300, 470, { fit: 'contain', background: '#E6EBE5' }).png().toBuffer();
  thumbnails.push({ input: buffer, left: 20 + i * 320, top: 20 });
}
await sharp({ create: { width: 1620, height: 510, channels: 3, background: '#E6EBE5' } })
  .composite(thumbnails).png().toFile(path.join(root, 'guidelines/preview.png'));
