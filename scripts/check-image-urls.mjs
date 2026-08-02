import { access, constants, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { artworks } from "../data/artworks.js";

const failures = [];
const imagePaths = artworks.map((artwork) => artwork.image);

if (new Set(imagePaths).size !== artworks.length) {
  const duplicates = [...new Set(
    imagePaths.filter(
      (imagePath, index) => imagePaths.indexOf(imagePath) !== index,
    ),
  )];
  failures.push({
    url: "artwork image mapping",
    status: "duplicate-path",
    contentType: duplicates.join(", "),
  });
}

const imageHashes = new Map();

for (const artwork of artworks) {
  const imageUrl = artwork.image;
  try {
    if (!imageUrl.startsWith("./")) {
      failures.push({
        url: imageUrl,
        status: "external-image",
        contentType: `${artwork.id} ${artwork.title}`,
      });
      continue;
    }

    const imagePath = new URL(`../${imageUrl.slice(2)}`, import.meta.url);
    await access(imagePath, constants.R_OK);
    const file = await readFile(imagePath);

    if (
      !imageUrl.endsWith(".jpg") ||
      file.length < 4 ||
      file[0] !== 0xff ||
      file[1] !== 0xd8 ||
      file[2] !== 0xff
    ) {
      failures.push({
        url: imageUrl,
        status: "invalid-jpeg",
        contentType: `${artwork.id} ${artwork.title}`,
      });
      continue;
    }

    const hash = createHash("sha256").update(file).digest("hex");
    const previousArtwork = imageHashes.get(hash);

    if (previousArtwork) {
      failures.push({
        url: imageUrl,
        status: "duplicate-file-content",
        contentType: `${previousArtwork.id} ${previousArtwork.title} / ${artwork.id} ${artwork.title}`,
      });
    } else {
      imageHashes.set(hash, artwork);
    }
  } catch (error) {
    failures.push({
      url: imageUrl,
      status: "network-error",
      contentType: error.message,
    });
  }
}

if (failures.length > 0) {
  console.error("Image asset verification failed:");
  for (const failure of failures) {
    console.error(
      `- ${failure.status} ${failure.contentType} ${failure.url}`,
    );
  }
  process.exit(1);
}

console.log(
  `Verified ${artworks.length} distinct local artwork image assets.`,
);
