import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const outputDirectory = path.resolve('public/images/optimized');

const images = [
  { name: 'nanakamado', source: 'img/nanakamado.png', widths: [960, 1600, 2400] },
  { name: 'panel01', source: 'img/panel01.png', widths: [480, 768, 1020] },
  { name: 'panel03', source: 'img/panel03.png', widths: [480, 768, 1020] },
  { name: 'profile', source: 'public/images/ayana-yamazaki.jpg', widths: [360, 720, 1080] },
  { name: 'reposaku-cover', source: 'img/reposaku/reposaku-cover.jpg', widths: [720, 1440, 2400] },
  { name: 'field-research-01', source: 'img/reposaku/Field Research01.jpg', widths: [480, 960, 1440] },
  { name: 'field-research-02', source: 'img/reposaku/Field Research02.jpg', widths: [360, 720, 890] },
  { name: 'field-research-04', source: 'img/reposaku/Field Research04.jpg', widths: [360, 720, 890] },
  { name: 'field-research-05', source: 'img/reposaku/Field Research05.jpg', widths: [360, 720, 890] },
  { name: 'field-research-senior', source: 'img/reposaku/Field Research-senior.jpg', widths: [480, 960, 1440] },
  { name: 'reposaku-device-on', source: 'img/reposaku/device-on.jpg', widths: [640, 1200, 1600] },
  { name: 'reposaku-keyvisual', source: 'img/reposaku/keyvisual.jpg', widths: [720, 1440, 2400] },
  { name: 'reposaku-report-hero', source: 'public/images/reposaku-report-hero.jpg', widths: [640, 1200, 1920] },
  { name: 'reposaku-report-research', source: 'public/images/reposaku-report-research.png', widths: [800, 1200, 1600] },
  { name: 'reposaku-report-split', source: 'public/images/reposaku-report-split.png', widths: [480, 768, 1024] },
  { name: 'reposaku-report-product', source: 'public/images/reposaku-report-product.webp', widths: [480, 960, 1440] },
  { name: 'build-ai-native-hero', source: 'public/images/build-ai-native-hero.png', widths: [480, 768, 1024] },
  { name: 'medical-input-v1', source: 'public/images/medical-ui/input-v1.png', widths: [480, 960, 1440] },
  { name: 'medical-input-v2', source: 'public/images/medical-ui/input-v2.png', widths: [480, 960, 1440] },
  { name: 'medical-input-v3', source: 'public/images/medical-ui/input-v3.png', widths: [480, 960, 1440] },
  { name: 'medical-input-v4', source: 'public/images/medical-ui/input-v4.png', widths: [480, 960, 1440] },
  { name: 'medical-input-v5', source: 'public/images/medical-ui/input-v5.png', widths: [480, 960, 1440] },
  { name: 'medical-input-final', source: 'public/images/medical-ui/input-final.png', widths: [480, 960, 1218] },
  { name: 'medical-feedback-v1', source: 'public/images/medical-ui/feedback-v1.png', widths: [480, 960, 1440] },
  { name: 'medical-feedback-v2', source: 'public/images/medical-ui/feedback-v2.png', widths: [480, 960, 1440] },
  { name: 'medical-feedback-v3', source: 'public/images/medical-ui/feedback-v3.png', widths: [480, 960, 1440] },
  { name: 'medical-feedback-v4', source: 'public/images/medical-ui/feedback-v4.png', widths: [480, 960, 1440] },
  { name: 'medical-feedback-final', source: 'public/images/medical-ui/feedback-final.png', widths: [480, 960, 1440] },
  { name: 'medical-interactive-prototype', source: 'public/images/medical-ui/interactive-prototype.png', widths: [480, 960, 1399] },
  { name: 'medical-design-specification', source: 'public/images/medical-ui/design-specification.png', widths: [640, 1280, 1920] },
  { name: 'medical-component-states', source: 'public/images/medical-ui/component-states.png', widths: [640, 1280, 1920] },
];

await mkdir(outputDirectory, { recursive: true });

for (const image of images) {
  for (const width of image.widths) {
    const source = sharp(image.source).rotate().resize({
      width,
      withoutEnlargement: true,
    });
    await Promise.all([
      source.clone()
        .avif({ quality: 54, effort: 5 })
        .toFile(path.join(outputDirectory, `${image.name}-${width}.avif`)),
      source.clone()
        .webp({ quality: 76, effort: 5 })
        .toFile(path.join(outputDirectory, `${image.name}-${width}.webp`)),
    ]);
  }
}
