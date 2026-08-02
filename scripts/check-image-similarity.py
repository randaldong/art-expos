from itertools import combinations
from pathlib import Path
import sys

from PIL import Image


ARTWORKS_DIR = Path(__file__).resolve().parent.parent / "assets" / "artworks"
SIMILARITY_THRESHOLD = 40


def average_hash(image):
    grayscale = image.convert("L").resize((16, 16))
    pixels = list(grayscale.getdata())
    mean = sum(pixels) / len(pixels)
    return sum(
        1 << index for index, value in enumerate(pixels) if value >= mean
    )


def difference_hash(image):
    grayscale = image.convert("L").resize((17, 16))
    pixels = list(grayscale.getdata())
    return sum(
        1 << (row * 16 + column)
        for row in range(16)
        for column in range(16)
        if pixels[row * 17 + column] > pixels[row * 17 + column + 1]
    )


def hamming_distance(first, second):
    return bin(first ^ second).count("1")


image_paths = sorted(ARTWORKS_DIR.glob("work-*.jpg"))

if len(image_paths) != 36:
    print(f"Expected 36 artwork images, found {len(image_paths)}.", file=sys.stderr)
    sys.exit(1)

hashes = []
for image_path in image_paths:
    try:
        with Image.open(image_path) as image:
            if image.format != "JPEG":
                raise ValueError(f"Expected JPEG, found {image.format}")
            image.load()
            hashes.append(
                (
                    image_path.name,
                    average_hash(image),
                    difference_hash(image),
                )
            )
    except Exception as error:
        print(f"Could not validate {image_path.name}: {error}", file=sys.stderr)
        sys.exit(1)

suspicious_pairs = []
for first, second in combinations(hashes, 2):
    distance = hamming_distance(first[1], second[1]) + hamming_distance(
        first[2],
        second[2],
    )
    if distance <= SIMILARITY_THRESHOLD:
        suspicious_pairs.append((first[0], second[0], distance))

if suspicious_pairs:
    print("Visually similar artwork image assets detected:", file=sys.stderr)
    for first, second, distance in suspicious_pairs:
        print(f"- {first} / {second}: distance {distance}", file=sys.stderr)
    sys.exit(1)

print("Verified 36 artwork images have no visually similar duplicates.")
