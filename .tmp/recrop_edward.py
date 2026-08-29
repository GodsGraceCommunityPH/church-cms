from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / ".tmp" / "pastor-portraits"
OUTPUT = ROOT / "frontend" / "src" / "assets" / "pastors"


def crop(source: str, destination: str, zoom: float, x_position: float, y_position: float) -> None:
    with Image.open(SOURCE / source) as original:
        image = original.rotate(90, expand=True)
        target_width, target_height = 1200, 820
        scale = max(target_width / image.width, target_height / image.height) * zoom
        resized = image.resize(
            (round(image.width * scale), round(image.height * scale)),
            Image.Resampling.LANCZOS,
        )
        left = round((resized.width - target_width) * x_position)
        top = round((resized.height - target_height) * y_position)
        result = resized.crop((left, top, left + target_width, top + target_height))
        result.save(OUTPUT / destination, "WEBP", quality=88, method=6)


crop("IMG_0114.JPG", "edward-card-preview.webp", 1.10, 0.32, 0.23)
crop("IMG_0100.JPG", "enrico-card-preview.webp", 1.05, 0.50, 0.18)
