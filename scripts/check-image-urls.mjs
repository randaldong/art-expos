import { artworks, imageAssets } from "../data/artworks.js";

const imageUrls = [
  ...new Set([...artworks.map((artwork) => artwork.image), ...Object.values(imageAssets)]),
];
const failures = [];

for (const imageUrl of imageUrls) {
  try {
    const response = await fetch(imageUrl, {
      headers: {
        "user-agent": "RenaissanceGuideAssetCheck/1.0",
      },
      redirect: "follow",
    });
    const contentType = response.headers.get("content-type") || "";

    if (!response.ok || !contentType.startsWith("image/")) {
      failures.push({
        url: imageUrl,
        status: response.status,
        contentType: contentType || "(missing)",
      });
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

console.log(`Verified ${imageUrls.length} unique image URLs.`);
